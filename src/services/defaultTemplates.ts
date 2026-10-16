import { UserTemplate, KnowledgeItem, GlossaryTerm } from '../types';

export const DEFAULT_TEMPLATES: UserTemplate[] = [
  // ── 1. Meeting Minutes: Executive Institutional Standard ─────────────────
  {
    id: 'tpl_def_min_01',
    title: 'Executive Meeting Minutes Template',
    name: 'Executive Meeting Minutes Template',
    documentType: 'Minutes',
    category: 'minutes',
    source: 'built_in',
    summary: 'Official Civil Service standard meeting minutes template with attendance, agenda, detailed proceedings, resolutions, and action matrix.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS AND INFORMATION MANAGEMENT (RSIM)

## OFFICIAL MINUTES OF PROCEEDINGS

**Meeting Title:** Institutional Steering & Technical Working Group Review
**Date:** {DATE}
**Time:** 10:00 AM - 12:45 PM GMT
**Venue:** Directorate Conference Room / Hybrid Video Conference
**Chairperson:** Director, RSIM Directorate

---

### 1. ATTENDANCE & OPENING
- **Chairperson:** Director, Directorate of Research, Statistics & Information Management
- **Members Present:** Assistant Director (Statistics), Senior IT Specialist, Representative from NCA, Representative from NITA, Secretariat Rapporteur
- **In Attendance:** Senior Planning Officer, Directorate Technical Assistants
- **Apologies Received:** Chief Director (Official National Assignment)

The Chairperson formally called the meeting to order at 10:05 AM with an opening reflection and welcomed all distinguished members and agency partners.

### 2. ADOPTION OF THE AGENDA
The provisional agenda was considered, revised, and formally adopted as follows:
1. Review and confirmation of previous meeting minutes
2. Matters arising from previous resolutions
3. Presentation and deliberation on substantive technical agenda items
4. Statutory deadlines and inter-agency deliverables
5. Any other business (A.O.B.)
6. Adjournment and date for next quarterly review

### 3. SUBSTANTIVE DELIBERATIONS & MATTERS ARISING
- **Matters Arising:** The Secretariat confirmed that all action items from the previous session were tracked, with 85% milestones achieved within the stipulated timeframe.
- **Substantive Agenda Deliberations:** The members reviewed empirical findings, operational bottlenecks, policy directives, and stakeholder feedback as captured in the proceedings transcript.
- **Inter-Agency Harmonization:** Participating regulatory bodies agreed upon standardized data exchange protocols and security baselines.

### 4. ACTION ITEMS & RESOLUTIONS MATRIX
| Item # | Agreed Action Item / Resolution | Responsible Officer / Agency | Target Deadline | Verification Milestone |
|---|---|---|---|---|
| 01 | Finalize and circulate technical guidelines | Senior Technical Lead | 10 Working Days | Draft circulated |
| 02 | Collate quarterly agency statistical returns | Assistant Director (Statistics) | 14 Working Days | Consolidated report |
| 03 | Convene executive stakeholder briefing | Directorate Secretariat | 21 Working Days | Meeting scheduled |

### 5. ADJOURNMENT
There being no further business, the meeting was adjourned at 12:45 PM following a motion moved and seconded.

**Minutes Prepared By:** Directorate Secretariat  
**Minutes Approved By:** Director, RSIM Directorate`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 2. Meeting Minutes: Technical Working Group ───────────────────────────
  {
    id: 'tpl_def_min_02',
    title: 'Technical Working Group (TWG) Minutes Template',
    name: 'Technical Working Group (TWG) Minutes Template',
    documentType: 'Minutes',
    category: 'minutes',
    source: 'built_in',
    summary: 'Technical committee minutes layout focused on systems architecture, data interoperability, and project milestone approvals.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION

## TECHNICAL WORKING GROUP (TWG) MEETING MINUTES

**Committee:** National Data Interoperability & Digital Architecture TWG  
**Session Ref:** MoCD/RSIM/TWG/{YEAR}/03  
**Date:** {DATE}  
**Convenor:** RSIM Directorate  

---

### 1. SESSION OVERVIEW & ATTENDANCE
- **Technical Lead:** Head of Information Systems & Digital Services
- **Participating Entities:** NITA, NCA, Data Protection Commission (DPC), Technical Consultants
- **Quorum:** Formally constituted with technical representatives from all mandated agencies.

### 2. TECHNICAL SPECIFICATIONS & PROCEEDINGS
- **Architectural Review:** Deep-dive examination of system interoperability, API endpoints, and authentication tokens.
- **Security & Data Compliance:** Evaluation of compliance with the Data Protection Act (Act 843) and ministerial encryption standards.
- **Integration Test Results:** Review of benchmark results from pilot agency data synchronization exercises.

### 3. TECHNICAL DECISIONS & MILESTONES
1. Approved schema definition v2.4 for civil service departmental returns.
2. Mandated automated error logging and real-time terminal auditing for data ingestion pipelines.
3. Scheduled joint end-to-end load testing for all connected agencies.

### 4. TECHNICAL ACTION REGISTER
| Task ID | Action Item | Assigned Engineer / Team | Delivery Date | Status |
|---|---|---|---|---|
| TWG-01 | Deploy API gateway staging endpoints | Lead DevOps Engineer | 5 Days | In Progress |
| TWG-02 | Review token authentication security | Cybersecurity Analyst | 7 Days | Scheduled |
| TWG-03 | Draft technical compliance briefing | TWG Rapporteur | 10 Days | Pending |

**Recorded By:** Lead Technical Rapporteur  
**Confirmed By:** Chairperson, Technical Working Group`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 3. Google Drive Verified Template: Stakeholder Engagement Report (Data Harmonisation) ──
  {
    id: 'tpl_gdrive_stakeholder_01',
    title: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026',
    name: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026',
    documentType: 'Report',
    category: 'reports',
    source: 'google_drive',
    driveSource: {
      fileId: 'demo_gdrive_stakeholder_rep_01',
      fileName: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026.docx',
      provider: 'google_drive',
      syncedAt: new Date().toISOString(),
    },
    summary: 'Official Google Drive template for Stakeholder Engagement Reports (Data Harmonisation) featuring 3-section narrative civil service structure, Times New Roman typography, zero minutes metadata.',
    templateSpec: {
      id: 'spec_stakeholder_01',
      name: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026',
      title: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026',
      documentType: 'Report',
      sections: [
        { id: 'sec_1', order: 1, title: '1.0 EXECUTIVE SUMMARY & ENGAGEMENT OVERVIEW' },
        { id: 'sec_2', order: 2, title: '2.0 THEMATIC DELIBERATIONS & REGULATORY POSITIONS' },
        { id: 'sec_3', order: 3, title: '3.0 AGREED ACTION POINTS, RECOMMENDATIONS & WAY FORWARD' },
      ],
      formatting: {
        fontFamily: 'Times New Roman',
        titleFontSize: '16pt bold',
        headingFontSize: '13pt bold',
        bodyFontSize: '12pt',
        lineSpacing: '1.15',
        textAlignment: 'justify',
      },
      detectedFont: 'Times New Roman',
      detectedFontSize: '12pt',
      tables: [],
    },
    learnedKnowledge: {
      keySections: [
        '1.0 EXECUTIVE SUMMARY & ENGAGEMENT OVERVIEW',
        '2.0 THEMATIC DELIBERATIONS & REGULATORY POSITIONS',
        '3.0 AGREED ACTION POINTS, RECOMMENDATIONS & WAY FORWARD',
      ],
      formatting: { font: 'Times New Roman', fontSize: '12pt' },
    },
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
RESEARCH, STATISTICS AND INFORMATION MANAGEMENT (RSIM) DIRECTORATE

STAKEHOLDER ENGAGEMENT REPORT: THE DATA HARMONISATION MEETING 2026

1.0 EXECUTIVE SUMMARY & ENGAGEMENT OVERVIEW
The Ministry of Communications and Digitalisation, through the Directorate of Research, Statistics and Information Management (RSIM), convened a high-level Stakeholder Engagement Session on National Data Harmonisation and Inter-Agency Interoperability. The overarching objective of the session was to foster institutional synergy, evaluate ongoing data integration frameworks, address systemic data silos across public regulatory bodies, and establish enforceable data exchange protocols across the sector.

2.0 THEMATIC DELIBERATIONS & REGULATORY POSITIONS
2.1 Overview of Strategic Interventions and Agency Presentations
During the thematic plenary deliberations, key participating institutions and sector regulators presented empirical status updates on their respective digital registers, API frameworks, and statutory reporting mechanisms. Deliberations centered on the imperative for centralized data validation, uniform metadata standards, and real-time synchronization between the Ministry and external agencies.

2.2 Key Issues, Technical Constraints and Regulatory Alignment
Stakeholders critically reviewed operational bottlenecks, including disparities in data classification formats, legacy software incompatibility, intermittent network latency in regional verification units, and compliance obligations under statutory data protection frameworks. Consensus was reached that institutional coordination must be prioritized over bilateral ad-hoc exchanges.

3.0 AGREED ACTION POINTS, RECOMMENDATIONS & WAY FORWARD
Following consultative deliberations, stakeholders unanimously resolved on the following strategic action roadmap:
1. Immediate operationalization of standardized API endpoints and synchronized data definitions across all sector agencies.
2. Formulation of a joint Technical Working Group (TWG) to oversee data quality compliance, verification audit trails, and weekly returns.
3. Submission of finalized regulatory data returns to the RSIM Directorate within the stipulated fourteen (14) working day compliance window.

____________________________________________
Director, RSIM Directorate
Ministry of Communications and Digitalisation`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 4. Executive Report: Institutional Performance & Policy ──────────────
  {
    id: 'tpl_def_rep_01',
    title: 'Directorate Performance & Policy Report Template',
    name: 'Directorate Performance & Policy Report Template',
    documentType: 'Report',
    category: 'reports',
    source: 'built_in',
    summary: 'High-level civil service institutional report with executive summary, statutory priorities, methodology, empirical findings, and policy recommendations.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS & INFORMATION MANAGEMENT (RSIM)

## INSTITUTIONAL PERFORMANCE & POLICY EVALUATION REPORT

**Document Ref:** MoCD/RSIM/REP/{YEAR}/01  
**Reporting Period:** Comprehensive Strategic Review  
**Authoring Unit:** Directorate of Research, Statistics & Information Management  
**Submitted To:** The Chief Director & Sector Minister  

---

## 1. EXECUTIVE SUMMARY
This comprehensive report outlines the operational performance, statistical benchmarking, and policy research initiatives executed by the Directorate within the designated reporting cycle. Synthesizing empirical proceedings, stakeholder deliberations, and administrative data, this document presents definitive recommendations for ministerial policy formulation and execution.

## 2. STATUTORY MANDATE & STRATEGIC CONTEXT
In accordance with Civil Service operational frameworks, the RSIM Directorate operates as the central empirical and analytical organ of the Ministry, tasked with:
- Spearheading sector-wide statistical data stewardship and monitoring
- Evaluating policy compliance across regulatory and statutory agencies
- Institutionalizing modern digital workflows and AI-driven document intelligence

## 3. METHODOLOGY & EVIDENCE BASE
The findings and strategic evaluations contained herein are derived from:
1. Systematic analysis of stakeholder meeting proceedings and recorded transcripts
2. Field monitoring returns and verified data submissions from sector agencies
3. Cross-sectional statistical indicators compiled in conformity with national standards

## 4. KEY FINDINGS & OPERATIONAL HIGHLIGHTS
- **Workflow Efficiency Gains:** Significant acceleration in document turnaround times and administrative throughput.
- **Inter-Agency Harmonization:** High degree of convergence on reporting formats, security protocols, and verification metrics.
- **Identified Gaps & Vulnerabilities:** Specific resource, connectivity, and capacity constraints noted during regional monitoring.

## 5. STRATEGIC CHALLENGES & MITIGATION MEASURES
| Challenge Identified | Impact on Operations | Proposed Mitigation Strategy | Lead Directorate |
|---|---|---|---|
| Infrastructure & connectivity variance | Delayed statistical submissions | Offline-first digital architectures | RSIM / NITA |
| Standardized reporting compliance | Formatting discrepancies | Uniform template adoption | RSIM Directorate |

## 6. RECOMMENDATIONS FOR EXECUTIVE ACTION
It is respectfully recommended that leadership:
1. Approve the implementation directives outlined in Section 4.
2. Instruct all sector agencies to align data submissions with the harmonized template standards.
3. Authorize the requisite technical and logistical support for continuous operational monitoring.

**Respectfully Submitted By:**  
Director, RSIM Directorate  
Ministry of Communications and Digitalisation`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 4. Executive Report: Field Inspection & Monitoring ────────────────────
  {
    id: 'tpl_def_rep_02',
    title: 'Technical Field Inspection & Monitoring Report',
    name: 'Technical Field Inspection & Monitoring Report',
    documentType: 'Report',
    category: 'reports',
    source: 'built_in',
    summary: 'Executive technical inspection report template detailing field observations, facility conditions, hardware/software status, and corrective action roadmaps.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION

## TECHNICAL MONITORING & FIELD INSPECTION REPORT

**Inspection Mission:** Regional Digital Centers & Infrastructure Verification  
**Mission Ref:** MoCD/RSIM/INSP/{YEAR}/04  
**Date of Mission:** {DATE}  
**Lead Inspector:** Senior Technical Officer, RSIM Directorate  

---

### 1. MISSION OBJECTIVES & SCOPE
The technical monitoring mission was conducted pursuant to ministerial oversight directives to:
- Inspect physical and digital operational readiness of regional connectivity installations
- Verify equipment condition, solar power backup reliability, and network latency
- Interview facility coordinators and local stakeholder beneficiaries

### 2. SITES VISITED & INSPECTION FINDINGS
| Facility Name | Location / Region | Equipment Status | Power / Network Condition | Operational Grade |
|---|---|---|---|---|
| Community ICT Center 1 | Regional Hub A | 95% Functional | Stable Grid + Solar Backup | Grade A (Optimal) |
| Municipal Data Center 2 | District Office B | 80% Functional | Minor Inverter Servicing Needed | Grade B (Satisfactory) |
| Training Facility 3 | Rural Center C | 70% Functional | ISP Bandwidth Upgrade Required | Grade C (Attention Needed) |

### 3. CRITICAL OBSERVATIONS & RISK ASSESSMENT
- Hardware installations across primary hubs are intact and properly tagged under asset registers.
- Preventative maintenance schedules must be strictly enforced to avoid service interruption during adverse weather conditions.

### 4. CORRECTIVE ACTION ROADMAP
1. Dispatch technician team for inverter maintenance within 7 working days.
2. Escalate ISP bandwidth upgrade with contracted telecom providers.
3. Re-inspect Grade C facilities ahead of quarterly review.

**Prepared By:** Monitoring & Evaluation Technical Team  
**Endorsed By:** Director, Research, Statistics & Information Management`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 5. Official Correspondence Letter ────────────────────────────────────
  {
    id: 'tpl_def_let_01',
    title: 'Ministry Official Letterhead & Correspondence Template',
    name: 'Ministry Official Letterhead & Correspondence Template',
    documentType: 'Letter',
    category: 'letters',
    source: 'built_in',
    summary: 'Official Civil Service correspondence with institutional letterhead, coat of arms decorum, reference numbering, formal salutation, and signature block.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS & INFORMATION MANAGEMENT (RSIM)

P.O. Box M.38, Ministries, Accra - Ghana  
Digital Address: GA-107-5555 | Tel: +233 (0) 302 685 601  
Email: rsim@mocd.gov.gh | Website: www.mocd.gov.gh  

**Our Ref:** MoCD/RSIM/CORR/{YEAR}/042  
**Your Ref:** {RECIPIENT_REF}  
**Date:** {DATE}  

The Chief Executive Officer / Executive Secretary  
Statutory Agency / Partner Institution  
Accra, Ghana  

Dear Sir/Madam,

## OFFICIAL CORRESPONDENCE: {SUBJECT}

1. I have the honour to refer to the statutory framework governing sector collaboration under the Ministry of Communications and Digitalisation.

2. In accordance with the operational mandate of the Directorate of Research, Statistics and Information Management (RSIM), I write to formally convey the following directives and resolutions for your attention and institutional action:
   - {KEY_POINTS}

3. We request that your esteemed office reviews the attached specifications and submits validated returns by the agreed statutory deadline.

4. Please accept the assurances of our highest institutional consideration.

Yours faithfully,

_______________________________  
**Director, RSIM Directorate**  
for: **HON. MINISTER FOR COMMUNICATIONS AND DIGITALISATION**`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // ── 6. Internal Memorandum ───────────────────────────────────────────────
  {
    id: 'tpl_def_memo_01',
    title: 'Internal Directorate Memorandum Standard Template',
    name: 'Internal Directorate Memorandum Standard Template',
    documentType: 'Memo',
    category: 'memos',
    source: 'built_in',
    summary: 'Standard Civil Service Internal Memorandum format with To, Through, From, Date, Subject, numbered paragraphs, and executive prayer.',
    content: `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION

## INTERNAL MEMORANDUM

**TO:** The Chief Director  
**THROUGH:** Director, RSIM Directorate  
**FROM:** Assistant Director, Research & Statistics  
**DATE:** {DATE}  
**REF. NO:** MoCD/RSIM/MEMO/{YEAR}/028  

**SUBJECT:** {SUBJECT}  
────────────────────────────────────────────────────────────────────────────────

### 1.0 PURPOSE
1.1 The purpose of this memorandum is to respectfully present for your executive review and formal approval regarding: {PURPOSE}.

### 2.0 BACKGROUND & CURRENT CONTEXT
2.1 In line with the Ministry's strategic modernization targets and statutory reporting requirements, the Directorate has analyzed ongoing operational proceedings and inter-agency data submissions.

2.2 The deliberations synthesized from recent stakeholder proceedings emphasize the necessity of timely directives to ensure institutional compliance.

### 3.0 OBSERVATIONS & KEY FINDINGS
3.1 Operational throughput has improved following the implementation of harmonized reporting templates.
3.2 Requisite logistical and coordination measures must be approved to sustain these outcomes.

### 4.0 PRAYER / RECOMMENDATION
4.1 In view of the foregoing, it is respectfully recommended that you:
    a) Grant executive approval for the proposed operational roadmap.
    b) Direct the relevant directorates to facilitate the implementation actions.

Submitted for your kind consideration and directive, please.

_______________________________  
**Director, RSIM Directorate**`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_KNOWLEDGE: KnowledgeItem[] = [];
export const DEFAULT_GLOSSARY: GlossaryTerm[] = [];
