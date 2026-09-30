import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createOpenAiResumeDocumentValidator } from '../candidate-journey/openai-resume-document-models'
import { resumeValidationInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-document-validation')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeValidationInputSchema,
    processInput: (input, environment) => createOpenAiResumeDocumentValidator({
      apiKey: environment.openAiApiKey, model: environment.openAiStructuredModel,
      reasoningEffort: environment.openAiStructuredReasoningEffort,
    }).validate(input),
  }) },
} })
