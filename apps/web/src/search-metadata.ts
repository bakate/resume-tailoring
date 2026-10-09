/**
 * What search engines and link previews read about the site. The server renders before it knows the Candidate's
 * language, so this copy is written once, in French, for the audience the product addresses first.
 */
export const siteOrigin = 'https://resume-studio.bakateba.workers.dev'

/** Declared by the home page only: the result page is kept out of search and must not point here. */
export const homeCanonicalLink = { rel: 'canonical', href: `${siteOrigin}/` } as const

const siteName = 'Resume Studio'
const title = 'Resume Studio · Ton CV, taillé pour l’offre'
const description = 'Dépose ton CV et l’offre d’emploi : on met en avant tes expériences les plus pertinentes, '
  + 'sans rien inventer. Sans compte, rien n’est stocké sur nos serveurs.'
const shareImage = { path: '/og-image.png', width: 1200, height: 630, alt: 'Resume Studio : ton CV, taillé pour l’offre.' }

export const searchMetadata = {
  title,
  meta: [
    { name: 'description', content: description },
    { name: 'theme-color', content: '#164f3d' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: siteName },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: `${siteOrigin}/` },
    { property: 'og:locale', content: 'fr_FR' },
    { property: 'og:locale:alternate', content: 'en_US' },
    { property: 'og:image', content: `${siteOrigin}${shareImage.path}` },
    { property: 'og:image:width', content: String(shareImage.width) },
    { property: 'og:image:height', content: String(shareImage.height) },
    { property: 'og:image:alt', content: shareImage.alt },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  links: [
    // The SVG serves current browsers; the ICO serves those that ask for /favicon.ico or ignore SVG icons.
    { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  ],
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    url: `${siteOrigin}/`,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    inLanguage: ['fr', 'en'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
} as const
