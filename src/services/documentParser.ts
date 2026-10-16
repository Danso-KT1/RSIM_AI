import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { extractTextFromPdf, extractTextFromExcel, cleanSubtitleTranscript } from './attachmentService';
import { TemplateFormatting } from '../types';

export interface ParsedDocumentResult {
  text: string;
  html?: string;
  cleanTitle: string;
  fileType: string;
  fileSize: string;
  isBinaryExtracted: boolean;
  templateSpec?: TemplateSpec;
}

export interface TemplateSectionSpec {
  id: string;
  order: number;
  title: string;
  isTable?: boolean;
  tableHeaders?: string[];
  sampleRows?: string[][];
  fixedBoilerplate?: string;
  guidelines?: string;
}

export interface TemplateSpec {
  id: string;
  name: string;
  title?: string;
  documentType: 'Minutes' | 'Report' | 'Letter' | 'Memo' | 'General';
  sections: TemplateSectionSpec[];
  formatting: TemplateFormatting;
  letterhead?: string;
  headerText?: string;
  footerText?: string;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
  detectedFont?: string;
  detectedFontSize?: string;
  signatureBlock?: {
    preparedBy?: string;
    approvedBy?: string;
    signatoryTitle?: string;
  };
  summaryPreview: string; // e.g. "Detected: 8 sections, 1 table, institutional letterhead, Times New Roman 12pt"
  rawText: string;
}

/**
 * Fallback lightweight DOCX XML text extractor
 * DOCX files are zip archives containing `word/document.xml`.
 * This extracts text within `<w:t>...</w:t>` tags while preserving paragraph spacing
 * and converting `<w:tbl>...</w:tbl>` tables into authentic Markdown tables.
 */
export function extractTextFromDocxXml(rawXmlString: string): string {
  if (!rawXmlString) return '';

  // 1. Convert <w:tbl>...</w:tbl> tables into Markdown tables wrapped in a paragraph
  const xmlWithTables = rawXmlString.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tblXml) => {
    const rowMatches = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    const tableRows: string[][] = [];

    rowMatches.forEach((rXml) => {
      const cellMatches = rXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      const cells = cellMatches.map((cXml) => {
        const textParts = cXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
        const cellText = textParts
          .map((t) =>
            t
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
          )
          .join(' ')
          .replace(/\|/g, '-')
          .replace(/[\r\n]+/g, ' ')
          .trim();
        return cellText;
      });
      if (cells.some((c) => c.length > 0)) {
        tableRows.push(cells);
      }
    });

    if (tableRows.length === 0) return '';

    const maxCols = Math.max(...tableRows.map((r) => r.length));
    const padRow = (row: string[]) => {
      const padded = [...row];
      while (padded.length < maxCols) padded.push('');
      return padded;
    };

    const header = padRow(tableRows[0]);
    const separator = header.map(() => '---');
    const mdLines: string[] = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
    ];

    for (let i = 1; i < tableRows.length; i++) {
      const row = padRow(tableRows[i]);
      mdLines.push(`| ${row.join(' | ')} |`);
    }

    return `<w:p><w:r><w:t>${mdLines.join('\n')}</w:t></w:r></w:p>`;
  });

  let text = '';
  let paragraphBuffer = '';

  const tokens = xmlWithTables.split(/(<\/w:p>|<w:p(?:\s+[^>]*)?>|<w:t(?:\s+[^>]*)?>[\s\S]*?<\/w:t>)/g);
  tokens.forEach((token) => {
    if (token.startsWith('<w:t')) {
      const match = token.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/);
      if (match && match[1]) {
        const decoded = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        paragraphBuffer += decoded;
      }
    } else if (token.startsWith('</w:p>')) {
      if (paragraphBuffer.trim()) {
        text += paragraphBuffer.trim() + '\n\n';
      }
      paragraphBuffer = '';
    }
  });

  if (paragraphBuffer.trim()) {
    text += paragraphBuffer.trim() + '\n';
  }

  return text.trim();
}

/**
 * Checks if a string looks like raw binary/ZIP data (e.g. readAsText on a .docx or .pdf file)
 */
export function isBinaryOrZipText(content: string): boolean {
  if (!content) return false;
  return (
    content.startsWith('PK\x03\x04') ||
    content.startsWith('PK') ||
    content.includes('[Content_Types].xml') ||
    content.includes('word/document.xml') ||
    content.startsWith('%PDF') ||
    /PK\s*!\s*[\w\d]+/.test(content.slice(0, 100))
  );
}

/**
 * Converts a raw binary/ISO string back to a Uint8Array byte buffer
 */
