import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const englishCatalog = {
  'candidateJourney.operation.renderingResumeDocument': 'Preparing the PDF preview',
  'combinedIntake.outdated': 'This is your last stable resume. Generate again to apply the changed source, posting or language; export is paused.',
  "combinedIntake.title": "Your resume and the job posting",
  "combinedIntake.description": "Drop a file or paste the text. One click is enough.",
  "combinedIntake.sourceTitle": "Your resume",
  "combinedIntake.sourceHint": "PDF or DOCX, up to 5 pages and 5 MB",
  "combinedIntake.sourcePlaceholder": "Paste the text of your resume or LinkedIn profile…",
  "combinedIntake.postingTitle": "The job posting",
  "combinedIntake.postingHint": "PDF or TXT",
  "combinedIntake.postingPlaceholder": "Paste the complete job posting…",
  "combinedIntake.dropFile": "Drop your file here or click to choose it",
  "combinedIntake.orPaste": "or paste the text",
  "combinedIntake.removeFile": "Remove",
  "combinedIntake.rejectedFile": "This file cannot be used here. Check its format and size.",
  "combinedIntake.sourceReady": "Your resume is already analyzed and ready to reuse.",
  "combinedIntake.replaceSourceAction": "Replace my resume",
  "combinedIntake.keepSourceAction": "Keep my current resume",
  "combinedIntake.generate": "Generate my resume",
  "combinedIntake.regenerate": "Regenerate my resume",
  "combinedIntake.replaceSource": "Reuse your Source Profile, or replace the source",
  "combinedIntake.replaceTitle": "Regenerate this resume?",
  "combinedIntake.replaceWarning": "Generation replaces the current resume, including manual edits. Your source evidence stays available.",
  "combinedIntake.confirmRegenerate": "Replace and regenerate",
  "combinedIntake.normalized": "Prepare a non-tailored resume",
  "combinedIntake.interruptedTitle": "Generation was interrupted.",
  "combinedIntake.failedTitle": "Preparation could not finish.",
  "combinedIntake.inputsKept": "Your inputs are kept.",
  "combinedIntake.inputsAndResumeKept": "Your inputs and your last resume are kept.",
  "combinedIntake.cause.source": "We could not analyze your resume.",
  "combinedIntake.cause.posting": "We could not analyze the job posting.",
  "combinedIntake.cause.evidence": "We could not link your resume to the job requirements.",
  "combinedIntake.cause.unavailable": "The service did not respond. Try again in a moment.",
  "combinedIntake.retry": "Try again",
  'failure.access-required.title': 'Your demo access has expired',
  'failure.access-required.explanation': 'The security check that protects this demo must be passed again. Your inputs are kept.',
  'failure.access-required.action': 'Pass the security check',
  'failure.rate-limited.title': 'Too many requests',
  'failure.rate-limited.explanation': 'Too many requests were sent in a short time. Wait a moment before trying again.',
  'failure.rate-limited.action': 'Try again in {seconds} s',
  'failure.timeout.title': 'The service took too long',
  'failure.timeout.explanation': 'The operation took longer than expected. Trying again usually works.',
  'failure.timeout.action': 'Try again',
  'failure.input-too-large.title': 'Your text is too long',
  'failure.input-too-large.explanation': 'The text is longer than the service accepts. Shorten your resume or the job posting, then try again.',
  'failure.input-too-large.action': 'Shorten my text',
  'failure.service-unavailable.title': 'The service is unavailable',
  'failure.service-unavailable.explanation': 'The writing service did not answer correctly. Try again in a moment.',
  'failure.service-unavailable.action': 'Try again',
  'failure.network.title': 'Connection lost',
  'failure.network.explanation': 'Your browser could not reach the service. Check your connection, then try again.',
  'failure.network.action': 'Try again',
  'failure.unexpected.title': 'Something unexpected happened',
  'failure.unexpected.explanation': 'The service answered in an unexpected way. Reload the page; your work stays in this browser.',
  'failure.unexpected.action': 'Reload the page',
  'failure.retry': 'Try again',
  'failure.preview.layoutUnavailable': 'The PDF could not be rendered or validated. Your draft is preserved.',
  'failure.preview.pagesUnavailable': 'The PDF could not be displayed. Your draft is preserved.',
  'failure.preview.retry': 'Retry preview',
  'failure.preview.download': 'Download could not start. Your draft is preserved. Try again.',
  'failure.review.title': 'The operation could not complete. Your current content is preserved.',
  'failure.review.renew-consent': 'Renew processing consent before trying again.',
  'failure.review.correct-content': 'Correct the unsupported content or explicitly attest it.',
  'failure.review.retry-current-draft': 'The document changed. Try again with the current version.',
  'failure.review.pageCountUnavailable': 'Page count is unavailable. Your content is preserved; try the check again.',
  "combinedIntake.omittedAmbiguities": "Ambiguous evidence was left out. You can inspect and correct it below without losing the usable resume.",
  "combinedIntake.unsafe": "The generated wording could not be supported by your evidence. It has not replaced your resume.",
  "combinedIntake.incoherent": "Some sections repeated or contradicted one another, even after one rewrite. Try again to rewrite only those sections.",
  "combinedIntake.analysis": "Match Analysis and supporting evidence",
  "combinedIntake.inspection": "Inspect or enrich your source evidence",
  "resultBanner.ready": "Your latest resume is ready",
  "resultBanner.preparing": "Your resume is being prepared",
  "resultBanner.view": "View",
  "resumeResult.backToDocuments": "Back to my documents",
  "combinedIntake.matching": "Matching your evidence to the opportunity…",
  "combinedIntake.writing": "Writing your resume section by section…",
  'resumeSections.title': 'Your resume is taking shape',
  'resumeSections.description': 'Each section appears once it is checked against your evidence. Download opens when the whole resume is checked.',
  'resumeSections.keptTitle': 'Checked sections kept',
  'resumeSections.keptDescription': 'These sections are checked against your evidence and kept. Trying again rewrites only the others.',
  'resumeSections.writing': 'Writing {section}…',
  'resumeSections.failed': '{section} could not be prepared.',
  "combinedIntake.extractingPosting": "Extracting the job requirements…",
  "combinedIntake.normalizedReady": "Non-tailored resume ready",
  "combinedIntake.policyDetails": "Processing details",
  "processingPolicy.consentByGeneration": "By generating, you agree that {provider} processes your professional content to write this resume. Nothing is stored on our servers.",
  "processingPolicy.grantedSummary": "Processed by {provider}, with nothing stored on our servers.",

  'brand.name': 'Resume Studio',
  'demoAccess.title': 'Preparing the demo',
  'demoAccess.description': 'A quick security check protects this public demo from automated abuse. No account is required.',
  'demoAccess.verifying': 'Checking access…',
  'demoAccess.retry': 'Try the security check again',
  'demoAccess.expiredTitle': 'Your demo session has expired',
  'demoAccess.expiredDescription': 'Confirm the security check to continue. Your inputs are kept and the interrupted step resumes on its own.',
  'demoAccess.abandon': 'Not now',
  'locale.unavailable': 'The interface language is unavailable.',
  'locale.switcherLabel': 'Language',
  'candidateJourney.eyebrow': '2 documents · 1 click · your resume as a PDF',
  'candidateJourney.title': 'Your resume, tailored to the job.',
  'candidateJourney.description': 'Drop your resume and the job posting. We highlight your most relevant experience without inventing anything. Your data stays in this browser for 24 hours.',
  'candidateJourney.privateByDesign': 'Private by design',
  'candidateJourney.skipToContent': 'Skip to Candidate Journey content',
  'candidateJourney.phasesLabel': 'Candidate Journey phases',
  'candidateJourney.sourceIntake': 'Source Intake',
  'candidateJourney.sourceIntakeDescription': 'Add the professional facts that can support your application.',
  'candidateJourney.jobMatch': 'Job Match',
  'candidateJourney.jobMatchDescription': 'Compare your evidence with one Job Posting.',
  'candidateJourney.tailoredResumePreparation': 'Tailored Resume Preparation',
  'candidateJourney.tailoredResumePreparationDescription': 'Prepare and export an evidence-backed resume.',
  'tailoredResume.valueProposition': 'Value Proposition',
  'tailoredResume.experiences': 'Experience',
  'tailoredResume.language': 'Resume language',
  'tailoredResume.languageAutomatic': 'Job Posting language',
  'tailoredResume.contactDetails': 'Local contact details',
  'tailoredResume.name': 'Name',
  'tailoredResume.email': 'Email',
  'tailoredResume.phone': 'Phone',
  'tailoredResume.fieldLabel': 'Resume Field',
  'tailoredResume.saveField': 'Save wording',
  'tailoredResume.attestField': 'Attest as a new Candidate Fact',
  'tailoredResume.unsupportedField': 'This professional edit is not supported by the current Candidate Facts.',
  'tailoredResume.hideField': 'Hide field',
  'tailoredResume.restoreField': 'Restore field',
  'tailoredResume.moveUp': 'Move up',
  'tailoredResume.moveDown': 'Move down',
  'candidateJourney.startSession': 'Start a Candidate Session',
  'candidateJourney.sessionActive': 'Candidate Session active',
  'candidateJourney.deleteSession': 'Delete Candidate Session',
  'candidateJourney.deleteDialogTitle': 'Delete Candidate Session?',
  'candidateJourney.deleteDialogDescription': 'This immediately removes the Candidate Session stored in this browser.',
  'candidateJourney.deleteCancel': 'Cancel',
  'candidateJourney.deleteConfirm': 'Delete session now',
  'candidateJourney.sessionDeleted': 'Candidate Session deleted from this browser.',
  'candidateJourney.expiredSessionDiscarded': 'Your expired Candidate Session was deleted from this browser.',
  'candidateJourney.incompatibleSessionDiscarded': 'An incompatible Candidate Session was deleted from this browser.',
  'candidateJourney.storageUnavailable': 'Candidate Session storage is unavailable.',
  'candidateJourney.phaseAnnouncement': 'Current phase: {phase}.',
  'candidateJourney.operationAnnouncement': '{operation} Your last stable result remains visible while this finishes.',
  'candidateJourney.firstOperationAnnouncement': '{operation}',
  'candidateJourney.validatedResultAnnouncement': '{result} is validated and ready.',
  'candidateJourney.progressLabel': 'Candidate Journey progress',
  'candidateJourney.progressDescription': 'This can take up to a minute. Your documents stay in this browser.',
  'candidateJourney.progressStep': 'Step {step} of 3 · about a minute in total.',
  'candidateJourney.operation.extractSourceProfile': 'Extracting your Source Profile…',
  'candidateJourney.operation.processingJobPosting': 'Analyzing your Job Posting and building Match Analysis…',
  'candidateJourney.operation.processingProfileEnrichment': 'Adding the confirmed Candidate Fact and refreshing Match Analysis…',
  'candidateJourney.operation.resolvingCriticalAmbiguity': 'Saving your Critical Ambiguity resolution…',
  'candidateJourney.operation.preparingTailoredResume': 'Validating and preparing your Tailored Resume…',
  'candidateJourney.result.sourceProfile': 'Source Profile',
  'candidateJourney.result.matchAnalysis': 'Match Analysis',
  'candidateJourney.result.tailoredResume': 'Tailored Resume',
  'processingPolicy.provider': 'Provider',
  'processingPolicy.purposes': 'Purposes',
  'processingPolicy.transmittedDataCategories': 'Data sent',
  'processingPolicy.retentionPolicy': 'Retention',
  'processingPolicy.storageBehavior': 'Storage',
  'processingPolicy.version': 'Policy version',
  'processingPolicy.purpose.extractEvidence': 'Extract and structure professional evidence',
  'processingPolicy.purpose.compareEvidence': 'Compare Candidate evidence with Job Posting requirements',
  'processingPolicy.purpose.writeResume': 'Write and validate supported Tailored Resume content',
  'processingPolicy.data.minimizedProfessionalContent': 'Minimized professional content',
  'processingPolicy.data.jobPostingContent': 'Job Posting content',
  'processingPolicy.data.candidateFacts': 'Candidate Facts needed for matching, writing, and validation',
  'processingPolicy.retentionValue': 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
  'processingPolicy.storageValue': 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
  'sourceIntake.title': 'Complete your Source Intake',
  'sourceIntake.description': 'Upload a text-based PDF or DOCX, or paste professional text. Contact details stay in this browser.',
  'sourceIntake.pasteMethod': 'Paste text',
  'sourceIntake.uploadMethod': 'Upload PDF or DOCX',
  'sourceIntake.professionalText': 'Professional text',
  'sourceIntake.professionalTextPlaceholder': 'Paste your experience, projects, skills, education, languages, and certifications',
  'sourceIntake.sourceFile': 'Source Document',
  'sourceIntake.sourceFileHint': 'Choose a PDF or DOCX (maximum five pages)',
  'sourceIntake.submit': 'Build my Source Profile',
  'sourceIntake.ready': 'Your Source Profile is ready.',
  'sourceIntake.inspectProfile': 'Inspect Source Profile',
  'sourceIntake.hideProfile': 'Hide Source Profile',
  'sourceIntake.detailedProfile': 'Detailed Source Profile',
  'sourceIntake.ambiguities': 'Resolve Critical Ambiguities',
  'sourceIntake.answerAmbiguity': 'Save this answer',
  'sourceIntake.experiences': 'Experiences',
  'sourceIntake.projects': 'Projects',
  'sourceIntake.skills': 'Skills',
  'sourceIntake.education': 'Education',
  'sourceIntake.languages': 'Languages',
  'sourceIntake.certifications': 'Certifications',
  'sourceIntake.failure.ambiguity': 'This Critical Ambiguity is no longer available.',
  'sourceIntake.failure.storage': 'The Source Profile could not be saved in this browser.',
  'sourceIntake.failure.encrypted': 'This document is encrypted. Upload an unlocked copy or paste its text.',
  'sourceIntake.failure.empty': 'Add professional text before continuing.',
  'sourceIntake.failure.invalid': 'This document is invalid. Export a new PDF or DOCX and try again.',
  'sourceIntake.failure.oversized': 'Use a document of at most five pages and 5 MB, or paste up to 50,000 characters.',
  'sourceIntake.failure.consent': 'Grant Processing Consent before building the Source Profile.',
  'sourceIntake.failure.scanned': 'This PDF appears to be a scan. Use a PDF with selectable text or paste the text.',
  'sourceIntake.failure.extraction': 'The Source Profile could not be extracted. Your Candidate Session is unchanged; try again.',
  'sourceIntake.failure.unreadable': 'This document could not be read. Upload another copy or paste the text.',
  'sourceIntake.failure.unsupported': 'Only text-based PDF, DOCX, and pasted text are supported.',
  'jobMatch.title': 'Analyze one Job Posting',
  'jobMatch.textLabel': 'Job Posting text',
  'jobMatch.fileLabel': 'Job Posting file',
  'jobMatch.targetRole': 'Target Role',
  'jobMatch.measurement': 'This score measures how strongly your Candidate Facts cover the explicit professional requirements. It is not a hiring probability.',
  'jobMatch.strengths': 'Three strongest matches',
  'jobMatch.gaps': 'Three priority gaps',
  'jobMatch.criticalReserve': 'Critical Requirement Reserve',
  'jobMatch.criticalReserve.clear': 'No critical requirement has an evidence reserve.',
  'jobMatch.criticalReserve.present': 'One or more critical requirements are partial or unsupported. Read these gaps before deciding to apply.',
  'jobMatch.constraints': 'Important Practical Constraints',
  'jobMatch.constraints.none': 'No explicit Practical Constraint was found.',
  'jobMatch.details': 'Complete requirement-to-evidence details',
  'jobMatch.importance.critical': 'Critical',
  'jobMatch.importance.central': 'Central',
  'jobMatch.importance.complementary': 'Complementary',
  'jobMatch.coverage.covered': 'Covered',
  'jobMatch.coverage.partially-covered': 'Partially covered',
  'jobMatch.coverage.uncovered': 'Uncovered',
  'jobMatch.sourceExcerpt': 'Exact source excerpt',
  'jobMatch.evidence': 'Candidate evidence',
  'jobMatch.evidence.none': 'No supporting Candidate Fact.',
  'jobMatch.adjacentEvidence': 'Related experience you can highlight instead (it does not meet this requirement)',
  'jobMatch.failure.empty': 'Add Job Posting text before continuing.',
  'jobMatch.failure.invalid': 'This Job Posting file is invalid.',
  'jobMatch.failure.oversized': 'Use a Job Posting smaller than 5 MB and 100,000 characters.',
  'jobMatch.failure.scanned': 'This PDF appears to be a scan. Use a PDF with selectable text or paste the text.',
  'jobMatch.failure.unsupported': 'Only pasted text, text-based PDF, and TXT Job Postings are supported. URL scraping is not available.',
  'jobMatch.failure.unreadable': 'This Job Posting could not be read. Upload another copy or paste the text.',
  'jobMatch.failure.extraction': 'The Job Posting could not be analyzed. Your previous stable result is unchanged; try again.',
  'jobMatch.failure.evidence': 'Match Evidence could not be validated. Your previous stable result is unchanged; try again.',
  'jobMatch.failure.consent': 'Grant Processing Consent before analyzing a Job Posting.',
  'jobMatch.failure.storage': 'The Match Analysis could not be saved in this browser.',
  'jobMatch.enrichmentUnavailable': 'This requirement cannot accept Profile Enrichment.',
  'jobMatch.generation.denied': 'No relevant Candidate Fact supports a Tailored Resume for this job.',
  'jobMatch.generation.lowScoreWarning': 'A low Match Score is a warning, not a generation block.',
  'jobMatch.generation.normalizedNotice': 'Only a normalized version of your Source Profile is available. It will not use the Job Posting to claim tailoring.',
  'sourceProfile.kind.experience': 'Experience',
  'sourceProfile.kind.skill': 'Skill',
  'sourceProfile.kind.education': 'Education',
  'sourceProfile.kind.certification': 'Certification',
  'sourceProfile.kind.language': 'Language',
  'sourceProfile.kind.project': 'Project',
  'matchAnalysis.score': 'Match Score',
  'matchAnalysis.band.strong': 'Strong evidence coverage',
  'matchAnalysis.band.credible': 'Credible evidence coverage',
  'matchAnalysis.band.ambitious': 'Ambitious evidence coverage',
  'matchAnalysis.enrichmentTitle': 'Optional profile enrichment',
  'matchAnalysis.enrichmentDescription': 'Add only real professional experience missing from your Source Profile. The three highest-impact required gaps are shown first.',
  'matchAnalysis.enrichmentQuestion': 'Do you have real professional experience that supports this required Job Requirement?',
  'matchAnalysis.enrichmentAnswer': 'Describe only what you actually did',
  'matchAnalysis.enrichmentKind': 'Candidate Fact type',
  'matchAnalysis.enrichmentAdd': 'Add this Candidate Fact and refresh analysis',
  'matchAnalysis.enrichmentDuplicateFailure': 'This Candidate Fact is already in your Source Profile. Your previous Match Analysis is unchanged.',
  'matchAnalysis.enrichmentInvalidFailure': 'Add a non-empty Candidate Fact or skip this question. Your previous Match Analysis is unchanged.',
  'operation.extractSourceProfile': 'Extracting professional facts…',
  'notFound.title': 'Page not found',
  'notFound.description': 'The page you requested does not belong to this Resume Tailoring workflow.',
  'notFound.return': 'Return to the workflow',
  'safetyNet.title': 'Something went wrong',
  'safetyNet.explanation': 'This page stopped working. Your documents stay in this browser: reload the page to continue where you left off.',
  'safetyNet.reload': 'Reload',
  'safetyNet.returnToDocuments': 'Back to my documents',
} as const

