import React, { useState, useEffect } from 'react';
import { Send, Mail, FileBarChart2 } from 'lucide-react';
import { LetterStudio } from '../letters/LetterStudio';
import { MemoStudio } from '../memos/MemoStudio';
import { ReportStudio } from '../reports/ReportStudio';

interface LettersAndMemosStudioProps {
  initialSubTab?: 'letters' | 'memos' | 'reports';
  initialContent?: {
    studio: 'letters' | 'memos' | 'reports';
    content: string;
  } | null;
  onDocumentCreated: (docId: string) => void;
}

export const LettersAndMemosStudio: React.FC<LettersAndMemosStudioProps> = ({
  initialSubTab = 'letters',
  initialContent,
  onDocumentCreated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'letters' | 'memos' | 'reports'>(() => {
    if (initialContent?.studio === 'reports' || initialSubTab === 'reports') return 'reports';
    if (initialContent?.studio === 'memos' || initialSubTab === 'memos') return 'memos';
    return 'letters';
  });

  useEffect(() => {
    if (initialContent?.studio) {
      setActiveSubTab(initialContent.studio);
    } else if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, initialContent]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Segmented Sub-Navigation Switch */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('letters')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeSubTab === 'letters'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Official Letters</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('memos')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeSubTab === 'memos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Internal Memos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('reports')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeSubTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileBarChart2 className="h-3.5 w-3.5" />
            <span>Official Reports</span>
          </button>
        </div>

        <p className="hidden md:block text-xs text-slate-500 font-medium">
          {activeSubTab === 'letters'
            ? 'Draft institutional correspondence with standard civil service salutations and letterheads'
            : activeSubTab === 'memos'
            ? 'Draft internal directorate memoranda with standardized reference headers and action routing'
            : 'Draft stakeholder engagement reports, progress evaluations, and technical mission summaries'}
        </p>
      </div>

      {/* Studio Workspace Content */}
      <div className="flex-1">
        {activeSubTab === 'letters' ? (
          <LetterStudio
            initialContent={initialContent?.studio === 'letters' ? initialContent.content : undefined}
            onDocumentCreated={onDocumentCreated}
          />
        ) : activeSubTab === 'memos' ? (
          <MemoStudio
            initialContent={initialContent?.studio === 'memos' ? initialContent.content : undefined}
            onDocumentCreated={onDocumentCreated}
          />
        ) : (
          <ReportStudio
            initialContent={initialContent?.studio === 'reports' ? initialContent.content : undefined}
            onDocumentCreated={onDocumentCreated}
          />
        )}
      </div>
    </div>
  );
};
