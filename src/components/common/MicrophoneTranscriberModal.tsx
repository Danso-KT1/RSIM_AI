import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { aiService } from '../../services/aiService';

interface MicrophoneTranscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  title?: string;
  contextHint?: string;
}

export const MicrophoneTranscriberModal: React.FC<MicrophoneTranscriberModalProps> = ({
  isOpen,
  onClose,
  onTranscriptionComplete,
  title = 'Voice Dictation & Transcription',
  contextHint = 'Speak clearly into your microphone. Gemini 3.5 Transcribe will convert your speech to text.',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const animationFrameRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      startRecording();
    } else {
      stopRecordingAndCleanUp();
    }

    return () => {
      stopRecordingAndCleanUp();
    };
  }, [isOpen]);

  const stopRecordingAndCleanUp = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setAudioLevel(0);
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio Analyzer for dynamic waveform pulse
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioMeter = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateAudioMeter);
          };
          updateAudioMeter();
        }
      } catch (audioErr) {
        console.warn('Audio analyzer not supported:', audioErr);
      }

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const rawMime = recorder.mimeType || 'audio/webm';
        const cleanMime = rawMime.split(';')[0].trim();
        const audioBlob = new Blob(audioChunksRef.current, { type: cleanMime });

        if (audioBlob.size < 1000) {
          setErrorMessage('Audio clip was too short or empty. Please speak for at least 1-2 seconds.');
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const response = await aiService.transcribeAudio(
              base64Data,
              cleanMime,
              'Transcribe this voice recording clearly and verbatim. Keep all proper nouns, figures, and technical terms accurate.',
              'voice_memo.webm'
            );

            if (response.success && response.transcript && response.transcript.trim()) {
              onTranscriptionComplete(response.transcript.trim());
              onClose();
            } else {
              setErrorMessage(response.error || 'Transcription did not detect clear speech. Please speak closer to the microphone.');
            }
          } catch (err: any) {
            setErrorMessage(`Transcription failed: ${err.message || 'Please check server connection'}`);
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        `Could not access microphone: ${err.message || 'Permission denied'}. Please check your browser microphone permissions.`
      );
      setIsRecording(false);
    }
  };

  const handleStopAndTranscribe = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
              <p className="text-xs text-slate-500">Powered by Google gemini-3.5-transcribe</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopRecordingAndCleanUp();
              onClose();
            }}
            disabled={isTranscribing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 text-center">
          {isTranscribing ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-200">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 text-white rounded-full">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-base">Transcribing Audio...</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Processing via <span className="font-mono text-emerald-700">gemini-3.5-transcribe</span>
                </p>
              </div>
            </div>
          ) : isRecording ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-6">
              {/* Mic Icon with Audio Level Ripple */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-28 h-28 rounded-full bg-emerald-500/20 transition-transform duration-75"
                  style={{
                    transform: `scale(${1 + (audioLevel / 100) * 0.4})`,
                  }}
                />
                <div
                  className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping opacity-75"
                />
                <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <Mic className="w-9 h-9 animate-pulse" />
                </div>
              </div>

              {/* Timer & Level */}
              <div>
                <div className="font-mono text-3xl font-bold tracking-tight text-slate-800">
                  {formatSeconds(recordingSeconds)}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Recording Live Voice
                  </span>
                </div>
              </div>

              {/* Live Volume Meter Bar */}
              <div className="w-48 bg-slate-100 rounded-full h-2 overflow-hidden flex items-center p-0.5">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-75"
                  style={{ width: `${Math.max(5, audioLevel)}%` }}
                />
              </div>

              <p className="text-xs text-slate-500 max-w-xs">{contextHint}</p>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <Mic className="w-8 h-8" />
              </div>
              <p className="text-sm text-slate-600 font-medium">Ready to record speech</p>
              <button
                onClick={startRecording}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-left flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <div>
                <p className="font-medium">{errorMessage}</p>
                <button
                  onClick={startRecording}
                  className="mt-1.5 text-xs underline font-semibold hover:text-red-800"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopRecordingAndCleanUp();
              onClose();
            }}
            disabled={isTranscribing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {isRecording && (
            <button
              type="button"
              onClick={handleStopAndTranscribe}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-colors animate-pulse"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop & Transcribe with Gemini 3.5
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
