// Dynatrace Assist - Pillar C: Deep-Dive AI Analysis

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { TextInput } from '@dynatrace/strato-components/forms';
import { AiIcon, HelpIcon, DavisAIIcon } from '@dynatrace/strato-icons';
import { useDavisInvestigation } from '../hooks';
import type { ConversationMessage } from '../types';
import { formatTime } from '../utils/formatting';

// Quick Action Button - Compact
const QuickAction: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <Button onClick={onClick} style={{ whiteSpace: 'nowrap' }}>
    {label}
  </Button>
);

// Chat Message Component - Compact
const ChatMessage: React.FC<{ message: ConversationMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <Flex justifyContent={isUser ? 'flex-end' : 'flex-start'} style={{ width: '100%' }}>
      <Flex style={{ 
        maxWidth: '80%',
        padding: 12,
        borderRadius: 8,
        backgroundColor: isUser ? 'var(--dt-colors-feedback-info-subtle)' : 'var(--dt-colors-surface-default)',
        border: isUser ? 'none' : '1px solid var(--dt-colors-border-neutral-default)'
      }}>
        <Flex alignItems="center" gap={6} style={{ marginBottom: 6 }}>
          <Text style={{ display: 'flex', alignItems: 'center' }}>
            {isUser 
              ? <HelpIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-primary-default)' }} /> 
              : <AiIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-accent-default)' }} />
            }
          </Text>
          <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            {isUser ? 'You' : 'Dynatrace Intelligence'}
          </Text>
          <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
            {formatTime(message.timestamp)}
          </Text>
        </Flex>
        <Flex style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 13 }}>
          {message.content}
        </Flex>
        {message.metadata?.dqlQuery && (
          <Flex style={{ 
            marginTop: 8, 
            padding: 8, 
            borderRadius: 4,
            background: 'var(--dt-colors-background-default-secondary)'
          }}>
            <Text style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>
              DQL Query
            </Text>
            <code style={{ display: 'block', fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {message.metadata.dqlQuery}
            </code>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};

export const DavisAssistant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service');
  const preselectedQuery = searchParams.get('query');
  
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isProcessing, sendMessage, clearConversation } = useDavisInvestigation();

  useEffect(() => {
    if (preselectedQuery && messages.length === 0) {
      sendMessage(preselectedQuery);
    } else if (preselectedService && messages.length === 0) {
      sendMessage(`Analyze the health and performance of service: ${preselectedService}`);
    }
  }, [preselectedQuery, preselectedService, messages.length, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() && !isProcessing) {
      sendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: 'Errors', query: 'Show me the top errors across all AI services in the last hour' },
    { label: 'Latency', query: 'Which AI services have latency above SLA thresholds?' },
    { label: 'Costs', query: 'Give me a cost breakdown by provider and model for today' },
    { label: 'Tokens', query: 'Which services are consuming the most tokens?' },
    { label: 'Rate Limits', query: 'Are any services hitting rate limits?' },
    { label: 'Models', query: 'Compare performance across different LLM models' },
  ];

  return (
    <Flex flexDirection="column" style={{ height: '100%' }} padding={16} gap={16}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <DavisAIIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Dynatrace Assist</TitleBar.Title>
        <TitleBar.Subtitle>Natural language AI investigation</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button onClick={clearConversation} aria-label="Clear conversation">Clear</Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Quick Actions - Compact */}
      <Flex gap={8} flexWrap="wrap">
        {quickActions.map(action => (
          <QuickAction
            key={action.label}
            label={action.label}
            onClick={() => sendMessage(action.query)}
          />
        ))}
      </Flex>

      {/* Chat Messages */}
      <Surface style={{ flex: 1, overflow: 'hidden' }}>
        <Flex flexDirection="column" style={{ height: '100%' }}>
          <Flex style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {messages.length === 0 ? (
              <Flex flexDirection="column" alignItems="center" justifyContent="center" style={{ height: '100%' }} gap={12}>
                <AiIcon style={{ width: 48, height: 48, color: 'var(--dt-colors-text-accent-default)' }} />
                <Heading level={5}>Welcome to Dynatrace Assist</Heading>
                <Text style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', maxWidth: 360, fontSize: 13 }}>
                  Ask me about your AI services - errors, performance, costs, and recommendations.
                </Text>
              </Flex>
            ) : (
              <Flex flexDirection="column" gap={12}>
                {messages.map((message, index) => (
                  <ChatMessage key={index} message={message} />
                ))}
                {isProcessing && (
                  <Flex alignItems="center" gap={6}>
                    <AiIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-accent-default)' }} />
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic', fontSize: 12 }}>
                      Davis is thinking...
                    </Text>
                  </Flex>
                )}
                <Flex ref={messagesEndRef} />
              </Flex>
            )}
          </Flex>
        </Flex>
      </Surface>

      {/* Input Area - Compact */}
      <Flex gap={8} alignItems="center" padding={12} style={{
        background: 'var(--dt-colors-surface-default)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-border-neutral-default)'
      }}>
        <Flex style={{ flex: 1 }}>
          <TextInput
            value={inputValue}
            onChange={(value) => setInputValue(value)}
            placeholder="Ask Dynatrace Intelligence about your AI services..."
            onKeyDown={handleKeyPress}
          />
        </Flex>
        <Button 
          variant="accent" 
          onClick={handleSend}
          disabled={!inputValue.trim() || isProcessing}
        >
          {isProcessing ? 'Sending...' : 'Send'}
        </Button>
      </Flex>
    </Flex>
  );
};
