import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { fitResumeDocumentToPageBudget } from '../adapters/server/resume-document-renderer'
import { pageBudgetFitRequestSchema } from '../candidate-journey/resume-render-schema'
import { answerRenderRoute, encodeRender } from './-resume-render-route'

/**
 * Fits a Tailored Resume to its Page Budget in one request: Overflow Reduction measures every layout on one browser
 * page and answers with the reduced resume, the fields it hid, and the fitted PDF. The edge counts it as one render.
 */
export const Route = createFileRoute('/api/resume-document-fit')({
  server: { middleware: [createCsrfMiddleware()],
    handlers: { POST: ({ request }) => answerRenderRoute({ request, schema: pageBudgetFitRequestSchema,
      render: async (input) => {
        const { render, ...fit } = await fitResumeDocumentToPageBudget(input)
        return { result: render, body: { ...fit, render: encodeRender(render) } }
      } }) } },
})
