# Qualification Translation — 2026-10-13

Issue: BAK-178, found while qualifying DeepSeek (BAK-167).

## Question

An English Tailored Resume prepared on DeepSeek kept the Source Document's French qualification, "Licence professionnelle
Développement Web, Université de Lille", which production asks for. OpenAI's `gpt-6-sol` passed the old language check
on the same field, so it likely wrote the field in English. Did it invent an equivalent level?

## Method

A throwaway probe ran the production path on the front-end audit corpus (`front-end-audit-corpus.ts`): Source Intake
and Job Match once, then English section-by-section preparation several times, keeping each education writing attempt
and the prepared education field. Source Intake attests the qualification alone at `education.0.qualification.0`
("Licence professionnelle Développement Web"), the institution and the year at their own paths. DeepSeek ran on
`deepseek-flash` with its frozen Qualified Model Configuration, bypassing the server's qualification gate, since BAK-167
has not qualified it yet.

## Results

| Writing role | Instructions | Prepared | Official name kept | Writing attempts renaming it |
| --- | --- | --- | --- | --- |
| OpenAI `gpt-6-sol` / medium | before | 3 of 4 | 2 of 3 | 2 of 5 |
| DeepSeek `deepseek-flash` | before | 4 of 4 | 4 of 4 | 0 of 4 |
| OpenAI `gpt-6-sol` / medium | after, first wording | 5 of 5 | 5 of 5 | 0 of 5 |
| OpenAI `gpt-6-sol` / medium | after, final wording | 3 of 4 | 3 of 3 | 0 of 3 |
| DeepSeek `deepseek-flash` | after, final wording | 3 of 3 | 3 of 3 | 0 of 3 |

- Before: OpenAI wrote "Professional Bachelor's Degree in Web Development, Université de Lille, 2018" in 2 of 5
  attempts. The field validator accepted it both times; one reached the prepared document. The other attempt's run was
  rewritten before it failed for a reason the probe did not record. The renamed degree is an equivalent level the
  Candidate never stated, against "Preserve complete qualifications … without invented levels".
- After, first wording: the instruction's example was the corpus's own qualification, and both glosses copied it word
  for word. The final wording uses an unrelated example.
- After, final wording: OpenAI kept the name alone; DeepSeek added a translation of its words in 2 of 3 runs,
  "(professional licence in web development)" and "(professional degree in web development)", with no level. OpenAI's
  failed run hit `429 project_spend_limit_exceeded` while writing a section, not a model defect.

## Decision

The official name of a qualification stays in every locale. A translation of the words of that name may follow it in
parentheses, adding no degree, level or duration. An equivalent degree or level written in its place is an unsupported
qualification.

- Section writing and field validation now say so for education and certifications
  (`model-resume-section-models.ts`). Coherence already accepted the name alone or next to its translation (BAK-174).
- The evaluations count an education or certification entry that drops the official name of the qualification fact it
  cites as an unsupported Resume Claim (`unsupported-resume-claims.ts`): a provenance safety violation, at zero
  tolerance, on every source that reads facts at Source Profile paths.
- The rule proves the name survived; what a translation following it says is judged by the field validator only.
