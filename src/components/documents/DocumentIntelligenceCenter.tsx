import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Download,
  Share2,
  Trash2,
  Layers,
  Send,
  HelpCircle,
  FileSpreadsheet,
  CheckSquare,
  Building,
  User,
  Calendar,
  DollarSign,
  Shield,
  FileCode,
  Copy,
  Printer,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { DocumentItem, DocumentType, ExtractedDocumentData, ActionItem } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { parseUploadedFile, isBinaryOrZipText } from '../../services/documentParser';

interface DocumentIntelligenceCenterProps {
  documents: DocumentItem[];
  onDocumentsChanged: () => void;
  onSetContext: (ctx: { type: 'document'; id: string; title: string }) => void;
  onNavigateToActionItems?: () => void;
}

export const DocumentIntelligenceCenter: React.FC<DocumentIntelligenceCenterProps> = ({
  documents,
  onDocumentsChanged,
  onSetContext,
  onNavigateToActionItems,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'actions' | 'sections' | 'qa' | 'transform'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Q&A state for current document
  const [qaQuery, setQaQuery] = useState('');
  const [isAnsweringQA, setIsAnsweringQA] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([]);

  // Transform state
  const [transformedOutput, setTransformedOutput] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  // Handle file drop or selection
  const handleProcessFile = async (file: File) => {
    setIsUploading(true);
    setIsExtracting(true);

    try {
      const parsed = await parseUploadedFile(file);
      const rawText = parsed.text;
      const cleanTitle = parsed.cleanTitle;
      const fileSize = parsed.fileSize;
      const fileType = parsed.fileType;

      // Perform deep AI extraction
      let extraction: ExtractedDocumentData;
      let detectedType: DocumentType = 'Uploaded Document';

      try {
        const aiResult = await aiService.extractDocument(rawText, file.name, fileType);
        extraction = aiResult.extractedData;
        if (aiResult.documentType) {
          detectedType = aiResult.documentType;
        }
      } catch (err) {
        console.warn('Using local document fallback extractor:', err);
        extraction = aiService.localExtractDocument(rawText, file.name);
      }

      const newDoc: DocumentItem = {
        id: `doc_${Date.now()}`,
        title: cleanTitle,
        type: detectedType,
        category: 'Uploaded Documents',
        content: rawText || extraction.summary,
        rawText,
        fileName: file.name,
        fileSize,
        fileType,
        summary: extraction.summary,
        extractedData: extraction,
        author: 'Directorate Officer',
        version: 1,
        versions: [],
        approvalStatus: 'Draft',
        comments: [],
        tags: ['Extracted', fileType],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveDocument(newDoc);
      onDocumentsChanged();
      setSelectedDocId(newDoc.id);
    } catch (error) {
      console.error('File upload & extraction failed:', error);
      alert('Failed to process document. Please check file format.');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Re-run deep extraction on current doc
  const handleReExtract = async () => {
    if (!selectedDoc) return;
    setIsExtracting(true);
    try {
      const textToExtract = selectedDoc.rawText || selectedDoc.content;
      const result = await aiService.extractDocument(
        textToExtract,
        selectedDoc.fileName || selectedDoc.title,
        selectedDoc.fileType || 'Text Document'
      );
      const updated: DocumentItem = {
        ...selectedDoc,
        summary: result.extractedData.summary,
        extractedData: result.extractedData,
        type: result.documentType || selectedDoc.type,
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(updated);
      onDocumentsChanged();
    } catch (err) {
      console.error('Re-extraction failed:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Import extracted action items into Action Tracker
  const handleImportActionItems = () => {
    if (!selectedDoc?.extractedData?.actionPoints?.length) return;
    const actions = selectedDoc.extractedData.actionPoints;
    let addedCount = 0;

    actions.forEach((actText, idx) => {
      const newAction: ActionItem = {
        id: `act_ext_${Date.now()}_${idx}`,
        task: actText,
        responsiblePerson: 'Assigned Directorate Lead',
        organization: 'RSIM Directorate',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        priority: 'High',
        status: 'Pending',
        sourceMeetingId: selectedDoc.id,
        notes: `Extracted from uploaded document: "${selectedDoc.title}"`,
        createdAt: new Date().toISOString(),
      };
      storage.saveActionItem(newAction);
      addedCount++;
    });

    alert(`Successfully imported ${addedCount} action items into the Action Tracker.`);
    if (onNavigateToActionItems) {
      onNavigateToActionItems();
    }
  };

  // Handle Q&A with this document
  const handleAskDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuery.trim() || !selectedDoc || isAnsweringQA) return;

    const q = qaQuery.trim();
    setQaQuery('');
    setIsAnsweringQA(true);

    const docContext = `DOCUMENT TITLE: ${selectedDoc.title}
SUMMARY: ${selectedDoc.summary || ''}
CONTENT:
${(selectedDoc.rawText || selectedDoc.content).slice(0, 20000)}
`;

    const prompt = `You are a high-level Document Intelligence Analyst. Answer the following question thoroughly based strictly on this document.
Question: ${q}

Instructions:
- Provide direct, concise, and evidence-grounded answers.
- Reference specific sections, entities, dates, or numbers where applicable.
- If not explicitly mentioned, state clearly that it is not covered in the document.`;

    try {
      const res = await aiService.complete(prompt, docContext, 'Document Analyst');
      setQaHistory((prev) => [{ q, a: res.text }, ...prev]);
    } catch (err) {
      setQaHistory((prev) => [
        { q, a: 'Failed to process document Q&A. Please check network connection.' },
        ...prev,
      ]);
    } finally {
      setIsAnsweringQA(false);
    }
  };

  // Handle Transformation (Convert to Memo, Brief, Letter, etc.)
  const handleTransform = async (format: 'Internal Memo' | 'Executive Brief' | 'Action Plan' | 'Official Letter') => {
    if (!selectedDoc || isTransforming) return;
    setIsTransforming(true);
    setTransformedOutput(null);

    const prompt = `Convert and synthesize the following extracted document into a formal, complete, civil service standard "${format}".
Document Title: ${selectedDoc.title}
Summary: ${selectedDoc.summary || ''}
Content:
${(selectedDoc.rawText || selectedDoc.content).slice(0, 20000)}

Formatting Guidelines:
- Follow standard executive structure.
- Include proper headings, clear purpose, structured observations, and directive recommendations.
- Keep numbers, dates, and named entities strictly accurate.`;

    try {
      const res = await aiService.complete(prompt, `Format: ${format}`, 'Document Transformation Engine');
      setTransformedOutput(res.text);
    } catch (err) {
      setTransformedOutput('Failed to transform document.');
    } finally {
      setIsTransforming(false);
    }
  };

  // Save transformed output as new document
  const handleSaveTransformedAsDoc = (type: DocumentType) => {
    if (!transformedOutput || !selectedDoc) return;
    const newDoc: DocumentItem = {
      id: `doc_tr_${Date.now()}`,
      title: `${type}: ${selectedDoc.title}`,
      type,
      category: 'Transformed Documents',
      content: transformedOutput,
      author: 'Directorate Workstation',
      version: 1,
      versions: [],
      approvalStatus: 'Draft',
      comments: [],
      tags: ['AI Generated', type, selectedDoc.title.slice(0, 20)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveDocument(newDoc);
    onDocumentsChanged();
    setSelectedDocId(newDoc.id);
    alert(`Saved as new ${type}!`);
  };

  // Filtered documents list
  const filteredDocs = documents.filter((doc) => {
    const matchSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.summary && doc.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filterType === 'all' || doc.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header & Upload Strip */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Document Intelligence & Extraction Center
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              AI Deep Extractor
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Upload any document (PDF, Word, TXT, Markdown, CSV) to extract structured intelligence, action points, and entities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleProcessFile(e.target.files[0]);
              }
            }}
            accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,.xml"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isExtracting}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />
            <span>{isExtracting ? 'Extracting Intelligence...' : 'Upload & Extract Document'}</span>
          </button>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50/60 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-emerald-500 hover:bg-slate-50/70 shadow-xs'
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3">
          <UploadCloud className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">
          Drop any institutional file here or click to browse
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Supports PDF, Word (.docx), Plain Text (.txt), Markdown (.md), CSV, JSON
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] font-medium text-slate-400">
          <span className="rounded-md bg-slate-100 px-2 py-0.5">Automated Executive Summary</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5">Entity Recognition</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5">Action Extraction</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5">Document Q&A</span>
        </div>
      </div>

      {/* 3. Main Workspace Grid: Document Library (Left) & Extraction Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stored Documents (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Document Repository ({filteredDocs.length})
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                + New Upload
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search extracted documents..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>

            {/* Document List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No documents found matching your criteria.
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  const isSelected = doc.id === selectedDoc?.id;
                  const hasExtraction = Boolean(doc.extractedData || doc.summary);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`group cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={`h-4 w-4 ${
                              isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          />
                          <h4 className="font-bold text-slate-900 text-xs line-clamp-1">
                            {doc.title}
                          </h4>
                        </div>
                        {hasExtraction && (
                          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                            Extracted
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                        {doc.summary || doc.content.slice(0, 100)}...
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                        <span>{doc.type}</span>
                        <span>{doc.fileSize || `${(doc.content.length / 1000).toFixed(1)}k chars`}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Deep Extraction Viewer & Operations (8 cols) */}
        <div className="lg:col-span-8">
          {selectedDoc ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Document Header Bar */}
              <div className="border-b border-slate-200 bg-slate-50/60 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {selectedDoc.type}
                      </span>
                      {selectedDoc.fileName && (
                        <span className="text-xs text-slate-400 font-mono">
                          {selectedDoc.fileName}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {selectedDoc.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleReExtract}
                      disabled={isExtracting}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs disabled:opacity-50"
                      title="Re-run AI extraction"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isExtracting ? 'animate-spin' : ''}`} />
                      <span>Re-Extract</span>
                    </button>

                    <button
                      onClick={() => onSetContext({ type: 'document', id: selectedDoc.id, title: selectedDoc.title })}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                      title="Pin document as context for AI Assistant"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Attach to AI</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-200 pb-px">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'overview'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Executive Summary & Takeaways
                  </button>

                  <button
                    onClick={() => setActiveTab('entities')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'entities'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Key Entities & Metrics
                  </button>

                  <button
                    onClick={() => setActiveTab('actions')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'actions'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Action Points ({selectedDoc.extractedData?.actionPoints?.length || 0})
                  </button>

                  <button
                    onClick={() => setActiveTab('sections')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'sections'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Full Text & Sections
                  </button>

                  <button
                    onClick={() => setActiveTab('qa')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'qa'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chat with Doc (Q&A)
                  </button>

                  <button
                    onClick={() => setActiveTab('transform')}
                    className={`rounded-t-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      activeTab === 'transform'
                        ? 'border-b-2 border-emerald-600 bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Transform & Convert
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="p-6">
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Executive Summary */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Executive Summary
                      </h3>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {selectedDoc.extractedData?.summary || selectedDoc.summary || selectedDoc.content.slice(0, 500)}
                      </div>
                    </div>

                    {/* Critical Takeaways */}
                    {selectedDoc.extractedData?.keyTakeaways && selectedDoc.extractedData.keyTakeaways.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                          Key Takeaways & Core Findings
                        </h3>
                        <div className="space-y-2">
                          {selectedDoc.extractedData.keyTakeaways.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-800 shadow-2xs"
                            >
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700 text-[10px]">
                                {idx + 1}
                              </span>
                              <p className="leading-relaxed">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Steps */}
                    {selectedDoc.extractedData?.suggestedNextSteps && selectedDoc.extractedData.suggestedNextSteps.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                          <ArrowRight className="h-4 w-4 text-amber-600" />
                          Recommended Directorate Next Steps
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedDoc.extractedData.suggestedNextSteps.map((step, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs text-amber-950 leading-relaxed"
                            >
                              • {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. ENTITIES & METRICS TAB */}
                {activeTab === 'entities' && (
                  <div className="space-y-5">
                    {/* Organizations */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-blue-600" />
                        Organizations & Institutions Identified
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.extractedData?.entities?.organizations?.length ? (
                          selectedDoc.extractedData.entities.organizations.map((org, i) => (
                            <span key={i} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                              {org}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None extracted.</span>
                        )}
                      </div>
                    </div>

                    {/* People */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-600" />
                        Key Officials & Stakeholders
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.extractedData?.entities?.people?.length ? (
                          selectedDoc.extractedData.entities.people.map((person, i) => (
                            <span key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {person}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None extracted.</span>
                        )}
                      </div>
                    </div>

                    {/* Dates & Timelines */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-purple-600" />
                        Dates, Timelines & Deadlines
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.extractedData?.entities?.dates?.length ? (
                          selectedDoc.extractedData.entities.dates.map((date, i) => (
                            <span key={i} className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-800">
                              {date}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None extracted.</span>
                        )}
                      </div>
                    </div>

                    {/* Numbers & Financials */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        Budgets, Metrics & Financial Data
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.extractedData?.entities?.numbersAndMetrics?.length ? (
                          selectedDoc.extractedData.entities.numbersAndMetrics.map((metric, i) => (
                            <span key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 font-mono">
                              {metric}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None extracted.</span>
                        )}
                      </div>
                    </div>

                    {/* Policies & Acts */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-slate-700" />
                        Acts, Statutory Frameworks & Policies
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.extractedData?.entities?.policiesOrActs?.length ? (
                          selectedDoc.extractedData.entities.policiesOrActs.map((policy, i) => (
                            <span key={i} className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                              {policy}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None extracted.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ACTION POINTS TAB */}
                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {selectedDoc.extractedData?.actionPoints?.length || 0} actionable mandates detected from this document:
                      </p>

                      {selectedDoc.extractedData?.actionPoints?.length ? (
                        <button
                          onClick={handleImportActionItems}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs transition-colors"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                          <span>Import All to Action Tracker</span>
                        </button>
                      ) : null}
                    </div>

                    {selectedDoc.extractedData?.actionPoints?.length ? (
                      <div className="space-y-2">
                        {selectedDoc.extractedData.actionPoints.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                          >
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-slate-900 leading-snug">{item}</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Default Assignment: Lead Directorate Officer • Status: Pending
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200">
                        No distinct action items detected. Click "Re-Extract" above to analyze again.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. SECTIONS & FULL TEXT TAB */}
                {activeTab === 'sections' && (
                  <div className="space-y-4">
                    {selectedDoc.extractedData?.sections?.length ? (
                      <div className="space-y-3">
                        {selectedDoc.extractedData.sections.map((sec, i) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <h4 className="font-bold text-slate-900 text-xs mb-1.5">{sec.heading}</h4>
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{sec.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Full Extracted Text ({selectedDoc.content.length} characters)
                      </h4>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 max-h-96 overflow-y-auto whitespace-pre-wrap scrollbar-thin">
                        {selectedDoc.rawText || selectedDoc.content}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. CHAT WITH DOCUMENT (Q&A) */}
                {activeTab === 'qa' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Ask any question specifically answered by or related to "{selectedDoc.title}":
                    </p>

                    <form onSubmit={handleAskDoc} className="flex gap-2">
                      <input
                        type="text"
                        value={qaQuery}
                        onChange={(e) => setQaQuery(e.target.value)}
                        placeholder="e.g., 'What are the budgetary implications mentioned in this report?'"
                        className="flex-1 rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={!qaQuery.trim() || isAnsweringQA}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{isAnsweringQA ? 'Thinking...' : 'Ask'}</span>
                      </button>
                    </form>

                    <div className="space-y-3 pt-2">
                      {qaHistory.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Ask your first question above to inspect findings, verify data points, or clarify requirements.
                        </div>
                      ) : (
                        qaHistory.map((item, idx) => (
                          <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                            <p className="text-xs font-bold text-slate-900">Q: {item.q}</p>
                            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap border-t border-slate-200/60 pt-2">
                              {item.a}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 6. TRANSFORM & CONVERT TAB */}
                {activeTab === 'transform' && (
                  <div className="space-y-5">
                    <p className="text-xs text-slate-500">
                      Transform this extracted document into another official institutional format with 1 click:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button
                        onClick={() => handleTransform('Internal Memo')}
                        disabled={isTransforming}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition-all"
                      >
                        <FileText className="h-4 w-4 text-emerald-700 mb-1" />
                        <h5 className="font-bold text-slate-900 text-xs">Official Memo</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">Submission or Request format</p>
                      </button>

                      <button
                        onClick={() => handleTransform('Executive Brief')}
                        disabled={isTransforming}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition-all"
                      >
                        <Sparkles className="h-4 w-4 text-indigo-700 mb-1" />
                        <h5 className="font-bold text-slate-900 text-xs">Executive Brief</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">High-level minister briefing</p>
                      </button>

                      <button
                        onClick={() => handleTransform('Action Plan')}
                        disabled={isTransforming}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition-all"
                      >
                        <CheckSquare className="h-4 w-4 text-purple-700 mb-1" />
                        <h5 className="font-bold text-slate-900 text-xs">Action Plan</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">Prioritized rollout roadmap</p>
                      </button>

                      <button
                        onClick={() => handleTransform('Official Letter')}
                        disabled={isTransforming}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition-all"
                      >
                        <Send className="h-4 w-4 text-blue-700 mb-1" />
                        <h5 className="font-bold text-slate-900 text-xs">Official Letter</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">External agency notice</p>
                      </button>
                    </div>

                    {isTransforming && (
                      <div className="p-8 text-center text-xs text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-600" />
                        Synthesizing official document from extracted intelligence...
                      </div>
                    )}

                    {transformedOutput && !isTransforming && (
                      <div className="space-y-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900">Synthesized Document Output:</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveTransformedAsDoc('Internal Memo')}
                              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                            >
                              Save to Documents
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {transformedOutput}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No document selected</p>
              <p className="text-xs text-slate-400 mt-1">Upload a document above or pick one from the repository.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
