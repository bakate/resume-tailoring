# Process professional data with stateless LLM calls

ADR-0013 amends the provider-specific parts of this decision while preserving stateless processing, data minimization, and disclosure before processing.

The MVP may send only the professional facts needed for tailoring and the Job Posting to OpenAI through stateless API calls with storage disabled. Contact details, photos, and detected sensitive personal information never enter the model context, and persistent OpenAI resources such as files, threads, conversations, and vector stores are excluded; this accepts the provider's standard abuse-monitoring retention during the controlled beta in exchange for reaching validation sooner.

## Consequences

The application must disclose the processor, transmitted data categories, and retention limits before processing, obtain one Processing Consent before the first model operation in a Candidate Session, and give the Candidate a chance to remove detected sensitive content. The LLM sits behind an application port so regional or retention requirements can be tightened before public launch without changing the domain workflow.
