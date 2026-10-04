# Recorded Tailored Resume preparations

Each file is one live Tailored Resume preparation, recorded through the UI against the real models on 2026-10-04 and
replayed offline by `../recorded-preparation-replay.test.ts`. Replaying costs no model call.

- `intake`: the professional text, already without contact details, and the Job Posting text.
- `responses`: every model route response in the order received; writing and validation responses carry the Resume
  Section key they answered. The replay serves them by route and section key, in order.
- `scenario`: what the models did in that run.

All names of people, employers, projects, institutions, places and providers are fictitious, consistently replaced
across the intake and the responses, and every year is shifted. Do not add a recording that holds real Candidate data.

A replay fails when the preparation asks for a response the recording does not hold: a recording only proves the
rules for the calls it captured.
