import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  Zap,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  Infinity as InfinityIcon,
  Server,
  X,
  Sliders,
  Check,
} from 'lucide-react';
import { FreeAIModelInfo } from '../../types';
import { api } from '../../services/api';

interface FreeAIModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelId?: string;
  onSelectModel?: (modelId: string) => void;
}

export const FreeAIModelsModal: React.FC<FreeAIModelsModalProps> = ({
  isOpen,
  onClose,
  activeModelId = 'gemini-3.8-flash',
  onSelectModel,
}) => {
  const [models, setModels] = useState<FreeAIModelInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>(activeModelId);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/api/ai/free-models');
        if (res.ok && res.data?.models) {
          setModels(res.data.models);
        }
      } catch (err) {
        console.warn('Failed to load free models list:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchModels();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('rsim_active_free_ai_model', id);
    if (onSelectModel) {
      onSelectModel(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-2xs">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Free AI Models Directory (Generous & Unlimited Tiers)</h2>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                  Document Writing & Organizing
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Researched free models and open-source APIs with no or high rate limits to organize, synthesize, and write institutional documents.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-900 space-y-1">
                <p className="font-bold">Multi-Provider Intelligence Architecture (GPT Prioritized First)</p>
                <p>
                  All models from OpenRouter use your <strong>OpenRouter API key</strong>, prioritized by intelligence & abilities: <strong>GPT models first</strong> (GPT-4o & GPT-OSS 120B for strict instruction adherence and executive tone), <strong>Perplexity Sonar</strong> (search-grounded reasoning & factual citations), <strong>NVIDIA Nemotron 3 Ultra</strong> (massive 1M token context to ingest all your Google Drive templates), and <strong>MiniMax-01</strong> (4M ultra-context). Both <strong>Google Gemini 3.8 and Gemini 2.5</strong> use your <strong>Google API key</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((m) => {
              const isSelected = selectedId === m.id;
              const isUnlimited = m.tierLimit.includes('UNLIMITED');

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`group relative rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/20 ring-2 ring-purple-600/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{m.name}</span>
                          {isUnlimited && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                              <InfinityIcon className="h-2.5 w-2.5" />
                              Unlimited
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/60 rounded px-1.5 py-0.5 mt-1 inline-block">
                          {m.provider}
                        </span>
                      </div>

                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-600 text-white'
                            : 'border-slate-300 bg-white group-hover:border-slate-400'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-2.5 line-clamp-2">{m.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Allowance / Limit:</span>
                      <span className="font-bold text-slate-800">{m.tierLimit}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Context Window:</span>
                      <span className="font-mono text-slate-700">{m.contextWindow}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Speed:</span>
                      <span className="font-medium text-emerald-700">{m.speed}</span>
                    </div>

                    {m.keyUrl && (
                      <div className="pt-1 flex justify-end">
                        <a
                          href={m.keyUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 hover:underline"
                        >
                          <span>Get Free API Key</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Selected Model: <strong className="text-slate-900">{models.find((m) => m.id === selectedId)?.name || 'Google Gemini'}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-2xs"
          >
            Apply Active Model
          </button>
        </div>
      </div>
    </div>
  );
};