type TranslationKey = keyof typeof englishCatalog
type TranslationCatalog = Readonly<Record<TranslationKey, string>>

const frenchCatalog = {
  'combinedIntake.outdated': 'Ceci est ton dernier CV stable. Régénère pour appliquer les changements de source, d’offre ou de langue ; l’export est suspendu.',
  "combinedIntake.title": "Ton CV et l’offre d’emploi",
  "combinedIntake.description": "Dépose un fichier ou colle le texte. Un seul clic suffit.",
  "combinedIntake.sourceTitle": "Ton CV",
  "combinedIntake.sourceHint": "PDF ou DOCX, 5 pages et 5 Mo maximum",
  "combinedIntake.sourcePlaceholder": "Colle ici le texte de ton CV ou de ton profil LinkedIn…",
  "combinedIntake.postingTitle": "L’offre d’emploi",
  "combinedIntake.postingHint": "PDF ou TXT",
  "combinedIntake.postingPlaceholder": "Colle ici l’offre complète…",
  "combinedIntake.dropFile": "Glisse ton fichier ici ou clique pour le choisir",
  "combinedIntake.orPaste": "ou colle le texte",
  "combinedIntake.removeFile": "Retirer",
  "combinedIntake.rejectedFile": "Ce fichier ne peut pas être utilisé ici. Vérifie son format et sa taille.",
  "combinedIntake.sourceReady": "Ton CV est déjà analysé et prêt à être réutilisé.",
  "combinedIntake.replaceSourceAction": "Remplacer mon CV",
  "combinedIntake.keepSourceAction": "Garder mon CV actuel",
  "combinedIntake.generate": "Générer mon CV",
  "combinedIntake.regenerate": "Générer à nouveau mon CV",
  "combinedIntake.replaceSource": "Réutiliser le profil source ou remplacer le document",
  "combinedIntake.replaceTitle": "Régénérer ce CV ?",
  "combinedIntake.replaceWarning": "La génération remplace le CV actuel, y compris les modifications manuelles. Tes preuves sources restent disponibles.",
  "combinedIntake.confirmRegenerate": "Remplacer et régénérer",
  "combinedIntake.normalized": "Préparer un CV non adapté",
  "combinedIntake.interruptedTitle": "La génération a été interrompue.",
  "combinedIntake.failedTitle": "La préparation n’a pas abouti.",
  "combinedIntake.inputsKept": "Tes entrées sont conservées.",
  "combinedIntake.inputsAndResumeKept": "Tes entrées et ton dernier CV sont conservés.",
  "combinedIntake.cause.source": "Nous n’avons pas réussi à analyser ton CV.",
  "combinedIntake.cause.posting": "Nous n’avons pas réussi à analyser l’offre d’emploi.",
  "combinedIntake.cause.evidence": "Nous n’avons pas réussi à relier ton CV aux exigences de l’offre.",
  "combinedIntake.cause.unavailable": "Le service n’a pas répondu. Réessaie dans un instant.",
  "combinedIntake.retry": "Réessayer",
  'failure.access-required.title': 'Ton accès à la démo a expiré',
  'failure.access-required.explanation': 'La vérification de sécurité qui protège cette démo doit être repassée. Tes données sont conservées.',
  'failure.access-required.action': 'Repasser la vérification',
  'failure.rate-limited.title': 'Trop de demandes',
  'failure.rate-limited.explanation': 'Trop de demandes ont été envoyées en peu de temps. Patiente un instant avant de réessayer.',
  'failure.rate-limited.action': 'Réessayer dans {seconds} s',
  'failure.timeout.title': 'Le service a mis trop de temps',
  'failure.timeout.explanation': 'L’opération a pris plus de temps que prévu. Réessayer suffit généralement.',
  'failure.timeout.action': 'Réessayer',
  'failure.input-too-large.title': 'Ton texte est trop long',
  'failure.input-too-large.explanation': 'Le texte dépasse ce que le service accepte. Raccourcis ton CV ou l’offre d’emploi, puis réessaie.',
  'failure.input-too-large.action': 'Raccourcir mon texte',
  'failure.service-unavailable.title': 'Le service est indisponible',
  'failure.service-unavailable.explanation': 'Le service de rédaction n’a pas répondu correctement. Réessaie dans un instant.',
  'failure.service-unavailable.action': 'Réessayer',
  'failure.network.title': 'Connexion perdue',
  'failure.network.explanation': 'Ton navigateur n’a pas pu joindre le service. Vérifie ta connexion, puis réessaie.',
  'failure.network.action': 'Réessayer',
  'failure.unexpected.title': 'Un problème inattendu est survenu',
  'failure.unexpected.explanation': 'Le service a répondu de façon inattendue. Recharge la page ; ton travail reste dans ce navigateur.',
  'failure.unexpected.action': 'Recharger la page',
  'failure.retry': 'Réessayer',
  'failure.preview.layoutUnavailable': 'Le PDF n’a pas pu être produit ou validé. Ton brouillon est conservé.',
  'failure.preview.pagesUnavailable': 'Le PDF n’a pas pu être affiché. Ton brouillon est conservé.',
  'failure.preview.retry': 'Réessayer l’aperçu',
  'failure.preview.download': 'Le téléchargement n’a pas pu démarrer. Ton brouillon est conservé. Réessaie.',
  'failure.review.title': 'L’opération n’a pas abouti. Ton contenu actuel est conservé.',
  'failure.review.renew-consent': 'Renouvelle ton consentement au traitement avant de réessayer.',
  'failure.review.correct-content': 'Corrige le contenu non étayé ou atteste-le explicitement.',
  'failure.review.retry-current-draft': 'Le document a changé. Réessaie avec la version actuelle.',
  'failure.review.pageCountUnavailable': 'Le nombre de pages est indisponible. Ton contenu est conservé ; relance la vérification.',
  "combinedIntake.omittedAmbiguities": "Les informations ambiguës ont été écartées. Tu peux les consulter et les corriger ci-dessous sans perdre le CV utilisable.",
  "combinedIntake.unsafe": "Le contenu généré n’est pas étayé par tes preuves. Il n’a pas remplacé ton CV.",
  "combinedIntake.incoherent": "Certaines rubriques se répétaient ou se contredisaient, même après une réécriture. Réessaie pour réécrire seulement ces rubriques.",
  "combinedIntake.analysis": "Analyse de correspondance et preuves",
  "combinedIntake.inspection": "Consulter ou enrichir les preuves sources",
  "resultBanner.ready": "Ton dernier CV est prêt",
  "resultBanner.preparing": "Ton CV est en cours de préparation",
  "resultBanner.view": "Voir",
  "resumeResult.backToDocuments": "Revenir à mes documents",
  "combinedIntake.matching": "Mise en correspondance des preuves avec l’offre…",
  "combinedIntake.writing": "Rédaction de ton CV section par section…",
  'resumeSections.title': 'Ton CV prend forme',
  'resumeSections.description': 'Chaque rubrique apparaît dès qu’elle est vérifiée par rapport à tes preuves. Le téléchargement s’ouvre quand tout le CV est vérifié.',
  'resumeSections.keptTitle': 'Rubriques vérifiées conservées',
  'resumeSections.keptDescription': 'Ces rubriques sont vérifiées par rapport à tes preuves et conservées. Une nouvelle tentative ne réécrit que les autres.',
  'resumeSections.writing': 'Rédaction : {section}…',
  'resumeSections.failed': '{section} : rubrique non préparée.',
  "combinedIntake.extractingPosting": "Extraction des exigences de l’offre…",
  "combinedIntake.normalizedReady": "CV non adapté prêt",
  "combinedIntake.policyDetails": "Détails du traitement",
  "processingPolicy.consentByGeneration": "En générant, tu acceptes que {provider} traite ton contenu professionnel pour rédiger ce CV. Rien n’est stocké sur nos serveurs.",
  "processingPolicy.grantedSummary": "Traitement par {provider}, sans stockage sur nos serveurs.",

  'brand.name': 'Resume Studio',
  'demoAccess.title': 'Préparation de la démo',
  'demoAccess.description': "Une vérification rapide protège cette démo publique contre les abus automatisés. Aucun compte n'est nécessaire.",
  'demoAccess.verifying': "Vérification de l'accès…",
  'demoAccess.retry': 'Relancer la vérification de sécurité',
  'demoAccess.expiredTitle': 'Ta session de démo a expiré',
  'demoAccess.expiredDescription': "Valide la vérification de sécurité pour continuer. Tes entrées sont conservées et l'étape interrompue reprend d'elle-même.",
  'demoAccess.abandon': 'Plus tard',
  'locale.unavailable': "La langue de l'interface n'est pas disponible.",
  'locale.switcherLabel': 'Langue',
  'candidateJourney.eyebrow': '2 documents · 1 clic · ton CV en PDF',
  'candidateJourney.title': 'Ton CV, taillé pour l’offre.',
  'candidateJourney.description': "Dépose ton CV et l’offre d’emploi. On met en avant tes expériences les plus pertinentes, sans rien inventer. Tes données restent dans ce navigateur pendant 24 heures.",
  'candidateJourney.privateByDesign': 'Privé par conception',
  'candidateJourney.skipToContent': 'Aller directement au contenu du Parcours Candidat',
  'candidateJourney.phasesLabel': 'Phases du Parcours Candidat',
  'candidateJourney.sourceIntake': 'Collecte des Sources',
  'candidateJourney.sourceIntakeDescription': 'Ajoute les faits professionnels qui peuvent soutenir ta candidature.',
  'candidateJourney.jobMatch': "Correspondance avec l'Offre",
  'candidateJourney.jobMatchDescription': "Compare tes preuves à une Offre d'emploi.",
  'candidateJourney.tailoredResumePreparation': 'Préparation du CV Adapté',
  'candidateJourney.tailoredResumePreparationDescription': 'Prépare et exporte un CV fondé sur tes preuves.',
  'tailoredResume.valueProposition': 'Proposition de valeur',
  'tailoredResume.experiences': 'Expérience',
  'tailoredResume.language': 'Langue du CV',
  'tailoredResume.languageAutomatic': 'Langue de l’offre',
  'tailoredResume.contactDetails': 'Coordonnées locales',
  'tailoredResume.name': 'Nom',
  'tailoredResume.email': 'E-mail',
  'tailoredResume.phone': 'Téléphone',
  'tailoredResume.fieldLabel': 'Champ du CV',
  'tailoredResume.saveField': 'Enregistrer la formulation',
  'tailoredResume.attestField': 'Attester comme nouveau Candidate Fact',
  'tailoredResume.unsupportedField': 'Cette modification professionnelle n’est pas étayée par les Candidate Facts actuels.',
  'tailoredResume.hideField': 'Masquer le champ',
  'tailoredResume.restoreField': 'Restaurer le champ',
  'tailoredResume.moveUp': 'Monter',
  'tailoredResume.moveDown': 'Descendre',
  'candidateJourney.startSession': 'Démarrer une Session Candidat',
  'candidateJourney.sessionActive': 'Session Candidat active',
  'candidateJourney.deleteSession': 'Supprimer la Session Candidat',
  'candidateJourney.deleteDialogTitle': 'Supprimer la Session Candidat ?',
  'candidateJourney.deleteDialogDescription': 'Cette action supprime immédiatement la Session Candidat stockée dans ce navigateur.',
  'candidateJourney.deleteCancel': 'Annuler',
  'candidateJourney.deleteConfirm': 'Supprimer la session maintenant',
  'candidateJourney.sessionDeleted': 'Session Candidat supprimée de ce navigateur.',
  'candidateJourney.expiredSessionDiscarded': 'Ta Session Candidat expirée a été supprimée de ce navigateur.',
  'candidateJourney.incompatibleSessionDiscarded': 'Une Session Candidat incompatible a été supprimée de ce navigateur.',
  'candidateJourney.storageUnavailable': "Le stockage de la Session Candidat n'est pas disponible.",
  'candidateJourney.phaseAnnouncement': 'Phase actuelle : {phase}.',
  'candidateJourney.operationAnnouncement': '{operation} Ton dernier résultat stable reste visible pendant le traitement.',
  'candidateJourney.firstOperationAnnouncement': '{operation}',
  'candidateJourney.validatedResultAnnouncement': '{result} validé et prêt.',
  'candidateJourney.progressLabel': 'Progression du Parcours Candidat',
  'candidateJourney.progressDescription': 'Ça peut prendre jusqu’à une minute. Tes documents restent dans ce navigateur.',
  'candidateJourney.progressStep': 'Étape {step} sur 3 · environ une minute au total.',
  'candidateJourney.operation.extractSourceProfile': 'Extraction de ton Profil Source…',
  'candidateJourney.operation.processingJobPosting': "Analyse de ton Offre d’emploi et création de l’Analyse de Correspondance…",
  'candidateJourney.operation.processingProfileEnrichment': 'Ajout du Fait Candidat confirmé et actualisation de l’Analyse de Correspondance…',
  'candidateJourney.operation.resolvingCriticalAmbiguity': 'Enregistrement de ta résolution de l’Ambiguïté Critique…',
  'candidateJourney.operation.renderingResumeDocument': 'Préparation de l’aperçu PDF',
  'candidateJourney.operation.preparingTailoredResume': 'Validation et préparation de ton CV Adapté…',
  'candidateJourney.result.sourceProfile': 'Profil Source',
  'candidateJourney.result.matchAnalysis': 'Analyse de Correspondance',
  'candidateJourney.result.tailoredResume': 'CV Adapté',
  'processingPolicy.provider': 'Fournisseur',
  'processingPolicy.purposes': 'Finalités',
  'processingPolicy.transmittedDataCategories': 'Données envoyées',
  'processingPolicy.retentionPolicy': 'Conservation',
  'processingPolicy.storageBehavior': 'Stockage',
  'processingPolicy.version': 'Version de la politique',
  'processingPolicy.purpose.extractEvidence': 'Extraire et structurer les preuves professionnelles',
  'processingPolicy.purpose.compareEvidence': "Comparer les preuves du Candidat aux exigences de l’Offre d’emploi",
  'processingPolicy.purpose.writeResume': 'Rédiger et valider le contenu étayé du CV Adapté',
  'processingPolicy.data.minimizedProfessionalContent': 'Contenu professionnel minimisé',
  'processingPolicy.data.jobPostingContent': "Contenu de l’Offre d’emploi",
  'processingPolicy.data.candidateFacts': 'Faits Candidats nécessaires à la correspondance, à la rédaction et à la validation',
  'processingPolicy.retentionValue': "Les entrées et sorties de l’API peuvent être conservées jusqu’à 30 jours pour surveiller les abus, ou plus longtemps si la loi l’exige.",
  'processingPolicy.storageValue': 'Le contenu du Candidat reste dans le navigateur ; les requêtes au modèle sont sans état et le stockage applicatif est désactivé.',
  'sourceIntake.title': 'Complète ta Collecte des Sources',
  'sourceIntake.description': 'Importe un PDF texte ou un DOCX, ou colle du texte professionnel. Tes coordonnées restent dans ce navigateur.',
  'sourceIntake.pasteMethod': 'Coller du texte',
  'sourceIntake.uploadMethod': 'Importer un PDF ou DOCX',
  'sourceIntake.professionalText': 'Texte professionnel',
  'sourceIntake.professionalTextPlaceholder': 'Colle tes expériences, projets, compétences, formations, langues et certifications',
  'sourceIntake.sourceFile': 'Document Source',
  'sourceIntake.sourceFileHint': 'Choisis un PDF ou DOCX (cinq pages maximum)',
  'sourceIntake.submit': 'Construire mon Profil Source',
  'sourceIntake.ready': 'Ton Profil Source est prêt.',
  'sourceIntake.inspectProfile': 'Inspecter le Profil Source',
  'sourceIntake.hideProfile': 'Masquer le Profil Source',
  'sourceIntake.detailedProfile': 'Profil Source détaillé',
  'sourceIntake.ambiguities': 'Résoudre les Ambiguïtés Critiques',
  'sourceIntake.answerAmbiguity': 'Enregistrer cette réponse',
  'sourceIntake.experiences': 'Expériences',
  'sourceIntake.projects': 'Projets',
  'sourceIntake.skills': 'Compétences',
  'sourceIntake.education': 'Formation',
  'sourceIntake.languages': 'Langues',
  'sourceIntake.certifications': 'Certifications',
  'sourceIntake.failure.ambiguity': "Cette Ambiguïté Critique n'est plus disponible.",
  'sourceIntake.failure.storage': "Le Profil Source n'a pas pu être enregistré dans ce navigateur.",
  'sourceIntake.failure.encrypted': 'Ce document est chiffré. Importe une copie déverrouillée ou colle son texte.',
  'sourceIntake.failure.empty': 'Ajoute du texte professionnel avant de continuer.',
  'sourceIntake.failure.invalid': 'Ce document est invalide. Exporte un nouveau PDF ou DOCX puis réessaie.',
  'sourceIntake.failure.oversized': 'Utilise un document de cinq pages et 5 Mo maximum, ou colle jusqu’à 50 000 caractères.',
  'sourceIntake.failure.consent': 'Accorde le Consentement au Traitement avant de construire le Profil Source.',
  'sourceIntake.failure.scanned': 'Ce PDF semble être un scan. Utilise un PDF avec du texte sélectionnable ou colle le texte.',
  'sourceIntake.failure.extraction': "Le Profil Source n'a pas pu être extrait. Ta Session Candidat est inchangée ; réessaie.",
  'sourceIntake.failure.unreadable': "Ce document n'a pas pu être lu. Importe une autre copie ou colle le texte.",
  'sourceIntake.failure.unsupported': 'Seuls les PDF texte, DOCX et textes collés sont pris en charge.',
  'jobMatch.title': 'Analyse une Offre d’emploi',
  'jobMatch.textLabel': 'Texte de l’Offre d’emploi',
  'jobMatch.fileLabel': 'Fichier de l’Offre d’emploi',
  'jobMatch.targetRole': 'Poste ciblé',
  'jobMatch.measurement': 'Ce score mesure la couverture des exigences professionnelles explicites par tes Faits Candidats. Ce n’est pas une probabilité d’embauche.',
  'jobMatch.strengths': 'Trois correspondances les plus fortes',
  'jobMatch.gaps': 'Trois écarts prioritaires',
  'jobMatch.criticalReserve': 'Réserve sur Exigence Critique',
  'jobMatch.criticalReserve.clear': 'Aucune exigence critique ne présente de réserve de preuve.',
  'jobMatch.criticalReserve.present': 'Une ou plusieurs exigences critiques sont partielles ou non étayées. Lis ces écarts avant de décider de postuler.',
  'jobMatch.constraints': 'Contraintes Pratiques importantes',
  'jobMatch.constraints.none': 'Aucune Contrainte Pratique explicite n’a été trouvée.',
  'jobMatch.details': 'Détails complets des exigences et preuves',
  'jobMatch.importance.critical': 'Critique',
  'jobMatch.importance.central': 'Centrale',
  'jobMatch.importance.complementary': 'Complémentaire',
  'jobMatch.coverage.covered': 'Couverte',
  'jobMatch.coverage.partially-covered': 'Partiellement couverte',
  'jobMatch.coverage.uncovered': 'Non couverte',
  'jobMatch.sourceExcerpt': 'Extrait source exact',
  'jobMatch.evidence': 'Preuve du Candidat',
  'jobMatch.evidence.none': 'Aucun Fait Candidat ne l’étaye.',
  'jobMatch.adjacentEvidence': 'Expérience proche à mettre en avant à la place (elle ne remplit pas cette exigence)',
  'jobMatch.failure.empty': 'Ajoute le texte de l’Offre d’emploi avant de continuer.',
  'jobMatch.failure.invalid': 'Ce fichier d’Offre d’emploi est invalide.',
  'jobMatch.failure.oversized': 'Utilise une Offre d’emploi de moins de 5 Mo et 100 000 caractères.',
  'jobMatch.failure.scanned': 'Ce PDF semble scanné. Utilise un PDF avec du texte sélectionnable ou colle le texte.',
  'jobMatch.failure.unsupported': 'Seuls le texte collé, les PDF texte et les fichiers TXT sont pris en charge. L’extraction depuis une URL n’est pas disponible.',
  'jobMatch.failure.unreadable': 'Cette Offre d’emploi est illisible. Importe une autre copie ou colle le texte.',
  'jobMatch.failure.extraction': 'L’Offre d’emploi n’a pas pu être analysée. Le dernier résultat stable reste disponible ; réessaie.',
  'jobMatch.failure.evidence': 'Les Preuves de Correspondance n’ont pas pu être validées. Le dernier résultat stable reste disponible ; réessaie.',
  'jobMatch.failure.consent': 'Accorde le Consentement au Traitement avant d’analyser une Offre d’emploi.',
  'jobMatch.failure.storage': 'L’Analyse de Correspondance n’a pas pu être enregistrée dans ce navigateur.',
  'jobMatch.enrichmentUnavailable': 'Cette exigence ne peut pas recevoir un Enrichissement du Profil.',
  'jobMatch.generation.denied': 'Aucun Fait Candidat pertinent ne permet de produire un CV Adapté à cette offre.',
  'jobMatch.generation.lowScoreWarning': 'Un Score de Correspondance faible est un avertissement, pas un blocage de génération.',
  'jobMatch.generation.normalizedNotice': 'Seule une version normalisée de ton Profil Source est disponible. Elle ne prétendra pas être adaptée à l’Offre d’emploi.',
  'sourceProfile.kind.experience': 'Expérience',
  'sourceProfile.kind.skill': 'Compétence',
  'sourceProfile.kind.education': 'Formation',
  'sourceProfile.kind.certification': 'Certification',
  'sourceProfile.kind.language': 'Langue',
  'sourceProfile.kind.project': 'Projet',
  'matchAnalysis.score': 'Score de Correspondance',
  'matchAnalysis.band.strong': 'Couverture de preuves forte',
  'matchAnalysis.band.credible': 'Couverture de preuves crédible',
  'matchAnalysis.band.ambitious': 'Couverture de preuves ambitieuse',
  'matchAnalysis.enrichmentTitle': 'Enrichissement facultatif du Profil Source',
  'matchAnalysis.enrichmentDescription': "Ajoute uniquement une expérience professionnelle réelle absente de ton Profil Source. Les trois écarts obligatoires au plus fort impact sont affichés en premier.",
  'matchAnalysis.enrichmentQuestion': "As-tu une expérience professionnelle réelle qui appuie cette Exigence de l'Offre obligatoire ?",
  'matchAnalysis.enrichmentAnswer': 'Décris uniquement ce que tu as réellement fait',
  'matchAnalysis.enrichmentKind': 'Type de Fait Candidat',
  'matchAnalysis.enrichmentAdd': "Ajouter ce Fait Candidat et actualiser l'analyse",
  'matchAnalysis.enrichmentDuplicateFailure': "Ce Fait Candidat figure déjà dans ton Profil Source. Ton Analyse de Correspondance précédente est conservée.",
  'matchAnalysis.enrichmentInvalidFailure': "Ajoute un Fait Candidat non vide ou ignore cette question. Ton Analyse de Correspondance précédente est conservée.",
  'operation.extractSourceProfile': 'Extraction des faits professionnels…',
  'notFound.title': 'Page introuvable',
  'notFound.description': "La page demandée n'appartient pas à ce parcours d'adaptation de CV.",
  'notFound.return': 'Retourner au parcours',
  'safetyNet.title': 'Un problème est survenu',
  'safetyNet.explanation': 'Cette page a cessé de fonctionner. Tes documents restent dans ce navigateur : recharge la page pour reprendre là où tu en étais.',
  'safetyNet.reload': 'Recharger',
  'safetyNet.returnToDocuments': 'Revenir à mes documents',
} as const satisfies TranslationCatalog

