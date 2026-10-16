import {
  UserProfile,
  Meeting,
  DocumentItem,
  KnowledgeItem,
  GlossaryTerm,
  ProjectItem,
  ActionItem,
  AuditLogEntry,
  ChatSession,
  UserTemplate,
} from '../types';
import {
  SEED_USER,
  SEED_GLOSSARY,
  SEED_KNOWLEDGE,
  SEED_PROJECTS,
  SEED_MEETINGS,
  SEED_ACTION_ITEMS,
  SEED_DOCUMENTS,
  SEED_AUDIT_LOGS,
} from './seedData';
import {
  DEFAULT_TEMPLATES,
  DEFAULT_KNOWLEDGE,
  DEFAULT_GLOSSARY,
} from './defaultTemplates';

const STORAGE_KEYS = {
  USER: 'rsim_user_profile',
  MEETINGS: 'rsim_meetings_data',
  DOCUMENTS: 'rsim_documents_data',
  KNOWLEDGE: 'rsim_knowledge_data',
  GLOSSARY: 'rsim_glossary_data',
  PROJECTS: 'rsim_projects_data',
  ACTIONS: 'rsim_actions_data',
  AUDIT_LOGS: 'rsim_audit_logs',
  CHATS: 'rsim_chat_sessions',
  ACTIVE_CONTEXT: 'rsim_active_context',
  TEMPLATES: 'rsim_user_templates',
};

// Lightweight in-memory read cache — cleared on any write operation.
// Avoids repeated JSON.parse on rapid re-renders when data hasn't changed.
const _cache: Partial<Record<keyof typeof STORAGE_KEYS, any>> = {};

