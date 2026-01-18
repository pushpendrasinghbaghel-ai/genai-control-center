// GenAI Control Center - Intelligence Dashboard
// AI-Powered Investigation and Insights

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  HostsIcon,
  MoneyIcon,
  ClockIcon,
  CriticalIcon,
  AiIcon,
  HelpIcon,
  BarChartIcon
} from '@dynatrace/strato-icons';
import { useDavisInvestigation } from '../hooks/useDavisAI';
import { useAIServicesDiscovery, useProviderComparison } from '../hooks/useDQLQueries';
import { DavisResponse } from '../components/DavisResponse';
import type { QueryFilters } from '../hooks/useDQLQueries';

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
    title: 'Health Check',
    description: 'Run comprehensive health assessment across all GenAI services',
    category: 'health',
    icon: 'health',
  },
  {
    id: 'cost-analysis',
    title: 'Cost Analysis',
    description: 'Analyze token usage and cost patterns',
    category: 'cost',
    icon: 'cost',
  },
  {
    id: 'latency-investigation',
    title: 'Latency Investigation',
    description: 'Identify slow models and performance bottlenecks',
    category: 'latency',
    icon: 'latency',
  },
  {
    id: 'error-analysis',
    title: 'Error Analysis',
    description: 'Investigate errors, 429s, and failure patterns',
    category: 'error',
    icon: 'error',
  },
  {
    id: 'provider-comparison',
    title: 'Provider Comparison',
    description: 'Compare providers across performance and cost metrics',
    category: 'compare',
    icon: 'compare',
  },
];

