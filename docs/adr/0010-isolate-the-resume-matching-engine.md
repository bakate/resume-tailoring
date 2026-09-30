# Isolate the resume matching engine

ADR-0015 amends how the engine validates proposed Match Evidence: structural verification replaces lexical term equality.

Requirement normalization, evidence validation, importance weighting, duplicate grouping, score calculation, bands, and critical-reserve interpretation live in a provider-neutral `resume-matching-engine` package. The engine evaluates explicit Job Requirements across capability dimensions instead of classifying Candidates into fixed job-title personas, so hybrid roles use the same explainable rules as conventional roles.

## Consequences

The package depends on neither React, model providers, persistence, nor PDF rendering. Model-backed adapters may propose requirements and evidence relationships through its interfaces, but deterministic engine rules validate those proposals and produce the Match Analysis. Role families exist only in evaluation datasets, not as hidden scoring branches.
