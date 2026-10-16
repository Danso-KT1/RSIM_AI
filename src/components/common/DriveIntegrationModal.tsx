import React, { useState, useEffect } from 'react';
import {
  Cloud,
  FolderOpen,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck2,
  Trash2,
  ExternalLink,
  Sparkles,
  X,
  Search,
  Link as LinkIcon,
  ShieldCheck,
  Building2,
  Key,
  FolderSync,
  Layers,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import {
  signInWithGoogleDrive,
  connectGoogleWithToken,
  connectDemoGoogleDrive,
  disconnectGoogleDrive,
  listDriveFiles,
  uploadFileToDrive,
  syncAndLearnTemplateFromDrive,
  syncAndLearnKnowledgeFromDrive,
  deleteDriveFile,
  signInWithOneDrive,
  connectOneDriveWithToken,
  connectDemoOneDrive,
  disconnectOneDrive,
  listOneDriveFiles,
  uploadFileToOneDrive,
  syncAndLearnTemplateFromOneDrive,
  syncAndLearnKnowledgeFromOneDrive,
  deleteOneDriveFile,
  resolveCloudShareLink,
  learnTemplateFromContent,
  downloadDriveFileContent,
  downloadOneDriveFileContent,
  initDriveAuth,
  DriveAuthState,
  DriveFileInfo,
} from '../../services/driveService';
import { UserTemplate, KnowledgeItem, TemplateDriveSource } from '../../types';
import { storage } from '../../services/storage';

export interface CloudFileSelection {
  id: string;
  name: string;
  mimeType?: string;
  provider: 'google' | 'onedrive';
  arrayBuffer?: ArrayBuffer;
  text?: string;
  templateSpec?: any;
}

export interface DriveIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateLearned?: (template: UserTemplate) => void;
  onKnowledgeLearned?: (knowledge: KnowledgeItem) => void;
  onSelectFile?: (file: any, content?: any) => void;
  filterMode?: 'all' | 'templates' | 'transcripts' | 'documents';
  filterTypes?: string[];
  targetProvider?: 'google' | 'onedrive';
  title?: string;
}

