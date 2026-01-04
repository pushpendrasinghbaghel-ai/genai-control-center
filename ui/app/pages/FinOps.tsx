// GenAI Control Center - FinOps Dashboard
// Industry-standard AI cost management and optimization

import React, { useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { useAIServicesDiscovery, useProviderComparison } from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';

// Cost tiers for budget management
const COST_TIERS = {
  low: { max: 100, color: Colors.Charts.Apdex.Excellent.Default },
  medium: { max: 500, color: Colors.Charts.Apdex.Good.Default },
  high: { max: Infinity, color: Colors.Charts.Apdex.Poor.Default },
};

// Provider cost rates (per 1K tokens)
const PROVIDER_RATES: Record<string, { input: number; output: number }> = {
  'openai': { input: 0.01, output: 0.03 },
  'azure': { input: 0.01, output: 0.03 },
  'anthropic': { input: 0.008, output: 0.024 },
  'google': { input: 0.00025, output: 0.0005 },
  'vertexai': { input: 0.00025, output: 0.0005 },
  'amazon': { input: 0.0008, output: 0.0024 },
  'ollama': { input: 0, output: 0 }, // Self-hosted
  'default': { input: 0.01, output: 0.03 },
};

interface CostBreakdown {
  provider: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requestCount: number;
  avgCostPerRequest: number;
  costTrend: 'up' | 'down' | 'stable';
}

interface BudgetAlert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  provider: string;
  threshold: number;
  current: number;
}

