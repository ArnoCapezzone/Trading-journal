import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTradesStore } from '../store/tradesStore';
import { useSettingsStore } from '../store/settingsStore';
import { streamChat, buildSystemPrompt, type Message } from '../lib/mentorClient';
import {
  listConversations,
  saveConversation,
  deleteConversation,
  createConversation,
  deriveTitle,
  type Conversation,
} from '../lib/conversationStore';
import MessageBubble from '../components/mentor/MessageBubble';
import { useIsMobile } from '../hooks/useMediaQuery';

const SUGGESTED_FR = [
  'Quels sont mes principaux défauts comportementaux ?',
  'Sur quels instruments j\'ai vraiment un edge ?',
  'Pourquoi mon profit factor est-il bas ?',
  'Analyse mes 10 derniers trades en détail',
  'Que dois-je arrêter de faire immédiatement ?',
  'Quel setup je devrais éliminer ?',
];

const SUGGESTED_EN = [
  'What are my main behavioral flaws?',
  'On which instruments do I actually have an edge?',
  'Why is my profit factor low?',
  'Analyze my last 10 trades in detail',
  'What should I stop doing immediately?',
  'Which setup should I eliminate?',
];

function detectLang(): 'fr' | 'en' {
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export default function Mentor() {
  const { trades } = useTradesStore();
  const { accountBalance, currency } = useSettingsStore();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lang = detectLang();
  const suggested = lang === 'fr' ? SUGGESTED_FR : SUGGESTED_EN;

  // Load conversations on mount
  useEffect(() => {
    const list = listConversations();
    setConversations(list);
    if (list.length > 0) setActiveId(list[0].id);
    else {
      const fresh = createConversation();
      saveConversation(fresh);
      setConversations([fresh]);
      setActiveId(fresh.id);
    }
  }, []);

  const active = useMemo(
    () => (activeId ? conversations.find((c) => c.id === activeId) ?? null : null),
    [activeId, conversations]
  );

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [active?.messages.length, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const refresh = () => setConversations(listConversations());

  const handleNewChat = () => {
    const c = createConversation();
    saveConversation(c);
    refresh();
    setActiveId(c.id);
    setError('');
    setInput('');
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    const next = listConversations();
    setConversations(next);
    if (activeId === id) {
      if (next.length > 0) setActiveId(next[0].id);
      else handleNewChat();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (!active || isStreaming || !text.trim()) return;
      setError('');

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        createdAt: Date.now(),
      };

      const updatedHistory = [...active.messages, userMsg];
      const updated: Conversation = {
        ...active,
        messages: updatedHistory,
        title: active.messages.length === 0 ? deriveTitle([userMsg]) : active.title,
        updatedAt: Date.now(),
      };
      saveConversation(updated);
      refresh();
      setActiveId(updated.id);
      setInput('');
      setStreamingContent('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const systemPrompt = buildSystemPrompt(trades, accountBalance, currency);
        let assistantContent = '';
        for await (const chunk of streamChat(systemPrompt, active.messages, userMsg.content, controller.signal)) {
          assistantContent += chunk;
          setStreamingContent(assistantContent);
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantContent,
          createdAt: Date.now(),
        };

        const finalConvo: Conversation = {
          ...updated,
          messages: [...updatedHistory, assistantMsg],
          updatedAt: Date.now(),
        };
        saveConversation(finalConvo);
        refresh();
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          // User stopped — save the partial response
          if (streamingContent.trim()) {
            const partial: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContent + ' [stopped]',
              createdAt: Date.now(),
            };
            const finalConvo: Conversation = {
              ...updated,
              messages: [...updatedHistory, partial],
              updatedAt: Date.now(),
            };
            saveConversation(finalConvo);
            refresh();
          }
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortRef.current = null;
      }
    },
    [active, isStreaming, trades, accountBalance, currency, streamingContent]
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isStreaming) sendMessage(input);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const showEmpty = active && active.messages.length === 0 && !streamingContent;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', backgroundColor: 'var(--bg-app)' }}>
      {/* Conversations sidebar (hidden on mobile) */}
      {!isMobile && (
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          backgroundColor: 'var(--bg-sidebar-alt)',
          borderRight: '1px solid var(--border-faint)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 14px 10px' }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              backgroundColor: '#3D8EF0',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(61,142,240,0.25)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5AA0F5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3D8EF0')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="1.5" x2="6" y2="10.5" /><line x1="1.5" y1="6" x2="10.5" y2="6" />
            </svg>
            New chat
          </button>
        </div>

        <div style={{ padding: '4px 14px 8px', fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Conversations
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 10px',
                marginBottom: 2,
                borderRadius: 6,
                cursor: 'pointer',
                backgroundColor: c.id === activeId ? 'rgba(61,142,240,0.10)' : 'transparent',
                color: c.id === activeId ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: c.id === activeId ? 500 : 400,
                transition: 'all 0.12s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (c.id !== activeId) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                if (c.id !== activeId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this conversation?')) handleDelete(c.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  opacity: c.id === activeId ? 1 : 0.5,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F04848')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Stats footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-faint)', fontSize: 10, color: 'var(--text-faint)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}>
          {trades.length} trades · llama-3.3-70b
        </div>
      </aside>
      )}

      {/* Main chat */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile-only: conversation switcher + new chat */}
        {isMobile && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border-faint)', backgroundColor: 'var(--bg-sidebar-alt)' }}>
            <select
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <button
              onClick={handleNewChat}
              style={{
                padding: '7px 12px',
                backgroundColor: '#3D8EF0',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '16px 14px 16px' : '24px 28px 16px' }}>
            {showEmpty && (
              <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
                <div style={{ width: 52, height: 52, margin: '0 auto 18px', background: 'linear-gradient(135deg, #3D8EF0, #8B6CF0)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(61,142,240,0.3)', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 18, color: '#fff' }}>
                  AI
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
                  Your AI Trading Mentor
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 28, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.65 }}>
                  {lang === 'fr'
                    ? `Coach 24/7 qui analyse tes ${trades.length} trades en temps réel. Pose une question ou choisis une suggestion ci-dessous.`
                    : `24/7 coach with full access to your ${trades.length} trades. Ask anything or pick a suggestion below.`}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, maxWidth: 580, margin: '0 auto' }}>
                  {suggested.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={isStreaming}
                      style={{
                        textAlign: 'left',
                        padding: '11px 14px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 7,
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: isStreaming ? 'not-allowed' : 'pointer',
                        lineHeight: 1.5,
                        transition: 'all 0.15s',
                        opacity: isStreaming ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isStreaming) {
                          e.currentTarget.style.borderColor = 'var(--border-focus)';
                          e.currentTarget.style.backgroundColor = '#111520';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-mid)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {active?.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {isStreaming && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: Date.now(),
                }}
                streaming
              />
            )}

            {error && (
              <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: 'rgba(240,72,72,0.08)', border: '1px solid rgba(240,72,72,0.3)', borderRadius: 6, fontSize: 12, color: '#F04848' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--border-faint)', backgroundColor: 'var(--bg-app)', padding: isMobile ? '10px 14px 14px' : '14px 28px 18px' }}>
          <form onSubmit={handleSubmit} style={{ maxWidth: 780, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                padding: '8px 8px 8px 14px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                transition: 'border-color 0.15s',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={isStreaming}
                placeholder={lang === 'fr' ? 'Pose ta question…  (Shift+Enter pour saut de ligne)' : 'Ask anything…  (Shift+Enter for newline)'}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.55,
                  padding: '6px 0',
                  maxHeight: 160,
                  boxShadow: 'none',
                }}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#F04848',
                    border: 'none',
                    borderRadius: 7,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  title="Stop generation"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="1" y="1" width="8" height="8" rx="1" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: input.trim() ? '#3D8EF0' : 'var(--bg-surface-3)',
                    border: 'none',
                    borderRadius: 7,
                    color: input.trim() ? '#fff' : 'var(--text-muted)',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="12" x2="7" y2="2" /><polyline points="3,6 7,2 11,6" />
                  </svg>
                </button>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', letterSpacing: '0.02em' }}>
              Context auto-injected: {trades.length} trades · KPIs · last 30 trades · auto-detected issues
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
