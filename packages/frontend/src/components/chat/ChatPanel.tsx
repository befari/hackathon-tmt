import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Tooltip,
  mergeClasses,
} from '@fluentui/react-components';
import {
  Send20Regular,
  Add20Regular,
  Delete20Regular,
  Edit20Regular,
  Chat20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, ChatSession } from '@hackathon-tmt/shared';

interface MentionItem {
  type: 'threat' | 'diagram';
  id: string;
  label: string;
  detail: string;
}

interface SessionWithCount extends ChatSession {
  _count?: { messages: number };
}

const useStyles = makeStyles({
  outerContainer: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  sessionList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sessionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  sessionItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    fontSize: '13px',
    fontWeight: 500 as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  sessionMeta: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  header: {
    padding: '20px 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  message: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: tokens.borderRadiusMedium,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    '& p': { marginTop: 0, marginBottom: '8px' },
    '& p:last-child': { marginBottom: 0 },
    '& ul, & ol': { marginTop: 0, marginBottom: '8px', paddingLeft: '20px' },
    '& ul:last-child, & ol:last-child': { marginBottom: 0 },
    '& h1, & h2, & h3, & h4': { marginTop: '4px', marginBottom: '6px' },
    '& pre': {
      marginTop: '4px',
      marginBottom: '8px',
      padding: '8px',
      borderRadius: tokens.borderRadiusSmall,
      backgroundColor: tokens.colorNeutralBackground1,
      overflowX: 'auto' as const,
    },
    '& pre:last-child': { marginBottom: 0 },
    '& code': { fontSize: '0.9em' },
    '& blockquote': {
      marginTop: '4px',
      marginBottom: '8px',
      paddingLeft: '12px',
      borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
    },
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    alignItems: 'flex-end',
    position: 'relative' as const,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '36px',
    maxHeight: '120px',
    padding: '6px 12px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '20px',
    resize: 'none' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  mentionDropdown: {
    position: 'absolute' as const,
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: '4px',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
    zIndex: 100,
  },
  mentionItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '8px 12px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  mentionItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  mentionLabel: {
    fontSize: '13px',
    fontWeight: 600 as const,
    color: tokens.colorNeutralForeground1,
  },
  mentionDetail: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  mentionBadge: {
    display: 'inline',
    color: tokens.colorBrandForeground1,
    fontWeight: 600 as const,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: tokens.colorNeutralForeground3,
  },
  renameInput: {
    flex: 1,
    minWidth: 0,
    padding: '2px 6px',
    fontSize: '13px',
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    outline: 'none',
  },
});

