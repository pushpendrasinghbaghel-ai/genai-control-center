// GenAI Control Center - FinOps Dashboard
// Industry-standard AI cost management and optimization

import React, { useCallback, useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { TimeseriesChart, DonutChart } from '@dynatrace/strato-components-preview/charts';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import { DocumentIcon, WarningIcon, CriticalIcon, MoneyIcon, AiIcon, ServicesIcon, HelpIcon, BarChartIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { formatRequestCount, formatCostPer1K } from '../utils';
import { 
  useProviderComparison, 
  useDistinctServices, 
  useDistinctProviders, 
  useDistinctModels,
  useCostTrend,
  useModelCostBreakdown,
  useCostByService,
  useEmbeddingVsCompletion,
  useTokenEfficiency
} from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';

// Strato Design Tokens for status colors
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
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
  const { data: costTrendData, loading: costTrendLoading } = useCostTrend(filters.timeframe || undefined);
  const { data: modelCosts, loading: modelCostsLoading } = useModelCostBreakdown(queryFilters);
  const { data: serviceCosts, loading: serviceCostsLoading } = useCostByService(queryFilters);
  const { data: embeddingVsCompletion, loading: embeddingLoading } = useEmbeddingVsCompletion(queryFilters);
  const { data: tokenEfficiency, loading: efficiencyLoading } = useTokenEfficiency(queryFilters);
  
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Transform cost trend data to Timeseries format for chart
  const costTimeseriesData = useMemo((): Timeseries[] => {
    if (costTrendData && costTrendData.length > 0 && costTrendData[0].datapoints.length > 1) {
      return costTrendData as Timeseries[];
    }
    return [];
  }, [costTrendData]);

  // Calculate cost breakdown by provider - use actual data from hook
  const costBreakdown = useMemo((): CostBreakdown[] => {
    if (!providers) return [];
    
    return providers.map((p: any) => {
      const providerName = p.provider || 'Unknown';
      
      return {
        provider: providerName,
        totalTokens: p.totalTokens || 0,
        inputTokens: p.inputTokens || 0,
        outputTokens: p.outputTokens || 0,
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

  // Transform forecast data to Timeseries format for the projection chart
  const forecastTimeseriesData = useMemo((): Timeseries[] => {
    if (costForecast.length === 0 || totalCost === 0) return [];
    
    const now = new Date();
    const projectionDatapoints = costForecast.map((f) => ({
      start: new Date(now.getTime() + (f.day - 1) * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + f.day * 24 * 60 * 60 * 1000),
      value: f.projectedCost
    }));

    // Create budget line for reference
    const budgetDatapoints = costForecast.map((f) => ({
      start: new Date(now.getTime() + (f.day - 1) * 24 * 60 * 60 * 1000),
      end: new Date(now.getTime() + f.day * 24 * 60 * 60 * 1000),
      value: budgetLimit
    }));

    return [
      { name: 'Projected Cost ($)', datapoints: projectionDatapoints, unit: '$' },
      { name: 'Budget Limit ($)', datapoints: budgetDatapoints, unit: '$' }
    ];
  }, [costForecast, totalCost, budgetLimit]);

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
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <MoneyIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>FinOps Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>AI cost management & optimization</TitleBar.Subtitle>
      </TitleBar>

      {/* Estimation Disclaimer */}
      <Surface style={{ padding: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={8}>
          <DocumentIcon aria-hidden="true" style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
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

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Budget Overview */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
        <MoneyIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>Budget Overview</Text>
      </Flex>

      {/* Primary Metric Row - Total Spend gets emphasis */}
      <Flex gap={16}>
        {/* Total Spend Card - HERO CARD (2x width) */}
        <Surface style={{ flex: 2, padding: 20, borderLeft: `4px solid ${totalCost > budgetLimit * 0.9 ? Colors.Charts.Status.Critical.Default : totalCost > budgetLimit * 0.7 ? Colors.Charts.Status.Warning.Default : Colors.Charts.Status.Good.Default}` }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={4}>
              <MoneyIcon style={{ width: 18, height: 18, color: Colors.Text.Neutral.Subdued }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontWeight: 600 }}>
                Total Estimated Spend
              </Text>
              <Tooltip text="Estimated cost based on token usage × provider pricing rates. OpenAI: $0.50-$15/MTok, Anthropic: $3-$75/MTok. Actual costs may vary based on your contract.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Heading level={1} style={{ color: totalCost > budgetLimit ? Colors.Text.Critical.Default : Colors.Text.Neutral.Default, fontSize: 36 }}>
              ${totalCost.toFixed(2)}
            </Heading>
            <Flex alignItems="center" gap={12}>
              <Text textStyle="small">Budget: ${budgetLimit}</Text>
              <ProgressBar 
                value={Math.min((totalCost / budgetLimit) * 100, 100)} 
                style={{ flex: 1, maxWidth: 200 }}
              />
              <Text textStyle="small" style={{ fontWeight: 600, color: totalCost > budgetLimit * 0.9 ? Colors.Text.Critical.Default : totalCost > budgetLimit * 0.7 ? Colors.Text.Warning.Default : Colors.Text.Success.Default }}>
                {((totalCost / budgetLimit) * 100).toFixed(0)}%
              </Text>
            </Flex>
          </Flex>
        </Surface>

        {/* Budget Setting Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Budget Limit
              </Text>
              <Tooltip text="Set your spending threshold. Alerts trigger at 70% (warning) and 90% (critical). The forecast chart shows when you'll hit this limit.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
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

      {/* Secondary Metrics Row */}
      <Flex gap={16}>
        {/* Total Tokens Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={4}>
              <BarChartIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Total Tokens
              </Text>
              <Tooltip text="Sum of all input (prompt) and output (completion) tokens across all AI requests. 1K tokens ≈ 750 words.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Heading level={4}>
              {totalTokens.toLocaleString()}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              ${(totalCost / Math.max(totalTokens, 1) * 1000).toFixed(4)}/1K tokens
            </Text>
          </Flex>
        </Surface>

        {/* Active Providers Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={4}>
              <AiIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Active Providers
              </Text>
              <Tooltip text="Number of distinct AI providers (OpenAI, Anthropic, Azure, etc.) used in the selected timeframe.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Heading level={4}>
              {costBreakdown.length}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {costBreakdown.map(c => c.provider).join(', ') || 'None'}
            </Text>
          </Flex>
        </Surface>

        {/* Total Requests Card */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={4}>
              <ServicesIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Total Requests
              </Text>
              <Tooltip text="Total number of AI API calls made in the selected timeframe.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Heading level={4}>
              {formatRequestCount(costBreakdown.reduce((sum, c) => sum + c.requestCount, 0))}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {formatCostPer1K(totalCost, costBreakdown.reduce((sum, c) => sum + c.requestCount, 0))}
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Cost Trends & Forecasting */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
        <BarChartIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>Cost Trends & Forecasting</Text>
      </Flex>

      {/* Cost Trend Chart */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <MoneyIcon style={{ width: 16, height: 16, color: Colors.Charts.Apdex.Good.Default }} />
              <Heading level={6}>Cost Trend by Provider</Heading>
              <Tooltip text="Shows estimated costs over time, grouped by AI provider. Use this to identify spending patterns, detect cost spikes, and compare provider costs. Each color represents a different provider.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {costTimeseriesData.length > 0 && (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {costTimeseriesData.length} provider{costTimeseriesData.length > 1 ? 's' : ''} tracked
              </Text>
            )}
          </Flex>
          {costTrendLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : costTimeseriesData.length > 0 ? (
            <TimeseriesChart
              data={costTimeseriesData}
              variant="area"
              height={180}
            >
              <TimeseriesChart.Tooltip variant="shared" />
              <TimeseriesChart.Legend />
            </TimeseriesChart>
          ) : (
            <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
              <MoneyIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small">No cost data available for the selected timeframe</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* Cost Forecast Section */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <Heading level={6}>Cost Forecast</Heading>
              <Tooltip text="Predicts future costs using linear regression on your historical data with ~0.7% daily growth assumption (typical for AI adoption). Confidence decreases over time: High (1-7 days), Medium (8-14 days), Low (15-30 days).">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
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
                <Flex alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    Budget Breach ETA
                  </Text>
                  <Tooltip text="Estimated days until your spending exceeds the budget limit. Red = breach in ≤7 days (urgent), Orange = breach in 8-30 days, Green = on track within 30 days.">
                    <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
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

          {/* Forecast Trend Visualization - Proper Line Chart */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex justifyContent="space-between" alignItems="center">
                <Text textStyle="small" style={{ fontWeight: 600 }}>30-Day Cost Projection</Text>
                <Flex alignItems="center" gap={12}>
                  <Flex alignItems="center" gap={4}>
                    <span style={{ width: 12, height: 3, backgroundColor: Colors.Charts.Categorical.Color01.Default, borderRadius: 1 }} />
                    <Text textStyle="small">Projected Cost</Text>
                  </Flex>
                  <Flex alignItems="center" gap={4}>
                    <span style={{ width: 12, height: 3, backgroundColor: Colors.Text.Warning.Default, borderRadius: 1 }} />
                    <Text textStyle="small">Budget (${budgetLimit})</Text>
                  </Flex>
                </Flex>
              </Flex>
              {forecastTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={forecastTimeseriesData}
                  variant="line"
                  height={160}
                  colorPalette={[Colors.Charts.Categorical.Color01.Default, Colors.Text.Warning.Default]}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" style={{ height: 160, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <Text textStyle="small">No forecast data available</Text>
                </Flex>
              )}
              {/* Confidence Legend */}
              <Flex justifyContent="center" gap={16}>
                <Flex alignItems="center" gap={4}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: Colors.Charts.Apdex.Excellent.Default }} />
                  <Text textStyle="small" style={{ fontSize: 11 }}>High confidence (Day 1-7)</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: Colors.Charts.Apdex.Good.Default }} />
                  <Text textStyle="small" style={{ fontSize: 11 }}>Medium (Day 8-14)</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: Colors.Charts.Apdex.Poor.Default }} />
                  <Text textStyle="small" style={{ fontSize: 11 }}>Low (Day 15-30)</Text>
                </Flex>
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

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Cost Breakdown & Analysis */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
        <AiIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>Cost Breakdown & Analysis</Text>
      </Flex>

      {/* Cost Breakdown Table */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex alignItems="center" gap={8}>
            <Heading level={6}>Cost Breakdown by Provider</Heading>
            <Tooltip text="Detailed cost analysis per AI provider. Input tokens = prompt/context tokens (cheaper), Output tokens = completion tokens (more expensive). $/1K Req shows cost per 1,000 requests for comparison.">
              <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
            </Tooltip>
          </Flex>
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
                <span style={{ flex: 1, textAlign: 'right' }}>$/1K Req</span>
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
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatRequestCount(row.requestCount)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>${(row.avgCostPerRequest * 1000).toFixed(2)}</span>
                </Flex>
              ))}
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* Model-Level Cost Breakdown */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color06.Default }} />
              <Heading level={6}>Cost Breakdown by Model</Heading>
              <Tooltip text="Granular cost breakdown by specific model (e.g., gpt-4, claude-3-opus). Models highlighted in orange have costs >$1. Use $/1K Req to find expensive models that might benefit from caching or downgrades.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Top 15 models by token usage
            </Text>
          </Flex>
          {modelCostsLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 100 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : !modelCosts || modelCosts.length === 0 ? (
            <Text>No model cost data available</Text>
          ) : (
            <Flex flexDirection="column" gap={8}>
              {/* Table Header */}
              <Flex style={{ 
                borderBottom: '1px solid var(--dt-colors-border-neutral-default)',
                paddingBottom: 8,
                fontWeight: 600,
                fontSize: 12
              }}>
                <span style={{ flex: 2 }}>Model</span>
                <span style={{ flex: 1 }}>Provider</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Input Tokens</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Output Tokens</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Est. Cost</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Requests</span>
                <span style={{ flex: 1, textAlign: 'right' }}>$/1K Req</span>
              </Flex>
              {/* Table Rows */}
              {modelCosts.map((row: any, idx: number) => (
                <Flex 
                  key={idx}
                  style={{ 
                    padding: '8px 0',
                    borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)',
                    fontSize: 13
                  }}
                >
                  <span style={{ flex: 2, fontWeight: 500 }}>{row.model}</span>
                  <span style={{ flex: 1, color: Colors.Text.Neutral.Subdued }}>{row.provider || '-'}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.inputTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{row.outputTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: row.estimatedCost > 1 ? Colors.Text.Warning.Default : 'inherit' }}>
                    ${row.estimatedCost.toFixed(2)}
                  </span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{formatRequestCount(row.totalRequests)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>${(row.costPerRequest * 1000).toFixed(2)}</span>
                </Flex>
              ))}
              {/* Summary Row */}
              <Flex style={{ 
                padding: '8px 0',
                borderTop: '2px solid var(--dt-colors-border-neutral-default)',
                fontWeight: 600,
                fontSize: 13,
                backgroundColor: 'rgba(99, 102, 241, 0.05)'
              }}>
                <span style={{ flex: 2 }}>Total ({modelCosts.length} models)</span>
                <span style={{ flex: 1 }}></span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  {modelCosts.reduce((sum: number, r: any) => sum + r.inputTokens, 0).toLocaleString()}
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  {modelCosts.reduce((sum: number, r: any) => sum + r.outputTokens, 0).toLocaleString()}
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  ${modelCosts.reduce((sum: number, r: any) => sum + r.estimatedCost, 0).toFixed(2)}
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  {formatRequestCount(modelCosts.reduce((sum: number, r: any) => sum + r.totalRequests, 0))}
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>-</span>
              </Flex>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* Embedding vs Completion Split & Cost by Service Row */}
      <Flex gap={16}>
        {/* Embedding vs Completion Split */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex justifyContent="space-between" alignItems="center">
              <Flex alignItems="center" gap={8}>
                <AiIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color02.Default }} />
                <Heading level={6}>Embedding vs Completion</Heading>
                <Tooltip text="Embedding models convert text to vectors for search/RAG (cheap ~$0.02/MTok). Completion models generate text responses (expensive $2-75/MTok). Higher embedding % = more efficient RAG workloads.">
                  <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Embeddings are ~10x cheaper
              </Text>
            </Flex>
            {embeddingLoading ? (
              <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
                <ProgressCircle size="small" />
              </Flex>
            ) : embeddingVsCompletion && Array.isArray(embeddingVsCompletion) && embeddingVsCompletion.length > 0 ? (
              <Flex gap={16} alignItems="center">
                <Flex flexDirection="column" gap={8} style={{ minWidth: 280 }}>
                  {embeddingVsCompletion.map((item: any, idx: number) => {
                    const modelType = item?.modelType || 'Unknown';
                    const requests = item?.requests || 0;
                    const totalTokens = item?.totalTokens || 0;
                    const estimatedCost = item?.estimatedCost || 0;
                    const totalAllTokens = embeddingVsCompletion.reduce((sum: number, i: any) => sum + (i?.totalTokens || 0), 0);
                    const percentage = totalAllTokens > 0 ? ((totalTokens / totalAllTokens) * 100).toFixed(1) : '0';
                    
                    return (
                      <Surface key={modelType + idx} style={{ padding: 12, backgroundColor: modelType === 'Embedding' ? 'rgba(0, 200, 100, 0.1)' : 'rgba(99, 102, 241, 0.1)' }}>
                        <Flex justifyContent="space-between" alignItems="center">
                          <Text textStyle="small" style={{ fontWeight: 600 }}>{modelType}</Text>
                          <Text textStyle="small" style={{ fontWeight: 600 }}>{percentage}%</Text>
                        </Flex>
                        <ProgressBar value={Number(percentage)} style={{ marginTop: 8, marginBottom: 8 }} />
                        <Flex justifyContent="space-between">
                          <Text textStyle="small">Requests:</Text>
                          <Text textStyle="small">{requests.toLocaleString()}</Text>
                        </Flex>
                        <Flex justifyContent="space-between">
                          <Text textStyle="small">Tokens:</Text>
                          <Text textStyle="small">{totalTokens.toLocaleString()}</Text>
                        </Flex>
                        <Flex justifyContent="space-between">
                          <Text textStyle="small">Est. Cost:</Text>
                          <Text textStyle="small" style={{ fontWeight: 600, color: modelType === 'Embedding' ? Colors.Text.Success.Default : 'inherit' }}>
                            ${estimatedCost.toFixed(2)}
                          </Text>
                        </Flex>
                      </Surface>
                    );
                  })}
                </Flex>
              </Flex>
            ) : (
              <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No data available</Text>
              </Flex>
            )}
          </Flex>
        </Surface>

        {/* Cost by Service - Chargeback */}
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex justifyContent="space-between" alignItems="center">
              <Flex alignItems="center" gap={8}>
                <ServicesIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color03.Default }} />
                <Heading level={6}>Cost by Service (Chargeback)</Heading>
                <Tooltip text="AI costs grouped by calling service (dt.entity.service). Use this for internal billing/chargeback to teams. Service IDs link to Dynatrace service entities for further drill-down.">
                  <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                For internal billing
              </Text>
            </Flex>
            {serviceCostsLoading ? (
              <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
                <ProgressCircle size="small" />
              </Flex>
            ) : serviceCosts && serviceCosts.length > 0 ? (
              <Flex flexDirection="column" gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
                {/* Header */}
                <Flex style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4, fontWeight: 600, fontSize: 11 }}>
                  <span style={{ flex: 2 }}>Service</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Requests</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Tokens</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Cost</span>
                </Flex>
                {serviceCosts.map((svc: any, idx: number) => (
                  <Flex key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)', fontSize: 12 }}>
                    <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={svc.serviceId}>
                      {svc.serviceId.replace('SERVICE-', '').substring(0, 12)}...
                    </span>
                    <span style={{ flex: 1, textAlign: 'right' }}>{formatRequestCount(svc.totalRequests)}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>{(svc.totalTokens / 1000).toFixed(1)}K</span>
                    <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>${svc.estimatedCost.toFixed(2)}</span>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No service data available</Text>
              </Flex>
            )}
          </Flex>
        </Surface>
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Efficiency & Optimization */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
        <WarningIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>Efficiency & Optimization</Text>
      </Flex>

      {/* Token Efficiency Analysis - Find Waste */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <WarningIcon style={{ width: 16, height: 16, color: Colors.Charts.Status.Warning.Default }} />
              <Heading level={6}>Token Efficiency Analysis</Heading>
              <Tooltip text="Efficiency = Output tokens / Input tokens. Values <0.5x are flagged as wasteful (you're paying for large prompts but getting small responses). Optimize by: reducing context, using prompt caching, or switching to smaller models.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Low efficiency = high input, low output (potential waste)
            </Text>
          </Flex>
          {efficiencyLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 100 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : tokenEfficiency && tokenEfficiency.length > 0 ? (
            <Flex flexDirection="column" gap={4}>
              {/* Header */}
              <Flex style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 8, fontWeight: 600, fontSize: 12 }}>
                <span style={{ flex: 2 }}>Model</span>
                <span style={{ flex: 1 }}>Provider</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Requests</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Avg In</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Avg Out</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Efficiency</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Status</span>
              </Flex>
              {tokenEfficiency.slice(0, 10).map((item: any, idx: number) => (
                <Flex 
                  key={idx} 
                  style={{ 
                    padding: '6px 0', 
                    borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)', 
                    fontSize: 12,
                    backgroundColor: item.isWasteful ? 'rgba(255, 165, 0, 0.1)' : 'transparent'
                  }}
                >
                  <span style={{ flex: 2, fontWeight: 500 }}>{item.model}</span>
                  <span style={{ flex: 1, color: Colors.Text.Neutral.Subdued }}>{item.provider || '-'}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{item.requests.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{item.avgInput.toFixed(0)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{item.avgOutput.toFixed(0)}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{item.efficiency.toFixed(2)}x</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>
                    {item.isWasteful ? (
                      <span style={{ color: Colors.Text.Warning.Default, fontWeight: 600 }}>⚠️ Wasteful</span>
                    ) : item.efficiency < 1.0 ? (
                      <span style={{ color: Colors.Text.Neutral.Subdued }}>Fair</span>
                    ) : (
                      <span style={{ color: Colors.Text.Success.Default }}>✓ Efficient</span>
                    )}
                  </span>
                </Flex>
              ))}
              {/* Summary */}
              {tokenEfficiency.some((item: any) => item.isWasteful) && (
                <Surface style={{ padding: 12, marginTop: 8, backgroundColor: 'rgba(255, 165, 0, 0.1)' }}>
                  <Text textStyle="small">
                    <strong>💡 Optimization Opportunity:</strong> {tokenEfficiency.filter((item: any) => item.isWasteful).length} model(s) have 
                    efficiency &lt;0.5x (output tokens &lt; 50% of input). Consider:
                    <br />• Reviewing prompt design to reduce input length
                    <br />• Using smaller context windows for simple queries
                    <br />• Implementing prompt caching for repeated queries
                  </Text>
                </Surface>
              )}
            </Flex>
          ) : (
            <Flex justifyContent="center" alignItems="center" style={{ height: 100 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No efficiency data available</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* Cost Optimization Recommendations */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex alignItems="center" gap={8}>
            <Heading level={6}>💡 Cost Optimization Recommendations</Heading>
            <Tooltip text="Auto-generated recommendations based on your usage patterns. Provider concentration warns about single-provider risk. High cost/request suggests caching opportunities. Self-hosted detection highlights potential savings.">
              <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
            </Tooltip>
          </Flex>
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
