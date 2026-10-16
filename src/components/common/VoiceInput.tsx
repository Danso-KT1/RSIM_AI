import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { aiService } from '../../services/aiService';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  placeholderPrompt?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  placeholderPrompt,
  className = '',
  size = 'md',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startVoiceTyping = async () => {
    setErrorMessage(null);

    // 1. Check browser microphone support
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio volume visualization
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            }
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (err) {
        console.warn('Audio visualization unavailable:', err);
      }

      // Prepare MediaRecorder to capture audio for Gemini 3.5 Transcribe
      audioChunksRef.current = [];
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsTranscribing(true);
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });

        // Convert to base64 and send to Google Gemini 3.5 Transcribe
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.split(';base64,')[1];
            if (base64Data) {
              const res = await aiService.transcribeAudio(
                base64Data,
                mimeType || 'audio/webm',
                placeholderPrompt ||
                  'Transcribe this voice dictation clearly and punctuate naturally for official administrative drafting.'
              );
              if (res.transcript && res.transcript.trim()) {
                onTranscript(res.transcript.trim());
              }
            }
          } catch (transcribeErr: any) {
            console.warn('Gemini audio transcription error:', transcribeErr);
            setErrorMessage('Transcription error. Please try again.');
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(recordedBlob);
        stopTracks();
      };

      recorder.start(500);
      setIsRecording(true);
    } catch (micErr: any) {
      console.error('Microphone error:', micErr);
      setErrorMessage(
        micErr.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow mic access.'
          : 'Could not access microphone.'
      );
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const stopVoiceTyping = () => {
    setIsRecording(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {!isRecording ? (
        <button
          type="button"
          onClick={startVoiceTyping}
          disabled={isTranscribing}
          className={`flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition-colors shadow-2xs ${
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          } ${isTranscribing ? 'opacity-60 cursor-not-allowed' : ''}`}
          title="Google Speech-to-Text: AI voice typing with Gemini 3.5 Transcribe"
        >
          {isTranscribing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
              <span>Transcribing with Gemini 3.5...</span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5 text-emerald-700" />
              <span>Voice Typing</span>
              <span className="hidden sm:inline-block rounded-sm bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800">
                Gemini 3.5
              </span>
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span className="text-[11px] font-bold text-rose-700">Listening...</span>
          </div>

          {/* Level visualizer */}
          <div className="h-3 w-10 bg-rose-200/60 rounded-full overflow-hidden flex items-center px-0.5">
            <div
              className="h-2 bg-rose-600 rounded-full transition-all duration-75"
              style={{ width: `${Math.max(10, audioLevel)}%` }}
            />
          </div>

          <button
            type="button"
            onClick={stopVoiceTyping}
            className="flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700 transition-colors"
          >
            <MicOff className="h-3 w-3" />
            <span>Stop & Transcribe</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <span className="text-[11px] text-rose-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errorMessage}
        </span>
      )}
    </div>
  );
};
