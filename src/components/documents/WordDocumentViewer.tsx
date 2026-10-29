import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  Edit3,
  Eye,
  BookmarkPlus,
  Trash2,
  Smartphone,
  Sparkles,
  Wand2,
  Undo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Palette,
  Loader2,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { exportToDocx, exportToPdf } from '../../utils/docxExporter';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import { aiService } from '../../services/aiService';
import { TemplateFormatting } from '../../types';
import { DocumentModelSelector } from '../common/DocumentModelSelector';

interface WordDocumentViewerProps {
  title: string;
  content: string;
  referenceNumber?: string;
  date?: string;
  author?: string;
  department?: string;
  type?: string;
  searchQuery?: string;
  formatting?: TemplateFormatting;
  onContentChange?: (newContent: string) => void;
  onSave?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
}

export const WordDocumentViewer: React.FC<WordDocumentViewerProps> = ({
  title,
  content,
  referenceNumber,
  date,
  author,
  department = 'MINISTRY OF COMMUNICATIONS, DIGITAL TECHNOLOGY AND INNOVATIONS',
  type = 'Official Document',
  searchQuery = '',
  formatting,
  onContentChange,
  onSave,
  onDelete,
  onClear,
}) => {
  // Document View & Layout Mode
  const [viewMode, setViewMode] = useState<'word-page' | 'raw-editor'>('word-page');
  const [pageLayout, setPageLayout] = useState<'a4-sheet' | 'device-fluid'>('a4-sheet');
  const [isDirectEditing, setIsDirectEditing] = useState(false);

  // Microsoft Word-Style Formatting Ribbon State
  const [fontFamily, setFontFamily] = useState<string>(formatting?.fontFamily || 'Times New Roman');
  const [fontSize, setFontSize] = useState<string>(formatting?.bodyFontSize || '12pt');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justified'>(
    (formatting?.alignment as any) || 'justified'
  );
  const [lineSpacing, setLineSpacing] = useState<string>(formatting?.lineSpacing || '1.15');
  const [pageMargin, setPageMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [pageTheme, setPageTheme] = useState<'white' | 'ivory' | 'slate'>('white');

  // AI Follow-up & Refinement State
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinementStatus, setRefinementStatus] = useState<string>('');
  const [refinementSuccess, setRefinementSuccess] = useState<string | null>(null);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('doc_writing_preferred_model') || 'gemini-3.8-flash';
  });

  // Action status indicators
  const [copied, setCopied] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExtractingTemplate, setIsExtractingTemplate] = useState(false);
  const [templateExtractedSuccess, setTemplateExtractedSuccess] = useState<string | null>(null);

  // Direct editing textarea ref for inline formatting insertion
  const sheetEditorRef = useRef<HTMLTextAreaElement>(null);
  const rawEditorRef = useRef<HTMLTextAreaElement>(null);

  // Sync incoming formatting prop if changed
  useEffect(() => {
    if (formatting?.fontFamily) setFontFamily(formatting.fontFamily);
    if (formatting?.bodyFontSize) setFontSize(formatting.bodyFontSize);
    if (formatting?.alignment) setAlignment(formatting.alignment as any);
    if (formatting?.lineSpacing) setLineSpacing(formatting.lineSpacing);
  }, [formatting]);

  // Combined formatting object passed to exports
  const currentFormatting: TemplateFormatting = {
    ...formatting,
    fontFamily,
    bodyFontSize: fontSize,
    alignment,
    lineSpacing,
  };

  // Word count and character count calculation
  const stats = React.useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = content.length;
    return { words, chars };
  }, [content]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Word
  const handleDownloadWord = async () => {
    try {
      setIsExportingWord(true);
      await exportToDocx({
        title,
        content,
        referenceNumber,
        date: date || new Date().toLocaleDateString(),
        author,
        department,
        type,
        formatting: currentFormatting,
      });
    } catch (err) {
      console.error('Failed to export DOCX:', err);
      alert('Failed to generate Word document.');
    } finally {
      setIsExportingWord(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    exportToPdf({
      title,
      content,
      referenceNumber,
      date: date || new Date().toLocaleDateString(),
      author,
      department,
      type,
      formatting: currentFormatting,
    });
  };

  // AI Follow-Up Refine Handler
  const handleRefineDocument = async (promptToUse?: string) => {
    const promptText = (promptToUse !== undefined ? promptToUse : followUpPrompt).trim();
    if (!promptText) return;
    if (!content.trim()) {
      alert('Document content is empty. Draft content first before refining.');
      return;
    }

    setIsRefining(true);
    setRefinementStatus('Consulting AI model to revise document...');
    try {
      // Save current content to history stack for 1-click Undo
      setHistoryStack((prev) => [...prev, content]);

      const res = await aiService.editDraftWithPrompt(content, promptText, {
        documentType: type,
        title,
        preferredModel: selectedModel,
        onProgress: (msg) => setRefinementStatus(msg),
      });

      if (res.success && res.fullDraft) {
        onContentChange?.(res.fullDraft);
        setFollowUpPrompt('');
        setRefinementSuccess(
          `Document updated with AI: "${promptText.slice(0, 50)}${promptText.length > 50 ? '...' : ''}"`
        );
        setTimeout(() => setRefinementSuccess(null), 8000);
      }
    } catch (err: any) {
      console.error('Document refinement error:', err);
      alert('Failed to refine document with AI. Please try again.');
    } finally {
      setIsRefining(false);
      setRefinementStatus('');
    }
  };

  // Revert / Undo Last AI Edit
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    onContentChange?.(previous);
    setRefinementSuccess('Reverted back to previous document version.');
    setTimeout(() => setRefinementSuccess(null), 4000);
  };

  // Inline formatting wrapper for selected text in editor
  const applyInlineFormatting = (openTag: string, closeTag: string) => {
    const activeTextarea = isDirectEditing ? sheetEditorRef.current : rawEditorRef.current;
    if (!activeTextarea) return;

    const start = activeTextarea.selectionStart;
    const end = activeTextarea.selectionEnd;
    const selectedText = content.substring(start, end);

    const replacement = selectedText
      ? `${openTag}${selectedText}${closeTag}`
      : `${openTag}sample text${closeTag}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    onContentChange?.(newContent);

    setTimeout(() => {
      activeTextarea.focus();
      const newCursorPos = start + openTag.length + (selectedText ? selectedText.length : 0);
      activeTextarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // AI Extract Template
  const handleExtractTemplate = async () => {
    if (!content.trim() || isExtractingTemplate) return;
    setIsExtractingTemplate(true);
    try {
      const cat = type.toLowerCase().includes('letter')
        ? 'letters'
        : type.toLowerCase().includes('memo')
        ? 'memos'
        : type.toLowerCase().includes('minute')
        ? 'minutes'
        : 'reports';

      const res = await api.post('/api/ai/extract-template-from-doc', {
        content,
        title,
        targetType: cat,
      });
      if (res.ok && res.data?.template) {
        const t = res.data.template;
        const docTypeMap: Record<string, 'Letter' | 'Memo' | 'Minutes' | 'Report'> = {
          letters: 'Letter',
          memos: 'Memo',
          minutes: 'Minutes',
          reports: 'Report',
        };
        storage.saveTemplate({
          id: `tpl_extracted_${Date.now()}`,
          title: t.templateName || `${title} Template`,
          name: t.templateName || `${title} Template`,
          documentType: docTypeMap[cat] || 'Letter',
          category: (t.category || cat) as any,
          description: t.description || 'Extracted with AI from official document',
          content: t.templateContent || content,
          fields: t.fields || [],
          source: 'ai_customized',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setTemplateExtractedSuccess(t.templateName || 'Template');
        setTimeout(() => setTemplateExtractedSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Template extraction error:', err);
    } finally {
      setIsExtractingTemplate(false);
    }
  };

  // Calculate search query match count in document content
  const matchCount = React.useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return 0;
    try {
      const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = content.match(new RegExp(escaped, 'gi'));
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [content, searchQuery]);

  // Render paragraphs, tables, and styled markdown for Word view
  const renderWordDocumentContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-3" />);
        i++;
        continue;
      }

      // 1. Markdown Table Parser (| col1 | col2 |)
      if (trimmed.startsWith('|')) {
        const tableLines: string[] = [];
        const tableStartIndex = i;
        while (i < lines.length) {
          const cur = lines[i].trim();
          if (cur.startsWith('|')) {
            tableLines.push(cur);
            i++;
          } else if (cur === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
            i++;
          } else {
            break;
          }
        }

        if (tableLines.length >= 2) {
          const parseRow = (rowStr: string) => {
            const rawParts = rowStr.split('|');
            if (rowStr.startsWith('|')) rawParts.shift();
            if (rowStr.endsWith('|')) rawParts.pop();
            return rawParts.map((c) => c.trim());
          };

          const headers = parseRow(tableLines[0]);
          const isSeparator = /^\|?[-:\s|]+\|?$/.test(tableLines[1]);
          const bodyLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);

          elements.push(
            <div
              key={`table-${tableStartIndex}`}
              className="my-5 overflow-x-auto rounded-xl border-2 border-slate-300 bg-white shadow-sm"
            >
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b-2 border-slate-300">
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className={`px-4 py-3 border-r border-slate-300 last:border-r-0 font-black text-xs uppercase tracking-wider text-slate-900 ${
                          hIdx === 0 && headers.length === 2 ? 'w-1/4 min-w-[140px] max-w-[220px]' : ''
                        }`}
                        dangerouslySetInnerHTML={{ __html: formatInline(h) }}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bodyLines.map((rowLine, rIdx) => {
                    const cells = parseRow(rowLine);
                    return (
                      <tr
                        key={rIdx}
                        className={`transition-colors ${
                          rIdx % 2 === 1 ? 'bg-slate-50/70 hover:bg-slate-100/60' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {cells.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-4 py-3 border-r border-slate-200 last:border-r-0 text-slate-850 text-xs sm:text-sm leading-relaxed align-top ${
                              cIdx === 0 && cells.length === 2
                                ? 'font-semibold w-1/4 min-w-[140px] max-w-[220px] bg-slate-50/50 text-slate-900'
                                : 'w-3/4'
                            }`}
                            dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 2. Main Headings
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-xl font-bold uppercase tracking-tight text-slate-900 border-b-2 border-slate-900 pb-1 mt-6 mb-3"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
          />
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-base font-bold text-slate-900 mt-5 mb-2"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(3)) }}
          />
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-sm font-bold text-slate-800 mt-4 mb-1"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(4)) }}
          />
        );
        i++;
        continue;
      }

      // 3. Bullet Lists
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const text = trimmed.slice(2);
        elements.push(
          <li key={`li-${i}`} className="ml-6 list-disc text-sm text-slate-800 leading-relaxed my-1">
            <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
          </li>
        );
        i++;
        continue;
      }

      // 4. Numbered Lists (1. , 2. etc)
      if (/^\d+\.\s+/.test(trimmed)) {
        elements.push(
          <div key={`num-${i}`} className="ml-4 text-sm text-slate-800 leading-relaxed my-1 flex gap-2">
            <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
          </div>
        );
        i++;
        continue;
      }

      // 5. Horizontal dividers (e.g. ---------- or ========== or __________)
      if (/^[-=_]{3,}$/.test(trimmed)) {
        elements.push(<hr key={`hr-${i}`} className="border-t border-slate-300 my-4" />);
        i++;
        continue;
      }

      // 6. Key-value headers like TO:, FROM:, DATE:, SUBJECT:, VENUE:, CHAIR:
      if (/^(TO|FROM|THROUGH|DATE|TIME|VENUE|MEETING CHAIR|CHAIR|CO-CHAIR|REF|REF\.\s*NO|SUBJECT):/i.test(trimmed)) {
        const [label, ...rest] = trimmed.split(':');
        elements.push(
          <div key={`kv-${i}`} className="text-sm leading-relaxed my-1.5 flex flex-wrap gap-2 text-slate-900">
            <span className="font-bold tracking-wide uppercase text-slate-800 min-w-[90px]">{label}:</span>
            <span
              className="font-semibold text-slate-900 flex-1"
              dangerouslySetInnerHTML={{ __html: formatInline(rest.join(':').trim()) }}
            />
          </div>
        );
        i++;
        continue;
      }

      // 7. Standard paragraph
      elements.push(
        <p
          key={`p-${i}`}
          className={`text-sm text-slate-800 leading-relaxed mb-3 whitespace-pre-wrap ${
            alignment === 'justified'
              ? 'text-justify'
              : alignment === 'center'
              ? 'text-center'
              : alignment === 'right'
              ? 'text-right'
              : 'text-left'
          }`}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      );
      i++;
    }

    return elements;
  };

  // Format bold, italic, bullet formatting, and highlight search query
  const formatInline = (text: string) => {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/(?:^|\s+)•\s*/g, (match, offset) => (offset === 0 ? '• ' : '<br/>• '));

    if (searchQuery && searchQuery.trim().length >= 2) {
      try {
        const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        formatted = formatted.replace(
          regex,
          '<mark class="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-semibold shadow-2xs">$1</mark>'
        );
      } catch {}
    }
    return formatted;
  };

  // Quick follow-up refinement suggestions
  const quickRefinements = [
    { label: '⚡ Expand Details & Metrics', prompt: 'Expand this document with more exhaustive technical details, data points, specific operational metrics, and institutional considerations.' },
    { label: '🏛️ Elevate Executive Tone', prompt: 'Elevate the vocabulary and tone to authoritative, formal Ghanaian Civil Service executive standards.' },
    { label: '📊 Add Implementation Timeline', prompt: 'Add an actionable implementation roadmap with milestones, deliverables, timelines, and responsible agencies table.' },
    { label: '✂️ Make Concise', prompt: 'Make this draft more concise, eliminate redundancies, and tighten the prose while keeping all essential findings and decisions.' },
    { label: '📜 Add Statutory Grounding', prompt: 'Ensure all recommendations cite relevant statutory mandates, digital policies, and institutional directives.' },
  ];

  // Font family options matching Microsoft Word
  const fontOptions = [
    { label: 'Times New Roman (Formal / Civil Service)', value: 'Times New Roman' },
    { label: 'Calibri (Modern Office Standard)', value: 'Calibri' },
    { label: 'Arial (Clean Sans-Serif)', value: 'Arial' },
    { label: 'Aptos (Microsoft 365 Default)', value: 'Aptos' },
    { label: 'Georgia (Editorial Serif)', value: 'Georgia' },
    { label: 'Garamond (Executive Serif)', value: 'Garamond' },
    { label: 'Inter (Digital Modern)', value: 'Inter' },
    { label: 'Courier New (Monospace / Technical)', value: 'Courier New' },
  ];

  // Font sizes
  const fontSizeOptions = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt'];

  // Line spacings
  const lineSpacingOptions = [
    { label: '1.0 (Single)', value: '1.0' },
    { label: '1.15 (Standard Word)', value: '1.15' },
    { label: '1.5 (1.5 Lines)', value: '1.5' },
    { label: '2.0 (Double Spaced)', value: '2.0' },
  ];

  // Page padding margins
  const marginStyles = {
    normal: pageLayout === 'a4-sheet' ? 'p-8 sm:p-12 md:p-16' : 'p-6 sm:p-8',
    narrow: pageLayout === 'a4-sheet' ? 'p-4 sm:p-6 md:p-8' : 'p-4 sm:p-6',
    wide: pageLayout === 'a4-sheet' ? 'p-10 sm:p-16 md:p-20' : 'p-8 sm:p-10',
  };

  // Paper theme styles
  const themeStyles = {
    white: 'bg-white text-slate-900 border-slate-200/90 shadow-2xl',
    ivory: 'bg-[#fefdf9] text-stone-900 border-amber-200/60 shadow-2xl',
    slate: 'bg-slate-900 text-slate-100 border-slate-800 shadow-2xl',
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP DOCUMENT ACTION BAR (Word, PDF, Beautify, View Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* View Mode Toggle */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => {
              setViewMode('word-page');
              setIsDirectEditing(false);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'word-page' && !isDirectEditing
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-emerald-600" />
            <span>Word Reading View</span>
          </button>

          <button
            onClick={() => {
              setViewMode('word-page');
              setIsDirectEditing(true);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'word-page' && isDirectEditing
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Edit text directly on the Microsoft Word styled page"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Direct Edit on Sheet</span>
          </button>

          <button
            onClick={() => setViewMode('raw-editor')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'raw-editor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Open plain text / markdown editor"
          >
            <Type className="h-3.5 w-3.5 text-slate-600" />
            <span>Plain Text / Markdown</span>
          </button>
        </div>

        {/* Page Responsiveness Layout Selector (A4 Sheet vs Fit Device) */}
        {viewMode === 'word-page' && (
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
            <button
              onClick={() => setPageLayout('a4-sheet')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                pageLayout === 'a4-sheet'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="A4 Sheet Mode: Realistic standard page margins and drop shadow"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">A4 Page</span>
            </button>
            <button
              onClick={() => setPageLayout('device-fluid')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                pageLayout === 'device-fluid'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Device Responsive: Fluid width adapting dynamically to any phone or tablet"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fit Device</span>
            </button>
          </div>
        )}

        {/* Search match indicator badge if search active */}
        {searchQuery && searchQuery.trim().length >= 2 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              {matchCount > 0
                ? `${matchCount} match${matchCount === 1 ? '' : 'es'} highlighted for "${searchQuery}"`
                : `0 matches in doc for "${searchQuery}"`}
            </span>
          </div>
        )}

        {/* Serious Institutional Tools */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleExtractTemplate}
            disabled={isExtractingTemplate}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            title="Convert this document into a reusable institutional template"
          >
            <BookmarkPlus className="h-3.5 w-3.5 text-indigo-600" />
            <span>{isExtractingTemplate ? 'Extracting...' : 'Save as Institutional Template'}</span>
          </button>
        </div>

        {/* Export & Download Buttons */}
        <div className="flex items-center gap-2">
          {/* Download as Word .docx */}
          <button
            onClick={handleDownloadWord}
            disabled={isExportingWord}
            className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors disabled:opacity-50"
            title="Download true Microsoft Word (.docx) document"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExportingWord ? 'Exporting...' : 'Word (.docx)'}</span>
          </button>

          {/* Download as PDF */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-800 transition-colors"
            title="Download or Print formatted PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>PDF</span>
          </button>

          {/* Copy Text */}
          <button
            onClick={handleCopy}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Copy document text"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {onClear && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to discard this draft?')) {
                  onClear();
                }
              }}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
              title="Discard / Clear Draft"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Discard</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
                  onDelete();
                }
              }}
              className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              title="Delete this document"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Delete</span>
            </button>
          )}

          {onSave && (
            <button
              onClick={onSave}
              className="rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* 2. MICROSOFT WORD FORMATTING & APPEARANCE RIBBON */}
      <div className="rounded-2xl border border-slate-200/90 bg-linear-to-r from-slate-50 via-white to-slate-50 p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Group A: Font Family & Size */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Font Style */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Font:</span>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                title="Select Font Style (Word typography)"
              >
                {fontOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                title="Select Font Size"
              >
                {fontSizeOptions.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Group B: Typography Inline Controls (B, I, U, S) */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => applyInlineFormatting('**', '**')}
              className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Bold (**text**)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyInlineFormatting('*', '*')}
              className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Italic (*text*)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyInlineFormatting('<u>', '</u>')}
              className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Underline (<u>text</u>)"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyInlineFormatting('~~', '~~')}
              className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Strikethrough (~~text~~)"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Group C: Text Alignment */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setAlignment('left')}
              className={`rounded-lg p-1.5 transition-colors ${
                alignment === 'left' ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Align Left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAlignment('center')}
              className={`rounded-lg p-1.5 transition-colors ${
                alignment === 'center' ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Align Center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAlignment('right')}
              className={`rounded-lg p-1.5 transition-colors ${
                alignment === 'right' ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Align Right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAlignment('justified')}
              className={`rounded-lg p-1.5 transition-colors ${
                alignment === 'justified' ? 'bg-blue-100 text-blue-800 font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Justify Text (Institutional Civil Service Standard)"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Group D: Line Spacing & Margins & Appearance Theme */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Line Spacing */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Spacing:</span>
              <select
                value={lineSpacing}
                onChange={(e) => setLineSpacing(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                title="Line Spacing (Word Standard)"
              >
                {lineSpacingOptions.map((sp) => (
                  <option key={sp.value} value={sp.value}>
                    {sp.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Margins */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Margin:</span>
              <select
                value={pageMargin}
                onChange={(e) => setPageMargin(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                title="Document Margins"
              >
                <option value="normal">Normal (1 in)</option>
                <option value="narrow">Narrow (0.5 in)</option>
                <option value="wide">Wide (1.5 in)</option>
              </select>
            </div>

            {/* Paper Theme */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paper:</span>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPageTheme('white')}
                  className={`h-5 w-5 rounded border transition-all ${
                    pageTheme === 'white' ? 'border-blue-600 scale-110 shadow-xs' : 'border-slate-300'
                  } bg-white`}
                  title="Paper White"
                />
                <button
                  type="button"
                  onClick={() => setPageTheme('ivory')}
                  className={`h-5 w-5 rounded border transition-all ${
                    pageTheme === 'ivory' ? 'border-amber-600 scale-110 shadow-xs' : 'border-amber-200'
                  } bg-[#fefdf9]`}
                  title="Executive Warm Ivory"
                />
                <button
                  type="button"
                  onClick={() => setPageTheme('slate')}
                  className={`h-5 w-5 rounded border transition-all ${
                    pageTheme === 'slate' ? 'border-slate-400 scale-110 shadow-xs' : 'border-slate-600'
                  } bg-slate-900`}
                  title="Modern Contrast Dark"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. AI FOLLOW-UP PROMPT & DOCUMENT REFINER BAR */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50/70 via-blue-50/50 to-white p-3.5 shadow-xs">
        <div className="flex flex-col gap-2.5">
          {/* Top Row: Label, Model Selector, Undo Button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-indigo-950">
                AI Follow-Up & Document Refiner
              </span>
              <span className="hidden sm:inline text-[11px] text-indigo-600 font-medium">
                Ask AI to edit, expand, rephrase, or format any section of this document
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Document Model Selector */}
              <div className="scale-95 origin-right">
                <DocumentModelSelector
                  selectedModel={selectedModel}
                  onSelectModel={setSelectedModel}
                />
              </div>

              {/* Undo Button if History available */}
              {historyStack.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition-colors"
                  title="Revert to document version before last AI edit"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Undo AI Edit ({historyStack.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Input & Refine Button */}
          <div className="flex gap-2">
            <input
              type="text"
              value={followUpPrompt}
              onChange={(e) => setFollowUpPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRefineDocument();
                }
              }}
              placeholder='Ask AI to edit this document (e.g., "Expand section 2 on data sovereignty", "Shorten introduction", "Make tone more authoritative civil service")...'
              disabled={isRefining}
              className="flex-1 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 shadow-inner focus:border-indigo-500 focus:outline-hidden disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => handleRefineDocument()}
              disabled={isRefining || !followUpPrompt.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isRefining ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Refining...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Refine with AI</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Quick Edits:</span>
            {quickRefinements.map((refine, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFollowUpPrompt(refine.prompt);
                  handleRefineDocument(refine.prompt);
                }}
                disabled={isRefining}
                className="rounded-lg border border-indigo-100 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-indigo-900 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {refine.label}
              </button>
            ))}
          </div>

          {/* Status Message if refining */}
          {refinementStatus && (
            <div className="flex items-center gap-2 text-xs text-indigo-700 animate-pulse pt-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{refinementStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Success Notification Banners */}
      {refinementSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{refinementSuccess}</span>
          </div>
          {historyStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="text-emerald-800 font-bold underline hover:text-emerald-950 text-xs shrink-0"
            >
              Undo Changes
            </button>
          )}
        </div>
      )}

      {templateExtractedSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>
            <strong>{templateExtractedSuccess}</strong> has been extracted and saved to your Templates library!
          </span>
        </div>
      )}

      {/* 4. DOCUMENT BODY DISPLAY */}
      {viewMode === 'word-page' ? (
        /* AUTHENTIC MICROSOFT WORD PAGE PREVIEW WITH DEVICE RESPONSIVENESS */
        <div
          className={`flex justify-center rounded-2xl border transition-all ${
            pageLayout === 'a4-sheet'
              ? 'bg-slate-200/80 p-2 sm:p-6 md:p-8 border-slate-300/80 overflow-x-auto'
              : 'bg-slate-100/90 p-2 sm:p-4 border-slate-200 overflow-x-hidden'
          }`}
        >
          <div
            className={`w-full relative transition-all ${
              pageLayout === 'a4-sheet'
                ? 'max-w-[850px] min-h-[900px] sm:min-h-[1056px] rounded-xs'
                : 'max-w-4xl min-h-[500px] rounded-xl'
            } ${themeStyles[pageTheme]} ${marginStyles[pageMargin]}`}
            style={{
              fontFamily: fontFamily ? `"${fontFamily}", serif` : undefined,
            }}
          >
            {/* Note: Unwanted top header and watermark have been completely removed as requested */}

            {/* DIRECT IN-PAGE EDITING CANVAS VS RENDERED PREVIEW */}
            {isDirectEditing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 text-xs text-emerald-700 font-sans font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Direct In-Page Editing Mode (Type directly on Word paper)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDirectEditing(false)}
                    className="text-xs text-slate-600 hover:text-slate-900 underline font-normal"
                  >
                    Switch to Reading View
                  </button>
                </div>

                <textarea
                  ref={sheetEditorRef}
                  value={content}
                  onChange={(e) => onContentChange?.(e.target.value)}
                  rows={26}
                  className="w-full bg-transparent border-0 p-0 focus:outline-hidden focus:ring-0 resize-y break-words"
                  style={{
                    fontFamily: fontFamily ? `"${fontFamily}", serif` : undefined,
                    fontSize: fontSize || '12pt',
                    textAlign: alignment === 'justified' ? 'justify' : alignment,
                    lineHeight: lineSpacing || '1.15',
                  }}
                  placeholder="Type or edit document content directly here..."
                />

                <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-sans">
                  <span>
                    {stats.words.toLocaleString()} words • {stats.chars.toLocaleString()} characters
                  </span>
                  <span>Changes sync live to downloads</span>
                </div>
              </div>
            ) : (
              /* Rendered Document Body - Faithfully uses the format given in the template */
              <div
                className="word-document-content break-words"
                style={{
                  fontFamily: fontFamily ? `"${fontFamily}", serif` : undefined,
                  fontSize: fontSize || '12pt',
                  textAlign: alignment === 'justified' ? 'justify' : alignment,
                  lineHeight: lineSpacing || '1.15',
                }}
              >
                {!content || !content.trim() ? (
                  <div className="py-24 text-center text-slate-400 font-sans">
                    <FileText className="mx-auto h-12 w-12 text-slate-300 stroke-1 mb-3" />
                    <p className="font-bold text-slate-700 text-sm">Blank Document Sheet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Provide instructions to draft with AI, or click &quot;Direct Edit on Sheet&quot; to start typing directly.
                    </p>
                  </div>
                ) : (
                  renderWordDocumentContent()
                )}
              </div>
            )}

            {/* Note: Unwanted bottom footer ("CONFIDENTIAL / PAGE 1 OF 1") has been completely removed as requested */}
          </div>
        </div>
      ) : (
        /* RAW EDITABLE TEXTAREA */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <span className="text-xs font-semibold text-slate-700">Plain Document Text Editor</span>
            <span className="text-[11px] text-slate-400">
              {stats.words.toLocaleString()} words • {stats.chars.toLocaleString()} characters
            </span>
          </div>
          <textarea
            ref={rawEditorRef}
            value={content}
            onChange={(e) => onContentChange?.(e.target.value)}
            rows={22}
            className="w-full rounded-xl border border-slate-200 p-4 font-mono text-xs leading-relaxed text-slate-900 focus:outline-hidden focus:border-emerald-500 shadow-inner"
            placeholder="Type or paste document content here..."
          />
        </div>
      )}
    </div>
  );
};
