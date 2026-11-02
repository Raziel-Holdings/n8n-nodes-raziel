import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { calculatorFields, calculatorOperations, INPUT_MAP } from './CalculatorDescription';
import { referenceFields, referenceOperations } from './ReferenceDescription';
import { buildCalculatorBody, razielApiRequest } from './GenericFunctions';

/**
 * Programmatic style rather than declarative: calculator bodies are assembled
 * from required parameters, an optional "Options" collection and nested
 * fixedCollections (cash flows, rounds, holdings) whose shapes are generated
 * from the API schemas, which routing.send cannot express cleanly.
 */
export class Raziel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Raziel',
		name: 'raziel',
		icon: { light: 'file:raziel.svg', dark: 'file:raziel.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Private-market and startup finance calculators (IRR, XIRR, MOIC, TVPI/DPI, SAFE conversion, dilution, QSBS and more) from Raziel',
		defaults: {
			name: 'Raziel',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Calculator', value: 'calculator' },
					{ name: 'Reference', value: 'reference' },
				],
				default: 'calculator',
			},
			...calculatorOperations,
			...calculatorFields,
			...referenceOperations,
			...referenceFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'calculator') {
					const inputs = INPUT_MAP[operation];
					if (!inputs) {
						throw new NodeOperationError(this.getNode(), `Unknown calculator "${operation}"`, { itemIndex: i });
					}
					const body = buildCalculatorBody.call(this, inputs, operation, i);
					const result = await razielApiRequest.call(this, 'POST', `/calculators/${inputs.endpoint}`, i, body);
					returnData.push({ json: result, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'reference' && operation === 'defineTerm') {
					const term = this.getNodeParameter('term', i) as string;
					const result = await razielApiRequest.call(this, 'GET', '/glossary', i, undefined, { term });
					returnData.push({ json: result, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'reference' && operation === 'searchGuides') {
					const query = this.getNodeParameter('query', i) as string;
					const limit = this.getNodeParameter('maxResults', i, 5) as number;
					const split = this.getNodeParameter('splitIntoItems', i, true) as boolean;
					const result = await razielApiRequest.call(this, 'GET', '/guides', i, undefined, { q: query, limit });
					const guides = (result.results ?? []) as IDataObject[];
					if (split) {
						for (const guide of guides) returnData.push({ json: guide, pairedItem: { item: i } });
					} else {
						returnData.push({ json: result, pairedItem: { item: i } });
					}
					continue;
				}

				throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex: i });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// NodeOperationError passes an existing NodeOperationError through unchanged.
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
