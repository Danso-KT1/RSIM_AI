import React, { useState, useEffect } from 'react';
import {
  Search,
  Mic,
  Clock,
  FileText,
  Mail,
  Send,
  FileCheck2,
  Sparkles,
  BookMarked,
  Settings,
  ChevronRight,
  Cloud,
  Cpu,
  Zap,
} from 'lucide-react';
import { NavItemKey } from '../layout/AppSidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: string, tab?: NavItemKey) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onSelectAction('open-palette');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectAction]);

  if (!isOpen) return null;

  const commands = [
    {
      id: 'cmd_write_letter',
      label: 'Write Official Letter',
      category: 'Writing Studios',
      icon: Send,
      tab: 'letters' as NavItemKey,
      action: 'write-letter',
    },
    {
      id: 'cmd_write_memo',
      label: 'Write Internal Memorandum',
      category: 'Writing Studios',
      icon: Mail,
      tab: 'memos' as NavItemKey,
      action: 'write-memo',
    },
    {
      id: 'cmd_write_minutes',
      label: 'Write Meeting Minutes',
      category: 'Writing Studios',
      icon: Clock,
      tab: 'minutes' as NavItemKey,
      action: 'write-minutes',
    },
    {
      id: 'cmd_write_report',
      label: 'Write Institutional Report',
      category: 'Writing Studios',
      icon: FileCheck2,
      tab: 'reports' as NavItemKey,
      action: 'write-report',
    },
    {
      id: 'cmd_audio_transcribe',
      label: 'Audio Transcription Studio (Live & 4-5h Long Audio)',
      category: 'Audio & Proceedings',
      icon: Mic,
      tab: 'audio-transcribe' as NavItemKey,
      action: 'open-audio-transcribe',
    },
    {
      id: 'cmd_ai_cascade',
      label: 'Four-Engine AI Cascade & Circuit-Breaker Matrix',
      category: 'AI Intelligence',
      icon: Zap,
      action: 'open-cascade-matrix',
    },
    {
      id: 'cmd_gemini_qa',
      label: 'Ask Google Gemini Q&A',
      category: 'AI Intelligence',
      icon: Sparkles,
      tab: 'gemini-qa' as NavItemKey,
      action: 'ask-gemini',
    },
    {
      id: 'cmd_templates',
      label: 'Knowledge Base & Document Templates',
      category: 'Templates',
      icon: BookMarked,
      tab: 'templates' as NavItemKey,
      action: 'manage-templates',
    },
    {
      id: 'cmd_google_drive',
      label: 'Google Drive & Microsoft OneDrive Cloud Hub',
      category: 'Cloud & Storage',
      icon: Cloud,
      action: 'open-drive-sync',
    },
    {
      id: 'cmd_free_ai_models',
      label: 'Free AI Models Hub (No Limits / Generous Tier)',
      category: 'AI Intelligence',
      icon: Cpu,
      action: 'open-free-ai-models',
    },
    {
      id: 'cmd_all_docs',
      label: 'View All Saved Documents',
      category: 'Documents',
      icon: FileText,
      tab: 'documents' as NavItemKey,
      action: 'view-documents',
    },
    {
      id: 'cmd_settings',
      label: 'Settings & Data Backup',
      category: 'System',
      icon: Settings,
      tab: 'settings' as NavItemKey,
      action: 'open-settings',
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command (e.g. 'letter', 'memo', 'minutes', 'report', 'audio', 'qa')..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <kbd className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">ESC</kbd>
          </button>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No command found for &quot;{query}&quot;.
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectAction(item.action, item.tab);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{item.label}</p>
                        <p className="text-[11px] text-slate-400">{item.category}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <span>Navigate with arrows, Enter to execute</span>
          <span>Google Gemini Document Platform</span>
        </div>
      </div>
    </div>
  );
};
