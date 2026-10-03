import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createOpenAiResumeFieldValidator } from '../adapters/server/openai-resume-section-models'
import { resumeFieldValidationInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-section-validation')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeFieldValidationInputSchema,
    processInput: (input, environment) => createOpenAiResumeFieldValidator({
      apiKey: environment.openAiApiKey, model: environment.openAiStructuredModel,
      reasoningEffort: environment.openAiStructuredReasoningEffort,
    }).validate(input),
  }) },
} })
