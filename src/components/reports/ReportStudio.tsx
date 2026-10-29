import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FileCheck2,
  Wand2,
  BookMarked,
  Lightbulb,
  RefreshCw,
  Paperclip,
  Database,
  Search,
  Eye,
  X,
  CheckCircle2,
} from 'lucide-react';
import { DocumentItem, UserTemplate } from '../../types';
import { storage } from '../../services/storage';
import { aiService, detectDocumentFormatIntent } from '../../services/aiService';
import { QuickTemplateBar } from '../templates/QuickTemplateBar';
import { WordDocumentViewer } from '../documents/WordDocumentViewer';
import { DocumentModelSelector } from '../common/DocumentModelSelector';
import { DEFAULT_HF_MODEL } from '../../constants/aiModels';
import {
  attachmentService,
  ParsedAttachment,
} from '../../services/attachmentService';

interface ReportStudioProps {
  initialContent?: string;
  onDocumentCreated: (docId: string) => void;
}

export const ReportStudio: React.FC<ReportStudioProps> = ({ initialContent, onDocumentCreated }) => {
  const getInitialTemplate = () => {
    const list = storage.getTemplates();
    const lastId = localStorage.getItem('rsim_last_template_reports');
    if (lastId) {
      const found = list.find((t) => t.id === lastId);
      if (found) return found;
    }
    const driveTemplate = list.find(
      (t) =>
        (t.category === 'reports' || t.documentType === 'Report' || /report|stakeholder/i.test(t.title)) &&
        (t.source === 'google_drive' || Boolean(t.driveSource))
    );
    if (driveTemplate) return driveTemplate;

    return list.find((t) => t.category === 'reports' || t.documentType === 'Report') || list[0] || null;
  };

  const [activeTemplate, setActiveTemplate] = useState<UserTemplate | null>(getInitialTemplate);
  const [reportPrompt, setReportPrompt] = useState('');
  const [transcriptInput, setTranscriptInput] = useState(initialContent || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('doc_writing_preferred_model') || 'gemini-3.8-flash';
  });

  // Attached Transcript Files
  const [attachedFiles, setAttachedFiles] = useState<ParsedAttachment[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [readingFileProgress, setReadingFileProgress] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // File Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<ParsedAttachment | null>(null);

  // Saved Transcripts Modal
  const [savedTranscriptsModalOpen, setSavedTranscriptsModalOpen] = useState(false);
  const [savedTranscriptSearch, setSavedTranscriptSearch] = useState('');

  const [generatedReport, setGeneratedReport] = useState<string>(() => initialContent || getInitialTemplate()?.content || '');
  const [extractedMeta, setExtractedMeta] = useState<{
    title?: string;
    referenceNumber?: string;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handoff reception on mount from Transcribe workspace
  useEffect(() => {
    const checkHandoff = async () => {
      try {
        const handoff = await attachmentService.getHandoffTranscript('reports');
        if (handoff && handoff.transcript) {
          const words = handoff.transcript.split(/\s+/).filter(Boolean).length;
          const handoffAttachment: ParsedAttachment = {
            id: `handoff_${Date.now()}`,
            name: `${handoff.title || 'Executive Proceedings'}.txt`,
            type: 'text/plain',
            size: handoff.transcript.length,
            extractedText: handoff.transcript,
            wordCount: words,
          };
          setAttachedFiles((prev) => [...prev, handoffAttachment]);
          setTranscriptInput((prev) => (prev ? `${prev}\n\n${handoff.transcript}` : (handoff.transcript || '')));
          await attachmentService.clearHandoffTranscript('reports');
        }
      } catch (err) {
        console.warn('Handoff transcript reception check notice:', err);
      }
    };
    checkHandoff();
  }, []);

  useEffect(() => {
    if (initialContent) {
      setGeneratedReport(initialContent);
      setTranscriptInput(initialContent);
    }
  }, [initialContent]);

  // Handle local file selection (.txt, .docx, .pdf, .srt, .vtt, .md)
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsReadingFile(true);
    setReadingFileProgress('Reading and parsing file...');

    const newAttachments: ParsedAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setReadingFileProgress(`Parsing ${file.name}...`);
      try {
        const parsed = await attachmentService.parseFile(file);
        newAttachments.push(parsed);
      } catch (err: any) {
        alert(`Error processing ${file.name}: ${err.message || 'Could not parse file.'}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newAttachments]);
      const combinedText = newAttachments.map((a) => a.extractedText || a.text || '').filter(Boolean).join('\n\n');
      setTranscriptInput((prev) => (prev ? `${prev}\n\n${combinedText}` : combinedText));
    }

    setIsReadingFile(false);
    setReadingFileProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = async (id: string) => {
    await attachmentService.deleteVaultAttachment(id);
    setAttachedFiles((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      const remainingText = filtered.map((a) => a.extractedText || a.text || '').join('\n\n');
      setTranscriptInput(remainingText);
      return filtered;
    });
  };

  // Saved Transcripts List
  const savedTranscripts = React.useMemo(() => {
    const list: Array<{ id: string; title: string; date: string; text: string; source: string; wordCount: number }> = [];

    const storedMeetings = storage.getMeetings();
    storedMeetings.forEach((m) => {
      if (m.transcript && m.transcript.length > 0) {
        const fullTxt = m.transcript.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n');
        list.push({
          id: `mtg_${m.id}`,
          title: m.title || 'Recorded Meeting Session',
          date: m.date || new Date().toLocaleDateString('en-GB'),
          text: fullTxt,
          source: 'Transcribe Studio',
          wordCount: fullTxt.split(/\s+/).filter(Boolean).length,
        });
      } else if (m.notes && m.notes.length > 50) {
        list.push({
          id: `mtg_note_${m.id}`,
          title: `${m.title || 'Meeting'} (Notes)`,
          date: m.date || new Date().toLocaleDateString('en-GB'),
          text: m.notes,
          source: 'Transcribe Notes',
          wordCount: m.notes.split(/\s+/).filter(Boolean).length,
        });
      }
    });

    const storedDocs = storage.getDocuments();
    storedDocs.forEach((d) => {
      if (
        d.category === 'Reports' ||
        d.type === 'Meeting Report' ||
        d.type === 'Executive Report' ||
        d.title.toLowerCase().includes('transcript')
      ) {
        list.push({
          id: `doc_${d.id}`,
          title: d.title,
          date: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '',
          text: d.content,
          source: 'Documents Repository',
          wordCount: (d.content || '').split(/\s+/).filter(Boolean).length,
        });
      }
    });

    return list;
  }, [savedTranscriptsModalOpen]);

  const filteredSavedTranscripts = savedTranscripts.filter(
    (t) =>
      t.title.toLowerCase().includes(savedTranscriptSearch.toLowerCase()) ||
      t.source.toLowerCase().includes(savedTranscriptSearch.toLowerCase())
  );

  const handleSelectSavedTranscript = (t: { title: string; text: string }) => {
    const attachment: ParsedAttachment = {
      id: `saved_${Date.now()}`,
      name: `${t.title}.txt`,
      type: 'text/plain',
      size: t.text.length,
      extractedText: t.text,
      wordCount: t.text.split(/\s+/).filter(Boolean).length,
    };
    setAttachedFiles((prev) => [...prev, attachment]);
    setTranscriptInput((prev) => (prev ? `${prev}\n\n${t.text}` : t.text));
    setSavedTranscriptsModalOpen(false);
  };

  const handleSelectTemplate = (t: UserTemplate | null) => {
    setActiveTemplate(t);
  };

  const quickReportStarters = [
    {
      title: 'Q3 Progress Report',
      text: 'Write a comprehensive Q3 2026 Directorate Progress Report covering the roll-out of government digital services, regional ICT monitoring findings, challenges with contractor delays, and key recommendations for Q4 budget expansion.',
    },
    {
      title: 'Field Inspection Report',
      text: 'Write an executive technical inspection report covering our 5-day monitoring mission across 12 Community Information Centers in the Western Region, detailing hardware conditions, solar power status, and required maintenance.',
    },
    {
      title: 'Annual Performance Review',
      text: 'Write an annual performance evaluation report for the RSIM Directorate highlighting milestone achievements in national statistics, citizen satisfaction survey results, and strategic goals for 2027.',
    },
  ];

  const handleGenerateReport = async (textToUse?: string) => {
    const prompt = (textToUse !== undefined ? textToUse : reportPrompt).trim();
    const attachmentsText = attachedFiles.map((a) => a.extractedText || a.text || '').filter(Boolean).join('\n\n');
    const fullTranscript = (transcriptInput.trim() || attachmentsText).trim();

    if (!prompt && !fullTranscript && attachedFiles.length === 0) {
      alert('Please enter instructions or attach a source transcript for the report.');
      return;
    }

    const effectivePrompt =
      prompt || 'Synthesize and draft a comprehensive institutional directorate report based strictly on the attached source material.';

    setIsGenerating(true);
    setGenerationProgress('Consulting template and synthesizing report...');
    try {
      const templatesPool = activeTemplate ? [activeTemplate] : storage.getTemplates();
      const user = storage.getUser();

      const res = await aiService.intelligentWrite(
        effectivePrompt,
        'Report',
        templatesPool,
        {
          name: user.name,
          department: user.department,
          role: user.role,
        },
        {
          transcript: fullTranscript || undefined,
          preferredModel: selectedModel,
          templateSpec: activeTemplate?.templateSpec || (activeTemplate?.learnedKnowledge as any)?.templateSpec,
          onProgress: (status) => setGenerationProgress(status),
        }
      );

      if (res.fullDraft) {
        setGeneratedReport(res.fullDraft);
        setExtractedMeta({
          title: res.title || res.subject,
          referenceNumber: res.referenceNumber,
        });
      }
    } catch (err: any) {
      console.error('Report generation error:', err);
      alert('Could not draft report with Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleSaveToDocuments = () => {
    if (!generatedReport.trim()) {
      alert('No report draft to save.');
      return;
    }

    const docId = `doc_rep_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: docId,
      title: extractedMeta.title || (activeTemplate?.title || 'Directorate Progress Report'),
      type: 'Meeting Report',
      category: 'Reports',
      referenceNumber: extractedMeta.referenceNumber || `RSIM/REP/2026/${Math.floor(10 + Math.random() * 90)}`,
      content: generatedReport,
      author: storage.getUser().name,
      version: 1,
      versions: [],
      approvalStatus: 'Draft',
      comments: [],
      tags: ['Report', 'AI-Drafted'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveDocument(newDoc);
    onDocumentCreated(docId);
  };

  const isWriteEnabled = Boolean(
    reportPrompt.trim().length > 0 ||
    transcriptInput.trim().length > 0 ||
    attachedFiles.length > 0
  );

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

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">{previewAttachment.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    {previewAttachment.wordCount || 0} words • {(((previewAttachment.size || 0)) / 1024).toFixed(1)} KB
                  </p>
                </div>
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

      {/* Saved Transcripts Selector Modal */}
      {savedTranscriptsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Choose Saved Transcription</h3>
              </div>
              <button
                onClick={() => setSavedTranscriptsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={savedTranscriptSearch}
                onChange={(e) => setSavedTranscriptSearch(e.target.value)}
                placeholder="Search saved transcripts from Transcribe & Documents..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredSavedTranscripts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No saved transcripts found matching your search.
                </div>
              ) : (
                filteredSavedTranscripts.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-sm">{t.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        {t.source} • {t.wordCount} words {t.date ? `• ${t.date}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectSavedTranscript(t)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs"
                    >
                      Attach
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSavedTranscriptsModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-emerald-700" />
          Executive Report Studio
        </h2>
        <p className="text-xs text-slate-500">
          Provide your template and instructions. Google Gemini learns the structure, tone, and style, then writes the complete institutional report.
        </p>
      </div>

      {/* STEP 1: THE TEMPLATE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5 text-emerald-700" />
            Step 1: Your Report Template (Style, Structure & Sections)
          </span>
          {activeTemplate?.learnedKnowledge && (
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Sections: {activeTemplate.learnedKnowledge.keySections?.slice(0, 4).join(' -> ') || 'Executive Summary -> Findings -> Recommendations'}
            </span>
          )}
        </div>

        <QuickTemplateBar
          category="reports"
          activeTemplate={activeTemplate}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

      {/* STEP 2: USER INSTRUCTION PROMPT & TRANSCRIPT ATTACHMENTS */}
      <div
        ref={dropZoneRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
        }}
        className="rounded-2xl border-2 border-emerald-200/80 bg-linear-to-b from-emerald-50/50 via-white to-white p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
              <Wand2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Step 2: Give Your Prompt / Reporting Instructions or Source Transcript
              </h3>
              <p className="text-[11px] text-slate-500">
                Describe the reporting period, statistics, and recommendations, or attach a transcription file. Gemini synthesizes the full report.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
            Powered by Google Gemini
          </span>
        </div>

        {/* Stakeholder Format Intent Banner */}
        {(/stakeholder|harmonisa?tion/i.test(reportPrompt) || /stakeholder|harmonisa?tion/i.test(activeTemplate?.title || '')) && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50/90 border border-emerald-200/90 px-3 py-2 text-xs text-emerald-950 shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Stakeholder Engagement Report Detected:</span>{' '}
              <span className="text-emerald-800">
                Adopting Google Drive 3-section narrative layout in Times New Roman. Zero minutes metadata or 2-column tables will be generated.
              </span>
            </div>
          </div>
        )}

        {/* Textarea for natural language prompt */}
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-inner focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <textarea
            value={reportPrompt}
            onChange={(e) => setReportPrompt(e.target.value)}
            placeholder="e.g. Write a comprehensive stakeholder engagement report covering the data harmonisation meeting, inter-agency deliberations, challenges, and agreed next steps..."
            rows={4}
            className="w-full resize-none rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerateReport();
              }
            }}
          />

          {/* Action Toolbar Inside Textbox */}
          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-xl gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Attach Transcript Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingFile || isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                title="Attach source file (.txt, .docx, .pdf, .srt, .vtt, .md)"
              >
                <Paperclip className="h-3.5 w-3.5 text-emerald-700" />
                <span>Attach Transcript</span>
              </button>

              {/* Use Saved Transcription */}
              <button
                type="button"
                onClick={() => setSavedTranscriptsModalOpen(true)}
                disabled={isReadingFile || isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                title="Pick a transcript saved from Transcribe Studio or Documents"
              >
                <Database className="h-3.5 w-3.5 text-blue-600" />
                <span>Use Saved Transcription</span>
              </button>

              {/* Model Selector (Gemini 3.8 Flash default, Llama 3.3 70B, etc. DeepSeek excluded) */}
              <DocumentModelSelector
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                disabled={isGenerating}
              />

              {isReadingFile && (
                <span className="text-[11px] text-emerald-700 animate-pulse font-medium flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {readingFileProgress || 'Reading file...'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {reportPrompt && (
                <button
                  type="button"
                  onClick={() => setReportPrompt('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear Prompt
                </button>
              )}
              <button
                type="button"
                disabled={isGenerating || !isWriteEnabled}
                onClick={() => handleGenerateReport()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>{generationProgress || 'Writing Report with Gemini...'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Write Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Attached Transcript Chips */}
        {attachedFiles.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Attached Source Material ({attachedFiles.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <div className="max-w-[220px] truncate">
                    <span className="text-xs font-bold text-emerald-950 truncate block">{file.name}</span>
                    <span className="text-[10px] text-emerald-700 block">
                      {file.wordCount || 0} words • {(((file.size || 0)) / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                    title="Preview extracted text"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.id)}
                    className="p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-md transition-colors"
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
          {quickReportStarters.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setReportPrompt(item.text);
                handleGenerateReport(item.text);
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
          title={extractedMeta.title || (activeTemplate?.title ? `Draft: ${activeTemplate.title}` : 'Directorate Progress Report')}
          content={
            generatedReport ||
            (activeTemplate
              ? `[TEMPLATE READY: ${activeTemplate.title}]\n\nThe structural format and sections from "${activeTemplate.title}" will guide your report.\n\nEnter your report instructions or attach source material in Step 2 and click "Generate Report" to draft proceedings synthesized strictly from your source material.`
              : '')
          }
          referenceNumber={extractedMeta.referenceNumber || 'RSIM/REP/2026/03'}
          date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          author={storage.getUser().name || 'Lead Planning Officer'}
          department="MINISTRY OF COMMUNICATIONS, DIGITAL TECHNOLOGY AND INNOVATIONS"
          type="Meeting Report"
          formatting={activeTemplate?.learnedKnowledge?.formatting || (activeTemplate?.templateSpec ? { font: activeTemplate.templateSpec.detectedFont, fontSize: activeTemplate.templateSpec.detectedFontSize } : undefined)}
          onContentChange={(newContent) => setGeneratedReport(newContent)}
          onSave={handleSaveToDocuments}
          onClear={() => setGeneratedReport('')}
        />
      </div>
    </div>
  );
};
