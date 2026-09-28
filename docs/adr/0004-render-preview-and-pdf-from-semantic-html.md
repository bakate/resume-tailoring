# Render preview and PDF from semantic HTML

ADR-0008 amends the exact one-page constraint below while preserving the shared semantic HTML rendering decision.

The preview and downloadable PDF use one semantic, single-column HTML template, with PDF export performed by a pinned Chromium runtime through Puppeteer. This keeps browser preview and PDF layout aligned while producing selectable text and a natural reading order, at the cost of operating a Chromium-capable server runtime.

## Consequences

The renderer must enforce the one-or-two-page A4 policy defined by ADR-0008, embedded fonts, deterministic overflow reduction, and output validation. A photo is optional, disabled by default, and must not carry information required to understand the resume.
