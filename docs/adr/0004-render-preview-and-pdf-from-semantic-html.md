# Render preview and PDF from semantic HTML

The preview and downloadable PDF use one semantic, single-column HTML template, with PDF export performed by a pinned Chromium runtime through Puppeteer. This keeps browser preview and PDF layout aligned while producing selectable text and a natural reading order, at the cost of operating a Chromium-capable server runtime.

## Consequences

The renderer must enforce exactly one A4 page, embedded fonts, deterministic overflow reduction, and output validation. A photo is optional, disabled by default, and must not carry information required to understand the resume.