export const FinOps: React.FC = () => {
  const [filters, setFilters] = useState<QueryFilters>({});
  const [budgetLimit, setBudgetLimit] = useState<number>(1000);
  
  const { data: services, loading: servicesLoading } = useAIServicesDiscovery(filters);
  const { data: providers, loading: providersLoading } = useProviderComparison(filters);

  // Calculate cost breakdown by provider
  const costBreakdown = useMemo((): CostBreakdown[] => {
    if (!providers) return [];
    
    return providers.map((p: any) => {
      const providerKey = p.provider?.toLowerCase() || 'default';
      const rates = PROVIDER_RATES[providerKey] || PROVIDER_RATES.default;
      
      const inputTokens = p.totalTokens * 0.3; // Estimate 30% input
      const outputTokens = p.totalTokens * 0.7; // Estimate 70% output
      const estimatedCost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
      
      return {
        provider: p.provider || 'Unknown',
        totalTokens: p.totalTokens || 0,
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
        estimatedCost: estimatedCost,
        requestCount: p.totalRequests || 0,
        avgCostPerRequest: p.totalRequests > 0 ? estimatedCost / p.totalRequests : 0,
        costTrend: 'stable' as const,
      };
    }).sort((a, b) => b.estimatedCost - a.estimatedCost);
  }, [providers]);

  // Calculate total costs
  const totalCost = useMemo(() => {
    return costBreakdown.reduce((sum, c) => sum + c.estimatedCost, 0);
  }, [costBreakdown]);

  const totalTokens = useMemo(() => {
    return costBreakdown.reduce((sum, c) => sum + c.totalTokens, 0);
  }, [costBreakdown]);

  // Generate budget alerts
  const budgetAlerts = useMemo((): BudgetAlert[] => {
    const alerts: BudgetAlert[] = [];
    
    if (totalCost > budgetLimit * 0.9) {
      alerts.push({
        id: 'total-critical',
        type: 'critical',
        message: `Total spend at ${((totalCost / budgetLimit) * 100).toFixed(0)}% of budget`,
        provider: 'All',
        threshold: budgetLimit,
        current: totalCost,
      });
    } else if (totalCost > budgetLimit * 0.7) {
      alerts.push({
        id: 'total-warning',
        type: 'warning',
        message: `Total spend at ${((totalCost / budgetLimit) * 100).toFixed(0)}% of budget`,
        provider: 'All',
        threshold: budgetLimit,
        current: totalCost,
      });
    }

    // Provider-specific alerts for high spenders
    costBreakdown.forEach((c, idx) => {
      if (c.estimatedCost > budgetLimit * 0.3) {
        alerts.push({
          id: `provider-${idx}`,
          type: 'warning',
          message: `${c.provider} consuming ${((c.estimatedCost / totalCost) * 100).toFixed(0)}% of total spend`,
          provider: c.provider,
          threshold: budgetLimit * 0.3,
          current: c.estimatedCost,
        });
      }
    });

    return alerts;
  }, [costBreakdown, totalCost, budgetLimit]);

  const loading = servicesLoading || providersLoading;

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>FinOps - AI Cost Management</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Track, optimize, and forecast GenAI spending across providers
          </Text>
        </Flex>
      </Flex>

      {/* Budget Overview */}
      <Flex gap={16}>
        {/* Total Spend Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Total Estimated Spend
            </Text>
            <Heading level={2} style={{ color: totalCost > budgetLimit ? Colors.Text.Critical.Default : Colors.Text.Neutral.Default }}>
              ${totalCost.toFixed(2)}
            </Heading>
            <Flex alignItems="center" gap={8}>
              <Text textStyle="small">Budget: ${budgetLimit}</Text>
              <ProgressBar 
                value={Math.min((totalCost / budgetLimit) * 100, 100)} 
                style={{ flex: 1 }}
              />
            </Flex>
          </Flex>
        </Surface>

        {/* Total Tokens Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Total Tokens Consumed
            </Text>
            <Heading level={2}>
              {totalTokens.toLocaleString()}
            </Heading>
            <Text textStyle="small">
              Avg: ${(totalCost / Math.max(totalTokens, 1) * 1000).toFixed(4)}/1K tokens
            </Text>
          </Flex>
        </Surface>

        {/* Active Providers Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Active Providers
            </Text>
            <Heading level={2}>
              {costBreakdown.length}
            </Heading>
            <Text textStyle="small">
              {costBreakdown.map(c => c.provider).join(', ')}
            </Text>
          </Flex>
        </Surface>

        {/* Budget Setting */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Budget Limit
            </Text>
            <TextInput
              value={budgetLimit.toString()}
              onChange={(e) => setBudgetLimit(Number(e) || 1000)}
            />
            <Text textStyle="small">
              Set monthly/daily budget threshold
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <Surface style={{ padding: 16, backgroundColor: budgetAlerts.some(a => a.type === 'critical') ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 165, 0, 0.1)' }}>
          <Flex flexDirection="column" gap={8}>
            <Heading level={6}>⚠️ Budget Alerts</Heading>
            {budgetAlerts.map((alert) => (
              <Flex key={alert.id} gap={8} alignItems="center">
                <Text style={{ color: alert.type === 'critical' ? Colors.Text.Critical.Default : Colors.Text.Warning.Default }}>
                  {alert.type === 'critical' ? '🔴' : '🟡'} {alert.message}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Surface>
      )}

      {/* Cost Breakdown Table */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Heading level={6}>Cost Breakdown by Provider</Heading>
          {loading ? (
            <Text>Loading cost data...</Text>
          ) : costBreakdown.length === 0 ? (
            <Text>No cost data available</Text>
          ) : (
            <Flex flexDirection="column" gap={8}>
              {/* Table Header */}
              <Flex style={{ 
                borderBottom: '1px solid var(--dt-colors-border-neutral-default)',
                paddingBottom: 8,
                fontWeight: 600,
                fontSize: 12
              }}>
                <span style={{ flex: 1 }}>Provider</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Total Tokens</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Input</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Output</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Est. Cost</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Requests</span>
                <span style={{ flex: 1, textAlign: 'right' }}>$/Request</span>
              </Flex>
              {/* Table Rows */}
              {costBreakdown.map((row, idx) => (
                <Flex 
                  key={idx}
                  style={{ 
                    padding: '8px 0',
                    borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)',
                    fontSize: 13
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500 }}>{row.provider}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.totalTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.inputTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.outputTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>${row.estimatedCost.toFixed(2)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.requestCount.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>${row.avgCostPerRequest.toFixed(4)}</span>
                </Flex>
              ))}
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* Cost Optimization Recommendations */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Heading level={6}>💡 Cost Optimization Recommendations</Heading>
          <Flex flexDirection="column" gap={8}>
            {costBreakdown.length > 0 && costBreakdown[0].estimatedCost > totalCost * 0.5 && (
              <Surface style={{ padding: 12, backgroundColor: 'rgba(0, 150, 255, 0.1)' }}>
                <Text>
                  <strong>Provider Concentration Risk:</strong> {costBreakdown[0].provider} accounts for {((costBreakdown[0].estimatedCost / totalCost) * 100).toFixed(0)}% of spend. 
                  Consider multi-provider strategy for cost optimization and resilience.
                </Text>
              </Surface>
            )}
            {costBreakdown.some(c => c.avgCostPerRequest > 0.01) && (
              <Surface style={{ padding: 12, backgroundColor: 'rgba(0, 150, 255, 0.1)' }}>
                <Text>
                  <strong>High Cost per Request:</strong> Some providers have avg cost &gt;$0.01/request. 
                  Consider caching frequent queries or using smaller models for simple tasks.
                </Text>
              </Surface>
            )}
            {costBreakdown.some(c => c.provider.toLowerCase() === 'ollama') && (
              <Surface style={{ padding: 12, backgroundColor: 'rgba(0, 200, 100, 0.1)' }}>
                <Text>
                  <strong>Self-Hosted Savings:</strong> Ollama usage detected with $0 API costs. 
                  Expand self-hosted models for non-critical workloads to reduce costs.
                </Text>
              </Surface>
            )}
            {costBreakdown.length === 0 && (
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                No recommendations available - waiting for cost data.
              </Text>
            )}
          </Flex>
        </Flex>
      </Surface>
    </Flex>
  );
};

export default FinOps;
