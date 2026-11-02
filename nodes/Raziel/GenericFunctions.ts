import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { CalculatorInputs, FieldType, InputField } from './CalculatorDescription';

export const API_BASE = 'https://raziel.co/api/v1';

/** Calls the Raziel API (free, no key) and returns the `result` payload. */
export async function razielApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	itemIndex: number,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	let response: { statusCode: number; body: IDataObject };
	try {
		// HTTP errors are read below instead of thrown, so a 400 keeps the API's
		// readable message, such as '"invested_usd" must be greater than 0.'
		response = (await this.helpers.httpRequest({
			method,
			url: `${API_BASE}${path}`,
			body,
			qs,
			json: true,
			headers: { 'User-Agent': 'n8n-nodes-raziel' },
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
		})) as { statusCode: number; body: IDataObject };
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
	const data = response.body ?? {};
	if (response.statusCode === 429) {
		throw new NodeOperationError(this.getNode(), 'Raziel rate limit reached (60 requests per minute per IP)', {
			itemIndex,
			description: 'Wait a minute, or add a Wait node or batching before this node.',
		});
	}
	if (response.statusCode >= 400 || data.ok !== true) {
		const message = typeof data.error === 'string' ? data.error : `Raziel API returned HTTP ${response.statusCode}`;
		throw new NodeOperationError(this.getNode(), message, { itemIndex });
	}
	return (data.result ?? {}) as IDataObject;
}

/** n8n dateTime values can be ISO timestamps or Luxon objects; the API wants YYYY-MM-DD. */
function toDate(value: unknown): string {
	const s = typeof value === 'string' ? value : String((value as { toISO?: () => string })?.toISO?.() ?? value ?? '');
	return s.slice(0, 10);
}

function convert(value: unknown, type: FieldType): unknown {
	if (type === 'date') return toDate(value);
	if (type === 'integer') return Math.round(Number(value));
	if (type === 'number') return Number(value);
	return value;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

function readField(field: InputField, raw: unknown): unknown {
	if ('array' in field) {
		const rows = ((raw as IDataObject | undefined)?.values ?? []) as IDataObject[];
		const spec = field.array;
		if (spec.kind === 'scalar') return rows.map((row) => convert(row.value, spec.type));
		return rows.map((row) => {
			const out: IDataObject = {};
			for (const [param, f] of Object.entries(spec.fields)) {
				const v = row[param];
				if (isEmpty(v) && !f.required) continue;
				out[f.key] = convert(v, f.type) as IDataObject[string];
			}
			return out;
		});
	}
	return convert(raw, field.type);
}

/** Turns the node parameters for one calculator into the API's JSON body. */
export function buildCalculatorBody(this: IExecuteFunctions, inputs: CalculatorInputs, operation: string, itemIndex: number): IDataObject {
	const body: IDataObject = {};
	for (const field of inputs.fields) {
		const raw = this.getNodeParameter(field.param, itemIndex, 'array' in field ? {} : undefined);
		if (isEmpty(raw) && !field.required) continue;
		body[field.key] = readField(field, raw) as IDataObject[keyof IDataObject];
	}
	const options = this.getNodeParameter(`${operation}Options`, itemIndex, {}) as IDataObject;
	for (const field of inputs.options) {
		const raw = options[field.param];
		if (isEmpty(raw)) continue;
		body[field.key] = readField(field, raw) as IDataObject[keyof IDataObject];
	}
	return body;
}
