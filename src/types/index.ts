export type UserRole = 'Administrator' | 'Director' | 'Officer' | 'Reviewer' | 'Read Only';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  department: string;
  avatarUrl?: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string; // e.g., "00:04:12"
  seconds: number;
  speaker: string;
  text: string;
}

export interface ActionItem {
  id: string;
  task: string;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  responsiblePerson: string;
  organization: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
  notes?: string;
  createdAt: string;
}

export interface MeetingAnalysis {
  executiveSummary: string;
  mainDiscussionPoints: string[];
  decisions: string[];
  actionItems: Array<{
    task: string;
    responsiblePerson: string;
    deadline: string;
    priority: 'High' | 'Medium' | 'Low';
    sourceTimestamp?: string;
  }>;
  issuesAndRisks: string[];
  recommendations: string[];
  questions: string[];
  commitments: string[];
  keyQuotes: Array<{
    speaker: string;
    statement: string;
    timestamp: string;
  }>;
}

export type MeetingStatus = 
  | 'Scheduled' 
  | 'Recorded' 
  | 'Transcribed' 
  | 'Analysed' 
  | 'Minutes Drafted' 
  | 'Reviewed' 
  | 'Final';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  chairperson: string;
  participants: string[];
  organizer: string;
  agenda: string[];
  project?: string;
  meetingType: 'Directorate Review' | 'Inter-Agency Committee' | 'Stakeholder Consultation' | 'Technical Working Group' | 'Executive Briefing' | 'Emergency Session';
  notes?: string;
  audioFileName?: string;
  audioDuration?: string;
  audioDataUrl?: string; // base64 or object URL for local playback
  transcript: TranscriptSegment[];
  analysis?: MeetingAnalysis;
  minutes?: string;
  report?: string;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = 
  | 'Meeting Report' 
  | 'Meeting Minutes' 
  | 'Executive Brief' 
  | 'Executive Report'
  | 'Report'
  | 'Internal Memo' 
  | 'Submission Memo' 
  | 'Request Memo' 
  | 'Approval Memo' 
  | 'Official Letter' 
  | 'Policy Document' 
  | 'Action Plan' 
  | 'Research Brief' 
  | 'Uploaded Document';

export type ApprovalStatus = 
  | 'Draft' 
  | 'Submitted for Review' 
  | 'Reviewer Comments' 
  | 'Author Revision' 
  | 'Director Review' 
  | 'Approved' 
  | 'Final';

export interface DocumentComment {
  id: string;
  author: string;
  role: UserRole;
  text: string;
  createdAt: string;
}

export interface DocumentVersion {
  versionNumber: number;
  updatedAt: string;
  updatedBy: string;
  content: string;
  note: string;
}

export interface ExtractedDocumentData {
  summary: string;
  keyTakeaways: string[];
  entities: {
    people: string[];
    organizations: string[];
    dates: string[];
    numbersAndMetrics: string[];
    policiesOrActs: string[];
  };
  actionPoints: string[];
  sections: Array<{ heading: string; body: string }>;
  suggestedNextSteps: string[];
}

