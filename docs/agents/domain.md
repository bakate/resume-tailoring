# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- Relevant ADRs in Linear (see below).

If `CONTEXT.md` does not exist, proceed silently. Domain-modeling skills create it lazily when terminology is resolved.

## File structure

This repository uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/
│   ├── agents/
│   └── evaluations/
└── src/
```

## ADRs live in Linear

ADRs are Linear issues in project *Resume generator*, labelled `ADR` and titled `ADR: <title>`. An accepted ADR is `Done`; a fully superseded ADR is `Canceled`. Migrated ADRs end with `Legacy id: ADR-00NN`.

Read and create them with `orca linear`:

```bash
orca linear list-issues --project "Resume generator" --label ADR --json
orca linear issue BAK-123 --full --json
orca linear save-issue --team BAK --project "Resume generator" --label ADR --state Done \
  --title "ADR: <title>" --body-file - --json
```

An ADR evolves by editing its issue. Create a new ADR issue only for a new subject, and relate it to the spec or issue that motivated it. Refer to an ADR by its Linear identifier, never by a legacy number.

Never recreate `docs/adr/`, and never write ADRs or specs as repository files. Specs are Linear issues titled `Spec: <title>` (see `issue-tracker.md`).

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactoring proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`.

If a required concept is absent, reconsider whether the term belongs to the project or record the gap for domain modeling.

## Flag ADR conflicts

Surface any conflict with an existing ADR explicitly instead of silently overriding the decision.
