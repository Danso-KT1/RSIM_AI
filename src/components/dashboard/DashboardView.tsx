import React, { useState } from 'react';
import {
  Mic,
  FileText,
  Mail,
  Send,
  FileCheck2,
  Sparkles,
  ArrowRight,
  Clock,
  BookMarked,
  Layers,
  Trash2,
  Zap,
  Activity,
  Shield,
} from 'lucide-react';
import { UserProfile, Meeting, DocumentItem, ActionItem } from '../../types';
import { NavItemKey } from '../layout/AppSidebar';
import { storage } from '../../services/storage';

interface DashboardViewProps {
  user: UserProfile;
  meetings: Meeting[];
  documents: DocumentItem[];
  actionItems: ActionItem[];
  onNavigate: (tab: NavItemKey) => void;
  onQuickPrompt: (prompt: string) => void;
  onDocumentsChanged?: () => void;
  onOpenDocument?: (docId: string) => void;
  onOpenCascadeModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  meetings,
  documents,
  onNavigate,
  onQuickPrompt,
  onDocumentsChanged,
  onOpenDocument,
  onOpenCascadeModal,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const templates = storage.getTemplates();
  const knowledgeCount = storage.getKnowledge().length;

  const lettersCount = documents.filter((d) => d.type === 'Official Letter' || d.category === 'Letters').length;
  const memosCount = documents.filter((d) => d.type === 'Internal Memo' || d.type === 'Submission Memo' || d.category === 'Memos').length;
  const minutesCount = documents.filter((d) => d.type === 'Meeting Minutes' || d.category === 'Minutes').length;
  const reportsCount = documents.filter((d) => d.type === 'Meeting Report' || d.type === 'Executive Brief' || d.category === 'Reports').length;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onQuickPrompt(quickInput);
    onNavigate('gemini-qa');
  };

  const handleDeleteDocument = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      storage.deleteDocument(id);
      onDocumentsChanged?.();
    }
  };

  const handleDeleteTemplate = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete template "${title}"?`)) {
      storage.deleteTemplate(id);
      onDocumentsChanged?.();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-xs mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Institutional Document & AI Intelligence Studio
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Executive Document & Knowledge Intelligence
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            Write official letters, memos, minutes and reports with Google Gemini, backed by your institutional templates and knowledge base.
          </p>

          {/* Quick Gemini Input Bar */}
          <form onSubmit={handleQuickSubmit} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3.5 top-3 h-4 w-4 text-emerald-400" />
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Ask Google Gemini, draft a memo, summarize institutional documents..."
                className="w-full rounded-xl border border-white/20 bg-white/10 px-10 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-400 backdrop-blur-sm focus:border-emerald-400 focus:bg-white/15 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>Ask Gemini</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Primary Studios Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Document & AI Writing Studios
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: 'Write Letter',
              desc: 'Official Correspondence',
              icon: Send,
              color: 'text-teal-700 bg-teal-50 border-teal-100 hover:border-teal-300',
              tab: 'letters' as NavItemKey,
            },
            {
              label: 'Write Memo',
              desc: 'Internal Memorandum',
              icon: Mail,
              color: 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:border-emerald-300',
              tab: 'memos' as NavItemKey,
            },
            {
              label: 'Write Minutes',
              desc: 'Proceedings & Records',
              icon: Clock,
              color: 'text-indigo-700 bg-indigo-50 border-indigo-100 hover:border-indigo-300',
              tab: 'minutes' as NavItemKey,
            },
            {
              label: 'Write Report',
              desc: 'Institutional Reports',
              icon: FileCheck2,
              color: 'text-blue-700 bg-blue-50 border-blue-100 hover:border-blue-300',
              tab: 'reports' as NavItemKey,
            },
            {
              label: 'Audio Transcribe',
              desc: 'Proceedings & 4-5h Audio',
              icon: Mic,
              color: 'text-rose-700 bg-rose-50 border-rose-100 hover:border-rose-300',
              tab: 'audio-transcribe' as NavItemKey,
            },
            {
              label: 'AI Inquiries',
              desc: 'Ask & Generate',
              icon: Sparkles,
              color: 'text-purple-700 bg-purple-50 border-purple-100 hover:border-purple-300',
              tab: 'gemini-qa' as NavItemKey,
            },
          ].map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(act.tab)}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-all hover:shadow-xs group ${act.color}`}
              >
                <div className="mb-2 rounded-lg p-2 transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold leading-tight">{act.label}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{act.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Four-Engine AI Cascade & Live Health Telemetry Banner */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50/80 via-purple-50/40 to-slate-50 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-xs">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Four-Engine AI Cascade & Circuit-Breaker Matrix
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-Failover Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              OpenAI & OpenRouter GPT Models (Prioritized First) ➔ Google Gemini 3.8 ➔ GroqCloud LPU (500 t/s) ➔ DeepSeek Reasoning ➔ Directorate Offline Safety Net.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCascadeModal}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-800 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>View Engine Matrix</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          onClick={() => onNavigate('letters')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-teal-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Letters & Memos</span>
            <div className="rounded-lg bg-teal-50 p-1.5 text-teal-700">
              <Send className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{lettersCount + memosCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {lettersCount} Letters • {memosCount} Memos
          </p>
        </div>

        <div
          onClick={() => onNavigate('minutes')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Minutes & Reports</span>
            <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-700">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{minutesCount + reportsCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {minutesCount} Minutes • {reportsCount} Reports
          </p>
        </div>

        <div
          onClick={() => onNavigate('templates')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Knowledge Base</span>
            <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{knowledgeCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Charters, Standards & Protocols
          </p>
        </div>

        <div
          onClick={() => onNavigate('templates')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Document Templates</span>
            <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
              <BookMarked className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{templates.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Standard Civil Service Formats
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Documents & Templates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-700" />
              <h3 className="font-bold text-slate-900 text-sm">Recent Documents ({documents.length})</h3>
            </div>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Repository <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                <FileText className="h-6 w-6 mx-auto mb-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No documents drafted yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Start drafting in the Letter, Memo, Minutes, or Report studios.</p>
              </div>
            ) : (
              documents.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (onOpenDocument) onOpenDocument(doc.id);
                    else onNavigate('documents');
                  }}
                  className="group cursor-pointer rounded-xl border border-slate-100 p-2.5 hover:border-emerald-300 hover:bg-slate-50/70 transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-800 transition-colors">
                      {doc.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {doc.type} • {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {doc.approvalStatus || 'Draft'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDocument(doc.id, doc.title, e)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-60 group-hover:opacity-100"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Custom Templates */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-emerald-700" />
              <h3 className="font-bold text-slate-900 text-sm">Your Templates ({templates.length})</h3>
            </div>
            <button
              onClick={() => onNavigate('templates')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
                <Layers className="h-6 w-6 mx-auto mb-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No saved templates</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Save your letters, memos, minutes, or reports templates to reuse anytime.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('templates')}
                  className="mt-2 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Create Template
                </button>
              </div>
            ) : (
              templates.slice(0, 5).map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => onNavigate('templates')}
                  className="group cursor-pointer rounded-xl border border-slate-100 p-2.5 hover:border-emerald-300 hover:bg-slate-50/70 transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-800 transition-colors">
                      {tpl.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">{tpl.documentType} template</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {tpl.documentType}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTemplate(tpl.id, tpl.title, e)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-60 group-hover:opacity-100"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