export interface DocumentItem {
  id: string;
  title: string;
  type: DocumentType;
  category: string;
  content: string;
  rawText?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  summary?: string;
  extractedData?: ExtractedDocumentData;
  sourceMeetingId?: string;
  projectId?: string;
  referenceNumber?: string;
  recipient?: string;
  sender?: string;
  author: string;
  version: number;
  versions: DocumentVersion[];
  approvalStatus: ApprovalStatus;
  comments: DocumentComment[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: 'Directorate Information' | 'Policies' | 'Procedures' | 'Reports' | 'Meetings' | 'Correspondence' | 'Projects' | 'Glossary' | 'Writing Standards';
  content: string;
  summary: string;
  source: string;
  owner: string;
  version: string;
  accessLevel: 'Public' | 'Directorate Only' | 'Executive Only';
  approvalStatus: 'Approved' | 'Pending Review' | 'Draft';
  tags: string[];
  effectiveDate: string;
  driveSource?: TemplateDriveSource;
  createdAt: string;
}

export interface GlossaryTerm {
  id: string;
  acronym: string;
  fullName: string;
  definition: string;
  preferredSpelling: string;
  category: string;
  relatedTerms: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  code: string;
  description: string;
  leadOfficer: string;
  status: 'Active' | 'Under Review' | 'Completed' | 'Archived';
  startDate: string;
  targetCompletion: string;
  objectives: string[];
  tags: string[];
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role?: string;
  action: string;
  targetType: string;
  targetTitle: string;
  details: string;
}

export interface ChatCitation {
  source: string;
  section?: string;
  timestamp?: string;
  quote?: string;
  uri?: string;
}

export interface ChatAttachment {
  name: string;
  type: string;
  size?: number;
  dataUrl?: string;
  base64?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: string;
  citations?: ChatCitation[];
  groundingSources?: Array<{ uri: string; title: string }>;
  webSearchQueries?: string[];
  isGrounded?: boolean;
  isWebSearch?: boolean;
  modelUsed?: string;
  audioTranscriptionUsed?: boolean;
  context?: {
    type: 'meeting' | 'document' | 'project' | 'knowledge' | 'template';
    id: string;
    title: string;
  };
  attachments?: ChatAttachment[];
  feedback?: 'like' | 'dislike';
  searchEntryPointHtml?: string;
  matchedKnowledge?: Array<{ id?: string; title: string; category: string }>;
  reasoningSteps?: string[];
  documentMeta?: {
    isDocument: boolean;
    documentType: 'Report' | 'Minutes' | 'Memo' | 'Letter';
    templateUsedTitle: string;
    isGoogleDrive?: boolean;
    title?: string;
  };
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: string;
  messages: ChatMessage[];
  isPinned?: boolean;
  activeContext?: {
    type: 'meeting' | 'document' | 'project' | 'knowledge' | 'template';
    id: string;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFormatting {
  fontFamily?: string; // e.g. "Times New Roman", "Calibri", "Arial", "Georgia", "Aptos"
  font?: string; // alias for font family
  titleFontSize?: string; // e.g. "18pt bold", "20pt bold"
  headingFontSize?: string; // e.g. "14pt bold"
  subheadingFontSize?: string; // e.g. "12pt bold"
  bodyFontSize?: string; // e.g. "12pt", "11pt"
  fontSize?: string; // alias for body/general font size
  lineSpacing?: string; // e.g. "1.15", "1.5", "1.0"
  paragraphSpacing?: string; // e.g. "6pt"
  margins?: string; // e.g. "1 inch (normal)"
  alignment?: 'left' | 'justified' | 'center' | 'right';
  colorPalette?: {
    primaryText?: string;
    secondaryText?: string;
    accent?: string;
  };
}

export interface TemplateTone {
  formality: 'Strict Civil Service' | 'Executive Diplomatic' | 'Standard Administrative' | 'Technical Rigorous' | 'Conversational';
  voice: 'Passive Institutional' | 'Direct Active' | 'Balanced';
  openings: string[]; // e.g. ["I have the honour to refer to...", "With reference to your memo dated..."]
  closings: string[]; // e.g. ["Yours faithfully,", "Respectfully submitted,"]
  vocabulary: string[]; // key recurring domain terms
  structuralNotes?: string;
}

export interface TemplateDriveSource {
  provider: 'google_drive' | 'onedrive' | 'local';
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  mimeType?: string;
  uploadedAt?: string;
  syncedAt?: string;
  folderId?: string;
}

export interface TemplateKnowledge {
  salutationPattern?: string;
  signatoryPattern?: string;
  referenceFormat?: string;
  headerStyle?: string;
  keySections?: string[];
  actionItemsColumns?: string[];
  tone?: string;
  specialInstructions?: string;
  learnedAt?: string;
  formatting?: TemplateFormatting;
  toneProfile?: TemplateTone;
  exactStructureBlueprint?: string;
}

export interface UserTemplate {
  id: string;
  title: string;
  name?: string;
  documentType: 'Letter' | 'Memo' | 'Minutes' | 'Report';
  category?: 'letters' | 'memos' | 'minutes' | 'reports';
  source?: 'upload' | 'prompt' | 'custom' | 'ai_customized' | 'built_in' | 'google_drive' | 'onedrive';
  content: string;
  description?: string;
  summary?: string;
  fields?: string[];
  templateSpec?: any;
  learnedKnowledge?: TemplateKnowledge;
  driveSource?: TemplateDriveSource;
  formatting?: TemplateFormatting;
  tone?: TemplateTone;
  isInstitutionalDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FreeAIModelInfo {
  id: string;
  name: string;
  provider: 'Google AI Studio' | 'GroqCloud' | 'OpenRouter Free' | 'Hugging Face' | 'Offline Directorate Engine' | 'Local Ollama';
  modelId: string;
  tierLimit: string; // e.g., "1,500 req/day free (Google)", "30 req/min free (Groq)", "100% Unlimited Local"
  description: string;
  contextWindow: string; // e.g. "1M tokens", "128k tokens"
  speed: string; // e.g., "Ultra Fast (500 t/s)", "Very Fast", "Instant Local"
  supportsWriting: boolean;
  supportsOrganizing: boolean;
  requiresKey: boolean;
  keyUrl?: string;
}

export type AIProviderId = 'openai' | 'openrouter' | 'gemini' | 'groq' | 'deepseek' | 'huggingface' | 'local';

export interface AIProviderStatus {
  id: AIProviderId;
  name: string;
  displayName: string;
  model: string;
  defaultModel?: string;
  isConfigured: boolean;
  state: 'operational' | 'rate_limited' | 'degraded' | 'disabled';
  rateLimitUntil?: number;
  rateLimitSecondsRemaining?: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failoverCount: number;
  lastLatencyMs: number;
  averageLatencyMs: number;
  lastUsedAt?: string;
  priority: number;
  tierDescription: string;
  hasClientKey?: boolean;
}

export interface FailoverEvent {
  id: string;
  timestamp: string;
  fromProvider: AIProviderId;
  toProvider: AIProviderId;
  reason: string;
  statusCode?: number;
  promptSnippet: string;
  durationMs: number;
}

export interface CascadeStatusResponse {
  activeProvider: AIProviderId;
  providers: AIProviderStatus[];
  failoverEvents: FailoverEvent[];
  totalRequestsAcrossAll: number;
  totalFailovers: number;
  systemHealth: 'optimal' | 'degraded' | 'critical';
}

export interface AIExecutionMetadata {
  providerUsed: AIProviderId;
  modelUsed: string;
  latencyMs: number;
  failoverOccurred: boolean;
  failoverChain?: Array<{
    provider: AIProviderId;
    reason: string;
    statusCode?: number;
  }>;
}


