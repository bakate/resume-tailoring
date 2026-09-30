import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createOpenAiResumeDocumentWriter } from '../candidate-journey/openai-resume-document-models'
import { resumeWritingInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-document-writing')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeWritingInputSchema,
    processInput: (input, environment) => createOpenAiResumeDocumentWriter({
      apiKey: environment.openAiApiKey, model: environment.openAiWritingModel,
      reasoningEffort: environment.openAiWritingReasoningEffort,
    }).write(input),
  }) },
} })
