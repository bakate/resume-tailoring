# Build the interactive UI with Mantine

The interactive web application uses Mantine for accessible controls, form behavior, feedback, and theme utilities because the form-heavy Candidate Journey benefits from maintained components without introducing a Tailwind migration or vendoring every primitive. The visual identity remains custom and must not inherit a generic dashboard appearance.

## Consequences

The Mantine theme is the source of visual tokens, with named semantic application tokens added when the base theme is insufficient. Interactive screens avoid raw visual literals and scattered style overrides; CSS Modules are limited to layouts and behavior not expressible through the design system. The semantic HTML resume and PDF renderer remain independent of Mantine and retain physical A4 measurements.
