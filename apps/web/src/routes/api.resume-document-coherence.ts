import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createOpenAiResumeCoherenceChecker } from '../adapters/server/openai-resume-section-models'
import { resumeCoherenceInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-document-coherence')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeCoherenceInputSchema,
    processInput: (input, environment, apiKey) => createOpenAiResumeCoherenceChecker({
      apiKey, configuration: environment.languageModel.structured.active,
    }).check(input),
  }) },
} })
