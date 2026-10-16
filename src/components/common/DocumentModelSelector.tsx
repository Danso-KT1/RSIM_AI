import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Cpu } from 'lucide-react';

export interface DocumentModelOption {
  id: string;
  name: string;
  provider: 'Google' | 'Groq' | 'Hugging Face' | 'OpenAI';
  tag: string;
  badge?: string;
  isDefault?: boolean;
}

export const DOCUMENT_WRITING_MODELS: DocumentModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'RSIM Gemini 3.8 Flash',
    provider: 'Google',
    tag: 'Fast official civil service drafting with search grounding',
    badge: 'Default',
    isDefault: true,
  },
  {
    id: 'groq/llama-3.3-70b',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'Groq',
    tag: 'Ultra-Fast 500 tok/s formal institutional writing',
    badge: 'Ultra Fast',
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Hugging Face',
    tag: 'Strong general writing & authoritative documents',
    badge: 'Hugging Face',
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    provider: 'Hugging Face',
    tag: 'Excellent at structured output (minutes, letters, reports)',
    badge: 'Hugging Face',
  },
  {
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    name: 'Llama 3.1 8B (Fast)',
    provider: 'Hugging Face',
    tag: 'Faster & lightweight token consumption',
    badge: 'Fast',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tag: 'Deep analytical synthesis & frontier logic',
    badge: 'Frontier Logic',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (OpenAI)',
    provider: 'OpenAI',
    tag: 'Flagship executive intelligence & synthesis',
    badge: 'Flagship',
  },
];
// NOTE: DeepSeek models (deepseek-chat, deepseek-reasoner, deepseek-r1) are strictly EXCLUDED as requested by user.

interface DocumentModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  className?: string;
  disabled?: boolean;
}

export const DocumentModelSelector: React.FC<DocumentModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = DOCUMENT_WRITING_MODELS.find((m) => m.id === selectedModel) || DOCUMENT_WRITING_MODELS[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
        title="Choose AI model for drafting (Gemini 3.8, Llama 3.3 70B, Qwen 2.5)"
      >
        <Cpu className="h-3.5 w-3.5 text-indigo-600" />
        <span className="truncate max-w-[150px] sm:max-w-[180px]">{current.name}</span>
        {current.isDefault && (
          <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-100">
            Default
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto z-40 mt-1.5 w-76 sm:w-84 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in">
          <div className="px-2 py-1 border-b border-slate-100 pb-1.5 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Select AI Model for Document Drafting
            </span>
            <p className="text-[11px] text-slate-500">
              Gemini 3.8 Flash is default. Llama 3.3 70B and Qwen are available.
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {DOCUMENT_WRITING_MODELS.map((model) => {
              const isSelected = model.id === current.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(model.id);
                    localStorage.setItem('doc_writing_preferred_model', model.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-start justify-between rounded-lg p-2 text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold">{model.name}</span>
                      <span className="rounded px-1.5 py-0.2 text-[9px] font-medium bg-slate-100 text-slate-600">
                        {model.provider}
                      </span>
                      {model.isDefault && (
                        <span className="rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {model.tag}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
