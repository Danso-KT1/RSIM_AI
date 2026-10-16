import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Paperclip,
  Mic,
  MicOff,
  Layers,
  Trash2,
  Pin,
  FileText,
  Clock,
  BookOpen,
  ChevronDown,
  Building,
  CheckCircle2,
  Copy,
  FolderKanban,
  X,
  Globe,
  ExternalLink,
  Search,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Check,
  Volume2,
  VolumeX,
  User,
  Lightbulb,
  Compass,
  CornerDownLeft,
} from 'lucide-react';
import {
  ChatMessage,
  ChatSession,
  Meeting,
  DocumentItem,
  ProjectItem,
  KnowledgeItem,
} from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import { MicrophoneTranscriberModal } from '../common/MicrophoneTranscriberModal';
import { WordFormattedResponse } from '../common/WordFormattedResponse';
import { exportToDocx } from '../../utils/docxExporter';

interface AIAssistantViewProps {
  initialPrompt?: string;
  meetings: Meeting[];
  documents: DocumentItem[];
  projects: ProjectItem[];
  knowledge: KnowledgeItem[];
  activeContext: { type: 'meeting' | 'document' | 'project' | 'knowledge'; id: string; title: string } | null;
  onSetContext: (ctx: { type: 'meeting' | 'document' | 'project' | 'knowledge'; id: string; title: string } | null) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  initialPrompt,
  meetings,
  documents,
  projects,
  knowledge,
  activeContext,
  onSetContext,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('General Assistant');
  const [contextDropdownOpen, setContextDropdownOpen] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);
  const [isMicModalOpen, setIsMicModalOpen] = useState(false);

  // Modern conversational interaction states
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const modes = [
    'General Assistant',
    'Research & Web Intelligence',
    'Report Writer',
    'Memo Writer',
    'Letter Writer',
    'Document Analyst',
    'Executive Briefing',
    'Proofreader',
  ];

  // Load chat sessions on mount
  useEffect(() => {
    const saved = storage.getChats();
    if (saved.length > 0) {
      setSessions(saved);
      setCurrentSessionId(saved[0].id);
    } else {
      createNewChat();
    }
  }, []);

  // Handle initial prompt if passed from dashboard
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isGenerating]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: `chat_${Date.now()}`,
      title: 'New Conversation',
      mode: selectedMode,
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Hello! I am your **Gemini AI Assistant** for the RSIM Directorate.\n\nI can search the web in real-time for live data, answer complex technical or policy questions, synthesize meeting records, and draft official civil service letters, memos, and reports.\n\nHow can I help you today?`,
          createdAt: new Date().toISOString(),
        },
      ],
      activeContext: activeContext || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    setCurrentSessionId(newSession.id);
    storage.saveChat(newSession);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const userText = (textToSend || inputPrompt).trim();
    if (!userText || isGenerating) return;

    setInputPrompt('');

    const userMessage: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: userText,
      context: activeContext || undefined,
      createdAt: new Date().toISOString(),
    };

    let session = currentSession;
    if (!session) return;

    const updatedMessages = [...session.messages, userMessage];
    let updatedTitle = session.title;
    if (session.messages.length <= 1) {
      updatedTitle = userText.slice(0, 36) + (userText.length > 36 ? '...' : '');
    }

    const sessionWithUser: ChatSession = {
      ...session,
      title: updatedTitle,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    const updatedSessions = sessions.map((s) =>
      s.id === session!.id ? sessionWithUser : s
    );
    setSessions(updatedSessions);
    storage.saveChat(sessionWithUser);

    setIsGenerating(true);

    // Build context prompt
    let systemInstruction = `Mode: ${selectedMode}\nUser Role: ${storage.getUser().role}\n`;
    if (activeContext) {
      systemInstruction += `Active Context: [${activeContext.type.toUpperCase()}] ${activeContext.title}\n`;
      if (activeContext.type === 'meeting') {
        const mtg = meetings.find((m) => m.id === activeContext.id);
        if (mtg && mtg.transcript) {
          systemInstruction += `Meeting Date: ${mtg.date}, Venue: ${mtg.venue}\nTranscript excerpts: ${mtg.transcript.slice(0, 4).map((s) => `${s.speaker}: ${s.text}`).join(' ')}\n`;
        }
      } else if (activeContext.type === 'document') {
        const doc = documents.find((d) => d.id === activeContext.id);
        if (doc) {
          systemInstruction += `Document Ref: ${doc.referenceNumber || ''}\nType: ${doc.type}\n`;
          if (doc.extractedData) {
            systemInstruction += `Extracted Summary: ${doc.extractedData.summary}\nTakeaways: ${doc.extractedData.keyTakeaways.join('; ')}\nEntities: ${doc.extractedData.entities.organizations.join(', ')}\nAction Points: ${doc.extractedData.actionPoints.join('; ')}\n`;
          }
          systemInstruction += `Excerpt: ${(doc.rawText || doc.content).slice(0, 1000)}\n`;
        }
      }
    }

    // Auto-detect web search requirement or manual toggle
    const searchKeywords = /\b(search online|search google|search web|search the internet|browse the web|current|latest|recent|today|news|browse|who is|what is happening|what is the price|stat|2024|2025|2026)\b/i;
    const shouldSearch = Boolean(useGoogleSearch || searchKeywords.test(userText));

    // Multi-turn conversational memory history
    const historyPayload = session.messages.slice(-8).map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant' | 'model',
      content: m.content,
    }));

    try {
      const response = await aiService.complete(
        userText,
        systemInstruction,
        selectedMode,
        shouldSearch,
        historyPayload
      );

      const botMessage: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: response.text,
        citations: response.citations,
        groundingSources: response.groundingSources,
        webSearchQueries: response.webSearchQueries,
        isGrounded: response.isGrounded || shouldSearch,
        modelUsed: response.modelUsed || (shouldSearch ? 'gemini-3.5-flash' : 'gemini-3.8-flash'),
        mode: selectedMode,
        createdAt: new Date().toISOString(),
      };

      const finalSession: ChatSession = {
        ...sessionWithUser,
        messages: [...sessionWithUser.messages, botMessage],
        updatedAt: new Date().toISOString(),
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === finalSession.id ? finalSession : s))
      );
      storage.saveChat(finalSession);
    } catch (err: any) {
      console.error('Error generating AI response:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Read Aloud using SpeechSynthesis (TTS)
  const handleReadAloud = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }
    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`>]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleRegenerate = (msgIndex: number) => {
    if (!currentSession || isGenerating) return;
    const prevUserMsg = currentSession.messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === 'user');
    if (!prevUserMsg) return;

    const pruned = currentSession.messages.slice(0, msgIndex);
    const updatedSession = { ...currentSession, messages: pruned };
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    storage.saveChat(updatedSession);

    setTimeout(() => {
      handleSendMessage(prevUserMsg.content);
    }, 50);
  };

  // Microphone audio transcription using gemini-3.5-transcribe
  const handleMicrophoneTranscribed = (transcript: string) => {
    if (!transcript) return;
    setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.deleteChat(id);
    const rest = sessions.filter((s) => s.id !== id);
    setSessions(rest);
    if (currentSessionId === id) {
      if (rest.length > 0) setCurrentSessionId(rest[0].id);
      else createNewChat();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* LEFT: Conversation History Sidebar */}
      <div className="hidden w-64 border-r border-slate-200 bg-slate-50 md:flex md:flex-col">
        {/* New Chat Button */}
        <div className="p-3 border-b border-slate-200">
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>+ New Conversation</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Conversations
          </p>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setCurrentSessionId(s.id)}
              className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                currentSessionId === s.id
                  ? 'bg-white text-emerald-800 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Bot className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{s.title}</span>
              </div>
              <button
                onClick={(e) => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 rounded-sm p-1 text-slate-400 hover:text-red-600 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Chat Workspace */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Top Controls: Model Badge, Web Search Toggle & Context Picker */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 bg-slate-50/70">
          {/* AI Persona & Mode */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100/80 px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Gemini AI</span>
            </div>

            <select
              value={selectedMode}
              onChange={(e) => {
                const newMode = e.target.value;
                setSelectedMode(newMode);
                if (newMode.includes('Research')) {
                  setUseGoogleSearch(true);
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-hidden"
            >
              {modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Right Controls: Web Search Grounding Toggle & Context Selector */}
          <div className="flex items-center gap-2">
            {/* Google Search Grounding Toggle */}
            <button
              type="button"
              onClick={() => setUseGoogleSearch(!useGoogleSearch)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs border ${
                useGoogleSearch
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-300'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Search the web online in real time using Google Search Grounding"
            >
              <Globe className={`h-3.5 w-3.5 ${useGoogleSearch ? 'text-white' : 'text-blue-600'}`} />
              <span>Search Web</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-sm ${useGoogleSearch ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 text-slate-500 font-semibold'}`}>
                {useGoogleSearch ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Context Selector */}
            <div className="relative">
              <button
                onClick={() => setContextDropdownOpen(!contextDropdownOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  {activeContext ? `Context: ${activeContext.title.slice(0, 16)}...` : 'Attach Context'}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {contextDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setContextDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-20 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                      <span>Select Context</span>
                      {activeContext && (
                        <button
                          onClick={() => {
                            onSetContext(null);
                            setContextDropdownOpen(false);
                          }}
                          className="text-red-500 hover:underline text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Meetings */}
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Meetings</p>
                      {meetings.slice(0, 3).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSetContext({ type: 'meeting', id: m.id, title: m.title });
                            setContextDropdownOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Clock className="h-3 w-3 text-emerald-600" />
                          <span className="truncate">{m.title}</span>
                        </button>
                      ))}
                    </div>

                    {/* Documents */}
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Documents</p>
                      {documents.slice(0, 3).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            onSetContext({ type: 'document', id: d.id, title: d.title });
                            setContextDropdownOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <FileText className="h-3 w-3 text-blue-600" />
                          <span className="truncate">{d.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
          {/* Quick Prompt Starters (Shown if only welcome message exists) */}
          {currentSession?.messages.length === 1 && (
            <div className="max-w-3xl mx-auto my-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Suggested Prompts & Online Research:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    icon: Globe,
                    color: 'text-blue-600 bg-blue-50 border-blue-200',
                    title: 'Search Online Facts & Trends',
                    prompt: 'Search online for current 2026 digital economy and telecom infrastructure developments in Africa',
                    search: true,
                  },
                  {
                    icon: FileText,
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                    title: 'Draft Executive Memorandum',
                    prompt: 'Draft an official memorandum to the Chief Director requesting approval for the Q3 Broadband Infrastructure Audit',
                    search: false,
                  },
                  {
                    icon: Compass,
                    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
                    title: 'Benchmark Sector Tariffs',
                    prompt: 'Search online and benchmark regional West African telecommunication data tariffs and regulatory standards',
                    search: true,
                  },
                  {
                    icon: Lightbulb,
                    color: 'text-amber-600 bg-amber-50 border-amber-200',
                    title: 'Civil Service Writing Rules',
                    prompt: 'Explain the core differences between an Internal Memorandum, a Submission, and an Official External Letter in the civil service',
                    search: false,
                  },
                ].map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputPrompt(starter.prompt);
                      if (starter.search) setUseGoogleSearch(true);
                      inputRef.current?.focus();
                    }}
                    className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-left group shadow-2xs"
                  >
                    <div className={`p-2 rounded-xl ${starter.color} shrink-0 group-hover:scale-105 transition-transform border`}>
                      <starter.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-slate-800 group-hover:text-emerald-900">{starter.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{starter.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentSession?.messages.map((msg, msgIdx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto'}`}
              >
                {!isUser ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-700 text-white shadow-xs">
                    <Sparkles className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="order-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                    <User className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200/90 bg-white text-slate-800 shadow-xs'
                  }`}
                >
                  {/* Context pill in user message */}
                  {msg.context && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Layers className="h-2.5 w-2.5" />
                      <span>{msg.context.title}</span>
                    </div>
                  )}

                  {/* Google Search Grounding Sources Block (Mimicking real Gemini/ChatGPT) */}
                  {msg.isGrounded && msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-blue-800 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          <span>Grounded with Google Search in real-time</span>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                          {msg.groundingSources.length} {msg.groundingSources.length === 1 ? 'source' : 'sources'}
                        </span>
                      </div>

                      {/* Search queries pills */}
                      {msg.webSearchQueries && msg.webSearchQueries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.webSearchQueries.map((q, qIdx) => (
                            <span
                              key={qIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-md border border-blue-200"
                            >
                              <Search className="w-2.5 h-2.5" />
                              <span>"{q}"</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clickable web sources cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {msg.groundingSources.map((source, sIdx) => {
                          let domain = source.uri;
                          try {
                            domain = new URL(source.uri).hostname;
                          } catch (e) {}
                          return (
                            <a
                              key={sIdx}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-2 bg-slate-50/80 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors group shadow-2xs"
                            >
                              <Globe className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1 text-left">
                                <p className="text-xs font-medium text-slate-800 truncate group-hover:text-blue-700">
                                  {source.title || domain}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                  <span>{domain}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                </p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Word-Formatted Document Output */}
                  <WordFormattedResponse content={msg.content} isUser={isUser} />

                  {/* Action row on assistant message (Mimicking real ChatGPT / Gemini) */}
                  {!isUser && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <span className="font-medium text-slate-500">{msg.modelUsed || 'gemini-3.5-flash'}</span>
                        {msg.isGrounded && (
                          <span className="text-blue-700 font-bold">• Live Web Verified</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Copy button */}
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Copy response to clipboard"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Read Aloud (TTS) */}
                        <button
                          type="button"
                          onClick={() => handleReadAloud(msg.id, msg.content)}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors shadow-2xs ${
                            speakingMsgId === msg.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 animate-pulse'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title="Read response aloud (Speech synthesis)"
                        >
                          {speakingMsgId === msg.id ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          <span>{speakingMsgId === msg.id ? 'Stop' : 'Read'}</span>
                        </button>

                        {/* Regenerate */}
                        <button
                          type="button"
                          onClick={() => handleRegenerate(msgIdx)}
                          disabled={isGenerating}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                          title="Regenerate this response"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Regenerate</span>
                        </button>

                        {/* Thumbs Up / Down feedback */}
                        <button
                          type="button"
                          onClick={() => setFeedback((prev) => ({ ...prev, [msg.id]: 'like' }))}
                          className={`rounded-lg p-1 transition-colors ${
                            feedback[msg.id] === 'like'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedback((prev) => ({ ...prev, [msg.id]: 'dislike' }))}
                          className={`rounded-lg p-1 transition-colors ${
                            feedback[msg.id] === 'dislike'
                              ? 'bg-rose-100 text-rose-800'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title="Poor response"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>

                        {/* Export to Word */}
                        <button
                          type="button"
                          onClick={() =>
                            exportToDocx({
                              title: 'RSIM AI Executive Response',
                              content: msg.content,
                              department: 'MINISTRY OF COMMUNICATIONS & DIGITALISATION',
                              referenceNumber: `RSIM/AI/${new Date().getFullYear()}`,
                              date: new Date().toLocaleDateString(),
                            })
                          }
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                          title="Export as Microsoft Word (.docx)"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Word</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Generating Indicator with live status */}
          {isGenerating && (
            <div className="flex gap-3 max-w-3xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-700 text-white shadow-xs">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-center gap-2.5 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                <span className="font-medium">
                  {useGoogleSearch
                    ? 'Searching Google online and grounding with live web data (gemini-3.5-flash)...'
                    : 'Gemini is reasoning and formulating response...'}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar (Mimicking modern ChatGPT / Gemini input capsule) */}
        <div className="border-t border-slate-200 p-3 sm:p-4 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="rounded-2xl border border-slate-300 bg-slate-50/70 p-2 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/20 transition-all shadow-xs"
          >
            {/* Input textarea / text field */}
            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={
                useGoogleSearch
                  ? 'Ask anything or search online (e.g. "Latest 2026 tech trends" or "Current Ghana telecom benchmarks")...'
                  : `Ask in ${selectedMode} mode (Press Enter to send)...`
              }
              className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />

            {/* Input Capsule Controls Row */}
            <div className="mt-1 flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-1.5">
                {/* Real-Time Web Search Toggle Button */}
                <button
                  type="button"
                  onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                  className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    useGoogleSearch
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/80 hover:text-slate-900'
                  }`}
                  title="Search the web online in real time"
                >
                  <Globe className="h-3 w-3" />
                  <span>Search Web</span>
                  <span className="text-[10px] opacity-80">{useGoogleSearch ? 'ON' : 'OFF'}</span>
                </button>

                {/* Microphone dictation button (gemini-3.5-transcribe) */}
                <button
                  type="button"
                  onClick={() => setIsMicModalOpen(true)}
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold bg-slate-200/70 text-slate-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                  title="Dictate with microphone (gemini-3.5-transcribe)"
                >
                  <Mic className="h-3 w-3" />
                  <span className="hidden sm:inline">Voice</span>
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isGenerating}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-40 transition-all"
              >
                <span>Send</span>
                <CornerDownLeft className="h-3 w-3" />
              </button>
            </div>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Powered by Google Gemini. Web Search Grounding connects to Google Search in real-time.
          </p>
        </div>

        {/* Microphone Transcriber Modal (gemini-3.5-transcribe) */}
        <MicrophoneTranscriberModal
          isOpen={isMicModalOpen}
          onClose={() => setIsMicModalOpen(false)}
          onTranscriptionComplete={handleMicrophoneTranscribed}
          title="Voice Dictation (gemini-3.5-transcribe)"
          contextHint="Speak clearly into your microphone. Google gemini-3.5-transcribe will convert your speech to text."
        />
      </div>
    </div>
  );
};
