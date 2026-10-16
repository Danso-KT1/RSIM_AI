/**
 * RSIM AI — Shared Attachment & File Intelligence Service
 * 
 * Provides unified file handling across Chat, Minutes, Report, and Letters Studios:
 * - In-browser parsing for Images, PDF (pdfjs-dist), Word (.docx/.dotx via mammoth & JSZip),
 *   Excel (.xlsx via SheetJS), Subtitles (.srt/.vtt with timestamp stripping), and Text/Code.
 * - Audio/Video detection with automated routing to the Transcribe workspace.
 * - Provider request payload builders (Google Gemini multimodal parts, OpenAI/OpenRouter content arrays).
 * - Sensitive government material handling: In-memory & IndexedDB storage only, never console logged.
 * - Handoff bridge between Transcribe and Writing Studios.
 */

import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { ChatAttachment } from '../types';

// Configure pdfjs worker to bundled or CDN fallback
try {
  if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
} catch {
  // Worker initialization fallback
}

export interface ParsedAttachmentItem extends ChatAttachment {
  id: string;
  wordCount?: number;
  pageCount?: number;
  isImage?: boolean;
  isAudioVideo?: boolean;
  isAudio?: boolean;
  isScannedPdf?: boolean;
  truncated?: boolean;
  previewSnippet?: string;
  originalFile?: File;
  extractedText?: string;
  error?: string;
  warning?: string;
}

export type ParsedAttachment = ParsedAttachmentItem;

export interface HandoffTranscript {
  id: string;
  title: string;
  date: string;
  speakerCount?: number;
  speakerLabels?: string[];
  wordCount?: number;
  rawText: string;
  transcript?: string;
  targetStudio?: string;
  source: 'transcribe' | 'documents' | 'upload';
  createdAt: string;
}

export type PendingHandoffTranscript = HandoffTranscript;

const INDEXEDDB_NAME = 'rsim_attachments_vault';
const STORE_ATTACHMENTS = 'active_attachments';
const STORE_HANDOFF = 'pending_handoff';

/**
 * Initializes and returns the IndexedDB instance
 */
function openAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this browser.'));
    }
    const req = indexedDB.open(INDEXEDDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HANDOFF)) {
        db.createObjectStore(STORE_HANDOFF, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Strips subtitle timestamps and index counters from .srt or .vtt files,
 * while preserving speaker names (e.g. "<v Speaker 1>", "[Speaker 1]:", "Name:").
 */
export function cleanSubtitleTranscript(raw: string): string {
  if (!raw) return '';

  const lines = raw.split(/\r?\n/);
  const cleanedLines: string[] = [];
  const timestampRegex =
    /^\s*(?:WEBVTT.*|\d+\s*$|\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{3})?.*$)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip WEBVTT headers, numeric index lines, and timestamp intervals
    if (timestampRegex.test(line)) {
      continue;
    }

    // Clean voice tags like <v Speaker 1>text</v> -> [Speaker 1]: text
    let processed = line.replace(/<v\s+([^>]+)>(.*?)<\/v>/gi, '[$1]: $2');
    processed = processed.replace(/<v\s+([^>]+)>(.*)/gi, '[$1]: $2');
    processed = processed.replace(/<\/?[^>]+(>|$)/g, ''); // strip any remaining xml/html tags

    if (processed.trim()) {
      cleanedLines.push(processed.trim());
    }
  }

  return cleanedLines.join('\n');
}

/**
 * Extracts plain text from an uploaded PDF file using pdfjs-dist.
 * Detects whether the PDF is a scanned document with no selectable text.
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer
): Promise<{ text: string; pageCount: number; isScanned: boolean }> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter((s: string) => s.trim().length > 0);
    const pageText = strings.join(' ');
    totalChars += pageText.trim().length;
    if (pageText.trim()) {
      pageTexts.push(`--- Page ${pageNum} ---\n${pageText.trim()}`);
    }
  }

  // Scanned PDF detection: if multi-page document has virtually zero extracted text
  const isScanned = totalChars < 30 && pageCount > 0;
  const fullText = isScanned
    ? `[SCANNED DOCUMENT NOTICE: This PDF contains image-based scanned pages with no embedded selectable text (${pageCount} page(s)). To analyze this document, please switch to a vision-capable AI model such as Gemini 3.8 Flash or GPT-4o.]`
    : pageTexts.join('\n\n');

  return {
    text: fullText,
    pageCount,
    isScanned,
  };
}

/**
 * Extracts text and structured sheets from an Excel workbook (.xlsx / .xls) using SheetJS
 */
