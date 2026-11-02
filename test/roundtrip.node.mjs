// Round-trip test: every calculator's documented example, expressed as n8n
// parameters, must turn back into exactly that JSON body. Run after `npm run build`.
// Set RAZIEL_LIVE=1 to also POST each body to the live API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { INPUT_MAP, calculatorFields, calculatorOperations } = require('../dist/nodes/Raziel/CalculatorDescription.js');
const { buildCalculatorBody } = require('../dist/nodes/Raziel/GenericFunctions.js');
const examples = JSON.parse(readFileSync(new URL('./fixtures/examples.json', import.meta.url), 'utf8'));

/** n8n dateTime parameters arrive as ISO timestamps. */
const asParam = (value, type) => (type === 'date' ? `${value}T00:00:00` : value);

function toParams(op, example) {
	const params = {};
	const options = {};
	const put = (field, target) => {
		if (!(field.key in example)) return;
		const v = example[field.key];
		if ('array' in field) {
			const spec = field.array;
			const rows =
				spec.kind === 'scalar'
					? v.map((x) => ({ value: x }))
					: v.map((row) => Object.fromEntries(Object.entries(spec.fields).filter(([, f]) => f.key in row).map(([p, f]) => [p, asParam(row[f.key], f.type)])));
			target[field.param] = { values: rows };
		} else {
			target[field.param] = asParam(v, field.type);
		}
	};
	for (const f of INPUT_MAP[op].fields) put(f, params);
	for (const f of INPUT_MAP[op].options) put(f, options);
	params[`${op}Options`] = options;
	return params;
}

function fakeContext(params) {
	return {
		getNodeParameter(name, _i, fallback) {
			return name in params ? params[name] : fallback;
		},
	};
}

test('every calculator operation has inputs and a fixture', () => {
	const ops = calculatorOperations[0].options.map((o) => o.value);
	assert.equal(ops.length, 25);
	for (const op of ops) {
		assert.ok(INPUT_MAP[op], `INPUT_MAP missing ${op}`);
		assert.ok(examples[op], `fixture missing ${op}`);
	}
});

test('parameter names are unique per operation', () => {
	const seen = new Set();
	for (const p of calculatorFields) {
		const key = `${p.name}|${p.displayOptions.show.operation[0]}`;
		assert.ok(!seen.has(key), `duplicate ${key}`);
		seen.add(key);
	}
});

for (const [op, example] of Object.entries(examples)) {
	test(`${op}: parameters round-trip to the example body`, async () => {
		const mapped = new Set([...INPUT_MAP[op].fields, ...INPUT_MAP[op].options].map((f) => f.key));
		for (const k of Object.keys(example)) assert.ok(mapped.has(k), `${op}: example key ${k} has no parameter`);

		const body = buildCalculatorBody.call(fakeContext(toParams(op, example)), INPUT_MAP[op], op, 0);
		assert.deepEqual(body, example);

		if (process.env.RAZIEL_LIVE) {
			const res = await fetch(`https://raziel.co/api/v1/calculators/${INPUT_MAP[op].endpoint}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			});
			const json = await res.json();
			assert.equal(json.ok, true, `${op}: ${json.error}`);
		}
	});
}

test('optional fields left empty are not sent', () => {
	const params = { moicInvestedUsd: 100, moicValueReturnedUsd: 250, moicOptions: {} };
	assert.deepEqual(buildCalculatorBody.call(fakeContext(params), INPUT_MAP.moic, 'moic', 0), { invested_usd: 100, value_returned_usd: 250 });
});
