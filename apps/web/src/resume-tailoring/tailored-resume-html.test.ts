import { describe, expect, it } from 'vitest'

import { renderTailoredResumeHtml } from './tailored-resume-html'

describe('renderTailoredResumeHtml', () => {
  it('renders a semantic single-column A4 document with the retained claims in order', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [{ kind: 'email', value: 'candidate@example.com' }],
      document: tailoredResumeDocument,
      locale: 'en',
    })

    expect(html).toContain('<main class="resume-page"')
    expect(html).toContain('<address class="resume-contact">candidate@example.com</address>')
    expect(html).toContain('<section aria-labelledby="highlights-title">')
    expect(html).toContain('<li>Delivered 30% faster releases</li>')
    expect(html.indexOf('Delivered 30% faster releases'))
      .toBeLessThan(html.indexOf('Used TypeScript'))
    expect(html).not.toContain('<img')
  })

  it('includes an optional decorative photo only when supplied explicitly', () => {
    const html = renderTailoredResumeHtml({
      contactItems: [],
      document: tailoredResumeDocument,
      locale: 'fr',
      photoDataUrl: 'data:image/png;base64,cGhvdG8=',
    })

    expect(html).toContain('<html lang="fr"')
    expect(html).toContain('<img class="resume-photo" alt=""')
    expect(html).toContain('data:image/png;base64,cGhvdG8=')
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
  typography: 'comfortable',
} as const
