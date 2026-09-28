import { describe, expect, it } from 'vitest'

import { renderTailoredResumeHtml } from './tailored-resume-html'

describe('renderTailoredResumeHtml', () => {
  it('renders a semantic single-column A4 document with the retained claims in order', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [{ kind: 'email', value: 'candidate@example.com' }],
      document: tailoredResumeDocument,
      locale: 'en',
      targetRole: {
        sourceExcerpt: 'Role: Senior FullStack Developer',
        value: 'Senior FullStack Developer',
      },
    })

    expect(html).toContain('<body class="resume-body-1">')
    expect(html).toContain('<main class="resume-page resume-page-1"')
    expect(html).toContain('<h1 id="resume-title">Senior FullStack Developer</h1>')
    expect(html).toContain('<address class="resume-contact">candidate@example.com</address>')
    expect(html).toContain('<section aria-labelledby="highlights-title">')
    expect(html).toContain('<li>Delivered 30% faster releases</li>')
    expect(html.indexOf('Delivered 30% faster releases'))
      .toBeLessThan(html.indexOf('Used TypeScript'))
    expect(html).not.toContain('<img')
  })

  it('marks a justified two-page preview for responsive sizing', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [],
      document: { ...tailoredResumeDocument, pageCount: 2 },
      locale: 'en',
      targetRole: null,
    })

    expect(html).toContain('<body class="resume-body-2">')
    expect(html).toContain('<main class="resume-page resume-page-2"')
  })

  it('includes an optional decorative photo only when supplied explicitly', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [],
      document: tailoredResumeDocument,
      locale: 'fr',
      photoDataUrl: 'data:image/png;base64,cGhvdG8=',
      targetRole: null,
    })

    expect(html).toContain('<html lang="fr"')
    expect(html).toContain('<h1 id="resume-title">CV adapté</h1>')
    expect(html).toContain('<img class="resume-photo" alt=""')
    expect(html).toContain('data:image/png;base64,cGhvdG8=')
  })

  it('escapes the source-backed target role before rendering HTML', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [],
      document: tailoredResumeDocument,
      locale: 'en',
      targetRole: {
        sourceExcerpt: 'Senior <script>alert(1)</script> Developer',
        value: 'Senior <script>alert(1)</script> Developer',
      },
    })

    expect(html).toContain('Senior &lt;script&gt;alert(1)&lt;/script&gt; Developer')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

const tailoredResumeDocument = {
  items: [
    {
      claimId: 'resume-claim-impact',
      factIds: ['source-fact-impact'],
      kind: 'experience',
      text: 'Delivered 30% faster releases',
    },
    {
      claimId: 'resume-claim-required',
      factIds: ['source-fact-required'],
      kind: 'skill',
      text: 'Used TypeScript',
    },
  ],
  omittedClaimCount: 0,
  pageCount: 1,
  typography: 'comfortable',
} as const