export function binaryStringToUint8Array(str: string): Uint8Array {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Auto-repairs and unpacks raw binary/ZIP text into clean, readable text and HTML.
 */
export async function repairBinaryOrZipString(rawStr: string): Promise<{ text: string; html?: string }> {
  if (!rawStr) return { text: '' };

  // 1. Try JSZip recovery by converting binary string to Uint8Array
  try {
    const bytes = binaryStringToUint8Array(rawStr);
    const zip = await JSZip.loadAsync(bytes);
    const docXmlFile = zip.file('word/document.xml') || zip.file(/document\.xml$/i)[0];
    if (docXmlFile) {
      const xml = await docXmlFile.async('text');
      const extracted = extractTextFromDocxXml(xml);
      if (extracted.trim().length > 20) {
        return {
          text: extracted.trim(),
          html: extracted
            .split('\n\n')
            .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
            .join(''),
        };
      }
    }
  } catch {}

  // 2. Try mammoth with arrayBuffer
  try {
    const bytes = binaryStringToUint8Array(rawStr);
    const buffer = bytes.buffer as ArrayBuffer;
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    if (result && result.value && result.value.trim().length > 20) {
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer }).catch(() => null);
      return {
        text: result.value.trim(),
        html: htmlResult?.value,
      };
    }
  } catch {}

  // 3. Last-ditch: clean out non-printable binary characters
  const cleaned = rawStr
    .replace(/[^\x20-\x7E\t\r\n]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const filteredLines = cleaned
    .split(/\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && !l.includes('[Content_Types]') && !l.includes('_rels') && !l.startsWith('PK '));

  return { text: filteredLines.join('\n\n') || cleaned };
}

/**
 * Extracts a faithful TemplateSpec from a .docx file buffer using JSZip and XML analysis
 */
export async function extractTemplateSpecFromDocx(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'Template.docx'
): Promise<TemplateSpec> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml') || zip.file(/document\.xml$/i)[0];
  const docXml = docXmlFile ? await docXmlFile.async('text') : '';

  // Extract header and footer XML if present
  let headerText = '';
  let footerText = '';
  for (const f of Object.keys(zip.files)) {
    if (/header\d+\.xml$/i.test(f)) {
      const hXml = await zip.file(f)!.async('text');
      const extracted = extractTextFromDocxXml(hXml);
      if (extracted.trim()) headerText += (headerText ? ' | ' : '') + extracted.trim();
    }
    if (/footer\d+\.xml$/i.test(f)) {
      const fXml = await zip.file(f)!.async('text');
      const extracted = extractTextFromDocxXml(fXml);
      if (extracted.trim()) footerText += (footerText ? ' | ' : '') + extracted.trim();
    }
  }

  // Extract font styling from word/styles.xml or document.xml
  let detectedFont = 'Calibri';
  let detectedFontSize = '12pt';
  const stylesXmlFile = zip.file('word/styles.xml');
  if (stylesXmlFile) {
    const sXml = await stylesXmlFile.async('text');
    if (/Times New Roman/i.test(sXml)) detectedFont = 'Times New Roman';
    else if (/Arial/i.test(sXml)) detectedFont = 'Arial';
    else if (/Georgia/i.test(sXml)) detectedFont = 'Georgia';
    else if (/Aptos/i.test(sXml)) detectedFont = 'Aptos';
  }

  const rawText = extractTextFromDocxXml(docXml);

  // Detect tables from <w:tbl>
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const tableMatches = docXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  tableMatches.forEach((tXml) => {
    const rowMatches = tXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    const tableRows: string[][] = [];
    rowMatches.forEach((rXml) => {
      const cellMatches = rXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      const cells = cellMatches.map((cXml) => {
        const textParts = cXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
        return textParts
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join(' ')
          .trim();
      });
      if (cells.some((c) => c.length > 0)) {
        tableRows.push(cells);
      }
    });

    if (tableRows.length > 0) {
      tables.push({
        headers: tableRows[0],
        rows: tableRows.slice(1),
      });
    }
  });

  // Detect sections by looking for numbered headings, uppercase lines, or bold lines
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: TemplateSectionSpec[] = [];
  let currentSectionTitle = 'General Information';
  let order = 1;

  const headingPattern = /^(?:(?:\d+\.|\([a-z]\)|[A-Z]\.|\bSECTION\b|\bITEM\b|\bAGENDA\b)\s+|[A-Z\s]{4,}:?$)/;

  lines.forEach((line) => {
    if (headingPattern.test(line) && line.length < 90 && !line.includes('@') && !line.includes('http')) {
      sections.push({
        id: `sec_${order}`,
        order,
        title: line.replace(/^#+\s*/, '').trim(),
      });
      order++;
    }
  });

  // If no structured sections detected from headings, split by paragraphs
  if (sections.length === 0) {
    sections.push(
      { id: 'sec_1', order: 1, title: 'Title & Institutional Heading' },
      { id: 'sec_2', order: 2, title: 'Attendance & Deliberations' },
      { id: 'sec_3', order: 3, title: 'Key Discussions & Findings' },
      { id: 'sec_4', order: 4, title: 'Decisions & Resolutions' },
      { id: 'sec_5', order: 5, title: 'Action Items & Timelines', isTable: true, tableHeaders: ['Item #', 'Action Item', 'Responsible Officer', 'Deadline', 'Status'] }
    );
  }

  // If tables detected, attach table headers to the first relevant section
  if (tables.length > 0) {
    const actionSection = sections.find((s) => /action|matrix|item|resolution/i.test(s.title)) || sections[sections.length - 1];
    if (actionSection) {
      actionSection.isTable = true;
      actionSection.tableHeaders = tables[0].headers;
      actionSection.sampleRows = tables[0].rows.slice(0, 3);
    }
  }

  // Detect document type
  let docType: 'Minutes' | 'Report' | 'Letter' | 'Memo' | 'General' = 'General';
  const lowerName = (fileName + ' ' + rawText.slice(0, 1000)).toLowerCase();
  if (lowerName.includes('minute')) docType = 'Minutes';
  else if (lowerName.includes('report')) docType = 'Report';
  else if (lowerName.includes('memo')) docType = 'Memo';
  else if (lowerName.includes('letter')) docType = 'Letter';

  const previewParts: string[] = [];
  previewParts.push(`Detected: ${sections.length} section(s)`);
  if (tables.length > 0) previewParts.push(`${tables.length} table(s)`);
  if (headerText || /MINISTRY|REPUBLIC/i.test(rawText.slice(0, 400))) previewParts.push('institutional letterhead');
  previewParts.push(`${detectedFont} ${detectedFontSize}`);

  return {
    id: `tpl_spec_${Date.now()}`,
    name: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
    title: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
    documentType: docType,
    sections,
    formatting: {
      fontFamily: detectedFont,
      titleFontSize: '16pt bold',
      headingFontSize: '13pt bold',
      bodyFontSize: detectedFontSize,
      lineSpacing: '1.15',
      alignment: 'justified',
    },
    tables,
    detectedFont,
    detectedFontSize,
    letterhead: headerText || (rawText.slice(0, 400).includes('MINISTRY') ? rawText.slice(0, 350) : undefined),
    headerText: headerText || undefined,
    footerText: footerText || undefined,
    summaryPreview: previewParts.join(' • '),
    rawText,
  };
}

