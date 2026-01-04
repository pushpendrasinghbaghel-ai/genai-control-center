// GenAI Control Center - Intelligence Dashboard
// AI-Powered Investigation and Insights

import React, { useState, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useDavisInvestigation } from '../hooks/useDavisAI';

interface InsightCard {
  id: string;
  title: string;
  category: 'anomaly' | 'optimization' | 'prediction' | 'correlation';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  action: string;
  query?: string;
}

const QUICK_INVESTIGATIONS = [
  {
    id: 'health-check',
    title: '🏥 Health Check',
    description: 'Run comprehensive health assessment across all GenAI services',
    category: 'health',
  },
  {
    id: 'cost-analysis',
    title: '💰 Cost Analysis',
    description: 'Analyze token usage and cost patterns',
    category: 'cost',
  },
  {
    id: 'latency-investigation',
    title: '⏱️ Latency Investigation',
    description: 'Identify slow models and performance bottlenecks',
    category: 'latency',
  },
  {
    id: 'error-analysis',
    title: '🔴 Error Analysis',
    description: 'Investigate errors, 429s, and failure patterns',
    category: 'error',
  },
  {
    id: 'provider-comparison',
    title: '📊 Provider Comparison',
    description: 'Compare providers across performance and cost metrics',
    category: 'compare',
  },
];

export const Intelligence: React.FC = () => {
  const [customQuery, setCustomQuery] = useState('');
  const { 
    messages, 
    isLoading, 
    sendQuery,
    runHealthCheck,
    analyzeCosts,
    investigateLatency,
    investigateRateLimits,
    compareProviders,
    clearConversation,
  } = useDavisInvestigation();

  const handleQuickInvestigation = useCallback((category: string) => {
    switch (category) {
      case 'health':
        runHealthCheck();
        break;
      case 'cost':
        analyzeCosts('all');
        break;
      case 'latency':
        investigateLatency('all');
        break;
      case 'error':
        investigateRateLimits('all');
        break;
      case 'compare':
        compareProviders();
        break;
      default:
        sendQuery(category);
    }
  }, [runHealthCheck, analyzeCosts, investigateLatency, investigateRateLimits, compareProviders, sendQuery]);

  const handleCustomQuery = useCallback(() => {
    if (customQuery.trim()) {
      sendQuery(customQuery);
      setCustomQuery('');
    }
  }, [customQuery, sendQuery]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>Intelligence - AI-Powered Investigation</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Conversational AI analysis powered by Davis and DQL
          </Text>
        </Flex>
        <Button variant="default" onClick={clearConversation}>
          Clear Conversation
        </Button>
      </Flex>

      <Flex gap={16} style={{ flex: 1, minHeight: 0 }}>
        {/* Quick Investigations Panel */}
        <Surface style={{ width: 280, padding: 16, flexShrink: 0 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Quick Investigations</Heading>
            <Flex flexDirection="column" gap={8}>
              {QUICK_INVESTIGATIONS.map((inv) => (
                <Button
                  key={inv.id}
                  variant="default"
                  onClick={() => handleQuickInvestigation(inv.category)}
                  disabled={isLoading}
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                >
                  <Flex flexDirection="column" alignItems="flex-start" gap={2}>
                    <Text>{inv.title}</Text>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      {inv.description}
                    </Text>
                  </Flex>
                </Button>
              ))}
            </Flex>

            {/* AI Insights Preview */}
            <Heading level={6} style={{ marginTop: 16 }}>🧠 AI Capabilities</Heading>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small">• Anomaly detection</Text>
              <Text textStyle="small">• Cost forecasting</Text>
              <Text textStyle="small">• Performance correlation</Text>
              <Text textStyle="small">• Root cause analysis</Text>
              <Text textStyle="small">• Optimization recommendations</Text>
            </Flex>
          </Flex>
        </Surface>

        {/* Conversation Panel */}
        <Surface style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <Flex flexDirection="column" gap={12} style={{ flex: 1 }}>
            <Heading level={6}>Investigation Console</Heading>
            
            {/* Messages */}
            <Flex 
              flexDirection="column" 
              gap={8} 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                minHeight: 300,
                maxHeight: 500,
                padding: 8,
                backgroundColor: 'rgba(0,0,0,0.02)',
                borderRadius: 4,
              }}
            >
              {messages.length === 0 ? (
                <Flex flexDirection="column" alignItems="center" justifyContent="center" style={{ flex: 1 }}>
                  <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                    Start an investigation by selecting a quick action or typing a question below.
                  </Text>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, marginTop: 8 }}>
                    Examples: "Why is latency high?", "Which model is most cost-effective?", "Show me error trends"
                  </Text>
                </Flex>
              ) : (
                messages.map((msg) => (
                  <Surface
                    key={msg.id}
                    style={{
                      padding: 12,
                      maxWidth: '85%',
                      alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.type === 'user' 
                        ? 'rgba(99, 102, 241, 0.1)' 
                        : 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    <Flex flexDirection="column" gap={4}>
                      <Text textStyle="small" style={{ 
                        color: msg.type === 'user' ? Colors.Text.Primary.Default : Colors.Text.Neutral.Subdued,
                        fontWeight: 500,
                      }}>
                        {msg.type === 'user' ? '👤 You' : '🤖 Davis AI'}
                      </Text>
                      {msg.isLoading ? (
                        <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                          Analyzing...
                        </Text>
                      ) : (
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </Text>
                      )}
                    </Flex>
                  </Surface>
                ))
              )}
            </Flex>

            {/* Input */}
            <Flex gap={8}>
              <TextInput
                placeholder="Ask a question about your GenAI services..."
                value={customQuery}
                onChange={(value) => setCustomQuery(value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCustomQuery();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                variant="emphasized"
                onClick={handleCustomQuery}
                disabled={isLoading || !customQuery.trim()}
              >
                {isLoading ? 'Analyzing...' : 'Send'}
              </Button>
            </Flex>
          </Flex>
        </Surface>
      </Flex>
    </Flex>
  );
};

export default Intelligence;
