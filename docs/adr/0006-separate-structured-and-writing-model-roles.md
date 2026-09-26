# Separate structured and writing model roles

The LLM adapter exposes configurable `structuredModel` and `writingModel` roles, initially using GPT-6 Luna for extraction, classification, matching, and validation, and GPT-6 Sol for faithful translation and resume writing. This adds a small amount of orchestration while avoiding premium writing-model cost on constrained tasks and allowing each role to be evaluated independently.

## Consequences

Both roles use strict Structured Outputs through stateless calls. Model identifiers and reasoning effort remain configuration, and changes require passing the representative quality, provenance, cost, and latency evaluation suite rather than changing domain code.
