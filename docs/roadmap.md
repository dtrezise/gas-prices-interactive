# Product Roadmap

This roadmap keeps the rebuild focused on a trustworthy presidential-term gas-price comparison while leaving room for deeper energy-market analysis.

## V1 Product Spine

- U.S. gasoline price line is the primary object.
- Presidential administrations are context bands, not causal claims.
- Inflation, Europe, recessions, major events, market proxy, and oil-company equities are optional layers.
- CSV export and shared links reflect the visible chart range.
- Methodology stays visible enough to prevent overreading the comparison.

## Implemented In This Rebuild Pass

- Refreshed generated data through June 29, 2026.
- Added URL-backed view state for chart range, view, price mode, overlays, and stock selections.
- Added visible-range CSV export.
- Added shareable links.
- Added drag-to-zoom brushing on the timeline chart.
- Added date range inputs and reset control.
- Added dedicated methodology view.
- Split series, export, and view-state logic out of the main React component.
- Added durable agentic role cards and role-aware issue/PR templates.

## Near-Term Enhancements

- Add visual regression smoke tests for desktop and mobile chart states.
- Add keyboard-accessible range stepping for the timeline.
- Add a compact mobile chart summary for small screens before horizontal scrolling.
- Add event filtering by category and confidence.
- Add an administration detail drawer with term high, low, start, end, and nearby events.

## Data Expansion Candidates

- EIA regional U.S. gasoline series.
- State or metro gasoline series where official coverage is stable.
- Crude oil benchmarks such as WTI and Brent from official or licensed sources.
- Federal and state gasoline tax context.
- Refinery capacity and utilization.
- Strategic Petroleum Reserve releases.
- Household affordability measures using official income or CPI components.

## Market Expansion Candidates

- Refiners, services, and pipeline companies.
- Dividend-adjusted return if an official or licensed source is available.
- S&P energy-sector index context if redistribution terms are acceptable.

## Research Standards

- Prefer official or institutional sources.
- Keep source-policy allowlists current.
- Record why each event belongs in the dataset.
- Avoid unsupported blame, credit, or single-cause claims.

