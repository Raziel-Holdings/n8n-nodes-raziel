/**
 * Generates nodes/Raziel/CalculatorDescription.ts (and test fixtures) from the
 * live Raziel calculator API, the same definitions behind raziel.co/developers,
 * the MCP server and the CLI:
 *
 *   npm run generate
 *
 * Each calculator becomes one operation of the "Calculator" resource. Required
 * inputs are top-level parameters; optional inputs live in an "Options"
 * collection so they are only sent when the user sets them. Arrays become
 * fixedCollections. The generated INPUT_MAP tells the node how to turn the
 * parameters back into the API's JSON body. CI runs this weekly and fails when
 * the API has changed, so the node never drifts from it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const API = process.env.RAZIEL_API ?? 'https://raziel.co/api/v1';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'n8n-nodes-raziel-generator' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const list = (await getJson(`${API}/calculators`)).calculators;
const CALCULATORS = [];
for (const c of list) {
  const detail = await getJson(`${API}/calculators/${c.name}`);
  CALCULATORS.push({ name: c.name, title: c.title, description: c.description, inputSchema: detail.inputSchema, example: detail.example });
}

/* ---------- naming ---------- */

const ACRONYMS = { usd: 'USD', mrr: 'MRR', arr: 'ARR', noi: 'NOI', cac: 'CAC', ltv: 'LTV', arpa: 'ARPA', moic: 'MOIC', nav: 'NAV', qsbs: 'QSBS', irr: 'IRR', tvpi: 'TVPI', dpi: 'DPI', safe: 'SAFE' };
const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (s) => camel(s).replace(/^./, (c) => c.toUpperCase());

