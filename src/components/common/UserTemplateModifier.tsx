import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  BookmarkPlus,
  CheckCircle2,
  Trash2,
  Copy,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  Info,
  Cloud,
  Type,
} from 'lucide-react';
import { UserTemplate } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { api } from '../../services/api';
import {
  getAccessToken,
  uploadFileToDrive,
  learnTemplateFromContent,
  signInWithGoogleDrive,
  initDriveAuth,
  DriveAuthState,
  getDriveAuthState,
} from '../../services/driveService';

interface UserTemplateModifierProps {
  documentType: 'Letter' | 'Memo' | 'Minutes' | 'Report';
  currentTemplate: string;
  onTemplateChange: (template: string) => void;
  onClose?: () => void;
}

export const UserTemplateModifier: React.FC<UserTemplateModifierProps> = ({
  documentType,
  currentTemplate,
  onTemplateChange,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'upload' | 'saved' | 'ai-modify'>('current');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [driveAuth, setDriveAuth] = useState<DriveAuthState>(() => getDriveAuthState());

  useEffect(() => {
    const unsub = initDriveAuth((state) => {
      setDriveAuth(state);
    });
    return () => unsub();
  }, []);

  const [refreshKey, setRefreshKey] = useState(0);
  const savedTemplates = storage.getTemplates().filter((t) => t.documentType === documentType);
  const reloadSaved = () => setRefreshKey((k) => k + 1);

  // Quick modification prompts
  const quickModifications = [
    'Make the tone strictly formal and authoritative',
    'Add reference number and official date block',
    'Add dual signatory blocks for executive review',
    'Restructure with numbered paragraphs (1.0, 2.0, 3.0)',
    'Shorten and make concise for executive reading',
    'Add an Action / Implementation table',
  ];

  // Handle File Upload (.docx, .txt, .pdf) - Straight to Google Drive + Style Learning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFeedback('Uploading and analyzing document...');

    try {
      let extractedText = '';
      let xmlSnippet: string | undefined;
      const isBinary = file.name.endsWith('.docx') || file.name.endsWith('.pdf');

      // 1. If Google Drive is connected, upload straight to Google Drive
      let driveSource = undefined;
      const token = await getAccessToken();
      if (token) {
        setFeedback('Uploading straight to Google Drive...');
        try {
          const driveUploaded = await uploadFileToDrive(file, file.name);
          driveSource = {
            provider: 'google_drive' as const,
            fileId: driveUploaded.id,
            fileName: driveUploaded.name,
            webViewLink: driveUploaded.webViewLink,
            mimeType: driveUploaded.mimeType,
            uploadedAt: new Date().toISOString(),
          };
        } catch (driveErr) {
          console.warn('Google Drive direct upload notice:', driveErr);
        }
      }

      // 2. Read and extract content & XML for exact style learning
      if (isBinary) {
        const arrayBuf = await file.arrayBuffer();
        if (file.name.endsWith('.docx')) {
          try {
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(arrayBuf);
            const docXml = zip.file('word/document.xml') || zip.file(/document\.xml$/i)[0];
            if (docXml) {
              xmlSnippet = await docXml.async('text');
            }
          } catch {}
        }

        const base64Data = btoa(
          new Uint8Array(arrayBuf).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        const res = await api.post('/api/ai/parse-document-file', {
          base64Data,
          fileName: file.name,
          extension: file.name.split('.').pop(),
        });

        if (res.ok && res.data?.extractedText) {
          extractedText = res.data.extractedText;
        }
      } else {
        extractedText = await file.text();
      }

      if (!extractedText) {
        throw new Error('Could not extract text from file.');
      }

      // 3. Learn exact formatting, font size, and tone
      setFeedback('Learning exact font size, margins, and tone...');
      const learned = await learnTemplateFromContent(extractedText, file.name, documentType, xmlSnippet);

      // Save template with learned formatting and Drive source
      const templateToSave: UserTemplate = {
        id: `tpl_${Date.now()}`,
        title: learned.title || file.name,
        name: learned.title || file.name,
        documentType,
        category: (documentType.toLowerCase() + 's') as any,
        source: driveSource ? 'google_drive' : 'upload',
        content: learned.blueprint || extractedText,
        description: `Learned from ${file.name}. Exact ${learned.formatting.fontFamily} (${learned.formatting.bodyFontSize}) & ${learned.toneProfile.formality} tone.${
          driveSource ? ' Uploaded straight to Google Drive.' : ''
        }`,
        fields: learned.fields,
        learnedKnowledge: {
          tone: learned.toneProfile.formality,
          keySections: learned.fields,
          learnedAt: new Date().toISOString(),
          formatting: learned.formatting,
          toneProfile: learned.toneProfile,
          exactStructureBlueprint: learned.blueprint,
        },
        driveSource,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveTemplate(templateToSave);
      reloadSaved();

      onTemplateChange(learned.blueprint || extractedText);
      setFeedback(
        driveSource
          ? `Uploaded straight to Google Drive & learned exact ${learned.formatting.fontFamily} font (${learned.formatting.bodyFontSize}) with ${learned.toneProfile.formality} tone!`
          : `Learned exact ${learned.formatting.fontFamily} font (${learned.formatting.bodyFontSize}) and civil service tone from ${file.name}!`
      );
      setActiveTab('current');
    } catch (err: any) {
      console.error('File parsing error:', err);
      setFeedback('Failed to extract template formatting: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  // Modify Template with Gemini
  const handleModifyWithGemini = async (instructionsToUse?: string) => {
    const prompt = instructionsToUse || customInstructions;
    if (!prompt.trim()) {
      alert('Please specify how you want Gemini to modify the template.');
      return;
    }

    if (!currentTemplate.trim()) {
      alert('Please enter or provide a base template first, or describe the structure you need.');
    }

    setIsModifying(true);
    setFeedback(null);

    try {
      const res = await aiService.modifyTemplate(
        currentTemplate || `[${documentType.toUpperCase()} TEMPLATE]\n[Date]\n[Subject]\n[Body Content]\n[Signatory]`,
        documentType,
        prompt
      );

      if (res.modifiedTemplate) {
        onTemplateChange(res.modifiedTemplate);
        setFeedback('Gemini successfully modified the template to suit your needs!');
        setActiveTab('current');
      }
    } catch (err) {
      console.error('Template modification error:', err);
      setFeedback('Failed to modify template with AI.');
    } finally {
      setIsModifying(false);
    }
  };

  // Save to user templates with AI Learning
  const handleSaveTemplate = async () => {
    if (!saveTitle.trim()) {
      alert('Please give your template a title (e.g., "Official Directorate Letterhead").');
      return;
    }
    if (!currentTemplate.trim()) {
      alert('Template content is empty.');
      return;
    }

    let learnedKnowledge = undefined;
    let detectedType = documentType;

    try {
      const learned = await aiService.learnTemplate(currentTemplate, saveTitle, documentType);
      if (learned && learned.success) {
        detectedType = learned.detectedType || detectedType;
        learnedKnowledge = learned.learnedKnowledge;
      }
    } catch (e) {
      console.warn('Learn template error on save:', e);
    }

    const newTpl: UserTemplate = {
      id: `tpl_${Date.now()}`,
      title: saveTitle.trim(),
      name: saveTitle.trim(),
      documentType: detectedType,
      category: (detectedType.toLowerCase() + 's') as any,
      content: currentTemplate,
      learnedKnowledge,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveTemplate(newTpl);
    reloadSaved();
    setSavedSuccess(true);
    setSaveTitle('');
    setFeedback(`Template saved and AI learned its institutional conventions!`);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <FileText className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-800">
              {documentType} Template & Format
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              User-Defined
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Use your own formatting style. AI will never impose unwanted templates.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'current'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Edit Template
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai-modify')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'ai-modify'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-800 hover:text-emerald-950'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Modify
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'saved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Saved ({savedTemplates.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tab 1: Current Template Editor */}
      {activeTab === 'current' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Paste your custom format, placeholders, or letterhead below:</span>
            {currentTemplate && (
              <button
                type="button"
                onClick={() => onTemplateChange('')}
                className="text-rose-600 hover:underline"
              >
                Clear Template
              </button>
            )}
          </div>

          <textarea
            value={currentTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            rows={7}
            placeholder={`Paste your department or personal ${documentType} template here (e.g. Header, Ref No, Addressee, Salutation, Body structure, Signatory)...`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />

          {/* Save to library */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Name this template to save (e.g. Standard Formal Memo)"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save Template
            </button>
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Upload File */}
      {activeTab === 'upload' && (
        <div className="mt-4 space-y-4">
          {/* Cloud Drive Status Pill */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-[11px] text-blue-900">
                <span className="font-bold">
                  {driveAuth.isConnected ? 'Google Drive Active:' : 'Google Drive:'}
                </span>{' '}
                {driveAuth.isConnected
                  ? `Uploaded templates go straight to your Google Drive and the system learns exact font size & tone.`
                  : 'Connect Google Drive so templates go straight to your Drive folder automatically.'}
              </div>
            </div>

            {!driveAuth.isConnected && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogleDrive();
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs whitespace-nowrap self-start sm:self-auto"
              >
                <span>Connect Drive</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-6 text-center hover:border-emerald-500 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-xs font-bold text-slate-800">
              Upload your existing {documentType} document or template
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Supports Word (.docx), PDF (.pdf), or Text (.txt) files. Uploads straight to Google Drive.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs transition-colors">
              <span>{isUploading ? 'Learning Exact Style...' : 'Choose File to Upload & Learn'}</span>
              <input
                type="file"
                accept=".docx,.pdf,.txt,.doc"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Note: The system will extract the exact font family, title/heading/body sizes, margins, line spacing, and tone of your template document.
          </p>
        </div>
      )}

      {/* Tab 3: AI Modify with Gemini */}
      {activeTab === 'ai-modify' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <span>Modify this template to suit whatever you want</span>
            </div>
            <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
              Tell Google Gemini exactly what changes to make to your template (layout, wording, sections, signatures, or tone).
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Your Instructions for Template Modification:
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. 'Add a financial breakdown table in section 3', 'Change heading to Ministry of Transport', 'Make the memo 1-page executive format'..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Quick One-Click Adjustments:
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickModifications.map((mod, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleModifyWithGemini(mod)}
                  disabled={isModifying}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                >
                  + {mod}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleModifyWithGemini()}
              disabled={isModifying}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isModifying ? 'Gemini is Modifying Template...' : 'Modify Template with Gemini'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Saved Templates */}
      {activeTab === 'saved' && (
        <div className="mt-4 space-y-3">
          {savedTemplates.length > 0 && (
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600">
                {savedTemplates.length} saved {documentType.toLowerCase()} template{savedTemplates.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove all saved ${documentType.toLowerCase()} templates?`)) {
                    savedTemplates.forEach((t) => storage.deleteTemplate(t.id));
                    reloadSaved();
                    onTemplateChange('');
                    setFeedback(`All ${documentType.toLowerCase()} templates removed.`);
                  }
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear All {documentType} Templates</span>
              </button>
            </div>
          )}

          {savedTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              No saved {documentType} templates yet. When you configure a format you like, save it to access it anytime!
            </div>
          ) : (
            <div className="grid gap-2">
              {savedTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{tpl.title}</h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Saved on {new Date(tpl.createdAt).toLocaleDateString()} • {tpl.content.slice(0, 70)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onTemplateChange(tpl.content);
                        setFeedback(`Applied template: "${tpl.title}"`);
                        setActiveTab('current');
                      }}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete saved template "${tpl.title}"?`)) {
                          storage.deleteTemplate(tpl.id);
                          reloadSaved();
                          onTemplateChange('');
                          setFeedback(`Template "${tpl.title}" deleted.`);
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
