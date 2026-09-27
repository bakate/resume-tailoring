export function hasTailoredResumeOverflow(resumePage: Element) {
  const frameWindow = resumePage.ownerDocument.defaultView
  if (frameWindow === null || !(resumePage instanceof frameWindow.HTMLElement)) return true

  const pageBounds = resumePage.getBoundingClientRect()
  if (resumePage.scrollHeight > resumePage.clientHeight + 1) return true
  if (resumePage.scrollWidth > resumePage.clientWidth + 1) return true
  return [...resumePage.querySelectorAll<HTMLElement>('*')].some((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.bottom > pageBounds.bottom + 1 || bounds.right > pageBounds.right + 1
  })
}
