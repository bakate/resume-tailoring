/* global Headers, Request, Response, URL, fetch */

const originHeaderName = 'x-resume-studio-origin'

export default {
  async fetch(request, environment) {
    if (!isConfiguredEnvironment(environment)) {
      return new Response('Service unavailable', { status: 503 })
    }

    const incomingUrl = new URL(request.url)
    const originUrl = new URL(environment.ORIGIN_URL)
    originUrl.pathname = incomingUrl.pathname
    originUrl.search = incomingUrl.search

    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete(originHeaderName)
    headers.set(originHeaderName, environment.ORIGIN_SECRET)

    const originRequest = new Request(originUrl, {
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      headers,
      method: request.method,
      redirect: 'manual',
    })
    return fetch(originRequest)
  },
}

function isConfiguredEnvironment(environment) {
  return typeof environment.ORIGIN_URL === 'string'
    && environment.ORIGIN_URL.startsWith('https://')
    && typeof environment.ORIGIN_SECRET === 'string'
    && environment.ORIGIN_SECRET.length >= 32
}
