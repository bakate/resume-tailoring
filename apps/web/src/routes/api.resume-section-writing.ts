import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { createModelResumeSectionWriter } from '../adapters/server/model-resume-section-models'
import { resumeSectionWritingInputSchema } from '../candidate-journey/resume-document-schemas'
import { processResumeModel } from './-resume-document-model'

export const Route = createFileRoute('/api/resume-section-writing')({ server: {
  middleware: [createCsrfMiddleware()], handlers: { POST: ({ request }) => processResumeModel({
    request, schema: resumeSectionWritingInputSchema,
    processInput: (input, environment, apiKey) => createModelResumeSectionWriter({
      apiKey, configuration: environment.languageModel.writing.active,
    }).write(input),
  }) },
} })