/** invested_usd -> "Invested (USD)", gross_margin_pct -> "Gross Margin (%)" (n8n wants title case). */
function label(key) {
  let unit = '';
  let base = key;
  if (base.endsWith('_usd')) { unit = ' (USD)'; base = base.slice(0, -4); }
  else if (base.endsWith('_pct')) { unit = ' (%)'; base = base.slice(0, -4); }
  const words = base.split('_').map((w) => ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ') + unit;
}

/** n8n lint: no trailing period on one-sentence descriptions, no em dashes, no double spaces. */
function desc(text) {
  if (!text) return undefined;
  let t = text.replace(/\s+/g, ' ').replace(/—|–/g, ',').trim();
  const sentences = t.split(/(?<=\.)\s+(?=[A-Z0-9"(])/);
  if (sentences.length === 1) t = t.replace(/\.$/, '');
  return t;
}

const enumName = (v) => String(v).split(/[_-]/).map((w) => (ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

/* ---------- schema -> n8n property ---------- */

/** One scalar schema to an n8n property object (without displayOptions). */
function scalarProp(key, schema, { required = false, nameOverride } = {}) {
  const p = { displayName: label(key), name: nameOverride ?? camel(key) };
  if (schema.enum) {
    p.type = 'options';
    p.options = [...schema.enum].sort((a, b) => enumName(a).localeCompare(enumName(b))).map((v) => ({ name: enumName(v), value: v }));
    p.default = schema.default ?? schema.enum[0];
  } else if (schema.type === 'string' && schema.format === 'date') {
    p.type = 'dateTime';
    p.default = '';
  } else if (schema.type === 'string') {
    p.type = 'string';
    p.default = schema.default ?? '';
  } else if (schema.type === 'boolean') {
    p.type = 'boolean';
    p.default = schema.default ?? false;
  } else if (schema.type === 'number' || schema.type === 'integer') {
    p.type = 'number';
    p.default = typeof schema.default === 'number' ? schema.default : 0;
    const typeOptions = {};
    if (schema.type === 'integer') typeOptions.numberPrecision = 0;
    else if (!key.endsWith('_usd') && !key.endsWith('_pct')) typeOptions.numberPrecision = 4;
    else typeOptions.numberPrecision = 2;
    if (typeof schema.minimum === 'number') typeOptions.minValue = schema.minimum;
    if (typeof schema.maximum === 'number') typeOptions.maxValue = schema.maximum;
    p.typeOptions = typeOptions;
  } else {
    throw new Error(`Unsupported schema for ${key}: ${JSON.stringify(schema)}`);
  }
  if (required) p.required = true;
  const d = desc(schema.description);
  if (d) p.description = d;
  return p;
}

/** Fields of an array of objects (or of numbers) as a fixedCollection. Returns [prop, mapEntry]. */
function arrayProp(key, schema, opName, required) {
  const items = schema.items;
  const valuesName = 'values';
  let fields;
  let itemMap;
  if (items.type === 'object') {
    const req = new Set(items.required ?? []);
    fields = Object.entries(items.properties).map(([k, s]) => scalarProp(k, s, { required: req.has(k) }));
    itemMap = { kind: 'object', fields: Object.fromEntries(Object.entries(items.properties).map(([k, s]) => [camel(k), { key: k, type: s.format === 'date' ? 'date' : s.type, required: req.has(k) }])) };
  } else {
    const valueKey = key.replace(/s_usd$/, '_usd').replace(/s$/, '');
    fields = [scalarProp(valueKey, { ...items, description: items.description ?? schema.description }, { required: true, nameOverride: 'value' })];
    itemMap = { kind: 'scalar', type: items.type };
  }
  const singular = label(key).replace(/ \((USD|%)\)$/, '').replace(/s$/, '');
  const prop = {
    displayName: label(key),
    name: `${opName}${pascal(key)}`,
    type: 'fixedCollection',
    typeOptions: { multipleValues: true, sortable: true },
    placeholder: `Add ${singular}`,
    default: {},
    options: [{ displayName: singular, name: valuesName, values: fields }],
  };
  if (required) prop.required = true;
  const d = desc(schema.description);
  if (d) prop.description = d;
  return [prop, { key, param: prop.name, array: itemMap, required }];
}

const calcProps = [];
const inputMap = {};
const opOptions = [];

for (const c of CALCULATORS) {
  const op = camel(c.name);
  const show = { resource: ['calculator'], operation: [op] };
  const s = c.inputSchema;
  const req = new Set(s.required ?? []);
  const map = { endpoint: c.name, fields: [], options: [] };
  const optionFields = [];

  for (const [key, schema] of Object.entries(s.properties)) {
    const isReq = req.has(key);
    if (schema.type === 'array') {
      const [prop, entry] = arrayProp(key, schema, op, isReq);
      if (isReq) {
        calcProps.push({ ...prop, displayOptions: { show } });
        map.fields.push(entry);
      } else {
        const { required: _r, ...rest } = prop;
        optionFields.push({ ...rest, name: camel(key) });
        map.options.push({ ...entry, param: camel(key) });
      }
      continue;
    }
    // An optional enum with a default is still a primary choice (mode, safe type, seniority): keep it top level.
    if (isReq || (schema.enum && schema.default !== undefined)) {
      const name = `${op}${pascal(key)}`;
      calcProps.push({ ...scalarProp(key, schema, { required: isReq, nameOverride: name }), displayOptions: { show } });
      map.fields.push({ key, param: name, type: schema.format === 'date' ? 'date' : schema.type, required: isReq });
    } else {
      optionFields.push(scalarProp(key, schema));
      map.options.push({ key, param: camel(key), type: schema.format === 'date' ? 'date' : schema.type });
    }
  }

  if (optionFields.length) {
    optionFields.sort((a, b) => a.displayName.localeCompare(b.displayName));
    calcProps.push({
      displayName: 'Options',
      name: `${op}Options`,
      type: 'collection',
      placeholder: 'Add option',
      default: {},
      displayOptions: { show },
      options: optionFields,
    });
  }
  inputMap[op] = map;

  const title = c.title.replace(/ calculator$/i, '').replace(/ analyzer$/i, '');
  // "Startup runway" -> "startup runway", but keep acronyms like "SAFE", "IRR", "LTV".
  const actionTitle = /^[A-Z][a-z]/.test(title) ? title.charAt(0).toLowerCase() + title.slice(1) : title;
  opOptions.push({
    name: title,
    value: op,
    description: desc(c.description.split(/(?<=\.)\s/)[0]),
    action: `Calculate ${actionTitle}`,
  });
}

opOptions.sort((a, b) => a.name.localeCompare(b.name));

const operationProp = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['calculator'] } },
  options: opOptions,
  default: 'moic',
};

/* ---------- write ---------- */

const header = `/* Generated by scripts/generate.mjs from src/calc-api/registry.ts. Do not edit by hand. */\n`;
const ts = `${header}import type { INodeProperties } from 'n8n-workflow';

export type FieldType = 'number' | 'integer' | 'string' | 'boolean' | 'date';

export interface ScalarField {
\tkey: string;
\tparam: string;
\ttype: FieldType;
\trequired?: boolean;
}

export interface ArrayField {
\tkey: string;
\tparam: string;
\trequired?: boolean;
\tarray:
\t\t| { kind: 'scalar'; type: FieldType }
\t\t| { kind: 'object'; fields: Record<string, { key: string; type: FieldType; required: boolean }> };
}

export type InputField = ScalarField | ArrayField;

export interface CalculatorInputs {
\tendpoint: string;
\tfields: InputField[];
\toptions: InputField[];
}

export const calculatorOperations: INodeProperties[] = [
${JSON.stringify(operationProp, null, '\t').replace(/^/gm, '\t')},
];

export const calculatorFields: INodeProperties[] = ${JSON.stringify(calcProps, null, '\t')};

export const INPUT_MAP: Record<string, CalculatorInputs> = ${JSON.stringify(inputMap, null, '\t')};
`;

writeFileSync(join(pkgRoot, 'nodes/Raziel/CalculatorDescription.ts'), ts);
// Test fixtures: each calculator's documented example input (not published; "files" is dist only).
mkdirSync(join(pkgRoot, 'test/fixtures'), { recursive: true });
writeFileSync(join(pkgRoot, 'test/fixtures/examples.json'), JSON.stringify(Object.fromEntries(CALCULATORS.map((c) => [camel(c.name), c.example])), null, '\t') + '\n');
console.log(`Wrote ${CALCULATORS.length} calculator operations, ${calcProps.length} properties.`);
