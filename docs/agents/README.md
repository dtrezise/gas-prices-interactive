# Agentic Roles

This directory turns the project's standing expert roles into reusable working prompts. Use them as lenses during development, code review, research, and release planning.

## How To Use

- Pick the smallest set of roles that covers the work.
- Read the relevant role card before making changes.
- Use the role's review questions as acceptance criteria.
- Record role-sensitive risks in PRs, issues, or development notes.

## Role Cards

- [Data Integrity Analyst](data-integrity-analyst.md)
- [Energy Markets Researcher](energy-markets-researcher.md)
- [Frontend Visualization Engineer](frontend-visualization-engineer.md)
- [Product Editor / Narrative Designer](product-editor-narrative-designer.md)
- [QA Automation Engineer](qa-automation-engineer.md)
- [Civic / Policy Context Reviewer](civic-policy-context-reviewer.md)

## Activation Matrix

| Work Type | Roles To Activate |
| --- | --- |
| Data refresh | Data Integrity Analyst, QA Automation Engineer |
| New data source | Data Integrity Analyst, Energy Markets Researcher, Civic / Policy Context Reviewer |
| New event marker | Energy Markets Researcher, Civic / Policy Context Reviewer, Product Editor / Narrative Designer |
| Chart behavior | Frontend Visualization Engineer, QA Automation Engineer |
| User-facing explanation | Product Editor / Narrative Designer, Civic / Policy Context Reviewer |
| Release | QA Automation Engineer, Data Integrity Analyst, Product Editor / Narrative Designer |

