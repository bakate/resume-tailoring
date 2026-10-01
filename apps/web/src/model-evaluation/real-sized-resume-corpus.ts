import type { JobMatch, JobRequirement } from '@resume-tailoring/application/job-match'
import type { ResumeSectionsRequest } from '@resume-tailoring/application/resume-preparation'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'

/**
 * Anonymized real-sized resume: a twelve-year platform engineering career with seven experiences, shaped like
 * the production request that timed out (BAK-67). Organizations are fictitious sample names; no Candidate content
 * from production is reproduced.
 */
const sourceProfile = {
  experiences: [
    { role: 'Staff Platform Engineer', organization: 'Fabrikam Payments', startDate: '2022', endDate: 'Present',
      context: 'Card-processing platform serving 40 million monthly transactions across 12 European markets',
      achievements: [
        'Led the migration of 140 services from self-managed virtual machines to Kubernetes on AWS over 18 months',
        'Designed a multi-region active-active deployment that cut recovery time from 4 hours to 12 minutes',
        'Introduced service level objectives and error budgets for 30 payment-critical services',
        'Built a Terraform module catalogue adopted by 22 product teams, replacing hand-written infrastructure',
        'Reduced monthly cloud spend by 31 percent through rightsizing, spot capacity and storage lifecycle rules',
        'Mentored six engineers, two of whom were promoted to senior platform engineer',
      ] },
    { role: 'Senior Site Reliability Engineer', organization: 'Contoso Logistics', startDate: '2019', endDate: '2022',
      context: 'Route-planning and fleet-tracking platform for 3,000 delivery vehicles',
      achievements: [
        'Owned the on-call rotation and incident review process for the tracking platform',
        'Cut the mean time to detect production incidents from 25 to 6 minutes with Prometheus and Grafana alerting',
        'Automated PostgreSQL failover and backup verification, removing a weekly manual procedure',
        'Rebuilt the continuous delivery pipeline in GitLab CI, taking deployment frequency from weekly to daily',
        'Wrote the runbooks and chaos experiments used to prepare the platform for peak season traffic',
      ] },
    { role: 'DevOps Engineer', organization: 'Northwind Health', startDate: '2017', endDate: '2019',
      context: 'Patient scheduling software subject to healthcare data protection audits',
      achievements: [
        'Containerized the scheduling monolith with Docker and introduced blue-green releases',
        'Implemented infrastructure as code with Ansible and Terraform for three hosting environments',
        'Prepared the technical evidence for two successful ISO 27001 surveillance audits',
        'Centralized application logs in the Elastic Stack and defined retention rules with the security team',
      ] },
    { role: 'Software Engineer', organization: 'Tailspin Travel', startDate: '2015', endDate: '2017',
      context: 'Booking engine for regional airlines',
      achievements: [
        'Developed fare-search APIs in Java and Spring Boot handling 800 requests per second at peak',
        'Introduced contract tests between the booking engine and partner airline systems',
        'Moved nightly batch reconciliation to a message queue, reducing reconciliation delays from hours to minutes',
      ] },
    { role: 'Systems Administrator', organization: 'Woodgrove Bank', startDate: '2013', endDate: '2015',
      context: 'Branch and back-office infrastructure for a retail bank',
      achievements: [
        'Administered 250 Linux and Windows servers across two data centres',
        'Scripted server provisioning in Bash and PowerShell, cutting setup time from two days to two hours',
        'Coordinated quarterly disaster recovery tests with the business continuity team',
      ] },
    { role: 'IT Support Technician', organization: 'Litware Consulting', startDate: '2012', endDate: '2013',
      context: null,
      achievements: [
        'Supported 300 consultants on hardware, network and collaboration tools',
        'Documented recurring incidents in a knowledge base used by the service desk',
      ] },
    { role: 'Infrastructure Intern', organization: 'Adventure Works', startDate: '2011', endDate: '2012',
      context: 'Final-year engineering internship',
      achievements: ['Built an inventory of virtual machines and their owners to support a data centre consolidation'] },
  ],
  skills: [
    ['Cloud', 'AWS'], ['Cloud', 'Kubernetes'], ['Cloud', 'Docker'], ['Cloud', 'Helm'],
    ['Infrastructure as code', 'Terraform'], ['Infrastructure as code', 'Ansible'],
    ['Observability', 'Prometheus'], ['Observability', 'Grafana'], ['Observability', 'Elastic Stack'],
    ['Observability', 'OpenTelemetry'], ['Delivery', 'GitLab CI'], ['Delivery', 'GitHub Actions'],
    ['Delivery', 'Argo CD'], ['Programming', 'Go'], ['Programming', 'Python'], ['Programming', 'Java'],
    ['Programming', 'Bash'], ['Data', 'PostgreSQL'], ['Data', 'Kafka'], ['Data', 'Redis'],
    ['Practices', 'Incident management'], ['Practices', 'Service level objectives'], ['Practices', 'Chaos engineering'],
  ].map(([category = '', name = '']) => ({ category, name })),
  education: [
    { qualification: 'Master of Engineering in Computer Systems', institution: 'Graduate School of Engineering' },
    { qualification: 'Bachelor of Science in Computer Science', institution: 'University of Applied Sciences' },
  ],
  languages: [
    { name: 'French', proficiency: 'Native' }, { name: 'English', proficiency: 'Fluent' },
    { name: 'German', proficiency: 'Intermediate' },
  ],
  projects: [
    { name: 'Open-source Terraform provider', description: 'Maintainer of a provider for an internal secrets manager, 400 GitHub stars' },
    { name: 'Platform engineering meetup', description: 'Co-organizer of a quarterly local meetup with 600 members' },
  ],
  certifications: [
    { name: 'Certified Kubernetes Administrator', issuer: 'Cloud Native Computing Foundation', issuedAt: '2021' },
    { name: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', issuedAt: '2022' },
  ],
}

const jobPostingContent = [
  'Principal Platform Engineer — Cloud Infrastructure',
  'We are looking for a Principal Platform Engineer to lead the evolution of our cloud platform.',
  'You will own our Kubernetes platform on AWS and the infrastructure-as-code standards used by every product team.',
  'Strong experience with Terraform and GitOps delivery is required.',
  'You will define service level objectives and lead incident response for business-critical services.',
  'Experience building observability with Prometheus, Grafana or OpenTelemetry is expected.',
  'You will drive cloud cost optimization and capacity planning.',
  'Mentoring engineers and influencing technical direction across teams is a core part of the role.',
  'Experience in regulated industries such as payments or healthcare is a plus.',
  'Familiarity with service mesh technologies such as Istio is a plus.',
].join('\n')

const candidateFacts: readonly CandidateFact[] = Object.entries(sourceProfile).flatMap(([section, entries]) =>
  (entries as readonly Readonly<Record<string, string | readonly string[] | null>>[]).flatMap((entry, entryIndex) =>
    Object.entries(entry).flatMap(([field, rawValue]) => (Array.isArray(rawValue) ? rawValue : [rawValue])
      .flatMap((value: string | null, valueIndex) => value === null || value.length === 0 ? [] : [{
        id: `source-fact-${section}-${String(entryIndex)}-${field}-${String(valueIndex)}` as const,
        path: `${section}.${String(entryIndex)}.${field}.${String(valueIndex)}`,
        status: 'attested' as const, value }]))))

function requirement({ id, value, sourceExcerpt, importance, dimension }: Readonly<{
  id: string; value: string; sourceExcerpt: string; importance: JobRequirement['importance']
  dimension: JobRequirement['capability']['dimension']
}>): JobRequirement {
  return { id: `job-requirement-${id}`, value, sourceExcerpt, importance, importanceRationale: 'Stated in the Job Posting',
    capability: { dimension, name: value } }
}

const requirements = [
  requirement({ id: 'kubernetes-aws', value: 'Kubernetes platform on AWS', importance: 'critical', dimension: 'technical-expertise',
    sourceExcerpt: 'You will own our Kubernetes platform on AWS' }),
  requirement({ id: 'terraform', value: 'Terraform', importance: 'critical', dimension: 'technical-expertise',
    sourceExcerpt: 'Strong experience with Terraform and GitOps delivery is required.' }),
  requirement({ id: 'gitops', value: 'GitOps delivery', importance: 'central', dimension: 'execution',
    sourceExcerpt: 'Strong experience with Terraform and GitOps delivery is required.' }),
  requirement({ id: 'slo', value: 'Service level objectives', importance: 'central', dimension: 'operational-risk',
    sourceExcerpt: 'You will define service level objectives' }),
  requirement({ id: 'incident-response', value: 'Incident response leadership', importance: 'central', dimension: 'operational-risk',
    sourceExcerpt: 'lead incident response for business-critical services' }),
  requirement({ id: 'observability', value: 'Observability with Prometheus, Grafana or OpenTelemetry', importance: 'central',
    dimension: 'technical-expertise', sourceExcerpt: 'Experience building observability with Prometheus, Grafana or OpenTelemetry is expected.' }),
  requirement({ id: 'cost', value: 'Cloud cost optimization', importance: 'central', dimension: 'ownership',
    sourceExcerpt: 'You will drive cloud cost optimization and capacity planning.' }),
  requirement({ id: 'mentoring', value: 'Mentoring engineers', importance: 'central', dimension: 'leadership',
    sourceExcerpt: 'Mentoring engineers and influencing technical direction across teams is a core part of the role.' }),
  requirement({ id: 'regulated', value: 'Regulated industry experience', importance: 'complementary', dimension: 'operational-risk',
    sourceExcerpt: 'Experience in regulated industries such as payments or healthcare is a plus.' }),
  requirement({ id: 'service-mesh', value: 'Service mesh such as Istio', importance: 'complementary', dimension: 'technical-expertise',
    sourceExcerpt: 'Familiarity with service mesh technologies such as Istio is a plus.' }),
] as const

const evidence: JobMatch['analysis']['evidence'] = [
  { requirementId: 'job-requirement-kubernetes-aws', coverage: 'covered', factIds: ['source-fact-experiences-0-achievements-0', 'source-fact-skills-1-name-0'] },
  { requirementId: 'job-requirement-terraform', coverage: 'covered', factIds: ['source-fact-experiences-0-achievements-3', 'source-fact-experiences-2-achievements-1'] },
  { requirementId: 'job-requirement-gitops', coverage: 'partially-covered', factIds: ['source-fact-skills-12-name-0'] },
  { requirementId: 'job-requirement-slo', coverage: 'covered', factIds: ['source-fact-experiences-0-achievements-2'] },
  { requirementId: 'job-requirement-incident-response', coverage: 'covered', factIds: ['source-fact-experiences-1-achievements-0'] },
  { requirementId: 'job-requirement-observability', coverage: 'covered', factIds: ['source-fact-experiences-1-achievements-1'] },
  { requirementId: 'job-requirement-cost', coverage: 'covered', factIds: ['source-fact-experiences-0-achievements-4'] },
  { requirementId: 'job-requirement-mentoring', coverage: 'covered', factIds: ['source-fact-experiences-0-achievements-5'] },
  { requirementId: 'job-requirement-regulated', coverage: 'covered', factIds: ['source-fact-experiences-0-context-0', 'source-fact-experiences-2-context-0'] },
]

const jobMatch: JobMatch = {
  analysis: {
    adjacentEvidence: [{ requirementId: 'job-requirement-service-mesh', factIds: ['source-fact-skills-3-name-0'] }],
    criticalRequirementReserve: { requirementIds: [], status: 'clear' },
    evidence, generationEligibility: 'eligible', matchBand: 'strong', matchBandQualification: null, matchScore: 88,
    relevantFactIds: [...new Set(evidence.flatMap(({ factIds }) => factIds))], requirementGroups: [],
  },
  jobPosting: { kind: 'pasted-text', name: 'principal-platform-engineer.txt', originalContent: jobPostingContent },
  practicalConstraints: [],
  priorityGapRequirementIds: [],
  requirements,
  strengthRequirementIds: evidence.flatMap(({ coverage, requirementId }) => coverage === 'covered' ? [requirementId] : []),
  targetRole: { value: 'Principal Platform Engineer', sourceExcerpt: 'Principal Platform Engineer — Cloud Infrastructure' },
}

export const realSizedResumeFixture = {
  id: 'real-sized-platform-engineer-v1',
  request: { candidateFacts, jobMatch, locale: 'en', purpose: 'tailored' },
} as const satisfies Readonly<{ id: string; request: ResumeSectionsRequest }>
