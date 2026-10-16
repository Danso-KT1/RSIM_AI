import React, { useState } from 'react';
import { Download, Smartphone, Check, X, Shield, WifiOff, HardDrive } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'card' | 'badge';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      await install();
      setInstalling(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If already installed as standalone PWA
  if (isInstalled) {
    if (variant === 'badge' || variant === 'sidebar') {
      return (
        <div className={`flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-800/80 px-3 py-2 text-xs text-emerald-300 ${className}`}>
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="font-medium truncate">Installed as PWA (Offline Ready)</span>
        </div>
      );
    }
    if (variant === 'card') {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">App Installed as Native PWA</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                RSIM AI is running in standalone mode with full offline caching and local data access enabled.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // If not installable and not iOS (e.g. desktop browser with unsupported manifest or already dismissed)
  // In card mode, we still explain how to install or that offline service worker is active.
  if (!isInstallable && !isIOS && variant !== 'card') {
    return null;
  }

  return (
    <>
      {/* 1. Header Variant */}
      {variant === 'header' && (
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 active:scale-95 transition-all ${className}`}
          title="Install RSIM AI as a standalone Progressive Web App for offline access"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden md:inline">Install PWA</span>
          <span className="md:hidden">Install</span>
        </button>
      )}

      {/* 2. Sidebar Variant */}
      {variant === 'sidebar' && (
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-emerald-800 to-teal-800 border border-emerald-600/50 px-3.5 py-2.5 text-xs font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition-all ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-4 w-4 text-emerald-300" />
            <div className="text-left">
              <p className="leading-tight">Install App (PWA)</p>
              <p className="text-[10px] font-normal text-emerald-200">100% Offline Access</p>
            </div>
          </div>
          <Download className="h-3.5 w-3.5 text-emerald-300" />
        </button>
      )}

      {/* 3. Card Variant (Settings / System View) */}
      {variant === 'card' && (
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-xs ${className}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Progressive Web App (PWA) & Offline Access
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Install RSIM AI directly to your device desktop or home screen. Access and edit all letters, memos, minutes, reports, and knowledge offline without an internet connection.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    <HardDrive className="h-3 w-3" /> Local Data Storage
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                    <WifiOff className="h-3 w-3" /> Service Worker Offline
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                    <Shield className="h-3 w-3" /> Standalone Window
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>{isIOS ? 'Install on iOS' : 'Install PWA Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Guided Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-500">Run RSIM AI as a standalone app on iOS</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white">
                  1
                </span>
                <p>
                  Tap the <strong>Share</strong> button (box with an upward arrow) in the Safari bottom toolbar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white">
                  2
                </span>
                <p>
                  Scroll down the share sheet and tap <strong>Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white">
                  3
                </span>
                <p>
                  Tap <strong>Add</strong> in the top-right corner. The RSIM AI icon will appear on your Home Screen!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
