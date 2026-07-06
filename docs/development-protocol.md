# Development Protocol

This project uses six standing expert roles to keep development grounded, expandable, and trustworthy. See `AGENTS.md` and `docs/agents/` for the complete roster.

## Phase 1: Scope

- Name the active roles.
- Identify touched files and generated artifacts.
- Decide which checks are required before finishing.

## Phase 2: Evidence

- Read the relevant source files before editing.
- For data and event work, verify sources against `data/source-policy.json`.
- For UI work, inspect the current chart structure and CSS before changing behavior.

## Phase 3: Implementation

- Keep changes narrowly scoped.
- Preserve data reproducibility.
- Avoid unsupported causal language.
- Keep chart interactions responsive and accessible.

## Phase 4: Verification

Use the role-specific checks from `docs/agents/`. Common commands:

```bash
npm run data:verify
npm run test
npm run build
```

## Phase 5: Handoff

Summaries should include:

- What changed.
- Which roles shaped the work.
- Which checks passed.
- Any remaining source, data, UI, or framing risks.

