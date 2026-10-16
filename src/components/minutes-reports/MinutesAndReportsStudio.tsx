import React, { useState, useEffect } from 'react';
import { Clock, FileBarChart2 } from 'lucide-react';
import { MinutesStudio } from '../minutes/MinutesStudio';
import { ReportStudio } from '../reports/ReportStudio';

interface MinutesAndReportsStudioProps {
  initialSubTab?: 'minutes' | 'reports';
  initialContent?: {
    studio: 'minutes' | 'reports';
    content: string;
  } | null;
  onDocumentCreated: (docId: string) => void;
}

export const MinutesAndReportsStudio: React.FC<MinutesAndReportsStudioProps> = ({
  initialSubTab = 'minutes',
  initialContent,
  onDocumentCreated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'minutes' | 'reports'>(() => {
    if (initialContent?.studio === 'reports' || initialSubTab === 'reports') return 'reports';
    return 'minutes';
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
            onClick={() => setActiveSubTab('minutes')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeSubTab === 'minutes'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Meeting Minutes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('reports')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeSubTab === 'reports'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileBarChart2 className="h-3.5 w-3.5" />
            <span>Official Reports (Stakeholder)</span>
          </button>
        </div>

        <p className="hidden md:block text-xs text-slate-500 font-medium">
          {activeSubTab === 'minutes'
            ? 'Draft verified meeting minutes with proceedings structure and attendance from transcript'
            : 'Draft stakeholder engagement reports, data harmonisation summaries, and executive evaluations'}
        </p>
      </div>

      {/* Studio Workspace Content */}
      <div className="flex-1">
        {activeSubTab === 'minutes' ? (
          <MinutesStudio
            initialContent={initialContent?.studio === 'minutes' ? initialContent.content : undefined}
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
