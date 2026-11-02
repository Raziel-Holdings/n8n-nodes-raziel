# n8n-nodes-raziel

This is an n8n community node for [Raziel](https://raziel.co), the alternative asset management platform. It lets you run Raziel's free private-market and startup finance calculators inside your n8n workflows: IRR, XIRR, MOIC, TVPI/DPI, SAFE conversion, convertible notes, dilution, option pools, liquidation preferences, QSBS and more.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Compatibility](#compatibility) · [Usage](#usage) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-raziel`.

## Operations

### Calculator

| Operation | What it returns |
| --- | --- |
| IRR | Internal rate of return for evenly spaced yearly cash flows |
| XIRR | Annualized return for dated cash flows, like Excel XIRR |
| MOIC | Multiple on invested capital and implied annual return |
| CAGR | Compound annual growth rate |
| TVPI and DPI | Fund multiples: TVPI, DPI and RVPI |
| Carried Interest | GP carry and LP net proceeds with fees, hurdle and catch-up |
| SAFE Conversion | Shares, price and ownership when a SAFE converts |
| Convertible Note | Accrued interest, conversion price and shares |
| Startup Valuation | Post-money, price per share and ownership |
| Startup Dilution | Ownership across multiple rounds with pool top-ups |
| Option Pool | Pool shuffle effect on the effective pre-money |
| Pro Rata | Check size needed to keep your ownership |
| Liquidation Preference | Exit waterfall by series and common |
| Secondary Sale | Proceeds, discount and gain on a secondary |
| QSBS (Section 1202) | Holding period and estimated gain exclusion |
| 83(b) and QSBS Date | 83(b) deadline and QSBS milestone dates |
| Startup Runway | Months of runway with burn and revenue growth |
| Cap Rate | Capitalization rate for a property |
| Cash on Cash Return | Leveraged rental return |
| Portfolio Allocation | Allocation by asset class with concentration flags |
| Burn Multiple, Rule of 40, LTV to CAC, CAC Payback Period, Net and Gross Revenue Retention | Founder metrics with benchmarks |

Every result includes `calculator_url`, a raziel.co page where you can adjust the inputs.

### Reference

- **Define Term**: plain-English definition of a private-market term (pro rata, MFN, DPI, carried interest, 83(b) and more).
- **Search Guides**: search Raziel's guides on private investing, startups and funds. Returns one item per guide by default.

Inputs follow the API conventions: money in US dollars, percentages as percent numbers (20 means 20%), dates as calendar dates.

## Credentials

None. The [Raziel calculator API](https://raziel.co/developers) is free and needs no API key. It is rate limited per IP.

## Compatibility

Built with `@n8n/node-cli` and tested against n8n 2.x. The node is usable as an AI Agent tool.

## Usage

Example: track an angel portfolio in a spreadsheet and get the XIRR for each deal every month.

1. A **Schedule Trigger** runs monthly.
2. A **Google Sheets** node reads each deal's dated cash flows.
3. The **Raziel** node (Calculator > XIRR) maps the dates and amounts into **Cash Flows**.
4. Write `xirr_pct` back to the sheet, or post it to Slack.

Results are for education only, not tax, legal or investment advice.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Raziel developer docs](https://raziel.co/developers) (REST API, OpenAPI spec, MCP server)
- [Raziel calculators](https://raziel.co/tools)

## Version history

- 0.1.1: published from GitHub Actions with npm provenance; clearer API error messages.
- 0.1.0: first release with 25 calculators and the Define Term and Search Guides operations.
