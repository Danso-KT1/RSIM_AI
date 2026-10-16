import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Copy,
  BookmarkPlus,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Search,
  BookOpen,
  Shield,
  Layers,
  ExternalLink,
  Eye,
  X,
  FileCheck2,
  Mail,
  Send,
  Clock,
  Building2,
  Cloud,
  Type,
} from 'lucide-react';
import { UserTemplate, KnowledgeItem, GlossaryTerm } from '../../types';
import { storage } from '../../services/storage';
import { UserTemplateModifier } from '../common/UserTemplateModifier';
import { DriveSyncBar } from '../common/DriveSyncBar';

interface TemplatesManagerViewProps {
  onUseTemplate: (type: 'letters' | 'memos' | 'minutes' | 'reports', content: string) => void;
}

export const TemplatesManagerView: React.FC<TemplatesManagerViewProps> = ({ onUseTemplate }) => {
  const [activeMainTab, setActiveMainTab] = useState<'templates' | 'knowledge'>('templates');
  const [templates, setTemplates] = useState<UserTemplate[]>(() => storage.getTemplates());
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(() => storage.getKnowledge());
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(() => storage.getGlossary());
  
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEditorType, setActiveEditorType] = useState<'Letter' | 'Memo' | 'Minutes' | 'Report'>('Letter');
  const [editingTemplateText, setEditingTemplateText] = useState<string>('');
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<{ title: string; type: string; content: string; knowledge?: any } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = () => {
    setTemplates(storage.getTemplates());
    setKnowledgeItems(storage.getKnowledge());
    setGlossary(storage.getGlossary());
  };

  const handleClearAllTemplates = () => {
    if (window.confirm('Are you sure you want to clear all templates from your library?')) {
      storage.clearAllTemplates();
      reload();
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete template "${title}"?`)) {
      storage.deleteTemplate(id);
      reload();
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesType = filterType === 'All' || t.documentType === filterType;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesType;
    const matchesSearch =
      t.title.toLowerCase().includes(query) ||
      (t.description || t.summary || '').toLowerCase().includes(query) ||
      t.content.toLowerCase().includes(query);
    return matchesType && matchesSearch;
  });

  const filteredKnowledge = knowledgeItems.filter((k) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      k.title.toLowerCase().includes(query) ||
      k.summary.toLowerCase().includes(query) ||
      k.category.toLowerCase().includes(query) ||
      k.content.toLowerCase().includes(query)
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderOpen className="h-6 w-6 text-emerald-700" />
            <span>Knowledge Base & Templates Library</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Official civil service standards, writing templates, and institutional memory for RSIM Directorate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllTemplates}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
              title="Remove all saved templates from your library"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All Templates</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingTemplateText('');
              setShowEditor(!showEditor);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showEditor ? 'Close Creator' : 'Add Custom Template'}</span>
          </button>
        </div>
      </div>

      {/* Google Drive & Cloud Templates Sync Bar */}
      <DriveSyncBar
        onTemplateLearned={() => reload()}
        onKnowledgeLearned={() => reload()}
      />

      {/* Main Mode Toggle: Document Templates vs Knowledge Base */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('templates')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeMainTab === 'templates'
              ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Document Templates ({templates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('knowledge')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeMainTab === 'knowledge'
              ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Institutional Knowledge Base ({knowledgeItems.length})</span>
        </button>
      </div>

      {/* Template Creator & AI Modifier Drawer */}
      {showEditor && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Select Document Category:</span>
            {(['Letter', 'Memo', 'Minutes', 'Report'] as const).map((docType) => (
              <button
                key={docType}
                type="button"
                onClick={() => setActiveEditorType(docType)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorType === docType
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {docType}
              </button>
            ))}
          </div>

          <UserTemplateModifier
            documentType={activeEditorType}
            currentTemplate={editingTemplateText}
            onTemplateChange={(tpl) => {
              setEditingTemplateText(tpl);
              reload();
            }}
          />
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeMainTab === 'templates' ? "Search templates by keyword, section, or subject..." : "Search knowledge base by topic or mandate..."}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Filter Badges for Templates */}
        {activeMainTab === 'templates' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {['All', 'Letter', 'Memo', 'Minutes', 'Report'].map((tab) => {
              const count = tab === 'All' ? templates.length : templates.filter((t) => t.documentType === tab).length;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterType(tab)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    filterType === tab
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'All' ? 'All' : `${tab}s`} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: DOCUMENT TEMPLATES */}
      {activeMainTab === 'templates' && (
        <>
          {filteredTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300 stroke-1" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                {templates.length === 0 ? 'No templates in your library yet' : 'No matching templates found'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {templates.length === 0
                  ? 'Your library is empty. You can add your own custom templates anytime by uploading a document or clicking below.'
                  : 'No templates matched your current filter criteria.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplateText('');
                  setShowEditor(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Add Your Custom Template</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((tpl) => {
                const iconMap = {
                  Letter: Send,
                  Memo: Mail,
                  Minutes: Clock,
                  Report: FileCheck2,
                };
                const IconComponent = iconMap[tpl.documentType] || FileText;

                return (
                  <div
                    key={tpl.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100">
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {tpl.documentType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {tpl.driveSource?.provider === 'google_drive' ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                              <Cloud className="h-3 w-3 text-blue-600" />
                              <span>Google Drive</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Custom Format
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="mt-3 text-sm font-bold text-slate-900 leading-snug">
                        {tpl.title}
                      </h3>

                      {(tpl.description || tpl.summary) && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          {tpl.description || tpl.summary}
                        </p>
                      )}

                      {/* Learned Typography & Formatting Pill */}
                      {tpl.learnedKnowledge?.formatting && (
                        <div className="mt-2.5 rounded-xl bg-blue-50/60 border border-blue-100 p-2 text-[11px] text-blue-900 space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-[10px] text-blue-800">
                            <Type className="h-3 w-3 text-blue-600" />
                            <span>Learned Typography:</span>
                          </div>
                          <p className="text-[10px] text-blue-800 font-mono">
                            <strong>{tpl.learnedKnowledge.formatting.fontFamily}</strong> • Body: {tpl.learnedKnowledge.formatting.bodyFontSize} • Title: {tpl.learnedKnowledge.formatting.titleFontSize} • Spacing: {tpl.learnedKnowledge.formatting.lineSpacing}
                          </p>
                        </div>
                      )}

                      {/* Structural Knowledge Pill */}
                      {tpl.learnedKnowledge && (
                        <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 font-bold text-emerald-800 text-[10px] uppercase tracking-wider">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              <span>Learned Tone & Layout:</span>
                            </div>
                            {tpl.learnedKnowledge.toneProfile?.formality && (
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                                {tpl.learnedKnowledge.toneProfile.formality}
                              </span>
                            )}
                          </div>
                          {tpl.learnedKnowledge.referenceFormat && (
                            <p className="truncate text-slate-600 text-[10px]">
                              <span className="font-semibold text-slate-700">Ref:</span> {tpl.learnedKnowledge.referenceFormat}
                            </p>
                          )}
                          {tpl.learnedKnowledge.keySections && tpl.learnedKnowledge.keySections.length > 0 && (
                            <p className="truncate text-slate-600 text-[10px]">
                              <span className="font-semibold text-slate-700">Sections:</span> {tpl.learnedKnowledge.keySections.slice(0, 3).join(' • ')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Preview Snippet */}
                      <div className="mt-2.5 rounded-xl bg-slate-50/80 p-2.5 font-mono text-[10px] text-slate-500 line-clamp-3 whitespace-pre-wrap border border-slate-100">
                        {tpl.content}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewItem({ title: tpl.title, type: tpl.documentType, content: tpl.content, knowledge: tpl.learnedKnowledge })}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="Preview full template"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(tpl.id, tpl.content)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="Copy template text"
                        >
                          {copiedId === tpl.id ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(tpl.id, tpl.title)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const studio =
                            tpl.documentType === 'Letter'
                              ? 'letters'
                              : tpl.documentType === 'Memo'
                              ? 'memos'
                              : tpl.documentType === 'Minutes'
                              ? 'minutes'
                              : 'reports';
                          onUseTemplate(studio, tpl.content);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs transition-colors"
                      >
                        <span>Use in {tpl.documentType} Studio</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT 2: KNOWLEDGE BASE & INSTITUTIONAL MEMORY */}
      {activeMainTab === 'knowledge' && (
        <div className="space-y-6">
          {filteredKnowledge.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-300 stroke-1" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                {knowledgeItems.length === 0 ? 'No institutional knowledge items yet' : 'No matching knowledge items'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {knowledgeItems.length === 0
                  ? 'Your institutional knowledge base is empty. You can add guidelines, writing standards, and reference charters as needed.'
                  : 'No knowledge items matched your current filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKnowledge.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-100">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ver: {item.version} • {item.owner}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {item.summary}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 line-clamp-4 border border-slate-100 whitespace-pre-wrap font-sans">
                      {item.content}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Source: {item.source}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewItem({ title: item.title, type: item.category, content: item.content })}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      <span>Read Full Charter</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sector Glossary Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Official Acronyms & Directorate Glossary ({glossary.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Authoritative Civil Service References
              </span>
            </div>

            {glossary.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No glossary acronyms added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {glossary.map((g) => (
                  <div key={g.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-800 font-mono text-sm">{g.acronym}</span>
                      <span className="text-[10px] text-slate-400">{g.category}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-[11px]">{g.fullName}</p>
                    <p className="text-[10px] text-slate-600 line-clamp-2">{g.definition}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL PREVIEW MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  {previewItem.type}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-1">{previewItem.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {previewItem.knowledge && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950 space-y-1.5">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    AI Learned Formatting Standards:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><strong>Tone:</strong> {previewItem.knowledge.tone || 'Formal Civil Service'}</div>
                    <div><strong>Reference:</strong> {previewItem.knowledge.referenceFormat || 'Standard'}</div>
                    {previewItem.knowledge.salutationPattern && <div><strong>Salutation:</strong> {previewItem.knowledge.salutationPattern}</div>}
                    {previewItem.knowledge.signatoryPattern && <div><strong>Signatory:</strong> {previewItem.knowledge.signatoryPattern.slice(0, 40)}...</div>}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                {previewItem.content}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewItem.content);
                  alert('Copied to clipboard!');
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Full Content</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
                {['Letter', 'Memo', 'Minutes', 'Report'].includes(previewItem.type) && (
                  <button
                    type="button"
                    onClick={() => {
                      const studio =
                        previewItem.type === 'Letter'
                          ? 'letters'
                          : previewItem.type === 'Memo'
                          ? 'memos'
                          : previewItem.type === 'Minutes'
                          ? 'minutes'
                          : 'reports';
                      onUseTemplate(studio, previewItem.content);
                      setPreviewItem(null);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs"
                  >
                    <span>Open in {previewItem.type} Studio</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
