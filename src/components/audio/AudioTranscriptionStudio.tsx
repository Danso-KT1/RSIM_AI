import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Square,
  Copy,
  Check,
  Download,
  Send,
  Mail,
  Clock,
  Search,
  Sparkles,
  Trash2,
  Users,
  FileText,
  Volume2,
  ArrowRight,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  Sliders,
  FileCheck,
} from 'lucide-react';
import { Meeting, DocumentItem } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { exportToDocx, exportToPdf } from '../../utils/docxExporter';
import { attachmentService } from '../../services/attachmentService';

export interface ParsedDialogueSegment {
  id: string;
  speaker: string;
  timestamp?: string;
  text: string;
}

/**
 * Parses formatted dialogue transcripts into structured speaker segments.
 * Supports format: [00:12] Speaker 1: Hello everyone...
 */
export function parseTranscriptSegments(raw: string): ParsedDialogueSegment[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split(/\n+/);
  const segments: ParsedDialogueSegment[] = [];
  let currentSpeaker = 'Speaker 1';
  let currentTimestamp: string | undefined = undefined;
  let currentLines: string[] = [];

  const speakerPattern =
    /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*)?(?:(Speaker\s*[A-Za-z0-9]+|Chairperson|Director|Moderator|Participant|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[:\-])\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(speakerPattern);
    if (match) {
      if (currentLines.length > 0) {
        segments.push({
          id: `seg_${segments.length}`,
          speaker: currentSpeaker,
          timestamp: currentTimestamp,
          text: currentLines.join(' '),
        });
        currentLines = [];
      }
      currentTimestamp = match[1] || undefined;
      currentSpeaker = match[2]?.trim() || 'Speaker 1';
      if (match[3]?.trim()) {
        currentLines.push(match[3].trim());
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    segments.push({
      id: `seg_${segments.length}`,
      speaker: currentSpeaker,
      timestamp: currentTimestamp,
      text: currentLines.join(' '),
    });
  }

  return segments;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English (Institutional)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'sw', label: 'Swahili (Kiswahili)' },
  { code: 'ak', label: 'Akan / Twi' },
];

const SPEAKER_THEMES = [
  {
    badge: 'bg-emerald-600 text-white',
    card: 'border-emerald-200/80 bg-emerald-50/40',
    header: 'text-emerald-900',
    time: 'text-emerald-700 bg-emerald-100/70',
  },
  {
    badge: 'bg-blue-600 text-white',
    card: 'border-blue-200/80 bg-blue-50/40',
    header: 'text-blue-900',
    time: 'text-blue-700 bg-blue-100/70',
  },
  {
    badge: 'bg-teal-700 text-white',
    card: 'border-teal-200/80 bg-teal-50/40',
    header: 'text-teal-950',
    time: 'text-teal-700 bg-teal-100/70',
  },
  {
    badge: 'bg-purple-600 text-white',
    card: 'border-purple-200/80 bg-purple-50/40',
    header: 'text-purple-900',
    time: 'text-purple-700 bg-purple-100/70',
  },
  {
    badge: 'bg-amber-600 text-white',
    card: 'border-amber-200/80 bg-amber-50/40',
    header: 'text-amber-900',
    time: 'text-amber-700 bg-amber-100/70',
  },
  {
    badge: 'bg-indigo-600 text-white',
    card: 'border-indigo-200/80 bg-indigo-50/40',
    header: 'text-indigo-900',
    time: 'text-indigo-700 bg-indigo-100/70',
  },
];

interface AudioTranscriptionStudioProps {
  meetings: Meeting[];
  onMeetingsChanged: () => void;
  onNavigateToStudio?: (studio: 'letters' | 'memos' | 'minutes' | 'reports', content?: string) => void;
  onDocumentCreated: (docId: string) => void;
}

