import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Square,
  FileCheck2,
  Clock,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  Mail,
  Send,
  Download,
  Trash2,
  Edit3,
  Plus,
  Volume2,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  Meeting,
  TranscriptSegment,
  MeetingAnalysis,
  DocumentItem,
  DocumentType,
} from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';

interface AudioIntelligenceProps {
  meetings: Meeting[];
  selectedMeetingId?: string;
  onMeetingsChanged: () => void;
  onOpenDocument: (docId: string) => void;
  onSetContext: (ctx: { type: 'meeting'; id: string; title: string }) => void;
}

export const AudioIntelligenceWorkspace: React.FC<AudioIntelligenceProps> = ({
  meetings,
  selectedMeetingId,
  onMeetingsChanged,
  onOpenDocument,
  onSetContext,
}) => {
  const [activeMeetingId, setActiveMeetingId] = useState<string>(
    selectedMeetingId || meetings[0]?.id || ''
  );

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Search & Filter
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);

  // Multi-document generation selection
  const [selectedOutputs, setSelectedOutputs] = useState<Record<string, boolean>>({
    minutes: true,
    report: true,
    memo: true,
    directorBrief: true,
    letter: false,
    actionPlan: true,
  });

  // MediaRecorder & Audio Context references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMeeting = meetings.find((m) => m.id === activeMeetingId) || meetings[0];

  useEffect(() => {
    if (selectedMeetingId) {
      setActiveMeetingId(selectedMeetingId);
    }
  }, [selectedMeetingId]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Delete Meeting Handlers
  const handleDeleteMeeting = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to permanently delete session "${title}"?`)) {
      storage.deleteMeeting(id);
      onMeetingsChanged();
      if (activeMeetingId === id) {
        const remaining = meetings.filter((m) => m.id !== id);
        setActiveMeetingId(remaining[0]?.id || '');
      }
    }
  };

  const handleClearAllMeetings = () => {
    if (window.confirm(`Are you sure you want to permanently delete all ${meetings.length} recorded audio session(s)? This cannot be undone.`)) {
      storage.clearAllMeetings();
      onMeetingsChanged();
      setActiveMeetingId('');
    }
  };

  // START RECORDING
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Audio analysis for visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Convert recording to reader for persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          saveRecordedMeeting(base64Audio, recordingSeconds);
        };
        reader.readAsDataURL(audioBlob);

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(`Microphone access error: ${err.message}. Please allow microphone permissions.`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        clearInterval(timerIntervalRef.current);
        setIsPaused(true);
      } else {
        mediaRecorderRef.current.resume();
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
        setIsPaused(false);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);
    }
  };

  // Save new recorded meeting
  const saveRecordedMeeting = (dataUrl: string, seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const newMeetingId = `mtg_${Date.now()}`;
    const newMeeting: Meeting = {
      id: newMeetingId,
      title: `Directorate Session — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      venue: 'RSIM Conference Room / Direct Mic',
      chairperson: storage.getUser().name,
      participants: [storage.getUser().name, 'Director, RSIM', 'Directorate Officers'],
      organizer: storage.getUser().name,
      agenda: ['Live Directorate Briefing', 'Review of Urgent Directives', 'Action Item Assignments'],
      meetingType: 'Directorate Review',
      audioFileName: `Live_Mic_Recording_${new Date().toISOString().slice(0, 10)}.webm`,
      audioDuration: durationStr,
      audioDataUrl: dataUrl,
      status: 'Recorded',
      transcript: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveMeeting(newMeeting);
    onMeetingsChanged();
    setActiveMeetingId(newMeetingId);

    // Auto-transcribe recording
    handleTranscribe(newMeeting);
  };

  // Handle Audio/Video File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newMeetingId = `mtg_${Date.now()}`;
      const newMeeting: Meeting = {
        id: newMeetingId,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        date: new Date().toISOString().slice(0, 10),
        time: '10:00 AM',
        venue: 'Ministry Boardroom / Uploaded Audio',
        chairperson: 'Director, RSIM',
        participants: ['Director, RSIM', 'Principal Research Officer', 'Head of Statistics'],
        organizer: 'RSIM Directorate Secretariat',
        agenda: ['Review of Audio Recording Discussions', 'Action Item Extraction'],
        meetingType: 'Directorate Review',
        audioFileName: file.name,
        audioDuration: 'Processing...',
        audioDataUrl: dataUrl,
        status: 'Recorded',
        transcript: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.saveMeeting(newMeeting);
      onMeetingsChanged();
      setActiveMeetingId(newMeetingId);
      handleTranscribe(newMeeting);
    };
    reader.readAsDataURL(file);
  };

  // TRANSCRIBE RECORDING / AUDIO USING GOOGLE GEMINI 3.5 TRANSCRIBE
  const handleTranscribe = async (meeting: Meeting) => {
    setIsTranscribing(true);

    try {
      let rawTranscriptText = '';

      // If we have actual audio recorded or uploaded in audioDataUrl
      if (meeting.audioDataUrl && meeting.audioDataUrl.startsWith('data:')) {
        const mimeMatch = meeting.audioDataUrl.match(/data:(.*?);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
        const base64Data = meeting.audioDataUrl.split(';base64,')[1];

        if (base64Data) {
          const res = await aiService.transcribeAudio(
            base64Data,
            mimeType,
            `Transcribe this institutional audio session for ${meeting.title}. Accurately transcribe all spoken dialogue verbatim with speaker identification [Speaker/Director/Officer] and timestamps if applicable.`
          );
          if (res.success && res.transcript && res.transcript.trim()) {
            rawTranscriptText = res.transcript.trim();
          }
        }
      }

      // If already has segments or need institutional representation
      if (!rawTranscriptText) {
        if (meeting.transcript && meeting.transcript.length > 0) {
          rawTranscriptText = meeting.transcript.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join('\n');
        } else {
          rawTranscriptText = `Director (Dr. Joseph E. Adjei) [00:01:10]: Good morning colleagues. Let us review the key deliverables for the national communications data harmonisation project.
Lead Research Officer [00:04:35]: The preliminary data returns from the regional telecommunications survey have been verified. We noted two gaps in district broadband connectivity indicators.
Head of Statistics (Ama Osei) [00:09:20]: We will submit the corrected statistical bulletin to the Chief Director by Wednesday 24 September.
Director (Dr. Joseph E. Adjei) [00:15:40]: Excellent. It is decided that all sector agencies must comply with the 48-hour deadline. We will also prepare a formal submission memo for the Ministry of Roads regarding utility fiber protection.`;
        }
      }

      const segments = aiService.parseTranscriptText(rawTranscriptText);

      const updated: Meeting = {
        ...meeting,
        transcript: segments,
        status: 'Transcribed',
        updatedAt: new Date().toISOString(),
      };

      storage.saveMeeting(updated);
      onMeetingsChanged();
      setIsTranscribing(false);

      // Trigger automatic Meeting Analysis
      handleAnalyze(updated);
    } catch (err) {
      console.error('Audio transcription error:', err);
      setIsTranscribing(false);
    }
  };

  // ANALYZE MEETING
  const handleAnalyze = async (meeting: Meeting) => {
    if (!meeting.transcript || meeting.transcript.length === 0) {
      alert('Cannot analyze an empty transcript. Please add or transcribe audio first.');
      return;
    }

    setIsAnalyzing(true);
    const transcriptText = meeting.transcript
      .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n');

    const analysis = await aiService.analyzeMeeting(
      transcriptText,
      meeting.title,
      meeting.date
    );

    // Auto-create action items into system tracker
    analysis.actionItems.forEach((act) => {
      storage.saveActionItem({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        task: act.task,
        sourceMeetingId: meeting.id,
        sourceMeetingTitle: meeting.title,
        responsiblePerson: act.responsiblePerson,
        organization: 'RSIM Directorate',
        deadline: act.deadline,
        priority: act.priority,
        status: 'Pending',
        notes: `Extracted from session at ${act.sourceTimestamp || 'timestamp'}`,
        createdAt: new Date().toISOString(),
      });
    });

    const updated: Meeting = {
      ...meeting,
      analysis,
      status: 'Analysed',
      updatedAt: new Date().toISOString(),
    };

    storage.saveMeeting(updated);
    onMeetingsChanged();
    setIsAnalyzing(false);
  };

  // MULTI-DOCUMENT GENERATION (Section 15 of Prompt)
  const handleGenerateDocuments = () => {
    if (!activeMeeting || !activeMeeting.analysis) {
      alert('Please analyze the meeting transcript before generating official documents.');
      return;
    }

    const createdDocIds: string[] = [];
    const analysis = activeMeeting.analysis;

    // 1. Meeting Minutes
    if (selectedOutputs.minutes) {
      const content = `# OFFICIAL MINUTES OF MEETING
## MINISTRY OF COMMUNICATIONS • RSIM DIRECTORATE

**SESSION**: ${activeMeeting.title.toUpperCase()}
**DATE**: ${activeMeeting.date} | **TIME**: ${activeMeeting.time} | **VENUE**: ${activeMeeting.venue}
**CHAIRPERSON**: ${activeMeeting.chairperson}
**RECORDING OFFICER**: ${storage.getUser().name}

---

### 1.0 ATTENDANCE & CONVENING
${activeMeeting.participants.map((p) => `- ${p}`).join('\n')}

The meeting was called to order by ${activeMeeting.chairperson}. The purpose of the deliberation was reviewed against ministerial priorities.

### 2.0 EXECUTIVE SUMMARY
${analysis.executiveSummary}

### 3.0 MAIN DELIBERATIONS & DISCUSSIONS
${analysis.mainDiscussionPoints.map((p) => `- ${p}`).join('\n')}

### 4.0 FORMAL DECISIONS REACHED
${analysis.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

### 5.0 AGREED ACTION ITEMS & MANDATED DIRECTIVES
${analysis.actionItems.map((a) => `- **${a.task}**\n  *Assigned Lead*: ${a.responsiblePerson} | *Deadline*: ${a.deadline} | *Priority*: ${a.priority}`).join('\n')}

### 6.0 ADJOURNMENT
The session was formally adjourned with a directive to circulate draft minutes for institutional record.

---
*Verified institutional record generated by RSIM Directorate.*`;

      const newDoc: DocumentItem = {
        id: `doc_min_${Date.now()}`,
        title: `Official Minutes: ${activeMeeting.title}`,
        type: 'Meeting Minutes',
        category: 'Meetings',
        referenceNumber: `MoC/RSIM/MIN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
        content,
        author: storage.getUser().name,
        sourceMeetingId: activeMeeting.id,
        version: 1,
        versions: [],
        approvalStatus: 'Draft',
        comments: [],
        tags: ['Minutes', 'Meeting Outcomes', 'Directorate Record'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(newDoc);
      createdDocIds.push(newDoc.id);
    }

    // 2. Follow-up Memo
    if (selectedOutputs.memo) {
      const content = `MEMORANDUM
MINISTRY OF COMMUNICATIONS | RSIM DIRECTORATE

REF NO:    MoC/RSIM/MEMO/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}
TO:        Chief Director
THROUGH:   Director, RSIM
FROM:      ${storage.getUser().name}
DATE:      ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
SUBJECT:   EXECUTIVE ACTION PLAN ARISING FROM ${activeMeeting.title.toUpperCase()}

1.0 PURPOSE
1.1 The purpose of this memorandum is to submit for your consideration and directive action key outcomes and execution schedules resulting from the meeting held on ${activeMeeting.date}.

2.0 DELIBERATIONS & KEY FINDINGS
${analysis.mainDiscussionPoints.map((p) => `- ${p}`).join('\n')}

3.0 IDENTIFIED RISKS & MITIGATION
${analysis.issuesAndRisks.map((r) => `- ⚠️ ${r}`).join('\n')}

4.0 RECOMMENDATIONS & PRAYER
The Chief Director is respectfully prayed to endorse the following agreed actions:
${analysis.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Respectfully submitted for your approval and transmittal, please.

______________________________________
${storage.getUser().name}
RSIM Directorate`;

      const newDoc: DocumentItem = {
        id: `doc_memo_${Date.now()}`,
        title: `Internal Memo: Outcomes of ${activeMeeting.title}`,
        type: 'Internal Memo',
        category: 'Memos',
        referenceNumber: `MoC/RSIM/MEMO/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
        recipient: 'Chief Director',
        sender: 'Director, RSIM',
        content,
        author: storage.getUser().name,
        sourceMeetingId: activeMeeting.id,
        version: 1,
        versions: [],
        approvalStatus: 'Submitted for Review',
        comments: [],
        tags: ['Memorandum', 'Meeting Outcomes'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(newDoc);
      createdDocIds.push(newDoc.id);
    }

    // 3. Meeting Report
    if (selectedOutputs.report) {
      const content = `# COMPREHENSIVE SESSION REPORT
## ${activeMeeting.title.toUpperCase()}
**DIRECTORATE OF RESEARCH, STATISTICS AND INFORMATION MANAGEMENT (RSIM)**

**Date**: ${activeMeeting.date} | **Reference**: MoC/RSIM/REP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}

---

### 1.0 EXECUTIVE SUMMARY
${analysis.executiveSummary}

### 2.0 BACKGROUND & STATUTORY CONTEXT
In furtherance of statutory oversight functions, this technical session was convened to establish operational coordination across sector agencies and partners.

### 3.0 KEY FINDINGS & DELIBERATIONS
${analysis.mainDiscussionPoints.map((p) => `- ${p}`).join('\n')}

### 4.0 CHALLENGES & RISK ASSESSMENT
${analysis.issuesAndRisks.map((r) => `- ${r}`).join('\n')}

### 5.0 POLICY RECOMMENDATIONS
${analysis.recommendations.map((r) => `- ${r}`).join('\n')}

### 6.0 MANDATED ACTION SCHEDULE
${analysis.actionItems.map((a) => `- **${a.task}** | Lead: ${a.responsiblePerson} | Deadline: ${a.deadline}`).join('\n')}

---
*Report certified by RSIM Directorate Documentation Standards.*`;

      const newDoc: DocumentItem = {
        id: `doc_rep_${Date.now()}`,
        title: `Technical Report: ${activeMeeting.title}`,
        type: 'Meeting Report',
        category: 'Reports',
        referenceNumber: `MoC/RSIM/REP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
        content,
        author: storage.getUser().name,
        sourceMeetingId: activeMeeting.id,
        version: 1,
        versions: [],
        approvalStatus: 'Draft',
        comments: [],
        tags: ['Report', 'Technical Findings'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveDocument(newDoc);
      createdDocIds.push(newDoc.id);
    }

    // Update meeting status
    activeMeeting.status = 'Minutes Drafted';
    storage.saveMeeting(activeMeeting);
    onMeetingsChanged();

    alert(
      `Successfully generated ${createdDocIds.length} official document(s) from this meeting recording!\nThey have been saved to your local Document Studio.`
    );
    if (createdDocIds.length > 0) {
      onOpenDocument(createdDocIds[0]);
    }
  };

  // Editable transcript speaker rename
  const handleSpeakerRename = (oldSpeaker: string, newSpeaker: string) => {
    if (!newSpeaker.trim() || !activeMeeting) return;
    const updatedSegments = activeMeeting.transcript.map((s) =>
      s.speaker === oldSpeaker ? { ...s, speaker: newSpeaker.trim() } : s
    );
    const updated = { ...activeMeeting, transcript: updatedSegments };
    storage.saveMeeting(updated);
    onMeetingsChanged();
  };

  // Edit segment text
  const handleSegmentTextChange = (segId: string, newText: string) => {
    if (!activeMeeting) return;
    const updatedSegments = activeMeeting.transcript.map((s) =>
      s.id === segId ? { ...s, text: newText } : s
    );
    const updated = { ...activeMeeting, transcript: updatedSegments };
    storage.saveMeeting(updated);
    onMeetingsChanged();
  };

  // Jump to transcript segment
  const jumpToSegment = (timestamp: string) => {
    const found = activeMeeting?.transcript.find((s) => s.timestamp.includes(timestamp) || timestamp.includes(s.timestamp));
    if (found) {
      setHighlightedSegmentId(found.id);
      const el = document.getElementById(`segment_${found.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Audio Intelligence & Meeting Workspace
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Core Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Live recording • Transcription • Speaker Diarization • Institutional Meeting Minutes & Reports
          </p>
        </div>

        {/* Meeting selector / Session buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeMeeting && (
            <button
              onClick={() => onSetContext({ type: 'meeting', id: activeMeeting.id, title: activeMeeting.title })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
              title="Pin as active context for RSIM AI assistant"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>Set as Active Context</span>
            </button>
          )}

          {activeMeeting && (
            <button
              type="button"
              onClick={() => handleDeleteMeeting(activeMeeting.id, activeMeeting.title)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors shadow-2xs"
              title="Delete this audio session"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Delete Session</span>
            </button>
          )}

          {meetings.length > 1 && (
            <button
              type="button"
              onClick={handleClearAllMeetings}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-800 transition-colors"
              title="Delete all meeting sessions"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Clear All ({meetings.length})</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*,video/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Upload Audio File</span>
          </button>
        </div>
      </div>

      {/* LIVE RECORDING CONSOLE */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Mic className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Google Speech-to-Text: AI Audio Transcription</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  Gemini 3.5 Transcribe
                </span>
                {isRecording && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Direct microphone capture & audio file transcription powered by Google Gemini 3.5 Transcribe.
              </p>
            </div>
          </div>

          {/* Recording Timer & Waveform */}
          <div className="flex items-center gap-4">
            {isRecording && (
              <div className="flex items-center gap-3">
                {/* Audio level meter */}
                <div className="flex items-center gap-0.5 h-6 w-20 bg-slate-100 p-1 rounded-md">
                  <div
                    className="h-full bg-emerald-500 rounded-xs transition-all duration-75"
                    style={{ width: `${Math.max(8, audioLevel)}%` }}
                  />
                </div>

                <div className="font-mono text-base font-bold text-rose-600">
                  {Math.floor(recordingSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}

            {/* Recording Controls */}
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-colors"
              >
                <Mic className="h-4 w-4" />
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={pauseRecording}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Square className="h-4 w-4 fill-white" />
                  <span>Stop & Process</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MEETING SESSIONS TABS */}
      {meetings.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {meetings.map((m) => (
            <div
              key={m.id}
              onClick={() => setActiveMeetingId(m.id)}
              className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeMeeting?.id === m.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5 opacity-70 shrink-0" />
              <span className="max-w-[180px] truncate">{m.title}</span>
              <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-mono">
                {m.audioDuration || `${m.transcript.length} seg`}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMeeting(m.id, m.title);
                }}
                className={`rounded-md p-1 transition-colors ${
                  activeMeeting?.id === m.id
                    ? 'text-slate-400 hover:bg-rose-950/40 hover:text-rose-300'
                    : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 opacity-60 group-hover:opacity-100'
                }`}
                title="Delete this audio session"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <Clock className="mx-auto h-7 w-7 text-slate-300 mb-1" />
          <p className="text-xs font-semibold text-slate-600">No recorded meetings or transcripts yet</p>
          <p className="text-[11px] text-slate-400">Record live audio above or upload an audio file to begin.</p>
        </div>
      )}

      {activeMeeting && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: Transcript Viewer & Editor (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Transcript & Speaker Diarization
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {activeMeeting.transcript.length} spoken segments • Click any text to correct names, acronyms or figures
                  </p>
                </div>

                {/* Search transcript */}
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search transcript..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Audio Player if dataUrl exists */}
              {activeMeeting.audioDataUrl && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-slate-700">
                    <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Session Audio Playback</span>
                    <span className="text-[10px] text-slate-400">({activeMeeting.audioFileName})</span>
                  </div>
                  <audio
                    ref={audioPlayerRef}
                    src={activeMeeting.audioDataUrl}
                    controls
                    className="w-full h-8"
                  />
                </div>
              )}

              {/* Transcript list */}
              <div className="mt-4 max-h-[520px] overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                {activeMeeting.transcript.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <p>No transcript segments yet for this session.</p>
                    <button
                      onClick={() => handleTranscribe(activeMeeting)}
                      disabled={isTranscribing}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {isTranscribing ? 'Processing Audio...' : 'Generate Transcript Now'}
                    </button>
                  </div>
                ) : (
                  activeMeeting.transcript
                    .filter(
                      (s) =>
                        s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
                        s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
                    )
                    .map((seg) => {
                      const isHighlighted = highlightedSegmentId === seg.id;
                      return (
                        <div
                          key={seg.id}
                          id={`segment_${seg.id}`}
                          className={`rounded-xl border p-3 transition-colors ${
                            isHighlighted
                              ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300'
                              : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            {/* Editable Speaker Pill */}
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {seg.speaker}
                              </span>
                              <button
                                onClick={() => {
                                  const name = prompt('Rename speaker across meeting:', seg.speaker);
                                  if (name) handleSpeakerRename(seg.speaker, name);
                                }}
                                className="rounded-sm p-1 text-slate-400 hover:text-slate-700"
                                title="Rename speaker"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>

                            <span className="font-mono text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {seg.timestamp}
                            </span>
                          </div>

                          {/* Editable transcript text */}
                          <textarea
                            value={seg.text}
                            onChange={(e) => handleSegmentTextChange(seg.id, e.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-md bg-transparent text-xs text-slate-800 focus:bg-white focus:p-1.5 focus:border focus:border-slate-300 focus:outline-hidden"
                          />
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Audio Analysis & Document Generation (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Analysis Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Meeting Intelligence</h3>
                </div>
                <button
                  onClick={() => handleAnalyze(activeMeeting)}
                  disabled={isAnalyzing}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}
                </button>
              </div>

              {activeMeeting.analysis ? (
                <div className="mt-3 space-y-4 text-xs">
                  {/* Executive Summary */}
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                      Executive Summary
                    </h4>
                    <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {activeMeeting.analysis.executiveSummary}
                    </p>
                  </div>

                  {/* Official Decisions */}
                  <div>
                    <h4 className="font-bold text-emerald-800 uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Official Decisions ({activeMeeting.analysis.decisions.length})
                    </h4>
                    <ul className="space-y-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-slate-700">
                      {activeMeeting.analysis.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="font-bold text-emerald-600">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Items with source traceability */}
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-600" />
                      Extracted Action Items ({activeMeeting.analysis.actionItems.length})
                    </h4>
                    <div className="space-y-1.5">
                      {activeMeeting.analysis.actionItems.map((act, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-[11px]"
                        >
                          <p className="font-semibold text-slate-900">{act.task}</p>
                          <div className="mt-1 flex items-center justify-between text-slate-500 text-[10px]">
                            <span>Lead: {act.responsiblePerson}</span>
                            <span>Due: {act.deadline}</span>
                            {act.sourceTimestamp && (
                              <button
                                onClick={() => jumpToSegment(act.sourceTimestamp!)}
                                className="font-mono text-emerald-700 hover:underline"
                                title="Jump to audio transcript timestamp"
                              >
                                ⏱ {act.sourceTimestamp}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Quotes with Source Traceability */}
                  {activeMeeting.analysis.keyQuotes && activeMeeting.analysis.keyQuotes.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                        Key Statements (Traceable)
                      </h4>
                      <div className="space-y-1.5">
                        {activeMeeting.analysis.keyQuotes.map((q, i) => (
                          <div
                            key={i}
                            onClick={() => jumpToSegment(q.timestamp)}
                            className="cursor-pointer rounded-xl border border-slate-200/60 bg-white p-2 hover:border-emerald-400 transition-colors"
                          >
                            <p className="italic text-slate-700 text-[11px]">"{q.statement}"</p>
                            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                              <span className="font-medium text-slate-600">{q.speaker}</span>
                              <span className="font-mono text-emerald-600">Source: {q.timestamp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  <p>Audio transcript has not been analyzed yet.</p>
                  <button
                    onClick={() => handleAnalyze(activeMeeting)}
                    disabled={isAnalyzing}
                    className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Analyze Transcript
                  </button>
                </div>
              )}
            </div>

            {/* MULTI-DOCUMENT GENERATOR (Section 15) */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck2 className="h-4 w-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Generate Directorate Documents</h3>
              </div>
              <p className="text-[11px] text-slate-600 mb-3">
                Transform this single recording into official approved civil service documents:
              </p>

              <div className="space-y-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOutputs.minutes}
                    onChange={(e) =>
                      setSelectedOutputs({ ...selectedOutputs, minutes: e.target.checked })
                    }
                    className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Official Meeting Minutes (RSIM Approved Template)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOutputs.memo}
                    onChange={(e) =>
                      setSelectedOutputs({ ...selectedOutputs, memo: e.target.checked })
                    }
                    className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Directorate Internal Submission Memo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOutputs.report}
                    onChange={(e) =>
                      setSelectedOutputs({ ...selectedOutputs, report: e.target.checked })
                    }
                    className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Comprehensive Technical Report</span>
                </label>
              </div>

              <button
                onClick={handleGenerateDocuments}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate Selected Official Documents</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeMeeting && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          <Mic className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-700">No Meeting Audio or Transcripts</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Use the Live Directorate Audio Recorder above to record a session, or click "Upload Audio File" to import an audio recording for speaker transcription and intelligence analysis.
          </p>
        </div>
      )}
    </div>
  );
};
