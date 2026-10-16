import React, { useState } from 'react';
import { WifiOff, Wifi, Info, X, CheckCircle2, HardDrive, FileText, Sparkles } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showDetails, setShowDetails] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If online, don't show the warning bar
  if (isOnline) {
    return null;
  }

  if (dismissed) {
    // Show a mini persistent badge in corner so user still knows they are offline
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg hover:bg-amber-700 transition"
        title="Offline Mode Active — Click to expand"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span>Offline Mode</span>
      </button>
    );
  }

  return (
    <>
      {/* Floating Offline Toast / Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 p-3.5 text-white shadow-2xl border border-amber-500/50 backdrop-blur-md animate-in slide-in-from-bottom-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
            <WifiOff className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold leading-tight">Offline Mode Active</p>
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </div>
            <p className="text-[11px] text-amber-100 mt-0.5 leading-snug">
              Local data & document drafting remain fully functional.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowDetails(true)}
            className="rounded-lg bg-white/20 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/30 transition"
          >
            Details
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Offline Capabilities Details Dialog */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 relative">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Local Offline System Active</h3>
                <p className="text-xs text-slate-500">Zero network dependency for stored records</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              RSIM AI stores your documents, templates, meeting records, and settings in your browser storage with service worker caching. You have full access to:
            </p>

            <div className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
              <div className="flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>All Saved Documents:</strong> Read, search, edit, and export letters, memos, minutes, and reports.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Knowledge & Templates:</strong> Access official civil service structures, tone guidelines, and custom templates.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Offline AI Drafter:</strong> The built-in institutional rule-based engine formats complete letters and memos even without internet.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Word & PDF Export:</strong> Generate Microsoft Word (.docx) and printable copies directly on your machine.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Close & Continue Working
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
