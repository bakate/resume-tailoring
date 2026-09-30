# Reference document review (BAK-60)

Status: **pending — not reviewed**. No human reviewer has assessed a complete generated PDF yet.
Automated checks must not be used to fill in this record.

## Purpose

BAK-55 accepts a release only when complete downloaded resumes are usable to apply without
substantial rewriting or structural reconstruction. A document that needs either fails, even
when every automated check passes. This packet defines the four reference cases, how to
produce their PDFs, and the record the reviewer completes.

## Reviewer

The product owner, or another reviewer the product owner explicitly designates. Record the
reviewer's role, not their name, in the table below.

## Producing the reference PDFs

1. Run the application with the qualified production model configuration and a valid
   `OPENAI_API_KEY` (live writer output is required; the browser test adapters are not).
2. For each case, start a new Candidate Session, grant Processing Consent, paste the source
   and posting below, and select **Generate my resume** once.
3. Enter the local name `Alex Morgan` if asked. Make no professional edits: the review
   judges the generated document. Download the PDF.
4. Keep the PDFs outside the repository and the issue tracker. The inputs are synthetic, but
   reviewers must still attach only assessments, not documents, to the Linear issue.

## Reference inputs (synthetic, anonymized)

### A. Short profile (English)

Source:

```text
Alex Morgan
alex@example.com
Junior Frontend Developer, Brightlane (2023 – 2025)
Built reusable form components in React and TypeScript.
Fixed keyboard navigation defects reported by support.
Skills: React, TypeScript, CSS, Git
Education: BSc Computer Science, 2023
Languages: English, Spanish
```

Posting:

```text
Frontend Developer. React and TypeScript are required. Accessibility experience is valued.
You will build product interfaces with a small design team.
```

### B. Dense senior career (French)

Source:

```text
Alex Morgan
alex@example.com
Directeur de l’ingénierie, Northwind (2019 – 2025)
Encadré 6 équipes produit et 48 ingénieurs.
Mis en place un processus trimestriel de planification technique.
Réduit le délai de mise en production de 12 jours à 2 jours.
Responsable d’ingénierie, Contoso (2015 – 2019)
Recruté et encadré 3 équipes plateforme.
Migré l’infrastructure de facturation vers Kubernetes.
Tech Lead, Fabrikam (2012 – 2015)
Conçu l’API de paiement utilisée par 4 applications.
Développeur senior, Litware (2009 – 2012)
Développé des services Java pour la gestion de stock.
Développeur, Adatum (2006 – 2009)
Maintenu des applications internes en Java.
Compétences : leadership, recrutement, Kubernetes, Java, TypeScript, architecture distribuée
Formation : Diplôme d’ingénieur, 2006
Langues : français, anglais
Certifications : AWS Solutions Architect Professional
```

Posting:

```text
Head of Engineering. Vous dirigez plusieurs équipes produit et plateforme.
L’expérience du management de managers est requise. Kubernetes est apprécié.
Vous pilotez la planification technique et le recrutement.
```

### C. Career change (English)

Source:

```text
Alex Morgan
alex@example.com
Secondary School Teacher, Riverside Academy (2016 – 2024)
Interviewed 30 students each term to redesign coursework.
Ran usability sessions for the school's learning platform with 12 teachers.
Published a guide on inclusive classroom materials.
UX Research Certificate, 2024
Research project: Interviewed 8 small-business owners about invoicing tools and synthesized findings.
Skills: interviewing, usability testing, affinity mapping, Figma
Languages: English, French
```

Posting:

```text
Junior UX Researcher. You will plan and run user interviews and usability tests.
Synthesis of qualitative findings is required. Figma knowledge is a plus.
```

### D. Weak correspondence (English)

Source:

```text
Alex Morgan
alex@example.com
Logistics Coordinator, Tailspin (2018 – 2025)
Scheduled deliveries for 3 regional warehouses.
Negotiated carrier rates with 5 transport providers.
Skills: route planning, supplier negotiation, Excel
Languages: English
```

Posting:

```text
Data Scientist. Python, statistical modeling and machine learning are required.
Experience deploying models to production is required.
```

Expected behavior for D: a low-coverage warning or the no-correspondence explanation with an
explicit, clearly labeled Normalized Resume. The review judges whichever document the
Candidate can download.

## Assessment criteria

For each PDF, answer in words and without quoting Candidate content:

- **Factual accuracy**: every statement is supported by the source; titles, dates,
  employers, seniority, and numbers are unchanged; nothing is invented.
- **Selection**: relevant evidence is prioritized; less relevant history is condensed but the
  chronology stays intelligible; nothing important is silently lost.
- **Writing**: the summary is written prose, specific and not exaggerated; achievements read
  as achievements rather than copied fragments; the language is correct.
- **Hierarchy**: role, employer, dates, and achievements are grouped per experience; skills
  are grouped without repeated category labels; sections are distinct.
- **Readability**: one page by default, two only when the evidence needs it; legible type;
  natural reading order; selectable text.
- **Usable without structural rewriting**: yes or no. "No" fails acceptance.

## Review record

| Case | Reviewer role | Date | Accuracy | Selection | Writing | Hierarchy | Readability | Usable without structural rewriting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Short profile | — | — | pending | pending | pending | pending | pending | pending |
| B. Dense senior career | — | — | pending | pending | pending | pending | pending | pending |
| C. Career change | — | — | pending | pending | pending | pending | pending | pending |
| D. Weak correspondence | — | — | pending | pending | pending | pending | pending | pending |

Points to check specifically during this review:

- Case B (French): copied text from the PDF may contain `ʼ` (U+02BC) in place of the
  typographic apostrophe, sometimes with a space around it. BAK-59 validation tolerates this.
  Confirm whether pasting the text into a job application form produces an acceptable result.
- Every case: the visual PDF pages appear only after the name is entered locally. Record
  whether this delays or confuses the first review of the generated document.
