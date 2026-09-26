# Keep candidate content out of persistent server storage

Source Documents, Source Profiles, Job Postings, photos, previews, and Tailored Resumes remain in the Candidate's browser and expire locally after 24 hours. The server may process this content transiently but must not persist it; this sacrifices cross-device recovery and history to minimize the privacy and security surface of the anonymous MVP.

## Consequences

The backend remains stateless for candidate content. Analytics may record operational events and Match Score bands, but never names, contact details, document text, photos, or resume content.