/**
 * Universal browser-side document parser for:
 * .docx, .dotx, .pdf, .xlsx, .xls, .txt, .md, .csv, .json, .srt, .vtt
 */
export async function parseUploadedFile(file: File): Promise<ParsedDocumentResult> {
  const fileName = file.name;
  const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const fileSize = `${(file.size / 1024).toFixed(1)} KB`;
  let fileType = extension.toUpperCase() || 'DOCUMENT';

  // 1. Word Documents (.docx, .dotx)
  if (extension === 'docx' || extension === 'dotx') {
    const arrayBuffer = await file.arrayBuffer();
    const templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, fileName);
    let html: string | undefined;

    try {
      const mResult = await mammoth.convertToHtml({ arrayBuffer });
      html = mResult.value;
    } catch {
      html = templateSpec.rawText
        .split('\n\n')
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');
    }

    return {
      text: templateSpec.rawText,
      html,
      cleanTitle,
      fileType: 'Word Document (.docx)',
      fileSize,
      isBinaryExtracted: true,
      templateSpec,
    };
  }

  // 2. PDF Documents (.pdf)
  if (extension === 'pdf') {
    const pdfRes = await extractTextFromPdf(file);
    return {
      text: pdfRes.text,
      cleanTitle,
      fileType: pdfRes.isScanned ? 'PDF Document (Scanned Image)' : 'PDF Document',
      fileSize,
      isBinaryExtracted: true,
    };
  }

  // 3. Excel Spreadsheets (.xlsx, .xls)
  if (extension === 'xlsx' || extension === 'xls') {
    const excelRes = await extractTextFromExcel(file);
    return {
      text: excelRes.text,
      cleanTitle,
      fileType: 'Excel Spreadsheet',
      fileSize,
      isBinaryExtracted: true,
    };
  }

  // 4. Subtitle Transcripts (.srt, .vtt)
  if (extension === 'srt' || extension === 'vtt') {
    const raw = await file.text();
    const cleaned = cleanSubtitleTranscript(raw);
    return {
      text: cleaned,
      cleanTitle,
      fileType: `${extension.toUpperCase()} Transcript`,
      fileSize,
      isBinaryExtracted: false,
    };
  }

  // 5. Text Formats (TXT, MD, CSV, JSON, LOG, RTF)
  const textContent = await file.text();
  if (isBinaryOrZipText(textContent)) {
    const repaired = await repairBinaryOrZipString(textContent);
    return {
      text: repaired.text,
      html: repaired.html,
      cleanTitle,
      fileType: `${fileType} Document`,
      fileSize,
      isBinaryExtracted: true,
    };
  }

  return {
    text: textContent,
    cleanTitle,
    fileType: `${fileType} Document`,
    fileSize,
    isBinaryExtracted: false,
  };
}