export type Locale = 'en' | 'fr'

export type Localization = Readonly<{
  locale: Locale
  preferencePersistenceError: 'unavailable' | null
  readiness: 'pending' | 'ready'
  selectLocale: (locale: Locale) => void
  translate: (key: TranslationKey) => string
}>

export type LocalizationResult =
  | Readonly<{ ok: true; value: Localization }>
  | Readonly<{ ok: false; error: 'provider-missing' }>

type LocaleState = Pick<Localization, 'locale' | 'preferencePersistenceError' | 'readiness'>
type BrowserStorageResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: 'unavailable' }>

const catalogs: Readonly<Record<Locale, TranslationCatalog>> = {
  en: englishCatalog,
  fr: frenchCatalog,
}
const defaultLocale: Locale = 'en'
const localeStorageKey = 'honest-resume-locale'
const pendingLocaleState = {
  locale: defaultLocale,
  preferencePersistenceError: null,
  readiness: 'pending',
} as const satisfies LocaleState
const LocalizationContext = createContext<Localization | null>(null)

export function LocalizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [localeState, setLocaleState] = useState<LocaleState>(pendingLocaleState)
  useEffect(() => {
    setLocaleState(readInitialLocale())
  }, [])
  return (
    <LocalizationContext.Provider value={{
      ...localeState,
      selectLocale: (selectedLocale) => {
        selectLocale({ selectedLocale, setLocaleState })
      },
      translate: (key) => readTranslation({ locale: localeState.locale, key }),
    }}>
      {children}
    </LocalizationContext.Provider>
  )
}

