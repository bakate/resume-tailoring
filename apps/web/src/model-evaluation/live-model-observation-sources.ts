import { crossSegmentExtractionSource } from './cross-segment-extraction-evaluation'
import { crossSegmentWritingSource } from './cross-segment-writing-evaluation'
import { frontEndAuditSource } from './front-end-audit-evaluation'
import { jobPostingExtractionSource } from './job-posting-extraction-evaluation'
import { matchEvidenceSource } from './match-evidence-evaluation'
import type { ModelObservationSource } from './model-qualification-runner'
import { promptInjectionSource } from './prompt-injection-evaluation'
import { resumeCoherenceSource } from './resume-coherence-evaluation'
import { sectionPreparationSource } from './section-preparation-evaluation'

/** Every live evaluation of dataset `resume-tailoring-live-v1`; docs/evaluations/model-qualification.md maps them to gates. */
export const liveModelObservationSources: readonly ModelObservationSource[] = [
  jobPostingExtractionSource,
  matchEvidenceSource,
  crossSegmentExtractionSource,
  crossSegmentWritingSource,
  promptInjectionSource,
  resumeCoherenceSource,
  sectionPreparationSource,
  frontEndAuditSource,
]
