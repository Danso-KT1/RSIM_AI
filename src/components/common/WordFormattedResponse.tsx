import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Info, CheckCircle2 } from 'lucide-react';

export interface GroundingSource {
  uri: string;
  title: string;
  snippet?: string;
}

interface WordFormattedResponseProps {
  content: string;
  className?: string;
  isUser?: boolean;
  sources?: GroundingSource[];
  layoutMode?: 'conversational' | 'document';
  isDark?: boolean;
}

const CodeBlockView: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3.5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-xs text-slate-400">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-2xs"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-emerald-300 scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const WordFormattedResponse: React.FC<WordFormattedResponseProps> = ({
  content,
  className = '',
  isUser = false,
  sources = [],
  layoutMode = 'conversational',
  isDark,
}) => {
  if (!content) return null;

  const isDarkEffective = Boolean(
    isDark ??
    (className.includes('text-white') ||
     className.includes('text-slate-100') ||
     className.includes('dark'))
  );

  if (isUser) {
    return (
      <div className={`whitespace-pre-wrap leading-relaxed text-sm font-normal ${isDarkEffective ? 'text-white' : 'text-slate-900'} ${className}`}>
        {content}
      </div>
    );
  }

  // Parse inline text (links, citations [1], bold, italic, code)
  const renderInline = (text: string): React.ReactNode => {
    if (!text) return null;

    const tokenRegex = /(\[.*?\]\(https?:\/\/.*?\)|\b\[\d+\]|\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|__.*?__|(?<!\w)_.*?_(?!\w)|`.*?`)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      // Markdown link [Title](url)
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/.*?)\)$/);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-0.5 font-medium underline transition-colors ${
                isDarkEffective
                  ? 'text-cyan-400 decoration-cyan-500/50 hover:text-cyan-300'
                  : 'text-blue-600 decoration-blue-300 hover:text-blue-800'
              }`}
            >
              <span>{linkMatch[1]}</span>
              <ExternalLink className="h-2.5 w-2.5 inline opacity-70 ml-0.5" />
            </a>
          );
        }
      }

      // Inline Citation badge [1], [2], etc.
      const citationMatch = part.match(/^\[(\d+)\]$/);
      if (citationMatch) {
        const citationNum = parseInt(citationMatch[1], 10);
        const matchingSource = sources && sources[citationNum - 1];

        if (matchingSource) {
          return (
            <a
              key={i}
              href={matchingSource.uri}
              target="_blank"
              rel="noopener noreferrer"
              title={`${matchingSource.title}\n${matchingSource.uri}`}
              className={`group mx-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold border transition-all cursor-pointer shadow-2xs align-super ${
                isDarkEffective
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-400'
              }`}
            >
              <span>{citationNum}</span>
              <ExternalLink className="h-2 w-2 opacity-50 group-hover:opacity-100" />
            </a>
          );
        }

        return (
          <sup
            key={i}
            className={`mx-0.5 inline-flex items-center px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold border select-none ${
              isDarkEffective
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-blue-50/80 text-blue-700 border-blue-200'
            }`}
          >
            {citationNum}
          </sup>
        );
      }

      // Bold + Italic (***text***)
      if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
        return (
          <strong key={i} className={`font-bold italic ${isDarkEffective ? 'text-white' : 'text-slate-900'}`}>
            {part.slice(3, -3)}
          </strong>
        );
      }

      // Bold (**text** or __text__)
      if (
        (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
      ) {
        return (
          <strong key={i} className={`font-bold ${isDarkEffective ? 'text-white' : 'text-slate-900'}`}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italic (*text* or _text_)
      if (
        (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
      ) {
        return (
          <em key={i} className={`italic ${isDarkEffective ? 'text-slate-200' : 'text-slate-800'}`}>
            {part.slice(1, -1)}
          </em>
        );
      }

      // Code (`code`)
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            className={`rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-medium border ${
              isDarkEffective
                ? 'bg-white/10 text-emerald-300 border-white/20'
                : 'bg-slate-100 text-slate-800 border-slate-200/90'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return part;
    });
  };

  // Process lines into structured blocks
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty lines -> continue
    if (!trimmed) {
      i++;
      continue;
    }

    // 0. Fenced Code Blocks (```lang ... ```)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      blocks.push(
        <CodeBlockView key={`code-${i}`} code={codeLines.join('\n')} language={language} />
      );
      continue;
    }

    // 1. Horizontal Dividers (***, ---, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${i}`} className={`my-5 border-t ${isDarkEffective ? 'border-white/15' : 'border-slate-200/90'}`} />
      );
      i++;
      continue;
    }

    // 2. Headings (Level 1: #, Level 2: ##, Level 3: ###, Level 4: ####)
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,6})\s*(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];

        if (layoutMode === 'conversational') {
          // Clean conversational style
          if (level === 1) {
            blocks.push(
              <h1
                key={`h1-${i}`}
                className={`mt-6 mb-3 text-xl sm:text-2xl font-bold tracking-tight pb-2 border-b ${
                  isDarkEffective ? 'text-white border-white/10' : 'text-slate-900 border-slate-100'
                }`}
              >
                {renderInline(text)}
              </h1>
            );
          } else if (level === 2) {
            blocks.push(
              <h2
                key={`h2-${i}`}
                className={`mt-5 mb-2.5 text-base sm:text-lg font-semibold tracking-tight pb-1 border-b ${
                  isDarkEffective ? 'text-white border-white/10' : 'text-slate-900 border-slate-100'
                }`}
              >
                {renderInline(text)}
              </h2>
            );
          } else {
            blocks.push(
              <h3
                key={`h3-${i}`}
                className={`mt-4 mb-2 text-sm sm:text-base font-semibold flex items-center gap-2 ${
                  isDarkEffective ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>{renderInline(text)}</span>
              </h3>
            );
          }
        } else {
          // Document Mode: Institutional Word Document styling
          if (level === 1) {
            blocks.push(
              <h1
                key={`h1-${i}`}
                className={`mt-6 mb-3 pb-1.5 text-base sm:text-lg font-bold uppercase tracking-tight border-b-2 ${
                  isDarkEffective ? 'text-white border-white/20' : 'text-slate-900 border-slate-900'
                }`}
              >
                {renderInline(text)}
              </h1>
            );
          } else if (level === 2) {
            blocks.push(
              <h2
                key={`h2-${i}`}
                className={`mt-5 mb-2.5 pb-1 text-sm sm:text-base font-bold border-b ${
                  isDarkEffective ? 'text-white border-white/15' : 'text-slate-900 border-slate-200'
                }`}
              >
                {renderInline(text)}
              </h2>
            );
          } else {
            blocks.push(
              <h3
                key={`h3-${i}`}
                className={`mt-4 mb-2 text-xs sm:text-sm font-bold flex items-center gap-1.5 ${
                  isDarkEffective ? 'text-white' : 'text-slate-900'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>{renderInline(text)}</span>
              </h3>
            );
          }
        }

        i++;
        continue;
      }
    }

    // 3. Markdown Tables (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (line: string) =>
          line
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const isSeparator = /^\|[-:\s|]+\|$/.test(tableLines[1]);
        const bodyLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);

        blocks.push(
          <div key={`table-${i}`} className={`my-4 overflow-x-auto rounded-2xl border shadow-2xs ${isDarkEffective ? 'border-white/15 bg-[#252525]' : 'border-slate-200 bg-white'}`}>
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className={`font-semibold border-b ${isDarkEffective ? 'bg-white/10 text-white border-white/15' : 'bg-slate-100/90 text-slate-900 border-slate-200'}`}>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className={`px-4 py-2.5 border-r last:border-r-0 ${isDarkEffective ? 'border-white/15' : 'border-slate-200'}`}>
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkEffective ? 'divide-white/10 bg-transparent' : 'divide-slate-100 bg-white'}`}>
                {bodyLines.map((rowLine, rIdx) => {
                  const cells = parseRow(rowLine);
                  return (
                    <tr key={rIdx} className={isDarkEffective ? (rIdx % 2 === 1 ? 'bg-white/5' : 'bg-transparent') : (rIdx % 2 === 1 ? 'bg-slate-50/70 hover:bg-slate-50' : 'bg-white hover:bg-slate-50')}>
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className={`px-4 py-2 border-r last:border-r-0 ${isDarkEffective ? 'border-white/10 text-slate-200' : 'border-slate-100 text-slate-700'}`}>
                          {renderInline(cell)}
                        </td>
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

    // 4. Callout / Blockquotes (> text)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push(
        <div
          key={`quote-${i}`}
          className={`my-3.5 rounded-2xl border-l-4 border-emerald-500 p-3.5 sm:p-4 text-xs sm:text-sm shadow-2xs ${
            isDarkEffective ? 'bg-emerald-950/40 text-emerald-100' : 'bg-emerald-50/60 text-slate-800'
          }`}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1.5' : ''}>
              {renderInline(ql)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // 5. Bullet Lists (* item, - item, + item)
    if (/^(\s*)[*\-+]\s+(.*)$/.test(rawLine)) {
      const listItems: Array<{ indent: number; text: string }> = [];

      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)[*\-+]\s+(.*)$/);
        if (!itemMatch) break;
        const indentLevel = Math.floor((itemMatch[1] || '').length / 2);
        listItems.push({ indent: indentLevel, text: itemMatch[2] });
        i++;
      }

      blocks.push(
        <ul key={`ul-${i}`} className={`my-3 space-y-2 text-xs sm:text-sm ${isDarkEffective ? 'text-slate-100' : 'text-slate-800'}`}>
          {listItems.map((item, itemIdx) => {
            const isSub = item.indent > 0;
            return (
              <li
                key={itemIdx}
                style={{ marginLeft: `${item.indent * 1.25}rem` }}
                className={`flex items-start gap-2.5 leading-relaxed ${isSub ? (isDarkEffective ? 'text-xs text-slate-300' : 'text-xs text-slate-700') : ''}`}
              >
                <span
                  className={`shrink-0 select-none ${
                    isSub
                      ? (isDarkEffective ? 'text-slate-400 text-[10px] mt-1' : 'text-slate-400 text-[10px] mt-1')
                      : 'text-emerald-500 font-bold text-sm mt-0.5'
                  }`}
                >
                  {isSub ? '◦' : '•'}
                </span>
                <span className="flex-1 text-left">{renderInline(item.text)}</span>
              </li>
            );
          })}
        </ul>
      );
      continue;
    }

    // 6. Numbered Lists (1. item, 2. item)
    if (/^\s*\d+\.\s+(.*)$/.test(rawLine)) {
      const numItems: Array<{ num: string; text: string }> = [];

      while (i < lines.length) {
        const numMatch = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
        if (!numMatch) break;
        numItems.push({ num: numMatch[1], text: numMatch[2] });
        i++;
      }

      blocks.push(
        <ol key={`ol-${i}`} className={`my-3 space-y-2 text-xs sm:text-sm ${isDarkEffective ? 'text-slate-100' : 'text-slate-800'}`}>
          {numItems.map((item, itemIdx) => (
            <li key={itemIdx} className="flex items-start gap-2.5 leading-relaxed">
              <span className={`shrink-0 font-bold min-w-[20px] select-none text-xs sm:text-sm ${isDarkEffective ? 'text-white' : 'text-slate-900'}`}>
                {item.num}.
              </span>
              <span className="flex-1 text-left">{renderInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Key-Value Lines (e.g. TO:, FROM:, DATE:, SUBJECT:, or **Label:** Value)
    const keyValueMatch = trimmed.match(/^(\*\*[^*]+:\*\*|[A-Z\s]{2,15}:)\s*(.*)$/);
    if (keyValueMatch) {
      const label = keyValueMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
      const val = keyValueMatch[2].trim();

      blocks.push(
        <div key={`kv-${i}`} className="my-2 flex flex-wrap gap-2 text-xs sm:text-sm leading-relaxed">
          <span className={`font-bold uppercase tracking-wide min-w-[110px] ${isDarkEffective ? 'text-white' : 'text-slate-900'}`}>
            {label}:
          </span>
          <span className={`flex-1 ${isDarkEffective ? 'text-slate-100' : 'text-slate-800'}`}>{renderInline(val)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 8. Standard Paragraph
    const paraLines: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^(\s*)[*\-+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    blocks.push(
      <p
        key={`p-${i}`}
        className={`my-2.5 text-xs sm:text-[14.5px] leading-relaxed text-left ${
          isDarkEffective ? 'text-slate-100' : 'text-slate-850 text-slate-800'
        }`}
      >
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return (
    <div
      className={`word-formatted-document font-sans antialiased selection:bg-amber-100 ${
        isDarkEffective ? 'text-slate-100' : 'text-slate-900'
      } ${
        layoutMode === 'document' ? 'prose-document' : 'prose-conversational'
      } ${className}`}
    >
      {blocks}
    </div>
  );
};
