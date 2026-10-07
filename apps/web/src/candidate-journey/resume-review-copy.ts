export const resumeReviewCopy = {
  en: {
    previewTitle: 'Tailored resume preview', preview: 'Preview your resume', description: 'Review the document first. Open the editor only when you want to change something.',
    hideEntry: 'Hide experience', restoreEntry: 'Restore experience', print: 'Print current resume', edit: 'Edit resume', close: 'Close editor', contacts: 'Identity and contact details', recovery: 'Restore content',
    order: 'Section order', hidden: 'Hidden content', omitted: 'Source content not included', restore: 'Restore source content',
    emptyRecovery: 'All supported source content is included.', localContacts: 'Identity and contact details stay in your browser and are never sent for professional rewriting.',
    condense: 'Propose a shorter version', changeJobPosting: 'Change job posting', proposal: 'Shorter version proposal',
    proposalDescription: 'Your current resume stays unchanged until you accept this proposal.', accept: 'Accept shorter version', reject: 'Keep current version',
    checking: 'Checking the current document…', validating: 'Checking the edited section…', condensing: 'Preparing a shorter proposal…',
    unchecked: 'Page count has not been checked for this version.', fits: 'The current version fits within two pages. Nothing is deleted: hidden content can be restored from the editor.',
    overflow: 'This version exceeds two pages. Try a shorter proposal, or choose content to hide in the editor. Nothing is deleted: hidden content can be restored from the editor.',
    reviewHidden: 'Review hidden content', hiddenByReduction: 'Hidden to fit the page',
    'value-proposition': 'Summary', experiences: 'Experience', skills: 'Skills', education: 'Education',
    certifications: 'Certifications', languages: 'Languages', projects: 'Projects', analysis: 'Review match analysis',
    saved: 'Resume updated.', hiddenNotice: 'Content hidden from the resume.', restored: 'Content restored.', ordered: 'Order updated.',
    regenerate: 'Regenerate resume', regenerateWarning: 'Regenerating replaces your manual edits. Continue?',
    usability: 'Can you apply with this PDF without restructuring it?', usable: 'Yes, usable as is',
    needsRewriting: 'No, it needs structural rewriting', usabilityRecorded: 'Thank you. Only your answer was recorded, never your resume content.',
  },
  fr: {
    previewTitle: 'Aperçu du CV adapté', preview: 'Aperçu de ton CV', description: 'Relis le document. Ouvre l’éditeur lorsque tu souhaites modifier quelque chose.',
    hideEntry: 'Masquer l’expérience', restoreEntry: 'Restaurer l’expérience', print: 'Imprimer le CV actuel', edit: 'Modifier le CV', close: 'Fermer l’éditeur', contacts: 'Identité et coordonnées', recovery: 'Restaurer du contenu',
    order: 'Ordre des rubriques', hidden: 'Contenu masqué', omitted: 'Contenu source non inclus', restore: 'Restaurer le contenu source',
    emptyRecovery: 'Tout le contenu source attesté est inclus.', localContacts: 'Ton identité et tes coordonnées restent dans ton navigateur et ne sont jamais envoyées pour reformulation professionnelle.',
    condense: 'Proposer une version plus courte', changeJobPosting: 'Changer d’offre d’emploi', proposal: 'Proposition de version courte',
    proposalDescription: 'Ton CV actuel reste inchangé jusqu’à ce que tu acceptes cette proposition.', accept: 'Accepter la version courte', reject: 'Garder la version actuelle',
    checking: 'Vérification du document actuel…', validating: 'Vérification de la rubrique modifiée…', condensing: 'Préparation d’une proposition plus courte…',
    unchecked: 'Le nombre de pages de cette version n’a pas été vérifié.', fits: 'La version actuelle tient sur deux pages maximum. Rien n’est supprimé : le contenu masqué se restaure depuis l’éditeur.',
    overflow: 'Cette version dépasse deux pages. Essaie une proposition plus courte ou choisis le contenu à masquer dans l’éditeur. Rien n’est supprimé : le contenu masqué se restaure depuis l’éditeur.',
    reviewHidden: 'Voir le contenu masqué', hiddenByReduction: 'Masqué pour tenir sur la page',
    'value-proposition': 'Profil', experiences: 'Expérience', skills: 'Compétences', education: 'Formation',
    certifications: 'Certifications', languages: 'Langues', projects: 'Projets', analysis: 'Consulter l’analyse de correspondance',
    saved: 'CV mis à jour.', hiddenNotice: 'Contenu masqué dans le CV.', restored: 'Contenu restauré.', ordered: 'Ordre mis à jour.',
    regenerate: 'Régénérer le CV', regenerateWarning: 'La régénération remplace tes modifications manuelles. Continuer ?',
    usability: 'Peux-tu candidater avec ce PDF sans le restructurer ?', usable: 'Oui, utilisable tel quel',
    needsRewriting: 'Non, il doit être restructuré', usabilityRecorded: 'Merci. Seule ta réponse a été enregistrée, jamais le contenu de ton CV.',
  },
} as const

export type ResumeReviewCopy = typeof resumeReviewCopy[keyof typeof resumeReviewCopy]

type OverflowReduction = Readonly<{ locale: keyof typeof resumeReviewCopy; achievements: number; other: number; pageCount: 1 | 2 }>

/** The summary above the preview of the Hidden Content Overflow Reduction produced, or null when it hid nothing. */
export function describeOverflowReduction({ locale, achievements, other, pageCount }: OverflowReduction) {
  if (achievements + other === 0) return null
  return locale === 'fr' ? describeInFrench({ achievements, other, pageCount }) : describeInEnglish({ achievements, other, pageCount })
}

function describeInEnglish({ achievements, other, pageCount }: Omit<OverflowReduction, 'locale'>) {
  const achievementText = `${String(achievements)} ${achievements === 1 ? 'achievement' : 'achievements'}`
  const otherText = `${String(other)} ${achievements > 0 ? 'other ' : ''}${other === 1 ? 'item' : 'items'}`
  const counted = [achievements > 0 ? achievementText : null, other > 0 ? otherText : null].filter(Boolean).join(' and ')
  return `${counted} hidden to fit ${pageCount === 1 ? 'one page' : 'two pages'}.`
}

function describeInFrench({ achievements, other, pageCount }: Omit<OverflowReduction, 'locale'>) {
  const achievementText = `${String(achievements)} ${achievements === 1 ? 'réalisation' : 'réalisations'}`
  const otherText = `${String(other)} ${achievements > 0 ? (other === 1 ? 'autre ' : 'autres ') : ''}${other === 1 ? 'élément' : 'éléments'}`
  const counted = [achievements > 0 ? achievementText : null, other > 0 ? otherText : null].filter(Boolean).join(' et ')
  // A count of achievements alone agrees in the feminine; any mention of « élément » makes the participle masculine.
  const hidden = other > 0 ? (achievements + other === 1 ? 'masqué' : 'masqués') : (achievements === 1 ? 'masquée' : 'masquées')
  return `${counted} ${hidden} pour tenir sur ${pageCount === 1 ? 'une page' : 'deux pages'}.`
}
