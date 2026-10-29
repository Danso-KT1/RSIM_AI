import {
  UserProfile,
  Meeting,
  DocumentItem,
  KnowledgeItem,
  GlossaryTerm,
  ProjectItem,
  ActionItem,
  AuditLogEntry,
} from '../types';

export const SEED_USER: UserProfile = {
  id: 'usr_default',
  name: 'Directorate Officer',
  email: 'officer@directorate.gov',
  role: 'Administrator',
  department: 'Research, Statistics & Information Management (RSIM)',
  avatarUrl: '',
};

export const SEED_GLOSSARY: GlossaryTerm[] = [
  {
    id: 'glo_01',
    acronym: 'RSIM',
    fullName: 'Research, Statistics & Information Management',
    definition: 'The Directorate responsible for cross-sector data management, policy research, statistical analysis, and IT documentation within the Ministry.',
    preferredSpelling: 'RSIM Directorate',
    category: 'Directorate Structure',
    relatedTerms: ['MoCDTI', 'Data Governance', 'Civil Service'],
  },
  {
    id: 'glo_02',
    acronym: 'MoCDTI',
    fullName: 'Ministry of Communications, Digital Technology and Innovations',
    definition: 'The central government ministry overseeing telecommunications, digital public goods, postal services, national cybersecurity infrastructure, and technology innovations.',
    preferredSpelling: 'Ministry of Communications, Digital Technology and Innovations (MoCDTI)',
    category: 'Government Ministry',
    relatedTerms: ['RSIM', 'NCA', 'NITA', 'GIFEC'],
  },
  {
    id: 'glo_03',
    acronym: 'NCA',
    fullName: 'National Communications Authority',
    definition: 'Statutory regulatory body overseeing spectrum allocation, telecom licensing, and quality of service benchmarks.',
    preferredSpelling: 'National Communications Authority',
    category: 'Regulator',
    relatedTerms: ['Telecom', 'Spectrum', 'MoCDTI'],
  },
  {
    id: 'glo_04',
    acronym: 'NITA',
    fullName: 'National Information Technology Agency',
    definition: 'Public agency responsible for deploying and regulating national ICT infrastructure and government enterprise architecture.',
    preferredSpelling: 'National Information Technology Agency',
    category: 'ICT Infrastructure',
    relatedTerms: ['Enterprise Architecture', 'E-Governance'],
  },
  {
    id: 'glo_05',
    acronym: 'GIFEC',
    fullName: 'Ghana Investment Fund for Electronic Communications',
    definition: 'Universal service fund entity bridging the digital divide through rural telephony, community ICT hubs, and digital education inclusion.',
    preferredSpelling: 'GIFEC',
    category: 'Digital Inclusion',
    relatedTerms: ['Rural Telephony', 'Connectivity'],
  },
];

