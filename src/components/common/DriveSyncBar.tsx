import React, { useState, useEffect } from 'react';
import {
  Cloud,
  FolderSync,
  Upload,
  HardDrive,
  Cpu,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  initDriveAuth,
  DriveAuthState,
  signInWithGoogleDrive,
  signInWithOneDrive,
} from '../../services/driveService';
import { DriveIntegrationModal } from './DriveIntegrationModal';
import { FreeAIModelsModal } from './FreeAIModelsModal';
import { UserTemplate, KnowledgeItem } from '../../types';

interface DriveSyncBarProps {
  onTemplateLearned?: (template: UserTemplate) => void;
  onKnowledgeLearned?: (knowledge: KnowledgeItem) => void;
}

export const DriveSyncBar: React.FC<DriveSyncBarProps> = ({
  onTemplateLearned,
  onKnowledgeLearned,
}) => {
  const [driveAuth, setDriveAuth] = useState<DriveAuthState>({
    isConnected: false,
    provider: null,
    googleConnected: false,
    googleExpired: false,
    user: null,
    email: null,
    displayName: null,
    photoURL: null,
    oneDriveConnected: false,
    oneDriveExpired: false,
    oneDriveAccountName: null,
    oneDriveEmail: null,
  });

  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isConnectingOneDrive, setIsConnectingOneDrive] = useState(false);

  useEffect(() => {
    const unsub = initDriveAuth((state) => {
      setDriveAuth(state);
    });
    return () => unsub();
  }, []);

  const handleQuickGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      await signInWithGoogleDrive();
    } catch (e) {
      console.warn('Google Drive quick connect error:', e);
      setIsDriveModalOpen(true);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleQuickOneDriveConnect = async () => {
    setIsConnectingOneDrive(true);
    try {
      await signInWithOneDrive();
    } catch (e) {
      console.warn('OneDrive quick connect error:', e);
      setIsDriveModalOpen(true);
    } finally {
      setIsConnectingOneDrive(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-blue-200/80 bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-white p-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Cloud Drives & Knowledge Hub
                </span>
                
                {/* Google Drive Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    driveAuth.googleConnected
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      driveAuth.googleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {driveAuth.googleConnected ? 'Google Drive Active' : 'Google Drive Off'}
                </span>

                {/* Microsoft OneDrive Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    driveAuth.oneDriveConnected
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      driveAuth.oneDriveConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {driveAuth.oneDriveConnected ? 'OneDrive Active' : 'OneDrive Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {driveAuth.isConnected
                  ? `Connected to ${[
                      driveAuth.googleConnected ? `Google (${driveAuth.email || 'active'})` : null,
                      driveAuth.oneDriveConnected ? `OneDrive (${driveAuth.oneDriveAccountName || 'active'})` : null,
                    ]
                      .filter(Boolean)
                      .join(' & ')}. Uploads and templates sync straight to your cloud.`
                  : 'Connect Google Drive or Microsoft OneDrive to browse, upload, and auto-learn from official documents.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!driveAuth.googleConnected && (
              <button
                type="button"
                onClick={handleQuickGoogleConnect}
                disabled={isConnectingGoogle}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Cloud className="h-3.5 w-3.5" />
                <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Google'}</span>
              </button>
            )}

            {!driveAuth.oneDriveConnected && (
              <button
                type="button"
                onClick={handleQuickOneDriveConnect}
                disabled={isConnectingOneDrive}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <HardDrive className="h-3.5 w-3.5" />
                <span>{isConnectingOneDrive ? 'Connecting...' : 'Connect OneDrive'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDriveModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <FolderSync className="h-3.5 w-3.5 text-blue-600" />
              <span>Manage Cloud Files</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDriveModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload to Cloud</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModelsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
              title="Select free AI models with unlimited/generous limits"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Free AI Models</span>
            </button>
          </div>
        </div>
      </div>

      <DriveIntegrationModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onTemplateLearned={onTemplateLearned}
        onKnowledgeLearned={onKnowledgeLearned}
      />

      <FreeAIModelsModal
        isOpen={isModelsModalOpen}
        onClose={() => setIsModelsModalOpen(false)}
      />
    </>
  );
};
