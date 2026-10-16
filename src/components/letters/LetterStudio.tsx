import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  Send,
  Wand2,
  BookMarked,
  CheckCircle2,
  Clock,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Paperclip,
  Eye,
  X,
} from 'lucide-react';
import { DocumentItem, UserTemplate } from '../../types';
import { storage } from '../../services/storage';
import { aiService, detectDocumentFormatIntent } from '../../services/aiService';
import { QuickTemplateBar } from '../templates/QuickTemplateBar';
import { WordDocumentViewer } from '../documents/WordDocumentViewer';
import { DocumentModelSelector } from '../common/DocumentModelSelector';
import { attachmentService, ParsedAttachment } from '../../services/attachmentService';

interface LetterStudioProps {
  initialContent?: string;
  onDocumentCreated: (docId: string) => void;
}

export const LetterStudio: React.FC<LetterStudioProps> = ({ initialContent, onDocumentCreated }) => {
  const getInitialTemplate = () => {
    const list = storage.getTemplates();
    const lastId = localStorage.getItem('rsim_last_template_letters');
    if (lastId) {
      const found = list.find((t) => t.id === lastId);
      if (found) return found;
    }
    const driveTemplate = list.find(
      (t) =>
        (t.category === 'letters' || t.documentType === 'Letter' || /letter/i.test(t.title)) &&
        (t.source === 'google_drive' || Boolean(t.driveSource))
    );
    if (driveTemplate) return driveTemplate;

    return list.find((t) => t.category === 'letters' || t.documentType === 'Letter') || list[0] || null;
  };

  const [activeTemplate, setActiveTemplate] = useState<UserTemplate | null>(getInitialTemplate);
  const [instructionPrompt, setInstructionPrompt] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState<string>(() => initialContent || getInitialTemplate()?.content || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('doc_writing_preferred_model') || 'gemini-3.8-flash'
  );
  const [extractedMeta, setExtractedMeta] = useState<{
    subject?: string;
    referenceNumber?: string;
    recipient?: string;
  }>({});

  // Attached Background Notes / Transcripts
  const [attachedFiles, setAttachedFiles] = useState<ParsedAttachment[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<ParsedAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check incoming handoff notes from Transcribe / Documents
  useEffect(() => {
    const checkHandoff = async () => {
      try {
        const handoff = await attachmentService.getHandoffTranscript('letters');
        if (handoff && handoff.transcript) {
          const words = handoff.transcript.split(/\s+/).filter(Boolean).length;
          const attachment: ParsedAttachment = {
            id: `handoff_${Date.now()}`,
            name: `${handoff.title || 'Meeting Notes'}.txt`,
            type: 'text/plain',
            size: handoff.transcript.length,
            extractedText: handoff.transcript,
            wordCount: words,
          };
          setAttachedFiles((prev) => [...prev, attachment]);
          await attachmentService.clearHandoffTranscript('letters');
        }
      } catch (err) {
        console.warn('Handoff reception error in LetterStudio:', err);
      }
    };
    checkHandoff();
  }, []);

  useEffect(() => {
    if (initialContent) {
      setGeneratedLetter(initialContent);
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

  const quickLetterPrompts = [
    {
      title: 'Invitation to Minister',
      text: 'Write an official letter to the Hon. Minister for Communications & Digitalisation inviting her to deliver the keynote address at the 2026 National Data Governance Summit in Accra on October 24th.',
    },
    {
      title: 'Workshop Concurrence',
      text: 'Write an official letter to the Head of Civil Service requesting formal concurrence and nomination of 5 senior officers to attend our 3-day regional statistics workshop.',
    },
    {
      title: 'Follow-up on Telecom Survey',
      text: 'Write an official letter to the Director General of the National Communications Authority following up on the joint Q3 telecom infrastructure audit report.',
    },
    {
      title: 'Inter-Agency Coordination',
      text: 'Write an official letter to the Ghana Statistical Service requesting administrative data integration for the upcoming 2026-2027 institutional dashboard.',
    },
  ];

  // PRIMARY AI ACTION: Uses the template's structure, tone, and style to execute the user's prompt
  const handleGenerateFromPrompt = async (textToUse?: string) => {
    const prompt = (textToUse !== undefined ? textToUse : instructionPrompt).trim();
    const sourceNotes = attachedFiles.map((a) => a.extractedText || a.text || '').filter(Boolean).join('\n\n');

    if (!prompt && !sourceNotes) {
      alert('Please enter instructions or attach notes/transcripts for the letter.');
      return;
    }

    const effectivePrompt = prompt || 'Draft an official institutional letter based on the attached background notes.';

    setIsGenerating(true);
    try {
      const templatesPool = activeTemplate ? [activeTemplate] : storage.getTemplates();
      const user = storage.getUser();

      const res = await aiService.intelligentWrite(effectivePrompt, 'Letter', templatesPool, {
        name: user.name,
        department: user.department,
        role: user.role,
      }, {
        transcript: sourceNotes || undefined,
        preferredModel: selectedModel,
        templateSpec: activeTemplate?.templateSpec,
      });

      if (res.fullDraft) {
        setGeneratedLetter(res.fullDraft);
        setExtractedMeta({
          subject: res.subject,
          referenceNumber: res.referenceNumber,
          recipient: res.recipient,
        });
      }
    } catch (err: any) {
      console.error('Error drafting letter from instruction:', err);
      alert('Could not complete letter draft with Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDocuments = () => {
    if (!generatedLetter.trim()) {
      alert('No letter draft to save.');
      return;
    }

    const docId = `doc_let_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: docId,
      title: extractedMeta.subject ? `Letter: ${extractedMeta.subject}` : 'Official Letter',
      type: 'Official Letter',
      category: 'Letters',
      referenceNumber: extractedMeta.referenceNumber || `RSIM/LET/2026/${Math.floor(100 + Math.random() * 900)}`,
      recipient: extractedMeta.recipient || 'The Recipient',
      content: generatedLetter,
      author: storage.getUser().name,
      version: 1,
      versions: [],
      approvalStatus: 'Draft',
      comments: [],
      tags: ['Letter', 'AI-Drafted', 'Official'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveDocument(newDoc);
    onDocumentCreated(docId);
  };

  const isWriteEnabled = Boolean(instructionPrompt.trim().length > 0 || attachedFiles.length > 0);

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
          <FileText className="h-5 w-5 text-emerald-700" />
          Official Letter Studio
        </h2>
        <p className="text-xs text-slate-500">
          Provide your template and instruction prompt. Google Gemini learns the structure, tone, and style, then writes the complete letter for you.
        </p>
      </div>

      {/* STEP 1: THE TEMPLATE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5 text-emerald-700" />
            Step 1: Your Letter Template (Style, Structure & Tone)
          </span>
          {activeTemplate?.learnedKnowledge && (
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Tone: {activeTemplate.learnedKnowledge.tone || 'Formal Civil Service'} • Ref: {activeTemplate.learnedKnowledge.referenceFormat || 'Standard'}
            </span>
          )}
        </div>

        <QuickTemplateBar
          category="letters"
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
                Step 2: Give Your Prompt / Instructions or Attach Notes
              </h3>
              <p className="text-[11px] text-slate-500">
                Describe who to write to and what you want to say. Gemini applies your template's layout, styling, and salutations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="self-start sm:self-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              Powered by Google Gemini
            </span>
          </div>
        </div>

        {/* Textarea for natural language prompt */}
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-inner focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <textarea
            value={instructionPrompt}
            onChange={(e) => setInstructionPrompt(e.target.value)}
            placeholder="e.g. Write an official letter to the Minister for Communications requesting executive approval and sponsorship for the 2026 National Cybersecurity Awareness Month summit in Accra..."
            rows={3}
            className="w-full resize-none rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerateFromPrompt();
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
              {instructionPrompt && (
                <button
                  type="button"
                  onClick={() => setInstructionPrompt('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear Prompt
                </button>
              )}
              <button
                type="button"
                disabled={isGenerating || !isWriteEnabled}
                onClick={() => handleGenerateFromPrompt()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Writing Letter with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Write Letter</span>
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
          {quickLetterPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInstructionPrompt(item.text);
                handleGenerateFromPrompt(item.text);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 transition-colors shadow-2xs"
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 3: WORD DOCUMENT VIEWER (High-Fidelity Output) */}
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
          title={extractedMeta.subject ? `RE: ${extractedMeta.subject.toUpperCase()}` : (activeTemplate?.title ? `Draft: ${activeTemplate.title}` : 'Official Letter')}
          content={
            generatedLetter ||
            (activeTemplate
              ? `[TEMPLATE READY: ${activeTemplate.title}]\n\nThe structural format and letterhead from "${activeTemplate.title}" will guide your letter.\n\nEnter your letter prompt in Step 2 and click "Draft Official Letter" to draft text strictly synthesized from your request.`
              : '')
          }
          referenceNumber={extractedMeta.referenceNumber || 'RSIM/LET/2026/014'}
          date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          author={storage.getUser().name || 'Director, RSIM'}
          department="MINISTRY OF COMMUNICATIONS & DIGITALISATION"
          type="Official Letter"
          formatting={activeTemplate?.learnedKnowledge?.formatting || (activeTemplate?.templateSpec ? { font: activeTemplate.templateSpec.detectedFont, fontSize: activeTemplate.templateSpec.detectedFontSize } : undefined)}
          onContentChange={(newContent) => setGeneratedLetter(newContent)}
          onSave={handleSaveToDocuments}
          onClear={() => setGeneratedLetter('')}
        />
      </div>
    </div>
  );
};
