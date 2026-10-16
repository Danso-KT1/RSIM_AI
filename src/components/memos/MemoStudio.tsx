import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Mail,
  Wand2,
  BookMarked,
  Lightbulb,
  RefreshCw,
  Paperclip,
  Eye,
  X,
  CheckCircle2,
} from 'lucide-react';
import { DocumentItem, UserTemplate } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { QuickTemplateBar } from '../templates/QuickTemplateBar';
import { WordDocumentViewer } from '../documents/WordDocumentViewer';
import { DocumentModelSelector } from '../common/DocumentModelSelector';
import { attachmentService, ParsedAttachment } from '../../services/attachmentService';

interface MemoStudioProps {
  initialContent?: string;
  onDocumentCreated: (docId: string) => void;
}

export const MemoStudio: React.FC<MemoStudioProps> = ({ initialContent, onDocumentCreated }) => {
  const getInitialTemplate = () => {
    const list = storage.getTemplates();
    const lastId = localStorage.getItem('rsim_last_template_memos');
    if (lastId) {
      const found = list.find((t) => t.id === lastId);
      if (found) return found;
    }
    const driveTemplate = list.find(
      (t) =>
        (t.category === 'memos' || t.documentType === 'Memo' || /memo/i.test(t.title)) &&
        (t.source === 'google_drive' || Boolean(t.driveSource))
    );
    if (driveTemplate) return driveTemplate;

    return list.find((t) => t.category === 'memos' || t.documentType === 'Memo') || list[0] || null;
  };

  const [activeTemplate, setActiveTemplate] = useState<UserTemplate | null>(getInitialTemplate);
  const [memoPrompt, setMemoPrompt] = useState('');
  const [generatedMemo, setGeneratedMemo] = useState<string>(() => initialContent || getInitialTemplate()?.content || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('doc_writing_preferred_model') || 'gemini-3.8-flash'
  );
  const [extractedMeta, setExtractedMeta] = useState<{
    subject?: string;
    referenceNumber?: string;
    to?: string;
    through?: string;
    from?: string;
  }>({});

  // Attached Background Notes / Transcripts
  const [attachedFiles, setAttachedFiles] = useState<ParsedAttachment[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<ParsedAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialContent) {
      setGeneratedMemo(initialContent);
    }
  }, [initialContent]);

  const handleSelectTemplate = (t: UserTemplate | null) => {
    setActiveTemplate(t);
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsReadingFile(true);
    const newAttachments: ParsedAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const parsed = await attachmentService.parseFile(files[i]);
        newAttachments.push(parsed);
      } catch (err: any) {
        alert(`Error parsing ${files[i].name}: ${err.message || 'Failed to read file.'}`);
      }
    }
    if (newAttachments.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newAttachments]);
    }
    setIsReadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = async (id: string) => {
    await attachmentService.deleteVaultAttachment(id);
    setAttachedFiles((prev) => prev.filter((a) => a.id !== id));
  };

  const quickStarters = [
    {
      title: 'Vehicle & Fuel Request',
      text: 'Request approval from the Chief Director through Director Finance & Admin to release 3 project vehicles and GHS 14,500 fuel imprest for a 5-day regional monitoring mission next week to inspect telecom infrastructure in the Western Region.',
    },
    {
      title: 'Procure IT Hardware',
      text: 'Request approval from the Chief Director to procure 5 new Dell desktop computers and 2 high-capacity network printers for the RSIM Directorate to replace faulty machines before the Q3 reporting cycle.',
    },
    {
      title: 'Workshop Concurrence',
      text: 'Request executive approval and financial concurrence for GHS 28,000 to organize the 2-day Digital Public Infrastructure Stakeholder Validation Workshop at Alisa Hotel on 15th October.',
    },
    {
      title: 'Contractor Delay Notice',
      text: 'Bring to the attention of leadership the 4-week delivery delay by the fiber optic contractor on the Eastern Corridor link, and recommend issuing a formal cure notice under clause 14.',
    },
  ];

  const handleGenerateMemo = async (textToUse?: string) => {
    const prompt = (textToUse !== undefined ? textToUse : memoPrompt).trim();
    const sourceNotes = attachedFiles.map((a) => a.extractedText || a.text || '').filter(Boolean).join('\n\n');

    if (!prompt && !sourceNotes) {
      alert('Please describe what you want to write in the memo or attach source notes.');
      return;
    }

    const effectivePrompt = prompt || 'Draft a formal institutional internal memorandum based on the attached background notes.';

    setIsGenerating(true);
    try {
      const templatesPool = activeTemplate ? [activeTemplate] : storage.getTemplates();
      const user = storage.getUser();

      const res = await aiService.intelligentWrite(effectivePrompt, 'Memo', templatesPool, {
        name: user.name,
        department: user.department,
        role: user.role,
      }, {
        transcript: sourceNotes || undefined,
        preferredModel: selectedModel,
        templateSpec: activeTemplate?.templateSpec,
      });

      if (res.fullDraft) {
        setGeneratedMemo(res.fullDraft);
        setExtractedMeta({
          subject: res.subject,
          referenceNumber: res.referenceNumber,
          to: res.recipient,
          from: res.sender,
        });
      }
    } catch (err: any) {
      console.error('Memo generation error:', err);
      alert('Could not draft memo with Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDocuments = () => {
    if (!generatedMemo.trim()) {
      alert('No memo draft to save.');
      return;
    }

    const docId = `doc_mem_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: docId,
      title: extractedMeta.subject ? `Memo: ${extractedMeta.subject}` : 'Internal Memorandum',
      type: 'Internal Memo',
      category: 'Memos',
      referenceNumber: extractedMeta.referenceNumber || `RSIM/MEMO/2026/${Math.floor(10 + Math.random() * 90)}`,
      content: generatedMemo,
      author: storage.getUser().name,
      version: 1,
      versions: [],
      approvalStatus: 'Draft',
      comments: [],
      tags: ['Memo', 'AI-Drafted'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveDocument(newDoc);
    onDocumentCreated(docId);
  };

  const isWriteEnabled = Boolean(memoPrompt.trim().length > 0 || attachedFiles.length > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.docx,.dotx,.pdf,.srt,.vtt,.md"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFileUpload(e.target.files);
        }}
      />

      {/* Preview Attachment Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">{previewAttachment.name}</h3>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-96 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {previewAttachment.extractedText || previewAttachment.text || 'No text extracted.'}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Mail className="h-5 w-5 text-emerald-700" />
          Internal Memorandum Studio
        </h2>
        <p className="text-xs text-slate-500">
          Provide your template and instructions. Google Gemini learns the structure, tone, and style, then writes the complete civil service memo.
        </p>
      </div>

      {/* STEP 1: THE TEMPLATE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5 text-emerald-700" />
            Step 1: Your Memo Template (Style, Routing & Headings)
          </span>
          {activeTemplate?.learnedKnowledge && (
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Sections: {activeTemplate.learnedKnowledge.keySections?.slice(0, 3).join(', ') || 'Purpose, Background, Recommendations'}
            </span>
          )}
        </div>

        <QuickTemplateBar
          category="memos"
          activeTemplate={activeTemplate}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

      {/* STEP 2: USER INSTRUCTION PROMPT */}
      <div className="rounded-2xl border-2 border-emerald-200/80 bg-linear-to-b from-emerald-50/50 via-white to-white p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
              <Wand2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Step 2: Give Your Prompt / Memo Purpose or Attach Notes
              </h3>
              <p className="text-[11px] text-slate-500">
                Mention the action requested, justification, and recommendations. Gemini formats into formal civil service memorandum structure.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
            Powered by Google Gemini
          </span>
        </div>

        {/* Textarea for natural language prompt */}
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-inner focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <textarea
            value={memoPrompt}
            onChange={(e) => setMemoPrompt(e.target.value)}
            placeholder="e.g. Request approval from the Chief Director through Director Finance & Admin to release 3 project vehicles and GHS 14,500 fuel imprest for a 5-day regional monitoring mission next week..."
            rows={4}
            className="w-full resize-none rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerateMemo();
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-xl gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingFile || isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Attach background notes or transcript (.txt, .docx, .pdf)"
              >
                <Paperclip className="h-3.5 w-3.5 text-emerald-700" />
                <span>Attach Notes / Transcript</span>
              </button>

              {/* Model Selector (Gemini 3.8 Flash default, Llama 3.3 70B, etc. DeepSeek excluded) */}
              <DocumentModelSelector
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                disabled={isGenerating}
              />

              {isReadingFile && (
                <span className="text-[11px] text-emerald-700 animate-pulse font-medium">Reading file...</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {memoPrompt && (
                <button
                  type="button"
                  onClick={() => setMemoPrompt('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear Prompt
                </button>
              )}
              <button
                type="button"
                disabled={isGenerating || !isWriteEnabled}
                onClick={() => handleGenerateMemo()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Writing Memo with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Write Memo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Attached Notes Chips */}
        {attachedFiles.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Attached Notes ({attachedFiles.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span className="text-xs font-bold text-emerald-950 truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md"
                    title="Preview extracted text"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.id)}
                    className="p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-md"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Example Starters */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-amber-500" />
            Quick Examples:
          </span>
          {quickStarters.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setMemoPrompt(item.text);
                handleGenerateMemo(item.text);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 transition-colors shadow-2xs"
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 3: WORD DOCUMENT VIEWER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-emerald-700" />
            Step 3: Document Output & Word Export
          </span>
          {extractedMeta.referenceNumber && (
            <span className="text-[11px] text-slate-500 font-mono">
              Ref: {extractedMeta.referenceNumber}
            </span>
          )}
        </div>

        <WordDocumentViewer
          title={extractedMeta.subject ? `MEMO: ${extractedMeta.subject.toUpperCase()}` : (activeTemplate?.title ? `Draft: ${activeTemplate.title}` : 'Internal Memorandum')}
          content={
            generatedMemo ||
            (activeTemplate
              ? `[TEMPLATE READY: ${activeTemplate.title}]\n\nThe structural format and headers from "${activeTemplate.title}" will guide your memo.\n\nEnter your memo request in Step 2 and click "Draft Internal Memo" to draft text strictly synthesized from your request.`
              : '')
          }
          referenceNumber={extractedMeta.referenceNumber || 'RSIM/MEMO/2026/018'}
          date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          author={storage.getUser().name || 'Lead Planning Officer'}
          department="MINISTRY OF COMMUNICATIONS & DIGITALISATION"
          type="Internal Memo"
          formatting={activeTemplate?.learnedKnowledge?.formatting || (activeTemplate?.templateSpec ? { font: activeTemplate.templateSpec.detectedFont, fontSize: activeTemplate.templateSpec.detectedFontSize } : undefined)}
          onContentChange={(newContent) => setGeneratedMemo(newContent)}
          onSave={handleSaveToDocuments}
          onClear={() => setGeneratedMemo('')}
        />
      </div>
    </div>
  );
};
