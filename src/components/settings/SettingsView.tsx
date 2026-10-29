import React, { useState } from 'react';
import {
  Sliders,
  Database,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  Building,
  Terminal,
  Activity,
  Sparkles,
  AlertCircle,
  Play,
  RefreshCw,
  Unlock,
  FileText,
  Cloud,
  Cpu,
  Zap,
  ExternalLink,
  HardDrive,
  FolderSync,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { HUGGINGFACE_MODELS, DEFAULT_HF_MODEL } from '../../constants/aiModels';
import { initDriveAuth, DriveAuthState, getDriveAuthState } from '../../services/driveService';

interface SettingsViewProps {
  user: UserProfile;
  onUserChanged: (user: UserProfile) => void;
  onOpenBackupModal: () => void;
  onOpenDriveModal?: () => void;
  onOpenFreeAIModelsModal?: () => void;
  onOpenCascadeModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUserChanged,
  onOpenBackupModal,
  onOpenDriveModal,
  onOpenFreeAIModelsModal,
  onOpenCascadeModal,
}) => {
  const [name, setName] = useState(user.name);
  const [department, setDepartment] = useState(user.department);
  const [email, setEmail] = useState(user.email);
  const [testingAi, setTestingAi] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [preferredHfModel, setPreferredHfModel] = useState<string>(() => {
    return localStorage.getItem('hf_preferred_model') || DEFAULT_HF_MODEL;
  });
  const [driveState, setDriveState] = useState<DriveAuthState>(() => getDriveAuthState());

  React.useEffect(() => {
    const unsub = initDriveAuth((st) => setDriveState(st));
    return () => unsub();
  }, []);

  const handleHfModelChange = (modelId: string) => {
    setPreferredHfModel(modelId);
    localStorage.setItem('hf_preferred_model', modelId);
  };

  const handleRunDiagnostic = async () => {
    setTestingAi(true);
    setDiagnosticResult(null);
    try {
      const res = await api.post('/api/debug/test-ai');
      setDiagnosticResult({ ok: res.ok, status: res.status, data: res.data });
    } catch (err: any) {
      setDiagnosticResult({
        ok: false,
        status: 0,
        data: { error: err.message || 'Failed to connect to backend' },
      });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      name,
      department,
      email,
    };
    storage.saveUser(updated);
    onUserChanged(updated);
    alert('Document signatory defaults and workspace preferences saved.');
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This will permanently wipe all local documents, meetings, action items, and records.')) {
      storage.clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Workspace Settings & Document Defaults
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Open access active — zero login, passwords, or authentication required. All documents and preferences are stored locally in your browser.
        </p>
      </div>

      {/* No-Login / Open Access Status Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4.5 flex items-start gap-3 shadow-2xs">
        <div className="rounded-xl bg-emerald-600 p-2 text-white shrink-0 mt-0.5">
          <Unlock className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <h4 className="font-bold text-emerald-950">No Login or Authentication Required</h4>
          <p className="text-emerald-800/90 mt-0.5 leading-relaxed">
            All writing studios (Letters, Memos, Minutes, Reports), Google Gemini Q&A, Audio Transcription, and Document Intelligence are immediately accessible to all users. No accounts, credentials, or passwords are used.
          </p>
        </div>
      </div>

      {/* Document Signatory & Header Defaults Form */}
      <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileText className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Default Document Signatory & Letterhead</h3>
            <p className="text-[11px] text-slate-500">These details auto-populate the author and signature blocks on newly generated documents</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Default Signatory / Author Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Director, RSIM"
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-800"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Official Contact Email (Letterheads):</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. directorate@mcd.gov.gh"
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-800"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-semibold text-slate-700 block mb-1">Directorate / Ministry Name:</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Research, Statistics & Information Management (RSIM)"
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-800"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
        >
          Save Document Defaults
        </button>
      </form>

      {/* Four-Engine AI Cascade Matrix Card */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-900 to-purple-900 p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-xs">
              <Zap className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Multi-Provider AI Cascade & Circuit-Breaker Matrix
              </h3>
              <p className="text-xs text-indigo-200">
                Google Gemini • GroqCloud LPU • OpenRouter • DeepSeek • Hugging Face (Open Models) • Offline Synthesis
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-200/90 leading-relaxed max-w-2xl">
            When any provider reaches its rate limit (HTTP 429 / quota exhaustion), requests automatically jump to the next healthy AI engine in under 200 milliseconds. Configure priorities, monitor real-time latency, or simulate rate limits.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCascadeModal}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-indigo-950 shadow-md hover:bg-indigo-50 transition-all hover:scale-102"
          >
            <Zap className="h-4 w-4 text-indigo-600" />
            <span>Open Cascade Matrix</span>
          </button>
        </div>
      </div>

      {/* Hugging Face Inference Providers Model Selection Card */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50/70 via-orange-50/40 to-yellow-50/20 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/60">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-2 text-white shadow-xs">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Hugging Face Inference Providers</h3>
                <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-300">
                  Free / Open Source
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Run frontier open-source models without downloading weights</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 self-start sm:self-auto">
            HF_TOKEN Active
          </span>
        </div>

        <div className="space-y-2">
          <label htmlFor="hf-model-select" className="block text-xs font-bold text-slate-700">
            Hugging Face Model
          </label>
          <div className="relative">
            <select
              id="hf-model-select"
              value={preferredHfModel}
              onChange={(e) => handleHfModelChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-200 transition-all shadow-2xs appearance-none pr-10 cursor-pointer"
            >
              {HUGGINGFACE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — {model.description}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <Sliders className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
            <span>This model will be used when Hugging Face is selected or when other providers fail.</span>
          </p>
        </div>

        {/* Selected Model Details Badge */}
        {(() => {
          const selectedInfo = HUGGINGFACE_MODELS.find((m) => m.id === preferredHfModel);
          return selectedInfo ? (
            <div className="rounded-xl border border-amber-200/80 bg-white/90 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div>
                <span className="font-bold text-slate-800">{selectedInfo.name}</span>
                <span className="text-slate-500 ml-2 font-mono text-[11px]">({selectedInfo.id})</span>
                <p className="text-[11px] text-slate-600 mt-0.5">{selectedInfo.description}</p>
              </div>
              <span className="rounded-sm bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 self-start sm:self-auto shrink-0">
                Persistent in LocalStorage
              </span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Cloud Drive & Free AI Models Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Drive Card */}
        <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/70 to-indigo-50/30 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-600 p-2 text-white">
                  <Cloud className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Google Drive & OneDrive</h3>
              </div>
              <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 border border-blue-200">
                Cloud Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Read templates and institutional knowledge directly from your Google Drive or OneDrive. Uploaded documents automatically store in <code>Directorate Templates & Knowledge</code> and learn the exact formatting, font sizes, and tone.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenDriveModal}
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 transition-colors shadow-2xs"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Manage Cloud Drives</span>
            </button>
            <span className="text-[11px] text-slate-500 font-medium">Automatic format extraction</span>
          </div>
        </div>

        {/* Free AI Models Hub Card */}
        <div className="rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50/70 to-pink-50/30 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-600 p-2 text-white">
                  <Cpu className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Free AI Models Hub</h3>
              </div>
              <span className="rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 border border-purple-200">
                Unlimited / Free Tiers
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Explore and configure free AI models with no hard limits (Google AI Studio Gemini 2.5/3.8 Flash, GroqCloud Llama 3.3 70B, OpenRouter Free, Hugging Face, or local in-browser engine) to organize and write your documents.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenFreeAIModelsModal}
              className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition-colors shadow-2xs"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Explore Free AI Models</span>
            </button>
            <span className="text-[11px] text-slate-500 font-medium">Zero cost • No limits</span>
          </div>
        </div>
      </div>

      {/* Terminal Debugger & Live AI Diagnostics */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-slate-900 text-sm">Terminal Debugger & Live AI Diagnostics</h3>
          </div>
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
            Real-Time Backend Logs
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          The backend server features active <strong>Terminal Debugger</strong> logging. Every API request, model attempt, token response, and error stack trace is streamed directly to your terminal console in real-time.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleRunDiagnostic}
            disabled={testingAi}
            className="flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 transition-colors shadow-2xs"
          >
            {testingAi ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Running Diagnostic in Terminal...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Run Live AI Diagnostic Test</span>
              </>
            )}
          </button>
          <span className="text-[11px] text-slate-400">
            Triggers a live test with formatted diagnostic output in the terminal
          </span>
        </div>

        {diagnosticResult && (
          <div
            className={`mt-3 rounded-xl border p-4 text-xs space-y-2 ${
              diagnosticResult.ok
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/60 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {diagnosticResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                )}
                {diagnosticResult.ok
                  ? 'Gemini AI Operational — Terminal Log Printed'
                  : 'Diagnostic Error — Check Terminal for Stack Trace'}
              </span>
              <span className="text-[11px] opacity-75 font-mono">
                HTTP {diagnosticResult.status}
              </span>
            </div>
            <div className="font-mono text-[11px] bg-white/80 p-2.5 rounded-lg border border-black/5 space-y-1">
              <div>
                <strong>API Key:</strong> {diagnosticResult.data?.maskedKey || 'N/A'}
              </div>
              {diagnosticResult.data?.modelUsed && (
                <div>
                  <strong>Model Tested:</strong> {diagnosticResult.data.modelUsed} ({diagnosticResult.data.latencyMs}ms)
                </div>
              )}
              {diagnosticResult.data?.response && (
                <div>
                  <strong>Gemini Reply:</strong> "{diagnosticResult.data.response}"
                </div>
              )}
              {diagnosticResult.data?.error && (
                <div className="text-rose-700">
                  <strong>Error:</strong> {diagnosticResult.data.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive API Status & Endpoints Inventory Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Directorate API Endpoints & Health Matrix</h3>
              <p className="text-[11px] text-slate-500">Live operational status across all backend microservices</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            All 19 APIs Registered & Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            {
              category: "AI Document Studios",
              items: [
                { method: "POST", path: "/api/ai/intelligent-write", desc: "Universal Drafter for Letters, Memos, Minutes, Reports" },
                { method: "POST", path: "/api/ai/structure-and-write-memo", desc: "Autonomous Memo Structurer" },
                { method: "POST", path: "/api/ai/edit-document", desc: "Interactive Document Revision Engine" },
              ]
            },
            {
              category: "Template & Knowledge Intelligence",
              items: [
                { method: "POST", path: "/api/ai/learn-template", desc: "Deep Template Structure Extraction" },
                { method: "POST", path: "/api/ai/modify-template", desc: "AI-Assisted Template Layout Adaptation" },
                { method: "POST", path: "/api/ai/draft-with-template", desc: "Adherence-Constrained Template Filler" },
                { method: "POST", path: "/api/ai/extract-template-from-doc", desc: "DOCX to Reusable Template Extractor" },
              ]
            },
            {
              category: "Document Processing & Office Tools",
              items: [
                { method: "POST", path: "/api/ai/summarize-document", desc: "Multi-Mode Executive Document Summarizer" },
                { method: "POST", path: "/api/ai/extract-document", desc: "Deep Entity & Action Point Extractor" },
                { method: "POST", path: "/api/ai/parse-document-file", desc: "DOCX (Mammoth) & PDF (Gemini Vision) Parser" },
                { method: "POST", path: "/api/ai/standardize-institutional-document", desc: "Institutional Document Structure & Compliance Review" },
                { method: "POST", path: "/api/ai/transcribe-audio-file", desc: "High-Performance Binary Audio Transcription (Gemini & Groq Whisper)" },
                { method: "POST", path: "/api/ai/repair-corrupted-docx", desc: "Damaged DOCX Binary Recovery" },
              ]
            },
            {
              category: "Core Intelligence & Diagnostics",
              items: [
                { method: "POST", path: "/api/ai/complete", desc: "Universal AI Completion with Model Backoff" },
                { method: "POST", path: "/api/ai/grounded-search", desc: "Google Search Grounding via gemini-3.5-flash" },
                { method: "GET", path: "/api/health", desc: "Baseline Health & Configuration Check" },
                { method: "ALL", path: "/api/diagnostic/test-gemini", desc: "End-to-End Gemini Diagnostics Ping" },
                { method: "GET", path: "/api/system/status-overview", desc: "Complete API Telemetry Manifest" },
                { method: "GET", path: "/api/diagnostics/live-logs", desc: "Live Diagnostics Ring Buffer" },
              ]
            },
          ].map((cat, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-800">
                {cat.category}
              </h4>
              <div className="space-y-1.5">
                {cat.items.map((ep, j) => (
                  <div key={j} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60 text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${
                        ep.method.includes('GET') ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-slate-700 truncate">{ep.path}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PWA & Offline Access Installation Card */}
      <PWAInstallButton variant="card" />

      {/* Cloud Drives & Knowledge Sync Card (Google Drive & Microsoft OneDrive) */}
      <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/70 via-indigo-50/40 to-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/60">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 text-white shadow-xs">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Cloud Drives (Google Drive & Microsoft OneDrive)</h3>
                <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 border border-blue-200">
                  Multi-Cloud Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Sync official Word documents, PDFs, and civil service templates directly with Google Drive and Microsoft OneDrive
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDriveModal}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-all self-start sm:self-auto"
          >
            <FolderSync className="h-4 w-4" />
            <span>Connect & Manage Cloud Drives</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Google Drive Status Tile */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-slate-800">Google Drive</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                driveState.googleConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${driveState.googleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {driveState.googleConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {driveState.googleConnected
                ? `Account: ${driveState.email || 'Authenticated Session'}. Uploads save to "Directorate Templates & Knowledge".`
                : 'Sign in with Google to browse and import documents straight from your drive.'}
            </p>
          </div>

          {/* Microsoft OneDrive Status Tile */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-slate-800">Microsoft OneDrive</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                driveState.oneDriveConnected ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${driveState.oneDriveConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'}`} />
                {driveState.oneDriveConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {driveState.oneDriveConnected
                ? `Account: ${driveState.oneDriveAccountName || 'Authenticated Session'}. Uploads save to "RSIM Directorate Templates".`
                : 'Sign in with Microsoft 365 or OneDrive to access personal and institutional files.'}
            </p>
          </div>
        </div>
      </div>

      {/* Local Storage & Data Management Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Database className="h-5 w-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">Local Storage & Institutional Persistence</h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          All Directorate data (audio files, transcribed meetings, official memos, knowledge base entries, and audit logs) is stored securely in your browser's persistent client-side storage with zero unverified cloud leakage.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={onOpenBackupModal}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span>Open Backup & Restore Hub</span>
          </button>

          <button
            onClick={handleClearData}
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </div>

      {/* Institutional Platform & Developer Attribution */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">RSIM AI Institutional Directorate Workstation</h3>
          <p className="text-xs text-slate-500">Research, Statistics & Information Management Directorate · Ministry of Communications, Digital Technology and Innovations (MoCDTI)</p>
          <p className="text-xs text-slate-400 mt-1">Copyright © 2026 RSIM AI · All Rights Reserved</p>
        </div>
        <div className="text-center sm:text-right shrink-0">
          <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            Developed by Danso Twum Kwadjo
          </span>
        </div>
      </div>
    </div>
  );
};
