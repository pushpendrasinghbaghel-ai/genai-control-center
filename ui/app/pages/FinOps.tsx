// GenAI Control Center - FinOps Dashboard
// Industry-standard AI cost management and optimization

import React, { useCallback, useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { TimeseriesChart, DonutChart } from '@dynatrace/strato-components-preview/charts';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Tabs, Tab } from '@dynatrace/strato-components-preview/navigation';

import { DocumentIcon, WarningIcon, CriticalIcon, MoneyIcon, AiIcon, ServicesIcon, HelpIcon, BarChartIcon, RefreshIcon, CheckmarkIcon, EditIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { FilterBar } from '../components/FilterBar';
import { CostGuardrailPanel } from '../components/CostGuardrailPanel';
import { RateCardSettings } from '../components/RateCardSettings';
import { refreshRateCardCache } from '../utils';
import { useGlobalFilters } from '../context';
import { formatRequestCount, formatCostPer1K } from '../utils';
import { useBudgetBurnRate } from '../hooks/useCostGuardrails';
import { 
  useProviderComparison, 
  useDistinctServices, 
  useDistinctProviders, 
  useDistinctModels,
  useCostTrend,
  useModelCostBreakdown,
  useCostByService,
  useEmbeddingVsCompletion,
  useTokenEfficiency,
  useSemanticCacheSavings
} from '../hooks/useDQLQueries';
import type { QueryFilters, SemanticCacheCandidate } from '../hooks/useDQLQueries';
import { useProviderDeepDive } from '../hooks/useProviderDeepDive';
import { useDavisForecast } from '../hooks/useDavisForecast';

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

export const FinOps: React.FC = () => {
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();
  const [budgetLimit, setBudgetLimit] = useState<number>(1000);
  const [showRateCardSettings, setShowRateCardSettings] = useState(false);

  // Budget burn rate — used by the hero card for $/hr, projection, ETA
  const { data: burnRate } = useBudgetBurnRate(budgetLimit);
  
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
  // TEMPORARILY DISABLED - Pending DQL validation with Demo Dynatrace MCP server
  // const { data: cacheSavings, loading: cacheSavingsLoading } = useSemanticCacheSavings(queryFilters);
  const cacheSavings: any = null;  // typed as any to avoid TS errors in hidden code
  const cacheSavingsLoading = false;

  // Cross-provider deep observability — prompt caching + OTel token metrics
  const {
    cacheSummary, cacheHitRate, cacheTrend, cacheTimeSaved,
    otelTokens, topExpensivePrompts,
    loading: deepDiveLoading, refetch: deepDiveRefetch,
  } = useProviderDeepDive(queryFilters);
  
  const handleRefresh = useCallback(() => {
    void refetch();
    void deepDiveRefetch();
  }, [refetch, deepDiveRefetch]);

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

  // Budget exhaustion ETA based on burn rate
  const budgetEtaHours = useMemo(() => {
    if (!burnRate || burnRate.burnRatePerHour <= 0 || totalCost >= budgetLimit) return null;
    return (budgetLimit - totalCost) / burnRate.burnRatePerHour;
  }, [burnRate, totalCost, budgetLimit]);

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

  // Davis Analyzer-powered cost forecast (falls back to linear if unavailable)
  const {
    forecast: costForecast,
    trend: forecastTrend,
    quality: forecastQuality,
    isDavisPowered,
    budgetBreachDay: davisBudgetBreachDay,
  } = useDavisForecast(totalCost, totalTokens, budgetLimit);

  // ─── Cost Optimization Insights (Phase 1.2 enhancement) ───
  const costInsights = useMemo(() => {
    const insights: Array<{ type: 'saving' | 'warning' | 'info'; title: string; detail: string; saving?: number }> = [];
    if (costBreakdown.length === 0) return insights;

    // Top cost driver
    const topProvider = costBreakdown.reduce((a, b) => a.estimatedCost > b.estimatedCost ? a : b, costBreakdown[0]);
    if (topProvider && totalCost > 0) {
      const pct = (topProvider.estimatedCost / totalCost) * 100;
      if (pct > 60) {
        insights.push({ type: 'warning', title: `${topProvider.provider} is ${pct.toFixed(0)}% of spend`, detail: 'High concentration risk. Consider routing some requests to alternative providers.' });
      }
    }

    // Cheapest per-request provider
    const cheapest = costBreakdown.reduce((a, b) => a.avgCostPerRequest < b.avgCostPerRequest ? a : b, costBreakdown[0]);
    const mostExpensive = costBreakdown.reduce((a, b) => a.avgCostPerRequest > b.avgCostPerRequest ? a : b, costBreakdown[0]);
    if (cheapest && mostExpensive && cheapest.provider !== mostExpensive.provider) {
      const diff = (mostExpensive.avgCostPerRequest - cheapest.avgCostPerRequest);
      insights.push({ type: 'saving', title: `${cheapest.provider} is cheapest per request`, detail: `${mostExpensive.provider} costs $${diff.toFixed(4)} more per request. Consider migrating low-stakes calls.`, saving: diff * mostExpensive.requestCount });
    }

    // 30-day budget projection warning
    const f30 = costForecast.find(f => f.day === 30);
    if (f30 && f30.projectedCost > totalCost * 1.1) {
      insights.push({ type: 'info', title: `30-day projection: $${f30.projectedCost.toFixed(2)}`, detail: isDavisPowered ? 'Projected by Dynatrace Intelligence Analyzer based on historical trend analysis.' : 'Projected assuming ~0.7%/day growth. Review token usage and enable caching to manage costs.' });
    }

    // Caching opportunity (if high request count)
    const totalReqs = costBreakdown.reduce((s, c) => s + c.requestCount, 0);
    if (totalReqs > 1000) {
      const estimatedCacheHitRate = 0.15;
      const cacheSaving = totalCost * estimatedCacheHitRate;
      insights.push({ type: 'saving', title: 'Semantic caching could save 15% cost', detail: `Based on ${totalReqs.toLocaleString()} requests, implement semantic caching to eliminate repeated LLM calls.`, saving: cacheSaving });
    }

    return insights;
  }, [costBreakdown, totalCost, costForecast, isDavisPowered]);

  // Forecast projections
  const forecast30Day = costForecast.find(f => f.day === 30);

  // Budget breach prediction (from Davis or local)
  const budgetBreachDay = davisBudgetBreachDay;

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
        <TitleBar.Suffix>
          <Tooltip text="Configure custom rate cards based on your provider contracts">
            <Button variant="default" onClick={() => setShowRateCardSettings(true)}>
              <Button.Prefix><EditIcon /></Button.Prefix>
              Rate Card Settings
            </Button>
          </Tooltip>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Estimation Disclaimer */}
      <Surface style={{ padding: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={8}>
          <DocumentIcon aria-hidden="true" style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            <strong>Note:</strong> Cost estimates use default public pricing. 
            <strong style={{ cursor: 'pointer', color: Colors.Text.Primary.Default }} onClick={() => setShowRateCardSettings(true)}> Click here</strong> to configure your custom contract rates for more accurate estimates.
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
      {/* TABBED LAYOUT: Group content into logical sections */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Tabs defaultIndex={0}>
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Overview — Budget, Alerts, Guardrails, Optimization Insights   */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Overview" prefixIcon={<MoneyIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

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
            <Flex flexDirection="column" gap={2}>
              {burnRate ? (
                <>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    Burn: ${burnRate.burnRatePerHour.toFixed(2)}/hr &bull; Projected: ${burnRate.projectedDailySpend.toFixed(2)}/day
                  </Text>
                  {budgetEtaHours !== null && (
                    <Text textStyle="small" style={{
                      color: budgetEtaHours < 4 ? STATUS_COLORS.critical : STATUS_COLORS.warning,
                      fontWeight: 600,
                    }}>
                      &#9201; Budget exhaustion in {budgetEtaHours.toFixed(1)} hours
                    </Text>
                  )}
                </>
              ) : null}
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

      {/* Budget Projection Strip — compact, actionable forecast summary */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: isDavisPowered ? Colors.Charts.Status.Good.Default : Colors.Text.Neutral.Subdued }} />
              <Heading level={6}>Budget Projection</Heading>
              {isDavisPowered && (
                <span style={{ fontSize: 9, padding: '2px 8px', background: Colors.Charts.Status.Good.Default + '20', color: Colors.Charts.Status.Good.Default, borderRadius: 10, fontWeight: 700, letterSpacing: '0.5px' }}>DT INTELLIGENCE</span>
              )}
            </Flex>
            {isDavisPowered ? (
              <Text textStyle="small" style={{ color: Colors.Charts.Status.Good.Default }}>
                Quality: {forecastQuality} &bull; Trend: {forecastTrend}
              </Text>
            ) : (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Linear estimate</Text>
            )}
          </Flex>

          <Flex gap={16}>
            {/* Projected 30-Day Spend */}
            <Surface style={{ flex: 1, padding: 14, borderLeft: `3px solid ${Colors.Charts.Categorical.Color01.Default}` }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Projected 30-Day Spend</Text>
                <Flex alignItems="baseline" gap={6}>
                  <Heading level={4}>${forecast30Day?.projectedCost.toFixed(2) || '—'}</Heading>
                  <Text textStyle="small" style={{
                    color: forecastTrend === 'increasing' ? Colors.Text.Warning.Default
                         : forecastTrend === 'decreasing' ? Colors.Text.Success.Default
                         : Colors.Text.Neutral.Subdued,
                    fontWeight: 600,
                  }}>
                    {forecastTrend === 'increasing' ? '↑' : forecastTrend === 'decreasing' ? '↓' : '→'} {forecastTrend}
                  </Text>
                </Flex>
              </Flex>
            </Surface>

            {/* Budget Breach ETA */}
            <Surface style={{
              flex: 1, padding: 14,
              borderLeft: `3px solid ${
                budgetBreachDay
                  ? budgetBreachDay <= 7 ? Colors.Charts.Status.Critical.Default : Colors.Charts.Status.Warning.Default
                  : Colors.Charts.Status.Good.Default
              }`,
            }}>
              <Flex flexDirection="column" gap={4}>
                <Flex alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Budget Breach ETA</Text>
                  <Tooltip text="Days until projected spend exceeds your budget limit.">
                    <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Heading level={4} style={{
                  color: budgetBreachDay
                    ? budgetBreachDay <= 7 ? Colors.Text.Critical.Default : Colors.Text.Warning.Default
                    : Colors.Text.Success.Default,
                }}>
                  {budgetBreachDay
                    ? budgetBreachDay === 1 ? 'Tomorrow!' : `${budgetBreachDay} days`
                    : 'On Track ✓'}
                </Heading>
              </Flex>
            </Surface>

            {/* Daily Run Rate */}
            <Surface style={{ flex: 1, padding: 14, borderLeft: `3px solid ${Colors.Charts.Categorical.Color03.Default}` }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Daily Run Rate</Text>
                <Heading level={4}>${burnRate ? burnRate.projectedDailySpend.toFixed(2) : '—'}/day</Heading>
              </Flex>
            </Surface>
          </Flex>
        </Flex>
      </Surface>

      {/* ─── Cost Optimization Insights ─── */}
      {costInsights.length > 0 && (
        <Surface style={{ padding: 16, borderLeft: '4px solid ' + STATUS_COLORS.good }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: STATUS_COLORS.good }} />
              <Heading level={6}>AI-Powered Cost Optimization Insights</Heading>
              <span style={{ fontSize: 9, padding: '2px 6px', background: STATUS_COLORS.good + '20', color: STATUS_COLORS.good, borderRadius: 10, fontWeight: 700 }}>LIVE</span>
            </Flex>
            <Flex gap={12} flexWrap="wrap">
              {costInsights.map((ins, i) => (
                <Surface key={i} style={{
                  flex: '1 1 260px', padding: 14, borderRadius: 6,
                  borderLeft: `3px solid ${
                    ins.type === 'saving' ? STATUS_COLORS.ideal
                    : ins.type === 'warning' ? STATUS_COLORS.warning
                    : STATUS_COLORS.good}`,
                }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontWeight: 600, fontSize: 12 }}>
                      {ins.type === 'saving' ? '💡 ' : ins.type === 'warning' ? '⚠️ ' : 'ℹ️ '}{ins.title}
                    </Text>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{ins.detail}</Text>
                    {ins.saving != null && ins.saving > 0 && (
                      <Text style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS.ideal }}>Potential saving: ${ins.saving.toFixed(2)}</Text>
                    )}
                  </Flex>
                </Surface>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}

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

      {/* Autonomous Cost Guardrails */}
      <CostGuardrailPanel dailyBudget={budgetLimit} />

          </Flex>
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Cost Breakdown — Provider, Model, Embedding, Service tables   */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Cost Breakdown" prefixIcon={<AiIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

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

          </Flex>
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: Efficiency & Caching — Token analysis, caching, OTel, prompts */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Efficiency & Caching" prefixIcon={<WarningIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
      {/* 🚀 UNIQUE GCC: Semantic Cache Savings ROI Calculator - TEMPORARILY HIDDEN */}
      {/* Pending DQL validation with Demo Dynatrace MCP server */}
      {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
      {false && (
      <Surface style={{ padding: 16, borderLeft: `4px solid ${STATUS_COLORS.ideal}` }}>
        <Flex flexDirection="column" gap={16}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <RefreshIcon style={{ width: 18, height: 18, color: STATUS_COLORS.ideal }} />
              <Heading level={6}>💰 Semantic Cache Savings Calculator</Heading>
              <span style={{ 
                fontSize: 9, 
                padding: '2px 6px', 
                backgroundColor: 'rgba(99, 102, 241, 0.15)', 
                color: '#6366f1',
                borderRadius: 10,
                fontWeight: 600
              }}>
                UNIQUE GCC
              </span>
              <Tooltip text="Identifies repeated prompts that could be cached. When you implement semantic caching, identical prompts return cached responses instead of calling the LLM again - saving tokens and cost. ROI shows potential savings if caching was implemented.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {cacheSavings && cacheSavings.totalCandidates > 0 && (
              <span style={{
                padding: '4px 12px',
                backgroundColor: STATUS_COLORS.ideal + '20',
                color: STATUS_COLORS.ideal,
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600
              }}>
                ${cacheSavings.totalPotentialSavings.toFixed(2)} potential savings
              </span>
            )}
          </Flex>

          {cacheSavingsLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : cacheSavings && cacheSavings.totalCandidates > 0 ? (
            <>
              {/* Summary Stats Row */}
              <Flex gap={16} style={{ flexWrap: 'wrap' }}>
                <Surface style={{ flex: '1 1 160px', padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Potential Savings</Text>
                    <Heading level={3} style={{ color: STATUS_COLORS.ideal }}>
                      ${cacheSavings.totalPotentialSavings.toFixed(2)}
                    </Heading>
                    <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>
                      ↓ {((cacheSavings.totalPotentialSavings / Math.max(totalCost, 0.01)) * 100).toFixed(0)}% of current spend
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Cache Candidates</Text>
                    <Heading level={3}>{cacheSavings.totalCandidates}</Heading>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      unique prompt patterns
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Repeated Requests</Text>
                    <Heading level={3}>{cacheSavings.totalRepetitiveRequests.toLocaleString()}</Heading>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      cacheable invocations
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Potential Cache Hit Rate</Text>
                    <Heading level={3}>{(cacheSavings.avgPotentialCacheHitRate * 100).toFixed(0)}%</Heading>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      of requests cacheable
                    </Text>
                  </Flex>
                </Surface>
              </Flex>

              {/* Top Cache Candidates Table */}
              <Flex flexDirection="column" gap={8}>
                <Text textStyle="small" style={{ fontWeight: 600 }}>Top Cache Candidates (by savings)</Text>
                <Flex style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 6, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ flex: 3 }}>Prompt Pattern</span>
                  <span style={{ flex: 1 }}>Model</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Requests</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Hit Rate</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Current Cost</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Savings</span>
                </Flex>
                {cacheSavings.topCandidates.slice(0, 5).map((candidate: SemanticCacheCandidate, idx: number) => (
                  <Flex 
                    key={idx} 
                    style={{ 
                      padding: '6px 0', 
                      borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)', 
                      fontSize: 11,
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ 
                      flex: 3, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: Colors.Text.Neutral.Subdued
                    }} title={candidate.promptPattern}>
                      {candidate.promptPattern.substring(0, 50)}...
                    </span>
                    <span style={{ flex: 1, fontSize: 10 }}>{candidate.model.split('/').pop()}</span>
                    <span style={{ flex: 1, textAlign: 'right', fontWeight: 500 }}>{candidate.requestCount}x</span>
                    <span style={{ flex: 1, textAlign: 'right', color: STATUS_COLORS.ideal }}>
                      {(candidate.cacheHitRate * 100).toFixed(0)}%
                    </span>
                    <span style={{ flex: 1, textAlign: 'right' }}>${candidate.totalCost.toFixed(3)}</span>
                    <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: STATUS_COLORS.ideal }}>
                      ${candidate.potentialSavings.toFixed(3)}
                    </span>
                  </Flex>
                ))}
              </Flex>

              {/* Action Recommendation */}
              <Surface style={{ padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: 6 }}>
                <Flex alignItems="flex-start" gap={8}>
                  <CheckmarkIcon style={{ width: 16, height: 16, color: STATUS_COLORS.ideal, marginTop: 2 }} />
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontWeight: 600, color: STATUS_COLORS.ideal }}>Recommended Action</Text>
                    <Text textStyle="small">
                      Implement semantic caching for these {cacheSavings.totalCandidates} prompt patterns to save 
                      <strong> ${cacheSavings.totalPotentialSavings.toFixed(2)}</strong> ({((cacheSavings.totalPotentialSavings / Math.max(totalCost, 0.01)) * 100).toFixed(0)}% reduction).
                      Consider tools like GPTCache, LangChain Cache, or Redis-based semantic search.
                    </Text>
                  </Flex>
                </Flex>
              </Surface>
            </>
          ) : (
            <Flex flexDirection="column" alignItems="center" gap={8} style={{ padding: 24, opacity: 0.7 }}>
              <RefreshIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small">No repeated prompt patterns detected (5+ occurrences required)</Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                This is good! Your prompts are unique, or you may already have caching in place.
              </Text>
            </Flex>
          )}
        </Flex>
      </Surface>
      )}

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

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Prompt Caching (from AI Observability data) */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
        <RefreshIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
        <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>Prompt Caching</Text>
        <span style={{
          fontSize: 9, padding: '2px 6px',
          backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1',
          borderRadius: 10, fontWeight: 600,
        }}>LIVE DATA</span>
      </Flex>

      <Flex gap={16} flexWrap="wrap">
        <Surface style={{ flex: '1 1 210px', padding: 16 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Cached Tokens</Text>
          <Heading level={2} style={{ color: STATUS_COLORS.ideal }}>
            {cacheSummary ? (cacheSummary.cachedTokens / 1000).toFixed(0) + 'K' : '—'}
          </Heading>
          <Text textStyle="small">{cacheSummary ? `${(cacheSummary.writeTokens / 1000).toFixed(0)}K write tokens` : 'prompt cache read tokens'}</Text>
        </Surface>
        <Surface style={{ flex: '1 1 210px', padding: 16 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Cache Hit Rate</Text>
          <Heading level={2} style={{ color: cacheHitRate && cacheHitRate.cacheHitPct > 50 ? STATUS_COLORS.ideal : STATUS_COLORS.warning }}>
            {cacheHitRate ? `${cacheHitRate.cacheHitPct.toFixed(1)}%` : '—'}
          </Heading>
          <Text textStyle="small">{cacheHitRate ? `${cacheHitRate.hits} hits / ${cacheHitRate.total} total` : 'no data'}</Text>
        </Surface>
        <Surface style={{ flex: '1 1 210px', padding: 16 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Est. $ Saved</Text>
          <Heading level={2} style={{ color: STATUS_COLORS.ideal }}>
            {cacheSummary ? `$${cacheSummary.estimatedSavingsUsd.toFixed(2)}` : '—'}
          </Heading>
          <Text textStyle="small">from prompt cache reuse</Text>
        </Surface>
        <Surface style={{ flex: '1 1 210px', padding: 16 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Time Saved</Text>
          <Heading level={2} style={{ color: STATUS_COLORS.good }}>
            {cacheTimeSaved ? `${cacheTimeSaved.timeSavedMs.toFixed(0)}ms` : '—'}
          </Heading>
          <Text textStyle="small">{cacheTimeSaved ? `cached: ${cacheTimeSaved.cachedDurationMs.toFixed(0)}ms vs normal: ${cacheTimeSaved.normalDurationMs.toFixed(0)}ms` : 'latency reduction'}</Text>
        </Surface>
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: OTel Token Consumption Metrics */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {otelTokens && otelTokens.totalTokens > 0 && (
        <>
          <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
            <BarChartIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
            <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>
              OTel Token Consumption Metrics
            </Text>
          </Flex>
          <Flex gap={16} flexWrap="wrap">
            <Surface style={{ flex: '1 1 210px', padding: 16 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Input Tokens (OTel)</Text>
              <Heading level={2}>{(otelTokens.totalInputTokens / 1000).toFixed(0)}K</Heading>
              <Text textStyle="small">gen_ai.client.token.usage (input)</Text>
            </Surface>
            <Surface style={{ flex: '1 1 210px', padding: 16 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Output Tokens (OTel)</Text>
              <Heading level={2}>{(otelTokens.totalOutputTokens / 1000).toFixed(0)}K</Heading>
              <Text textStyle="small">gen_ai.client.token.usage (output)</Text>
            </Surface>
            <Surface style={{ flex: '1 1 210px', padding: 16 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Total Tokens (OTel)</Text>
              <Heading level={2} style={{ color: STATUS_COLORS.neutral }}>
                {(otelTokens.totalTokens / 1000).toFixed(0)}K
              </Heading>
              <Text textStyle="small">aggregated metric-based count</Text>
            </Surface>
            <Surface style={{ flex: '1 1 210px', padding: 16 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Est. Cost (OTel)</Text>
              <Heading level={2} style={{ color: STATUS_COLORS.warning }}>
                ${otelTokens.estimatedCostUsd.toFixed(2)}
              </Heading>
              <Text textStyle="small">based on metric aggregation</Text>
            </Surface>
          </Flex>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Top Expensive Prompts */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {topExpensivePrompts.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <MoneyIcon style={{ width: 16, height: 16, color: STATUS_COLORS.warning }} />
              <Heading level={6}>Top Expensive Prompts</Heading>
              <Tooltip text="The prompts consuming the most tokens (input + output). Optimizing these can yield significant cost savings.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            <Flex flexDirection="column" gap={4}>
              <Flex style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4, fontWeight: 600, fontSize: 11 }}>
                <span style={{ flex: 3 }}>Prompt</span>
                <span style={{ flex: 1 }}>Provider</span>
                <span style={{ flex: 1 }}>Model</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Tokens</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Duration</span>
              </Flex>
              {topExpensivePrompts.slice(0, 10).map((p, idx) => (
                <Flex key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--dt-colors-border-neutral-subdued)', fontSize: 12 }}>
                  <span style={{ flex: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.prompt}>
                    {p.prompt.substring(0, 80)}{p.prompt.length > 80 ? '…' : ''}
                  </span>
                  <span style={{ flex: 1, textTransform: 'capitalize' }}>{p.provider}</span>
                  <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}>{p.model}</span>
                  <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{p.totalTokens.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{p.durationMs.toFixed(0)}ms</span>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}

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
        </Tab>
      </Tabs>

      {/* Rate Card Settings Modal */}
      <RateCardSettings
        isOpen={showRateCardSettings}
        onClose={() => setShowRateCardSettings(false)}
        onConfigChange={() => {
          refreshRateCardCache();
          // Trigger data refetch to recalculate costs with new rates
          handleRefresh();
        }}
        detectedModels={modelCosts?.map(mc => ({ model: mc.model, provider: mc.provider })) || []}
      />
    </Flex>
  );
};

export default FinOps;
