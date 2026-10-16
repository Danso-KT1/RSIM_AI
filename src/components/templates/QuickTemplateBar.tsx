import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Bookmark,
  BookMarked,
  X,
  FileText,
  ChevronDown,
  Wand2,
  Check,
  Edit3,
  Trash2,
  Cloud,
  Pin,
  Layers,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { UserTemplate } from '../../types';
import { storage } from '../../services/storage';
import { parseUploadedFile, extractTemplateSpecFromDocx, TemplateSpec } from '../../services/documentParser';
import { aiService, detectDocumentFormatIntent } from '../../services/aiService';
import { api } from '../../services/api';
import {
  uploadFileToDrive,
  syncAndLearnTemplateFromDrive,
  getAccessToken,
  downloadDriveFileContent,
  downloadOneDriveFileContent,
  exportDriveFile,
} from '../../services/driveService';
import { DriveIntegrationModal, CloudFileSelection } from '../common/DriveIntegrationModal';

interface QuickTemplateBarProps {
  category: 'letters' | 'memos' | 'minutes' | 'reports';
  activeTemplate: UserTemplate | null;
  onSelectTemplate: (template: UserTemplate | null) => void;
}

const docTypeMap: Record<string, 'Letter' | 'Memo' | 'Minutes' | 'Report'> = {
  letters: 'Letter',
  memos: 'Memo',
  minutes: 'Minutes',
  reports: 'Report',
};

