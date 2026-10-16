import React, { useState, useRef } from 'react';
import {
  DatabaseBackup,
  Download,
  Upload,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  HardDrive,
} from 'lucide-react';
import { storage } from '../../services/storage';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const meetings = storage.getMeetings();
  const documents = storage.getDocuments();
  const knowledge = storage.getKnowledge();
  const extractedCount = documents.filter((d) => d.extractedData).length;
  const actions = storage.getActionItems();
  const logs = storage.getAuditLogs();

  // Export JSON
  const handleExport = () => {
    try {
      const dataStr = storage.exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RSIM_AI_Institutional_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        message: 'Institutional database successfully exported to JSON backup file.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Export failed: ${err.message}` });
    }
  };

  // Import JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = storage.importAllData(text);
        if (result.success) {
          setFeedback({ type: 'success', message: result.message });
          onDataChanged();
        } else {
          setFeedback({ type: 'error', message: result.message });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: `Failed to parse file: ${err.message}` });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Error reading selected file.' });
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  // Clear Data
  const handleReset = () => {
    if (
      window.confirm(
        'Are you sure you want to clear all data? All documents, meetings, action items, and knowledge entries will be completely emptied.'
      )
    ) {
      storage.clearAllData();
      setFeedback({
        type: 'success',
        message: 'System database successfully cleared.',
      });
      onDataChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Local Storage & Institutional Data Backup</h3>
              <p className="text-xs text-slate-500">
                Data persistence, portable JSON snapshots & baseline reset
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Storage Statistics */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-xs font-semibold text-slate-500 uppercase">
            <span>Stored Entities</span>
            <span>Count</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs text-slate-700">
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Meetings & Transcripts:</span>
              <span className="font-bold text-slate-900">{meetings.length}</span>
            </div>
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Documents & Memos:</span>
              <span className="font-bold text-slate-900">{documents.length}</span>
            </div>
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Knowledge Base Items:</span>
              <span className="font-bold text-slate-900">{knowledge.length}</span>
            </div>
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Extracted Documents:</span>
              <span className="font-bold text-slate-900">{extractedCount}</span>
            </div>
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Action Items Tracked:</span>
              <span className="font-bold text-slate-900">{actions.length}</span>
            </div>
            <div className="flex justify-between px-2 py-1 rounded-sm bg-white border border-slate-100">
              <span>Audit Log Records:</span>
              <span className="font-bold text-slate-900">{logs.length}</span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <button
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Complete JSON Backup
          </button>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-4 w-4 text-slate-500" />
              {isProcessing ? 'Importing Snapshot...' : 'Restore from JSON File'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              title="Clear all system data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Clear Data
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400">
            All data is persisted in your browser's private Local Storage and can be exported at any time.
          </p>
        </div>
      </div>
    </div>
  );
};