export const SEED_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'kb_01',
    title: 'RSIM Directorate Statutory Mandate & Core Functions',
    category: 'Directorate Information',
    content: `The Directorate of Research, Statistics & Information Management (RSIM) operates under the Civil Service Law and statutory administrative instruments as the central empirical engine of the Ministry of Communications, Digital Technology and Innovations (MoCDTI).

CORE MANDATE & FUNCTIONS:
1. Evidence-Based Policymaking: Formulate, coordinate, and review sector policies based on empirical research and national statistical indicators.
2. Sector Data Stewardship: Maintain central repositories of communications statistics, broadband penetration rates, and regulatory compliance data from sector agencies (NCA, NITA, GIFEC).
3. Institutional Quality Assurance: Ensure that all official communications, executive memoranda, cabinet submissions, and technical reports strictly comply with Civil Service drafting protocols.
4. Digital Transformation & Documentation: Oversee institutional knowledge archiving, digital record-keeping, and the integration of artificial intelligence tools for public service efficiency.`,
    summary: 'Statutory authority, policy functions, and data governance role of the RSIM Directorate.',
    source: 'Civil Service Governance Framework & MoCDTI Operational Manual',
    owner: 'Director, RSIM',
    version: '2026.1',
    accessLevel: 'Directorate Only',
    approvalStatus: 'Approved',
    tags: ['Mandate', 'Governance', 'Functions', 'Civil Service'],
    effectiveDate: '2026-01-01',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kb_02',
    title: 'Civil Service Executive Memorandum Writing Protocol',
    category: 'Writing Standards',
    content: `Standardized structure for all internal Memoranda prepared for the Chief Director or Honorable Minister:

1. HEADER BLOCK:
   - TO: The Chief Director / Minister
   - THROUGH: Supervising Director (if routing via intermediate authority)
   - FROM: Director, RSIM Directorate
   - DATE: Official date format (e.g., 6th October 2026)
   - REF. NO: MoCDTI/RSIM/MEMO/[YEAR]/[SEQUENTIAL_NUM] (e.g., MoCDTI/RSIM/MEMO/2026/042)
   - SUBJECT: Written in uppercase, bold, stating precise directive sought.

2. STANDARD SECTIONS:
   1.0 PURPOSE: 1-2 concise sentences defining exactly what directive, approval, or concurrence is being sought.
   2.0 BACKGROUND & OPERATIONAL CONTEXT: Objective recap of the situation, mandate references, and events leading to the memo.
   3.0 KEY OBSERVATIONS & TECHNICAL JUSTIFICATION: Evidence, data points, resource implications, and legal/regulatory conformance.
   4.0 RECOMMENDATIONS & PRAYER: Numbered actionable requests (e.g., "It is respectfully recommended that leadership: a) Approves... b) Directs...").
   - SIGN-OFF: Signature line, official title, and directorate designation.`,
    summary: 'Mandatory structural protocol, section numbering, and reference code format for ministerial memos.',
    source: 'Civil Service Manual of Administrative Procedure',
    owner: 'Head of Quality Assurance',
    version: '2026.2',
    accessLevel: 'Directorate Only',
    approvalStatus: 'Approved',
    tags: ['Memo', 'Writing Standards', 'Drafting', 'Civil Service', 'Reference Codes'],
    effectiveDate: '2026-01-01',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kb_03',
    title: 'Official Ministerial Letter Protocol & Salutations',
    category: 'Writing Standards',
    content: `Guidelines for external correspondence with public institutions, diplomatic missions, and international partners:

1. LETTERHEAD & IDENTIFIERS:
   - Must bear the official Ministry coat of arms / header and Directorate sub-header.
   - Reference format: MoCDTI/RSIM/EXT/[YEAR]/[ID]
   - Full recipient address with official designation preceding institution name.

2. SALUTATION CONVENTIONS:
   - Ministers/Ambassadors: "Honourable Minister,", "Your Excellency,"
   - Chief Directors / Managing Directors: "Dear Sir/Madam," or "Dear [Title] [Last Name],"
   - Formal Opening: "I have the honour to write on behalf of the Ministry of Communications, Digital Technology and Innovations (MoCDTI)..."

3. CLOSING & SIGNATURE:
   - Formal sign-off: "Yours faithfully," (when addressing Dear Sir/Madam) or "Yours sincerely," (when named).
   - Signatory block with name, rank, directorate, and distribution copies (cc).`,
    summary: 'Standard conventions for official letters, external addresses, reference numbering, and diplomatic salutations.',
    source: 'Public Service Code of Conduct & Secretariat Guidelines',
    owner: 'Directorate Secretariat',
    version: '2026.1',
    accessLevel: 'Directorate Only',
    approvalStatus: 'Approved',
    tags: ['Letter', 'Protocol', 'Salutation', 'Formatting'],
    effectiveDate: '2026-01-01',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'kb_04',
    title: 'National Digital Transformation Agenda & Sector KPIs',
    category: 'Policies',
    content: `Strategic milestones and priority indicators guiding the Ministry's current 2025-2027 programmatic cycle:

KEY PERFORMANCE INDICATORS:
- Rural Telephony Expansion: 95% nationwide population connectivity via shared infrastructure.
- Digital Identity Interoperability: Seamless verification across banking, health, and civil registration systems.
- Cybersecurity Readiness: Tier-1 national incident response capability via National Computer Emergency Response Team (CERT).
- Civil Service Automation: 100% electronic paperless document processing across ministerial directorates.
- Open Data Standards: Institutional publication of anonymized public research datasets in machine-readable formats.`,
    summary: 'Strategic national digital policies, connectivity targets, and civil service modernization KPIs.',
    source: 'MoCDTI Strategic Policy Document (2025–2028)',
    owner: 'Policy Planning Division',
    version: '2025.3',
    accessLevel: 'Public',
    approvalStatus: 'Approved',
    tags: ['Policy', 'Digital Transformation', 'KPIs', 'National Agenda'],
    effectiveDate: '2025-01-15',
    createdAt: new Date().toISOString(),
  },
];

export const SEED_PROJECTS: ProjectItem[] = [];
export const SEED_MEETINGS: Meeting[] = [];
export const SEED_ACTION_ITEMS: ActionItem[] = [];
export const SEED_DOCUMENTS: DocumentItem[] = [];
export const SEED_AUDIT_LOGS: AuditLogEntry[] = [];
