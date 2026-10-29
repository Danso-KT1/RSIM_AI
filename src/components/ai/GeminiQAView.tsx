import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowUp,
  User,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Search,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Plus,
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Square,
  Paperclip,
  Clock,
  Compass,
  Layers,
  Sparkle,
  Sun,
  Moon,
  Palette,
  ShieldCheck,
  Building2,
  Image as ImageIcon,
  FileText,
  X,
  Edit2,
  ArrowDown,
  Cloud,
  Send,
  BookOpen,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import {
  ChatMessage,
  ChatSession,
  DocumentItem,
  Meeting,
  ChatAttachment,
} from '../../types';
import { aiService, detectDocumentFormatIntent } from '../../services/aiService';
import { WordDocumentViewer } from '../documents/WordDocumentViewer';
import { storage } from '../../services/storage';
import { VoiceInput } from '../common/VoiceInput';
import { WordFormattedResponse } from '../common/WordFormattedResponse';
import { HUGGINGFACE_MODELS, DEFAULT_HF_MODEL } from '../../constants/aiModels';
import { exportToDocx } from '../../utils/docxExporter';
import { uploadFileToDrive, getAccessToken, DriveFileInfo } from '../../services/driveService';
import { attachmentService } from '../../services/attachmentService';
import { DriveIntegrationModal } from '../common/DriveIntegrationModal';

interface GeminiQAViewProps {
  documents: DocumentItem[];
  meetings: Meeting[];
  initialPrompt?: string;
  onSendToStudio?: (studio: 'letters' | 'memos' | 'minutes' | 'reports', content: string) => void;
  onNavigateToTranscribe?: () => void;
}

export type RsimTheme = 'system' | 'dark' | 'emerald';