export const QuickTemplateBar: React.FC<QuickTemplateBarProps> = ({
  category,
  activeTemplate,
  onSelectTemplate,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isPromptMode, setIsPromptMode] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isAiAdapting, setIsAiAdapting] = useState(false);
  const [adaptInstruction, setAdaptInstruction] = useState('');
  const [showAdaptModal, setShowAdaptModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cloud Drive Integration Modal State
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [cloudTargetProvider, setCloudTargetProvider] = useState<'google' | 'onedrive' | undefined>(undefined);
  const [isCloudDownloading, setIsCloudDownloading] = useState(false);

  // Template Spec Preview Modal State
  const [specPreviewModalOpen, setSpecPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTemplates: UserTemplate[] = storage.getTemplates().filter(
    (t: UserTemplate) =>
      t.category === category ||
      t.documentType === docTypeMap[category] ||
      (!t.category && !t.documentType) ||
      (category === 'reports' && /report|stakeholder|harmonisa?tion/i.test(t.title || '')) ||
      (category === 'minutes' && /minute/i.test(t.title || ''))
  );

  // Last used template tracking per category
  const lastTemplateKey = `rsim_last_template_${category}`;
  const lastTemplateId = localStorage.getItem(lastTemplateKey);
  const lastTemplate = savedTemplates.find((t) => t.id === lastTemplateId);

  const handleSelectAndRemember = (t: UserTemplate | null) => {
    if (t) {
      localStorage.setItem(lastTemplateKey, t.id);
    }
    onSelectTemplate(t);
  };

  const handlePinInstitutional = () => {
    if (!activeTemplate) return;
    const updated: UserTemplate = {
      ...activeTemplate,
      isInstitutionalDefault: true,
      updatedAt: new Date().toISOString(),
    };
    storage.saveTemplate(updated);
    onSelectTemplate(updated);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteSavedTemplate = (e: React.MouseEvent, id: string, title?: string) => {
    e.stopPropagation();
    if (confirm(`Remove template "${title || 'this template'}"?`)) {
      storage.deleteTemplate(id);
      if (activeTemplate?.id === id) {
        onSelectTemplate(null);
      }
      setRefreshKey((k) => k + 1);
    }
  };

  // Handle Cloud File Selection from Drive / OneDrive
  const handleCloudFileSelected = async (fileSelection: any, downloadedData?: any) => {
    setIsCloudDownloading(true);
    setDriveModalOpen(false);
    try {
      let arrayBuffer: ArrayBuffer | undefined =
        downloadedData?.arrayBuffer || fileSelection.arrayBuffer;

      const isGoogle =
        fileSelection.provider === 'google' ||
        fileSelection.provider === 'google_drive' ||
        String(fileSelection.provider || '').toLowerCase().includes('google');

      if (!arrayBuffer) {
        if (isGoogle) {
          if (fileSelection.mimeType === 'application/vnd.google-apps.document') {
            arrayBuffer = await exportDriveFile(fileSelection.id, 'docx');
          } else {
            const downloaded = await downloadDriveFileContent(fileSelection.id);
            arrayBuffer = downloaded.arrayBuffer;
          }
        } else {
          const downloaded = await downloadOneDriveFileContent(fileSelection.id);
          arrayBuffer = downloaded.arrayBuffer;
        }
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded cloud template file was empty.');
      }

      // Extract template spec from docx
      let templateSpec: TemplateSpec | undefined = undefined;
      let templateContent = downloadedData?.text || '';

      const isDocx =
        fileSelection.name.endsWith('.docx') ||
        fileSelection.name.endsWith('.dotx') ||
        fileSelection.mimeType?.includes('wordprocessingml') ||
        fileSelection.mimeType === 'application/vnd.google-apps.document';

      if (isDocx) {
        try {
          templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, fileSelection.name);
        } catch (specErr) {
          console.warn('Docx template spec extraction notice:', specErr);
        }
      }

      // Extract text content using browser parser if not already provided
      if (!templateContent) {
        const dummyFile = new File([arrayBuffer], fileSelection.name, {
          type: isDocx
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf',
        });
        const parsed = await parseUploadedFile(dummyFile);
        templateContent = parsed.text;
      }

      const cleanTitle = fileSelection.name.replace(/\.[^/.]+$/, '');
      const intent = detectDocumentFormatIntent(
        cleanTitle,
        cleanTitle,
        templateSpec,
        docTypeMap[category]
      );
      const detectedDocType = intent.detectedType;
      const inferredCategory = `${detectedDocType.toLowerCase()}s` as 'letters' | 'memos' | 'minutes' | 'reports';

      const newTemplate: UserTemplate = {
        id: `tpl_cloud_${Date.now()}`,
        title: cleanTitle,
        name: cleanTitle,
        documentType: detectedDocType,
        category: inferredCategory,
        description: `Imported from ${isGoogle ? 'Google Drive' : 'OneDrive'}: ${fileSelection.name}`,
        content: templateContent,
        fields: [],
        templateSpec,
        formatting: templateSpec ? { font: (templateSpec as any).detectedFont, fontSize: (templateSpec as any).detectedFontSize } : undefined,
        learnedKnowledge: {
          keySections: (templateSpec as any)?.sections?.map((s: any) => s.title),
          formatting: { font: (templateSpec as any)?.detectedFont, fontSize: (templateSpec as any)?.detectedFontSize },
          actionItemsColumns: (templateSpec as any)?.tables?.[0]?.headers,
        },
        source: isGoogle ? 'google_drive' : 'onedrive',
        driveSource: {
          fileId: fileSelection.id,
          fileName: fileSelection.name,
          provider: isGoogle ? 'google_drive' : 'onedrive',
          syncedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveTemplate(newTemplate);
      handleSelectAndRemember(newTemplate);
    } catch (err: any) {
      alert(`Could not load template from ${fileSelection.provider}: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCloudDownloading(false);
    }
  };

  // Handle Local File Upload (.docx, .pdf, .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let templateSpec: TemplateSpec | undefined = undefined;

      if (file.name.endsWith('.docx') || file.name.endsWith('.dotx')) {
        try {
          templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, file.name);
        } catch {}
      }

      const parsed = await parseUploadedFile(file);
      const rawTitle = parsed.cleanTitle || file.name.replace(/\.[^/.]+$/, '');

      let learnedKnowledge = undefined;
      const intent = detectDocumentFormatIntent(
        rawTitle,
        rawTitle,
        templateSpec,
        docTypeMap[category]
      );
      let detectedType = intent.detectedType;
      let cleanTitle = rawTitle;
      let templateContent = parsed.text;

      try {
        const learned = await aiService.learnTemplate(parsed.text, rawTitle, docTypeMap[category]);
        if (learned && learned.success) {
          detectedType = learned.detectedType || detectedType;
          learnedKnowledge = learned.learnedKnowledge;
          if (learned.title) cleanTitle = learned.title;
          if (learned.cleanedTemplate) templateContent = learned.cleanedTemplate;
        }
      } catch (aiErr) {
        console.warn('AI template learning error on upload:', aiErr);
      }

      const newTemplate: UserTemplate = {
        id: `tpl_${Date.now()}`,
        title: cleanTitle,
        name: cleanTitle,
        documentType: detectedType,
        category: (detectedType.toLowerCase() + 's') as any || category,
        description: `Uploaded & AI-Learned from ${file.name}`,
        content: templateContent,
        fields: [],
        templateSpec,
        learnedKnowledge: learnedKnowledge || {
          keySections: (templateSpec as any)?.sections?.map((s: any) => s.title),
          formatting: { font: (templateSpec as any)?.detectedFont, fontSize: (templateSpec as any)?.detectedFontSize },
        },
        source: 'upload',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveTemplate(newTemplate);
      handleSelectAndRemember(newTemplate);
    } catch (err: any) {
      alert(`Could not process template file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle AI Prompt Template with Deep Learning
  const handleApplyPromptTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    const templateTitle = `Custom ${category.slice(0, -1).toUpperCase()} Template`;
    let detectedType = docTypeMap[category] || 'Letter';
    let learnedKnowledge = undefined;

    try {
      const learned = await aiService.learnTemplate(promptInput, templateTitle, docTypeMap[category]);
      if (learned && learned.success) {
        detectedType = learned.detectedType || detectedType;
        learnedKnowledge = learned.learnedKnowledge;
      }
    } catch (aiErr) {
      console.warn('AI template learning error on prompt:', aiErr);
    }

    const newTemplate: UserTemplate = {
      id: `tpl_${Date.now()}`,
      title: templateTitle,
      name: templateTitle,
      documentType: detectedType,
      category: (detectedType.toLowerCase() + 's') as any || category,
      description: promptInput,
      content: promptInput,
      fields: [],
      learnedKnowledge,
      source: 'prompt',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveTemplate(newTemplate);
    handleSelectAndRemember(newTemplate);
    setPromptInput('');
    setIsPromptMode(false);
  };

  // AI Adapt Active Template
  const handleAiAdapt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate || !adaptInstruction.trim() || isAiAdapting) return;

    setIsAiAdapting(true);
    try {
      const baseTitle = activeTemplate.title || activeTemplate.name || 'Template';
      const adapted = await aiService.intelligentWrite(
        `Adapt and modify the following ${category} template based on these instructions: ${adaptInstruction}\n\nORIGINAL TEMPLATE:\n${activeTemplate.content}`,
        docTypeMap[category],
        [activeTemplate]
      );

      if (adapted && adapted.fullDraft) {
        const updatedTemplate: UserTemplate = {
          ...activeTemplate,
          id: `tpl_${Date.now()}`,
          title: `${baseTitle} (AI Adapted)`,
          name: `${baseTitle} (AI Adapted)`,
          content: adapted.fullDraft,
          description: adaptInstruction,
          source: 'ai_customized',
          updatedAt: new Date().toISOString(),
        };

        storage.saveTemplate(updatedTemplate);
        handleSelectAndRemember(updatedTemplate);
        setShowAdaptModal(false);
        setAdaptInstruction('');
      } else {
        alert('Failed to adapt template with AI. Try again.');
      }
    } catch (err: any) {
      alert(`AI template adaptation error: ${err.message}`);
    } finally {
      setIsAiAdapting(false);
    }
  };

  const activeTitle = activeTemplate ? (activeTemplate.title || activeTemplate.name || 'Template') : '';
  const spec = activeTemplate?.templateSpec;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.dotx,.doc,.pdf,.txt,.md"
        className="hidden"
      />

      {/* Cloud Integration File Selection Modal */}
      {driveModalOpen && (
        <DriveIntegrationModal
          isOpen={driveModalOpen}
          onClose={() => setDriveModalOpen(false)}
          onSelectFile={handleCloudFileSelected}
          filterTypes={['.docx', '.dotx', '.pdf', 'application/vnd.google-apps.document']}
        />
      )}

      {/* Template Spec Preview Modal */}
      {specPreviewModalOpen && spec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Detected Template Specification</h3>
              </div>
              <button
                onClick={() => setSpecPreviewModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 max-h-96 overflow-y-auto pr-1">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{spec.summary || 'Custom Institutional Template'}</p>
                <p className="text-slate-500 text-[11px]">
                  Font: <strong className="text-slate-700">{spec.detectedFont || 'Calibri'} {spec.detectedFontSize || '12pt'}</strong>
                </p>
                {spec.letterhead && (
                  <p className="text-emerald-700 font-semibold text-[11px]">✓ Letterhead / Institutional Header detected</p>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[10px] tracking-wider">
                  Ordered Sections ({spec.sections?.length || 0}):
                </h4>
                <div className="space-y-1">
                  {spec.sections?.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg bg-emerald-50/50 px-2.5 py-1 text-emerald-950 border border-emerald-100">
                      <span className="font-mono text-[10px] text-emerald-700 font-bold">{s.order}.0</span>
                      <span className="font-medium truncate">{s.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {spec.tables && spec.tables.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[10px] tracking-wider">
                    Tables ({spec.tables.length}):
                  </h4>
                  {spec.tables.map((t: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-2 bg-slate-50 text-[11px]">
                      <span className="font-semibold text-slate-700">Columns: </span>
                      <span className="text-slate-600">{t.headers?.join(' | ') || 'Default Action Items'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSpecPreviewModalOpen(false)}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
              >
                Confirm Template Structure
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTemplate ? (
        /* ACTIVE TEMPLATE BADGE & CONTROLS */
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <BookMarked className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Active Template:
                </span>
                <span className="text-xs font-bold text-slate-900">{activeTitle}</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {activeTemplate.source === 'upload' ? 'Imported' : 'Custom'}
                </span>
                {activeTemplate.isInstitutionalDefault && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                    <Pin className="h-3 w-3 fill-amber-700" />
                    Institutional Template
                  </span>
                )}
              </div>

              {/* Template Spec Preview Badge */}
              {spec ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {spec.summary || `Detected: ${spec.sections.length} sections, ${spec.tables.length} table(s), ${spec.detectedFont || 'Calibri'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSpecPreviewModalOpen(true)}
                    className="text-[11px] text-emerald-700 underline hover:text-emerald-900 flex items-center gap-1 font-medium"
                  >
                    <Eye className="h-3 w-3" />
                    Preview Spec
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md mt-0.5">
                  {activeTemplate.description || 'Drafting will strictly adhere to this format.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pin as Institutional Template */}
            {!activeTemplate.isInstitutionalDefault && (
              <button
                type="button"
                onClick={handlePinInstitutional}
                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                title="Pin this as the default institutional template for the Directorate"
              >
                <Pin className="h-3.5 w-3.5 text-amber-700" />
                <span>Save as Institutional Template</span>
              </button>
            )}

            {/* AI Adapt Template Button */}
            <button
              onClick={() => setShowAdaptModal(true)}
              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
              title="Tell AI to modify this template (add sections, adjust tone, reformat)"
            >
              <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>AI Adapt Template</span>
            </button>

            {/* Change Template Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <span>Change</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                    Switch Template
                  </div>
                  {savedTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectAndRemember(t);
                          setDropdownOpen(false);
                        }}
                        className="flex flex-1 items-center justify-between truncate pr-2 text-left"
                      >
                        <span className="truncate">{t.title || t.name}</span>
                        {t.id === activeTemplate.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-1.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedTemplate(e, t.id, t.title || t.name)}
                        className="opacity-60 hover:opacity-100 p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-all shrink-0"
                        title="Delete template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload New Local File</span>
                  </button>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setCloudTargetProvider('google');
                      setDriveModalOpen(true);
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <Cloud className="h-3 w-3 text-blue-600" />
                    <span>Choose from Google Drive</span>
                  </button>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setCloudTargetProvider('onedrive');
                      setDriveModalOpen(true);
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                  >
                    <Cloud className="h-3 w-3 text-cyan-600" />
                    <span>Choose from OneDrive</span>
                  </button>
                </div>
              )}
            </div>

            {/* Clear Template */}
            <button
              onClick={() => onSelectTemplate(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Remove template"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* NO ACTIVE TEMPLATE: STREAMLINED UPLOAD / CLOUD / PROMPT / SELECT */
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-800">
                  Provide Your Template (Optional)
                </span>
                <p className="text-[11px] text-slate-500">
                  Upload a Word (.docx) file or choose directly from Google Drive / OneDrive. Gemini learns the exact layout.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* "Use last template" default button */}
              {lastTemplate && (
                <button
                  type="button"
                  onClick={() => handleSelectAndRemember(lastTemplate)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                  title="Use the last template you configured for this studio"
                >
                  <Bookmark className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Use Last Template: {lastTemplate.title.slice(0, 16)}</span>
                </button>
              )}

              {/* 1. Upload Local File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isCloudDownloading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5 text-slate-600" />
                <span>{isUploading ? 'Extracting File...' : 'Upload Word / PDF (.docx)'}</span>
              </button>

              {/* 2. Choose from Google Drive */}
              <button
                type="button"
                onClick={() => {
                  setCloudTargetProvider('google');
                  setDriveModalOpen(true);
                }}
                disabled={isCloudDownloading}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Cloud className="h-3.5 w-3.5 text-blue-600" />
                <span>Choose from Google Drive</span>
              </button>

              {/* 3. Choose from OneDrive */}
              <button
                type="button"
                onClick={() => {
                  setCloudTargetProvider('onedrive');
                  setDriveModalOpen(true);
                }}
                disabled={isCloudDownloading}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Cloud className="h-3.5 w-3.5 text-cyan-600" />
                <span>Choose from OneDrive</span>
              </button>

              {/* 4. Prompt Format Button */}
              <button
                type="button"
                onClick={() => setIsPromptMode(!isPromptMode)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs ${
                  isPromptMode
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Prompt Format</span>
              </button>

              {/* 5. Choose from Saved Dropdown */}
              {savedTemplates.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-slate-500" />
                    <span>Saved ({savedTemplates.length})</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                        Choose Saved Template
                      </div>
                      {savedTemplates.map((t) => (
                        <div
                          key={t.id}
                          className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectAndRemember(t);
                              setDropdownOpen(false);
                            }}
                            className="flex-1 truncate pr-2 text-left"
                          >
                            <span className="truncate">{t.title || t.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedTemplate(e, t.id, t.title || t.name)}
                            className="opacity-60 hover:opacity-100 p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-all shrink-0"
                            title="Delete template"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inline Prompt Input Form */}
          {isPromptMode && (
            <form onSubmit={handleApplyPromptTemplate} className="flex gap-2 animate-in fade-in pt-1">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. 'Formal Ministry Memo with Ref at top, Through Chief Director, 4 numbered sections, Signed by Director RSIM'..."
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50/30 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={!promptInput.trim()}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Apply Format
              </button>
            </form>
          )}
        </div>
      )}

      {/* AI Adapt Template Modal */}
      {showAdaptModal && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">AI Adapt Template</h3>
              </div>
              <button
                onClick={() => setShowAdaptModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Describe what you want Gemini to modify or add to <strong>{activeTitle}</strong>:
            </p>

            <textarea
              value={adaptInstruction}
              onChange={(e) => setAdaptInstruction(e.target.value)}
              rows={4}
              placeholder="e.g. 'Add a financial breakdown table under section 3, make the tone diplomatic and formal, and add an endorsement sign-off for the Minister'..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 mb-4"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdaptModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiAdapt}
                disabled={!adaptInstruction.trim() || isAiAdapting}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isAiAdapting ? 'Adapting Template...' : 'Adapt with AI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