export function ChatPanel() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();

  // Session state
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Mention state
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [activeMentions, setActiveMentions] = useState<MentionItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Fetch sessions
  const loadSessions = useCallback(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/sessions`)
      .then((r) => r.json())
      .then(({ data }) => setSessions(data || []))
      .catch(console.error);
  }, [id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Fetch mentionable items
  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/mentions`)
      .then((r) => r.json())
      .then(({ data }) => setMentionItems(data || []))
      .catch(console.error);
  }, [id]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    fetch(`/api/chat/sessions/${activeSessionId}/messages`)
      .then((r) => r.json())
      .then(({ data }) => setMessages(data || []))
      .catch(console.error);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Session actions ---

  const handleNewChat = async () => {
    if (!id) return;
    const res = await fetch(`/api/chat/${id}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { data } = await res.json();
    setSessions((prev) => [data, ...prev]);
    setActiveSessionId(data.id);
    setMessages([]);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await fetch(`/api/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameValue.trim() }),
    });
    setSessions((prev) =>
      prev.map((s) => s.id === sessionId ? { ...s, title: renameValue.trim() } : s)
    );
    setRenamingId(null);
  };

  // --- Mention logic ---

  const filteredMentions = mentionItems.filter((item) =>
    item.label.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const insertMention = useCallback((item: MentionItem) => {
    const start = mentionStartRef.current;
    if (start < 0) return;
    const before = input.slice(0, start);
    const after = input.slice(textareaRef.current?.selectionStart ?? input.length);
    const mentionText = `@${item.label} `;
    setInput(before + mentionText + after);
    setActiveMentions((prev) => [...prev, item]);
    setShowMentions(false);
    mentionStartRef.current = -1;
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = before.length + mentionText.length;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    const cursor = ta.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const charBefore = lastAt > 0 ? val[lastAt - 1] : ' ';
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if ((charBefore === ' ' || charBefore === '\n' || lastAt === 0) && !textAfterAt.includes(' ')) {
        mentionStartRef.current = lastAt;
        setMentionFilter(textAfterAt);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setShowMentions(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    const mentions = [...activeMentions];
    setActiveMentions([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          mentions: mentions.map((m) => ({ type: m.type, id: m.id })),
        }),
      });
      const { data } = await res.json();
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
      window.dispatchEvent(new CustomEvent('chat-action-executed'));
      // Refresh sessions to update title and order
      loadSessions();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const renderUserContent = (content: string) => {
    const parts = content.split(/(@(?:T-\d+:[^@]*?|DFD:[^@]*?)(?=\s|$))/g);
    return parts.map((part, i) =>
      part.startsWith('@T-') || part.startsWith('@DFD:') ? (
        <span key={i} className={styles.mentionBadge}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={styles.outerContainer}>
      {/* Session sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Text size={400} weight="semibold">Chats</Text>
          <Tooltip content="New chat" relationship="label">
            <Button
              appearance="subtle"
              icon={<Add20Regular />}
              onClick={handleNewChat}
              size="small"
              aria-label="New chat"
            />
          </Tooltip>
        </div>
        <div className={styles.sessionList}>
          {sessions.length === 0 && (
            <Text size={200} style={{ padding: '16px', textAlign: 'center', opacity: 0.6 }}>
              No conversations yet
            </Text>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={mergeClasses(
                styles.sessionItem,
                activeSessionId === s.id && styles.sessionItemActive
              )}
              onClick={() => { setActiveSessionId(s.id); setRenamingId(null); }}
              onMouseEnter={() => setHoveredSessionId(s.id)}
              onMouseLeave={() => setHoveredSessionId(null)}
            >
              <Chat20Regular style={{ flexShrink: 0, opacity: 0.6 }} />
              {renamingId === s.id ? (
                <>
                  <input
                    className={styles.renameInput}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSession(s.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <Button
                    appearance="subtle"
                    icon={<Checkmark20Regular />}
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleRenameSession(s.id); }}
                  />
                  <Button
                    appearance="subtle"
                    icon={<Dismiss20Regular />}
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                  />
                </>
              ) : (
                <>
                  <div className={styles.sessionInfo}>
                    <div className={styles.sessionTitle}>{s.title}</div>
                    <div className={styles.sessionMeta}>
                      {formatDate(s.updatedAt)}
                      {s._count?.messages ? ` · ${s._count.messages} msgs` : ''}
                    </div>
                  </div>
                  {hoveredSessionId === s.id && (
                    <span style={{ display: 'flex', gap: '2px' }}>
                    <Tooltip content="Rename" relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<Edit20Regular />}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(s.id);
                          setRenameValue(s.title);
                        }}
                      />
                    </Tooltip>
                    <Tooltip content="Delete" relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                      />
                    </Tooltip>
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={styles.container}>
        <div className={styles.header}>
          <Text size={500} weight="semibold">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title || 'AI Assistant'
              : 'AI Assistant'}
          </Text>
          <Text size={200} block style={{ marginTop: '4px', opacity: 0.7 }}>
            {activeSessionId
              ? 'Use @ to reference threats & diagrams'
              : 'Create or select a chat to get started'}
          </Text>
        </div>

        <div className={styles.messages}>
          {!activeSessionId ? (
            <div className={styles.empty}>
              <Chat20Regular style={{ fontSize: '48px', opacity: 0.3 }} />
              <Text size={300}>Select a conversation or start a new one</Text>
              <Button appearance="primary" icon={<Add20Regular />} onClick={handleNewChat}>
                New Chat
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.empty}>
              <Text>Start a conversation about your threat model</Text>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.message} ${
                  msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <Text>{renderUserContent(msg.content)}</Text>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {activeSessionId && (
          <div className={styles.inputArea}>
            <div className={styles.inputWrapper}>
              {showMentions && filteredMentions.length > 0 && (
                <div className={styles.mentionDropdown}>
                  {filteredMentions.map((item, i) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={mergeClasses(
                        styles.mentionItem,
                        i === mentionIndex && styles.mentionItemActive
                      )}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(item); }}
                      onMouseEnter={() => setMentionIndex(i)}
                    >
                      <span className={styles.mentionLabel}>{item.label}</span>
                      <span className={styles.mentionDetail}>{item.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Ask about threats, architecture... Type @ to mention"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={sending}
                rows={1}
                aria-label="Type a message"
              />
            </div>
            <Tooltip content="Send message" relationship="label">
              <Button
                appearance="primary"
                icon={sending ? <Spinner size="tiny" /> : <Send20Regular />}
                onClick={handleSend}
                disabled={!input.trim() || sending}
                aria-label="Send message"
              />
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
