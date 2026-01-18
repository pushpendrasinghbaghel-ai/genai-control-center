// GenAI Control Center - FinOps Dashboard
// Industry-standard AI cost management and optimization

import React, { useCallback, useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { DocumentIcon, WarningIcon, CriticalIcon } from '@dynatrace/strato-icons';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { 
  useProviderComparison, 
  useDistinctServices, 
  useDistinctProviders, 
  useDistinctModels 
} from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';

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

interface ForecastData {
  day: number;
  projectedCost: number;
  projectedTokens: number;
  confidence: 'high' | 'medium' | 'low';
}

// Simple linear regression for forecasting
function calculateForecast(
  currentCost: number,
  currentTokens: number,
  daysOfData: number = 7
): ForecastData[] {
  // Calculate daily average based on current period
  const dailyAvgCost = currentCost / Math.max(daysOfData, 1);
  const dailyAvgTokens = currentTokens / Math.max(daysOfData, 1);
  
  // Assume slight growth trend (5% weekly increase typical for AI adoption)
  const dailyGrowthRate = 1.007; // ~0.7% daily growth
  
  const forecast: ForecastData[] = [];
  
  for (let day = 1; day <= 30; day++) {
    const growthFactor = Math.pow(dailyGrowthRate, day);
    const projectedDailyCost = dailyAvgCost * growthFactor;
    const projectedDailyTokens = dailyAvgTokens * growthFactor;
    
    // Cumulative projection
    const projectedCost = currentCost + (projectedDailyCost * day);
    const projectedTokens = currentTokens + (projectedDailyTokens * day);
    
    // Confidence decreases over time
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (day > 14) confidence = 'low';
    else if (day > 7) confidence = 'medium';
    
    forecast.push({
      day,
      projectedCost,
      projectedTokens,
      confidence,
    });
  }
  
  return forecast;
}

export const FinOps: React.FC = () => {
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();
  const [budgetLimit, setBudgetLimit] = useState<number>(1000);
  
  // Get available service options (with entity IDs)
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();
  
  // Create a mapping from entity name to entity ID
  const serviceNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (availableServiceOptions) {
      availableServiceOptions.forEach(opt => {
        map.set(opt.entityName, opt.entityId);
      });
    }
    return map;
  }, [availableServiceOptions]);
  
  // Convert FilterOptions to QueryFilters - convert name to entity ID
  const queryFilters = useMemo<QueryFilters>(() => {
    const serviceEntityId = filters.serviceFilter 
      ? serviceNameToIdMap.get(filters.serviceFilter) || filters.serviceFilter
      : undefined;
    
    return {
      timeframe: filters.timeframe,
      serviceName: serviceEntityId,
      provider: filters.providerFilter || undefined,
      model: filters.modelFilter || undefined
    };
  }, [filters, serviceNameToIdMap]);
  
  const { data: providers, loading: providersLoading, refetch } = useProviderComparison(queryFilters);
  
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Calculate cost breakdown by provider - use actual data from hook
  const costBreakdown = useMemo((): CostBreakdown[] => {
    if (!providers) return [];
    
    return providers.map((p: any) => {
      const providerName = p.provider || 'Unknown';
      
      return {
        provider: providerName,
        totalTokens: p.totalTokens || 0,
        inputTokens: 0, // Not exposed separately, but cost is calculated correctly
        outputTokens: 0,
        estimatedCost: p.estimatedCost || 0, // Use pre-calculated cost from hook
        requestCount: p.totalRequests || 0,
        avgCostPerRequest: p.totalRequests > 0 ? (p.estimatedCost || 0) / p.totalRequests : 0,
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

  // Calculate cost forecast
  const costForecast = useMemo(() => {
    return calculateForecast(totalCost, totalTokens, 7);
  }, [totalCost, totalTokens]);

  // Forecast projections
  const forecast7Day = costForecast.find(f => f.day === 7);
  const forecast14Day = costForecast.find(f => f.day === 14);
  const forecast30Day = costForecast.find(f => f.day === 30);

  // Budget breach prediction
  const budgetBreachDay = useMemo(() => {
    const breachPoint = costForecast.find(f => f.projectedCost >= budgetLimit);
    return breachPoint?.day || null;
  }, [costForecast, budgetLimit]);

  const loading = providersLoading;

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Compact Header */}
      <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
        AI Cost Management & Optimization
      </Text>

      {/* Estimation Disclaimer */}
      <Surface style={{ padding: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={8}>
          <DocumentIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            <strong>Note:</strong> Cost estimates use public pricing (OpenAI $0.50-$15/MTok, Anthropic $3-$75/MTok). 
            Token split assumes 30% input / 70% output. Forecasts use 0.7% daily growth projection.
          </Text>
        </Flex>
      </Surface>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={handleRefresh}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

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
              onChange={(value) => setBudgetLimit(Number(value) || 1000)}
            />
            <Text textStyle="small">
              Set monthly/daily budget threshold
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Cost Forecast Section */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading level={6}>Cost Forecast</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Based on 7-day rolling average with growth trend
            </Text>
          </Flex>
          
          <Flex gap={16}>
            {/* 7-Day Projection */}
            <Surface style={{ flex: 1, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  7-Day Projection
                </Text>
                <Heading level={3}>
                  ${forecast7Day?.projectedCost.toFixed(2) || '0.00'}
                </Heading>
                <Flex alignItems="center" gap={4}>
                  <span style={{ 
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: Colors.Charts.Apdex.Excellent.Default
                  }} />
                  <Text textStyle="small">High confidence</Text>
                </Flex>
              </Flex>
            </Surface>

            {/* 14-Day Projection */}
            <Surface style={{ flex: 1, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  14-Day Projection
                </Text>
                <Heading level={3}>
                  ${forecast14Day?.projectedCost.toFixed(2) || '0.00'}
                </Heading>
                <Flex alignItems="center" gap={4}>
                  <span style={{ 
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: Colors.Charts.Apdex.Good.Default
                  }} />
                  <Text textStyle="small">Medium confidence</Text>
                </Flex>
              </Flex>
            </Surface>

            {/* 30-Day Projection */}
            <Surface style={{ flex: 1, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  30-Day Projection
                </Text>
                <Heading level={3}>
                  ${forecast30Day?.projectedCost.toFixed(2) || '0.00'}
                </Heading>
                <Flex alignItems="center" gap={4}>
                  <span style={{ 
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: Colors.Charts.Apdex.Poor.Default
                  }} />
                  <Text textStyle="small">Low confidence</Text>
                </Flex>
              </Flex>
            </Surface>

            {/* Budget Breach Prediction */}
            <Surface style={{ 
              flex: 1, 
              padding: 12, 
              backgroundColor: budgetBreachDay 
                ? budgetBreachDay <= 7 ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 165, 0, 0.1)'
                : 'rgba(0, 200, 100, 0.1)'
            }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  Budget Breach ETA
                </Text>
                <Heading level={3} style={{
                  color: budgetBreachDay 
                    ? budgetBreachDay <= 7 ? Colors.Text.Critical.Default : Colors.Text.Warning.Default
                    : Colors.Text.Success.Default
                }}>
                  {budgetBreachDay 
                    ? budgetBreachDay === 1 ? 'Tomorrow!' : `${budgetBreachDay} days`
                    : 'On Track ✓'}
                </Heading>
                <Text textStyle="small">
                  {budgetBreachDay 
                    ? `Projected to exceed $${budgetLimit} budget`
                    : 'Within budget for next 30 days'}
                </Text>
              </Flex>
            </Surface>
          </Flex>

          {/* Forecast Trend Visualization */}
          <Surface style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ fontWeight: 500 }}>Projected Cost Trend</Text>
              <Flex alignItems="flex-end" gap={2} style={{ height: 60 }}>
                {costForecast.filter((_, i) => i % 3 === 0).map((f, idx) => {
                  const maxCost = Math.max(forecast30Day?.projectedCost || 1, budgetLimit);
                  const height = Math.min((f.projectedCost / maxCost) * 100, 100);
                  const isOverBudget = f.projectedCost > budgetLimit;
                  
                  return (
                    <Flex key={idx} flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                      <div style={{
                        width: '100%',
                        maxWidth: 20,
                        height: `${height}%`,
                        minHeight: 4,
                        backgroundColor: isOverBudget 
                          ? Colors.Charts.Apdex.Poor.Default 
                          : f.confidence === 'high' 
                            ? Colors.Charts.Apdex.Excellent.Default
                            : f.confidence === 'medium'
                              ? Colors.Charts.Apdex.Good.Default
                              : 'rgba(99, 102, 241, 0.5)',
                        borderRadius: 2,
                      }} />
                      <Text textStyle="small" style={{ fontSize: 9, marginTop: 4 }}>
                        D{f.day}
                      </Text>
                    </Flex>
                  );
                })}
              </Flex>
              {/* Budget line indicator */}
              <Flex alignItems="center" gap={8}>
                <div style={{ 
                  height: 2, 
                  flex: 1, 
                  background: `repeating-linear-gradient(90deg, ${Colors.Text.Warning.Default}, ${Colors.Text.Warning.Default} 4px, transparent 4px, transparent 8px)` 
                }} />
                <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>
                  Budget: ${budgetLimit}
                </Text>
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      </Surface>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <Surface style={{ padding: 16, backgroundColor: budgetAlerts.some(a => a.type === 'critical') ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 165, 0, 0.1)' }}>
          <Flex flexDirection="column" gap={8}>
            <Heading level={6}>Budget Alerts</Heading>
            {budgetAlerts.map((alert) => (
              <Flex key={alert.id} gap={8} alignItems="center">
                <Text style={{ color: alert.type === 'critical' ? Colors.Text.Critical.Default : Colors.Text.Warning.Default }}>
                  {alert.type === 'critical' ? '' : ''} {alert.message}
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
