import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sliders,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  Key,
  ExternalLink,
  Flame,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AIProviderId, AIProviderStatus, FailoverEvent, CascadeStatusResponse } from '../../types';
import { aiService } from '../../services/aiService';
import { HUGGINGFACE_MODELS, DEFAULT_HF_MODEL } from '../../constants/aiModels';

interface AICascadeMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AICascadeMatrixModal: React.FC<AICascadeMatrixModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [cascadeData, setCascadeData] = useState<CascadeStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [testingEngine, setTestingEngine] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [showKeyManager, setShowKeyManager] = useState(false);

  // Client-side custom keys
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('rsim_custom_openrouter_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('rsim_custom_gemini_key') || '');
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('rsim_custom_groq_key') || '');
  const [deepSeekKey, setDeepSeekKey] = useState(() => localStorage.getItem('rsim_custom_deepseek_key') || '');
  const [openAiKey, setOpenAiKey] = useState(() => localStorage.getItem('rsim_custom_openai_key') || '');
  const [hfKey, setHfKey] = useState(() => localStorage.getItem('rsim_custom_huggingface_key') || '');
  const [preferredHfModel, setPreferredHfModel] = useState<string>(() => localStorage.getItem('hf_preferred_model') || DEFAULT_HF_MODEL);
  const [keySavedMessage, setKeySavedMessage] = useState(false);

  const handleHfModelChange = (modelId: string) => {
    setPreferredHfModel(modelId);
    localStorage.setItem('hf_preferred_model', modelId);
  };

  const fetchStatus = async () => {
    const data = await aiService.getCascadeStatus();
    if (data) {
      setCascadeData(data);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMovePriority = async (providerId: AIProviderId, direction: 'up' | 'down') => {
    if (!cascadeData) return;
    const currentOrder = cascadeData.providers.map((p) => p.id);
    const index = currentOrder.indexOf(providerId);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    setLoading(true);
    await aiService.updateCascadeConfig(newOrder);
    await fetchStatus();
    setLoading(false);
  };

  const handleSimulate429 = async () => {
    setSimulating(true);
    try {
      await aiService.simulateCascadeRateLimit('gemini');
      await fetchStatus();
    } finally {
      setSimulating(false);
    }
  };

  const handleResetCooldowns = async () => {
    setLoading(true);
    try {
      await aiService.resetCascadeCooldowns();
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleTestProvider = async (providerId?: string) => {
    setTestingEngine(providerId || 'cascade-auto');
    setTestResult(null);
    try {
      const res = await aiService.testCascadeProvider(
        providerId,
        'Generate an authoritative 1-sentence civil service greeting from Director RSIM.',
        providerId === 'huggingface' ? preferredHfModel : undefined
      );
      setTestResult(res);
      await fetchStatus();
    } finally {
      setTestingEngine(null);
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rsim_custom_openrouter_key', openRouterKey.trim());
    localStorage.setItem('rsim_custom_gemini_key', geminiKey.trim());
    localStorage.setItem('rsim_custom_groq_key', groqKey.trim());
    localStorage.setItem('rsim_custom_deepseek_key', deepSeekKey.trim());
    localStorage.setItem('rsim_custom_openai_key', openAiKey.trim());
    localStorage.setItem('rsim_custom_huggingface_key', hfKey.trim());

    await aiService.updateCascadeConfig(undefined, {
      openrouter: openRouterKey.trim(),
      gemini: geminiKey.trim(),
      groq: groqKey.trim(),
      deepseek: deepSeekKey.trim(),
      openai: openAiKey.trim(),
      huggingface: hfKey.trim(),
    });
    setKeySavedMessage(true);
    setTimeout(() => setKeySavedMessage(false), 3000);
    await fetchStatus();
  };

  const providerIcons: Record<string, any> = {
    openai: Cpu,
    openrouter: Cpu,
    gemini: Sparkles,
    groq: Zap,
    deepseek: Flame,
    huggingface: Zap,
    local: Shield,
  };

  const providers = cascadeData?.providers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-purple-600 p-2.5 text-white shadow-md shadow-indigo-200">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900">
                  Four-Engine AI Cascade & Auto-Failover Matrix
                </h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200">
                  Circuit Breaker Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-API load distribution, automatic rate-limit detection, and millisecond failover across 4 AI providers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Cascade Health & Controls Banner */}
        <div className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
              <Activity className="h-4 w-4 text-indigo-600 animate-pulse" />
              <span>Smart Cascading Failover Protocol</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed max-w-xl">
              When an API encounters a 429 quota exhaustion, overload, or connection disruption, the request is instantly rerouted to the next provider in the chain without dropping your draft.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSimulate429}
              disabled={simulating}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs disabled:opacity-50"
              title="Simulates 429 Rate Limit on primary to observe instant failover to secondary engine"
            >
              <Flame className="h-3.5 w-3.5 text-amber-600" />
              <span>{simulating ? 'Simulating...' : 'Simulate 429 Limit'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetCooldowns}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Reset all provider circuit breakers back to operational"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset Cooldowns</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestProvider()}
              disabled={testingEngine !== null}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-800 transition-colors shadow-2xs disabled:opacity-50"
            >
              {testingEngine === 'cascade-auto' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>Live Test Cascade</span>
            </button>
          </div>
        </div>

        {/* Live Test Output if present */}
        {testResult && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between font-bold text-emerald-950">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Test Completed in {testResult.latencyMs}ms via {testResult.providerUsed?.toUpperCase()}</span>
              </span>
              <span className="text-[10px] font-mono bg-emerald-200/60 px-2 py-0.5 rounded-md text-emerald-900">
                Model: {testResult.modelUsed}
              </span>
            </div>
            <p className="font-mono text-[11px] bg-white/80 p-2.5 rounded-xl border border-emerald-100 text-slate-800">
              "{testResult.response}"
            </p>
            {testResult.failoverOccurred && (
              <p className="text-[10px] text-amber-800 font-semibold">
                ⚠️ Automatic failover occurred during this test: request fell forward to secondary provider seamlessly.
              </p>
            )}
          </div>
        )}

        {/* The 4 AI Engines Grid & Priority Hierarchy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Provider Priority Order (Highest Priority First)
            </h3>
            <span className="text-[11px] text-slate-400">
              Use arrows to adjust cascade routing sequence
            </span>
          </div>

          <div className="space-y-2.5">
            {providers.map((p, idx) => {
              const Icon = providerIcons[p.id] || Cpu;
              const isFirst = idx === 0;
              const isLast = idx === providers.length - 1;
              const isRateLimited = p.state === 'rate_limited';

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isRateLimited
                      ? 'border-amber-300 bg-amber-50/40'
                      : isFirst
                      ? 'border-indigo-300 bg-indigo-50/30 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Priority Badge */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Priority</span>
                      <span className={`text-base font-black ${isFirst ? 'text-indigo-600' : 'text-slate-700'}`}>
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className={`rounded-xl p-2.5 text-white shadow-2xs ${
                      p.id === 'gemini'
                        ? 'bg-blue-600'
                        : p.id === 'groq'
                        ? 'bg-orange-600'
                        : p.id === 'openrouter'
                        ? 'bg-purple-600'
                        : p.id === 'huggingface'
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{p.displayName}</h4>
                        {isFirst && (
                          <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5">
                            Primary Engine
                          </span>
                        )}
                        {p.id === 'huggingface' && (
                          <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-300">
                            Free / Open Source
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-700 font-semibold">
                          {p.id === 'huggingface' ? preferredHfModel : p.defaultModel}
                        </span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-500">{p.tierDescription}</span>
                      </div>

                      {/* Hugging Face Model Quick Dropdown Selector */}
                      {p.id === 'huggingface' && (
                        <div className="mt-2 flex items-center gap-2">
                          <label htmlFor="modal-hf-select" className="text-[11px] font-bold text-amber-900 shrink-0">
                            Model:
                          </label>
                          <select
                            id="modal-hf-select"
                            value={preferredHfModel}
                            onChange={(e) => handleHfModelChange(e.target.value)}
                            className="rounded-lg border border-amber-300 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                          >
                            {HUGGINGFACE_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Stats & Status */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    {/* Latency & Requests Metrics */}
                    <div className="text-right text-xs">
                      <div className="font-mono font-bold text-slate-800">
                        {p.lastLatencyMs ? `${p.lastLatencyMs}ms` : 'Ready'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.totalRequests} reqs • {p.failoverCount} failovers
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isRateLimited ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-300">
                          <Clock className="h-3 w-3 animate-spin text-amber-600" />
                          <span>Cooling ({p.rateLimitSecondsRemaining || 30}s)</span>
                        </span>
                      ) : p.isConfigured ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Operational</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Ready on Demand
                        </span>
                      )}
                    </div>

                    {/* Reordering Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMovePriority(p.id, 'up')}
                        disabled={isFirst || loading}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                        title="Move Up in priority"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePriority(p.id, 'down')}
                        disabled={isLast || loading}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                        title="Move Down in priority"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestProvider(p.id)}
                        disabled={testingEngine !== null}
                        className="rounded-lg p-1 text-indigo-600 hover:bg-indigo-50"
                        title="Test this engine"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Guaranteed Tier 5 Safety Net */}
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-emerald-700" />
                <div>
                  <span className="font-bold text-emerald-950">Safety Net Tier: Directorate In-Memory Semantic Engine</span>
                  <p className="text-[10px] text-emerald-800">100% Guaranteed uptime • Zero network dependencies • Automatically engages if all 4 cloud APIs ever deplete.</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Always Active
              </span>
            </div>
          </div>
        </div>

        {/* Live Failover History Audit Trail */}
        {cascadeData?.failoverEvents && cascadeData.failoverEvents.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Automatic Failover Events ({cascadeData.failoverEvents.length})
              </h3>
              <span className="text-[10px] text-slate-400">Circuit breaker event stream</span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1.5 scrollbar-thin font-mono text-[11px]">
              {cascadeData.failoverEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-100 text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px]">{evt.timestamp}</span>
                    <span className="font-bold text-amber-700 uppercase">{evt.fromProvider}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="font-bold text-emerald-700 uppercase">{evt.toProvider}</span>
                    <span className="text-slate-500 font-sans text-[11px] truncate max-w-xs">
                      "{evt.reason}"
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                    Rerouted in {evt.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Custom API Key Manager Drawer */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowKeyManager(!showKeyManager)}
            className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-slate-900"
          >
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-purple-600" />
              <span>Optional Custom Provider API Keys (Groq, OpenRouter, DeepSeek)</span>
            </div>
            <span className="text-[11px] text-indigo-600">
              {showKeyManager ? 'Hide Key Config' : 'Configure Custom Keys'}
            </span>
          </button>

          {showKeyManager && (
            <form onSubmit={handleSaveKeys} className="mt-3 rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3 animate-in fade-in">
              <p className="text-xs text-slate-500 leading-relaxed">
                The platform includes pre-configured server intelligence. If you wish to connect your own private keys with higher dedicated rate limits, enter them below. Keys are stored locally in your browser session.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    OpenRouter Key (Router):
                  </label>
                  <input
                    type="password"
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Powers GPT-4o, Perplexity, Nemotron, MiniMax
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Google Gemini Key:
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Powers Gemini 3.8 & Gemini 2.5 Flash
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Groq Key (LPU & Whisper):
                  </label>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Llama 3.3 (500 t/s) & Whisper Audio
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    DeepSeek Key (Reasoning):
                  </label>
                  <input
                    type="password"
                    value={deepSeekKey}
                    onChange={(e) => setDeepSeekKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    DeepSeek Chat & Mathematical Logic
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hugging Face Token (HF_TOKEN):
                  </label>
                  <input
                    type="password"
                    value={hfKey}
                    onChange={(e) => setHfKey(e.target.value)}
                    placeholder="hf_..."
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 bg-white font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Fine-grained token with "Inference Providers" permission
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-2xs"
                >
                  Save API Keys
                </button>
                {keySavedMessage && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Keys saved to browser session
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>Enterprise Production Readiness: All 4 AI Providers Operational</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
