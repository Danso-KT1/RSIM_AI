import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  FileText,
  Mail,
  Clock,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  BookMarked,
  Loader2,
  X,
  Copy,
  MessageSquare,
  RefreshCw,
  Undo2,
  Zap,
  Cloud,
  Mic,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserTemplate, DocumentItem } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { WordDocumentViewer } from '../documents/WordDocumentViewer';
import { QuickTemplateBar } from '../templates/QuickTemplateBar';
import { VoiceInput } from './VoiceInput';
import { exportToDocx } from '../../utils/docxExporter';
import { uploadFileToDrive, getAccessToken } from '../../services/driveService';
import { DEFAULT_HF_MODEL } from '../../constants/aiModels';

interface IntelligentWriterProps {
  onDocumentCreated?: (docId: string) => void;
  onNavigateToStudio?: (studio: 'letters' | 'memos' | 'minutes' | 'reports') => void;
  initialPrompt?: string;
  className?: string;
}

export const IntelligentWriter: React.FC<IntelligentWriterProps> = ({
  onDocumentCreated,
  onNavigateToStudio,
  initialPrompt = '',
  className = '',
}) => {
  const [instruction, setInstruction] = useState(initialPrompt);
  const [requestedType, setRequestedType] = useState<'auto' | 'Letter' | 'Memo' | 'Minutes' | 'Report'>('auto');
  const [selectedTemplate, setSelectedTemplate] = useState<UserTemplate | null>(null);

  // Dual-Mode Prompt Input states (Mode A: with transcription vs Mode B: prompt only)
  const [transcriptInput, setTranscriptInput] = useState('');
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);

  // Live auto-matched template based on user prompt keywords
  const [liveMatchedTemplate, setLiveMatchedTemplate] = useState<{ template: any | null; score: number; reason: string } | null>(null);

  useEffect(() => {
    if (!instruction || instruction.trim().length < 5) {
      setLiveMatchedTemplate(null);
      return;
    }
    const timer = setTimeout(() => {
      const match = aiService.findBestMatchingTemplate(instruction + ' ' + transcriptInput);
      if (match.template) {
        setLiveMatchedTemplate(match);
      } else {
        setLiveMatchedTemplate(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [instruction, transcriptInput]);

  const isModeA = Boolean(transcriptInput && transcriptInput.trim().length > 10);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
    documentType: 'Letter' | 'Memo' | 'Minutes' | 'Report';
    title: string;
    subject: string;
    referenceNumber: string;
    recipient: string;
    sender: string;
    templateUsedTitle: string;
    fullDraft: string;
    summary: string;
    keyHighlights: string[];
    providerUsed?: string;
    modelUsed?: string;
    latencyMs?: number;
    failoverOccurred?: boolean;
    failoverChain?: any[];
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Follow-up edit prompt states
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [draftHistory, setDraftHistory] = useState<Array<{
    draft: string;
    instruction: string;
    timestamp: string;
  }>>([]);
  const [lastChangesMade, setLastChangesMade] = useState<string[]>([]);

  const templates = storage.getTemplates();
  const user = storage.getUser();

  // Suggestion chips showing natural language examples
  const exampleInstructions = [
    {
      label: 'Stakeholder Engagement Report',
      text: 'Write a stakeholder engagement report summarizing our consultation with telecommunication operators (MTN, Telecel, AT) and the National Communications Authority regarding universal access and rural coverage expansion.',
      type: 'Report' as const,
    },
    {
      label: 'Write Letter to Minister',
      text: 'Write an official letter to the Hon. Minister for Communications requesting executive approval and sponsorship for the 2026 National Cybersecurity Awareness Month summit in Accra.',
      type: 'Letter' as const,
    },
    {
      label: 'Write Memo for Laptops',
      text: 'Write a memo to the Chief Director through Director Finance & Admin requesting approval to procure 5 high-speed laptops for the RSIM statistics team before the Q3 reporting deadline.',
      type: 'Memo' as const,
    },
    {
      label: 'Write Minutes for TWG',
      text: 'Write meeting minutes for the Technical Working Group on National Data Governance held today at the Ministry Conference Room chaired by Director RSIM, discussing data interoperability and setting next deadlines.',
      type: 'Minutes' as const,
    },
    {
      label: 'Write Progress Report',
      text: 'Write a comprehensive progress report for Q3 2026 covering the roll-out of government digital services, regional ICT monitoring findings, and recommendations for budget expansion.',
      type: 'Report' as const,
    },
  ];

  const handleExecuteDrafting = async (textToUse?: string, typeToUse?: 'auto' | 'Letter' | 'Memo' | 'Minutes' | 'Report') => {
    const query = (textToUse !== undefined ? textToUse : instruction).trim();
    if (!query) {
      alert('Please enter instructions for the AI on what you want to write.');
      return;
    }

    const typeArg = typeToUse !== undefined ? typeToUse : requestedType;
    setIsGenerating(true);
    setFeedback(null);

    try {
      // Prioritize explicitly selected template, or auto-matched template from prompt
      let effectiveTemplate = selectedTemplate;
      if (!effectiveTemplate && liveMatchedTemplate?.template) {
        effectiveTemplate = liveMatchedTemplate.template;
      }

      const pool = effectiveTemplate
        ? [effectiveTemplate, ...templates.filter((t) => t.id !== effectiveTemplate!.id)]
        : templates;

      const res = await aiService.intelligentWrite(
        query,
        typeArg,
        pool,
        {
          name: user.name,
          department: user.department,
          role: user.role,
        },
        {
          transcript: transcriptInput || undefined,
          preferredModel: localStorage.getItem('hf_preferred_model') || DEFAULT_HF_MODEL,
        }
      );

      if (res.fullDraft) {
        setGenerationResult(res);
        setDraftHistory([]);
        setLastChangesMade([]);
        setFollowUpPrompt('');
        const templateInfo = res.templateUsedTitle ? ` adhering to template "${res.templateUsedTitle}" format` : '';
        const modeInfo = transcriptInput && transcriptInput.trim().length > 10 ? ' [Mode A: Transcription-Driven]' : ' [Mode B: Prompt-Only]';
        setFeedback(`AI synthesized ${res.documentType}${templateInfo}${modeInfo} successfully.`);
      }
    } catch (err) {
      console.error('Draft error:', err);
      alert('Unable to complete AI draft with Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteFollowUpEdit = async (customPrompt?: string) => {
    const editInstruction = (customPrompt !== undefined ? customPrompt : followUpPrompt).trim();
    if (!editInstruction) {
      alert('Please enter a follow-up instruction to edit the document (e.g. "Add a section on budget breakdown", "Make the tone more urgent", "Add Telecel to the list of participants").');
      return;
    }

    if (!generationResult || !generationResult.fullDraft) return;

    setIsEditingFollowUp(true);
    setFeedback(null);

    // Save previous version to history for easy Undo
    setDraftHistory((prev) => [
      {
        draft: generationResult.fullDraft,
        instruction: editInstruction,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);

    try {
      const res = await aiService.editDraftWithPrompt(
        generationResult.fullDraft,
        editInstruction,
        {
          documentType: generationResult.documentType,
          title: generationResult.title,
          templateUsedTitle: generationResult.templateUsedTitle,
        }
      );

      if (res.fullDraft) {
        setGenerationResult((prev) =>
          prev
            ? {
                ...prev,
                fullDraft: res.fullDraft,
                title: res.title || prev.title,
              }
            : null
        );
        setLastChangesMade(res.changesMade || ['Document updated per your follow-up instruction']);
        setFeedback(`Updated document draft per your instruction: "${editInstruction.slice(0, 60)}${editInstruction.length > 60 ? '...' : ''}"`);
        setFollowUpPrompt('');
      }
    } catch (err) {
      console.error('Follow-up edit error:', err);
      alert('Unable to update document with your follow-up instruction. Please try again.');
    } finally {
      setIsEditingFollowUp(false);
    }
  };

  const handleUndoFollowUpEdit = () => {
    if (draftHistory.length === 0 || !generationResult) return;
    const previous = draftHistory[0];
    setGenerationResult((prev) =>
      prev
        ? {
            ...prev,
            fullDraft: previous.draft,
          }
        : null
    );
    setDraftHistory((prev) => prev.slice(1));
    setFeedback(`Reverted to draft before: "${previous.instruction.slice(0, 50)}"`);
  };

  const handleSaveDocument = () => {
    if (!generationResult || !generationResult.fullDraft) return;

    const docId = `doc_${generationResult.documentType.toLowerCase()}_${Date.now()}`;
    const docTypeMap: Record<string, any> = {
      Letter: 'Official Letter',
      Memo: 'Internal Memo',
      Minutes: 'Meeting Minutes',
      Report: 'Meeting Report',
    };

    const newDoc: DocumentItem = {
      id: docId,
      title: generationResult.title || `${generationResult.documentType}: ${generationResult.subject}`,
      type: docTypeMap[generationResult.documentType] || 'Official Letter',
      category: `${generationResult.documentType}s`,
      referenceNumber: generationResult.referenceNumber,
      recipient: generationResult.recipient,
      sender: generationResult.sender || user.name,
      content: generationResult.fullDraft,
      author: user.name,
      version: 1,
      versions: [],
      approvalStatus: 'Draft',
      comments: [],
      tags: [generationResult.documentType, 'AI-Authored', 'Learned-Template'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveDocument(newDoc);
    if (onDocumentCreated) {
      onDocumentCreated(docId);
    } else {
      setFeedback(`Saved "${newDoc.title}" to Documents repository!`);
    }
  };

  const handleOpenInSpecificStudio = () => {
    if (!generationResult || !onNavigateToStudio) return;
    const studioKey = (generationResult.documentType.toLowerCase() + 's') as 'letters' | 'memos' | 'minutes' | 'reports';
    onNavigateToStudio(studioKey);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Letter': return <Send className="h-4 w-4 text-sky-600" />;
      case 'Memo': return <Mail className="h-4 w-4 text-emerald-600" />;
      case 'Minutes': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'Report': return <FileCheck2 className="h-4 w-4 text-indigo-600" />;
      default: return <FileText className="h-4 w-4 text-slate-600" />;
    }
  };

  // Convert requestedType to category for QuickTemplateBar
  const currentCategory = requestedType === 'auto'
    ? 'letters'
    : ((requestedType.toLowerCase() + 's') as 'letters' | 'memos' | 'minutes' | 'reports');

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Intelligent AI Prompt Box */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-white via-white to-emerald-50/30 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Intelligent Institutional AI Writer
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Google Gemini
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Just provide your template and describe what to write in plain English. Gemini learns the structure, tone, and style, then writes the complete document.
              </p>
            </div>
          </div>

          {/* Type Selector / Auto detection indicator */}
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            {(['auto', 'Letter', 'Memo', 'Minutes', 'Report'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setRequestedType(t);
                  setSelectedTemplate(null);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  requestedType === t
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'auto' ? 'Auto-Detect' : t}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 1: Quick Template Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <BookMarked className="h-3 w-3 text-emerald-700" />
              1. Choose or Upload Template (Structure, Tone & Style)
            </span>
            {selectedTemplate?.learnedKnowledge && (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Tone: {selectedTemplate.learnedKnowledge.tone || 'Formal'}
              </span>
            )}
          </div>
          <QuickTemplateBar
            category={currentCategory}
            activeTemplate={selectedTemplate}
            onSelectTemplate={(t) => setSelectedTemplate(t)}
          />
        </div>

        {/* STEP 2: Prompt Input Box */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Wand2 className="h-3 w-3 text-emerald-700" />
                2. Describe What You Want to Write
              </span>
              {/* Dual Mode Indicator */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                  isModeA
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
                title={
                  isModeA
                    ? 'Mode A: Uses meeting transcript + matched template + prompt instructions'
                    : 'Mode B: Uses user prompt instructions + matched Google Drive template directly'
                }
              >
                {isModeA ? '⚡ Mode A: With Transcript' : '✨ Mode B: Prompt-Only'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Transcript Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  transcriptInput
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
              >
                <Mic className="h-3 w-3 text-blue-600" />
                <span>
                  {transcriptInput ? 'Transcript Attached' : 'Attach Transcript (Optional)'}
                </span>
                {showTranscriptDrawer ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              <VoiceInput
                onTranscript={(text) =>
                  setInstruction((prev) => (prev ? `${prev} ${text}` : text))
                }
                size="sm"
                placeholderPrompt="Transcribe this voice prompt for administrative document drafting."
              />
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[9px]">Ctrl+Enter</kbd> to write
              </span>
            </div>
          </div>

          {/* Collapsible Meeting Transcript Drawer (Mode A) */}
          {showTranscriptDrawer && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-blue-600" />
                  Meeting Transcript (Mode A: Minutes, Proceedings & Reports)
                </span>
                {transcriptInput && (
                  <button
                    type="button"
                    onClick={() => setTranscriptInput('')}
                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                  >
                    Clear Transcript
                  </button>
                )}
              </div>
              <textarea
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Paste meeting transcript or proceedings here... (e.g. from Audio Transcription Studio or virtual meeting record). When provided, Gemini generates the document based directly on this transcript!"
                rows={3}
                className="w-full resize-none rounded-lg p-2.5 text-xs text-slate-800 bg-white border border-blue-200 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-blue-700">
                💡 When a transcript is provided, the system operates in <strong>Mode A</strong>, synthesizing deliberations, decisions, and action items according to your template format.
              </p>
            </div>
          )}

          {/* Live Matched Google Drive Template Banner */}
          {!selectedTemplate && liveMatchedTemplate?.template && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                  🎯
                </span>
                <div className="truncate">
                  <span className="font-bold text-emerald-800">Auto-Matched Template:</span>{' '}
                  <span className="font-semibold underline decoration-emerald-500">
                    {liveMatchedTemplate.template.title || liveMatchedTemplate.template.name}
                  </span>
                  {(liveMatchedTemplate.template.source === 'google_drive' || liveMatchedTemplate.template.driveSource) && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9.5px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      <Cloud className="h-2.5 w-2.5" />
                      Google Drive
                    </span>
                  )}
                  <span className="ml-2 text-[10.5px] text-emerald-700 font-medium">
                    ({liveMatchedTemplate.reason})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(liveMatchedTemplate.template)}
                className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors shrink-0"
              >
                Lock Template
              </button>
            </div>
          )}

          <div className="relative rounded-xl border border-slate-200 bg-white shadow-inner focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Tell RSIM AI what to write: e.g. &quot;Write a stakeholder engagement report summarizing our consultation with telecom operators...&quot; or &quot;Write an official letter to the Minister...&quot; The system checks for keywords matching your Google Drive templates and drafts the complete document."
              rows={3}
              className="w-full resize-none rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleExecuteDrafting();
                }
              }}
            />

            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-xl">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <BookMarked className="h-3.5 w-3.5 text-emerald-700" />
                <span>
                  <strong>{templates.length}</strong> learned template{templates.length === 1 ? '' : 's'} available
                </span>
              </div>

              <div className="flex items-center gap-2">
                {instruction && (
                  <button
                    type="button"
                    onClick={() => setInstruction('')}
                    className="text-xs text-slate-400 hover:text-slate-600 px-1"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={isGenerating || !instruction.trim()}
                  onClick={() => handleExecuteDrafting()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Synthesizing Document with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      <span>Write Document</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Example Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Instructions:</span>
            {exampleInstructions.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setInstruction(ex.text);
                  setRequestedType(ex.type);
                  handleExecuteDrafting(ex.text, ex.type);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all shadow-2xs"
              >
                {getTypeIcon(ex.type)}
                <span>{ex.label}</span>
              </button>
            ))}
          </div>

          {feedback && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {feedback}
              </span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generated Result Preview (Step 3: Document Output) */}
      {generationResult && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                  {getTypeIcon(generationResult.documentType)}
                  <span className="text-white ml-1">{generationResult.documentType}</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {generationResult.referenceNumber || 'RSIM/DOC/2026/01'}
                </span>
                <span className="text-xs text-slate-400">
                  • Template: <strong>{generationResult.templateUsedTitle}</strong>
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {generationResult.title || generationResult.subject}
              </h3>

              {/* AI Cascade Engine Attribution & Telemetry Badge */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                  generationResult.failoverOccurred
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                }`}>
                  <Zap className={`h-3.5 w-3.5 ${generationResult.failoverOccurred ? 'text-amber-600' : 'text-indigo-600'}`} />
                  <span>
                    {generationResult.failoverOccurred
                      ? `⚡ Auto-Failover: Served by ${generationResult.providerUsed?.toUpperCase() || 'GROQ'} (${generationResult.latencyMs || 180}ms)`
                      : `⚡ Synthesized by ${generationResult.providerUsed === 'gemini' ? 'Google Gemini 3.8 Flash' : (generationResult.providerUsed?.toUpperCase() || 'Google Gemini')} (${generationResult.latencyMs || 340}ms)`}
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {generationResult.fullDraft.trim().split(/\s+/).length} words • ~{Math.max(1, Math.ceil(generationResult.fullDraft.trim().split(/\s+/).length / 200))} min read
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generationResult.fullDraft);
                  setFeedback('Copied document draft to clipboard!');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </button>

              {/* Export Word DOCX */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await exportToDocx({
                      title: generationResult.title || `${generationResult.documentType}_${new Date().toISOString().slice(0, 10)}`,
                      content: generationResult.fullDraft,
                    });
                    setFeedback('Successfully exported to Microsoft Word (.docx)!');
                  } catch (err: any) {
                    alert('Export error: ' + err.message);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 shadow-2xs"
                title="Export as Microsoft Word document"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>Export DOCX</span>
              </button>

              {/* Save directly to Google Drive */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const token = await getAccessToken();
                    if (!token) {
                      alert('Please connect Google Drive first to save directly to Drive.');
                      return;
                    }
                    const blob = new Blob([generationResult.fullDraft], { type: 'text/markdown' });
                    const fileName = `${(generationResult.title || generationResult.documentType).replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
                    await uploadFileToDrive(blob, fileName, {
                      description: `Institutional draft generated by RSIM AI matching template ${generationResult.templateUsedTitle}`,
                    });
                    alert(`✅ Saved "${fileName}" directly to your Google Drive ("Directorate Templates & Knowledge") folder!`);
                  } catch (err: any) {
                    alert('Google Drive upload error: ' + err.message);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 shadow-2xs"
                title="Save directly to Google Drive"
              >
                <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                <span>Save to Drive</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDocument}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Save to Documents</span>
              </button>

              {onNavigateToStudio && (
                <button
                  type="button"
                  onClick={handleOpenInSpecificStudio}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                  title="Open in specialized studio"
                >
                  <span>Open in {generationResult.documentType} Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Word Document Visualizer */}
          <div className="mt-4">
            <WordDocumentViewer
              content={generationResult.fullDraft}
              title={generationResult.title || `${generationResult.documentType}: ${generationResult.subject}`}
              type={
                generationResult.documentType === 'Letter' ? 'Official Letter' :
                generationResult.documentType === 'Memo' ? 'Internal Memo' :
                generationResult.documentType === 'Minutes' ? 'Meeting Minutes' : 'Meeting Report'
              }
              referenceNumber={generationResult.referenceNumber}
              date={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Follow-up Prompt Section: User edits document to suit their exact preferences */}
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-slate-50 to-emerald-50/40 p-5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Follow-Up Prompt to Edit Document
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Gemini Co-Editor
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Instruct Gemini to add sections, revise tone, rephrase clauses, or adjust any content to suit your exact needs.
                  </p>
                </div>
              </div>

              {draftHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoFollowUpEdit}
                  disabled={isEditingFollowUp}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs transition-all"
                  title="Revert to prior draft"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Undo Last Edit ({draftHistory.length})</span>
                </button>
              )}
            </div>

            {/* Quick action chips for common follow-up edits */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[11px] font-medium text-slate-500 self-center mr-1">Quick Edits:</span>
              {[
                'Add detailed financial and budget breakdown table',
                'Make the tone more urgent and executive',
                'Add a section on risks, bottlenecks, and mitigations',
                'Expand the recommendations with explicit deadlines',
                'Simplify into a concise 1-page executive summary',
              ].map((quickEdit, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFollowUpPrompt(quickEdit);
                    handleExecuteFollowUpEdit(quickEdit);
                  }}
                  disabled={isEditingFollowUp}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/60 transition-all shadow-2xs"
                >
                  <span>{quickEdit}</span>
                </button>
              ))}
            </div>

            {/* Follow-up input form */}
            <div className="relative rounded-xl border border-slate-200 bg-white shadow-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <textarea
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                placeholder="Give your follow-up instruction: e.g. &quot;Add a specific clause about the 15% procurement discount&quot;, &quot;Make paragraph 2 more formal&quot;, &quot;Add the Director General of NCA to the carbon copy list&quot;..."
                rows={2}
                disabled={isEditingFollowUp}
                className="w-full resize-none rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:bg-slate-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleExecuteFollowUpEdit();
                  }
                }}
              />

              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-xl">
                <span className="text-[11px] text-slate-400">
                  Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[9px]">Ctrl+Enter</kbd> to apply edit
                </span>

                <div className="flex items-center gap-2">
                  {followUpPrompt && (
                    <button
                      type="button"
                      onClick={() => setFollowUpPrompt('')}
                      className="text-xs text-slate-400 hover:text-slate-600 px-1"
                    >
                      Clear
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExecuteFollowUpEdit()}
                    disabled={isEditingFollowUp || !followUpPrompt.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-xs transition-all"
                  >
                    {isEditingFollowUp ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Revising Draft...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Apply Follow-Up Edit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Changes audit feedback */}
            {lastChangesMade.length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-2.5 text-xs text-slate-700">
                <span className="font-semibold text-emerald-800 block mb-1">Revisions Applied:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                  {lastChangesMade.map((chg, i) => (
                    <li key={i}>{chg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
