import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createOpenAiResumeSectionWriter } from '../adapters/server/openai-resume-section-models'
import { resumeSectionWritingInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-section-writing')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeSectionWritingInputSchema,
    processInput: (input, environment, apiKey) => createOpenAiResumeSectionWriter({
      apiKey, model: environment.openAiWritingModel,
      reasoningEffort: environment.openAiWritingReasoningEffort,
    }).write(input),
  }) },
} })
