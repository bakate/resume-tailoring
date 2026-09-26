# Build a TanStack Start modular monolith

The MVP uses a pinned TanStack Start release in a pnpm and Turborepo workspace, organized as a modular monolith with one deployable web application. Domain, application, template, and transport contracts live in focused packages so framework and provider adapters remain replaceable; this accepts release-candidate migration risk in exchange for the selected TanStack stack.

## Consequences

The initial Node container runs both the web application and pinned Chromium PDF rendering synchronously. A separate PDF worker is introduced only after measured concurrency, memory, timeout, or scaling pressure justifies another deployable and queueing model.
