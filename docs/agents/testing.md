# Testing

Develop observable behavior one tracer bullet at a time through an agreed public seam.

## Primary seams

- Exercise Resume Tailoring behavior through `CandidateJourney` (`createCandidateJourney` from `@resume-tailoring/application/candidate-journey`).
- Exercise transport and interaction behavior through the rendered web application.
- Use adapter contract tests only when a production boundary has behavior worth varying.

Tests must not import domain internals or inspect orchestration details.

## Hexagon layout

- Ports: `packages/resume-tailoring-application/src/ports.ts`, imported as `@resume-tailoring/application/ports`.
- Browser adapters (persistence, document readers, fetch clients, telemetry, and the ports translated over the Language Model Gateway): `apps/web/src/adapters/browser/`.
- Server adapters (OpenAI, Puppeteer renderer): `apps/web/src/adapters/server/`.
- Composition root: `apps/web/src/composition-root.ts` wires the browser adapters into `createCandidateJourney`.

Adapter contract tests sit next to their adapter. `pnpm check:architecture` rejects any `apps/web` module other than the composition root, API routes and their `-` helpers, adapters, and tests that imports `src/adapters/**`.

## Fakes

Every Candidate Journey port has one in-memory fake in `@resume-tailoring/application/testing`. Each answers from the anonymized structured-resume fixtures, so a behavior test overrides only the behavior it varies:

- `createFakeCandidateJourneyDependencies(overrides)` wires the fake for every required port. Tests pass the optional section models, document ports, renderer, and telemetry when the scenario uses them.
- `createFakeX(overrides)` replaces individual port methods, such as `createFakeSourceProfileExtractor({ extract })`.
- `createInMemoryCandidateSessionPersistence({ session })` and `createRecordingTelemetry()` expose what they stored or recorded.

Do not write a new inline fake for a port. Extend its shared fake instead.

## Adapter testing policy

An adapter test earns its place only when it covers one of:

- translation or mapping logic the adapter owns, such as a request body, a response schema, or an error classification;
- behavior against a real or emulated dependency, such as an in-memory `Storage`, a real PDF, or a recorded HTTP response.

Never assert that a mocked wrapped library was called with the arguments the test just passed in. Never assert that an adapter echoes a canned response unchanged.

When the real adapter can run in a test, run the port's shared contract suite against both the fake and the adapter, so the fake cannot drift. For example, `describeCandidateSessionPersistenceContract` runs against the in-memory fake and the browser `Storage` adapter.

## Behavior-test structure

Each behavior-test file must:

1. Declare imports, suite prose, and test cases before its harness.
2. Define a local `createSystemUnderTest()` factory below the test cases.
3. Separate Given, Action, and Then phases visually.
4. Invoke exactly one caller-visible, domain-named action in the Action phase.
5. Keep raw assertions inside domain-named `expect...` harness methods.
6. Guard outcome readers so omitting the Action fails with an explicit message.

Generic harness action names such as `act`, `execute`, `perform`, `run`, and `submit` are prohibited.

## Contract-test structure

Each case in `apps/web/**/*.contract.test.ts` separates Given, Action, and Then with blank lines. Assertions appear only in the Then phase. A case whose Given is its `it.each` row may open on a single-statement Action. Contract tests do not need a `createSystemUnderTest()` harness.

## Commands

- `pnpm test` runs package-level behavior and contract tests.
- `pnpm test:e2e` runs the browser smoke test.
- `pnpm check:test-conventions` rejects detectable behavior-test and contract-test convention violations.
- `pnpm check` runs architecture, conventions, lint, type checking, tests, and the production build.