export async function extractTextFromExcel(
  fileOrBuffer: File | ArrayBuffer
): Promise<{ text: string; sheetCount: number }> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();

  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  const sheetTexts: string[] = [];

  sheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        sheetTexts.push(`[SHEET: ${sheetName}]\n${csv.trim()}`);
      }
    }
  });

  const fullText = sheetTexts.join('\n\n') || '[Excel file contains empty worksheets]';
  return {
    text: fullText,
    sheetCount: sheetNames.length,
  };
}

/**
 * Extracts raw text from a Word document (.docx / .dotx) using mammoth and JSZip
 */
export async function extractTextFromWord(
  fileOrBuffer: File | ArrayBuffer
): Promise<{ text: string }> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();

  try {
    const mammothRes = await mammoth.extractRawText({ arrayBuffer });
    if (mammothRes && mammothRes.value && mammothRes.value.trim().length > 20) {
      return { text: mammothRes.value.trim() };
    }
  } catch {
    // Fall back to JSZip XML extraction
  }

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = zip.file('word/document.xml') || zip.file(/document\.xml$/i)[0];
    if (docXml) {
      const xml = await docXml.async('text');
      const textMatches = xml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
      const plainText = textMatches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (plainText) {
        return { text: plainText };
      }
    }
  } catch {}

  return { text: '' };
}

/**
 * Converts a browser File into a base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a browser File as data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Shared Attachment Service singleton
 */