export const AudioTranscriptionStudio: React.FC<AudioTranscriptionStudioProps> = ({
  meetings,
  onMeetingsChanged,
  onNavigateToStudio,
  onDocumentCreated,
}) => {
  // Source Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Transcription Engine Options
  const [language, setLanguage] = useState<string>('en');
  const [diarize, setDiarize] = useState<boolean>(true);
  const [keyterms, setKeyterms] = useState<string[]>([]);
  const [keytermInput, setKeytermInput] = useState<string>('');

  // Processing & Result State
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeElapsedSec, setTranscribeElapsedSec] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [speakersDetected, setSpeakersDetected] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Right Column View Controls
  const [viewMode, setViewMode] = useState<'dialogue' | 'raw'>('dialogue');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const processTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (processTimerRef.current) clearInterval(processTimerRef.current);
    };
  }, [audioBlobUrl]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rem = secs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // Handle Drag & Drop
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleAudioFileSelected(file);
    }
  };

  const handleAudioFileSelected = (file: File) => {
    setErrorMessage(null);
    setAudioFile(file);
    setAudioFileName(file.name);
    setAudioBase64(null);

    // Normalize audio mime type
    let resolvedMime = file.type;
    const lower = file.name.toLowerCase();
    if (!resolvedMime || resolvedMime === 'application/octet-stream') {
      if (lower.endsWith('.mp3')) resolvedMime = 'audio/mp3';
      else if (lower.endsWith('.wav')) resolvedMime = 'audio/wav';
      else if (lower.endsWith('.m4a') || lower.endsWith('.mp4') || lower.endsWith('.aac')) resolvedMime = 'audio/mp4';
      else if (lower.endsWith('.webm')) resolvedMime = 'audio/webm';
      else if (lower.endsWith('.ogg')) resolvedMime = 'audio/ogg';
      else resolvedMime = 'audio/mp3';
    }
    setAudioMimeType(resolvedMime);

    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
    const url = URL.createObjectURL(file);
    setAudioBlobUrl(url);

    // Pre-calculate audio duration
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      if (tempAudio.duration && !isNaN(tempAudio.duration)) {
        setAudioDurationSec(Math.round(tempAudio.duration));
      }
    };
  };

  const handleClearAudio = () => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
    setAudioFile(null);
    setAudioBlobUrl(null);
    setAudioBase64(null);
    setAudioFileName('');
    setAudioDurationSec(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Microphone Recording Handlers
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      handleClearAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = `Live_Proceedings_${stamp}.webm`;

        setAudioBlobUrl(url);
        setAudioFileName(name);
        setAudioMimeType(mime);
        setAudioDurationSec(recordingSeconds);

        // Convert blob to base64 for reliable transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          if (res) {
            setAudioBase64(res.split(',')[1] || res);
          }
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(`Microphone access error: ${err.message}. Please check browser permissions.`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        clearInterval(recordTimerRef.current);
        setIsPaused(true);
      } else {
        mediaRecorderRef.current.resume();
        recordTimerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
        setIsPaused(false);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  // Keyterm Chip Handlers
  const handleAddKeyterm = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = keytermInput.trim();
      if (val && !keyterms.includes(val)) {
        setKeyterms([...keyterms, val]);
        setKeytermInput('');
      }
    }
  };

  const handleRemoveKeyterm = (termToRemove: string) => {
    setKeyterms(keyterms.filter((t) => t !== termToRemove));
  };

  // Perform Audio Transcription via Grok Voice 2.0 (with silent Groq fallback)
  const handleTranscribe = async () => {
    if (!audioFile && !audioBase64) {
      setErrorMessage('Please select or record an audio file first.');
      return;
    }

    setIsTranscribing(true);
    setTranscribeElapsedSec(0);
    setErrorMessage(null);

    const startTime = Date.now();
    processTimerRef.current = setInterval(() => {
      setTranscribeElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const transcriptionOptions = {
        language,
        diarize,
        keyterms: keyterms.length > 0 ? keyterms : undefined,
      };

      let result: {
        transcript: string;
        success: boolean;
        modelUsed?: string;
        speakersDetected?: number;
        duration?: number;
        error?: string;
      };

      if (audioFile) {
        result = await aiService.transcribeAudioFile(
          audioFile,
          audioFileName || 'Session_Audio.mp3',
          transcriptionOptions
        );
      } else if (audioBase64) {
        result = await aiService.transcribeAudio(
          audioBase64,
          audioMimeType,
          transcriptionOptions,
          audioFileName || 'Live_Proceedings.webm'
        );
      } else {
        throw new Error('No audio data available for transcription.');
      }

      if (processTimerRef.current) clearInterval(processTimerRef.current);

      if (result.success && result.transcript) {
        setTranscript(result.transcript);
        setModelUsed(result.modelUsed || 'grok-voice-transcribe-2.0');
        setSpeakersDetected(result.speakersDetected || 1);

        // Auto-save session to meetings repository
        const meetingItem: Meeting = {
          id: `mtg_${Date.now()}`,
          title: audioFileName
            ? audioFileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
            : `Transcribed Session (${new Date().toLocaleDateString('en-GB')})`,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          venue: 'Institutional Directorate / Boardroom',
          chairperson: 'Director, RSIM',
          participants: ['Director', 'Secretariat', 'Technical Leads'],
          organizer: 'RSIM Directorate',
          agenda: ['Institutional Proceedings Transcription'],
          meetingType: 'Directorate Review',
          audioFileName: audioFileName || 'Session_Audio',
          transcript: parseTranscriptSegments(result.transcript).map((seg, idx) => ({
            id: `seg_${idx}`,
            timestamp: seg.timestamp || '00:00',
            seconds: 0,
            speaker: seg.speaker,
            text: seg.text,
          })),
          status: 'Transcribed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        storage.saveMeeting(meetingItem);
        onMeetingsChanged();
      } else {
        setErrorMessage(result.error || 'Transcription failed. Please check audio clarity and try again.');
      }
    } catch (err: any) {
      if (processTimerRef.current) clearInterval(processTimerRef.current);
      setErrorMessage(err?.message || 'Server error during audio transcription.');
    } finally {
      setIsTranscribing(false);
      if (processTimerRef.current) clearInterval(processTimerRef.current);
    }
  };

  // Parse segments for dialogue view
  const parsedSegments = useMemo(() => {
    return parseTranscriptSegments(transcript);
  }, [transcript]);

  // Unique speakers mapping for consistent colors
  const speakerThemeMap = useMemo(() => {
    const map = new Map<string, (typeof SPEAKER_THEMES)[0]>();
    let idx = 0;
    parsedSegments.forEach((seg) => {
      if (!map.has(seg.speaker)) {
        map.set(seg.speaker, SPEAKER_THEMES[idx % SPEAKER_THEMES.length]);
        idx++;
      }
    });
    return map;
  }, [parsedSegments]);

  // Filtered segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return parsedSegments;
    const q = searchQuery.toLowerCase();
    return parsedSegments.filter(
      (s) => s.text.toLowerCase().includes(q) || s.speaker.toLowerCase().includes(q)
    );
  }, [parsedSegments, searchQuery]);

  // Copy to clipboard
  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Export DOCX
  const handleExportDocx = () => {
    if (!transcript) return;
    const baseName = audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Session_Transcript';
    exportToDocx({
      title: `Official Transcript - ${baseName.replace(/[_-]/g, ' ')}`,
      content: transcript,
      referenceNumber: `RSIM/TRN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      type: 'Meeting Transcript',
      author: 'RSIM AI Directorate Workstation',
      department: 'Ministry of Communications and Digitalisation',
    });
  };

  // Export PDF
  const handleExportPdf = () => {
    if (!transcript) return;
    const baseName = audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Session_Transcript';
    exportToPdf({
      title: `Official Transcript - ${baseName.replace(/[_-]/g, ' ')}`,
      content: transcript,
      referenceNumber: `RSIM/TRN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      type: 'Meeting Transcript',
      author: 'RSIM AI Directorate Workstation',
      department: 'Ministry of Communications and Digitalisation',
    });
  };

  // State for toast feedback on studio transition
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Send into Writing Studios with IndexedDB handoff and speaker label preservation
  const handleSendToStudio = async (studio: 'minutes' | 'memos' | 'letters' | 'reports') => {
    if (!transcript) return;
    const baseTitle = audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Recorded Meeting Session';
    const parsedSegments = parseTranscriptSegments(transcript);
    const speakersList = Array.from(new Set(parsedSegments.map((s) => s.speaker)));

    const targetStudio = studio === 'memos' ? 'letters' : studio;
    await attachmentService.saveHandoffTranscript(targetStudio, {
      transcript,
      title: baseTitle,
      date: new Date().toLocaleDateString('en-GB'),
      speakerLabels: speakersList,
    });

    const studioLabel =
      studio === 'minutes'
        ? 'Minutes Studio'
        : studio === 'reports'
        ? 'Report Studio'
        : 'Letters & Memos Studio';
    setToastMessage(`Transcript sent to ${studioLabel}`);
    setTimeout(() => {
      setToastMessage(null);
      onNavigateToStudio?.(studio, transcript);
    }, 400);
  };

  // Save Transcript to Documents Repository
  const handleSaveTranscript = () => {
    if (!transcript) return;
    const baseTitle = audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Recorded Meeting Session';
    const docId = `doc_trn_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: docId,
      title: `Transcript: ${baseTitle}`,
      type: 'Uploaded Document',
      category: 'Minutes',
      referenceNumber: `RSIM/TRN/2026/${Math.floor(10 + Math.random() * 90)}`,
      content: transcript,
      author: storage.getUser().name,
      version: 1,
      versions: [],
      approvalStatus: 'Final',
      comments: [],
      tags: ['Transcript', 'Audio-Diarized'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveDocument(newDoc);
    onDocumentCreated(docId);
    setToastMessage('Transcript saved to Documents Repository');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex h-full flex-col gap-5 max-w-[1600px] mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Audio Transcription Studio
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              xAI Grok Voice 2.0
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ultra-fast executive speech-to-text with multi-speaker diarization, timestamps, and direct document generation.
          </p>
        </div>

        {modelUsed && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Engine:</span>
            <span className="font-semibold text-slate-800">{modelUsed}</span>
            {speakersDetected > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">{speakersDetected} speaker{speakersDetected > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[620px] items-stretch">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Source Input & Config (~360px on desktop)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-4 flex-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Audio Source
            </h2>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/mp4,video/webm,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAudioFileSelected(file);
              }}
            />

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/70'
                  : audioFileName
                  ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
                  : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/70'
              }`}
            >
              <div
                className={`mb-2.5 rounded-xl p-3 transition-colors ${
                  audioFileName
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                }`}
              >
                <Upload className="h-5 w-5" />
              </div>

              {audioFileName ? (
                <div className="space-y-1 w-full px-2">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {audioFileName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {audioFile
                      ? `${(audioFile.size / (1024 * 1024)).toFixed(1)} MB • Click to replace`
                      : 'Live Recording Ready'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Click to upload or drag & drop audio
                  </p>
                  <p className="text-[11px] text-slate-400">
                    MP3, WAV, M4A, WebM (up to 500 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Audio Preview Player if loaded */}
            {audioBlobUrl && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{audioFileName}</span>
                  </span>
                  <button
                    onClick={handleClearAudio}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                    title="Remove audio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <audio
                  ref={audioPlayerRef}
                  controls
                  src={audioBlobUrl}
                  className="w-full h-8"
                />
              </div>
            )}

            {/* Primary Record Button / Recording HUD */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Live Microphone Recording
              </label>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <Mic className="h-4 w-4 text-rose-600" />
                  <span>Start Live Recording</span>
                </button>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
                      <span className="text-xs font-bold text-rose-900">
                        {isPaused ? 'Recording Paused' : 'Recording in Progress...'}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-rose-800">
                      {formatTime(recordingSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={pauseRecording}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors"
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-2xs transition-colors"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop & Capture</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Options: Language & Diarization */}
            <div className="space-y-3.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Transcription Options
              </h2>

              {/* Language Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Audio Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker Diarization Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Speaker Diarization
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Separate speakers with labels and timestamps
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiarize(!diarize)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    diarize ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={diarize}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      diarize ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Key Terms Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>Custom Domain Vocabulary</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  value={keytermInput}
                  onChange={(e) => setKeytermInput(e.target.value)}
                  onKeyDown={handleAddKeyterm}
                  placeholder="e.g. RSIM, NITA, Cybersecurity (Press Enter)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                />

                {keyterms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {keyterms.map((term) => (
                      <span
                        key={term}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200"
                      >
                        {term}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyterm(term)}
                          className="hover:text-emerald-950"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Transcribe Button */}
            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={(!audioFile && !audioBase64) || isTranscribing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Transcribing with Grok Voice... ({transcribeElapsedSec}s)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Transcribe Audio</span>
                  </>
                )}
              </button>

              {isTranscribing && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full animate-pulse w-full" />
                  </div>
                  <p className="text-[11px] text-center text-slate-500 font-medium">
                    Decoding audio bitstream with xAI Grok Voice Transcribe 2.0...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Transcript Output & Action Controls          */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col flex-1 overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Transcript
                  </h2>
                </div>

                {transcript && (
                  <span className="text-xs text-slate-500 font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    ~{transcript.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>

              {/* View Toggle & Search */}
              <div className="flex items-center gap-2.5">
                {transcript && (
                  <>
                    {/* Search inside transcript */}
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transcript..."
                        className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:outline-hidden w-40 sm:w-48"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Dialogue vs Raw Mode Switch */}
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('dialogue')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          viewMode === 'dialogue'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Dialogue
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('raw')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          viewMode === 'raw'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Raw Text
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Transcript Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {!transcript ? (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <Mic className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No Audio Transcribed Yet
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upload an audio file or record directly using the panel on the left. xAI Grok Voice Transcribe 2.0 will generate a clean, timestamped transcript ready for official documentation.
                  </p>
                </div>
              ) : viewMode === 'dialogue' ? (
                <div className="space-y-4">
                  {filteredSegments.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No dialogue matches found for "{searchQuery}".
                    </div>
                  ) : (
                    filteredSegments.map((segment) => {
                      const theme = speakerThemeMap.get(segment.speaker) || SPEAKER_THEMES[0];
                      return (
                        <div
                          key={segment.id}
                          className={`rounded-xl border p-4 transition-colors ${theme.card}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-bold ${theme.badge}`}
                              >
                                {segment.speaker}
                              </span>
                            </div>

                            {segment.timestamp && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${theme.time}`}
                              >
                                {segment.timestamp}
                              </span>
                            )}
                          </div>

                          <p className="text-xs leading-relaxed text-slate-800 font-normal">
                            {segment.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <textarea
                  readOnly
                  value={transcript}
                  className="w-full h-full min-h-[440px] resize-none border-0 bg-transparent font-mono text-xs leading-relaxed text-slate-800 focus:outline-hidden"
                />
              )}
            </div>

            {/* Bottom Action Bar */}
            {transcript && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 bg-slate-50/70">
                {/* Export & Copy Tools */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDocx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>Export DOCX</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <FileCheck className="h-3.5 w-3.5 text-slate-500" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveTranscript}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors"
                    title="Save transcript to Documents repository"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Save Transcript</span>
                  </button>
                </div>

                {/* Workflow Transitions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">
                    Send to Studio:
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSendToStudio('minutes')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Send to Minutes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendToStudio('reports')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Send to Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendToStudio('letters')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5 text-slate-600" />
                    <span>Send to Letter/Memo (as notes)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Toast Feedback Banner */}
            {toastMessage && (
              <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{toastMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
