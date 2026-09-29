# Orchestrate the Candidate Session with XState

The application package uses stable XState v5 actor logic to orchestrate the three-phase Candidate Journey, long-running operations, retries, recovery, and invalidation rules. Domain invariants and calculations remain pure modules; XState coordinates them through ports and does not become a container for scoring, provenance, or document rules.

## Consequences

The application exposes a small domain-named dispatch, snapshot, and subscription interface rather than leaking machine internals to React. One root actor owns each Candidate Session, while purely visual state remains in React. IndexedDB persists explicit versioned domain state rather than opaque actor snapshots, and transient operations restore to their last recoverable state after reload.
