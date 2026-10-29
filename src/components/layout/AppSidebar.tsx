import React, { memo } from 'react';
import {
  LayoutDashboard,
  Mic,
  FileText,
  Mail,
  Clock,
  Settings,
  Building2,
  X,
  Sparkles,
  FileBarChart2,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

export type NavItemKey =
  | 'dashboard'
  | 'audio-transcribe'
  | 'minutes-reports'
  | 'minutes'
  | 'reports'
  | 'letters-memos'
  | 'letters'
  | 'memos'
  | 'documents'
  | 'settings'
  | 'templates'
  | 'gemini-qa';

interface AppSidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItemDefinition {
  key: NavItemKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = memo(({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  // Institutional Navigation Items with Minutes & Reports and Letters & Memos
  const navItems: NavItemDefinition[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'gemini-qa', label: 'RSIM AI (Chat)', icon: Sparkles, badge: 'GPT / Multi-AI', highlight: true },
    { key: 'audio-transcribe', label: 'Transcribe', icon: Mic, badge: 'Grok 2.0' },
    { key: 'minutes-reports', label: 'Minutes & Reports', icon: Clock, badge: 'Stakeholder' },
    { key: 'letters-memos', label: 'Letters & Memos', icon: Mail },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  const isItemActive = (key: NavItemKey) => {
    if (key === 'minutes-reports') {
      return currentTab === 'minutes-reports' || currentTab === 'minutes' || currentTab === 'reports';
    }
    if (key === 'letters-memos') {
      return currentTab === 'letters-memos' || currentTab === 'letters' || currentTab === 'memos';
    }
    return currentTab === key;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800`}
      >
        {/* Directorate Branding Header */}
        <div className="flex h-20 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-950/40">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white">RSIM AI</span>
                <span className="rounded-sm bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Gov
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate max-w-[170px]" title="Ministry of Communications, Digital Technology and Innovations (MoCDTI)">
                Ministry of Communications, Digital Technology and Innovations (MoCDTI)
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Focused Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          <p className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Workspaces
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.key);

            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelectTab(item.key);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : item.highlight
                    ? 'text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive
                        ? 'text-white'
                        : item.highlight
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Directorate Status & Trust Footer */}
        <div className="border-t border-slate-800/90 p-4 bg-slate-950/40 space-y-3">
          <PWAInstallButton variant="sidebar" />
          <div className="flex items-center gap-2.5">
            <div className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-xs">
              <p className="font-semibold text-slate-200">Directorate Workstation</p>
              <p className="text-[11px] text-slate-400">Institutional Document Engine</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 text-center space-y-0.5">
            <p className="text-slate-300">© 2026 RSIM AI · All Rights Reserved</p>
            <p className="text-emerald-400 font-medium">Developed by Danso Twum Kwadjo</p>
          </div>
        </div>
      </aside>
    </>
  );
});

// Display name for React DevTools
AppSidebar.displayName = 'AppSidebar';

