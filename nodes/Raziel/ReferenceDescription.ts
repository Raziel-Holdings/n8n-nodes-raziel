import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string) => ({ show: { resource: ['reference'], operation: [operation] } });

export const referenceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['reference'] } },
		options: [
			{
				name: 'Define Term',
				value: 'defineTerm',
				description:
					'Plain-English definition of a private-market, venture or fund term, with a link to the matching guide or calculator',
				action: 'Define a term',
			},
			{
				name: 'Search Guides',
				value: 'searchGuides',
				description:
					'Search Raziel guides on private investing, startups, funds and founder topics (SAFEs, cap tables, K-1s, QSBS and more)',
				action: 'Search guides',
			},
		],
		default: 'defineTerm',
	},
];

export const referenceFields: INodeProperties[] = [
	{
		displayName: 'Term',
		name: 'term',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. pro rata',
		description: 'The term to define, for example "liquidation preference" or "DPI". Enter "list" to get every term.',
		displayOptions: show('defineTerm'),
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. safe discount vs valuation cap',
		description: 'What to look for, in plain words',
		displayOptions: show('searchGuides'),
	},
	{
		displayName: 'Max Results',
		name: 'maxResults',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 10 },
		default: 5,
		description: 'Max number of results to return',
		displayOptions: show('searchGuides'),
	},
	{
		displayName: 'Split Into Items',
		name: 'splitIntoItems',
		type: 'boolean',
		default: true,
		description: 'Whether to output one item per guide instead of a single item with all results',
		displayOptions: show('searchGuides'),
	},
];