export const attachmentService = {
  /**
   * Triggers the native browser file picker with given options
   */
  pickFiles(options: { accept?: string; multiple?: boolean } = {}): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept =
        options.accept ||
        '.pdf,.docx,.dotx,.xlsx,.xls,.txt,.md,.csv,.json,.srt,.vtt,image/png,image/jpeg,image/webp,audio/*,video/*';
      input.multiple = options.multiple !== false;
      input.onchange = () => {
        const files = Array.from(input.files || []);
        resolve(files);
      };
      input.click();
    });
  },

  /**
   * Parses an individual File safely in the browser.
   * Performs validation (empty, >20MB, audio/video redirect, corrupted handling).
   */
  async parseFile(file: File): Promise<ParsedAttachmentItem> {
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name = file.name;
    const type = file.type || 'application/octet-stream';
    const size = file.size;

    // 1. Empty file guard
    if (size === 0) {
      throw new Error(`The file "${name}" is empty (0 bytes) and cannot be processed.`);
    }

    // 2. Size limit guard: 20 MB max
    const MAX_SIZE = 20 * 1024 * 1024;
    if (size > MAX_SIZE) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `The file "${name}" is ${mb} MB, which exceeds the 20 MB browser memory limit. Please attach a smaller file or split it.`
      );
    }

    const ext = name.split('.').pop()?.toLowerCase() || '';

    // 3. Audio / Video Detection -> Route to Transcribe Studio
    if (
      type.startsWith('audio/') ||
      type.startsWith('video/') ||
      ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'mp4', 'webm'].includes(ext)
    ) {
      const audioNotice = `[Audio/Video file attached: ${name}. This file can be transcribed in the Audio Transcription Studio for high-fidelity speech-to-text diarization.]`;
      return {
        id,
        name,
        type,
        size,
        isAudioVideo: true,
        isAudio: true,
        text: audioNotice,
        extractedText: audioNotice,
        originalFile: file,
      };
    }

    // 4. Image Formats (PNG, JPG, WEBP)
    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const imgNotice = `[Attached Image: ${name} (${(size / 1024).toFixed(1)} KB)]`;
        return {
          id,
          name,
          type: type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          size,
          dataUrl,
          base64,
          isImage: true,
          text: imgNotice,
          extractedText: imgNotice,
          previewSnippet: `[Image: ${name} (${(size / 1024).toFixed(1)} KB)]`,
        };
      } catch (err: any) {
        throw new Error(`Failed to load image "${name}": ${err?.message || 'corrupted file'}`);
      }
    }

    // 5. PDF Documents
    if (type === 'application/pdf' || ext === 'pdf') {
      try {
        const [pdfResult, dataUrl] = await Promise.all([
          extractTextFromPdf(file),
          fileToDataUrl(file).catch(() => undefined),
        ]);
        const base64 = dataUrl ? dataUrl.replace(/^data:[^;]+;base64,/, '') : undefined;
        let text = pdfResult.text;
        let truncated = false;

        // Context limit guard: limit to ~100k characters for safe browser LLM transmission
        if (text.length > 100000) {
          text =
            text.slice(0, 100000) +
            '\n\n[NOTICE: This PDF file was truncated to the first 100,000 characters to fit model context limits.]';
          truncated = true;
        }

        const words = text.split(/\s+/).filter(Boolean).length;

        return {
          id,
          name,
          type: 'application/pdf',
          size,
          text,
          extractedText: text,
          dataUrl,
          base64,
          pageCount: pdfResult.pageCount,
          wordCount: words,
          isScannedPdf: pdfResult.isScanned,
          truncated,
          previewSnippet: text.slice(0, 180),
        };
      } catch (err: any) {
        throw new Error(
          `Unable to parse PDF "${name}". The document may be password-protected or corrupted.`
        );
      }
    }

    // 6. Word Documents (.docx, .dotx)
    if (
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx' ||
      ext === 'dotx'
    ) {
      try {
        const wordRes = await extractTextFromWord(file);
        let text = wordRes.text;
        let truncated = false;
        if (!text) {
          throw new Error('No readable text content found in Word document.');
        }

        if (text.length > 100000) {
          text =
            text.slice(0, 100000) +
            '\n\n[NOTICE: This Word document was truncated to the first 100,000 characters to fit model context limits.]';
          truncated = true;
        }

        const words = text.split(/\s+/).filter(Boolean).length;
        return {
          id,
          name,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size,
          text,
          extractedText: text,
          wordCount: words,
          truncated,
          previewSnippet: text.slice(0, 180),
        };
      } catch (err: any) {
        throw new Error(
          `Unable to parse Word document "${name}". Please ensure it is an uncorrupted .docx file.`
        );
      }
    }

    // 7. Excel Spreadsheets (.xlsx, .xls)
    if (
      type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ext === 'xlsx' ||
      ext === 'xls'
    ) {
      try {
        const excelRes = await extractTextFromExcel(file);
        let text = excelRes.text;
        let truncated = false;

        if (text.length > 100000) {
          text =
            text.slice(0, 100000) +
            '\n\n[NOTICE: This spreadsheet was truncated to the first 100,000 characters to fit model context limits.]';
          truncated = true;
        }

        const words = text.split(/\s+/).filter(Boolean).length;
        return {
          id,
          name,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size,
          text,
          extractedText: text,
          wordCount: words,
          truncated,
          previewSnippet: text.slice(0, 180),
        };
      } catch (err: any) {
        throw new Error(`Unable to parse Excel spreadsheet "${name}": ${err?.message || 'corrupted'}`);
      }
    }

    // 8. Subtitle Files (.srt, .vtt)
    if (ext === 'srt' || ext === 'vtt') {
      try {
        const raw = await file.text();
        const cleaned = cleanSubtitleTranscript(raw);
        const words = cleaned.split(/\s+/).filter(Boolean).length;
        return {
          id,
          name,
          type: 'text/plain',
          size,
          text: cleaned,
          extractedText: cleaned,
          wordCount: words,
          previewSnippet: cleaned.slice(0, 180),
        };
      } catch (err: any) {
        throw new Error(`Failed to read subtitle transcript "${name}": ${err?.message}`);
      }
    }

    // 9. Text-based files (.txt, .md, .csv, .json)
    try {
      let text = await file.text();
      let truncated = false;
      if (text.length > 100000) {
        text =
          text.slice(0, 100000) +
          '\n\n[NOTICE: This file was truncated to the first 100,000 characters to fit model context limits.]';
        truncated = true;
      }
      const words = text.split(/\s+/).filter(Boolean).length;
      return {
        id,
        name,
        type: type || 'text/plain',
        size,
        text,
        extractedText: text,
        wordCount: words,
        truncated,
        previewSnippet: text.slice(0, 180),
      };
    } catch (err: any) {
      throw new Error(`Could not read text file "${name}": ${err?.message || 'unsupported encoding'}`);
    }
  },

  /**
   * Verifies if the selected model supports vision (images)
   */
  isVisionCapableModel(modelId?: string): boolean {
    if (!modelId) return true;
    const lower = modelId.toLowerCase();
    return (
      lower.includes('gemini') ||
      lower.includes('gpt-4o') ||
      lower.includes('vision') ||
      lower.includes('claude')
    );
  },

  /**
   * Formats attachments into model-ready request structures
   */
  buildProviderParts(
    attachments: ChatAttachment[],
    selectedModel: string = 'gemini-3.8-flash'
  ): {
    geminiParts: any[];
    combinedTextPrompt: string;
    hasImages: boolean;
  } {
    const geminiParts: any[] = [];
    const textBlocks: string[] = [];
    let hasImages = false;

    for (const att of attachments) {
      // 1. Images
      if (att.dataUrl || att.base64) {
        hasImages = true;
        const mimeType = att.type || 'image/jpeg';
        const base64Data = att.base64 || (att.dataUrl ? att.dataUrl.replace(/^data:[^;]+;base64,/, '') : '');

        if (mimeType.startsWith('image/')) {
          geminiParts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
          textBlocks.push(`[ATTACHED IMAGE: ${att.name}]`);
          continue;
        }

        // Native PDF in Gemini
        if (mimeType === 'application/pdf' && selectedModel.includes('gemini') && base64Data) {
          geminiParts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          });
          // Also include extracted text label if available
          if (att.text) {
            textBlocks.push(`[ATTACHED FILE: ${att.name}]\n${att.text}\n[END ATTACHED FILE]`);
          }
          continue;
        }
      }

      // 2. Text, DOCX, XLSX, SRT, TXT
      if (att.text) {
        textBlocks.push(`[ATTACHED FILE: ${att.name}]\n${att.text}\n[END ATTACHED FILE]`);
        geminiParts.push({
          text: `[ATTACHED FILE: ${att.name}]\n${att.text}\n[END ATTACHED FILE]`,
        });
      }
    }

    return {
      geminiParts,
      combinedTextPrompt: textBlocks.join('\n\n'),
      hasImages,
    };
  },

  /**
   * Deletes an attachment from the sensitive government vault in IndexedDB
   */
  async deleteVaultAttachment(id: string): Promise<void> {
    try {
      const db = await openAttachmentDb();
      const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
      tx.objectStore(STORE_ATTACHMENTS).delete(id);
    } catch {}
  },

  /**
   * Saves an active handoff transcript (from Transcribe or Documents) into shared state & IndexedDB
   */
  async saveHandoffTranscript(
    targetStudioOrPayload: string | { title?: string; date?: string; content?: string; transcript?: string; speakerCount?: number; speakerLabels?: string[]; source?: any },
    maybePayload?: { title?: string; date?: string; content?: string; transcript?: string; speakerCount?: number; speakerLabels?: string[]; source?: any }
  ): Promise<void> {
    const targetStudio = typeof targetStudioOrPayload === 'string' ? targetStudioOrPayload : undefined;
    const payload = typeof targetStudioOrPayload === 'object' ? targetStudioOrPayload : (maybePayload || {});
    const content = payload.transcript || payload.content || '';

    const item: HandoffTranscript = {
      id: targetStudio ? `pending_transcript_${targetStudio}` : 'current_pending_transcript',
      title: payload.title || 'Official Meeting Transcript',
      date: payload.date || new Date().toISOString(),
      speakerCount: payload.speakerCount || payload.speakerLabels?.length,
      speakerLabels: payload.speakerLabels,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      rawText: content,
      transcript: content,
      targetStudio,
      source: payload.source || 'transcribe',
      createdAt: new Date().toISOString(),
    };

    const key = targetStudio ? `rsim_pending_handoff_${targetStudio}` : 'rsim_pending_handoff_transcript';
    try {
      sessionStorage.setItem(key, JSON.stringify(item));
    } catch {}

    try {
      const db = await openAttachmentDb();
      const tx = db.transaction(STORE_HANDOFF, 'readwrite');
      tx.objectStore(STORE_HANDOFF).put(item);
    } catch {}
  },

  /**
   * Retrieves any pending handoff transcript
   */
  async getHandoffTranscript(targetStudio?: string): Promise<HandoffTranscript | null> {
    const key = targetStudio ? `rsim_pending_handoff_${targetStudio}` : 'rsim_pending_handoff_transcript';
    try {
      const cached = sessionStorage.getItem(key) || sessionStorage.getItem('rsim_pending_handoff_transcript');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.transcript = parsed.transcript || parsed.rawText;
        return parsed;
      }
    } catch {}

    try {
      const db = await openAttachmentDb();
      const id = targetStudio ? `pending_transcript_${targetStudio}` : 'current_pending_transcript';
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_HANDOFF, 'readonly');
        const req = tx.objectStore(STORE_HANDOFF).get(id);
        req.onsuccess = () => {
          const res = req.result;
          if (res) res.transcript = res.transcript || res.rawText;
          resolve(res || null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /**
   * Clears the pending handoff transcript after user adoption or dismissal
   */
  async clearHandoffTranscript(targetStudio?: string): Promise<void> {
    const key = targetStudio ? `rsim_pending_handoff_${targetStudio}` : 'rsim_pending_handoff_transcript';
    try {
      sessionStorage.removeItem(key);
      if (targetStudio) sessionStorage.removeItem('rsim_pending_handoff_transcript');
    } catch {}

    try {
      const db = await openAttachmentDb();
      const tx = db.transaction(STORE_HANDOFF, 'readwrite');
      const id = targetStudio ? `pending_transcript_${targetStudio}` : 'current_pending_transcript';
      tx.objectStore(STORE_HANDOFF).delete(id);
    } catch {}
  },

  /**
   * Parses cloud file downloaded from Google Drive or OneDrive
   */
  async parseDriveFile(
    fileName: string,
    mimeType: string,
    textContent: string,
    arrayBuffer?: ArrayBuffer
  ): Promise<ParsedAttachmentItem> {
    const id = `att_cloud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lowerName = fileName.toLowerCase();

    if (arrayBuffer && (lowerName.endsWith('.docx') || lowerName.endsWith('.dotx'))) {
      const docxRes = await extractTextFromWord(arrayBuffer);
      const text = docxRes.text || textContent;
      return {
        id,
        name: fileName,
        type: mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: arrayBuffer.byteLength,
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        previewSnippet: text.slice(0, 160),
      };
    }

    if (arrayBuffer && (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls'))) {
      try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetSummaries: string[] = [];
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheetSummaries.push(`--- Sheet: ${sheetName} ---\n${csv}`);
        });
        const text = sheetSummaries.join('\n\n');
        return {
          id,
          name: fileName,
          type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: arrayBuffer.byteLength,
          text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          previewSnippet: text.slice(0, 160),
        };
      } catch (err: any) {
        console.warn('Excel parse notice:', err);
      }
    }

    const words = textContent.trim().split(/\s+/).filter(Boolean).length;
    return {
      id,
      name: fileName,
      type: mimeType || 'text/plain',
      size: textContent.length,
      text: textContent,
      wordCount: words,
      previewSnippet: textContent.slice(0, 160),
    };
  },
};
