import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Button,
  Spinner,
} from '@fluentui/react-components';
import { Send20Regular } from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@superior-tmt/shared';

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
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}`)
      .then((r) => r.json())
      .then(({ data }) => setMessages(data || []))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !id || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const { data } = await res.json();
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={500} weight="semibold">
          AI Assistant
        </Text>
        <Text size={200} block style={{ marginTop: '4px', opacity: 0.7 }}>
          Ask questions about the architecture, threats, or code
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
              <Text>{msg.content}</Text>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <Input
          style={{ flex: 1 }}
          placeholder="Ask about the architecture, threats, or code..."
          value={input}
          onChange={(_e, d) => setInput(d.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={sending}
          aria-label="Type a message"
        />
        <Button
          appearance="primary"
          icon={sending ? <Spinner size="tiny" /> : <Send20Regular />}
          onClick={handleSend}
          disabled={!input.trim() || sending}
        />
      </div>
    </div>
  );
}
