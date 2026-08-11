import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eraser,
  History as HistoryIcon,
  Mic,
  PencilLine,
  Pin,
  PinOff,
  PlayCircle,
  Sparkles,
  Trash2,
} from "lucide-react";

import aiService, { type AiChatResponse } from "../../services/aiService";
import type { AiLimitSummary } from "../../types/Ai";
import { cacheService } from "../../services/cacheService";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";
import { AI_ACTIVE_CONVERSATION_KEY, AI_CONVERSATIONS_STORAGE_KEY } from "../../utils/constants";
import { formatCompactTime, formatDateTime, getApiErrorMessage } from "../../utils/helpers";

import "./AiAssistantPage.scss";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned?: boolean;
}

interface SnackbarState {
  message: string;
  tone: "success" | "error" | "info";
}

const SUGGESTED_QUESTIONS = [
  "Which train is best for a late night journey from Delhi to Jaipur?",
  "Explain the difference between RAC and WL in simple terms.",
  "Summarize the route highlights for train 12002.",
  "What should I check before booking a last-minute ticket?",
];

function loadConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(AI_CONVERSATIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatConversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: ChatConversation[]): void {
  localStorage.setItem(AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
}

function loadActiveConversationId(): string | null {
  return localStorage.getItem(AI_ACTIVE_CONVERSATION_KEY);
}

function saveActiveConversationId(conversationId: string): void {
  localStorage.setItem(AI_ACTIVE_CONVERSATION_KEY, conversationId);
}

function createConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function renderInlineMarkdown(text: string = ""): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]*\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      tokens.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      tokens.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      tokens.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        tokens.push(
          <a key={`${match.index}-link`} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        tokens.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function renderMarkdown(text: string = ""): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  const isTableSeparator = (value: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(value);

  while (index < lines.length) {
    const currentLine = lines[index].trim();

    if (!currentLine) {
      index += 1;
      continue;
    }

    if (currentLine.startsWith("```")) {
      const language = currentLine.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        <pre key={`code-${blocks.length}`} className="code-block">
          {language ? <span className="code-language">{language}</span> : null}
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );

      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() ?? "";
    const isTable = currentLine.includes("|") && isTableSeparator(nextLine);

    if (isTable) {
      const tableRows: string[][] = [];
      tableRows.push(currentLine.split("|").map((cell) => cell.trim()).filter(Boolean));
      index += 2;

      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        tableRows.push(lines[index].trim().split("|").map((cell) => cell.trim()).filter(Boolean));
        index += 1;
      }

      const [header, ...rows] = tableRows;
      blocks.push(
        <div key={`table-${blocks.length}`} className="markdown-table-wrap">
          <table>
            <thead>
              <tr>{header.map((cell, cellIndex) => <th key={`${cell}-${cellIndex}`}>{cell}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.join("-")}`}>
                  {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const isOrderedList = /^\d+\.\s+/.test(currentLine);
    const isUnorderedList = /^[-*+]\s+/.test(currentLine);

    if (isOrderedList || isUnorderedList) {
      const items: string[] = [];
      const ordered = isOrderedList;

      while (index < lines.length) {
        const line = lines[index].trim();
        if (ordered ? /^\d+\.\s+/.test(line) : /^[-*+]\s+/.test(line)) {
          items.push(line.replace(/^([-*+]|\d+\.)\s+/, ""));
          index += 1;
        } else {
          break;
        }
      }

      if (ordered) {
        blocks.push(
          <ol key={`ol-${blocks.length}`} className="markdown-list">
            {items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>)}
          </ol>,
        );
      } else {
        blocks.push(
          <ul key={`ul-${blocks.length}`} className="markdown-list">
            {items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>)}
          </ul>,
        );
      }

      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="markdown-paragraph">
        {paragraphLines.flatMap((paragraphLine, paragraphIndex) => [
          ...renderInlineMarkdown(paragraphLine),
          paragraphIndex < paragraphLines.length - 1 ? <br key={`${paragraphIndex}-break`} /> : null,
        ])}
      </p>,
    );
  }

  return blocks;
}

export default function AiAssistantPage() {
  const location = useLocation();
  const initialLocationState = location.state as { conversationId?: string } | null;
  const initialConversations = loadConversations();
  const seedConversation = createConversation();

  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    initialConversations.length > 0 ? initialConversations : [seedConversation],
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(
    initialLocationState?.conversationId ?? loadActiveConversationId() ?? initialConversations[0]?.id ?? seedConversation.id,
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitSummary, setLimitSummary] = useState<AiLimitSummary | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConversationId, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    if (!snackbar) return undefined;

    const timeout = window.setTimeout(() => setSnackbar(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [snackbar]);

  async function refreshLimit() {
    try {
      const response = await aiService.getLimit();
      setLimitSummary(response.data);
    } catch {
      setLimitSummary(null);
    }
  }

  function formatLimitReset(limit: AiLimitSummary) {
    try {
      return formatDateTime(limit.resetAt);
    } catch {
      return "Unknown";
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshLimit();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0],
    [activeConversationId, conversations],
  );

  const pinnedConversations = conversations.filter((conversation) => conversation.pinned);
  const regularConversations = conversations.filter((conversation) => !conversation.pinned);

  function updateConversation(conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((previous) => previous.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation)));
  }

  function renameConversation(conversationId: string) {
    const currentConversation = conversations.find((conversation) => conversation.id === conversationId);
    if (!currentConversation) return;

    const nextName = window.prompt("Rename conversation", currentConversation.title);
    if (!nextName?.trim()) return;

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: nextName.trim(),
      updatedAt: new Date().toISOString(),
    }));
  }

  function togglePin(conversationId: string) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      pinned: !conversation.pinned,
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteConversation(conversationId: string) {
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
    const nextConversations = remaining.length > 0 ? remaining : [createConversation()];
    setConversations(nextConversations);

    if (activeConversationId === conversationId) {
      setActiveConversationId(nextConversations[0].id);
    }
  }

  async function sendMessage(messageText?: string) {
    if (loading) return;

    const message = (messageText ?? input).trim();
    if (!message) return;

    const conversationId = activeConversation?.id ?? activeConversationId;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };

    setConversations((previous) => {
      const conversation = previous.find((item) => item.id === conversationId) ?? createConversation();
      const updatedConversation: ChatConversation = {
        ...conversation,
        title: conversation.title === "New conversation" ? message.slice(0, 32) : conversation.title,
        updatedAt: new Date().toISOString(),
        messages: [...conversation.messages, userMessage],
      };

      return [updatedConversation, ...previous.filter((item) => item.id !== conversationId)];
    });

    setInput("");
    setLoading(true);
    setError(null);
    setSnackbar(null);

    try {
      const response = await aiService.sendMessage({ message });
      const payload = response.data as AiChatResponse;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.response,
        createdAt: new Date().toISOString(),
      };

      setConversations((previous) => {
        const nextConversation = previous.find((item) => item.id === conversationId);
        if (!nextConversation) return previous;

        const updatedConversation: ChatConversation = {
          ...nextConversation,
          updatedAt: new Date().toISOString(),
          messages: [...nextConversation.messages, assistantMessage],
        };

        return [updatedConversation, ...previous.filter((item) => item.id !== conversationId)];
      });

      const settings = settingsService.getSettings();
      if (settings.cache.enabled) {
        cacheService.set("AI", { conversationId }, payload, settings.cache.ttlMinutes * 60 * 1000);
      }
      if (settings.history.autoSave) {
        historyService.record("AI", { conversationId, message }, payload, payload.response.slice(0, 80));
      }

      setSnackbar({ message: "AI response received.", tone: "success" });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        if (status === 429) {
          setError("Daily AI limit exceeded.");
          setSnackbar({ message: "Daily AI limit exceeded.", tone: "error" });
        } else if (!err.response) {
          setError("Internet unavailable.");
          setSnackbar({ message: "Internet unavailable.", tone: "error" });
        } else if ((status ?? 0) >= 500) {
          setError("Unable to contact AI server.");
          setSnackbar({ message: "Unable to contact AI server.", tone: "error" });
        } else {
          const messageText = getApiErrorMessage(err, "AI assistant is temporarily unavailable.");
          setError(messageText);
          setSnackbar({ message: messageText, tone: "error" });
        }
      } else {
        const messageText = getApiErrorMessage(err, "AI assistant is temporarily unavailable.");
        setError(messageText);
        setSnackbar({ message: messageText, tone: "error" });
      }
    } finally {
      setLoading(false);
      void refreshLimit();
    }
  }

  function clearConversation() {
    const next = conversations.filter((conversation) => conversation.id !== activeConversationId);
    if (next.length > 0) {
      setConversations(next);
      setActiveConversationId(next[0].id);
      return;
    }

    const newConversation = createConversation();
    setConversations([newConversation]);
    setActiveConversationId(newConversation.id);
  }

  const activeMessages = activeConversation?.messages ?? [];
  const remainingLimitText = limitSummary ? `${limitSummary.remaining} remaining` : "Usage limit unavailable";

  return (
    <div className="ai-shell ai-assistant-shell">
      <aside className="ai-sidebar enterprise-card assistant-history-panel">
        <div className="card-title-row">
          <Bot size={18} />
          <h2>Conversation History</h2>
        </div>

        <div className="assistant-limit-card">
          <div>
            <strong>Daily limit</strong>
            <p>{remainingLimitText}</p>
            {limitSummary ? <small>Resets at {formatLimitReset(limitSummary)}</small> : null}
          </div>
          <div className="assistant-limit-actions">
            <span className="meta-chip">{limitSummary ? `${limitSummary.used}/${limitSummary.limit}` : "Synced"}</span>
            <button type="button" className="meta-chip refresh-chip" onClick={() => void refreshLimit()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="conversation-section">
          <div className="card-title-row">
            <Pin size={14} />
            <h3>Pinned Conversations</h3>
          </div>
          <div className="conversation-list">
            {pinnedConversations.length === 0 ? (
              <div className="empty-panel compact"><p>No pinned conversations yet.</p></div>
            ) : (
              pinnedConversations.map((conversation) => (
                <div key={conversation.id} className={`conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}>
                  <button type="button" className="conversation-main" onClick={() => setActiveConversationId(conversation.id)}>
                    <strong>{conversation.title}</strong>
                    <span>{conversation.messages.length} messages</span>
                    <small>{formatCompactTime(conversation.updatedAt)}</small>
                  </button>
                  <div className="conversation-actions">
                    <button type="button" className="icon-btn" onClick={() => togglePin(conversation.id)} aria-label="Unpin conversation"><PinOff size={14} /></button>
                    <button type="button" className="icon-btn" onClick={() => renameConversation(conversation.id)} aria-label="Rename conversation"><PencilLine size={14} /></button>
                    <button type="button" className="icon-btn danger" onClick={() => deleteConversation(conversation.id)} aria-label="Delete conversation"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="conversation-section">
          <div className="card-title-row">
            <HistoryIcon size={14} />
            <h3>All Conversations</h3>
          </div>
          <div className="conversation-list">
            {regularConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
              >
                <button type="button" className="conversation-main" onClick={() => setActiveConversationId(conversation.id)}>
                  <strong>{conversation.title}</strong>
                  <span>{conversation.messages.length} messages</span>
                  <small>{formatCompactTime(conversation.updatedAt)}</small>
                </button>
                <div className="conversation-actions">
                  <button type="button" className="icon-btn" onClick={() => togglePin(conversation.id)} aria-label="Pin conversation"><Pin size={14} /></button>
                  <button type="button" className="icon-btn" onClick={() => renameConversation(conversation.id)} aria-label="Rename conversation"><PencilLine size={14} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => deleteConversation(conversation.id)} aria-label="Delete conversation"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-secondary full-width" onClick={clearConversation}>
          <Eraser size={16} /> Clear Chat
        </button>
      </aside>

      <main className="ai-chat enterprise-card">
        <div className="card-title-row space-between">
          <div>
            <span className="eyebrow">AI Assistant</span>
            <h1>RailTrack AI</h1>
          </div>
          <span className="meta-chip">{limitSummary ? `${limitSummary.remaining} remaining` : "Live backend"}</span>
        </div>

        <div className="suggestion-strip">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button key={question} type="button" className="suggestion-chip" onClick={() => void sendMessage(question)} disabled={loading}>
              <Sparkles size={14} /> {question}
            </button>
          ))}
        </div>

        <section className="chat-messages">
          {activeMessages.length === 0 && <div className="empty-panel compact"><Sparkles size={28} /><p>Ask anything about trains, routes, timing, or travel planning.</p></div>}

          {activeMessages.map((message) => (
            <article key={message.id} className={`chat-message ${message.role}`}>
              <div className="message-meta">
                <strong>{message.role === "user" ? "You" : "RailTrack AI"}</strong>
                <span>{formatCompactTime(message.createdAt)}</span>
              </div>
              <div className="message-body">{message.role === "assistant" ? renderMarkdown(message.content) : <p>{message.content}</p>}</div>
            </article>
          ))}

          {loading && (
            <article className="chat-message assistant typing">
              <div className="message-meta"><strong>RailTrack AI</strong></div>
              <div className="typing-dots"><span /><span /><span /></div>
            </article>
          )}

          {error && <div className="error-banner inline"><strong>Assistant error</strong><p>{error}</p></div>}

          <div ref={bottomRef} />
        </section>

        <form className="chat-input-panel" onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}>
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Ask a question about trains, PNR, station boards, or routes..."
            />
            <button type="submit" className="btn btn-primary send-button" disabled={loading || !input.trim()}>
              <PlayCircle size={16} /> Send
            </button>
          </div>
        </form>
      </main>

      {snackbar && (
        <div className={`assistant-snackbar ${snackbar.tone}`} role="status" aria-live="polite">
          {snackbar.tone === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{snackbar.message}</span>
        </div>
      )}
    </div>
  );
}