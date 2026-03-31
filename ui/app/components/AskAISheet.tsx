// Ask Dynatrace Intelligence Assist — Sheet Panel
// Slide-from-right contextual AI panel with suggested prompts and conversation

import React, { useState, useRef, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Sheet } from '@dynatrace/strato-components/overlays';
import { Button } from '@dynatrace/strato-components/buttons';
import { Text, Heading } from '@dynatrace/strato-components/typography';
import { TextInput } from '@dynatrace/strato-components/forms';
import { ProgressCircle, Chip } from '@dynatrace/strato-components/content';
import { AiIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';

import { formatNumber } from '../utils/formatting';
import { useAskAI } from '../hooks/useAskAI';
import type { AskAIContext, AskAIMessage } from '../hooks/useAskAI';
import { DavisResponse } from './DavisResponse';

interface AskAISheetProps {
  /** Whether the sheet is visible */
  show: boolean;
  /** Called when the sheet should close */
  onDismiss: () => void;
  /** The domain context to send to AI */
  context: AskAIContext;
}

export const AskAISheet: React.FC<AskAISheetProps> = ({ show, onDismiss, context }) => {
  const { messages, isLoading, error, ask, clearMessages } = useAskAI(context);
  const [input, setInput] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Inject blink keyframes once
  useEffect(() => {
    const id = 'ask-ai-blink-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}';
      document.head.appendChild(style);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setLastQuestion(trimmed);
    setInput('');
    void ask(trimmed);
  };

  const handleChip = (prompt: string) => {
    if (isLoading) return;
    setLastQuestion(prompt);
    void ask(prompt);
  };

  const handleRetry = () => {
    if (!lastQuestion || isLoading) return;
    void ask(lastQuestion);
  };

  const title = context.itemLabel
    ? `Ask AI — ${context.itemLabel}`
    : `Ask AI — ${context.domain}`;

  return (
    <Sheet
      title={title}
      show={show}
      onDismiss={onDismiss}
      actions={
        <Button variant="default" onClick={onDismiss}>
          Close
        </Button>
      }
    >
      <Flex flexDirection="column" gap={12} style={{ height: '100%' }}>
        {/* Context badge */}
        <Surface style={{ padding: 10, borderLeft: '3px solid var(--dt-colors-charts-categorical-color-01-default)', borderRadius: 4 }}>
          <Flex alignItems="center" gap={6}>
            <AiIcon style={{ width: 14, height: 14, color: Colors.Text.Primary.Default }} />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {context.itemLabel
                ? `Analyzing: ${context.itemLabel}`
                : `Page: ${context.domain}`}
              {context.data && Object.keys(context.data).length > 0 && (
                <> &bull; {Object.entries(context.data).filter(([,v]) => v != null).slice(0, 3).map(([k,v]) => `${k}: ${typeof v === 'number' ? formatNumber(v, { maximumFractionDigits: v < 1 ? 4 : 0 }) : v}`).join(' · ')}</>
              )}
            </Text>
          </Flex>
        </Surface>

        {/* Suggested prompts as chips */}
        {context.suggestedPrompts && context.suggestedPrompts.length > 0 && messages.length === 0 && (
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Suggested Questions</Text>
            <Flex gap={6} flexWrap="wrap">
              {context.suggestedPrompts.map((prompt, i) => (
                <Chip
                  key={i}
                  onClick={() => handleChip(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </Chip>
              ))}
            </Flex>
          </Flex>
        )}

        {/* Message thread */}
        <Flex ref={scrollRef} flexDirection="column" gap={0} style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
          <Flex flexDirection="column" gap={12}>
            {messages.length === 0 && (
              <Flex flexDirection="column" alignItems="center" gap={8} style={{ padding: 32, opacity: 0.5 }}>
                <AiIcon style={{ width: 32, height: 32 }} />
                <Text textStyle="small">Ask a question or pick a suggestion above</Text>
              </Flex>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </Flex>
        </Flex>

        {/* Input area */}
        {error && lastQuestion && (
          <Flex alignItems="center" gap={8} style={{ padding: '6px 10px', backgroundColor: 'var(--dt-colors-background-warning-default)', borderRadius: 6 }}>
            <Text textStyle="small" style={{ flex: 1, color: 'var(--dt-colors-text-warning-default)' }}>Dynatrace Intelligence is temporarily unavailable.</Text>
            <Button variant="default" onClick={handleRetry} disabled={isLoading}>
              Retry
            </Button>
          </Flex>
        )}
        <Flex gap={8} alignItems="center">
          <Flex style={{ flexGrow: 1 }}>
            <TextInput
              placeholder="Ask about this data..."
              value={input}
              onChange={(val) => setInput(val ?? '')}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={isLoading}
            />
          </Flex>
          <Button variant="emphasized" onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <ProgressCircle size="small" /> : 'Ask'}
          </Button>
          {messages.length > 0 && (
            <Button variant="default" onClick={clearMessages} disabled={isLoading}>
              Clear
            </Button>
          )}
        </Flex>
      </Flex>
    </Sheet>
  );
};

// ── Internal message bubble ──

const MessageBubble: React.FC<{ message: AskAIMessage }> = ({ message }) => {
  // Loading state before any tokens arrive
  if (message.isLoading && !message.content) {
    return (
      <Flex gap={8} alignItems="center" style={{ padding: 8 }}>
        <ProgressCircle size="small" />
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Analyzing...</Text>
      </Flex>
    );
  }

  if (message.role === 'user') {
    return (
      <Flex justifyContent="flex-end">
        <Surface style={{
          padding: '8px 14px',
          borderRadius: 12,
          borderBottomRightRadius: 4,
          maxWidth: '80%',
          backgroundColor: 'var(--dt-colors-surface-primary-default)',
        }}>
          <Text textStyle="small" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
        </Surface>
      </Flex>
    );
  }

  // Assistant message — render via DavisResponse for rich formatting
  return (
    <Surface style={{ padding: 12, borderRadius: 8, borderLeft: '3px solid var(--dt-colors-charts-categorical-color-01-default)' }}>
      <DavisResponse content={message.content} />
      {message.isStreaming && (
        <Text as="span" style={{
          display: 'inline-block',
          width: 6,
          height: 14,
          backgroundColor: 'var(--dt-colors-text-primary-default)',
          animation: 'blink 1s step-end infinite',
          marginLeft: 2,
          verticalAlign: 'text-bottom',
        }} />
      )}
    </Surface>
  );
};
