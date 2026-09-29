# Use a policy-bearing Language Model Gateway

All model-backed operations depend on a provider-neutral Language Model Gateway whose active adapter supplies both model capabilities and a versioned Processing Policy. Provider identity is infrastructure metadata disclosed at the point of processing, not domain language or routine product copy, so changing providers does not rewrite the Candidate Journey.

## Consequences

The Processing Policy identifies the active provider, purposes, transmitted data categories, retention policy, and storage behavior. Candidate consent is bound to that policy and must be renewed before content is sent after a provider or policy change. Silent failover to an undisclosed provider is prohibited. OpenAI-specific adapters and diagnostics may remain in infrastructure, while public operational errors remain provider-neutral.
