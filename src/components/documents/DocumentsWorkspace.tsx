import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Download,
  Copy,
  Printer,
  History,
  GitCompare,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Clock,
  Layers,
  Edit3,
  ListTodo,
  Tag,
  Building2,
  Calendar,
  CheckSquare,
  FileCheck,
  Loader2,
  Wand2,
  Undo2,
  X,
  Filter,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  BookOpen,
  ChevronRight,
  Bookmark,
  Check,
  FileSearch,
} from 'lucide-react';
import { DocumentItem, DocumentType, ApprovalStatus, ExtractedDocumentData } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { parseUploadedFile, isBinaryOrZipText, repairBinaryOrZipString } from '../../services/documentParser';
import { WordDocumentViewer } from './WordDocumentViewer';
import { exportToDocx, exportToPdf } from '../../utils/docxExporter';
import { WordFormattedResponse } from '../common/WordFormattedResponse';
import { attachmentService } from '../../services/attachmentService';

interface DocumentsWorkspaceProps {
  documents: DocumentItem[];
  selectedDocumentId?: string;
  onDocumentsChanged: () => void;
  onSetContext: (ctx: { type: 'document'; id: string; title: string }) => void;
  onNavigateToStudio?: (studio: 'letters' | 'memos' | 'minutes' | 'reports', content?: string) => void;
}

