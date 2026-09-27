import type {
  TailoredResumeDocument,
} from '@resume-tailoring/application/tailored-resume-document'
import type { SensitiveContentKind } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

export type ResumeDocumentLocale = 'en' | 'fr'

export type ResumeContactItem = Readonly<{
  kind: Extract<SensitiveContentKind, 'address' | 'email' | 'phone' | 'url'>
  value: string
}>

type RenderInputs = Readonly<{
  contactItems: readonly ResumeContactItem[]
  document: TailoredResumeDocument
  locale: ResumeDocumentLocale
  photoDataUrl?: string
}>

const labels = {
  en: {
    title: 'Tailored Resume',
    highlights: 'Selected highlights',
  },
  fr: {
    title: 'CV adapté',
    highlights: 'Points clés sélectionnés',
  },
} as const

export function renderTailoredResumeHtml(inputs: RenderInputs) {
  const localizedLabels = labels[inputs.locale]
  return `<!doctype html>
<html lang="${inputs.locale}" data-typography="${inputs.document.typography}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  <title>${localizedLabels.title}</title>
  <style>${resumeDocumentStyles}</style>
</head>
<body>
  <main class="resume-page" aria-labelledby="resume-title">
    <header class="resume-header">
      <div>
        <h1 id="resume-title">${localizedLabels.title}</h1>
        ${renderContactItems({ contactItems: inputs.contactItems })}
      </div>
      ${renderPhoto({ photoDataUrl: inputs.photoDataUrl })}
    </header>
    ${renderSections({ items: inputs.document.items, locale: inputs.locale })}
  </main>
</body>
</html>`
}

function renderContactItems({ contactItems }: Readonly<{
  contactItems: readonly ResumeContactItem[]
}>) {
  if (contactItems.length === 0) return ''
  const content = contactItems.map(({ value }) => escapeHtml(value)).join(' · ')
  return `<address class="resume-contact">${content}</address>`
}

function renderPhoto({ photoDataUrl }: Readonly<{ photoDataUrl?: string }>) {
  if (photoDataUrl === undefined) return ''
  return `<img class="resume-photo" alt="" src="${escapeHtml(photoDataUrl)}">`
}

function renderSections({ items, locale }: Readonly<{
  items: TailoredResumeDocument['items']
  locale: ResumeDocumentLocale
}>) {
  const listItems = items.map(({ text }) => `<li>${escapeHtml(text)}</li>`).join('')
  return `<section aria-labelledby="highlights-title">
      <h2 id="highlights-title">${labels[locale].highlights}</h2>
      <ul>${listItems}</ul>
    </section>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const resumeDocumentStyles = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #eef0ed; }
body { color: #151820; font-family: Arial, sans-serif; }
.resume-page {
  width: 210mm;
  height: 297mm;
  padding: 17mm 18mm;
  overflow: hidden;
  background: #fff;
}
.resume-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12mm;
  padding-bottom: 7mm;
  border-bottom: 0.5mm solid #164f3d;
}
h1, h2 { margin: 0; font-family: Georgia, serif; font-weight: 400; }
h1 { color: #164f3d; font-size: 26pt; letter-spacing: -0.02em; }
.resume-contact { margin-top: 3mm; color: #555b68; font-size: 9pt; font-style: normal; }
.resume-photo { width: 24mm; height: 24mm; flex: 0 0 24mm; border-radius: 50%; object-fit: cover; }
section { margin-top: 6mm; break-inside: avoid; }
h2 { margin-bottom: 2.5mm; color: #164f3d; font-size: 14pt; }
ul { margin: 0; padding-left: 5mm; }
li { margin-top: 2.2mm; font-size: 10.5pt; line-height: 1.38; }
li:first-child { margin-top: 0; }
html[data-typography='compact'] .resume-page { padding: 15mm 17mm; }
html[data-typography='compact'] section { margin-top: 5mm; }
html[data-typography='compact'] li { margin-top: 1.7mm; font-size: 10pt; line-height: 1.3; }
html[data-typography='dense'] .resume-page { padding: 13mm 16mm; }
html[data-typography='dense'] .resume-header { padding-bottom: 5mm; }
html[data-typography='dense'] section { margin-top: 4mm; }
html[data-typography='dense'] h2 { margin-bottom: 2mm; font-size: 13pt; }
html[data-typography='dense'] li { margin-top: 1.3mm; font-size: 9.5pt; line-height: 1.25; }
@media screen {
  body { padding: 10mm; }
  .resume-page { margin: 0 auto; box-shadow: 0 12px 40px rgba(21, 24, 32, 0.12); }
}
@media screen and (max-width: 793.7px) {
  body { width: 100vw; height: calc(100vw * 1.4143); padding: 0; overflow: hidden; }
  .resume-page { margin: 0; zoom: calc(100vw / 793.7px); }
}
@media print {
  html, body { width: 210mm; height: 297mm; background: #fff; }
}`
