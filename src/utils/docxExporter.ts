import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { TemplateFormatting } from '../types';

export interface DocxExportOptions {
  title: string;
  content: string;
  referenceNumber?: string;
  date?: string;
  author?: string;
  department?: string;
  type?: string;
  formatting?: TemplateFormatting;
}

function parsePtToHalfPoints(ptStr?: string, defaultHalfPt: number = 22): number {
  if (!ptStr) return defaultHalfPt;
  const num = parseInt(ptStr.replace(/[^\d]/g, ''), 10);
  return isNaN(num) || num <= 0 ? defaultHalfPt : num * 2;
}

/**
 * Parses markdown/plain text and converts it into structured docx Paragraphs and Tables.
 */
function parseTextToDocxElements(text: string, formatting?: TemplateFormatting): (Paragraph | Table)[] {
  const lines = text.split('\n');
  const elements: (Paragraph | Table)[] = [];

  const font = formatting?.fontFamily || 'Calibri';
  const bodySize = parsePtToHalfPoints(formatting?.bodyFontSize, 22);
  const heading1Size = parsePtToHalfPoints(formatting?.titleFontSize, 32);
  const heading2Size = parsePtToHalfPoints(formatting?.headingFontSize, 26);
  const heading3Size = parsePtToHalfPoints(formatting?.subheadingFontSize, 24);

  const lineSpacingMult = parseFloat(formatting?.lineSpacing || '1.15') || 1.15;
  const lineSpacingTwips = Math.round(lineSpacingMult * 240);

  const alignment =
    formatting?.alignment === 'justified'
      ? AlignmentType.JUSTIFIED
      : formatting?.alignment === 'center'
      ? AlignmentType.CENTER
      : formatting?.alignment === 'right'
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const rows = tableRows.map((rowCells, rIdx) => {
        return new TableRow({
          children: rowCells.map((cellText, cIdx) => {
            const rawParts = cellText
              .split(/<br\s*\/?>|\n/i)
              .map((p) => p.trim())
              .filter(Boolean);

            const cellParagraphs = (rawParts.length > 0 ? rawParts : [cellText.trim()]).map((pText) => {
              return new Paragraph({
                children: [
                  new TextRun({
                    text: pText,
                    bold: rIdx === 0 || (cIdx === 0 && rowCells.length === 2),
                    size: bodySize,
                    font,
                  }),
                ],
                spacing: { after: 80 },
              });
            });

            return new TableCell({
              children: cellParagraphs,
              shading: rIdx === 0 ? { fill: 'F1F5F9' } : undefined,
            });
          }),
        });
      });

      elements.push(
        new Table({
          rows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
        })
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Handle markdown table rows
    if (trimmed.startsWith('|')) {
      if (trimmed.replace(/[|\-\s:]/g, '').length === 0) {
        continue;
      }
      inTable = true;
      const rawParts = trimmed.split('|');
      if (trimmed.startsWith('|')) rawParts.shift();
      if (trimmed.endsWith('|')) rawParts.pop();
      const cells = rawParts.map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (trimmed === '' && inTable && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      // Tolerate accidental blank line inside markdown table
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) {
      elements.push(
        new Paragraph({
          spacing: { after: 120 },
        })
      );
      continue;
    }

    // Headings: Markdown # or full uppercase lines with no punctuation ending
    if (trimmed.startsWith('# ')) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^#\s+/, ''),
              bold: true,
              font,
              size: heading1Size,
            }),
          ],
          alignment,
          spacing: { before: 240, after: 120, line: lineSpacingTwips },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^##\s+/, ''),
              bold: true,
              font,
              size: heading2Size,
            }),
          ],
          alignment,
          spacing: { before: 180, after: 100, line: lineSpacingTwips },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^###\s+/, ''),
              bold: true,
              font,
              size: heading3Size,
            }),
          ],
          alignment,
          spacing: { before: 140, after: 80, line: lineSpacingTwips },
        })
      );
    } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      // Bullet list
      const bulletText = trimmed.replace(/^[*\-]\s+/, '');
      elements.push(
        new Paragraph({
          children: parseInlineRuns(bulletText, false, font, bodySize),
          bullet: { level: 0 },
          alignment,
          spacing: { after: 80, line: lineSpacingTwips },
        })
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Numbered list
      elements.push(
        new Paragraph({
          children: parseInlineRuns(trimmed, false, font, bodySize),
          alignment,
          spacing: { after: 80, line: lineSpacingTwips },
        })
      );
    } else {
      // Normal paragraph
      const isHeaderField = /^(TO|FROM|DATE|SUBJECT|REF|THROUGH|MEMORANDUM|OFFICIAL LETTER):/i.test(trimmed);
      elements.push(
        new Paragraph({
          children: parseInlineRuns(trimmed, isHeaderField, font, bodySize),
          alignment,
          spacing: { after: 140, line: lineSpacingTwips },
        })
      );
    }
  }

  if (inTable) {
    flushTable();
  }

  return elements;
}