export const DocumentsWorkspace: React.FC<DocumentsWorkspaceProps> = ({
  documents,
  selectedDocumentId,
  onDocumentsChanged,
  onSetContext,
  onNavigateToStudio,
}) => {
  const [activeDocId, setActiveDocId] = useState<string>(
    selectedDocumentId || documents[0]?.id || ''
  );
  const [editorContent, setEditorContent] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAutoRepairing, setIsAutoRepairing] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<'prompt-edit' | 'summarize' | 'chat' | 'extraction'>('prompt-edit');

  // Innovative Local Search & Multi-Facet Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [topicTag, setTopicTag] = useState<string | null>(null);
  const [repoViewMode, setRepoViewMode] = useState<'tabs' | 'explorer'>('tabs');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'matches' | 'version'>('recent');

  // Multi-document AI Search Synthesis State
  const [isSynthesizingSearch, setIsSynthesizingSearch] = useState(false);
  const [searchSynthesisResult, setSearchSynthesisResult] = useState<string | null>(null);
  const [synthesisModalOpen, setSynthesisModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Follow-up Prompt Editor State
  const [followUpEditPrompt, setFollowUpEditPrompt] = useState('');
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const [editHistory, setEditHistory] = useState<Array<{ text: string; prompt: string }>>([]);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Send document/transcript into Writing Studios with IndexedDB handoff
  const handleSendDocToStudio = async (studio: 'minutes' | 'reports' | 'letters' | 'memos') => {
    if (!activeDoc || !editorContent.trim()) return;
    const targetStudio = studio === 'memos' ? 'letters' : studio;
    await attachmentService.saveHandoffTranscript(targetStudio, {
      transcript: editorContent,
      title: activeDoc.title,
      date: activeDoc.createdAt ? new Date(activeDoc.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      speakerLabels: [],
    });

    const studioLabel =
      studio === 'minutes'
        ? 'Minutes Studio'
        : studio === 'reports'
        ? 'Report Studio'
        : 'Letters & Memos Studio';
    setToastMsg(`Document sent to ${studioLabel} as source material`);
    setTimeout(() => {
      setToastMsg(null);
      onNavigateToStudio?.(studio, editorContent);
    }, 400);
  };

  // Document Q&A / Chat with Doc
  const [docQuery, setDocQuery] = useState('');
  const [docQAHistory, setDocQAHistory] = useState<Array<{ q: string; a: string }>>([]);

  // Document Comparison modal state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareDocId, setCompareDocId] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Summarize mode selection
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeSummaryMode, setActiveSummaryMode] = useState<string>('');

  const fileUploadRef = useRef<HTMLInputElement>(null);
  const reuploadRef = useRef<HTMLInputElement>(null);

  // Global shortcut to focus search input: '/' or 'Cmd+K' / 'Ctrl+K'
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.key === '/' && !isInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to extract matches count and contextual snippet around search query
  const getDocMatchInfo = (doc: DocumentItem, query: string) => {
    if (!query || !query.trim()) {
      const plainSnippet = (doc.content || '').slice(0, 140).replace(/\n+/g, ' ');
      return {
        hasTitleMatch: false,
        hasContentMatch: false,
        totalMatches: 0,
        snippet: plainSnippet + (doc.content?.length > 140 ? '...' : ''),
      };
    }

    const q = query.trim().toLowerCase();
    const titleMatch = (doc.title || '').toLowerCase().includes(q);
    const content = doc.content || '';
    const lowerContent = content.toLowerCase();

    let totalMatches = 0;
    try {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = content.match(new RegExp(escaped, 'gi'));
      totalMatches = matches ? matches.length : 0;
    } catch {}

    const index = lowerContent.indexOf(q);
    let snippet = '';
    if (index !== -1) {
      const start = Math.max(0, index - 35);
      const end = Math.min(content.length, index + q.length + 75);
      snippet = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n+/g, ' ') + (end < content.length ? '...' : '');
    } else {
      snippet = content.slice(0, 140).replace(/\n+/g, ' ') + (content.length > 140 ? '...' : '');
    }

    return {
      hasTitleMatch: titleMatch,
      hasContentMatch: index !== -1,
      totalMatches,
      snippet,
    };
  };

  // Helper to render snippet with highlighted query term
  const renderHighlightedSnippet = (snippet: string, query: string) => {
    if (!query || !query.trim() || query.trim().length < 2) {
      return <span>{snippet}</span>;
    }
    try {
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = snippet.split(new RegExp(`(${escaped})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) =>
            part.toLowerCase() === query.trim().toLowerCase() ? (
              <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded shadow-2xs">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return <span>{snippet}</span>;
    }
  };

  // Filter and Sort repository documents based on search query, type, status, and topic
  const filteredDocuments = React.useMemo(() => {
    let list = [...documents];

    // Document Type Filter
    if (typeFilter !== 'all') {
      list = list.filter((d) => (d.type || '').toLowerCase() === typeFilter.toLowerCase());
    }

    // Approval Status Filter
    if (statusFilter !== 'all') {
      list = list.filter((d) => (d.approvalStatus || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Topic Tag Filter
    if (topicTag) {
      const tagLower = topicTag.toLowerCase();
      list = list.filter((d) => {
        const inContent = (d.content || '').toLowerCase().includes(tagLower);
        const inTitle = (d.title || '').toLowerCase().includes(tagLower);
        const inTags = (d.tags || []).some((t) => t.toLowerCase().includes(tagLower));
        return inContent || inTitle || inTags;
      });
    }

    // Search Query (matches title, content, rawText, referenceNumber, author, recipient, tags)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => {
        const inTitle = (d.title || '').toLowerCase().includes(q);
        const inContent = (d.content || '').toLowerCase().includes(q);
        const inRaw = (d.rawText || '').toLowerCase().includes(q);
        const inRef = (d.referenceNumber || '').toLowerCase().includes(q);
        const inAuthor = (d.author || '').toLowerCase().includes(q);
        const inRecipient = (d.recipient || '').toLowerCase().includes(q);
        const inTags = (d.tags || []).some((t) => t.toLowerCase().includes(q));
        return inTitle || inContent || inRaw || inRef || inAuthor || inRecipient || inTags;
      });
    }

    // Sort order
    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'version') {
      list.sort((a, b) => (b.version || 1) - (a.version || 1));
    } else if (sortBy === 'matches' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const count = (text: string) => {
        try {
          const m = text.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
          return m ? m.length : 0;
        } catch {
          return 0;
        }
      };
      list.sort((a, b) => count(b.content || '') - count(a.content || ''));
    } else {
      // 'recent'
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }

    return list;
  }, [documents, searchQuery, typeFilter, statusFilter, topicTag, sortBy]);

  // Innovative Cross-Document AI Synthesis on filtered search results
  const handleSynthesizeSearchResults = async () => {
    if (filteredDocuments.length === 0) return;
    setIsSynthesizingSearch(true);
    setSynthesisModalOpen(true);
    setSearchSynthesisResult(null);

    try {
      const docsSummary = filteredDocuments
        .slice(0, 5)
        .map((d, i) => {
          return `DOCUMENT ${i + 1}: "${d.title}" (Type: ${d.type}, Ref: ${d.referenceNumber || 'N/A'}, Date: ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'})\nEXCERPT/CONTENT:\n${d.content.slice(0, 3000)}`;
        })
        .join('\n\n---\n\n');

      const prompt = `As an executive civil service policy and documentation advisor to the RSIM Directorate, provide an executive multi-document synthesis for the search query/topic: "${searchQuery || topicTag || 'Directorate Documents'}".

Analyze and synthesize the following ${Math.min(filteredDocuments.length, 5)} matching official documents from the repository:

${docsSummary}

Please structure the synthesis using official civil service standards:
# EXECUTIVE MULTI-DOCUMENT SYNTHESIS: ${searchQuery ? searchQuery.toUpperCase() : 'REPOSITORY RECORDS'}
## 1. STRATEGIC OVERVIEW & CONTEXT
(Synthesize overarching themes, mandate implications, and key objectives across all matching records)

## 2. CROSS-DOCUMENT FINDINGS & DATA SYNTHESIS
(Specific figures, metrics, status updates, and institutional data identified)

## 3. CONSENSUS, DISCREPANCIES & DECISION POINTS
(Identify where the documents align and any conflicting directives, pending approvals, or budget gaps)

## 4. CONSOLIDATED ACTION MATRIX & ASSIGNMENTS
(List concrete action items, responsible entities/directorates, and deadlines)

## 5. DIRECTORIAL RECOMMENDATION FOR NEXT STEPS
(Actionable civil service recommendation for the Director, RSIM)`;

      const res = await aiService.complete(prompt, 'You are an elite civil service documentation intelligence officer for the RSIM Directorate.', 'synthesis');
      setSearchSynthesisResult(res.text || 'Unable to generate multi-document synthesis.');
    } catch (err: any) {
      setSearchSynthesisResult(`Synthesis generation failed: ${err.message}`);
    } finally {
      setIsSynthesizingSearch(false);
    }
  };

  // Save synthesis as a new Memorandum
  const handleSaveSynthesisAsMemo = () => {
    if (!searchSynthesisResult) return;
    const newDoc: DocumentItem = {
      id: `syn_${Date.now()}`,
      title: `Executive Synthesis - ${searchQuery ? searchQuery.toUpperCase() : 'Repository Intelligence'}`,
      type: 'Internal Memo',
      category: 'Intelligence & Research',
      content: searchSynthesisResult,
      rawText: searchSynthesisResult,
      author: 'Directorate Intelligence Engine',
      version: 1,
      versions: [{
        versionNumber: 1,
        content: searchSynthesisResult,
        updatedAt: new Date().toISOString(),
        updatedBy: 'RSIM AI Synthesis',
        note: 'Generated multi-document intelligence synthesis',
      }],
      approvalStatus: 'Draft',
      comments: [],
      tags: ['synthesis', searchQuery.toLowerCase().trim() || 'intelligence'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      referenceNumber: `RSIM/SYN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
    };
    storage.saveDocument(newDoc);
    onDocumentsChanged();
    setActiveDocId(newDoc.id);
    setSynthesisModalOpen(false);
    alert('Synthesis successfully saved as a new Memorandum in the repository!');
  };

  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];

  // Sync editor content with active doc & auto-repair if raw zip binary
  React.useEffect(() => {
    if (activeDoc) {
      if (isBinaryOrZipText(activeDoc.content)) {
        setIsAutoRepairing(true);
        repairBinaryOrZipString(activeDoc.content)
          .then((repaired) => {
            if (repaired.text && repaired.text.trim().length > 0) {
              setEditorContent(repaired.text);
              const updated = {
                ...activeDoc,
                content: repaired.text,
                rawText: repaired.text,
                updatedAt: new Date().toISOString(),
              };
              storage.saveDocument(updated);
              onDocumentsChanged();
            } else {
              setEditorContent(activeDoc.content);
            }
          })
          .finally(() => setIsAutoRepairing(false));
      } else {
        setEditorContent(activeDoc.content);
      }
      setSummaryResult(activeDoc.summary || null);
      setDocQAHistory([]);
    }
  }, [activeDoc?.id]);

  // Handle Save
  const handleSaveDocument = () => {
    if (!activeDoc) return;
    const updated: DocumentItem = {
      ...activeDoc,
      content: editorContent,
      updatedAt: new Date().toISOString(),
    };
    storage.saveDocument(updated);
    onDocumentsChanged();
    alert('Document changes and new version successfully saved.');
  };

  // Delete Document Handlers
  const handleDeleteDoc = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      storage.deleteDocument(id);
      onDocumentsChanged();
      if (activeDocId === id) {
        const remaining = documents.filter((d) => d.id !== id);
        setActiveDocId(remaining[0]?.id || '');
      }
    }
  };

  const handleClearAllDocuments = () => {
    if (window.confirm(`Are you sure you want to permanently delete ALL ${documents.length} document(s) in the repository? This cannot be undone.`)) {
      storage.clearAllDocuments();
      onDocumentsChanged();
      setActiveDocId('');
    }
  };

  // AI Toolbar Actions (Section 23 of Master Prompt)
  const handleAIToolbar = async (action: string) => {
    if (!editorContent.trim()) return;
    setIsProcessingAI(true);

    const prompt = `Perform the following editorial action on this official RSIM Directorate document text:
Action: ${action}
Maintain high civil service standards, formal tone, precision, and avoid altering official figures or dates unless instructed.

Document Text:
"""
${editorContent}
"""`;

    const res = await aiService.complete(prompt, 'RSIM Quality Assurance Editorial Assistant', 'Proofreader');
    if (res.text) {
      setEditorContent(res.text);
    }
    setIsProcessingAI(false);
  };

  // Follow-up Prompt Editor (Section: user follow-up prompt to edit document to suit preferences)
  const handleFollowUpEdit = async (customInstruction?: string) => {
    const instruction = (customInstruction !== undefined ? customInstruction : followUpEditPrompt).trim();
    if (!instruction) {
      alert('Please enter your follow-up instruction to edit the document.');
      return;
    }
    if (!editorContent.trim()) return;

    setIsPromptEditing(true);
    setEditNotice(null);

    // Save previous state for undo
    setEditHistory((prev) => [{ text: editorContent, prompt: instruction }, ...prev]);

    try {
      const res = await aiService.editDraftWithPrompt(
        editorContent,
        instruction,
        {
          documentType: activeDoc?.type,
          title: activeDoc?.title,
        }
      );

      if (res.fullDraft) {
        setEditorContent(res.fullDraft);
        setEditNotice(`Document revised per instruction: "${instruction.slice(0, 60)}${instruction.length > 60 ? '...' : ''}"`);
        setFollowUpEditPrompt('');

        // Persist to storage
        if (activeDoc) {
          const updated: DocumentItem = {
            ...activeDoc,
            content: res.fullDraft,
            rawText: res.fullDraft,
            updatedAt: new Date().toISOString(),
          };
          storage.saveDocument(updated);
          onDocumentsChanged();
        }
      }
    } catch (err: any) {
      console.error('Document prompt edit error:', err);
      alert('Unable to edit document with Gemini. Please try again.');
    } finally {
      setIsPromptEditing(false);
    }
  };

  const handleUndoPromptEdit = () => {
    if (editHistory.length === 0) return;
    const prev = editHistory[0];
    setEditorContent(prev.text);
    setEditHistory((history) => history.slice(1));
    setEditNotice(`Reverted changes made by: "${prev.prompt.slice(0, 50)}"`);
    if (activeDoc) {
      const updated: DocumentItem = {
        ...activeDoc,
        content: prev.text,
        rawText: prev.text,
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(updated);
      onDocumentsChanged();
    }
  };

  // Document Summarization (Section 19)
  const handleSummarize = async (mode: 'Quick Summary' | 'Executive Summary' | 'Key Findings' | 'Action Items' | 'Director Brief') => {
    if (!editorContent) return;
    setIsSummarizing(true);
    setActiveSummaryMode(mode);
    try {
      const summary = await aiService.summarizeDocument(editorContent, mode, activeDoc?.title);
      setSummaryResult(summary);
    } catch (err: any) {
      setSummaryResult(`Unable to generate summary: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Chat with Document (Section 20)
  const handleDocQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docQuery.trim() || !editorContent) return;

    const q = docQuery.trim();
    setDocQuery('');
    setIsProcessingAI(true);

    const prompt = `Answer the following question STRICTLY using the provided document text as ground truth. If the answer cannot be found in the document, reply: "This information was not found in the provided sources."

Document:
"""
${editorContent}
"""

Question: ${q}`;

    const res = await aiService.complete(prompt, 'RSIM Document Grounded Q&A Assistant', 'Document Analyst');
    setDocQAHistory((prev) => [...prev, { q, a: res.text }]);
    setIsProcessingAI(false);
  };

  // Trigger Deep Extraction on Active Document
  const handleDeepExtractActiveDoc = async () => {
    if (!activeDoc || !editorContent.trim() || isBinaryOrZipText(editorContent)) return;
    setIsExtracting(true);
    try {
      const res = await aiService.extractDocument(editorContent, activeDoc.title, activeDoc.fileType || 'Document');
      const updated: DocumentItem = {
        ...activeDoc,
        extractedData: res.extractedData,
        summary: res.extractedData.summary,
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(updated);
      onDocumentsChanged();
      setActiveSideTab('extraction');
    } catch (err) {
      console.error('Deep extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Document Comparison (Section 38)
  const handleRunComparison = () => {
    if (!activeDoc || !compareDocId) return;
    const secondDoc = documents.find((d) => d.id === compareDocId);
    if (!secondDoc) return;

    const result = aiService.compareDocuments(activeDoc, secondDoc);
    setComparisonResult(result);
  };

  // Real File Upload & Deep Extraction (PDF, DOCX, TXT, MD, CSV, JSON)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const parsed = await parseUploadedFile(file);
      const cleanContent = parsed.text || `[Document: ${parsed.cleanTitle}]\n\nNo readable text was detected.`;

      // Perform deep AI extraction
      let extraction: ExtractedDocumentData;
      let detectedType: DocumentType = 'Uploaded Document';

      try {
        const aiResult = await aiService.extractDocument(cleanContent, file.name, parsed.fileType);
        extraction = aiResult.extractedData;
        if (aiResult.documentType) {
          detectedType = aiResult.documentType;
        }
      } catch (err) {
        console.warn('Using local document fallback extractor:', err);
        extraction = aiService.localExtractDocument(cleanContent, file.name);
      }

      const newDoc: DocumentItem = {
        id: `doc_${Date.now()}`,
        title: parsed.cleanTitle,
        type: detectedType,
        category: 'Uploaded Files',
        fileName: file.name,
        fileSize: parsed.fileSize,
        fileType: parsed.fileType,
        content: cleanContent,
        rawText: cleanContent,
        summary: extraction.summary,
        extractedData: extraction,
        author: 'Directorate Officer',
        version: 1,
        versions: [],
        approvalStatus: 'Draft',
        comments: [],
        tags: ['Uploaded', parsed.fileType],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveDocument(newDoc);
      onDocumentsChanged();
      setActiveDocId(newDoc.id);
      setEditorContent(cleanContent);
      setActiveSideTab('extraction');
    } catch (err: any) {
      console.error('File parsing and extraction failed:', err);
      alert(`File extraction failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExtracting(false);
      if (fileUploadRef.current) {
        fileUploadRef.current.value = '';
      }
    }
  };

  // Handle re-uploading file for currently active binary corrupted doc
  const handleReuploadActiveDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDoc) return;

    setIsExtracting(true);
    try {
      const parsed = await parseUploadedFile(file);
      const cleanContent = parsed.text;

      let extraction: ExtractedDocumentData;
      try {
        const aiResult = await aiService.extractDocument(cleanContent, file.name, parsed.fileType);
        extraction = aiResult.extractedData;
      } catch {
        extraction = aiService.localExtractDocument(cleanContent, file.name);
      }

      const updated: DocumentItem = {
        ...activeDoc,
        content: cleanContent,
        rawText: cleanContent,
        summary: extraction.summary,
        extractedData: extraction,
        fileSize: parsed.fileSize,
        fileType: parsed.fileType,
        fileName: file.name,
        updatedAt: new Date().toISOString(),
      };

      storage.saveDocument(updated);
      onDocumentsChanged();
      setEditorContent(cleanContent);
      setActiveSideTab('extraction');
    } catch (err: any) {
      alert(`Re-extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
      if (reuploadRef.current) {
        reuploadRef.current.value = '';
      }
    }
  };

  // Export to Print / PDF
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    if (!activeDoc) return;
    const blob = new Blob([editorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc.title.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isCorruptedZip = isBinaryOrZipText(editorContent);
  const authorDisplay = activeDoc?.author && !activeDoc.author.includes('Danso') ? activeDoc.author : 'Directorate Officer';

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Document Studio & Rich Editor
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Approved Standards
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Document extraction • Civil service memo & report editor • Grounded Q&A • Deep intelligence
          </p>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2">
          {activeDoc && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1.5 hidden sm:inline">Use as Source:</span>
              <button
                type="button"
                onClick={() => handleSendDocToStudio('minutes')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
                title="Send to Minutes Studio"
              >
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>To Minutes</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendDocToStudio('reports')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 transition-colors"
                title="Send to Report Studio"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                <span>To Report</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendDocToStudio('letters')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                title="Send to Letters & Memos Studio"
              >
                <Send className="h-3.5 w-3.5 text-slate-500" />
                <span>To Letter/Memo</span>
              </button>
            </div>
          )}

          {activeDoc && (
            <button
              onClick={() => onSetContext({ type: 'document', id: activeDoc.id, title: activeDoc.title })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>Set as Context</span>
            </button>
          )}

          {activeDoc && (
            <button
              type="button"
              onClick={() => handleDeleteDoc(activeDoc.id, activeDoc.title)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors shadow-2xs"
              title="Delete this active document"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Delete Document</span>
            </button>
          )}

          {documents.length > 1 && (
            <button
              type="button"
              onClick={handleClearAllDocuments}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-800 transition-colors"
              title="Permanently remove all documents"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Clear All ({documents.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              if (documents.length < 2) {
                alert('At least two documents are required in the repository to perform a comparative analysis.');
                return;
              }
              setCompareModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <GitCompare className="h-3.5 w-3.5 text-indigo-600" />
            <span>Compare</span>
          </button>

          <input
            type="file"
            ref={fileUploadRef}
            onChange={handleFileUpload}
            accept=".txt,.md,.json,.csv,.doc,.docx,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileUploadRef.current?.click()}
            disabled={isExtracting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>Extracting File...</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span>Upload & Extract</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. INNOVATIVE REPOSITORY SEARCH & INTELLIGENCE FILTER BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Top Search & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Real-Time Local Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter repository by title, body content, ref no, or author (Press '/' or Ctrl+K)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-20 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition-all shadow-2xs"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 shadow-2xs">
                /
              </kbd>
            </div>
          </div>

          {/* Right Controls: Sort, View Mode & AI Multi-Doc Synthesis */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="recent">Recently Updated</option>
                <option value="title">Title (A-Z)</option>
                <option value="matches">Most Search Matches</option>
                <option value="version">Highest Version</option>
              </select>
            </div>

            {/* View Mode Switcher (Tabs vs Explorer Cards) */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setRepoViewMode('tabs')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  repoViewMode === 'tabs'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tabbed Ribbon View"
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tabs</span>
              </button>
              <button
                type="button"
                onClick={() => setRepoViewMode('explorer')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  repoViewMode === 'explorer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Rich Document Cards Explorer View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            {/* Innovative Multi-Document AI Synthesis Trigger */}
            {filteredDocuments.length > 0 && (searchQuery.trim() || topicTag) && (
              <button
                type="button"
                onClick={handleSynthesizeSearchResults}
                disabled={isSynthesizingSearch}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50"
                title="Synthesize findings across all matching repository records using Google Gemini"
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="hidden md:inline">AI Synthesize Filtered</span>
                <span className="md:hidden">Synthesize</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Row: Type Filters, Status, Topic Chips & Match Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Document Type Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All (${documents.length})` },
              { id: 'letter', label: 'Letters' },
              { id: 'memorandum', label: 'Memos' },
              { id: 'minutes', label: 'Minutes' },
              { id: 'report', label: 'Reports' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  typeFilter === t.id
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}

            {/* Approval Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
            </select>
          </div>

          {/* Quick Civil Service Topic Intelligence Chips */}
          <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider mr-1 text-[10px]">
              Smart Tags:
            </span>
            {[
              { id: 'budget', label: 'Budget/Finance' },
              { id: 'procurement', label: 'Procurement' },
              { id: 'policy', label: 'Policy/Legal' },
              { id: 'quarterly', label: 'Quarterly KPIs' },
              { id: 'urgent', label: 'Urgent' },
            ].map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTopicTag(topicTag === tag.id ? null : tag.id)}
                className={`rounded-full px-2 py-0.5 font-medium transition-all ${
                  topicTag === tag.id
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                #{tag.label}
              </button>
            ))}

            {/* Reset Filter Button if active */}
            {(searchQuery.trim() || typeFilter !== 'all' || statusFilter !== 'all' || topicTag) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setTopicTag(null);
                }}
                className="ml-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
          <span>
            Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> record(s)
            {searchQuery.trim() && (
              <span className="ml-1.5 text-emerald-700 font-semibold">
                matching "{searchQuery}"
              </span>
            )}
            {topicTag && (
              <span className="ml-1.5 text-indigo-700 font-semibold">
                tagged #{topicTag}
              </span>
            )}
          </span>
          {searchQuery.trim() && (
            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-medium">
              Matches highlighted in real time
            </span>
          )}
        </div>
      </div>

      {/* 3. DOCUMENT REPOSITORY DISPLAY (TABS OR CARDS EXPLORER) */}
      {filteredDocuments.length > 0 ? (
        repoViewMode === 'tabs' ? (
          /* TABBED RIBBON VIEW */
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredDocuments.map((doc) => {
              const matchInfo = getDocMatchInfo(doc, searchQuery);
              const isActive = activeDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 opacity-70 shrink-0" />
                  <span className="max-w-[200px] truncate">{doc.title}</span>
                  <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px]">
                    v{doc.version}
                  </span>
                  {searchQuery && matchInfo.totalMatches > 0 && (
                    <span className="rounded-md bg-amber-400 text-amber-950 font-bold px-1.5 py-0.5 text-[10px]">
                      {matchInfo.totalMatches}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoc(doc.id, doc.title);
                    }}
                    className={`rounded-md p-1 transition-colors ${
                      isActive
                        ? 'text-slate-400 hover:bg-rose-950/40 hover:text-rose-300'
                        : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 opacity-60 group-hover:opacity-100'
                    }`}
                    title="Delete this document"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* RICH EXPLORER CARDS GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDocuments.map((doc) => {
              const matchInfo = getDocMatchInfo(doc, searchQuery);
              const isActive = activeDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`group relative flex flex-col justify-between rounded-2xl p-4 transition-all cursor-pointer border ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-600/30 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Card Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          {doc.type}
                        </span>
                        <span className="rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                          v{doc.version}
                        </span>
                        {doc.approvalStatus === 'Approved' && (
                          <span className="rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                            Approved
                          </span>
                        )}
                      </div>
                      {searchQuery && matchInfo.totalMatches > 0 && (
                        <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-bold">
                          {matchInfo.totalMatches} match{matchInfo.totalMatches === 1 ? '' : 'es'}
                        </span>
                      )}
                    </div>

                    {/* Document Title with Search Term Highlight */}
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug group-hover:text-emerald-800 transition-colors">
                      {renderHighlightedSnippet(doc.title, searchQuery)}
                    </h3>

                    {/* Surrounding Context / Excerpt Snippet with Highlight */}
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      {renderHighlightedSnippet(matchInfo.snippet, searchQuery)}
                    </p>
                  </div>

                  {/* Metadata and Quick Actions */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[130px] font-medium text-slate-700">
                        {doc.author || 'RSIM Officer'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSetContext({ type: 'document', id: doc.id, title: doc.title })}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Set as AI context"
                      >
                        <Layers className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDocId(doc.id);
                          setRepoViewMode('tabs');
                        }}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
                      >
                        {isActive ? 'Editing' : 'Open'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id, doc.title)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* EMPTY SEARCH / FILTER RESULTS */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery.trim() || topicTag || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'No matching documents found'
                : 'No documents in repository'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery.trim()
                ? `No documents in the repository matched the search term "${searchQuery}". Try a different keyword or reset filters.`
                : 'Upload an institutional document (.docx, .pdf, .txt) or create one in the specialized studios.'}
            </p>
          </div>
          {(searchQuery.trim() || topicTag || typeFilter !== 'all' || statusFilter !== 'all') && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setTopicTag(null);
                }}
                className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                Clear Search & Reset All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIVE DOCUMENT EDITOR & INTELLIGENCE SUITE */}

      {activeDoc && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* MAIN EDITOR COLUMN (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Auto-repair notice */}
            {isAutoRepairing && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs flex items-center gap-3 animate-in fade-in">
                <Sparkles className="h-5 w-5 text-emerald-600 animate-spin" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">Word Document Decompression & Auto-Recovery</h4>
                  <p className="text-[11px] text-emerald-700">Extracting and formatting document text and structure from raw Word bytes...</p>
                </div>
              </div>
            )}

            {/* Quick AI Polish Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  AI Quick Polish:
                </span>
                {[
                  'Formalise',
                  'Simplify',
                  'Correct Grammar',
                  'Shorten',
                  'Expand',
                  'Executive Review',
                ].map((act) => (
                  <button
                    key={act}
                    onClick={() => handleAIToolbar(act)}
                    disabled={isProcessingAI}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-800 transition-colors disabled:opacity-50"
                  >
                    {act}
                  </button>
                ))}
              </div>

              {/* Deep Extraction Trigger */}
              <button
                onClick={handleDeepExtractActiveDoc}
                disabled={isExtracting}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                <span>{isExtracting ? 'Extracting...' : 'Deep Extract Insights'}</span>
              </button>
            </div>

            {/* IN-DOCUMENT ACTIVE MATCH BANNER */}
            {searchQuery.trim().length >= 2 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950 shadow-xs">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Local search query: <strong>"{searchQuery}"</strong> •{' '}
                    {getDocMatchInfo(activeDoc, searchQuery).totalMatches > 0 ? (
                      <span className="font-semibold text-emerald-800">
                        {getDocMatchInfo(activeDoc, searchQuery).totalMatches} occurrence(s) in active record (highlighted in Word view)
                      </span>
                    ) : (
                      <span className="text-amber-700 italic">No direct text occurrences in current document body</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline"
                  >
                    Clear Filter
                  </button>
                </div>
              </div>
            )}

            {/* High-Fidelity Word Document Viewer & Editor */}
            <WordDocumentViewer
              title={activeDoc.title}
              content={editorContent}
              referenceNumber={activeDoc.referenceNumber}
              date={activeDoc.createdAt ? new Date(activeDoc.createdAt).toLocaleDateString() : undefined}
              author={authorDisplay}
              department="MINISTRY OF COMMUNICATIONS & DIGITALISATION"
              type={activeDoc.type}
              searchQuery={searchQuery}
              onContentChange={(newContent) => setEditorContent(newContent)}
              onSave={handleSaveDocument}
              onDelete={() => handleDeleteDoc(activeDoc.id, activeDoc.title)}
            />

            {/* Version History info */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
              <span>Version {activeDoc.version} ({activeDoc.versions.length} recorded revisions)</span>
              <span>Last updated: {new Date(activeDoc.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* SIDE PANEL: Tabbed Insights / Summarization / Q&A (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Panel Tabs */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setActiveSideTab('prompt-edit')}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                  activeSideTab === 'prompt-edit'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wand2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Prompt Edit</span>
              </button>
              <button
                onClick={() => setActiveSideTab('summarize')}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                  activeSideTab === 'summarize'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Summaries</span>
              </button>
              <button
                onClick={() => setActiveSideTab('chat')}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                  activeSideTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setActiveSideTab('extraction')}
                className={`flex-1 rounded-lg py-1.5 font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                  activeSideTab === 'extraction'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Insights</span>
              </button>
            </div>

            {/* TAB 0: FOLLOW-UP PROMPT TO EDIT DOCUMENT */}
            {activeSideTab === 'prompt-edit' && (
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
                      <Wand2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Follow-up AI Edit</h4>
                      <p className="text-[11px] text-slate-500">Edit document using natural language</p>
                    </div>
                  </div>
                  {editHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndoPromptEdit}
                      disabled={isPromptEditing}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
                      title="Undo last prompt edit"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>

                {editNotice && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{editNotice}</span>
                  </div>
                )}

                {/* Quick edit suggestion buttons */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-500 block">Quick Follow-Up Prompts:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Add budget breakdown table',
                      'Make tone more authoritative',
                      'Add section on risks & mitigations',
                      'Expand action items with deadlines',
                      'Fix grammatical flow & style',
                    ].map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFollowUpEditPrompt(sug);
                          handleFollowUpEdit(sug);
                        }}
                        disabled={isPromptEditing}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/60 transition-colors disabled:opacity-50"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Textarea */}
                <div className="relative rounded-xl border border-slate-200 bg-white shadow-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <textarea
                    value={followUpEditPrompt}
                    onChange={(e) => setFollowUpEditPrompt(e.target.value)}
                    placeholder="Give your follow-up instruction: e.g. &quot;Add a paragraph detailing the stakeholder engagement outcomes with MTN and Telecel&quot;, &quot;Shorten the background to 2 sentences&quot;..."
                    rows={3}
                    disabled={isPromptEditing}
                    className="w-full resize-none rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:bg-slate-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleFollowUpEdit();
                      }
                    }}
                  />

                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-xl">
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[9px]">Ctrl+Enter</kbd>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleFollowUpEdit()}
                      disabled={isPromptEditing || !followUpEditPrompt.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-xs transition-all"
                    >
                      {isPromptEditing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Editing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
                          <span>Apply Edit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: EXTRACTED INTELLIGENCE */}
            {activeSideTab === 'extraction' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Extracted Intelligence</h4>
                  </div>
                  <button
                    onClick={handleDeepExtractActiveDoc}
                    disabled={isExtracting || isCorruptedZip}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {isExtracting ? 'Analyzing...' : 'Re-extract'}
                  </button>
                </div>

                {activeDoc.extractedData ? (
                  <div className="space-y-3.5 text-xs">
                    {/* Summary */}
                    <div>
                      <span className="font-bold text-slate-800 block mb-1">Executive Summary:</span>
                      <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed text-[11px]">
                        {activeDoc.extractedData.summary}
                      </p>
                    </div>

                    {/* Key Takeaways */}
                    {activeDoc.extractedData.keyTakeaways && activeDoc.extractedData.keyTakeaways.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Key Takeaways:</span>
                        <ul className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-700">
                          {activeDoc.extractedData.keyTakeaways.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Entities */}
                    {activeDoc.extractedData.entities && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1.5">Categorized Entities:</span>
                        <div className="space-y-2 text-[11px]">
                          {activeDoc.extractedData.entities.organizations?.length > 0 && (
                            <div className="flex items-start gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                              <div className="flex flex-wrap gap-1">
                                {activeDoc.extractedData.entities.organizations.map((org, i) => (
                                  <span key={i} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                                    {org}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeDoc.extractedData.entities.dates?.length > 0 && (
                            <div className="flex items-start gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                              <div className="flex flex-wrap gap-1">
                                {activeDoc.extractedData.entities.dates.map((dt, i) => (
                                  <span key={i} className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-100">
                                    {dt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Points */}
                    {activeDoc.extractedData.actionPoints && activeDoc.extractedData.actionPoints.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">Identified Action Points:</span>
                        <ul className="space-y-1 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100 text-[11px] text-emerald-950">
                          {activeDoc.extractedData.actionPoints.map((act, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Extracted Insights Yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                      Click below to analyze and extract structured intelligence from this document.
                    </p>
                    <button
                      onClick={handleDeepExtractActiveDoc}
                      disabled={isExtracting || isCorruptedZip}
                      className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isExtracting ? 'Extracting...' : 'Extract Document Insights'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SUMMARIZATION */}
            {activeSideTab === 'summarize' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Document Summarizer</h4>
                  </div>
                  {summaryResult && (
                    <button
                      onClick={() => navigator.clipboard.writeText(summaryResult)}
                      title="Copy Summary"
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded text-[11px] flex items-center gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mb-2">
                  Extract important information, key findings, and concise overviews from this document:
                </p>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    onClick={() => handleSummarize('Quick Summary')}
                    disabled={isSummarizing || isCorruptedZip}
                    className={`rounded-lg border p-2 font-semibold transition-colors disabled:opacity-50 text-left ${
                      activeSummaryMode === 'Quick Summary' && isSummarizing
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Quick Summary
                  </button>
                  <button
                    onClick={() => handleSummarize('Executive Summary')}
                    disabled={isSummarizing || isCorruptedZip}
                    className={`rounded-lg border p-2 font-semibold transition-colors disabled:opacity-50 text-left ${
                      activeSummaryMode === 'Executive Summary' && isSummarizing
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Executive Summary
                  </button>
                  <button
                    onClick={() => handleSummarize('Key Findings')}
                    disabled={isSummarizing || isCorruptedZip}
                    className={`rounded-lg border p-2 font-semibold transition-colors disabled:opacity-50 text-left ${
                      activeSummaryMode === 'Key Findings' && isSummarizing
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Key Findings
                  </button>
                  <button
                    onClick={() => handleSummarize('Director Brief')}
                    disabled={isSummarizing || isCorruptedZip}
                    className={`rounded-lg border p-2 font-semibold transition-colors disabled:opacity-50 text-left ${
                      activeSummaryMode === 'Director Brief' && isSummarizing
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Director's Brief
                  </button>
                </div>

                {isSummarizing && (
                  <div className="mt-3 flex items-center justify-center gap-2 p-4 text-xs font-semibold text-emerald-700 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Extracting important information with Gemini...</span>
                  </div>
                )}

                {summaryResult && !isSummarizing && (
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3.5 text-xs text-slate-800 max-h-72 overflow-y-auto leading-relaxed scrollbar-thin shadow-xs">
                    <WordFormattedResponse content={summaryResult} />
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CHAT WITH DOCUMENT */}
            {activeSideTab === 'chat' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Chat with Document</h4>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Ask questions strictly grounded in this document's text:
                </p>

                <form onSubmit={handleDocQA} className="flex gap-2">
                  <input
                    type="text"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                    placeholder="e.g. 'What are the key deadlines?'"
                    disabled={isCorruptedZip}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!docQuery.trim() || isProcessingAI || isCorruptedZip}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>

                {docQAHistory.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {docQAHistory.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-white p-3 text-xs shadow-2xs">
                        <p className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 inline-block" />
                          <span>Q: {item.q}</span>
                        </p>
                        <WordFormattedResponse content={item.a} className="text-slate-700 text-xs" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!activeDoc && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-700">No Documents in Repository</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload an institutional document (.docx, .pdf, .txt) using "Upload & Extract Document" above, or author a new Memorandum, Letter, or Report in the specialized studios.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => fileUploadRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
            >
              <Upload className="h-4 w-4" />
              <span>Upload & Extract Document</span>
            </button>
          </div>
        </div>
      )}

      {/* DOCUMENT COMPARISON MODAL */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Compare Directorate Documents</h3>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600">
                Compare current document (<b>{activeDoc?.title}</b>) against another approved record:
              </p>

              <select
                value={compareDocId}
                onChange={(e) => setCompareDocId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50"
              >
                <option value="">-- Select document to compare with --</option>
                {documents
                  .filter((d) => d.id !== activeDoc?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.type})
                    </option>
                  ))}
              </select>

              <button
                onClick={handleRunComparison}
                disabled={!compareDocId}
                className="w-full rounded-xl bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Execute Comparison Analysis
              </button>

              {comparisonResult && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Similarity Index:</span>
                    <span className="text-indigo-600">{comparisonResult.similarityScore}%</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Key Differences:</span>
                    <ul className="list-disc pl-4 text-slate-600 mt-1 space-y-1">
                      {comparisonResult.differences.map((diff: string, i: number) => (
                        <li key={i}>{diff}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Shared Core Concepts:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {comparisonResult.commonTerms.map((term: string, i: number) => (
                        <span key={i} className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px]">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MULTI-DOCUMENT AI SEARCH SYNTHESIS MODAL */}
      {synthesisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    AI Cross-Document Synthesis
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Topic: "{searchQuery || topicTag || 'Filtered Directorate Documents'}" • {filteredDocuments.length} records analyzed
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSynthesisModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
              {isSynthesizingSearch ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Sparkles className="h-8 w-8 text-indigo-600 animate-spin" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Synthesizing Multi-Document Intelligence...
                  </h4>
                  <p className="text-xs text-slate-500 text-center max-w-sm">
                    Google Gemini is reviewing matching records, resolving cross-document findings, and structuring an executive policy synthesis.
                  </p>
                </div>
              ) : searchSynthesisResult ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">
                        Synthesized Directorate Intelligence Brief
                      </span>
                      <span className="rounded-md bg-indigo-200/80 px-2 py-0.5 text-[10px] font-bold text-indigo-900">
                        Gemini Pro Engine
                      </span>
                    </div>
                    <div className="prose prose-xs max-w-none text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-white p-4 rounded-xl border border-indigo-100">
                      {searchSynthesisResult}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No synthesis generated yet.
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            {searchSynthesisResult && !isSynthesizingSearch && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Ready to incorporate into official records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(searchSynthesisResult);
                      alert('Synthesis copied to clipboard!');
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSynthesisAsMemo}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Save as New Memo Draft</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
