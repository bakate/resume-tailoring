import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { renderResumeDocument } from '../adapters/server/resume-document-renderer'
import { resumeRenderRequestSchema } from '../candidate-journey/resume-render-schema'
import { answerRenderRoute, encodeRender } from './-resume-render-route'

export const Route = createFileRoute('/api/resume-document')({
  server: { middleware: [createCsrfMiddleware()],
    handlers: { POST: ({ request }) => answerRenderRoute({ request, schema: resumeRenderRequestSchema,
      render: async (input) => {
        const result = await renderResumeDocument(input)
        return { result, body: encodeRender(result) }
      } }) } },
})
