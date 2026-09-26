# Issue tracker: Linear

Specs and implementation issues for this repository live in Linear.

## Workflow

1. Write and approve a spec before creating implementation issues.
2. Split the spec into independently actionable Linear issues.
3. Link every implementation issue back to its source spec.
4. Keep each issue focused on one deliverable with explicit acceptance criteria.
5. Move issues through the workflow in order:
   `ready-for-agent` → `in-progress` → `in-review` → `done` → `released`.

This is a solo-maintained project. Do not introduce assignment or coordination ceremonies unless another contributor joins the project.

## Status semantics

- `ready-for-agent`: fully specified and safe for an agent to implement.
- `in-progress`: implementation has started.
- `in-review`: implementation is complete and awaiting review or verification.
- `done`: implementation has been accepted or merged.
- `released`: the completed work is available in the released product.

## Operations

Use the configured Linear integration to create, read, update, comment on, and search issues.

When creating issues from a spec:

- Preserve the spec's terminology.
- Include acceptance criteria.
- Include dependencies and blockers.
- Link the source spec.
- Set the initial status to `ready-for-agent`.

## When a skill says "publish to the issue tracker"

Create a Linear issue linked to the relevant spec and set its status to `ready-for-agent`.

## When a skill says "fetch the relevant ticket"

Read the referenced Linear issue, including its description, status, comments, dependencies, and linked spec.
