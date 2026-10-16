import React, { useState, useEffect } from 'react';
import {
  Menu,
  Search,
  DatabaseBackup,
  Layers,
  X,
  Wifi,
  WifiOff,
  Building2,
  Zap,
  Cloud,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { aiService } from '../../services/aiService';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { initDriveAuth, DriveAuthState, getDriveAuthState } from '../../services/driveService';

interface TopNavigationProps {
  user: UserProfile;
  activeContext: { type: string; id: string; title: string } | null;
  onClearContext: () => void;
  onOpenCommandPalette: () => void;
  onOpenBackupModal: () => void;
  onOpenCascadeModal?: () => void;
  onOpenDriveModal?: () => void;
  onToggleMobileMenu: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  user,
  activeContext,
  onClearContext,
  onOpenCommandPalette,
  onOpenBackupModal,
  onOpenCascadeModal,
  onOpenDriveModal,
  onToggleMobileMenu,
}) => {
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [driveState, setDriveState] = useState<DriveAuthState>(() => getDriveAuthState());
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const unsub = initDriveAuth((st) => setDriveState(st));
    return () => unsub();
  }, []);

  useEffect(() => {
    aiService.checkHealth().then((res) => {
      setAiActive(res.hasAI);
    }).catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Left side: Mobile menu & Search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search trigger (Ctrl+K) */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 sm:w-64"
        >
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate text-left font-medium">Search knowledge, files...</span>
          <kbd className="ml-auto hidden rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-xs sm:inline-block border border-slate-200">
            ⌘K
          </kbd>
        </button>

        {/* Active Context Banner if selected */}
        {activeContext && (
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 md:flex">
            <Layers className="h-3 w-3 text-emerald-600" />
            <span className="font-semibold capitalize">{activeContext.type}:</span>
            <span className="max-w-[200px] truncate font-medium">{activeContext.title}</span>
            <button
              onClick={onClearContext}
              className="ml-1 rounded-full p-0.5 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-900"
              title="Clear context"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right side: Focused System Actions Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Offline / Online Network Indicator */}
        {!isOnline ? (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-500 text-white shadow-2xs"
            title="Device is currently offline. All local documents and templates are accessible."
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Offline Mode</span>
          </div>
        ) : (
          <div
            className="hidden lg:flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100/80"
            title="Connected to network"
          >
            <Wifi className="h-3 w-3 text-emerald-600" />
            <span>Online</span>
          </div>
        )}

        {/* In-App PWA Install Trigger */}
        <PWAInstallButton variant="header" />

        {/* AI Cascade Matrix Modal Quick Trigger */}
        {onOpenCascadeModal && (
          <button
            type="button"
            onClick={onOpenCascadeModal}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Open AI Provider Cascade & Circuit-Breaker Matrix (Gemini, Groq, OpenAI, DeepSeek, Hugging Face)"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500" />
            <span className="hidden md:inline">AI Cascade</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        )}

        {/* Cloud Drives Hub Quick Action Button */}
        {onOpenDriveModal && (() => {
          const isExpired = Boolean(driveState.googleExpired || driveState.oneDriveExpired);
          const activeProviders = [
            driveState.googleConnected ? 'Google Drive' : null,
            driveState.oneDriveConnected ? 'OneDrive' : null,
          ].filter(Boolean).join(' & ');

          let btnClass = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300';
          let dotClass = 'bg-slate-300';
          let tooltip = 'Google Drive & Microsoft OneDrive: Disconnected - Click to connect';

          if (isExpired) {
            btnClass = 'border-amber-300 bg-amber-50/90 text-amber-900 hover:bg-amber-100';
            dotClass = 'bg-amber-500 animate-pulse';
            tooltip = 'Cloud Drive session expired - Click to reconnect';
          } else if (driveState.isConnected) {
            btnClass = 'border-blue-300 bg-blue-50/80 text-blue-900 hover:bg-blue-100';
            dotClass = 'bg-blue-500 animate-pulse';
            tooltip = `Connected: ${activeProviders || 'Cloud Drives'}`;
          }

          return (
            <button
              type="button"
              onClick={onOpenDriveModal}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-2xs ${btnClass}`}
              title={tooltip}
            >
              <Cloud className={`h-3.5 w-3.5 ${isExpired ? 'text-amber-600' : driveState.isConnected ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="hidden md:inline">
                {isExpired ? 'Drive (Expired)' : driveState.isConnected ? (driveState.googleConnected && !driveState.oneDriveConnected ? 'Google Drive' : !driveState.googleConnected && driveState.oneDriveConnected ? 'OneDrive' : 'Cloud Drives') : 'Cloud Drives'}
              </span>
              <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            </button>
          );
        })()}

        {/* Backup & Data Hub Quick Action Button */}
        <button
          type="button"
          onClick={onOpenBackupModal}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
          title="Backup, export, or restore all local documents and templates"
        >
          <DatabaseBackup className="h-3.5 w-3.5 text-emerald-600" />
          <span className="hidden md:inline">Backup & Export</span>
        </button>

        {/* Institutional Directorate Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white shadow-2xs">
          <Building2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold">{user.department ? 'RSIM Directorate' : 'Directorate Workstation'}</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
            Open
          </span>
        </div>
      </div>
    </header>
  );
};
