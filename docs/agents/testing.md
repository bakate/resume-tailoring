# Testing

Develop observable behavior one tracer bullet at a time through an agreed public seam.

## Primary seams

- Exercise Resume Tailoring behavior through `ResumeTailoringWorkflow`.
- Exercise transport and interaction behavior through the rendered web application.
- Use adapter contract tests only when a production boundary has behavior worth varying.

Tests must not import domain internals or inspect orchestration details.

## Behavior-test structure

Each behavior-test file must:

1. Declare imports, suite prose, and test cases before its harness.
2. Define a local `createSystemUnderTest()` factory below the test cases.
3. Separate Given, Action, and Then phases visually.
4. Invoke exactly one caller-visible, domain-named action in the Action phase.
5. Keep raw assertions inside domain-named `expect...` harness methods.
6. Guard outcome readers so omitting the Action fails with an explicit message.

Generic harness action names such as `act`, `execute`, `perform`, `run`, and `submit` are prohibited.

## Commands

- `pnpm test` runs package-level behavior tests.
- `pnpm test:e2e` runs the browser smoke test.
- `pnpm check:test-conventions` rejects detectable behavior-test convention violations.
- `pnpm check` runs architecture, conventions, lint, type checking, tests, and the production build.
