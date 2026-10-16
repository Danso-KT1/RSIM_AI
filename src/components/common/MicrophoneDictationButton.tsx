import React, { useState } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { MicrophoneTranscriberModal } from './MicrophoneTranscriberModal';

interface MicrophoneDictationButtonProps {
  onTranscribed: (text: string) => void;
  title?: string;
  contextHint?: string;
  className?: string;
  buttonLabel?: string;
  variant?: 'icon' | 'badge' | 'button';
}

export const MicrophoneDictationButton: React.FC<MicrophoneDictationButtonProps> = ({
  onTranscribed,
  title = 'Record & Transcribe with Gemini 3.5',
  contextHint = 'Speak into your microphone to dictate notes, instructions, or queries.',
  className = '',
  buttonLabel = 'Voice Dictate',
  variant = 'icon',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {variant === 'icon' && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Dictate with microphone (gemini-3.5-transcribe)"
          className={`p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200 group relative ${className}`}
        >
          <Mic className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      )}

      {variant === 'badge' && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Dictate with microphone (gemini-3.5-transcribe)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs ${className}`}
        >
          <Mic className="w-3.5 h-3.5 text-emerald-600" />
          <span>{buttonLabel}</span>
          <span className="text-[10px] text-emerald-600/80 font-mono">3.5</span>
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors hover:text-emerald-700 hover:border-emerald-300 ${className}`}
        >
          <Mic className="w-3.5 h-3.5 text-emerald-600" />
          <span>{buttonLabel}</span>
        </button>
      )}

      <MicrophoneTranscriberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTranscriptionComplete={onTranscribed}
        title={title}
        contextHint={contextHint}
      />
    </>
  );
};
