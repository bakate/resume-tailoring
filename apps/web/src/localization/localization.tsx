import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const englishCatalog = {
  'brand.homeLabel': 'Honest Resume home',
  'brand.name': 'Honest Resume',
  'brand.tagline': 'A more honest way to get hired.',
  'locale.english': 'English',
  'locale.french': 'Français',
  'locale.persistenceFailure': 'Your language preference could not be saved.',
  'locale.unavailable': 'The interface language is unavailable.',
  'locale.switcherLabel': 'Language',
  'hero.title': 'Tailor your resume without inventing a thing.',
  'hero.lede': 'Build a focused resume from facts you have reviewed and approved.',
  'session.start': 'Start tailoring',
  'session.delete': 'Delete private session',
  'session.loadFailure': 'Your private session could not be loaded.',
  'session.openFailure': 'The workflow could not be opened. Try again.',
  'session.deleteFailure': 'Your private session could not be deleted. Try again.',
  'sourceProfile.title': 'Build your Source Profile',
  'sourceProfile.importDescription': 'Import a text-based resume or LinkedIn PDF. The document is read in your browser.',
  'sourceProfile.fileLabel': 'Choose a PDF Source Document',
  'sourceProfile.reviewSurfaceTitle': 'Review outgoing Source Document',
  'sourceProfile.detectedTitle': 'Removed before processing',
  'sourceProfile.detectedNone': 'No common contact or sensitive personal information was detected.',
  'sourceProfile.sensitiveKind.email': 'Email address',
  'sourceProfile.sensitiveKind.phone': 'Phone number',
  'sourceProfile.sensitiveKind.url': 'Web address',
  'sourceProfile.sensitiveKind.address': 'Postal address',
  'sourceProfile.sensitiveKind.date-of-birth': 'Date of birth',
  'sourceProfile.sensitiveKind.personal-information': 'Personal information',
  'sourceProfile.outgoingLabel': 'Exact content that will be sent for extraction',
  'sourceProfile.saveContent': 'Save minimized content',
  'sourceProfile.noticeTitle': 'Processing notice',
  'sourceProfile.noticeText': 'Only the content shown above is sent to OpenAI in a stateless request with storage disabled. Standard abuse-monitoring retention may still apply.',
  'sourceProfile.noticeVersion': 'Notice version:',
  'sourceProfile.confirmNotice': 'Confirm this processing notice',
  'sourceProfile.noticeConfirmed': 'Processing notice confirmed for this session.',
  'sourceProfile.extract': 'Extract professional facts',
  'sourceProfile.factsTitle': 'Review extracted facts',
  'sourceProfile.reviewProgress': 'Facts reviewed:',
  'sourceProfile.filterLabel': 'Filter facts by status',
  'sourceProfile.filterAll': 'All',
  'sourceProfile.filterEmpty': 'No facts match this filter.',
  'sourceProfile.showMore': 'Show more facts',
  'sourceProfile.batchTitle': 'Facts selected for batch confirmation',
  'sourceProfile.batchDescription': 'Review every fact in this visible list before confirming the batch.',
  'sourceProfile.batchConfirm': 'Confirm',
  'sourceProfile.conflictsTitle': 'Conflicts requiring resolution',
  'sourceProfile.conflictsDescription': 'Keep one proposition explicitly or reject a conflicting fact.',
  'sourceProfile.facts': 'facts',
  'sourceProfile.select': 'Select',
  'sourceProfile.selectAll': 'Select all visible',
  'sourceProfile.selectFact': 'Select',
  'sourceProfile.selectGroup': 'Select visible facts in this group',
  'sourceProfile.selectedFact': 'selected fact',
  'sourceProfile.selectedFacts': 'selected facts',
  'sourceProfile.confirmFact': 'Confirm fact',
  'sourceProfile.rejectFact': 'Reject fact',
  'sourceProfile.correctFact': 'Create correction',
  'sourceProfile.correctionLabel': 'Correct this verified fact',
  'sourceProfile.resolveConflict': 'Keep this fact and resolve the conflict',
  'sourceProfile.unsupportedFailure': 'Choose a PDF file. Other Source Document formats are not supported yet.',
  'sourceProfile.unreadableFailure': 'This PDF could not be read. Use a valid text-based resume or LinkedIn PDF.',
  'sourceProfile.extractionFailure': 'Professional facts could not be extracted. Check the service configuration and try again.',
  'sourceProfile.failure': 'The Source Profile action failed. Check the PDF or configuration and try again.',
  'sourceProfile.kind.experience': 'Experience',
  'sourceProfile.kind.skill': 'Skill',
  'sourceProfile.kind.education': 'Education',
  'sourceProfile.kind.language': 'Language',
  'sourceProfile.kind.project': 'Project',
  'sourceProfile.status.extracted': 'Needs review',
  'sourceProfile.status.verified': 'Verified',
  'sourceProfile.status.rejected': 'Rejected',
  'sourceProfile.status.superseded': 'Superseded',
  'jobPosting.title': 'Review your Job Posting',
  'jobPosting.inputLabel': 'Paste the Job Posting',
  'jobPosting.review': 'Review this Job Posting',
  'jobPosting.outgoingLabel': 'Exact Job Posting content sent for extraction',
  'jobPosting.save': 'Save minimized Job Posting',
  'jobPosting.noticeTitle': 'Job Posting processing notice',
  'jobPosting.noticeText': 'Only the Job Posting content shown above is sent to OpenAI in a stateless request with storage disabled. Standard abuse-monitoring retention may still apply.',
  'jobPosting.noticeVersion': 'Notice version:',
  'jobPosting.confirm': 'Confirm Job Posting processing',
  'jobPosting.confirmed': 'Job Posting processing confirmed for this session.',
  'jobPosting.extract': 'Extract Job Requirements',
  'jobPosting.requirementsTitle': 'Review extracted Job Requirements',
  'jobPosting.targetRoleTitle': 'Target role',
  'jobPosting.targetRoleFallback': 'No unambiguous target role was found. The resume will use the localized fallback title.',
  'jobPosting.classification.required': 'Required',
  'jobPosting.classification.preferred': 'Preferred',
  'jobPosting.sourceExcerpt': 'Source excerpt: ',
  'jobPosting.extractionFailure': 'Job Requirements could not be extracted. Review the content and try again.',
  'jobPosting.transportFailure': 'The extraction service could not be reached. Your Job Posting is still available; try again.',
  'jobPosting.failure': 'The Job Posting action failed. Review the content and try again.',
  'matchAnalysis.title': 'Match Score and Gap Analysis',
  'matchAnalysis.action': 'Analyze the match',
  'matchAnalysis.score': 'Match Score',
  'matchAnalysis.lowScoreWarning': 'Your Match Score is below 50%. This is guidance, not an eligibility decision.',
  'matchAnalysis.eligible': 'Your verified and relevant material can support an honest Tailored Resume.',
  'matchAnalysis.denied': 'There is not enough verified, relevant material to support an honest Tailored Resume yet.',
  'matchAnalysis.evidenceTitle': 'Covered Job Requirements and Match Evidence',
  'matchAnalysis.evidenceNone': 'No Job Requirement is supported by a Verified Fact yet.',
  'matchAnalysis.gapTitle': 'Uncovered required Job Requirements',
  'matchAnalysis.gapNone': 'Every required Job Requirement is covered.',
  'matchAnalysis.failure': 'The Match Analysis could not be produced. Review your verified facts and try again.',
  'matchAnalysis.transportFailure': 'The matching service could not be reached. Your verified facts and Job Requirements are still available.',
  'resumeClaims.title': 'Curate your Tailored Resume claims',
  'resumeClaims.description': 'Generate concise claims from your Match Evidence and Verified Facts. Every semantic segment is checked before it is kept.',
  'resumeClaims.generate': 'Generate Resume Claims',
  'resumeClaims.excluded': 'Content that remained unsupported after one isolated rewrite was excluded from your Tailored Resume.',
  'resumeClaims.empty': 'No supported Resume Claim remains. Add and confirm professional information through your Source Profile before trying again.',
  'resumeClaims.moveUp': 'Move up',
  'resumeClaims.moveDown': 'Move down',
  'resumeClaims.remove': 'Remove claim',
  'resumeClaims.reformulationLabel': 'Request a wording change',
  'resumeClaims.reformulate': 'Request reformulation',
  'resumeClaims.noFreeEdit': 'Claims cannot be edited directly. Add new professional information through your Source Profile so it can be verified first.',
  'resumeClaims.failure': 'The Resume Claims action failed. Your verified facts remain available; review them and try again.',
  'resumePreview.title': 'Preview and export',
  'resumePreview.description': 'Review the exact semantic one-page document used for the validated A4 PDF.',
  'resumePreview.preparing': 'Preparing the exact one-page layout…',
  'resumePreview.frameTitle': 'Tailored Resume one-page preview',
  'resumePreview.reduced': 'Lower-priority detail was omitted to preserve a truthful, readable one-page resume.',
  'resumePreview.invalid': 'A truthful resume preview could not be prepared from the retained claims.',
  'resumePreview.photoLabel': 'Optional Candidate photo',
  'resumePreview.photoInclude': 'Include this photo in the preview and PDF',
  'resumePreview.photoPrivacy': 'The photo is disabled by default, kept separately from your Source Profile, and never sent to the writing model.',
  'resumePreview.photoFailure': 'Choose a JPEG, PNG, or WebP image smaller than 2 MB.',
  'resumePreview.download': 'Download validated A4 PDF',
  'resumePreview.fidelityQuestion': 'Is this resume faithful to your professional history?',
  'resumePreview.fidelityFaithful': 'Faithful',
  'resumePreview.fidelityCorrection': 'Needs correction',
  'resumePreview.relevanceQuestion': 'Is this resume relevant to the target role?',
  'resumePreview.relevanceRelevant': 'Relevant',
  'resumePreview.relevanceImprovement': 'Needs improvement',
  'resumePreview.exporting': 'Validating PDF…',
  'resumePreview.downloaded': 'The validated one-page PDF is ready on your device.',
  'resumePreview.controlNotice': 'After download, this PDF is under your control. Store and share it only where you choose.',
  'resumePreview.overflowFailure': 'The retained content does not fit one readable A4 page. Remove a claim or the optional photo and try again.',
  'resumePreview.contentFailure': 'PDF validation found missing or reordered retained content. Nothing was downloaded.',
  'resumePreview.fontFailure': 'The expected fonts could not be embedded. Nothing was downloaded.',
  'resumePreview.pageFailure': 'The export was not exactly one A4 page. Nothing was downloaded.',
  'resumePreview.requestFailure': 'The resume export request was invalid. Review the preview and try again.',
  'resumePreview.provenanceFailure': 'A retained claim is no longer linked to a Verified Fact. Nothing was downloaded.',
  'resumePreview.validationFailure': 'The claim validation service is unavailable. Nothing was downloaded; try again later.',
  'resumePreview.renderFailure': 'The PDF renderer is unavailable. Your preview and verified facts remain in this browser.',
  'operation.analyzeMatch': 'Building your Match Analysis…',
  'operation.extractJobRequirements': 'Extracting Job Requirements…',
  'operation.extractSourceProfile': 'Extracting professional facts…',
  'operation.generateResumeClaims': 'Drafting your Tailored Resume…',
  'operation.importSourceDocument': 'Reading your Source Document…',
  'operation.reformulateResumeClaim': 'Reformulating your Resume Claim…',
  'operation.retry': 'Retry operation',
  'operation.retryJobPosting': 'Retry Job Posting',
  'operation.retryMatchAnalysis': 'Retry Match Analysis',
  'operation.retrySourceProfile': 'Retry Source Profile',
  'operation.retryTailoredResume': 'Retry Tailored Resume',
  'operation.stillWorking': 'Still working. Your content is safe in this browser.',
  'privacy.retention': 'Candidate content you add stays in this browser and expires locally after 24 hours. Downloaded files remain on your device and are outside this automatic expiration.',
  'workflow.title': 'Your workflow',
  'workflow.opened': 'Workflow opened',
  'workflow.openedDescription': 'Your Source Profile is the next step.',
  'workflow.ready': 'Ready to begin',
  'workflow.readyDescription': 'Click “Start tailoring” to begin your workflow.',
  'workflow.sourceProfile': 'Source Profile',
  'workflow.sourceProfileDescription': 'Use your existing resume or career details as the source of truth.',
  'workflow.jobPosting': 'Job Posting',
  'workflow.jobPostingDescription': 'Add the Job Posting you are targeting so we can identify what to highlight.',
  'workflow.matchAnalysis': 'Match Analysis',
  'workflow.matchAnalysisDescription': 'Review evidence, coverage, and gaps before generating your resume.',
  'workflow.tailoredResume': 'Tailored Resume',
  'workflow.tailoredResumeDescription': 'Review a focused resume based only on your approved facts.',
  'workflow.progressLabel': 'Resume Tailoring progress',
  'workflow.completed': 'Completed',
  'workflow.current': 'Current',
  'workflow.unavailable': 'Not available yet',
  'workflow.verifiedFacts': 'verified fact',
  'workflow.requirements': 'Job Requirements',
  'workflow.matchScore': 'Match Score',
  'workflow.resumeClaims': 'Resume Claims ready',
  'value.controlTitle': 'You stay in control',
  'value.controlText': 'Only use information you have reviewed and approved.',
  'value.focusTitle': 'A more focused story',
  'value.focusText': 'Show the most relevant version of your experience.',
  'value.opportunitiesTitle': 'Built for real opportunities',
  'value.opportunitiesText': 'Tailor with confidence, apply with integrity.',
  'notFound.title': 'Page not found',
  'notFound.description': 'The page you requested does not belong to this Resume Tailoring workflow.',
  'notFound.return': 'Return to the workflow',
} as const

