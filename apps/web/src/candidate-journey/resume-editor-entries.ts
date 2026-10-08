import type { ResumeSectionName, TailoredResume } from '@resume-tailoring/application/tailored-resume'
import { readResumeFields } from './tailored-resume-editing'
import type { ResumeFieldReference } from './tailored-resume-editing'

/** What a field holds, which its label names: Role, Employer, Start, End, Key point… */
export type ResumeFieldKind = 'paragraph' | 'role' | 'organization' | 'startDate' | 'endDate' | 'location' | 'context'
  | 'achievement' | 'category' | 'skill' | 'item'

/** A field's label: its kind, numbered when the entry holds several fields of that kind. */
export type ResumeFieldLabel = Readonly<{ kind: ResumeFieldKind; position: number | null }>

/**
 * One unit the editor saves at once: the summary, one experience, one skill group or one other section. `name` tells
 * entries of the same section apart, and is null when the section holds a single entry.
 */
export type EditorEntry = Readonly<{
  id: string
  section: ResumeSectionName
  name: string | null
  fields: readonly Readonly<{ reference: ResumeFieldReference; label: ResumeFieldLabel }>[]
}>

/** The sections in the order the resume shows them, sections the Candidate never moved after the ones they did. */
export function readEditorSections({ resume }: Readonly<{ resume: TailoredResume }>): readonly ResumeSectionName[] {
  const defaultOrder: readonly ResumeSectionName[] = ['value-proposition', 'experiences', ...resume.sections.map(({ section }) => section)]
  return [...new Set([...(resume.sectionOrder ?? []), ...defaultOrder])]
}

export function readEditorEntries({ resume }: Readonly<{ resume: TailoredResume }>): readonly EditorEntry[] {
  const references = readResumeFields({ resume })
  return readEditorSections({ resume }).flatMap((section) => {
    if (section === 'experiences') return distinguish(resume.experiences.map((experience, index) => entry({ section,
      id: `experience:${experience.id}`,
      name: [experience.role?.text, experience.organization?.text].filter(Boolean).join(' · ') || String(index + 1),
      references: references.filter(({ location }) => location.kind === 'experience' && location.experienceId === experience.id) })))
    if (section === 'skills') {
      const skills = resume.sections.find((content) => content.section === 'skills')
      const groups = skills?.section === 'skills' ? skills.groups : []
      return distinguish(groups.map((group, index) => entry({ section, id: `skill-group:${group.id}`,
        name: group.category?.text ?? String(index + 1),
        references: references.filter(({ location }) => location.kind === 'skill-group' && location.groupId === group.id) })))
    }
    const fields = references.filter(({ location }) => section === 'value-proposition' ? location.kind === 'value-proposition'
      : location.kind === 'section' && location.section === section)
    if (fields.length === 0) return []
    return [entry({ section, id: section === 'value-proposition' ? section : `section:${section}`, name: null, references: fields })]
  })
}

function entry({ id, name, references, section }: Readonly<{
  id: string; name: string | null; references: readonly ResumeFieldReference[]; section: ResumeSectionName
}>): EditorEntry {
  const kinds = references.map(readFieldKind)
  return { id, section, name, fields: references.map((reference, index) => {
    const kind = kinds[index] ?? 'item'
    const repeated = kinds.filter((other) => other === kind).length > 1 || kind === 'achievement' || kind === 'skill'
    return { reference, label: { kind, position: repeated ? kinds.slice(0, index + 1).filter((other) => other === kind).length : null } }
  }) }
}

/** Entries of one section that would read the same are numbered, so every field label stays unique. */
function distinguish(entries: readonly EditorEntry[]): readonly EditorEntry[] {
  return entries.map((current, index) => {
    const twins = entries.filter(({ name }) => name === current.name)
    if (twins.length === 1) return current
    return { ...current, name: `${current.name ?? ''} (${String(entries.slice(0, index + 1).filter(({ name }) => name === current.name).length)})` }
  })
}

function readFieldKind({ location }: ResumeFieldReference): ResumeFieldKind {
  if (location.kind === 'value-proposition') return 'paragraph'
  if (location.kind === 'section') return 'item'
  if (location.kind === 'skill-group') return location.fieldName === 'category' ? 'category' : 'skill'
  return location.fieldName === 'achievements' ? 'achievement' : location.fieldName
}
