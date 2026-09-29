# Require provenance for resume claims

ADR-0009 extends this decision from flat Resume Claims to every generated or reformulated professional Resume Field.

Every Resume Claim must retain an internal link to one or more Candidate Facts, and unsupported claims must be rejected before preview or PDF generation. This adds generation and validation complexity, but makes the product's non-fabrication promise enforceable instead of relying on model instructions alone. ADR-0007 defines how imported Candidate Facts are collectively attested.

## Consequences

Generation must produce structured claims with provenance before rendering human-readable output. Provenance remains internal and never appears in the Tailored Resume.
