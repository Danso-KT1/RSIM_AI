import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { storage } from './services/storage';
import { aiService } from './services/aiService';
import {
  UserProfile,
  Meeting,
  DocumentItem,
  ActionItem,
} from './types';
import { AppSidebar, NavItemKey } from './components/layout/AppSidebar';
import { TopNavigation } from './components/layout/TopNavigation';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ViewSkeleton } from './components/common/ViewSkeleton';
import { ToastContainer } from './components/common/Toast';

// ─── Lazy-load all heavy view chunks ──────────────────────────────────────────
// This trims the initial JS parse cost significantly. Each studio is only
// fetched when the user first navigates to it.
const DashboardView            = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const GeminiQAView             = lazy(() => import('./components/ai/GeminiQAView').then(m => ({ default: m.GeminiQAView })));
const AudioTranscriptionStudio = lazy(() => import('./components/audio/AudioTranscriptionStudio').then(m => ({ default: m.AudioTranscriptionStudio })));
const MinutesStudio            = lazy(() => import('./components/minutes/MinutesStudio').then(m => ({ default: m.MinutesStudio })));
const MinutesAndReportsStudio  = lazy(() => import('./components/minutes-reports/MinutesAndReportsStudio').then(m => ({ default: m.MinutesAndReportsStudio })));
const LettersAndMemosStudio    = lazy(() => import('./components/letters-memos/LettersAndMemosStudio').then(m => ({ default: m.LettersAndMemosStudio })));
const DocumentsWorkspace       = lazy(() => import('./components/documents/DocumentsWorkspace').then(m => ({ default: m.DocumentsWorkspace })));
const TemplatesManagerView     = lazy(() => import('./components/templates/TemplatesManagerView').then(m => ({ default: m.TemplatesManagerView })));
const SettingsView             = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const ReportStudio             = lazy(() => import('./components/reports/ReportStudio').then(m => ({ default: m.ReportStudio })));