function invalidateCache(key: keyof typeof STORAGE_KEYS) {
  delete _cache[key];
}
function invalidateAll() {
  (Object.keys(_cache) as (keyof typeof STORAGE_KEYS)[]).forEach((k) => delete _cache[k]);
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

/** Cached read that avoids re-parsing unless the cache was explicitly invalidated. */
function cachedGet<T>(cacheKey: keyof typeof STORAGE_KEYS, storageKey: string, fallback: T): T {
  if (Object.prototype.hasOwnProperty.call(_cache, cacheKey)) {
    return _cache[cacheKey] as T;
  }
  const val = safeGet<T>(storageKey, fallback);
  _cache[cacheKey] = val;
  return val;
}

/** Write to localStorage and invalidate the matching cache entry. */
function cachedSet<T>(cacheKey: keyof typeof STORAGE_KEYS, storageKey: string, value: T): void {
  safeSet(storageKey, value);
  _cache[cacheKey] = value;
}

const LEGACY_DUMMY_IDS = new Set([
  'mtg_q3_infrastructure', 'mtg_site_handover',
  'doc_memo_01', 'doc_brief_01', 'doc_rep_01',
  'proj_fiber', 'proj_rtdip', 'proj_cloud',
  'act_01', 'act_02', 'act_03', 'act_04', 'act_05',
  'know_01', 'know_02', 'know_03', 'know_04',
  'glo_rsim', 'glo_mocd', 'glo_nca', 'glo_nita', 'glo_gifec', 'glo_csa', 'glo_qda', 'glo_digonce', 'glo_ixp',
  'log_01', 'log_02', 'log_03'
]);

function filterLegacy<T extends { id?: string }>(items: T[], key: string): T[] {
  const filtered = items.filter((item) => !item.id || !LEGACY_DUMMY_IDS.has(item.id));
  if (filtered.length !== items.length) {
    safeSet(key, filtered);
  }
  return filtered;
}

export const storage = {
  init() {
    const PURGE_FLAG = 'rsim_purge_all_dummy_and_templates_v6';
    if (!localStorage.getItem(PURGE_FLAG)) {
      safeSet(STORAGE_KEYS.MEETINGS, []);
      safeSet(STORAGE_KEYS.DOCUMENTS, []);
      safeSet(STORAGE_KEYS.ACTIONS, []);
      safeSet(STORAGE_KEYS.PROJECTS, []);
      safeSet(STORAGE_KEYS.KNOWLEDGE, []);
      safeSet(STORAGE_KEYS.GLOSSARY, []);
      safeSet(STORAGE_KEYS.AUDIT_LOGS, []);
      safeSet(STORAGE_KEYS.CHATS, []);
      safeSet(STORAGE_KEYS.TEMPLATES, []);
      safeSet(STORAGE_KEYS.ACTIVE_CONTEXT, null);
      safeSet(STORAGE_KEYS.USER, SEED_USER);
      localStorage.setItem(PURGE_FLAG, 'true');
      invalidateAll();
      return;
    }

    // One-time migration: sanitize legacy personal names from User profile
    const rawUser = safeGet<UserProfile | null>(STORAGE_KEYS.USER, null);
    if (rawUser && (rawUser.name?.includes('Danso') || rawUser.name?.includes('Kofi'))) {
      const sanitized: UserProfile = {
        ...rawUser,
        name: 'Directorate Officer',
        email: 'officer@directorate.gov',
      };
      safeSet(STORAGE_KEYS.USER, sanitized);
      invalidateCache('USER');
    }

    if (!localStorage.getItem(STORAGE_KEYS.USER)) {
      safeSet(STORAGE_KEYS.USER, SEED_USER);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TEMPLATES)) {
      safeSet(STORAGE_KEYS.TEMPLATES, []);
    }
    const existingGlossary = localStorage.getItem(STORAGE_KEYS.GLOSSARY);
    if (!existingGlossary || existingGlossary === '[]') {
      safeSet(STORAGE_KEYS.GLOSSARY, SEED_GLOSSARY);
    }
    const existingKnowledge = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
    if (!existingKnowledge || existingKnowledge === '[]') {
      safeSet(STORAGE_KEYS.KNOWLEDGE, SEED_KNOWLEDGE);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
      safeSet(STORAGE_KEYS.PROJECTS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MEETINGS)) {
      safeSet(STORAGE_KEYS.MEETINGS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIONS)) {
      safeSet(STORAGE_KEYS.ACTIONS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) {
      safeSet(STORAGE_KEYS.DOCUMENTS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      safeSet(STORAGE_KEYS.AUDIT_LOGS, []);
    }
    invalidateAll();
  },

  // User Profile & Role
  getUser(): UserProfile {
    // Pure read — no more mutation on every call (migration happens only in init())
    return cachedGet<UserProfile>('USER', STORAGE_KEYS.USER, SEED_USER);
  },
  saveUser(profile: UserProfile): void {
    cachedSet('USER', STORAGE_KEYS.USER, profile);
    this.addAuditLog('Updated Profile', 'User', profile.name, `Role changed to ${profile.role}`);
  },

  // Audit Log
  getAuditLogs(): AuditLogEntry[] {
    return filterLegacy(safeGet<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []), STORAGE_KEYS.AUDIT_LOGS);
  },
  addAuditLog(action: string, targetType: string, targetTitle: string, details: string): void {
    const user = this.getUser();
    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actor: user.name,
      role: user.role,
      action,
      targetType,
      targetTitle,
      details,
    };
    const logs = this.getAuditLogs();
    safeSet(STORAGE_KEYS.AUDIT_LOGS, [entry, ...logs].slice(0, 200));
  },

  // Meetings
  getMeetings(): Meeting[] {
    const raw = cachedGet<Meeting[]>('MEETINGS', STORAGE_KEYS.MEETINGS, []);
    return filterLegacy(raw, STORAGE_KEYS.MEETINGS);
  },
  getMeeting(id: string): Meeting | undefined {
    return this.getMeetings().find((m) => m.id === id);
  },
  saveMeeting(meeting: Meeting): void {
    const items = this.getMeetings();
    const index = items.findIndex((m) => m.id === meeting.id);
    if (index >= 0) {
      items[index] = { ...meeting, updatedAt: new Date().toISOString() };
      this.addAuditLog('Updated Meeting', 'Meeting', meeting.title, `Status: ${meeting.status}`);
    } else {
      items.unshift(meeting);
      this.addAuditLog('Created Meeting', 'Meeting', meeting.title, `Created with ${meeting.transcript?.length || 0} transcript segments`);
    }
    cachedSet('MEETINGS', STORAGE_KEYS.MEETINGS, items);
  },
  deleteMeeting(id: string): void {
    const items = this.getMeetings();
    const target = items.find((m) => m.id === id);
    const next = items.filter((m) => m.id !== id);
    cachedSet('MEETINGS', STORAGE_KEYS.MEETINGS, next);
    if (target) {
      this.addAuditLog('Deleted Meeting', 'Meeting', target.title, 'Removed from local database');
    }
  },
  clearAllMeetings(): void {
    cachedSet('MEETINGS', STORAGE_KEYS.MEETINGS, []);
    this.addAuditLog('Cleared All Meetings', 'Meeting', 'All records', 'Removed all meetings from local database');
  },

  // Documents
  getDocuments(): DocumentItem[] {
    const raw = cachedGet<DocumentItem[]>('DOCUMENTS', STORAGE_KEYS.DOCUMENTS, []);
    return filterLegacy(raw, STORAGE_KEYS.DOCUMENTS);
  },
  getDocument(id: string): DocumentItem | undefined {
    return this.getDocuments().find((d) => d.id === id);
  },
  saveDocument(doc: DocumentItem): void {
    const items = this.getDocuments();
    const index = items.findIndex((d) => d.id === doc.id);
    if (index >= 0) {
      // Create version if content changed
      const prev = items[index];
      const versions = [...(doc.versions || [])];
      if (prev.content !== doc.content) {
        versions.push({
          versionNumber: (doc.version || 1),
          updatedAt: new Date().toISOString(),
          updatedBy: this.getUser().name,
          content: prev.content,
          note: `Version ${doc.version} revision`,
        });
      }
      items[index] = {
        ...doc,
        version: prev.content !== doc.content ? doc.version + 1 : doc.version,
        versions,
        updatedAt: new Date().toISOString(),
      };
      this.addAuditLog('Updated Document', doc.type, doc.title, `Approval status: ${doc.approvalStatus}`);
    } else {
      items.unshift(doc);
      this.addAuditLog('Created Document', doc.type, doc.title, `New ${doc.type} authored by ${doc.author}`);
    }
    cachedSet('DOCUMENTS', STORAGE_KEYS.DOCUMENTS, items);
  },
  deleteDocument(id: string): void {
    const items = this.getDocuments();
    const target = items.find((d) => d.id === id);
    const next = items.filter((d) => d.id !== id);
    cachedSet('DOCUMENTS', STORAGE_KEYS.DOCUMENTS, next);
    if (target) {
      this.addAuditLog('Deleted Document', target.type, target.title, 'Removed from storage');
    }
  },
  clearAllDocuments(): void {
    cachedSet('DOCUMENTS', STORAGE_KEYS.DOCUMENTS, []);
    this.addAuditLog('Cleared All Documents', 'Document', 'All files', 'Removed all documents from local storage');
  },

  // Knowledge Base
  getKnowledge(): KnowledgeItem[] {
    const raw = safeGet<KnowledgeItem[]>(STORAGE_KEYS.KNOWLEDGE, []);
    return filterLegacy(raw, STORAGE_KEYS.KNOWLEDGE);
  },
  restoreDefaultKnowledge(): void {
    safeSet(STORAGE_KEYS.KNOWLEDGE, SEED_KNOWLEDGE);
    this.addAuditLog('Restored Default Knowledge', 'Institutional Memory', 'Directorate Standards', 'Loaded institutional memory & drafting guidelines');
  },
  saveKnowledge(item: KnowledgeItem): void {
    const items = this.getKnowledge();
    const index = items.findIndex((k) => k.id === item.id);
    if (index >= 0) {
      items[index] = item;
      this.addAuditLog('Updated Knowledge', 'Institutional Memory', item.title, `Category: ${item.category}`);
    } else {
      items.unshift(item);
      this.addAuditLog('Added Institutional Knowledge', 'Institutional Memory', item.title, `Taught to RSIM AI repository`);
    }
    safeSet(STORAGE_KEYS.KNOWLEDGE, items);
  },
  deleteKnowledge(id: string): void {
    const items = this.getKnowledge();
    const target = items.find((k) => k.id === id);
    safeSet(
      STORAGE_KEYS.KNOWLEDGE,
      items.filter((k) => k.id !== id)
    );
    if (target) {
      this.addAuditLog('Deleted Knowledge', 'Institutional Memory', target.title, 'Removed from repository');
    }
  },

  // Glossary
  getGlossary(): GlossaryTerm[] {
    const raw = safeGet<GlossaryTerm[]>(STORAGE_KEYS.GLOSSARY, []);
    return filterLegacy(raw, STORAGE_KEYS.GLOSSARY);
  },
  saveGlossary(term: GlossaryTerm): void {
    const items = this.getGlossary();
    const index = items.findIndex((g) => g.id === term.id);
    if (index >= 0) {
      items[index] = term;
    } else {
      items.push(term);
    }
    safeSet(STORAGE_KEYS.GLOSSARY, items);
    this.addAuditLog('Saved Glossary Term', 'Glossary', term.acronym, term.fullName);
  },
  deleteGlossary(id: string): void {
    const items = this.getGlossary();
    safeSet(
      STORAGE_KEYS.GLOSSARY,
      items.filter((g) => g.id !== id)
    );
  },

  // Projects
  getProjects(): ProjectItem[] {
    return filterLegacy(safeGet<ProjectItem[]>(STORAGE_KEYS.PROJECTS, []), STORAGE_KEYS.PROJECTS);
  },
  saveProject(project: ProjectItem): void {
    const items = this.getProjects();
    const index = items.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      items[index] = project;
    } else {
      items.unshift(project);
    }
    safeSet(STORAGE_KEYS.PROJECTS, items);
    this.addAuditLog('Saved Project', 'Project', project.name, `Code: ${project.code}`);
  },

  // Action Items
  getActionItems(): ActionItem[] {
    const raw = cachedGet<ActionItem[]>('ACTIONS', STORAGE_KEYS.ACTIONS, []);
    return filterLegacy(raw, STORAGE_KEYS.ACTIONS);
  },
  saveActionItem(action: ActionItem): void {
    const items = this.getActionItems();
    const index = items.findIndex((a) => a.id === action.id);
    if (index >= 0) {
      items[index] = action;
    } else {
      items.unshift(action);
    }
    cachedSet('ACTIONS', STORAGE_KEYS.ACTIONS, items);
    this.addAuditLog('Updated Action Item', 'Action Item', action.task, `Status: ${action.status}`);
  },
  deleteActionItem(id: string): void {
    const items = this.getActionItems();
    cachedSet('ACTIONS', STORAGE_KEYS.ACTIONS, items.filter((a) => a.id !== id));
  },

  // Chat Sessions — not cached because they can be very large and change frequently
  getChats(): ChatSession[] {
    return safeGet<ChatSession[]>(STORAGE_KEYS.CHATS, []);
  },
  saveChat(chat: ChatSession): void {
    const items = this.getChats();
    const index = items.findIndex((c) => c.id === chat.id);
    if (index >= 0) {
      items[index] = chat;
    } else {
      items.unshift(chat);
    }
    safeSet(STORAGE_KEYS.CHATS, items);
  },
  deleteChat(id: string): void {
    const items = this.getChats();
    safeSet(
      STORAGE_KEYS.CHATS,
      items.filter((c) => c.id !== id)
    );
  },

  // Global active context
  getActiveContext(): { type: 'meeting' | 'document' | 'project' | 'knowledge'; id: string; title: string } | null {
    return safeGet(STORAGE_KEYS.ACTIVE_CONTEXT, null);
  },
  setActiveContext(ctx: { type: 'meeting' | 'document' | 'project' | 'knowledge'; id: string; title: string } | null): void {
    safeSet(STORAGE_KEYS.ACTIVE_CONTEXT, ctx);
  },

  // User Templates
  getTemplates(): UserTemplate[] {
    const list = safeGet<UserTemplate[]>(STORAGE_KEYS.TEMPLATES, []);
    if (list.length === 0) {
      safeSet(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
      return [...DEFAULT_TEMPLATES];
    }
    // Ensure the verified Google Drive Stakeholder template is always present
    if (!list.some((t) => t.id === 'tpl_gdrive_stakeholder_01' || t.title?.includes('STAKEHOLDER ENGAGEMENT REPORT'))) {
      const gDriveTpl = DEFAULT_TEMPLATES.find((t) => t.id === 'tpl_gdrive_stakeholder_01');
      if (gDriveTpl) {
        list.unshift(gDriveTpl);
        safeSet(STORAGE_KEYS.TEMPLATES, list);
      }
    }
    return list;
  },
  restoreDefaultTemplates(): void {
    safeSet(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
    this.addAuditLog('Restored Templates', 'Templates Library', 'Directorate Standards', 'Restored official default and Google Drive templates');
  },
  saveTemplate(tpl: UserTemplate): void {
    const list = this.getTemplates();
    const idx = list.findIndex((t) => t.id === tpl.id);
    if (idx >= 0) {
      list[idx] = { ...tpl, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(tpl);
    }
    safeSet(STORAGE_KEYS.TEMPLATES, list);
  },
  deleteTemplate(id: string): void {
    const list = this.getTemplates().filter((t) => t.id !== id);
    safeSet(STORAGE_KEYS.TEMPLATES, list);
  },
  clearAllTemplates(): void {
    safeSet(STORAGE_KEYS.TEMPLATES, []);
  },

  // Backup & Data management
  exportAllData(): string {
    const bundle = {
      exportDate: new Date().toISOString(),
      platform: 'RSIM AI Institutional Platform',
      version: '1.0.0',
      user: this.getUser(),
      meetings: this.getMeetings(),
      documents: this.getDocuments(),
      knowledge: this.getKnowledge(),
      glossary: this.getGlossary(),
      projects: this.getProjects(),
      actions: this.getActionItems(),
      auditLogs: this.getAuditLogs(),
    };
    return JSON.stringify(bundle, null, 2);
  },

  importAllData(jsonText: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.meetings) safeSet(STORAGE_KEYS.MEETINGS, parsed.meetings);
      if (parsed.documents) safeSet(STORAGE_KEYS.DOCUMENTS, parsed.documents);
      if (parsed.knowledge) safeSet(STORAGE_KEYS.KNOWLEDGE, parsed.knowledge);
      if (parsed.glossary) safeSet(STORAGE_KEYS.GLOSSARY, parsed.glossary);
      if (parsed.projects) safeSet(STORAGE_KEYS.PROJECTS, parsed.projects);
      if (parsed.actions) safeSet(STORAGE_KEYS.ACTIONS, parsed.actions);
      if (parsed.auditLogs) safeSet(STORAGE_KEYS.AUDIT_LOGS, parsed.auditLogs);
      this.addAuditLog('Imported Data Backup', 'System', 'Data Restore', 'Restored institutional data bundle');
      return { success: true, message: 'Institutional data successfully restored from backup.' };
    } catch (err: any) {
      return { success: false, message: `Failed to import data: ${err.message}` };
    }
  },

  resetDefaults(): void {
    safeSet(STORAGE_KEYS.USER, SEED_USER);
    safeSet(STORAGE_KEYS.GLOSSARY, []);
    safeSet(STORAGE_KEYS.KNOWLEDGE, []);
    safeSet(STORAGE_KEYS.PROJECTS, []);
    safeSet(STORAGE_KEYS.MEETINGS, []);
    safeSet(STORAGE_KEYS.ACTIONS, []);
    safeSet(STORAGE_KEYS.DOCUMENTS, []);
    safeSet(STORAGE_KEYS.AUDIT_LOGS, []);
    safeSet(STORAGE_KEYS.CHATS, []);
    safeSet(STORAGE_KEYS.ACTIVE_CONTEXT, null);
    invalidateAll();
    this.addAuditLog('System Reset', 'System', 'Clean Baseline', 'Reset system to pristine empty state');
  },

  clearAllData(): void {
    safeSet(STORAGE_KEYS.USER, SEED_USER);
    safeSet(STORAGE_KEYS.GLOSSARY, []);
    safeSet(STORAGE_KEYS.KNOWLEDGE, []);
    safeSet(STORAGE_KEYS.PROJECTS, []);
    safeSet(STORAGE_KEYS.MEETINGS, []);
    safeSet(STORAGE_KEYS.ACTIONS, []);
    safeSet(STORAGE_KEYS.DOCUMENTS, []);
    safeSet(STORAGE_KEYS.AUDIT_LOGS, []);
    safeSet(STORAGE_KEYS.CHATS, []);
    safeSet(STORAGE_KEYS.ACTIVE_CONTEXT, null);
    invalidateAll();
  },
};

