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
import { Send20Regular } from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@superior-tmt/shared';

interface MentionItem {
  type: 'threat' | 'diagram';
  id: string;
  label: string;
  detail: string;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
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
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export function ChatPanel() {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [activeMentions, setActiveMentions] = useState<MentionItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Fetch chat history
  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}`)
      .then((r) => r.json())
      .then(({ data }) => setMessages(data || []))
      .catch(console.error);
  }, [id]);

  // Fetch mentionable items
  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/mentions`)
      .then((r) => r.json())
      .then(({ data }) => setMentionItems(data || []))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    // Focus back to textarea
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

    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    // Check for @ trigger
    const cursor = ta.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const charBefore = lastAt > 0 ? val[lastAt - 1] : ' ';
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      // Only trigger if @ is at start or preceded by a space, and no space in the filter yet
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !id || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    const mentions = [...activeMentions];
    setActiveMentions([]);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch(`/api/chat/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          mentions: mentions.map((m) => ({ type: m.type, id: m.id })),
        }),
      });
      const { data } = await res.json();
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Render message content with styled @mentions
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={500} weight="semibold">
          AI Assistant
        </Text>
        <Text size={200} block style={{ marginTop: '4px', opacity: 0.7 }}>
          Ask questions about the architecture, threats, or code — use @ to reference threats & diagrams
        </Text>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <Text>Start a conversation about your threat model</Text>
          </div>
        )}
        {messages.map((msg) => (
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
        ))}
        <div ref={messagesEndRef} />
      </div>

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
    </div>
  );
}