// Modals are smaller but still lazy — they are not visible on first paint
const AICascadeMatrixModal  = lazy(() => import('./components/common/AICascadeMatrixModal').then(m => ({ default: m.AICascadeMatrixModal })));
const FreeAIModelsModal     = lazy(() => import('./components/common/FreeAIModelsModal').then(m => ({ default: m.FreeAIModelsModal })));
const BackupModal           = lazy(() => import('./components/common/BackupModal').then(m => ({ default: m.BackupModal })));
const DriveIntegrationModal = lazy(() => import('./components/common/DriveIntegrationModal').then(m => ({ default: m.DriveIntegrationModal })));
const CommandPalette        = lazy(() => import('./components/common/CommandPalette').then(m => ({ default: m.CommandPalette })));
const OfflineIndicator      = lazy(() => import('./components/common/OfflineIndicator').then(m => ({ default: m.OfflineIndicator })));
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Navigation & UI State ──────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<NavItemKey>('gemini-qa');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [cascadeModalOpen, setCascadeModalOpen] = useState(false);
  const [freeAiModalOpen, setFreeAiModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [initialAiPrompt, setInitialAiPrompt] = useState<string | undefined>(undefined);

  // ── Active Context for AI Grounding ───────────────────────────────────────
  const [activeContext, setActiveContext] = useState<{
    type: 'meeting' | 'document' | 'project' | 'knowledge';
    id: string;
    title: string;
  } | null>(null);

  // ── Selected document for direct navigation ────────────────────────────────
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);

  // ── Core Data Collections ──────────────────────────────────────────────────
  // Load once; reloadData() re-reads from localStorage on demand
  const [user, setUser] = useState<UserProfile>(() => storage.getUser());
  const [meetings, setMeetings] = useState<Meeting[]>(() => storage.getMeetings());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => storage.getDocuments());
  const [actionItems, setActionItems] = useState<ActionItem[]>(() => storage.getActionItems());

  // ── Memoized stable references ─────────────────────────────────────────────
  // Prevents child components from re-rendering when parent re-renders
  // but none of the actual data has changed.
  const memoizedDocuments = useMemo(() => documents, [documents]);
  const memoizedMeetings  = useMemo(() => meetings, [meetings]);

  // ── Reload from localStorage after mutations ───────────────────────────────
  const reloadData = useCallback(() => {
    setUser(storage.getUser());
    setMeetings(storage.getMeetings());
    setDocuments(storage.getDocuments());
    setActionItems(storage.getActionItems());
  }, []);

  // ── Keyboard shortcut: Ctrl/Cmd + K → Command Palette ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Sync client custom API keys (Groq, xAI, Gemini, etc.) to server on boot ──
  useEffect(() => {
    aiService.syncCustomKeysToServer();
  }, []);

  // ── Navigation callbacks ───────────────────────────────────────────────────
  const handleDocumentCreated = useCallback((docId: string) => {
    reloadData();
    setSelectedDocId(docId);
    setCurrentTab('documents');
  }, [reloadData]);

  const [activeStudioContent, setActiveStudioContent] = useState<{
    studio: 'letters' | 'memos' | 'minutes' | 'reports';
    content: string;
  } | null>(null);

  const handleUseTemplate = useCallback((studio: 'letters' | 'memos' | 'minutes' | 'reports', content: string) => {
    setActiveStudioContent({ studio, content });
    if (studio === 'letters' || studio === 'memos') {
      setCurrentTab('letters-memos');
    } else if (studio === 'minutes' || studio === 'reports') {
      setCurrentTab('minutes-reports');
    } else {
      setCurrentTab(studio as NavItemKey);
    }
  }, []);

  const handleNavigateToStudio = useCallback((studio: 'letters' | 'memos' | 'minutes' | 'reports', content?: string) => {
    if (content) {
      setActiveStudioContent({ studio, content });
    }
    if (studio === 'letters' || studio === 'memos') {
      setCurrentTab('letters-memos');
    } else if (studio === 'minutes' || studio === 'reports') {
      setCurrentTab('minutes-reports');
    } else {
      setCurrentTab(studio as NavItemKey);
    }
  }, []);

  const handleStartAIPrompt = useCallback((prompt: string) => {
    setInitialAiPrompt(prompt);
    setCurrentTab('gemini-qa');
  }, []);

  const handleSelectTab = useCallback((tab: NavItemKey) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* 1. Focused Institutional Navigation Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Main Application Workspace Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Navigation */}
        <TopNavigation
          user={user}
          activeContext={activeContext}
          onClearContext={() => setActiveContext(null)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenBackupModal={() => setBackupModalOpen(true)}
          onOpenCascadeModal={() => setCascadeModalOpen(true)}
          onOpenDriveModal={() => setDriveModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Dynamic Workspace Content — each view only mounts when active */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-3.5 sm:py-6 scrollbar-thin">
          <ErrorBoundary>
            <Suspense fallback={<ViewSkeleton label="Loading workspace..." />}>

              {currentTab === 'dashboard' && (
                <DashboardView
                  user={user}
                  meetings={memoizedMeetings}
                  documents={memoizedDocuments}
                  actionItems={actionItems}
                  onNavigate={(tab) => setCurrentTab(tab)}
                  onQuickPrompt={handleStartAIPrompt}
                  onDocumentsChanged={reloadData}
                  onOpenDocument={(id) => {
                    setSelectedDocId(id);
                    setCurrentTab('documents');
                  }}
                  onOpenCascadeModal={() => setCascadeModalOpen(true)}
                />
              )}

              {/* RSIM AI — GPT / Multi-AI Conversational Intelligence Hub */}
              {currentTab === 'gemini-qa' && (
                <GeminiQAView
                  documents={memoizedDocuments}
                  meetings={memoizedMeetings}
                  initialPrompt={initialAiPrompt}
                  onSendToStudio={handleNavigateToStudio}
                />
              )}

              {/* Primary Audio Transcription Workspace (Grok Voice 2.0) */}
              {currentTab === 'audio-transcribe' && (
                <AudioTranscriptionStudio
                  meetings={memoizedMeetings}
                  onMeetingsChanged={reloadData}
                  onNavigateToStudio={handleNavigateToStudio}
                  onDocumentCreated={handleDocumentCreated}
                />
              )}

              {/* Unified Minutes & Reports Studio */}
              {(currentTab === 'minutes-reports' || currentTab === 'minutes' || currentTab === 'reports') && (
                <MinutesAndReportsStudio
                  initialSubTab={currentTab === 'reports' ? 'reports' : 'minutes'}
                  initialContent={
                    activeStudioContent && (activeStudioContent.studio === 'minutes' || activeStudioContent.studio === 'reports')
                      ? (activeStudioContent as { studio: 'minutes' | 'reports'; content: string })
                      : null
                  }
                  onDocumentCreated={handleDocumentCreated}
                />
              )}

              {/* Unified Letters & Memos Studio */}
              {(currentTab === 'letters-memos' || currentTab === 'letters' || currentTab === 'memos') && (
                <LettersAndMemosStudio
                  initialSubTab={currentTab === 'memos' ? 'memos' : 'letters'}
                  initialContent={
                    activeStudioContent && (activeStudioContent.studio === 'letters' || activeStudioContent.studio === 'memos')
                      ? (activeStudioContent as { studio: 'letters' | 'memos'; content: string })
                      : null
                  }
                  onDocumentCreated={handleDocumentCreated}
                />
              )}

              {/* Documents Repository */}
              {currentTab === 'documents' && (
                <DocumentsWorkspace
                  documents={memoizedDocuments}
                  selectedDocumentId={selectedDocId}
                  onDocumentsChanged={reloadData}
                  onSetContext={setActiveContext}
                  onNavigateToStudio={handleNavigateToStudio}
                />
              )}

              {/* Workspace Settings */}
              {currentTab === 'settings' && (
                <SettingsView
                  user={user}
                  onUserChanged={(u) => setUser(u)}
                  onOpenBackupModal={() => setBackupModalOpen(true)}
                  onOpenDriveModal={() => setDriveModalOpen(true)}
                  onOpenFreeAIModelsModal={() => setFreeAiModalOpen(true)}
                  onOpenCascadeModal={() => setCascadeModalOpen(true)}
                />
              )}

              {/* Auxiliary View: Templates */}
              {currentTab === 'templates' && (
                <TemplatesManagerView
                  onUseTemplate={handleUseTemplate}
                />
              )}

            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* 3. Global Modal Systems — only render DOM nodes when open */}
      {backupModalOpen && (
        <Suspense fallback={null}>
          <BackupModal
            isOpen={backupModalOpen}
            onClose={() => setBackupModalOpen(false)}
            onDataChanged={reloadData}
          />
        </Suspense>
      )}

      {driveModalOpen && (
        <Suspense fallback={null}>
          <DriveIntegrationModal
            isOpen={driveModalOpen}
            onClose={() => setDriveModalOpen(false)}
            onTemplateLearned={reloadData}
            onKnowledgeLearned={reloadData}
          />
        </Suspense>
      )}

      {cascadeModalOpen && (
        <Suspense fallback={null}>
          <AICascadeMatrixModal
            isOpen={cascadeModalOpen}
            onClose={() => setCascadeModalOpen(false)}
          />
        </Suspense>
      )}

      {freeAiModalOpen && (
        <Suspense fallback={null}>
          <FreeAIModelsModal
            isOpen={freeAiModalOpen}
            onClose={() => setFreeAiModalOpen(false)}
          />
        </Suspense>
      )}

      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSelectAction={(action, tab) => {
              if (action === 'open-drive-sync') {
                setDriveModalOpen(true);
              } else if (action === 'open-cascade-matrix') {
                setCascadeModalOpen(true);
              } else if (action === 'ask-gemini') {
                setCurrentTab('gemini-qa');
              } else if (tab) {
                setCurrentTab(tab);
              }
              setCommandPaletteOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* 4. Progressive Web App Offline Connectivity Indicator */}
      <Suspense fallback={null}>
        <OfflineIndicator />
      </Suspense>

      {/* 5. Global Toast Notification System */}
      <ToastContainer />
    </div>
  );
}