export const GeminiQAView: React.FC<GeminiQAViewProps> = ({
  documents = [],
  meetings = [],
  initialPrompt = '',
  onSendToStudio,
  onNavigateToTranscribe,
}) => {
  // Theme Switching (System / Light by default matching host app, Dark, Emerald)
  const [theme, setTheme] = useState<RsimTheme>(() => {
    const saved = localStorage.getItem('rsim_ai_theme');
    if (saved === 'dark' || saved === 'emerald' || saved === 'system') {
      return saved;
    }
    return 'system';
  });
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  const handleSelectTheme = (newTheme: RsimTheme) => {
    setTheme(newTheme);
    localStorage.setItem('rsim_ai_theme', newTheme);
    setIsThemeDropdownOpen(false);
  };

  // Chat Sessions & Conversations
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // AI Model Selection & Options
  const INSTITUTIONAL_MODELS = [
    { id: 'gemini-3.8-flash', name: 'RSIM Gemini 3.8 Flash', tag: 'Fast Search Grounded', badge: 'Grounding Fast' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Deep Analytical Logic', badge: 'Frontier Logic' },
    { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI)', tag: 'Flagship Intelligence', badge: 'Executive Intelligence' },
    { id: 'groq/llama-3.3-70b', name: 'Llama 3.3 70B (Groq)', tag: 'Ultra-Fast 500 tok/s', badge: 'High Speed' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', tag: 'Technical Synthesis', badge: 'Deep Reasoning' },
  ];

  const HF_MODELS = HUGGINGFACE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    tag: m.description,
    badge: 'Hugging Face Open Model',
  }));

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('rsim_selected_model');
    if (saved) return saved;
    const hf = localStorage.getItem('hf_preferred_model');
    if (hf) return hf;
    return 'gemini-3.8-flash';
  });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('rsim_selected_model', modelId);
    if (
      modelId.startsWith('meta-llama') ||
      modelId.startsWith('Qwen') ||
      modelId.startsWith('google/gemma') ||
      modelId.startsWith('mistralai')
    ) {
      localStorage.setItem('hf_preferred_model', modelId);
    }
    setIsModelDropdownOpen(false);
  };

  // Input & Context
  const [inputQuestion, setInputQuestion] = useState(initialPrompt);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(() => {
    const saved = localStorage.getItem('rsim_use_web_search');
    return saved !== null ? saved === 'true' : true;
  });

  // Microsoft Word Document Viewer Modal State
  const [wordViewerModal, setWordViewerModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    docType?: string;
  } | null>(null);

  // Real-time matched template based on prompt keywords and attachments (Google Drive priority)
  const [liveMatchedTemplate, setLiveMatchedTemplate] = useState<{
    template: any | null;
    score: number;
    reason: string;
    detectedType?: 'Report' | 'Minutes' | 'Memo' | 'Letter';
    matchedKeyword?: string;
  } | null>(null);

  useEffect(() => {
    const combinedQuery = (
      inputQuestion +
      ' ' +
      pendingAttachments.map((a) => a.name + ' ' + (a.text || '').slice(0, 300)).join(' ')
    ).trim();

    if (!combinedQuery || combinedQuery.length < 3) {
      setLiveMatchedTemplate(null);
      return;
    }

    const timer = setTimeout(() => {
      // 1. Search for keyword to know the document type
      const detection = detectDocumentFormatIntent(inputQuestion);
      const allTemplates = storage.getTemplates();

      // Priority 1: Match Google Drive template corresponding to the detected document type
      let driveMatch: any = null;
      if (detection.confidence === 'high' || detection.matchedKeyword) {
        if (detection.detectedType === 'Report') {
          // Look for Google Drive Stakeholder Report or general Drive Report
          driveMatch =
            allTemplates.find(
              (t) =>
                (t.source === 'google_drive' || Boolean(t.driveSource)) &&
                (/stakeholder|harmonisa?tion/i.test(t.title) || t.documentType === 'Report' || t.category === 'reports')
            ) ||
            allTemplates.find((t) => t.source === 'google_drive' || Boolean(t.driveSource));
        } else {
          driveMatch = allTemplates.find(
            (t) =>
              (t.source === 'google_drive' || Boolean(t.driveSource)) &&
              (t.documentType === detection.detectedType ||
                (t.category || '').toLowerCase().includes(detection.detectedType.toLowerCase()))
          );
        }
      }

      // Priority 2: Use findBestMatchingTemplate
      const match = aiService.findBestMatchingTemplate(combinedQuery, allTemplates);
      const selectedTemplate = driveMatch || match.template;

      if (selectedTemplate) {
        const isDrive = selectedTemplate.source === 'google_drive' || Boolean(selectedTemplate.driveSource);
        setLiveMatchedTemplate({
          template: selectedTemplate,
          score: match.score || 85,
          reason: isDrive
            ? `Google Drive template matched for ${detection.detectedType || selectedTemplate.documentType} (Keyword: "${detection.matchedKeyword || 'intent'}")`
            : match.reason,
          detectedType: detection.detectedType || (selectedTemplate.documentType as any) || 'Report',
          matchedKeyword: detection.matchedKeyword,
        });
      } else {
        setLiveMatchedTemplate(null);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [inputQuestion, pendingAttachments]);

  // Workspace Internal Search Modal (Docs, Templates, Meetings)
  const [isWorkspaceSearchOpen, setIsWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<{
    totalMatches: number;
    documents: Array<{ item: DocumentItem; score: number; snippet: string }>;
    templates: Array<{ item: any; score: number; snippet: string; isDrive: boolean }>;
    meetings: Array<{ item: Meeting; score: number; snippet: string }>;
  } | null>(null);

  useEffect(() => {
    if (!workspaceSearchQuery.trim()) {
      setWorkspaceSearchResults(null);
      return;
    }
    const res = aiService.searchWorkspace(workspaceSearchQuery, { documents, meetings });
    setWorkspaceSearchResults(res);
  }, [workspaceSearchQuery, documents, meetings]);

  // Attach context modal or selection
  const [attachedContext, setAttachedContext] = useState<{ type: 'document' | 'meeting' | 'template'; id: string; title: string } | null>(null);
  const [isAttachOpen, setIsAttachOpen] = useState(false);

  // File and Image Attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [audioRedirectPrompt, setAudioRedirectPrompt] = useState<{ show: boolean; fileName: string } | null>(null);
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);

  const selectedModelSupportsVision = () => {
    const id = selectedModel.toLowerCase();
    return id.includes('gemini') || id.includes('gpt-4o') || id.includes('claude');
  };
  const hasImageAttached = pendingAttachments.some((a) => a.type?.startsWith('image/'));
  const showVisionWarning = hasImageAttached && !selectedModelSupportsVision();

  // Generation & Status
  const [isLoading, setIsLoading] = useState(false);
  const [searchPhaseText, setSearchPhaseText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedSourcesMsgId, setExpandedSourcesMsgId] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike'>>(() => {
    try {
      const saved = localStorage.getItem('rsim_chat_feedback');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScroll = useRef<boolean>(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Load chat sessions from storage on mount
  useEffect(() => {
    const saved = storage.getChats();
    if (saved && saved.length > 0) {
      setSessions(saved);
      setCurrentSessionId(saved[0].id);
    } else {
      handleCreateNewChat();
    }
  }, []);

  // Update input if initialPrompt changes
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setInputQuestion(initialPrompt);
    }
  }, [initialPrompt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessions, currentSessionId, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputQuestion]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const currentMessages = currentSession?.messages || [];

  // Create New Chat Session
  const handleCreateNewChat = () => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat',
      mode: 'General Assistant',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    storage.saveChat(newSession);
    setInputQuestion('');
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  // Delete Chat Session
  const handleDeleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.deleteChat(sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (currentSessionId === sessionId) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
      } else {
        handleCreateNewChat();
      }
    }
  };

  // Toggle Web Search
  const handleToggleWebSearch = () => {
    const nextVal = !useWebSearch;
    setUseWebSearch(nextVal);
    localStorage.setItem('rsim_use_web_search', String(nextVal));
  };

  // Feedback handler (stored locally)
  const handleFeedback = (msgId: string, type: 'like' | 'dislike') => {
    setFeedback((prev) => {
      const current = prev[msgId];
      const nextVal = current === type ? undefined : type;
      const next = { ...prev };
      if (nextVal) {
        next[msgId] = nextVal;
      } else {
        delete next[msgId];
      }
      localStorage.setItem('rsim_chat_feedback', JSON.stringify(next));
      return next;
    });
  };

  // Auto-scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScroll.current = isNearBottom;
    setUserScrolledUp(!isNearBottom);
  };

  const scrollToBottom = () => {
    shouldAutoScroll.current = true;
    setUserScrolledUp(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setSearchPhaseText('');
  };

  // File and Image Upload handler using client-side attachmentService
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsReadingFiles(true);

    try {
      const newAttachments: ChatAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parsed = await attachmentService.parseFile(file);
        if (parsed.error) {
          alert(parsed.error);
          continue;
        }
        if (parsed.isAudio) {
          setAudioRedirectPrompt({ show: true, fileName: parsed.name });
          continue;
        }
        newAttachments.push({
          name: parsed.name,
          type: parsed.type,
          size: parsed.size,
          text: parsed.text,
          base64: parsed.base64,
          dataUrl: parsed.dataUrl,
        });
      }
      if (newAttachments.length > 0) {
        setPendingAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (err: any) {
      console.warn('File processing error:', err);
      alert('Error reading file. Please ensure file is valid.');
    } finally {
      setIsReadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Attach cloud file selected from Cloud Hub modal
  const handleCloudFileSelected = async (file: DriveFileInfo, downloaded: any) => {
    setIsReadingFiles(true);
    try {
      const parsed = await attachmentService.parseDriveFile(
        file.name,
        file.mimeType,
        downloaded.text,
        downloaded.arrayBuffer
      );
      setPendingAttachments((prev) => [
        ...prev,
        {
          name: parsed.name,
          type: parsed.type,
          size: parsed.size,
          text: parsed.text,
          base64: parsed.base64,
          dataUrl: parsed.dataUrl,
        },
      ]);
    } catch (err: any) {
      console.warn('Cloud file attachment error:', err);
      alert('Could not attach cloud file: ' + (err.message || 'Unknown error'));
    } finally {
      setIsReadingFiles(false);
    }
  };

  // Main submission handler with Streaming, Multi-Turn Attachment Retention, and Google Search Grounding
  const handleAskQuestion = async (customQuestion?: string) => {
    const rawQuestion = (customQuestion !== undefined ? customQuestion : inputQuestion).trim();
    const currentAttachments = [...pendingAttachments];
    if ((!rawQuestion && currentAttachments.length === 0) || isLoading || isReadingFiles) return;

    const effectivePrompt =
      rawQuestion ||
      'Please analyze and summarize the attached document(s) in detail, extracting key findings, decisions, figures, and action points.';

    setInputQuestion('');
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let session = currentSession;
    if (!session) {
      handleCreateNewChat();
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: rawQuestion || `Uploaded ${currentAttachments.length} file(s) for analysis.`,
      createdAt: new Date().toISOString(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      context: attachedContext ? { type: attachedContext.type, id: attachedContext.id, title: attachedContext.title } : undefined,
      isWebSearch: useWebSearch,
    };

    let sessionTitle = session.title;
    if (session.messages.length === 0 || session.title === 'New Chat') {
      sessionTitle = (rawQuestion || currentAttachments[0]?.name || 'Chat').slice(0, 32);
    }

    const aiMsgId = `msg_a_${Date.now()}`;
    const aiPlaceholder: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      modelUsed: selectedModel,
      createdAt: new Date().toISOString(),
    };

    const sessionWithBoth: ChatSession = {
      ...session,
      title: sessionTitle,
      messages: [...session.messages, userMsg, aiPlaceholder],
      updatedAt: new Date().toISOString(),
    };

    setSessions((prev) => prev.map((s) => (s.id === session.id ? sessionWithBoth : s)));
    storage.saveChat(sessionWithBoth);

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Context from attachments or attached items
    let contextText = '';
    if (attachedContext) {
      if (attachedContext.type === 'document') {
        const doc = documents.find((d) => d.id === attachedContext.id);
        if (doc) {
          contextText += `ATTACHED DOCUMENT (${doc.title}):\n"""\n${doc.content}\n"""\n\n`;
        }
      } else if (attachedContext.type === 'meeting') {
        const m = meetings.find((item) => item.id === attachedContext.id);
        if (m && m.transcript?.length) {
          const raw = m.transcript.map((s) => `[${s.speaker}]: ${s.text}`).join('\n');
          contextText += `ATTACHED TRANSCRIPT (${m.title}):\n"""\n${raw.slice(0, 20000)}\n"""\n\n`;
        }
      } else if (attachedContext.type === 'template') {
        const tpl = storage.getTemplates().find((t) => t.id === attachedContext.id);
        if (tpl) {
          contextText += `ATTACHED TEMPLATE BLUEPRINT (${tpl.title}):\n"""\n${tpl.content}\n"""\nYou MUST structure your answer adhering strictly to this institutional template.\n\n`;
        }
      }
    } else if (liveMatchedTemplate?.template) {
      const t = liveMatchedTemplate.template;
      contextText += `AUTO-MATCHED INSTITUTIONAL TEMPLATE (${t.title || t.name}):\n"""\n${t.content}\n"""\nAdhere strictly to this template format, sections, and style.\n\n`;
    }

    // Collect all attachments from current upload AND prior messages in this session
    // so attachments remain available for follow-up turns in the same chat
    const allSessionAttachments: ChatAttachment[] = [];
    const seenAttachmentNames = new Set<string>();

    for (const att of currentAttachments) {
      if (!seenAttachmentNames.has(att.name)) {
        seenAttachmentNames.add(att.name);
        allSessionAttachments.push(att);
      }
    }

    for (const m of session.messages) {
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          if (!seenAttachmentNames.has(att.name)) {
            seenAttachmentNames.add(att.name);
            allSessionAttachments.push(att);
          }
        }
      }
    }

    if (allSessionAttachments.length > 0) {
      contextText += `\nINSTRUCTION FOR ATTACHED DOCUMENTS:
You have access to the user's attached documents. Answer using the attached material. If an answer cannot be found in the attached material, state clearly: "[Not stated in attached document]".\n\n`;
    }

    // Keyword-based document intent detection & Google Drive template matching
    const detectedIntent = detectDocumentFormatIntent(
      effectivePrompt,
      allSessionAttachments.map((a) => a.name).join(' ')
    );

    const allTemplates = storage.getTemplates();
    let chosenTemplate = liveMatchedTemplate?.template;

    if (!chosenTemplate && (detectedIntent.confidence === 'high' || /report|minutes|memo|letter|write|draft|prepare|generate/i.test(effectivePrompt))) {
      const targetCategory = detectedIntent.detectedType.toLowerCase();
      // Priority 1: Google Drive template matching the detected category
      chosenTemplate = allTemplates.find(
        (t) =>
          t.source === 'google_drive' &&
          (t.category?.toLowerCase() === targetCategory ||
            t.title.toLowerCase().includes(targetCategory) ||
            (targetCategory === 'report' && t.title.toLowerCase().includes('report')))
      );

      // Priority 2: Any Google Drive template
      if (!chosenTemplate) {
        chosenTemplate = allTemplates.find((t) => t.source === 'google_drive');
      }

      // Priority 3: Any local template matching the category
      if (!chosenTemplate) {
        chosenTemplate = allTemplates.find(
          (t) =>
            t.category?.toLowerCase() === targetCategory ||
            t.title.toLowerCase().includes(targetCategory)
        );
      }
    }

    if (chosenTemplate) {
      const structuralSkeleton = aiService.extractStructuralSkeleton(
        chosenTemplate.content,
        chosenTemplate.templateSpec,
        detectedIntent.detectedType
      );
      contextText += `\nINSTITUTIONAL DOCUMENT BLUEPRINT MANDATE (${chosenTemplate.title}${chosenTemplate.source === 'google_drive' ? ' - from Google Drive' : ''}):
You MUST adopt and follow the exact structure, tone, format, section numbering, decimal/Roman hierarchies, and formal civil service phrasing of this template:
"""
${chosenTemplate.content}
"""

STRUCTURAL SKELETON & SECTIONS TO REPRODUCE:
${structuralSkeleton}

TRANSCRIPTION & FACTUAL CAPTURE MANDATE:
Synthesize all specific facts, dates, attendees, metrics, discussion points, speaker statements, and decisions from the attached transcript/files into the template sections. Capture every detail and do NOT fabricate facts.\n\n`;
    }

    const isGreeting = /^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening))\b/i.test(effectivePrompt);
    const shouldSearch = !isGreeting && useWebSearch;

    if (shouldSearch) {
      setSearchPhaseText('Searching Google...');
    } else {
      setSearchPhaseText('Writing answer...');
    }

    // Conversational multi-turn history with attachment context retained
    const historyPayload = session.messages.slice(-10).map((m) => {
      let content = m.content;
      if (m.attachments && m.attachments.length > 0) {
        const attBlocks = m.attachments
          .filter((a) => a.text)
          .map((a) => `[ATTACHED FILE: ${a.name}]\n${(a.text || '').slice(0, 15000)}\n[END ATTACHED FILE]`)
          .join('\n\n');
        if (attBlocks && !content.includes('[ATTACHED FILE:')) {
          content = `${attBlocks}\n\n${content}`;
        }
      }
      return {
        role: m.role as 'user' | 'assistant',
        content,
      };
    });

    let streamedText = '';
    let finalSources: Array<{ uri: string; title: string }> = [];
    let finalQueries: string[] = [];
    let isGrounded = false;
    let searchEntryPointHtml: string | undefined = undefined;

    try {
      const response = await aiService.completeStream(
        effectivePrompt,
        {
          onStatus: (status) => {
            setSearchPhaseText(status.message);
          },
          onDelta: (delta) => {
            streamedText += delta;
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== session.id) return s;
                return {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === aiMsgId ? { ...m, content: streamedText } : m
                  ),
                };
              })
            );
            if (shouldAutoScroll.current) {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
          },
          onGrounding: (gData) => {
            finalSources = gData.sources;
            finalQueries = gData.webSearchQueries || [];
            isGrounded = gData.isGrounded;
            searchEntryPointHtml = gData.searchEntryPointHtml;
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== session.id) return s;
                return {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === aiMsgId
                      ? {
                          ...m,
                          groundingSources: finalSources,
                          webSearchQueries: finalQueries,
                          isGrounded,
                          searchEntryPointHtml,
                        }
                      : m
                  ),
                };
              })
            );
          },
        },
        {
          systemInstruction: contextText || undefined,
          useSearchGrounding: shouldSearch,
          history: historyPayload,
          model: selectedModel,
          attachments: allSessionAttachments.map((a) => ({
            name: a.name,
            type: a.type,
            size: a.size,
            base64: a.base64,
            text: a.text,
          })),
          signal: abortControllerRef.current.signal,
        }
      );

      const isDocumentDraft = Boolean(
        chosenTemplate ||
        detectedIntent.confidence === 'high' ||
        /report|minutes|memo|letter/i.test(effectivePrompt)
      );

      const finalMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: response.text || streamedText,
        groundingSources: response.groundingSources || (finalSources.length > 0 ? finalSources : undefined),
        webSearchQueries: response.webSearchQueries || (finalQueries.length > 0 ? finalQueries : (shouldSearch ? [effectivePrompt] : undefined)),
        isGrounded: Boolean(response.isGrounded || finalSources.length > 0),
        modelUsed: response.modelUsed || selectedModel,
        searchEntryPointHtml,
        documentMeta: isDocumentDraft
          ? {
              isDocument: true,
              documentType: detectedIntent.detectedType || 'Report',
              templateUsedTitle: chosenTemplate?.title || `${detectedIntent.detectedType} Institutional Standard`,
              isGoogleDrive: chosenTemplate?.source === 'google_drive',
              title: `${detectedIntent.detectedType} - ${new Date().toLocaleDateString()}`,
            }
          : undefined,
        createdAt: new Date().toISOString(),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== session.id) return s;
          const updated = {
            ...s,
            messages: s.messages.map((m) => (m.id === aiMsgId ? finalMsg : m)),
            updatedAt: new Date().toISOString(),
          };
          storage.saveChat(updated);
          return updated;
        })
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== session.id) return s;
            const updated = {
              ...s,
              messages: s.messages.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content: streamedText ? `${streamedText}\n\n*(Generation stopped)*` : '*(Generation stopped)*',
                    }
                  : m
              ),
              updatedAt: new Date().toISOString(),
            };
            storage.saveChat(updated);
            return updated;
          })
        );
      } else {
        console.error('Chat error:', err);
        const errMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: `⚠️ I encountered a momentary connection issue. Please retry your query.`,
          createdAt: new Date().toISOString(),
          modelUsed: selectedModel,
        };
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== session.id) return s;
            const updated = {
              ...s,
              messages: s.messages.map((m) => (m.id === aiMsgId ? errMsg : m)),
              updatedAt: new Date().toISOString(),
            };
            storage.saveChat(updated);
            return updated;
          })
        );
      }
    } finally {
      setIsLoading(false);
      setSearchPhaseText('');
      setAttachedContext(null);
      abortControllerRef.current = null;
    }
  };

  // Copy helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Text to speech
  const handleReadAloud = (id: string, text: string) => {
    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Regenerate message
  const handleRegenerate = (msgIndex: number) => {
    if (!currentSession || isLoading) return;
    const userMessage = currentSession.messages[msgIndex - 1];
    if (userMessage && userMessage.role === 'user') {
      const truncatedMessages = currentSession.messages.slice(0, msgIndex - 1);
      const truncatedSession = { ...currentSession, messages: truncatedMessages };
      setSessions((prev) => prev.map((s) => (s.id === currentSession.id ? truncatedSession : s)));
      if (userMessage.attachments) {
        setPendingAttachments(userMessage.attachments);
      }
      handleAskQuestion(userMessage.content);
    }
  };

  // Suggestions for empty state (tailored to user's exact ministerial search and institutional mandate)
  const starterPrompts = [
    {
      title: 'What is RSIM?',
      desc: 'Research, Statistics & Information Management Directorate at the Ministry',
      icon: '🏛️',
    },
    {
      title: 'RSIM meaning at the Ministry of Communications, Digital Technology and Innovations (MoCDTI)',
      desc: 'Official statutory mandate, 4 divisions, and sector agency oversight',
      icon: '🔍',
    },
    {
      title: 'Latest Public Sector AI & Digital Governance',
      desc: 'Current 2026 digital public infrastructure policies and standards',
      icon: '🌐',
    },
    {
      title: 'Telecommunications & Broadband Metrics',
      desc: 'Authoritative data on cellular penetration and subscriber indices',
      icon: '📊',
    },
  ];

  // Theme styling configurations
  const themeStyles = {
    system: {
      wrapper: 'bg-slate-100 text-slate-800',
      sidebar: 'bg-white border-r border-slate-200 text-slate-800',
      sidebarHeader: 'border-b border-slate-200/80',
      sidebarBrandText: 'text-slate-900',
      sidebarNewChatBtn: 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-800',
      sidebarItemActive: 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-2xs',
      sidebarItemInactive: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      mainArea: 'bg-slate-50/80',
      header: 'bg-white border-b border-slate-200/90 text-slate-800',
      pillBtn: 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs',
      dropdownBg: 'bg-white border border-slate-200 shadow-xl text-slate-800',
      dropdownItem: 'hover:bg-slate-100 text-slate-700',
      dropdownItemActive: 'bg-emerald-50 text-emerald-800 font-semibold',
      emptyHero: 'text-slate-900',
      emptyDesc: 'text-slate-500',
      promptCard: 'bg-white hover:bg-slate-50/90 border border-slate-200/90 text-slate-800 shadow-xs hover:border-emerald-500/50 hover:shadow-sm',
      assistantBubble: 'bg-white border border-slate-200/90 text-slate-900 shadow-xs rounded-2xl',
      userBubble: 'bg-slate-900 text-white rounded-3xl shadow-sm',
      sourceCard: 'bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800',
      inputContainer: 'bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent',
      inputCard: 'bg-white border border-slate-300 shadow-xl focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
      inputTextarea: 'text-slate-900 placeholder:text-slate-400',
      bottomDisclaimer: 'text-slate-500',
    },
    dark: {
      wrapper: 'bg-[#212121] text-slate-100',
      sidebar: 'bg-[#171717] border-r border-white/10 text-slate-200',
      sidebarHeader: 'border-b border-white/5',
      sidebarBrandText: 'text-white',
      sidebarNewChatBtn: 'bg-[#212121] hover:bg-[#2f2f2f] border-white/10 text-white',
      sidebarItemActive: 'bg-[#212121] text-white font-medium border border-white/10 shadow-xs',
      sidebarItemInactive: 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      mainArea: 'bg-[#212121]',
      header: 'bg-[#171717] border-b border-white/5 text-white',
      pillBtn: 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200',
      dropdownBg: 'bg-[#2f2f2f] border border-white/15 shadow-2xl text-slate-100',
      dropdownItem: 'hover:bg-white/5 text-slate-300',
      dropdownItemActive: 'bg-white/15 text-white font-bold',
      emptyHero: 'text-white',
      emptyDesc: 'text-slate-400',
      promptCard: 'bg-[#2f2f2f]/80 hover:bg-[#2f2f2f] border border-white/10 text-slate-200 hover:border-white/20',
      assistantBubble: 'bg-[#2a2a2a]/60 border border-white/10 text-slate-100 shadow-xs rounded-2xl',
      userBubble: 'bg-[#2f2f2f] text-white rounded-3xl border border-white/10 shadow-sm',
      sourceCard: 'bg-[#2f2f2f]/60 hover:bg-[#2f2f2f] border border-white/10 text-slate-200',
      inputContainer: 'bg-gradient-to-t from-[#212121] via-[#212121] to-transparent',
      inputCard: 'bg-[#2f2f2f] border border-white/10 shadow-2xl focus-within:border-white/25',
      inputTextarea: 'text-white placeholder:text-slate-400',
      bottomDisclaimer: 'text-slate-500',
    },
    emerald: {
      wrapper: 'bg-slate-950 text-slate-100',
      sidebar: 'bg-slate-900 border-r border-emerald-900/40 text-slate-200',
      sidebarHeader: 'border-b border-emerald-900/30',
      sidebarBrandText: 'text-emerald-100',
      sidebarNewChatBtn: 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-800/50 text-emerald-100',
      sidebarItemActive: 'bg-emerald-950/80 text-emerald-200 font-semibold border border-emerald-600/40 shadow-xs',
      sidebarItemInactive: 'text-slate-400 hover:bg-emerald-950/30 hover:text-emerald-200',
      mainArea: 'bg-slate-950',
      header: 'bg-slate-900 border-b border-emerald-900/40 text-emerald-100',
      pillBtn: 'bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-200 shadow-2xs',
      dropdownBg: 'bg-slate-900 border border-emerald-800/50 shadow-2xl text-slate-100',
      dropdownItem: 'hover:bg-emerald-950/60 text-slate-300',
      dropdownItemActive: 'bg-emerald-900/60 text-emerald-200 font-bold',
      emptyHero: 'text-white',
      emptyDesc: 'text-emerald-200/70',
      promptCard: 'bg-slate-900/90 hover:bg-emerald-950/60 border border-emerald-900/50 text-slate-200 hover:border-emerald-500/50 shadow-xs',
      assistantBubble: 'bg-slate-900/90 border border-emerald-800/40 text-slate-100 shadow-md rounded-2xl',
      userBubble: 'bg-emerald-800 text-white rounded-3xl border border-emerald-600/50 shadow-sm',
      sourceCard: 'bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/40 text-emerald-200',
      inputContainer: 'bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent',
      inputCard: 'bg-slate-900 border border-emerald-700/50 shadow-2xl focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20',
      inputTextarea: 'text-white placeholder:text-slate-400',
      bottomDisclaimer: 'text-emerald-300/60',
    },
  };

  const currentTheme = themeStyles[theme];

  return (
    <div className={`flex h-full w-full overflow-hidden font-sans transition-colors duration-200 ${currentTheme.wrapper}`}>
      {/* 1. LEFT SIDEBAR */}
      <aside
        className={`flex flex-col transition-all duration-300 z-20 ${currentTheme.sidebar} ${
          isSidebarOpen ? 'w-64 min-w-[16rem]' : 'w-0 min-w-0 overflow-hidden border-none'
        }`}
      >
        {/* Brand Header: RSIM AI */}
        <div className={`p-3.5 flex items-center justify-between ${currentTheme.sidebarHeader}`}>
          <div className="flex items-center gap-2.5 px-1.5 font-bold text-sm tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md">
              <Sparkles className="h-4.5 w-4.5 text-slate-950" />
            </div>
            <div>
              <div className={`text-sm font-bold leading-none ${currentTheme.sidebarBrandText}`}>RSIM AI</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mt-0.5">
                Directorate
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateNewChat}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
            title="Start New Chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={handleCreateNewChat}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full border text-xs font-semibold transition-all shadow-xs group ${currentTheme.sidebarNewChatBtn}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-500 transition-colors" />
              <span>New chat</span>
            </div>
            <Plus className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-500 transition-colors" />
          </button>
        </div>

        {/* Navigation Shortcuts */}
        <div className="px-3 py-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <div
            onClick={() => handleAskQuestion('What is RSIM?')}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>RSIM Directorate Overview</span>
          </div>
          <div
            onClick={() => handleAskQuestion('RSIM meaning at the Ministry of Communications, Digital Technology and Innovations (MoCDTI)')}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <Search className="h-3.5 w-3.5 text-blue-500" />
            <span>Verify RSIM Mandate</span>
          </div>
          <div
            onClick={() => handleAskQuestion('2026 Telecommunications & Sector Data Intelligence')}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <Compass className="h-3.5 w-3.5 text-teal-500" />
            <span>Sector Statistics (NCA)</span>
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Recent Conversations
          </div>
          {sessions.map((s) => {
            const isActive = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive ? currentTheme.sidebarItemActive : currentTheme.sidebarItemInactive
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{s.title || 'Untitled Chat'}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteChat(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Web Search status in sidebar */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className={`h-3.5 w-3.5 ${useWebSearch ? 'text-blue-500' : 'text-slate-400'}`} />
            <span>Live Search Grounding:</span>
          </div>
          <span className={`font-bold ${useWebSearch ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            {useWebSearch ? 'Active' : 'Off'}
          </span>
        </div>
      </aside>

      {/* 2. MAIN CHAT AREA */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentTheme.mainArea}`}>
        {/* Top Navigation Bar */}
        <header className={`h-14 px-4 flex items-center justify-between shrink-0 ${currentTheme.header}`}>
          <div className="flex items-center gap-2.5">
            {/* Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
              title="Toggle sidebar"
            >
              <Layers className="h-4 w-4" />
            </button>

            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setIsThemeDropdownOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${currentTheme.pillBtn}`}
              >
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <span className="max-w-[170px] truncate">
                  {[...INSTITUTIONAL_MODELS, ...HF_MODELS].find((m) => m.id === selectedModel)?.name || 'RSIM Gemini 3.8 Flash'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {isModelDropdownOpen && (
                <div className={`absolute left-0 mt-2 w-80 rounded-2xl p-2 z-50 animate-in fade-in max-h-96 overflow-y-auto ${currentTheme.dropdownBg}`}>
                  {/* Institutional & Frontier Section */}
                  <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                    <span>Directorate & Frontier AI</span>
                    <span className="text-[9px] font-normal opacity-70">Primary Cascade</span>
                  </div>
                  <div className="space-y-0.5 my-1">
                    {INSTITUTIONAL_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          selectedModel === m.id ? currentTheme.dropdownItemActive : currentTheme.dropdownItem
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{m.name}</div>
                          <div className="text-[10px] opacity-75 truncate">{m.tag}</div>
                        </div>
                        {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {/* Hugging Face Open Source Models */}
                  <div className="mt-2.5 pt-2 px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 border-t border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                    <span>Hugging Face Models (HF_TOKEN)</span>
                    <span className="text-[9px] font-normal opacity-70">Open Weights</span>
                  </div>
                  <div className="space-y-0.5 my-1">
                    {HF_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          selectedModel === m.id ? currentTheme.dropdownItemActive : currentTheme.dropdownItem
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{m.name}</div>
                          <div className="text-[10px] opacity-75 truncate">{m.tag}</div>
                        </div>
                        {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Theme Switcher & Search Toggle */}
          <div className="flex items-center gap-2">
            {/* Theme Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsThemeDropdownOpen(!isThemeDropdownOpen);
                  setIsModelDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${currentTheme.pillBtn}`}
                title="Change Interface Theme"
              >
                {theme === 'system' && <Sun className="h-3.5 w-3.5 text-amber-500" />}
                {theme === 'dark' && <Moon className="h-3.5 w-3.5 text-indigo-400" />}
                {theme === 'emerald' && <Palette className="h-3.5 w-3.5 text-emerald-500" />}
                <span className="capitalize">{theme === 'system' ? 'System Theme' : theme === 'dark' ? 'Dark Mode' : 'Emerald Theme'}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {isThemeDropdownOpen && (
                <div className={`absolute right-0 mt-2 w-52 rounded-2xl p-1.5 z-50 animate-in fade-in ${currentTheme.dropdownBg}`}>
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-black/5 dark:border-white/10">
                    Display Theme
                  </div>
                  <div className="space-y-1 mt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectTheme('system')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        theme === 'system' ? currentTheme.dropdownItemActive : currentTheme.dropdownItem
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <div className="flex-1">
                        <div className="font-semibold">System / Light</div>
                        <div className="text-[10px] opacity-75">Matches system background</div>
                      </div>
                      {theme === 'system' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTheme('dark')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        theme === 'dark' ? currentTheme.dropdownItemActive : currentTheme.dropdownItem
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      <div className="flex-1">
                        <div className="font-semibold">Dark Mode</div>
                        <div className="text-[10px] opacity-75">Sleek obsidian palette</div>
                      </div>
                      {theme === 'dark' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTheme('emerald')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        theme === 'emerald' ? currentTheme.dropdownItemActive : currentTheme.dropdownItem
                      }`}
                    >
                      <Palette className="h-3.5 w-3.5 text-emerald-500" />
                      <div className="flex-1">
                        <div className="font-semibold">Civil Service Emerald</div>
                        <div className="text-[10px] opacity-75">Executive directorate theme</div>
                      </div>
                      {theme === 'emerald' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Live Web Search Pill */}
            <button
              type="button"
              onClick={handleToggleWebSearch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                useWebSearch
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Toggle Live Online Google & Institutional Search"
            >
              <Globe className={`h-3.5 w-3.5 ${useWebSearch ? 'text-white' : 'text-slate-400'}`} />
              <span>Search {useWebSearch ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 scrollbar-thin">
          {currentMessages.length === 0 ? (
            /* EMPTY STATE: INNOVATIVE HERO */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 -mt-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
                <Sparkle className="h-7 w-7 text-slate-950 fill-slate-950" />
              </div>

              <h1 className={`text-3xl sm:text-4xl font-bold tracking-tight mb-2.5 ${currentTheme.emptyHero}`}>
                What’s on the agenda today?
              </h1>
              <p className={`text-sm mb-7 max-w-md ${currentTheme.emptyDesc}`}>
                Ask <strong>RSIM AI</strong> anything, research civil service policies, or search live online information with verified references.
              </p>

              {/* Quick Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskQuestion(p.title)}
                    className={`p-3.5 rounded-2xl text-left transition-all group flex items-start gap-3 ${currentTheme.promptCard}`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mb-0.5 truncate">
                        {p.title}
                      </div>
                      <div className="text-[11px] opacity-75 leading-snug line-clamp-2">
                        {p.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CONVERSATIONAL CHAT FEED */
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="max-w-3xl mx-auto space-y-6 pb-12"
            >
              {currentMessages.map((msg, index) => (
                <div key={msg.id} className="space-y-3">
                  {msg.role === 'user' ? (
                    /* User Message Bubble */
                    <div className="flex flex-col items-end gap-1.5 group">
                      {/* Attached images / documents previews on user message */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mb-1 max-w-xl">
                          {msg.attachments.map((att, aIdx) => (
                            <div key={aIdx} className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/20 bg-slate-100 dark:bg-white/10 p-1 shadow-xs">
                              {att.dataUrl && att.type.startsWith('image/') ? (
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="max-h-48 max-w-xs rounded-lg object-contain cursor-pointer hover:opacity-95"
                                  onClick={() => window.open(att.dataUrl, '_blank')}
                                  title="Click to view full image"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span className="truncate max-w-[180px]">{att.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {/* Edit last message shortcut */}
                        <button
                          type="button"
                          onClick={() => {
                            setInputQuestion(msg.content);
                            if (msg.attachments) setPendingAttachments(msg.attachments);
                            if (textareaRef.current) textareaRef.current.focus();
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity text-xs"
                          title="Edit message"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <div className={`max-w-xl px-5 py-3 text-sm leading-relaxed ${currentTheme.userBubble}`}>
                          {msg.isWebSearch && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 mb-1 select-none">
                              <Globe className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                              <span>Web search</span>
                            </div>
                          )}
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Assistant Response (RSIM AI Style) */
                    <div className={`p-5 transition-all ${currentTheme.assistantBubble}`}>
                      <div className="flex items-start gap-3.5">
                        {/* Avatar */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white mt-0.5 shadow-sm">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>

                        {/* Content Container */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Metadata row with high-contrast text */}
                          <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-900 dark:text-white">
                              RSIM AI
                            </span>
                            <span className="text-[10px] opacity-60">·</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {msg.modelUsed || selectedModel}
                            </span>

                            {/* Honest Badge: Verified Grounded ONLY when sources exist */}
                            {msg.isGrounded && msg.groundingSources && msg.groundingSources.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                <Globe className="h-2.5 w-2.5 text-blue-500" />
                                <span>Verified Grounded</span>
                              </span>
                            ) : msg.isGrounded ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                <Globe className="h-2.5 w-2.5 text-amber-500" />
                                <span>Not verified</span>
                              </span>
                            ) : null}
                          </div>

                          {/* Document Draft Banner with Open in Word Page Viewer action */}
                          {msg.documentMeta?.isDocument && (
                            <div className="mb-3 p-3 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-purple-900 dark:text-purple-200">
                                      Official {msg.documentMeta.documentType} Draft
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold">
                                      {msg.documentMeta.isGoogleDrive ? '🏛️ Google Drive Template' : '📋 Institutional Template'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 truncate">
                                    Template: {msg.documentMeta.templateUsedTitle}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setWordViewerModal({
                                    isOpen: true,
                                    title: msg.documentMeta?.title || `${msg.documentMeta?.documentType} - ${new Date().toLocaleDateString()}`,
                                    content: msg.content,
                                    docType: msg.documentMeta?.documentType,
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Open in Word Page Viewer & Ribbon</span>
                              </button>
                            </div>
                          )}

                          {/* Markdown Response with Citations or Loading Skeleton */}
                          {msg.content ? (
                            <div className="text-sm leading-relaxed space-y-3">
                              <WordFormattedResponse
                                content={msg.content}
                                isUser={false}
                                sources={msg.groundingSources}
                                layoutMode="conversational"
                                className={theme === 'dark' || theme === 'emerald' ? 'text-slate-100' : 'text-slate-900'}
                              />
                            </div>
                          ) : (
                            /* Loading skeleton before first token */
                            <div className="space-y-2.5 py-1">
                              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                                <Sparkles className="h-3.5 w-3.5 animate-spin-slow" />
                                <span>{searchPhaseText || 'Formulating response...'}</span>
                              </div>
                              <div className="h-3.5 w-4/5 rounded bg-slate-200/80 dark:bg-white/10 animate-pulse" />
                              <div className="h-3.5 w-3/5 rounded bg-slate-200/60 dark:bg-white/10 animate-pulse" />
                            </div>
                          )}

                          {/* VERIFIED SOURCES & REFERENCES SECTION */}
                          {msg.groundingSources && msg.groundingSources.length > 0 && (
                            <div className="mt-4 pt-3.5 border-t border-black/5 dark:border-white/10 space-y-2.5">
                              {/* Searched Queries Badge */}
                              {msg.webSearchQueries && msg.webSearchQueries.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Searched:</span>
                                  {msg.webSearchQueries.map((q, qIdx) => (
                                    <span key={qIdx} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 font-mono text-[10.5px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                                      "{q}"
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Sources Header & Toggle */}
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSourcesMsgId((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Search className="h-3.5 w-3.5 text-blue-500" />
                                  <span>Sources ({msg.groundingSources.length})</span>
                                  {expandedSourcesMsgId[msg.id] ? (
                                    <ChevronUp className="h-3 w-3 opacity-70" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 opacity-70" />
                                  )}
                                </button>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Live Verified</span>
                                </span>
                              </div>

                              {/* Expandable Full Sources Panel */}
                              {expandedSourcesMsgId[msg.id] ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
                                  {msg.groundingSources.map((src, sIdx) => {
                                    let domain = src.uri;
                                    try {
                                      domain = new URL(src.uri).hostname.replace(/^www\./, '');
                                    } catch {}
                                    return (
                                      <a
                                        key={sIdx}
                                        href={src.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all text-left group ${currentTheme.sourceCard}`}
                                        title={`${src.title}\n${src.uri}`}
                                      >
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/20 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                          {sIdx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11.5px] font-bold truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 leading-snug">
                                            {src.title || domain}
                                          </p>
                                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                            <span>{domain}</span>
                                            <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                                          </p>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              ) : (
                                /* Compact Source Chips row */
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {msg.groundingSources.map((src, sIdx) => {
                                    let domain = src.uri;
                                    try {
                                      domain = new URL(src.uri).hostname.replace(/^www\./, '');
                                    } catch {}
                                    return (
                                      <a
                                        key={sIdx}
                                        href={src.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-blue-50 dark:bg-white/10 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 transition-colors shadow-2xs"
                                        title={`${src.title}\n${src.uri}`}
                                      >
                                        <span className="font-bold text-blue-600 dark:text-blue-400">[{sIdx + 1}]</span>
                                        <span className="max-w-[120px] truncate">{src.title || domain}</span>
                                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                      </a>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Google Search Suggestions Element (if returned by grounding metadata) */}
                              {msg.searchEntryPointHtml && (
                                <div
                                  className="mt-2 text-xs opacity-90 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                                  dangerouslySetInnerHTML={{ __html: msg.searchEntryPointHtml }}
                                />
                              )}
                            </div>
                          )}

                          {/* Suggested Follow-up Prompts (when message is finished) */}
                          {msg.content && !isLoading && (
                            <div className="pt-2 flex flex-wrap gap-1.5">
                              {[
                                'Summarize in 3 bullet points',
                                'Draft a formal civil service memo on this',
                                'What are the key policy recommendations?',
                              ].map((suggestion, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleAskQuestion(suggestion)}
                                  className="rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors border border-slate-200/80 dark:border-white/10 shadow-2xs"
                                >
                                  + {suggestion}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Standard Action Toolbar */}
                          <div className="flex items-center flex-wrap gap-1.5 pt-2 text-slate-400 text-xs">
                            {/* Copy */}
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Export DOCX */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await exportToDocx({
                                    title: `RSIM_Institutional_Response_${new Date().toISOString().slice(0, 10)}`,
                                    content: msg.content,
                                  });
                                } catch (err: any) {
                                  alert('Export error: ' + err.message);
                                }
                              }}
                              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Export to Microsoft Word (.docx)"
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-[10px] hidden sm:inline">DOCX</span>
                            </button>

                            {/* Word Page Viewer with Ribbon */}
                            <button
                              type="button"
                              onClick={() => {
                                setWordViewerModal({
                                  isOpen: true,
                                  title: msg.documentMeta?.title || `Document_${new Date().toISOString().slice(0, 10)}`,
                                  content: msg.content,
                                  docType: msg.documentMeta?.documentType || 'Official Document',
                                });
                              }}
                              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-medium"
                              title="Open in Microsoft Word Page Viewer (Ribbon, Font Styling & Prompts)"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="text-[10px] hidden sm:inline">Word Page Viewer</span>
                            </button>

                            {/* Save to Google Drive */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const token = await getAccessToken();
                                  if (!token) {
                                    alert('Please connect your Google Drive first from Settings or Directorate Templates.');
                                    return;
                                  }
                                  const blob = new Blob([msg.content], { type: 'text/markdown' });
                                  const fileName = `RSIM_Response_${new Date().toISOString().slice(0, 10)}.md`;
                                  await uploadFileToDrive(blob, fileName, {
                                    description: 'Generated by RSIM AI Assistant',
                                  });
                                  alert(`Successfully uploaded "${fileName}" directly to Google Drive!`);
                                } catch (err: any) {
                                  alert('Google Drive save error: ' + err.message);
                                }
                              }}
                              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              title="Save directly to Google Drive"
                            >
                              <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-[10px] hidden sm:inline">Drive</span>
                            </button>

                            {/* Save as Document */}
                            <button
                              type="button"
                              onClick={() => {
                                const docItem: DocumentItem = {
                                  id: `doc_ai_${Date.now()}`,
                                  title: (currentSession?.title || 'AI Document Draft').slice(0, 48),
                                  type: 'Report',
                                  category: 'Reports',
                                  content: msg.content,
                                  summary: msg.content.slice(0, 140),
                                  author: 'RSIM AI Assistant',
                                  version: 1,
                                  versions: [],
                                  approvalStatus: 'Draft',
                                  comments: [],
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                  tags: ['AI Draft', 'Chat'],
                                };
                                storage.saveDocument(docItem);
                                alert('Successfully saved to Directorate Documents repository!');
                              }}
                              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              title="Save to Documents repository"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-[10px] hidden sm:inline">Docs</span>
                            </button>

                            {/* Send to Studio */}
                            {onSendToStudio && (
                              <div className="relative group/studio">
                                <button
                                  type="button"
                                  className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors"
                                  title="Send to Studio"
                                >
                                  <Send className="h-3.5 w-3.5 text-indigo-500" />
                                  <span className="text-[10px] hidden sm:inline">Send</span>
                                </button>
                                <div className="hidden group-hover/studio:flex flex-col absolute bottom-full left-0 mb-1 w-32 p-1 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 z-50 text-xs animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={() => onSendToStudio('letters', msg.content)}
                                    className="text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-medium"
                                  >
                                    ✉️ Letters Studio
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSendToStudio('memos', msg.content)}
                                    className="text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-medium"
                                  >
                                    📝 Memo Studio
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSendToStudio('minutes', msg.content)}
                                    className="text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-medium"
                                  >
                                    🎙️ Minutes Studio
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSendToStudio('reports', msg.content)}
                                    className="text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-medium"
                                  >
                                    📊 Reports Studio
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="h-3 w-[1px] bg-black/10 dark:bg-white/10 mx-0.5" />

                            {/* Read Aloud */}
                            <button
                              type="button"
                              onClick={() => handleReadAloud(msg.id, msg.content)}
                              className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors ${
                                speakingMsgId === msg.id ? 'text-amber-500 font-bold' : ''
                              }`}
                              title={speakingMsgId === msg.id ? 'Stop reading' : 'Read aloud'}
                            >
                              {speakingMsgId === msg.id ? (
                                <VolumeX className="h-3.5 w-3.5" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Regenerate */}
                            <button
                              type="button"
                              onClick={() => handleRegenerate(index)}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors"
                              title="Regenerate response"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>

                            {/* Thumbs Up / Down */}
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, 'like')}
                              className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                                feedback[msg.id] === 'like' ? 'text-emerald-500' : 'hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Helpful response"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, 'dislike')}
                              className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                                feedback[msg.id] === 'dislike' ? 'text-rose-500' : 'hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Inaccurate response"
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Scroll to Bottom Button */}
        {userScrolledUp && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fixed bottom-28 right-8 z-30 flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black px-3 py-1.5 text-xs font-semibold shadow-lg hover:opacity-90 transition-all"
            title="Scroll to latest messages"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>Scroll to latest</span>
          </button>
        )}

        {/* 3. BOTTOM FLOATING INPUT CAPSULE */}
        <div className={`p-4 shrink-0 ${currentTheme.inputContainer}`}>
          <div className="max-w-3xl mx-auto">
            {/* Hidden file input for images & documents */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e.target.files)}
              multiple
              accept="image/*,.pdf,.docx,.doc,.txt,.md,.csv,.json,.xlsx,.xls,.srt,.vtt,audio/*,video/*"
              className="hidden"
            />

            {/* Reading Files Loading State */}
            {isReadingFiles && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="font-semibold">Reading and parsing file content in browser...</span>
              </div>
            )}

            {/* Audio/Video Redirection Notice */}
            {audioRedirectPrompt?.show && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-700/60 text-xs text-indigo-900 dark:text-indigo-200 shadow-xs animate-in fade-in">
                <div>
                  <span className="font-bold">{audioRedirectPrompt.fileName}</span> is an audio/video recording.
                  <span className="ml-1 text-slate-600 dark:text-slate-400">Transcribe first, then ask questions?</span>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigateToTranscribe && (
                    <button
                      type="button"
                      onClick={() => {
                        setAudioRedirectPrompt(null);
                        onNavigateToTranscribe();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-2xs"
                    >
                      Transcribe First
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAudioRedirectPrompt(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Vision Capability Warning */}
            {showVisionWarning && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200 shadow-xs animate-in fade-in">
                <span className="font-medium">
                  Selected model does not support image analysis.
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectModel('gemini-3.8-flash')}
                  className="underline font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950"
                >
                  Switch to RSIM Gemini 3.8 Flash
                </button>
              </div>
            )}

            {/* Pending Attachment Previews */}
            {pendingAttachments.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2 animate-in fade-in">
                {pendingAttachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-3 py-1.5 text-xs border border-slate-200 dark:border-white/10 shadow-xs text-slate-800 dark:text-slate-200"
                  >
                    {att.dataUrl && att.type.startsWith('image/') ? (
                      <img src={att.dataUrl} alt={att.name} className="h-6 w-6 rounded object-cover border border-black/10" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                      {att.size ? (
                        <span className="text-[10px] text-slate-400">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white ml-1 font-bold"
                      title="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attachment pill if document/meeting selected from host context */}
            {attachedContext && (
              <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 shadow-xs">
                <Paperclip className="h-3 w-3 text-blue-500" />
                <span className="truncate max-w-xs">{attachedContext.title}</span>
                <button
                  type="button"
                  onClick={() => setAttachedContext(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white ml-1 font-bold"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Live Matched Google Drive / Institutional Template Indicator */}
            {liveMatchedTemplate?.template && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/60 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-xs">
                    🎯
                  </span>
                  <div className="truncate text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Matched Template:
                    </span>{' '}
                    <span className="font-semibold underline decoration-emerald-500 underline-offset-2">
                      {liveMatchedTemplate.template.title || liveMatchedTemplate.template.name}
                    </span>
                    {(liveMatchedTemplate.template.source === 'google_drive' || liveMatchedTemplate.template.driveSource) && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                        <Cloud className="h-2.5 w-2.5" />
                        Google Drive
                      </span>
                    )}
                    <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">
                      ({liveMatchedTemplate.reason})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveMatchedTemplate(null)}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white text-xs shrink-0 p-1"
                  title="Dismiss auto-matched template"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Rounded Input Capsule */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              className={`relative rounded-3xl p-2 transition-all ${currentTheme.inputCard}`}
            >
              <div className="flex items-end gap-2 px-2">
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  placeholder={
                    useWebSearch
                      ? 'Ask RSIM AI or search the web online...'
                      : 'Ask RSIM AI or request a document (e.g. "Write a stakeholder engagement report")...'
                  }
                  className={`flex-1 max-h-44 resize-none bg-transparent py-2.5 text-sm focus:outline-none leading-relaxed ${currentTheme.inputTextarea}`}
                />

                {/* Left/Bottom Controls */}
                <div className="flex items-center gap-1.5 pb-1">
                  {/* File & Image Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isReadingFiles}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors disabled:opacity-50"
                    title="Upload images or documents (PDF, DOCX, XLSX, TXT) for analysis"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>

                  {/* Cloud Hub Drive Button */}
                  <button
                    type="button"
                    onClick={() => setIsCloudPickerOpen(true)}
                    disabled={isReadingFiles}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                    title="Attach document from Google Drive or Microsoft OneDrive"
                  >
                    <Cloud className="h-4 w-4 text-blue-500" />
                  </button>

                  {/* Web Search Toggle in Input */}
                  <button
                    type="button"
                    onClick={handleToggleWebSearch}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      useWebSearch
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                    title="Toggle Live Online Google Search Grounding"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Search</span>
                  </button>

                  {/* Context Attachment dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAttachOpen(!isAttachOpen)}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                      title="Attach Document, Template, or Transcript from workspace"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    {isAttachOpen && (
                      <div className={`absolute bottom-11 right-0 w-72 rounded-2xl p-2 z-50 animate-in fade-in shadow-2xl ${currentTheme.dropdownBg}`}>
                        <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                          <span>Workspace Context</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachOpen(false);
                              setIsWorkspaceSearchOpen(true);
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          >
                            Search All
                          </button>
                        </div>

                        {/* Search Workspace Shortcut button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachOpen(false);
                            setIsWorkspaceSearchOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 my-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          <Search className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Search Docs, Drive Templates & Transcripts</span>
                        </button>

                        <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
                          {documents.slice(0, 5).map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setAttachedContext({ type: 'document', id: d.id, title: d.title });
                                setIsAttachOpen(false);
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs truncate ${currentTheme.dropdownItem}`}
                            >
                              📄 {d.title}
                            </button>
                          ))}
                          {meetings.slice(0, 3).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setAttachedContext({ type: 'meeting', id: m.id, title: m.title });
                                setIsAttachOpen(false);
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs truncate ${currentTheme.dropdownItem}`}
                            >
                              🎙️ {m.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Voice Input */}
                  <VoiceInput
                    onTranscript={(text) =>
                      setInputQuestion((prev) => (prev ? `${prev} ${text}` : text))
                    }
                    size="sm"
                  />

                  {/* Circular Send / Stop Button */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                      title="Stop generating"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isReadingFiles || (!inputQuestion.trim() && pendingAttachments.length === 0)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all shadow-sm ${
                        !isReadingFiles && (inputQuestion.trim() || pendingAttachments.length > 0)
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-black hover:opacity-90'
                          : 'bg-black/10 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                      title={isReadingFiles ? 'Reading files in browser...' : 'Send prompt to RSIM AI'}
                    >
                      <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className={`mt-2 text-center text-[11px] ${currentTheme.bottomDisclaimer}`}>
              <p>RSIM AI can make mistakes. Please verify important civil service and institutional information.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. WORKSPACE INTERNAL SEARCH MODAL (DOCUMENTS, DRIVE TEMPLATES, MEETINGS) */}
      {isWorkspaceSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/15 overflow-hidden flex flex-col max-h-[85vh] ${currentTheme.dropdownBg}`}>
            {/* Modal Header */}
            <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Search Workspace & Drive Templates</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceSearchOpen(false);
                  setWorkspaceSearchQuery('');
                }}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={workspaceSearchQuery}
                  onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
                  placeholder="Search keywords, e.g. 'stakeholder engagement', 'minutes', 'budget', 'procurement'..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!workspaceSearchQuery.trim() ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  Type any institutional keyword above to search across stored Documents, Google Drive Templates, and Meeting Transcripts.
                </div>
              ) : !workspaceSearchResults || workspaceSearchResults.totalMatches === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  No matches found for "{workspaceSearchQuery}". Try terms like "report", "minutes", "memo", or "letter".
                </div>
              ) : (
                <>
                  {/* Templates (with Drive priority) */}
                  {workspaceSearchResults.templates.length > 0 && (
                    <div>
                      <div className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center justify-between">
                        <span>Templates ({workspaceSearchResults.templates.length})</span>
                        <span className="text-[10px] text-slate-400">Google Drive & Local</span>
                      </div>
                      <div className="space-y-2">
                        {workspaceSearchResults.templates.map(({ item, snippet, isDrive }) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:border-emerald-500/50 transition-all flex items-start justify-between gap-3 shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {item.title || item.name}
                                </span>
                                {isDrive && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                    <Cloud className="h-2.5 w-2.5" />
                                    Drive
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">[{item.documentType}]</span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {snippet || item.description || item.content?.slice(0, 100)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachedContext({ type: 'template', id: item.id, title: item.title || item.name });
                                setIsWorkspaceSearchOpen(false);
                                setWorkspaceSearchQuery('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0 shadow-xs"
                            >
                              Use Template
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {workspaceSearchResults.documents.length > 0 && (
                    <div>
                      <div className="text-xs uppercase font-bold text-purple-600 dark:text-purple-400 mb-2">
                        Documents ({workspaceSearchResults.documents.length})
                      </div>
                      <div className="space-y-2">
                        {workspaceSearchResults.documents.map(({ item, snippet }) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:border-purple-500/50 transition-all flex items-start justify-between gap-3 shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-sm text-slate-900 dark:text-white truncate block">
                                📄 {item.title}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {snippet}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachedContext({ type: 'document', id: item.id, title: item.title });
                                setIsWorkspaceSearchOpen(false);
                                setWorkspaceSearchQuery('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors shrink-0 shadow-xs"
                            >
                              Attach Doc
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meetings & Transcripts */}
                  {workspaceSearchResults.meetings.length > 0 && (
                    <div>
                      <div className="text-xs uppercase font-bold text-blue-600 dark:text-blue-400 mb-2">
                        Meetings & Transcripts ({workspaceSearchResults.meetings.length})
                      </div>
                      <div className="space-y-2">
                        {workspaceSearchResults.meetings.map(({ item, snippet }) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:border-blue-500/50 transition-all flex items-start justify-between gap-3 shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-sm text-slate-900 dark:text-white truncate block">
                                🎙️ {item.title}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {snippet}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachedContext({ type: 'meeting', id: item.id, title: item.title });
                                setIsWorkspaceSearchOpen(false);
                                setWorkspaceSearchQuery('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0 shadow-xs"
                            >
                              Attach Transcript
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Cloud Hub Drive Integration Modal for Chat */}
      <DriveIntegrationModal
        isOpen={isCloudPickerOpen}
        onClose={() => setIsCloudPickerOpen(false)}
        onSelectFile={handleCloudFileSelected}
        title="Attach Document from Cloud Hub"
      />

      {/* Microsoft Word Document Viewer & Formatting Ribbon Modal */}
      {wordViewerModal && wordViewerModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-100 dark:bg-slate-900 w-full max-w-6xl h-full max-h-[96vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-300 dark:border-white/10">
            {/* Top Modal Header */}
            <div className="h-12 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-purple-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {wordViewerModal.title}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold hidden sm:inline">
                  Word Page Layout & Formatting Ribbon
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWordViewerModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                title="Close Viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Word Document Viewer Component with Ribbon & Direct In-Page Editing */}
            <div className="flex-1 overflow-hidden">
              <WordDocumentViewer
                title={wordViewerModal.title}
                content={wordViewerModal.content}
                type={wordViewerModal.docType || 'Official Document'}
                onContentChange={(newContent) => {
                  setWordViewerModal((prev) => (prev ? { ...prev, content: newContent } : null));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