export const Intelligence: React.FC = () => {
  const [customQuery, setCustomQuery] = useState('');
  const [filters] = useState<QueryFilters>({});
  
  // Real-time data hooks
  const { data: services, loading: servicesLoading } = useAIServicesDiscovery(filters);
  const { data: providers, loading: providersLoading } = useProviderComparison(filters);
  
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

  // Calculate real-time insights from data
  const realTimeInsights = useMemo(() => {
    if (!services || !providers) return null;
    
    const criticalServices = services.filter(s => s.errorRate > 5);
    const warningServices = services.filter(s => s.errorRate > 1 && s.errorRate <= 5);
    const slowServices = services.filter(s => s.avgLatency > 3000);
    const totalTokens = services.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
    const avgErrorRate = services.length > 0 
      ? services.reduce((sum, s) => sum + s.errorRate, 0) / services.length 
      : 0;
    const avgLatency = services.length > 0
      ? services.reduce((sum, s) => sum + s.avgLatency, 0) / services.length
      : 0;

    return {
      criticalCount: criticalServices.length,
      warningCount: warningServices.length,
      healthyCount: services.length - criticalServices.length - warningServices.length,
      slowCount: slowServices.length,
      totalTokens,
      totalServices: services.length,
      totalProviders: providers.length,
      avgErrorRate,
      avgLatency,
      criticalServices,
      warningServices,
      slowServices,
    };
  }, [services, providers]);

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
      {/* Compact Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
          AI-Powered Investigation • Real-time DQL Analysis
        </Text>
        <Button variant="default" onClick={clearConversation}>
          Clear Conversation
        </Button>
      </Flex>

      {/* Real-time Status Overview */}
      {(servicesLoading || providersLoading) ? (
        <Surface style={{ padding: 16, textAlign: 'center' }}>
          <Flex alignItems="center" justifyContent="center" gap={8}>
            <ProgressCircle size="small" />
            <Text>Loading real-time data from Dynatrace...</Text>
          </Flex>
        </Surface>
      ) : realTimeInsights && (
        <Flex gap={12}>
          <Surface style={{ flex: 1, padding: 12 }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Services</Text>
              <Heading level={3}>{realTimeInsights.totalServices}</Heading>
              <Flex gap={8}>
                <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>
                  {realTimeInsights.healthyCount} healthy
                </Text>
                {realTimeInsights.warningCount > 0 && (
                  <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>
                    {realTimeInsights.warningCount} warning
                  </Text>
                )}
                {realTimeInsights.criticalCount > 0 && (
                  <Text textStyle="small" style={{ color: Colors.Text.Critical.Default }}>
                    {realTimeInsights.criticalCount} critical
                  </Text>
                )}
              </Flex>
            </Flex>
          </Surface>

          <Surface style={{ flex: 1, padding: 12 }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Providers</Text>
              <Heading level={3}>{realTimeInsights.totalProviders}</Heading>
              <Text textStyle="small">Active AI providers</Text>
            </Flex>
          </Surface>

          <Surface style={{ flex: 1, padding: 12 }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Tokens (24h)</Text>
              <Heading level={3}>{realTimeInsights.totalTokens.toLocaleString()}</Heading>
              <Text textStyle="small">Total consumed</Text>
            </Flex>
          </Surface>

          <Surface style={{ flex: 1, padding: 12 }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Avg Latency</Text>
              <Heading level={3}>{realTimeInsights.avgLatency.toFixed(0)}ms</Heading>
              <Text textStyle="small" style={{ 
                color: realTimeInsights.slowCount > 0 ? Colors.Text.Warning.Default : Colors.Text.Neutral.Subdued 
              }}>
                {realTimeInsights.slowCount > 0 ? `${realTimeInsights.slowCount} slow` : 'All within SLA'}
              </Text>
            </Flex>
          </Surface>

          <Surface style={{ flex: 1, padding: 12 }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Error Rate</Text>
              <Heading level={3} style={{
                color: realTimeInsights.avgErrorRate > 5 ? Colors.Text.Critical.Default :
                       realTimeInsights.avgErrorRate > 1 ? Colors.Text.Warning.Default :
                       Colors.Text.Success.Default
              }}>
                {realTimeInsights.avgErrorRate.toFixed(1)}%
              </Heading>
              <Text textStyle="small">Average across services</Text>
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Automated Insights */}
      {realTimeInsights && (realTimeInsights.criticalCount > 0 || realTimeInsights.slowCount > 0) && (
        <Surface style={{ padding: 12, backgroundColor: 'rgba(255, 100, 0, 0.08)' }}>
          <Flex flexDirection="column" gap={8}>
            <Heading level={6}>Automated Insights</Heading>
            {realTimeInsights.criticalServices.slice(0, 3).map((svc, idx) => (
              <Flex key={idx} justifyContent="space-between" alignItems="center">
                <Text>
                  <strong style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>{svc.serviceName}</strong> has {svc.errorRate.toFixed(1)}% error rate ({svc.modelName})
                </Text>
                <Button 
                  variant="default" 
                  onClick={() => sendQuery(`Investigate errors for service ${svc.serviceName}`)}
                  disabled={isLoading}
                >
                  Investigate
                </Button>
              </Flex>
            ))}
            {realTimeInsights.slowServices.slice(0, 2).map((svc, idx) => (
              <Flex key={`slow-${idx}`} justifyContent="space-between" alignItems="center">
                <Text>
                  <strong style={{ color: 'var(--dt-colors-feedback-warning-default)' }}>{svc.serviceName}</strong> has high latency ({svc.avgLatency.toFixed(0)}ms)
                </Text>
                <Button 
                  variant="default" 
                  onClick={() => investigateLatency(svc.serviceName)}
                  disabled={isLoading}
                >
                  Investigate
                </Button>
              </Flex>
            ))}
          </Flex>
        </Surface>
      )}

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

            {/* Quick action to go to Health Dashboard */}
            <Button
              variant="default"
              onClick={() => window.location.href = '/health'}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
            >
              <Flex flexDirection="column" alignItems="flex-start" gap={2}>
                <Text>View Health Dashboard</Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  See all services and metrics
                </Text>
              </Flex>
            </Button>
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {msg.type === 'user' 
                          ? <><HelpIcon style={{ width: 14, height: 14 }} /> You</>
                          : <><AiIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-accent-default)' }} /> Davis AI</>
                        }
                      </Text>
                      {msg.isLoading ? (
                        <Flex alignItems="center" gap={8}>
                          <ProgressCircle size="small" />
                          <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                            Analyzing...
                          </Text>
                        </Flex>
                      ) : msg.type === 'davis' ? (
                        <DavisResponse content={msg.content} />
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
