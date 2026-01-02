// Davis Assistant - Pillar C: Deep-Dive AI Analysis

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { useDavisInvestigation } from '../hooks';
import type { ConversationMessage } from '../types';

// Quick Action Button
const QuickAction: React.FC<{ label: string; icon: string; onClick: () => void }> = ({ label, icon, onClick }) => (
  <Button onClick={onClick} style={{ whiteSpace: 'nowrap' }}>
    <span style={{ marginRight: 4 }}>{icon}</span> {label}
  </Button>
);

// Chat Message Component
const ChatMessage: React.FC<{ message: ConversationMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <Flex justifyContent={isUser ? 'flex-end' : 'flex-start'} style={{ width: '100%' }}>
      <Surface style={{ 
        maxWidth: '80%',
        backgroundColor: isUser ? 'var(--dt-colors-feedback-info-subtle)' : undefined
      }}>
        <Flex padding={16} flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={8}>
            <span style={{ fontSize: 16 }}>{isUser ? '👤' : '🤖'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
              {isUser ? 'You' : 'Davis AI'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              {message.timestamp.toLocaleTimeString()}
            </span>
          </Flex>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message.content}
          </div>
          {message.metadata?.dqlQuery && (
            <Surface style={{ marginTop: 8 }}>
              <Flex padding={8} flexDirection="column" gap={4}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>
                  DQL Query Used
                </span>
                <code style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {message.metadata.dqlQuery}
                </code>
              </Flex>
            </Surface>
          )}
        </Flex>
      </Surface>
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
    { label: 'Error Analysis', icon: '🔴', query: 'Show me the top errors across all AI services in the last hour' },
    { label: 'Latency Issues', icon: '⚡', query: 'Which AI services have latency above SLA thresholds?' },
    { label: 'Cost Breakdown', icon: '💰', query: 'Give me a cost breakdown by provider and model for today' },
    { label: 'Token Usage', icon: '📊', query: 'Which services are consuming the most tokens?' },
    { label: 'Rate Limits', icon: '🚦', query: 'Are any services hitting rate limits?' },
    { label: 'Model Comparison', icon: '🔄', query: 'Compare performance across different LLM models' },
  ];

  return (
    <Flex flexDirection="column" style={{ height: 'calc(100vh - 120px)' }} padding={24} gap={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={3}>Davis AI Assistant</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Ask questions about your AI services and get intelligent insights
          </span>
        </div>
        <Button onClick={clearConversation}>Clear Conversation</Button>
      </Flex>

      {/* Quick Actions */}
      <Flex gap={8} flexWrap="wrap">
        {quickActions.map(action => (
          <QuickAction
            key={action.label}
            label={action.label}
            icon={action.icon}
            onClick={() => sendMessage(action.query)}
          />
        ))}
      </Flex>

      {/* Chat Messages */}
      <Surface style={{ flex: 1, overflow: 'hidden' }}>
        <Flex flexDirection="column" style={{ height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {messages.length === 0 ? (
              <Flex flexDirection="column" alignItems="center" justifyContent="center" style={{ height: '100%' }} gap={16}>
                <span style={{ fontSize: 64 }}>🤖</span>
                <Heading level={4}>Welcome to Davis AI</Heading>
                <span style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', maxWidth: 400 }}>
                  Ask me anything about your AI services. I can analyze errors, 
                  performance issues, costs, and provide recommendations.
                </span>
              </Flex>
            ) : (
              <Flex flexDirection="column" gap={16}>
                {messages.map((message, index) => (
                  <ChatMessage key={index} message={message} />
                ))}
                {isProcessing && (
                  <Flex alignItems="center" gap={8}>
                    <span style={{ fontSize: 16 }}>🤖</span>
                    <span style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>
                      Davis is thinking...
                    </span>
                  </Flex>
                )}
                <div ref={messagesEndRef} />
              </Flex>
            )}
          </div>
        </Flex>
      </Surface>

      {/* Input Area */}
      <Surface>
        <Flex padding={16} gap={12} alignItems="center">
          <div style={{ flex: 1 }}>
            <TextInput
              value={inputValue}
              onChange={(value) => setInputValue(value)}
              placeholder="Ask Davis about your AI services..."
              onKeyDown={handleKeyPress}
            />
          </div>
          <Button 
            variant="accent" 
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
          >
            {isProcessing ? 'Sending...' : 'Send'}
          </Button>
        </Flex>
      </Surface>
    </Flex>
  );
};
