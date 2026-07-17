# Gas Prices Interactive Agent Guide

Use this file as the durable working agreement for Codex and other agentic contributors on this project. The project compares gasoline prices across time, administrations, market conditions, and verified events. Accuracy and framing matter as much as the interface.

## Default Operating Rules

- Work from the repository root: `/Users/dan/Documents/GitHub/gas-prices-interactive`.
- Preserve the official-source policy in `README.md`, `data/source-policy.json`, and `scripts/verify-data.mjs`.
- Treat administration overlays as descriptive context, not proof of presidential causality.
- Keep generated public data reproducible through `scripts/update-data.mjs`; do not hand-edit `public/data/series.json` except for clearly documented emergency repair work.
- Run the smallest useful verification for every change. Prefer `npm run data:verify`, `npm run test`, and `npm run build` when the change touches data, tests, or app code.
- Keep chart and UI changes responsive, accessible, and readable on mobile and desktop.

## Agentic Role Roster

Activate these roles deliberately during planning, implementation, review, and release.

| Role | Use When | Primary Files |
| --- | --- | --- |
| Data Integrity Analyst | Data refreshes, source changes, schema changes, generated data review | `scripts/update-data.mjs`, `scripts/verify-data.mjs`, `data/source-policy.json`, `public/data/series.json` |
| Energy Markets Researcher | Event curation, oil/gas context, market overlays, source interpretation | `data/events.json`, `public/data/sources.json`, `README.md` |
| Frontend Visualization Engineer | Chart interaction, controls, layout, accessibility, visual polish | `src/App.tsx`, `src/styles.css`, `src/lib/chart.ts` |
| Product Editor / Narrative Designer | User-facing copy, methodology, anti-overclaiming, story flow | `README.md`, `src/App.tsx`, `data/events.json` |
| QA Automation Engineer | Test coverage, CI, reproducibility, release confidence | `scripts/*.test.mjs`, `.github/workflows`, `package.json` |
| Civic / Policy Context Reviewer | Administration framing, policy context, politically sensitive claims | `data/presidents.json`, `data/events.json`, `src/App.tsx` |

Detailed role cards live in `docs/agents/`.

## Recommended Review Pattern

1. Name the active role or roles before a significant change.
2. Gather evidence from the relevant files and official sources.
3. Make the smallest coherent change.
4. Run role-appropriate checks.
5. In the final summary, call out which roles shaped the decision and what verification passed.

For cross-cutting work, use this order:

1. Data Integrity Analyst
2. Energy Markets Researcher
3. Civic / Policy Context Reviewer
4. Frontend Visualization Engineer
5. Product Editor / Narrative Designer
6. QA Automation Engineer

<!-- BEGIN AI MODEL ROUTING GOVERNANCE -->
## AI model routing

Apply the rules-first Prompt Routing Test before substantive execution. For obvious routine prompts, this may be an implicit near-zero-overhead classification. For ambiguous, consequential, or multi-task prompts, consult `MODEL_ROUTING.md` and run `../ai-model-routing-governance/.venv/bin/python ../ai-model-routing-governance/scripts/route-prompt.py` before choosing a route.

Keep named-model facts in the central registry, honor `.ai-routing.local.yaml`, separate ChatGPT allowance from API billing, and do not invoke optional model adjudication without explicit opt-in.

For substantive routed work, append a compact routing receipt to the final response. Report the planned model, reasoning posture, and orchestration posture from the route; these product labels come from the replaceable execution-posture mapping, not stable doctrine. Distinguish the planned route from what actually executed. The Codex router automatically checks the exact active session identified by `CODEX_THREAD_ID`; when its output includes `Observed execution`, report that value as `host-metadata`. Mark execution as `unknown` only when the router cannot obtain that observation. Never claim that planned worker models executed merely because they appear in a route plan. Use `../ai-model-routing-governance/.venv/bin/python ../ai-model-routing-governance/scripts/render-routing-receipt.py` when a saved route JSON is available. Expand the receipt only when requested, and do not interrupt routine work with a feedback survey.
<!-- END AI MODEL ROUTING GOVERNANCE -->