export function useLocalization() {
  const localization = useContext(LocalizationContext)
  if (localization === null) return missingProviderResult
  return { ok: true, value: localization } as const
}

export const defaultDocumentTitle = englishCatalog['brand.name']
export const localizationUnavailableMessage = englishCatalog['locale.unavailable']

export function LocalizationFailure() {
  return <p role="alert">{localizationUnavailableMessage}</p>
}

function readInitialLocale(): LocaleState {
  const storedLocale = readStoredLocale()
  if (storedLocale.ok && storedLocale.value !== null) {
    return createReadyLocaleState({ locale: storedLocale.value, persistenceError: null })
  }
  return createReadyLocaleState({
    locale: readSupportedLocale({ languages: navigator.languages }),
    persistenceError: storedLocale.ok ? null : storedLocale.error,
  })
}

function readStoredLocale(): BrowserStorageResult<Locale | null> {
  try {
    const storedLocale = localStorage.getItem(localeStorageKey)
    return { ok: true, value: parseLocale({ value: storedLocale }) }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

function readSupportedLocale({ languages }: Readonly<{ languages: readonly string[] }>): Locale {
  for (const language of languages) {
    const [languageCode] = language.toLowerCase().split('-')
    const locale = parseLocale({ value: languageCode })
    if (locale !== null) return locale
  }
  return defaultLocale
}

function parseLocale({ value }: Readonly<{ value: string | null | undefined }>): Locale | null {
  return value === 'en' || value === 'fr' ? value : null
}

function selectLocale({
  selectedLocale,
  setLocaleState,
}: Readonly<{
  selectedLocale: Locale
  setLocaleState: (state: LocaleState) => void
}>) {
  const persistenceResult = storeLocale({ selectedLocale })
  setLocaleState(createReadyLocaleState({
    locale: selectedLocale,
    persistenceError: persistenceResult.ok ? null : persistenceResult.error,
  }))
}

function storeLocale({
  selectedLocale,
}: Readonly<{ selectedLocale: Locale }>): BrowserStorageResult<undefined> {
  try {
    localStorage.setItem(localeStorageKey, selectedLocale)
    return { ok: true, value: undefined }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

function createReadyLocaleState({
  locale,
  persistenceError,
}: Readonly<{
  locale: Locale
  persistenceError: LocaleState['preferencePersistenceError']
}>): LocaleState {
  return { locale, preferencePersistenceError: persistenceError, readiness: 'ready' }
}

/** Both catalogs are complete at compile time, so a key always has its translation. */
function readTranslation({ locale, key }: Readonly<{ locale: Locale; key: TranslationKey }>) {
  return catalogs[locale][key]
}

const missingProviderResult = {
  ok: false,
  error: 'provider-missing',
} as const satisfies LocalizationResult