type TranslationKey = keyof typeof englishCatalog
type TranslationCatalog = Readonly<Record<TranslationKey, string>>

const frenchCatalog = {
  'brand.homeLabel': "Accueil d'Honest Resume",
  'brand.name': 'Honest Resume',
  'brand.tagline': 'Une manière plus honnête de décrocher un emploi.',
  'locale.english': 'Anglais',
  'locale.french': 'Français',
  'locale.persistenceFailure': "On n'a pas pu enregistrer ta préférence de langue.",
  'locale.unavailable': "La langue de l'interface n'est pas disponible.",
  'locale.switcherLabel': 'Langue',
  'hero.title': 'Adapte ton CV sans rien inventer.',
  'hero.lede': 'Crée un CV ciblé à partir des informations que tu as vérifiées et approuvées.',
  'session.start': "Commencer à adapter mon CV",
  'session.delete': 'Supprimer ma session privée',
  'session.loadFailure': "On n'a pas pu charger ta session privée.",
  'session.openFailure': "On n'a pas pu ouvrir ton parcours. Réessaie.",
  'session.deleteFailure': "On n'a pas pu supprimer ta session privée. Réessaie.",
  'sourceProfile.title': 'Construis ton Profil Source',
  'sourceProfile.importDescription': 'Importe un CV texte ou un PDF LinkedIn. Le document est lu dans ton navigateur.',
  'sourceProfile.fileLabel': 'Choisir un Document Source PDF',
  'sourceProfile.reviewSurfaceTitle': 'Vérifie le Document Source sortant',
  'sourceProfile.detectedTitle': 'Retiré avant le traitement',
  'sourceProfile.detectedNone': "Aucune coordonnée ni information personnelle sensible courante n'a été détectée.",
  'sourceProfile.sensitiveKind.email': 'Adresse e-mail',
  'sourceProfile.sensitiveKind.phone': 'Numéro de téléphone',
  'sourceProfile.sensitiveKind.url': 'Adresse web',
  'sourceProfile.sensitiveKind.address': 'Adresse postale',
  'sourceProfile.sensitiveKind.date-of-birth': 'Date de naissance',
  'sourceProfile.sensitiveKind.personal-information': 'Information personnelle',
  'sourceProfile.outgoingLabel': "Contenu exact envoyé pour l'extraction",
  'sourceProfile.saveContent': 'Enregistrer le contenu minimisé',
  'sourceProfile.noticeTitle': 'Notice de traitement',
  'sourceProfile.noticeText': "Seul le contenu affiché ci-dessus est envoyé à OpenAI dans une requête sans état avec le stockage désactivé. La conservation standard liée à la surveillance des abus peut tout de même s'appliquer.",
  'sourceProfile.noticeVersion': 'Version de la notice :',
  'sourceProfile.confirmNotice': 'Confirmer cette notice de traitement',
  'sourceProfile.noticeConfirmed': 'Notice de traitement confirmée pour cette session.',
  'sourceProfile.extract': 'Extraire les faits professionnels',
  'sourceProfile.factsTitle': 'Vérifie les faits extraits',
  'sourceProfile.reviewProgress': 'Faits vérifiés :',
  'sourceProfile.filterLabel': 'Filtrer les faits par statut',
  'sourceProfile.filterAll': 'Tous',
  'sourceProfile.filterEmpty': 'Aucun fait ne correspond à ce filtre.',
  'sourceProfile.showMore': 'Afficher plus de faits',
  'sourceProfile.batchTitle': 'Faits sélectionnés pour la confirmation groupée',
  'sourceProfile.batchDescription': 'Vérifie chaque fait de cette liste visible avant de confirmer le lot.',
  'sourceProfile.batchConfirm': 'Confirmer',
  'sourceProfile.conflictsTitle': 'Conflits à résoudre',
  'sourceProfile.conflictsDescription': 'Conserve explicitement une proposition ou rejette un fait contradictoire.',
  'sourceProfile.facts': 'faits',
  'sourceProfile.select': 'Sélectionner',
  'sourceProfile.selectAll': 'Sélectionner tous les faits visibles de',
  'sourceProfile.selectFact': 'Sélectionner',
  'sourceProfile.selectGroup': 'Sélectionner les faits visibles de ce groupe',
  'sourceProfile.selectedFact': 'fait sélectionné',
  'sourceProfile.selectedFacts': 'faits sélectionnés',
  'sourceProfile.confirmFact': 'Confirmer le fait',
  'sourceProfile.rejectFact': 'Rejeter le fait',
  'sourceProfile.correctFact': 'Créer la correction',
  'sourceProfile.correctionLabel': 'Corriger ce fait vérifié',
  'sourceProfile.resolveConflict': 'Garder ce fait et résoudre le conflit',
  'sourceProfile.unsupportedFailure': "Choisis un fichier PDF. Les autres formats de Document Source ne sont pas encore pris en charge.",
  'sourceProfile.unreadableFailure': "Ce PDF n'a pas pu être lu. Utilise un CV texte ou un PDF LinkedIn valide.",
  'sourceProfile.extractionFailure': "Les faits professionnels n'ont pas pu être extraits. Vérifie la configuration du service et réessaie.",
  'sourceProfile.failure': "L'action sur le Profil Source a échoué. Vérifie le PDF ou la configuration et réessaie.",
  'sourceProfile.kind.experience': 'Expérience',
  'sourceProfile.kind.skill': 'Compétence',
  'sourceProfile.kind.education': 'Formation',
  'sourceProfile.kind.language': 'Langue',
  'sourceProfile.kind.project': 'Projet',
  'sourceProfile.status.extracted': 'À vérifier',
  'sourceProfile.status.verified': 'Vérifié',
  'sourceProfile.status.rejected': 'Rejeté',
  'sourceProfile.status.superseded': 'Remplacé',
  'jobPosting.title': "Vérifie ton Offre d'emploi",
  'jobPosting.inputLabel': "Colle l'Offre d'emploi",
  'jobPosting.review': "Vérifier cette Offre d'emploi",
  'jobPosting.outgoingLabel': "Contenu exact de l'Offre d'emploi envoyé pour l'extraction",
  'jobPosting.save': "Enregistrer l'Offre d'emploi minimisée",
  'jobPosting.noticeTitle': "Notice de traitement de l'Offre d'emploi",
  'jobPosting.noticeText': "Seul le contenu de l'Offre d'emploi affiché ci-dessus est envoyé à OpenAI dans une requête sans état avec le stockage désactivé. La conservation standard liée à la surveillance des abus peut tout de même s'appliquer.",
  'jobPosting.noticeVersion': 'Version de la notice :',
  'jobPosting.confirm': "Confirmer le traitement de l'Offre d'emploi",
  'jobPosting.confirmed': "Traitement de l'Offre d'emploi confirmé pour cette session.",
  'jobPosting.extract': "Extraire les Exigences de l'Offre",
  'jobPosting.requirementsTitle': "Vérifie les Exigences de l'Offre extraites",
  'jobPosting.targetRoleTitle': 'Poste ciblé',
  'jobPosting.targetRoleFallback': "Aucun poste ciblé non ambigu n'a été trouvé. Le CV utilisera le titre localisé par défaut.",
  'jobPosting.classification.required': 'Obligatoire',
  'jobPosting.classification.preferred': 'Souhaitée',
  'jobPosting.sourceExcerpt': 'Extrait source : ',
  'jobPosting.extractionFailure': "Les Exigences de l'Offre n'ont pas pu être extraites. Vérifie le contenu et réessaie.",
  'jobPosting.transportFailure': "Le service d'extraction est inaccessible. Ton Offre d'emploi est toujours disponible ; réessaie.",
  'jobPosting.failure': "L'action sur l'Offre d'emploi a échoué. Vérifie le contenu et réessaie.",
  'matchAnalysis.title': 'Score de Correspondance et Analyse des Écarts',
  'matchAnalysis.action': 'Analyser la correspondance',
  'matchAnalysis.score': 'Score de Correspondance',
  'matchAnalysis.lowScoreWarning': "Ton Score de Correspondance est inférieur à 50 %. C'est un avertissement, pas une décision d'éligibilité.",
  'matchAnalysis.eligible': 'Tes éléments vérifiés et pertinents peuvent soutenir un CV Adapté honnête.',
  'matchAnalysis.denied': "Il n'y a pas encore assez d'éléments vérifiés et pertinents pour soutenir un CV Adapté honnête.",
  'matchAnalysis.evidenceTitle': 'Exigences couvertes et Preuves de Correspondance',
  'matchAnalysis.evidenceNone': "Aucune Exigence de l'Offre n'est encore soutenue par un Fait Vérifié.",
  'matchAnalysis.gapTitle': "Exigences obligatoires de l'Offre non couvertes",
  'matchAnalysis.gapNone': "Toutes les Exigences obligatoires de l'Offre sont couvertes.",
  'matchAnalysis.failure': "L'Analyse de Correspondance n'a pas pu être produite. Vérifie tes faits confirmés et réessaie.",
  'matchAnalysis.transportFailure': 'Le service de correspondance est inaccessible. Tes faits vérifiés et les Exigences de l’Offre sont toujours disponibles.',
  'resumeClaims.title': 'Compose les affirmations de ton CV Adapté',
  'resumeClaims.description': 'Génère des affirmations concises à partir de tes Preuves de Correspondance et Faits Vérifiés. Chaque segment sémantique est contrôlé avant d’être conservé.',
  'resumeClaims.generate': 'Générer les affirmations du CV',
  'resumeClaims.excluded': 'Le contenu resté non étayé après une reformulation isolée a été exclu de ton CV Adapté.',
  'resumeClaims.empty': 'Aucune affirmation étayée ne reste. Ajoute et confirme les nouvelles informations professionnelles dans ton Profil Source avant de réessayer.',
  'resumeClaims.moveUp': 'Monter',
  'resumeClaims.moveDown': 'Descendre',
  'resumeClaims.remove': 'Supprimer l’affirmation',
  'resumeClaims.reformulationLabel': 'Demander un changement de formulation',
  'resumeClaims.reformulate': 'Demander la reformulation',
  'resumeClaims.noFreeEdit': 'Les affirmations ne sont pas éditables directement. Ajoute toute nouvelle information professionnelle dans ton Profil Source afin de la vérifier d’abord.',
  'resumeClaims.failure': 'L’action sur les affirmations du CV a échoué. Tes faits vérifiés restent disponibles ; vérifie-les et réessaie.',
  'resumePreview.title': 'Aperçu et export',
  'resumePreview.description': 'Relis le document sémantique exact d’une page utilisé pour le PDF A4 validé.',
  'resumePreview.preparing': 'Préparation de la mise en page exacte sur une page…',
  'resumePreview.frameTitle': 'Aperçu une page du CV Adapté',
  'resumePreview.reduced': 'Les détails moins prioritaires ont été omis pour préserver un CV honnête, lisible et limité à une page.',
  'resumePreview.invalid': 'Impossible de préparer un aperçu honnête à partir des affirmations conservées.',
  'resumePreview.photoLabel': 'Photo facultative du Candidat',
  'resumePreview.photoInclude': 'Inclure cette photo dans l’aperçu et le PDF',
  'resumePreview.photoPrivacy': 'La photo est désactivée par défaut, conservée séparément du Profil Source et jamais envoyée au modèle de rédaction.',
  'resumePreview.photoFailure': 'Choisis une image JPEG, PNG ou WebP de moins de 2 Mo.',
  'resumePreview.download': 'Télécharger le PDF A4 validé',
  'resumePreview.fidelityQuestion': 'Ce CV est-il fidèle à ton parcours professionnel ?',
  'resumePreview.fidelityFaithful': 'Fidèle',
  'resumePreview.fidelityCorrection': 'À corriger',
  'resumePreview.relevanceQuestion': 'Ce CV est-il pertinent pour le poste ciblé ?',
  'resumePreview.relevanceRelevant': 'Pertinent',
  'resumePreview.relevanceImprovement': 'À améliorer',
  'resumePreview.exporting': 'Validation du PDF…',
  'resumePreview.downloaded': 'Le PDF validé d’une page est prêt sur ton appareil.',
  'resumePreview.controlNotice': 'Après le téléchargement, ce PDF est sous ton contrôle. Conserve-le et partage-le uniquement où tu le décides.',
  'resumePreview.overflowFailure': 'Le contenu conservé ne tient pas sur une page A4 lisible. Supprime une affirmation ou la photo facultative puis réessaie.',
  'resumePreview.contentFailure': 'La validation du PDF a trouvé du contenu conservé manquant ou réordonné. Aucun fichier n’a été téléchargé.',
  'resumePreview.fontFailure': 'Les polices attendues n’ont pas pu être incorporées. Aucun fichier n’a été téléchargé.',
  'resumePreview.pageFailure': 'L’export ne comporte pas exactement une page A4. Aucun fichier n’a été téléchargé.',
  'resumePreview.requestFailure': 'La demande d’export du CV est invalide. Vérifie l’aperçu puis réessaie.',
  'resumePreview.provenanceFailure': 'Une affirmation conservée n’est plus reliée à un Fait Vérifié. Aucun fichier n’a été téléchargé.',
  'resumePreview.validationFailure': 'Le service de validation des affirmations est indisponible. Aucun fichier n’a été téléchargé ; réessaie plus tard.',
  'resumePreview.renderFailure': 'Le moteur PDF est indisponible. Ton aperçu et tes faits vérifiés restent dans ce navigateur.',
  'operation.analyzeMatch': 'Création de ton Analyse de Correspondance…',
  'operation.extractJobRequirements': "Extraction des Exigences de l'Offre…",
  'operation.extractSourceProfile': 'Extraction des faits professionnels…',
  'operation.generateResumeClaims': 'Rédaction de ton CV Adapté…',
  'operation.importSourceDocument': 'Lecture de ton Document Source…',
  'operation.reformulateResumeClaim': "Reformulation de l'affirmation du CV…",
  'operation.retry': "Réessayer l'opération",
  'operation.retryJobPosting': "Réessayer l'Offre d'emploi",
  'operation.retryMatchAnalysis': "Réessayer l'Analyse de Correspondance",
  'operation.retrySourceProfile': 'Réessayer le Profil Source',
  'operation.retryTailoredResume': 'Réessayer le CV Adapté',
  'operation.stillWorking': 'Le traitement continue. Ton contenu reste en sécurité dans ce navigateur.',
  'privacy.retention': "Le contenu que tu ajoutes reste dans ce navigateur et expire localement après 24 heures. Les fichiers téléchargés restent sur ton appareil et ne sont pas concernés par cette expiration automatique.",
  'workflow.title': 'Ton parcours',
  'workflow.opened': 'Parcours ouvert',
  'workflow.openedDescription': 'Ton Profil Source est la prochaine étape.',
  'workflow.ready': 'Prêt à te lancer',
  'workflow.readyDescription': 'Clique sur « Commencer à adapter mon CV » pour lancer ton parcours.',
  'workflow.sourceProfile': 'Profil Source',
  'workflow.sourceProfileDescription': 'Utilise ton CV actuel ou les détails de ta carrière comme source de vérité.',
  'workflow.jobPosting': "Offre d'emploi",
  'workflow.jobPostingDescription': "Ajoute l'Offre d'emploi que tu vises pour identifier les éléments à mettre en avant.",
  'workflow.matchAnalysis': 'Analyse de Correspondance',
  'workflow.matchAnalysisDescription': 'Vérifie les preuves, la couverture et les écarts avant de générer ton CV.',
  'workflow.tailoredResume': 'CV Adapté',
  'workflow.tailoredResumeDescription': 'Relis un CV ciblé fondé uniquement sur les faits que tu as approuvés.',
  'workflow.progressLabel': "Progression de l'adaptation du CV",
  'workflow.completed': 'Terminé',
  'workflow.current': 'Étape actuelle',
  'workflow.unavailable': 'Pas encore disponible',
  'workflow.verifiedFacts': 'fait vérifié',
  'workflow.requirements': "Exigences de l'Offre",
  'workflow.matchScore': 'Score de Correspondance',
  'workflow.resumeClaims': 'affirmations du CV prêtes',
  'value.controlTitle': 'Tu gardes le contrôle',
  'value.controlText': 'Utilise uniquement les informations que tu as vérifiées et approuvées.',
  'value.focusTitle': 'Un parcours plus ciblé',
  'value.focusText': "Présente la version de ton expérience la plus pertinente.",
  'value.opportunitiesTitle': 'Conçu pour de vraies opportunités',
  'value.opportunitiesText': 'Adapte ton CV en toute confiance et postule avec intégrité.',
  'notFound.title': 'Page introuvable',
  'notFound.description': "La page demandée n'appartient pas à ce parcours d'adaptation de CV.",
  'notFound.return': 'Retourner au parcours',
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

const catalogs: Readonly<Record<Locale, Partial<TranslationCatalog>>> = {
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

function readTranslation({ locale, key }: Readonly<{ locale: Locale; key: TranslationKey }>) {
  const translation = catalogs[locale][key]
  if (translation !== undefined) return translation
  if (import.meta.env.DEV) {
    console.error(`Missing ${locale} translation: ${key}`)
    return `[Missing ${locale} translation: ${key}]`
  }
  return englishCatalog[key]
}

const missingProviderResult = {
  ok: false,
  error: 'provider-missing',
} as const satisfies LocalizationResult