/**
 * Parses bold text (**text**) and italic (*text*) runs
 */
function parseInlineRuns(
  text: string,
  forceBoldLabel: boolean = false,
  font: string = 'Calibri',
  bodySize: number = 22
): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font,
          size: bodySize,
        })
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font,
          size: bodySize,
        })
      );
    } else if (part.length > 0) {
      runs.push(
        new TextRun({
          text: part,
          bold: forceBoldLabel && runs.length === 0,
          font,
          size: bodySize,
        })
      );
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, font, size: bodySize })];
}

/**
 * Exports document content to a real, valid Microsoft Word .docx file
 */
export async function exportToDocx(options: DocxExportOptions): Promise<void> {
  const { title, content, formatting } = options;

  // Directly parse content into docx elements using the exact learned formatting
  const bodyElements = parseTextToDocxElements(content, formatting);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: bodyElements.length > 0 ? bodyElements : [new Paragraph({ text: '' })],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFilename = `${(title || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports document content to formatted print / PDF dialog using the format given in the template
 */
export function exportToPdf(options: DocxExportOptions): void {
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    window.print();
    return;
  }

  const lines = options.content.split('\n');
  const cleanBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      cleanBlocks.push('<p class="spacer"></p>');
      i++;
      continue;
    }

    // Markdown Table Parser (| col1 | col2 |)
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith('|')) {
          tableLines.push(cur);
          i++;
        } else if (cur === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
          // Tolerate accidental blank line inside markdown table
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
          return rawParts.map((c) =>
            c
              .trim()
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/(?:^|\s+)•\s*/g, (m, offset) => (offset === 0 ? '• ' : '<br/>• '))
          );
        };

        const headers = parseRow(tableLines[0]);
        const isSeparator = /^\|?[-:\s|]+\|?$/.test(tableLines[1]);
        const bodyLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);

        let tableHtml = '<table class="pdf-table"><thead><tr>';
        headers.forEach((h, hIdx) => {
          const colStyle = hIdx === 0 && headers.length === 2 ? ' style="width: 25%; font-weight: bold;"' : '';
          tableHtml += `<th${colStyle}>${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        bodyLines.forEach((rowLine, rIdx) => {
          const cells = parseRow(rowLine);
          tableHtml += `<tr class="${rIdx % 2 === 1 ? 'alt-row' : ''}">`;
          cells.forEach((cell, cIdx) => {
            const cellStyle = cIdx === 0 && cells.length === 2 ? ' style="width: 25%; font-weight: 600; background-color: #f8fafc;"' : '';
            tableHtml += `<td${cellStyle}>${cell}</td>`;
          });
          tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        cleanBlocks.push(tableHtml);
        continue;
      }
    }

    if (trimmed.startsWith('# ')) {
      cleanBlocks.push(`<h1>${trimmed.slice(2)}</h1>`);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      cleanBlocks.push(`<h2>${trimmed.slice(3)}</h2>`);
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      cleanBlocks.push(`<h3>${trimmed.slice(4)}</h3>`);
      i++;
      continue;
    }
    if (/^[-=]{3,}$/.test(trimmed)) {
      cleanBlocks.push('<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0;" />');
      i++;
      continue;
    }
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      cleanBlocks.push(`<li>${trimmed.slice(2)}</li>`);
      i++;
      continue;
    }

    cleanBlocks.push(`<p>${trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`);
    i++;
  }

  const cleanContent = cleanBlocks.join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${options.title || 'Document'}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: ${
              options.formatting?.fontFamily
                ? `"${options.formatting.fontFamily}", 'Times New Roman', serif`
                : `'Calibri', 'Segoe UI', Arial, sans-serif`
            };
            color: #1a202c;
            line-height: ${options.formatting?.lineSpacing || '1.6'};
            margin: 0;
            padding: 24px;
            font-size: ${options.formatting?.bodyFontSize || '11pt'};
            text-align: ${
              options.formatting?.alignment === 'justified'
                ? 'justify'
                : options.formatting?.alignment || 'left'
            };
          }
          h1 {
            font-size: 14pt;
            margin-top: 16px;
            margin-bottom: 12px;
            color: #0f172a;
          }
          h2 {
            font-size: 12pt;
            margin-top: 14px;
            margin-bottom: 8px;
            color: #1e293b;
          }
          h3 {
            font-size: 11pt;
            margin-top: 12px;
            margin-bottom: 6px;
            color: #334155;
          }
          p {
            margin: 0 0 10px 0;
            white-space: pre-wrap;
          }
          p.spacer {
            height: 8px;
          }
          li {
            margin-bottom: 4px;
          }
          strong {
            color: #0f172a;
          }
          table.pdf-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 9.5pt;
          }
          table.pdf-table th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
            font-size: 8.5pt;
            letter-spacing: 0.5px;
          }
          table.pdf-table td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            vertical-align: top;
            line-height: 1.5;
          }
          table.pdf-table tr.alt-row {
            background-color: #f8fafc;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="content">
          ${cleanContent}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