export const DriveIntegrationModal: React.FC<DriveIntegrationModalProps> = ({
  isOpen,
  onClose,
  onTemplateLearned,
  onKnowledgeLearned,
  onSelectFile,
  filterMode = 'all',
  filterTypes,
  targetProvider,
  title: modalTitle,
}) => {
  const [authState, setAuthState] = useState<DriveAuthState>({
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

  const [activeTab, setActiveTab] = useState<'google' | 'onedrive' | 'share-link' | 'upload-cloud' | 'synced-items'>('google');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Files state
  const [googleFiles, setGoogleFiles] = useState<DriveFileInfo[]>([]);
  const [oneDriveFiles, setOneDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Target document / learning configurations
  const [targetType, setTargetType] = useState<'Letter' | 'Memo' | 'Minutes' | 'Report'>('Letter');
  const [knowledgeCategory, setKnowledgeCategory] = useState<KnowledgeItem['category']>('Directorate Information');
  const [importMode, setImportMode] = useState<'template' | 'knowledge'>('template');
  const [learningFileId, setLearningFileId] = useState<string | null>(null);

  // Manual token input state (fallback when popups are blocked)
  const [showTokenInput, setShowTokenInput] = useState<'google' | 'onedrive' | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Share link resolver state
  const [shareLinkInput, setShareLinkInput] = useState('');
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<{
    fileName: string;
    text: string;
    provider: 'google_drive' | 'onedrive';
    isDocx?: boolean;
  } | null>(null);

  // Upload state
  const [uploadTargetProvider, setUploadTargetProvider] = useState<'google' | 'onedrive'>('google');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = initDriveAuth((state) => {
      setAuthState(state);
      if (state.googleConnected) {
        fetchGoogleFiles();
      }
      if (state.oneDriveConnected) {
        fetchOneDriveFiles();
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchGoogleFiles = async (q?: string) => {
    setIsSearching(true);
    setError(null);
    try {
      const files = await listDriveFiles({ query: q !== undefined ? q : searchQuery });
      setGoogleFiles(files);
    } catch (err: any) {
      console.warn('Google Drive files error:', err);
      setError(err.message || 'Failed to list Google Drive files');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchOneDriveFiles = async (q?: string) => {
    setIsSearching(true);
    setError(null);
    try {
      const files = await listOneDriveFiles(q !== undefined ? q : searchQuery);
      setOneDriveFiles(files);
    } catch (err: any) {
      console.warn('OneDrive files error:', err);
      setError(err.message || 'Failed to list OneDrive files');
    } finally {
      setIsSearching(false);
    }
  };

  // Google Handlers
  const handleConnectGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogleDrive();
      await fetchGoogleFiles();
      setSuccessMsg('Successfully connected to Google Drive!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      const msg = err.message || 'Google Drive authentication was cancelled or failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectDemoGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      connectDemoGoogleDrive();
      await fetchGoogleFiles();
      setSuccessMsg('Connected to Directorate Google Workspace Cloud! Templates and files ready.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect Directorate drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualGoogleConnect = async () => {
    if (!manualToken.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await connectGoogleWithToken(manualToken, manualEmail, manualName);
      await fetchGoogleFiles();
      setShowTokenInput(null);
      setManualToken('');
      setSuccessMsg('Connected Google Drive using token!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with provided Google token.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (confirm('Disconnect Google Drive for this session?')) {
      await disconnectGoogleDrive();
      setGoogleFiles([]);
    }
  };

  // OneDrive Handlers
  const handleConnectOneDrive = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithOneDrive();
      await fetchOneDriveFiles();
      setSuccessMsg('Successfully connected to Microsoft OneDrive!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Microsoft OneDrive authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectDemoOneDrive = async () => {
    setIsLoading(true);
    setError(null);
    try {
      connectDemoOneDrive();
      await fetchOneDriveFiles();
      setSuccessMsg('Connected to Directorate Microsoft OneDrive M365! Templates and files ready.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect Directorate OneDrive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualOneDriveConnect = async () => {
    if (!manualToken.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await connectOneDriveWithToken(manualToken, manualName, manualEmail);
      await fetchOneDriveFiles();
      setShowTokenInput(null);
      setManualToken('');
      setSuccessMsg('Connected Microsoft OneDrive with token!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect with provided OneDrive token.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectOneDrive = async () => {
    if (confirm('Disconnect Microsoft OneDrive for this session?')) {
      await disconnectOneDrive();
      setOneDriveFiles([]);
    }
  };

  // Learning / Sync from Cloud File
  const handleLearnFile = async (file: DriveFileInfo, provider: 'google_drive' | 'onedrive') => {
    setLearningFileId(file.id);
    setError(null);
    try {
      if (importMode === 'template') {
        const tpl =
          provider === 'google_drive'
            ? await syncAndLearnTemplateFromDrive(file, targetType)
            : await syncAndLearnTemplateFromOneDrive(file, targetType);

        onTemplateLearned?.(tpl);
        setSuccessMsg(`Learned template: "${tpl.title}" (${tpl.documentType})!`);
      } else {
        const know =
          provider === 'google_drive'
            ? await syncAndLearnKnowledgeFromDrive(file, knowledgeCategory)
            : await syncAndLearnKnowledgeFromOneDrive(file, knowledgeCategory);

        onKnowledgeLearned?.(know);
        setSuccessMsg(`Added to Knowledge Base: "${know.title}"!`);
      }
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to import and analyze cloud file.');
    } finally {
      setLearningFileId(null);
    }
  };

  // Direct file selection for Studios and Chat
  const handleSelectFileDirectly = async (file: DriveFileInfo, provider: 'google_drive' | 'onedrive') => {
    if (!onSelectFile) return;
    setLearningFileId(file.id);
    setError(null);
    try {
      const downloaded =
        provider === 'google_drive'
          ? await downloadDriveFileContent(file.id, file.mimeType)
          : await downloadOneDriveFileContent(file.id, file.mimeType);

      onSelectFile(file, downloaded);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to download file from cloud.');
    } finally {
      setLearningFileId(null);
    }
  };

  // Delete Cloud File
  const handleDeleteFile = async (file: DriveFileInfo, provider: 'google_drive' | 'onedrive') => {
    try {
      if (provider === 'google_drive') {
        const ok = await deleteDriveFile(file.id, file.name);
        if (ok) fetchGoogleFiles();
      } else {
        const ok = await deleteOneDriveFile(file.id, file.name);
        if (ok) fetchOneDriveFiles();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete file.');
    }
  };

  // Direct Share Link Resolver
  const handleResolveShareLink = async () => {
    if (!shareLinkInput.trim()) return;
    setIsResolvingLink(true);
    setError(null);
    try {
      const res = await resolveCloudShareLink(shareLinkInput);
      setResolvedPreview(res);
      setSuccessMsg(`Document resolved from ${res.provider === 'google_drive' ? 'Google' : 'OneDrive'}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to access cloud share link. Ensure link is public or shared.');
    } finally {
      setIsResolvingLink(false);
    }
  };

  const handleSaveResolvedDocument = async () => {
    if (!resolvedPreview) return;
    setIsLoading(true);
    try {
      if (importMode === 'template') {
        const analysis = await learnTemplateFromContent(
          resolvedPreview.text,
          resolvedPreview.fileName,
          targetType
        );

        const driveSource: TemplateDriveSource = {
          provider: resolvedPreview.provider,
          fileName: resolvedPreview.fileName,
          syncedAt: new Date().toISOString(),
        };

        const newTemplate: UserTemplate = {
          id: `tpl_link_${Date.now()}`,
          title: analysis.title || resolvedPreview.fileName,
          documentType: analysis.documentType,
          category: `${analysis.documentType.toLowerCase()}s` as any,
          source: resolvedPreview.provider,
          content: analysis.blueprint,
          description: `Imported via cloud link. Learned typography (${analysis.formatting.fontFamily}) and ${analysis.toneProfile.formality} tone.`,
          fields: analysis.fields,
          learnedKnowledge: {
            tone: analysis.toneProfile.formality,
            keySections: analysis.fields,
            learnedAt: new Date().toISOString(),
            formatting: analysis.formatting,
            toneProfile: analysis.toneProfile,
            exactStructureBlueprint: analysis.blueprint,
          },
          driveSource,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        storage.saveTemplate(newTemplate);
        onTemplateLearned?.(newTemplate);
        setSuccessMsg(`Imported and learned template: "${newTemplate.title}"!`);
      } else {
        const newKnowledge: KnowledgeItem = {
          id: `know_link_${Date.now()}`,
          title: resolvedPreview.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
          category: knowledgeCategory,
          content: resolvedPreview.text,
          summary: resolvedPreview.text.slice(0, 240) + '...',
          source: `Cloud Link (${resolvedPreview.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'})`,
          owner: 'RSIM Directorate',
          version: '1.0',
          accessLevel: 'Directorate Only',
          approvalStatus: 'Approved',
          tags: ['Cloud Import', resolvedPreview.provider, knowledgeCategory],
          effectiveDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        };

        storage.saveKnowledge(newKnowledge);
        onKnowledgeLearned?.(newKnowledge);
        setSuccessMsg(`Added document to Knowledge Base: "${newKnowledge.title}"!`);
      }

      setResolvedPreview(null);
      setShareLinkInput('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save resolved document.');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload Straight to Cloud
  const handleUploadStraightToCloud = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      if (uploadTargetProvider === 'google') {
        if (!authState.googleConnected) {
          throw new Error('Please connect your Google Drive account first.');
        }
        const uploaded = await uploadFileToDrive(file, file.name);
        setSuccessMsg(`Uploaded "${file.name}" to Google Drive folder "Directorate Templates & Knowledge"!`);
        await fetchGoogleFiles();
        // Immediately learn
        await handleLearnFile(uploaded, 'google_drive');
      } else {
        if (!authState.oneDriveConnected) {
          throw new Error('Please connect your Microsoft OneDrive account first.');
        }
        const uploaded = await uploadFileToOneDrive(file, file.name);
        setSuccessMsg(`Uploaded "${file.name}" to Microsoft OneDrive folder "RSIM Directorate Templates"!`);
        await fetchOneDriveFiles();
        // Immediately learn
        await handleLearnFile(uploaded, 'onedrive');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Synced items from local storage
  const allTemplates = storage.getTemplates().filter((t) => t.driveSource?.provider);
  const allKnowledge = storage.getKnowledge().filter((k) => k.driveSource?.provider);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md border border-white/20">
              <Cloud className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Cloud Knowledge & Drive Hub</h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  Google Drive & OneDrive
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Connect your cloud storage, browse official Word/PDF documents, and auto-learn typography & tone.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Strip & Quick Switcher */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            {/* Google Drive Status */}
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${authState.googleConnected ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-300'}`} />
              <span className="font-semibold text-slate-700">Google Drive:</span>
              <span className={authState.googleConnected ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                {authState.googleConnected ? (authState.email || 'Connected') : 'Disconnected'}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            {/* Microsoft OneDrive Status */}
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${authState.oneDriveConnected ? 'bg-indigo-500 ring-4 ring-indigo-100' : 'bg-slate-300'}`} />
              <span className="font-semibold text-slate-700">OneDrive:</span>
              <span className={authState.oneDriveConnected ? 'text-indigo-700 font-bold' : 'text-slate-500'}>
                {authState.oneDriveConnected ? (authState.oneDriveAccountName || 'Connected') : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Import Destination Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Import Mode:</span>
            <div className="inline-flex rounded-xl bg-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setImportMode('template')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  importMode === 'template' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Learn as Template ({targetType})
              </button>
              <button
                type="button"
                onClick={() => setImportMode('knowledge')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  importMode === 'knowledge' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Add to Knowledge Base
              </button>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {error && (
          <div className="mx-6 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={activeTab === 'onedrive' ? handleConnectDemoOneDrive : handleConnectDemoGoogle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Demo mode (sample files)</span>
              </button>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded text-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 rounded">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Primary Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-white">
          <button
            onClick={() => setActiveTab('google')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'google'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="h-4 w-4" />
            <span>Google Drive ({googleFiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('onedrive')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'onedrive'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            <span>Microsoft OneDrive ({oneDriveFiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload-cloud')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'upload-cloud'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Upload Straight to Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('share-link')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'share-link'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon className="h-4 w-4" />
            <span>Import Cloud Link</span>
          </button>

          <button
            onClick={() => setActiveTab('synced-items')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'synced-items'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderSync className="h-4 w-4" />
            <span>Synced Library ({allTemplates.length + allKnowledge.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Target Type Selector Bar when in template mode */}
          {importMode === 'template' && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Extract Template As:</span>
              {(['Letter', 'Memo', 'Minutes', 'Report'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTargetType(t)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    targetType === t
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Category Selector Bar when in knowledge mode */}
          {importMode === 'knowledge' && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Knowledge Category:</span>
              <select
                value={knowledgeCategory}
                onChange={(e) => setKnowledgeCategory(e.target.value as any)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                <option value="Directorate Information">Directorate Information</option>
                <option value="Policies">Policies & Guidelines</option>
                <option value="Procedures">Procedures & SOPs</option>
                <option value="Reports">Official Reports</option>
                <option value="Writing Standards">Writing Standards</option>
                <option value="Correspondence">Correspondence Protocols</option>
              </select>
            </div>
          )}

          {/* TAB 1: GOOGLE DRIVE */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              {!authState.googleConnected ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Cloud className="h-7 w-7" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-800">Connect Google Drive</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    Sign in with Google to browse your drive, access Word (.docx) documents, Google Docs, and official PDFs, and instantly teach RSIM AI your exact institutional formats.
                  </p>
                  
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                      <span>Sign in with Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectDemoGoogle}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold shadow-2xs transition-all disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>Demo mode (sample files)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTokenInput(showTokenInput === 'google' ? null : 'google')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Key className="h-3.5 w-3.5 text-slate-500" />
                      <span>Enter Token Manually</span>
                    </button>
                  </div>

                  {showTokenInput === 'google' && (
                    <div className="mt-5 p-4 rounded-2xl bg-white border border-slate-200 text-left max-w-md mx-auto space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">Manual Google Access Token</h4>
                      <p className="text-[11px] text-slate-500">
                        Paste a Google OAuth access token if popup sign-in is blocked in your network environment:
                      </p>
                      <input
                        type="password"
                        placeholder="ya29.a0AfH6SM..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleManualGoogleConnect}
                        disabled={isLoading || !manualToken.trim()}
                        className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        Verify & Connect Google Drive
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connected Header & Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs">
                        G
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {authState.displayName || 'Google Drive Connected'}
                        </p>
                        <p className="text-[11px] text-slate-500">{authState.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchGoogleFiles()}
                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${isSearching ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogle}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchGoogleFiles(searchQuery)}
                        placeholder="Search Word documents, Google Docs, or templates..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchGoogleFiles(searchQuery)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                    >
                      Search
                    </button>
                  </div>

                  {/* Files List */}
                  {isSearching ? (
                    <div className="p-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                      <p className="mt-2 text-xs font-medium">Scanning Google Drive documents...</p>
                    </div>
                  ) : googleFiles.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                      <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-xs font-medium">No documents found matching your search.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Use the "Upload Straight to Cloud" tab to upload a Word or PDF file directly.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {googleFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-blue-400 transition-all hover:shadow-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {file.size || 'Google Doc'} • Modified {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'recently'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Preview</span>
                              </a>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file, 'google_drive')}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete from Google Drive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {onSelectFile ? (
                                <button
                                  type="button"
                                  onClick={() => handleSelectFileDirectly(file, 'google_drive')}
                                  disabled={learningFileId === file.id}
                                  className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-2xs"
                                >
                                  {learningFileId === file.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span>Select File</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleLearnFile(file, 'google_drive')}
                                  disabled={learningFileId === file.id}
                                  className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-2xs"
                                >
                                  {learningFileId === file.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{importMode === 'template' ? 'Learn Template' : 'Add Knowledge'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MICROSOFT ONEDRIVE */}
          {activeTab === 'onedrive' && (
            <div className="space-y-4">
              {!authState.oneDriveConnected ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                    <HardDrive className="h-7 w-7" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-800">Connect Microsoft OneDrive</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    Sign in with your Microsoft 365, Personal, or Work/School account to browse OneDrive files and sync official ministerial templates and circulars.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleConnectOneDrive}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                      <span>Sign in with Microsoft OneDrive</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectDemoOneDrive}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold shadow-2xs transition-all disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>Demo mode (sample files)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTokenInput(showTokenInput === 'onedrive' ? null : 'onedrive')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Key className="h-3.5 w-3.5 text-slate-500" />
                      <span>Enter Token Manually</span>
                    </button>
                  </div>

                  {showTokenInput === 'onedrive' && (
                    <div className="mt-5 p-4 rounded-2xl bg-white border border-slate-200 text-left max-w-md mx-auto space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">Microsoft Graph Access Token</h4>
                      <p className="text-[11px] text-slate-500">
                        Paste your Microsoft Graph token or personal OneDrive bearer token:
                      </p>
                      <input
                        type="password"
                        placeholder="EwBoA8l6BAAU79..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleManualOneDriveConnect}
                        disabled={isLoading || !manualToken.trim()}
                        className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        Verify & Connect OneDrive
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connected Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs">
                        MS
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {authState.oneDriveAccountName || 'Microsoft OneDrive Connected'}
                        </p>
                        <p className="text-[11px] text-slate-500">{authState.oneDriveEmail || 'Active Session'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchOneDriveFiles()}
                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${isSearching ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectOneDrive}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchOneDriveFiles(searchQuery)}
                        placeholder="Search files in OneDrive..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchOneDriveFiles(searchQuery)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                    >
                      Search
                    </button>
                  </div>

                  {/* Files List */}
                  {isSearching ? (
                    <div className="p-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                      <p className="mt-2 text-xs font-medium">Scanning Microsoft OneDrive files...</p>
                    </div>
                  ) : oneDriveFiles.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                      <HardDrive className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-xs font-medium">No documents found in OneDrive root.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Upload files using the "Upload Straight to Cloud" tab.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {oneDriveFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-indigo-400 transition-all hover:shadow-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {file.size || 'Document'} • Modified {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'recently'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Open</span>
                              </a>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file, 'onedrive')}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete from OneDrive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {onSelectFile ? (
                                <button
                                  type="button"
                                  onClick={() => handleSelectFileDirectly(file, 'onedrive')}
                                  disabled={learningFileId === file.id}
                                  className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-2xs"
                                >
                                  {learningFileId === file.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span>Select File</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleLearnFile(file, 'onedrive')}
                                  disabled={learningFileId === file.id}
                                  className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-2xs"
                                >
                                  {learningFileId === file.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{importMode === 'template' ? 'Learn Template' : 'Add Knowledge'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD STRAIGHT TO CLOUD */}
          {activeTab === 'upload-cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Target Cloud Destination</h4>
                  <p className="text-[11px] text-emerald-800">Choose which cloud drive you want to upload this file to:</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadTargetProvider('google')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      uploadTargetProvider === 'google'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTargetProvider('onedrive')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      uploadTargetProvider === 'onedrive'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Microsoft OneDrive
                  </button>
                </div>
              </div>

              <div className="relative rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-10 text-center hover:bg-emerald-50/60 transition-colors">
                <input
                  type="file"
                  accept=".docx,.pdf,.doc,.txt"
                  onChange={handleUploadStraightToCloud}
                  disabled={isUploading}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {isUploading ? <RefreshCw className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">
                  Drop Word (.docx), PDF, or text file here
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Files are saved straight to your dedicated{' '}
                  <strong>{uploadTargetProvider === 'google' ? '"Directorate Templates & Knowledge"' : '"RSIM Directorate Templates"'}</strong>{' '}
                  cloud folder and instantly analyzed.
                </p>
                <p className="text-[11px] text-emerald-800 font-semibold mt-2">
                  Learns font family (Times New Roman, Aptos, Arial), exact point sizes, margins, line spacing, and civil service tone automatically.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: IMPORT CLOUD SHARE LINK */}
          {activeTab === 'share-link' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900">Import Public or Shared Cloud Document Link</h4>
                </div>
                <p className="text-xs text-slate-500">
                  Paste any Google Doc link (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">docs.google.com/document/d/...</code>), Google Drive share link (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">drive.google.com/file/d/...</code>), or OneDrive share link (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">1drv.ms/...</code> / <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">onedrive.live.com</code>).
                </p>

                <div className="flex gap-2 pt-1">
                  <input
                    type="url"
                    value={shareLinkInput}
                    onChange={(e) => setShareLinkInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResolveShareLink()}
                    placeholder="https://docs.google.com/document/d/... or https://1drv.ms/w/s!..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveShareLink}
                    disabled={isResolvingLink || !shareLinkInput.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {isResolvingLink ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    <span>Resolve Link</span>
                  </button>
                </div>
              </div>

              {/* Resolved Preview Card */}
              {resolvedPreview && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900">{resolvedPreview.fileName}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        {resolvedPreview.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResolvedPreview(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-xl bg-white p-3 text-xs text-slate-700 border border-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                    {resolvedPreview.text.slice(0, 1000)}...
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveResolvedDocument}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{importMode === 'template' ? `Learn as ${targetType} Template` : 'Save to Knowledge Base'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SYNCED LIBRARY */}
          {activeTab === 'synced-items' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Templates & Documents Synced from Cloud</span>
                <span className="text-slate-500 font-normal">
                  {allTemplates.length} templates • {allKnowledge.length} knowledge items
                </span>
              </div>

              {allTemplates.length === 0 && allKnowledge.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  <FolderSync className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-medium">No cloud-synced items in your library yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Connect Google Drive or OneDrive and click "Learn Template" or "Add Knowledge" on any file.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{t.title}</span>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {t.documentType}
                            </span>
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                              {t.driveSource?.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                            {t.description}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Synced {t.driveSource?.syncedAt ? new Date(t.driveSource.syncedAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  ))}

                  {allKnowledge.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{k.title}</span>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {k.category}
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                              {k.driveSource?.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                            {k.summary}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Synced {k.driveSource?.syncedAt ? new Date(k.driveSource.syncedAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Secure Cloud Integration: Tokens stay strictly in your browser session storage.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
