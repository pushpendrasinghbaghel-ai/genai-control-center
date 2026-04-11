// GenAI Control Center - FinOps Dashboard
// Industry-standard AI cost management and optimization

import React, { useCallback, useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components/forms';
import { TimeseriesChart, DonutChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { Tabs, Tab } from '@dynatrace/strato-components/navigation';
import { DataTable } from '@dynatrace/strato-components/tables';

import { DocumentIcon, WarningIcon, CriticalIcon, MoneyIcon, AiIcon, ServicesIcon, HelpIcon, BarChartIcon, RefreshIcon, CheckmarkIcon, EditIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { FilterBar } from '../components/FilterBar';
import { CostGuardrailPanel } from '../components/CostGuardrailPanel';
import { RateCardSettings } from '../components/RateCardSettings';
import { AskAIButton } from '../components/AskAIButton';
import { AskAISheet } from '../components/AskAISheet';
import type { AskAIContext } from '../hooks/useAskAI';
import { refreshRateCardCache } from '../utils';
import { useGlobalFilters } from '../context';
import { formatRequestCount, formatCostPer1K } from '../utils';
import { useBudgetBurnRate, useCostVelocity } from '../hooks/useCostGuardrails';
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
import type { QueryFilters } from '../hooks/useDQLQueries';
import { useProviderDeepDive } from '../hooks/useProviderDeepDive';
import { useDavisForecast } from '../hooks/useDavisForecast';
import { useTotalCostOfOwnership } from '../hooks/useTotalCostOfOwnership';
import { useModelArbitrage } from '../hooks/useModelArbitrage';
import { usePromptCostAttribution } from '../hooks/usePromptCostAttribution';
import { useTrainingROI } from '../hooks/useTrainingROI';
import { useCostAnomalyRootCause } from '../hooks/useCostAnomalyRootCause';
import { useContextWindowCreep } from '../hooks/useContextWindowCreep';
import { useTimeOfDayUsage } from '../hooks/useTimeOfDayUsage';
import { useModelQualityNeedMatching } from '../hooks/useModelQualityNeedMatching';
import { formatNumber, formatDateTime, formatPercent } from '../utils/formatting';

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
  const [askAISheet, setAskAISheet] = useState<{ show: boolean; context: AskAIContext }>({
    show: false,
    context: { domain: 'FinOps', suggestedPrompts: [] },
  });

  const openAskAI = useCallback((context: AskAIContext) => {
    setAskAISheet({ show: true, context });
  }, []);

  const closeAskAI = useCallback(() => {
    setAskAISheet(prev => ({ ...prev, show: false }));
  }, []);

  // Budget burn rate — used by the hero card for $/hr, projection, ETA
  const { data: burnRate } = useBudgetBurnRate(budgetLimit);

  // Cost velocity — $/min with trend & spike detection
  const { data: costVelocity } = useCostVelocity();
  
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
  const { data: cacheSavings, loading: cacheSavingsLoading } = useSemanticCacheSavings(queryFilters);

  // Cross-provider deep observability — prompt caching metrics
  const {
    cacheSummary, cacheHitRate, cacheTimeSaved,
    loading: _deepDiveLoading, refetch: deepDiveRefetch,
  } = useProviderDeepDive(queryFilters);

  // ── New FinOps Roadmap hooks ──
  const { data: tcoaiData, loading: tcoaiLoading } = useTotalCostOfOwnership();
  const { data: arbitrageData, loading: arbitrageLoading } = useModelArbitrage();
  const { data: promptAttrData, loading: promptAttrLoading } = usePromptCostAttribution();
  const { data: trainingData, loading: trainingLoading } = useTrainingROI();
  // Cost anomaly root-cause fires only when velocity ratio >= 2
  const velocityRatio = costVelocity?.velocityRatio ?? 0;
  const { data: anomalyRootCause, loading: anomalyLoading } = useCostAnomalyRootCause(velocityRatio);

  // ── FinOps Foundation features ──
  const { data: contextCreepData, loading: contextCreepLoading } = useContextWindowCreep();
  const { data: timeOfDayData, loading: timeOfDayLoading } = useTimeOfDayUsage();
  const { data: qualityMatchData, loading: qualityMatchLoading } = useModelQualityNeedMatching();
  
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

  // Calculate total costs — use TCoAI token cost when available so both tiles agree
  const totalCost = useMemo(() => {
    if (tcoaiData && tcoaiData.tokenCost > 0) return tcoaiData.tokenCost;
    return costBreakdown.reduce((sum, c) => sum + c.estimatedCost, 0);
  }, [tcoaiData, costBreakdown]);

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
      insights.push({ type: 'saving', title: 'Semantic caching could save 15% cost', detail: `Based on ${formatNumber(totalReqs)} requests, implement semantic caching to eliminate repeated LLM calls.`, saving: cacheSaving });
    }

    return insights;
  }, [costBreakdown, totalCost, costForecast, isDavisPowered]);

  // Forecast projections
  const forecast30Day = costForecast.find(f => f.day === 30);

  // Budget breach prediction (from Davis or local)
  const budgetBreachDay = davisBudgetBreachDay;

  // ── DataTable column definitions ──

  const providerCostColumns = useMemo(
    () => [
      { id: 'provider', header: 'Provider', accessor: 'provider', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'totalTokens', header: 'Total Tokens', accessor: 'totalTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'inputTokens', header: 'Input', accessor: 'inputTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'outputTokens', header: 'Output', accessor: 'outputTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'estimatedCost', header: 'Est. Cost', accessor: 'estimatedCost', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>${(value as number).toFixed(2)}</Text> },
      { id: 'requestCount', header: 'Requests', accessor: 'requestCount', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatRequestCount(value)}</Text> },
      { id: 'costPer1K', header: '$/1K Req', accessor: 'avgCostPerRequest', columnType: 'number' as const, cell: ({ value }: any) => <Text>${((value as number) * 1000).toFixed(2)}</Text> },
    ],
    []
  );

  const modelCostColumns = useMemo(
    () => [
      { id: 'model', header: 'Model', accessor: 'model', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'provider', header: 'Provider', accessor: 'provider', cell: ({ value }: any) => <Text style={{ color: Colors.Text.Neutral.Subdued }}>{value || '-'}</Text> },
      { id: 'inputTokens', header: 'Input Tokens', accessor: 'inputTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'outputTokens', header: 'Output Tokens', accessor: 'outputTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'estimatedCost', header: 'Est. Cost', accessor: 'estimatedCost', columnType: 'number' as const, cell: ({ value, row }: any) => <Text style={{ fontWeight: 600, color: (value as number) > 1 ? Colors.Text.Warning.Default : undefined }}>${(value as number).toFixed(2)}</Text> },
      { id: 'totalRequests', header: 'Requests', accessor: 'totalRequests', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatRequestCount(value)}</Text> },
      { id: 'costPerRequest', header: '$/1K Req', accessor: 'costPerRequest', columnType: 'number' as const, cell: ({ value }: any) => <Text>${((value as number) * 1000).toFixed(2)}</Text> },
    ],
    []
  );

  const serviceCostColumns = useMemo(
    () => [
      { id: 'serviceId', header: 'Service', accessor: 'serviceId', cell: ({ value }: any) => <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={value}>{(value as string).replace('SERVICE-', '').substring(0, 12)}...</Text> },
      { id: 'totalRequests', header: 'Requests', accessor: 'totalRequests', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatRequestCount(value)}</Text> },
      { id: 'totalTokens', header: 'Tokens', accessor: 'totalTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{((value as number) / 1000).toFixed(1)}K</Text> },
      { id: 'estimatedCost', header: 'Cost', accessor: 'estimatedCost', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>${(value as number).toFixed(2)}</Text> },
    ],
    []
  );

  const tokenEfficiencyColumns = useMemo(
    () => [
      { id: 'model', header: 'Model', accessor: 'model', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'provider', header: 'Provider', accessor: 'provider', cell: ({ value }: any) => <Text style={{ color: Colors.Text.Neutral.Subdued }}>{value || '-'}</Text> },
      { id: 'requests', header: 'Requests', accessor: 'requests', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'avgInput', header: 'Avg In', accessor: 'avgInput', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(0)}</Text> },
      { id: 'avgOutput', header: 'Avg Out', accessor: 'avgOutput', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(0)}</Text> },
      { id: 'efficiency', header: 'Efficiency', accessor: 'efficiency', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>{(value as number).toFixed(2)}x</Text> },
      { id: 'status', header: 'Status', accessor: (r: any) => ({ isWasteful: r.isWasteful, efficiency: r.efficiency }), cell: ({ value }: any) => value?.isWasteful ? <Text style={{ color: Colors.Text.Warning.Default, fontWeight: 600 }}>⚠️ Wasteful</Text> : (value?.efficiency || 0) < 1.0 ? <Text style={{ color: Colors.Text.Neutral.Subdued }}>Fair</Text> : <Text style={{ color: Colors.Text.Success.Default }}>✓ Efficient</Text> },
    ],
    []
  );

  const arbitrageColumns = useMemo(
    () => [
      { id: 'model', header: 'Model', accessor: 'model', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'provider', header: 'Provider', accessor: 'provider', cell: ({ value }: any) => <Text style={{ color: Colors.Text.Neutral.Subdued, textTransform: 'capitalize' as const }}>{value}</Text> },
      { id: 'costPerRequest', header: '$/Request', accessor: 'costPerRequest', columnType: 'number' as const, cell: ({ value }: any) => <Text>${(value as number).toFixed(4)}</Text> },
      { id: 'avgDurationMs', header: 'Avg Latency', accessor: 'avgDurationMs', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(0)}ms</Text> },
      { id: 'outputInputRatio', header: 'Out/In Ratio', accessor: 'outputInputRatio', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(2)}x</Text> },
      { id: 'errorRate', header: 'Error %', accessor: 'errorRate', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ color: (value as number) > 5 ? Colors.Text.Warning.Default : Colors.Text.Neutral.Default }}>{(value as number).toFixed(1)}%</Text> },
      { id: 'valueScore', header: 'Value Score', accessor: 'valueScore', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>{'⭐'.repeat(Math.min(Math.round(value as number), 5))} <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>{(value as number).toFixed(1)}</Text></Text> },
    ],
    []
  );

  const trainingJobColumns = useMemo(
    () => [
      { id: 'baseModel', header: 'Base Model', accessor: 'baseModel', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'status', header: 'Status', accessor: 'status', cell: ({ value }: any) => <Text style={{ color: value === 'Completed' ? STATUS_COLORS.good : Colors.Charts.Categorical.Color01.Default, fontWeight: 500 }}>{value}</Text> },
      { id: 'estimatedCostUsd', header: 'Est. Cost', accessor: 'estimatedCostUsd', columnType: 'number' as const, cell: ({ value }: any) => <Text>${(value as number).toFixed(2)}</Text> },
      { id: 'latestTimestamp', header: 'Started', accessor: 'latestTimestamp', cell: ({ value }: any) => <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>{formatDateTime(value)}</Text> },
    ],
    []
  );

  const promptAttrColumns = useMemo(
    () => [
      { id: 'patternPrefix', header: 'Prompt Pattern', accessor: 'patternPrefix', cell: ({ value }: any) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{value}</Text> },
      { id: 'occurrences', header: 'Calls', accessor: 'occurrences', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'totalCostUsd', header: 'Total Cost', accessor: 'totalCostUsd', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>${(value as number).toFixed(2)}</Text> },
      { id: 'avgCostPerCall', header: 'Avg $/Call', accessor: 'avgCostPerCall', columnType: 'number' as const, cell: ({ value }: any) => <Text>${(value as number).toFixed(4)}</Text> },
      { id: 'pctOfTotalCost', header: '% of Total', accessor: 'pctOfTotalCost', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600, color: (value as number) > 30 ? Colors.Text.Warning.Default : Colors.Text.Neutral.Default }}>{(value as number).toFixed(1)}%</Text> },
    ],
    []
  );

  const cacheCandidateColumns = useMemo(
    () => [
      { id: 'promptPattern', header: 'Prompt Pattern', accessor: 'promptPattern', cell: ({ value }: any) => <Text style={{ fontFamily: 'monospace', fontSize: 10, color: Colors.Text.Neutral.Subdued }} title={value}>{(value as string).substring(0, 50)}...</Text> },
      { id: 'model', header: 'Model', accessor: 'model', cell: ({ value }: any) => <Text style={{ fontSize: 10 }}>{(value as string).split('/').pop()}</Text> },
      { id: 'requestCount', header: 'Requests', accessor: 'requestCount', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}x</Text> },
      { id: 'cacheHitRate', header: 'Hit Rate', accessor: 'cacheHitRate', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ color: STATUS_COLORS.ideal }}>{((value as number) * 100).toFixed(0)}%</Text> },
      { id: 'totalCost', header: 'Current Cost', accessor: 'totalCost', columnType: 'number' as const, cell: ({ value }: any) => <Text>${(value as number).toFixed(3)}</Text> },
      { id: 'potentialSavings', header: 'Savings', accessor: 'potentialSavings', columnType: 'number' as const, cell: ({ value }: any) => <Text style={{ fontWeight: 600, color: STATUS_COLORS.ideal }}>${(value as number).toFixed(3)}</Text> },
    ],
    []
  );

  const anomalyShiftColumns = useMemo(
    () => [
      { id: 'model', header: 'Model', accessor: 'model', cell: ({ value }: any) => <Text style={{ fontWeight: 500 }}>{value}</Text> },
      { id: 'baselinePct', header: 'Baseline %', accessor: 'baselinePct', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(1)}%</Text> },
      { id: 'currentPct', header: 'Current %', accessor: 'currentPct', columnType: 'number' as const, cell: ({ value }: any) => <Text>{(value as number).toFixed(1)}%</Text> },
      { id: 'shift', header: 'Shift', accessor: (r: any) => ({ direction: r.direction, currentPct: r.currentPct, baselinePct: r.baselinePct }), cell: ({ value }: any) => { const d = value?.direction; const diff = ((value?.currentPct || 0) - (value?.baselinePct || 0)).toFixed(1); return <Text style={{ fontWeight: 600, color: d === 'up' ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>{d === 'up' ? '+' : ''}{diff}%</Text>; } },
    ],
    []
  );

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
          <AskAIButton
            variant="button"
            label="Ask AI about your FinOps data"
            onClick={() => openAskAI({
              domain: 'FinOps',
              data: {
                'Total Spend': totalCost,
                'Budget': budgetLimit,
                'Total Tokens': totalTokens,
                'Providers': costBreakdown.length,
              },
              suggestedPrompts: [
                'Give me a FinOps health check across all AI providers',
                'Which provider is most cost-effective per request?',
                'How can I reduce my AI spend by 20%?',
                'Forecast my AI costs for the next 30 days',
                'Compare token efficiency across all models',
              ],
            })}
          />
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
      {/* TABBED LAYOUT: "Follow the Money" Narrative                                */}
      {/* Tab 1: HOW MUCH? → Executive Summary (TCoAI + Budget + Anomaly RCA)       */}
      {/* Tab 2: WHERE?    → Cost Intelligence (Provider/Model/Service tables)        */}
      {/* Tab 3: WORTH IT? → AI Economics (Efficiency, Arbitrage, Training)           */}
      {/* Tab 4: PAY LESS? → Optimization Engine (Cache + Prompt Attribution)         */}
      {/* Tab 5: COMING?   → Forecast & Governance (Trends + Velocity + Guardrails)  */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Tabs defaultIndex={0}>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Executive Summary — "HOW MUCH does AI cost?"                   */}
        {/* TCoAI Iceberg + Budget hero + Anomaly Root Cause                      */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Executive Summary" prefixIcon={<MoneyIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* NEW: Total Cost of AI Ownership — The Iceberg                                */}
      {/* Token cost is only the tip. Infrastructure + Training = hidden 60-85%.       */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {tcoaiLoading ? (
        <Surface style={{ padding: 20 }}>
          <Flex justifyContent="center" alignItems="center" gap={8} style={{ height: 80 }}>
            <ProgressCircle size="small" />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Calculating Total Cost of AI Ownership…</Text>
          </Flex>
        </Surface>
      ) : tcoaiData ? (
        <Surface style={{ padding: 20, borderLeft: `4px solid ${STATUS_COLORS.warning}` }}>
          <Flex flexDirection="column" gap={16}>
            <Flex justifyContent="space-between" alignItems="center">
              <Flex alignItems="center" gap={8}>
                <MoneyIcon style={{ width: 18, height: 18, color: STATUS_COLORS.warning }} />
                <Heading level={5}>Total Cost of AI Ownership</Heading>
                <Text style={{
                  fontSize: 9, padding: '2px 8px',
                  background: STATUS_COLORS.warning + '20', color: STATUS_COLORS.warning,
                  borderRadius: 10, fontWeight: 700, letterSpacing: '0.5px',
                }}>TCoAI</Text>
                <Tooltip text="True cost of running AI — token spend is only the tip of the iceberg. Infrastructure (cloud compute) and training (fine-tuning jobs) make up the hidden majority. Only Dynatrace has all three cost layers in the same database.">
                  <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                </Tooltip>
                <AskAIButton
                  label="Ask AI about total cost of ownership"
                  onClick={() => openAskAI({
                    domain: 'FinOps — Total Cost of AI Ownership',
                    itemLabel: 'TCoAI Breakdown',
                    data: {
                      'Total Daily Cost': tcoaiData.totalDailyCost,
                      'Token Cost': tcoaiData.tokenCost,
                      'Infrastructure Cost': tcoaiData.infraCost,
                      'Training Cost': tcoaiData.trainingCost,
                      'Token %': tcoaiData.tokenPct,
                      'Infra %': tcoaiData.infraPct,
                    },
                    suggestedPrompts: [
                      'Why is infrastructure cost so much higher than token cost?',
                      'How can I reduce my total AI ownership cost?',
                      'Compare my TCoAI breakdown with industry benchmarks',
                      'What is the ROI of my training investment?',
                    ],
                  })}
                />
              </Flex>
              <Heading level={2} style={{ color: Colors.Text.Warning.Default }}>
                ${formatNumber(tcoaiData.totalDailyCost)}/day
              </Heading>
            </Flex>

            {/* Iceberg layers */}
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={12}>
                <Text style={{ width: 140, fontSize: 12, fontWeight: 500 }}>Token Cost ({formatPercent(tcoaiData.tokenPct)})</Text>
                <Flex style={{ flex: 1 }}><ProgressBar value={tcoaiData.tokenPct} max={100} /></Flex>
                <Text style={{ width: 100, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>${formatNumber(tcoaiData.tokenCost)}/day</Text>
              </Flex>
              <Flex alignItems="center" gap={12}>
                <Text style={{ width: 140, fontSize: 12, fontWeight: 500 }}>Infrastructure ({formatPercent(tcoaiData.infraPct)})</Text>
                <Flex style={{ flex: 1 }}><ProgressBar value={tcoaiData.infraPct} max={100} /></Flex>
                <Text style={{ width: 100, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>${formatNumber(tcoaiData.infraCost)}/day</Text>
              </Flex>
              <Flex alignItems="center" gap={12}>
                <Text style={{ width: 140, fontSize: 12, fontWeight: 500 }}>Training ({formatPercent(tcoaiData.trainingPct)})</Text>
                <Flex style={{ flex: 1 }}><ProgressBar value={tcoaiData.trainingPct} max={100} /></Flex>
                <Text style={{ width: 100, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>${formatNumber(tcoaiData.trainingCost)}/day</Text>
              </Flex>
            </Flex>

            {/* Infra provider breakdown */}
            {tcoaiData.infraProviderBreakdown.length > 0 && (
              <Flex gap={12} flexWrap="wrap">
                {tcoaiData.infraProviderBreakdown.map((bp, i) => (
                  <Surface key={i} style={{ flex: '1 1 180px', padding: 10 }}>
                    <Flex flexDirection="column" gap={2}>
                      <Text textStyle="small" style={{ fontWeight: 600, textTransform: 'uppercase' }}>{bp.provider}</Text>
                      <Text style={{ fontWeight: 700, fontSize: 16 }}>${formatNumber(bp.cost)}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{bp.regions} region(s) · {bp.instances} instance type(s)</Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}

            <Text textStyle="small" style={{ fontStyle: 'italic', color: Colors.Text.Neutral.Subdued }}>
              Your token cost is only the tip of the iceberg — infrastructure and training make up {formatPercent(tcoaiData.infraPct + tcoaiData.trainingPct)} of true AI cost.
            </Text>
          </Flex>
        </Surface>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Budget Overview                                                     */}
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
                Total Estimated Token Spend
              </Text>
              <Tooltip text="Estimated token/API cost based on usage × provider pricing rates. This matches the Token Cost layer in TCoAI above. Infrastructure and training costs are tracked separately in the TCoAI Iceberg.">
                <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about total spend"
                onClick={() => openAskAI({
                  domain: 'FinOps — Total Spend',
                  itemLabel: 'Total Estimated Spend',
                  data: { 'Total Cost': totalCost, 'Budget': budgetLimit, 'Usage %': Math.round((totalCost / budgetLimit) * 100), 'Providers': costBreakdown.length, 'Total Tokens': totalTokens },
                  suggestedPrompts: ['Why is my total spend this high?', 'How does my spend compare to industry benchmarks?', 'What are the top cost drivers?', 'How can I reduce costs without losing quality?'],
                })}
              />
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
              {formatNumber(totalTokens)}
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

      {/* ── Cost Anomaly Root Cause (moved from Optimization Engine) ── */}
      {anomalyRootCause?.detected && (
        <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Status.Critical.Default}` }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <CriticalIcon style={{ width: 16, height: 16, color: Colors.Charts.Status.Critical.Default }} />
              <Heading level={6}>Cost Anomaly Root Cause</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(255,0,0,0.1)', color: Colors.Text.Critical.Default, borderRadius: 10, fontWeight: 600 }}>ANOMALY DETECTED</Text>
              <AskAIButton
                label="Ask AI about cost anomaly"
                onClick={() => openAskAI({
                  domain: 'FinOps — Cost Anomaly',
                  itemLabel: 'Cost Anomaly Root Cause',
                  data: { 'Root Cause': anomalyRootCause.rootCause, 'Top Shifts': anomalyRootCause.topShifts.length, 'Cost Impact/Hr': anomalyRootCause.costImpactPerHour },
                  suggestedPrompts: ['Explain this cost anomaly in detail', 'What actions should I take to reduce the spike?', 'Is this anomaly temporary or a trend?', 'How much will this cost if it continues?'],
                })}
              />
            </Flex>
            <Surface style={{ padding: 12, backgroundColor: 'rgba(255,0,0,0.05)' }}>
              <Text style={{ fontWeight: 500 }}>{anomalyRootCause.rootCause}</Text>
              {anomalyRootCause.costImpactPerHour > 0 && (
                <Text textStyle="small" style={{ color: Colors.Text.Critical.Default, marginTop: 4 }}>
                  Estimated cost impact: ${anomalyRootCause.costImpactPerHour.toFixed(2)}/hour
                </Text>
              )}
            </Surface>
            {anomalyRootCause.topShifts.length > 0 && (
              <DataTable data={anomalyRootCause.topShifts} columns={anomalyShiftColumns} fullWidth variant={{ rowDensity: 'condensed' }} />
            )}
          </Flex>
        </Surface>
      )}

          </Flex>
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Cost Intelligence — "WHERE does the money go?"                 */}
        {/* Provider, Model, Embedding, Service tables + Prompt Attribution       */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Cost Intelligence" prefixIcon={<AiIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* Cost Breakdown Table */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex alignItems="center" gap={8}>
            <Heading level={6}>Cost Breakdown by Provider</Heading>
            <Tooltip text="Detailed cost analysis per AI provider. Input tokens = prompt/context tokens (cheaper), Output tokens = completion tokens (more expensive). $/1K Req shows cost per 1,000 requests for comparison.">
              <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
            </Tooltip>
            <AskAIButton
              label="Ask AI about provider costs"
              onClick={() => openAskAI({
                domain: 'FinOps — Provider Breakdown',
                itemLabel: 'All Providers',
                data: { 'Providers': costBreakdown.length, 'Total Cost': totalCost, 'Total Tokens': totalTokens },
                suggestedPrompts: ['Which provider gives the best value per token?', 'Compare all providers on cost efficiency', 'Should I consolidate to fewer providers?', 'Which provider has the lowest error rate?'],
              })}
            />
          </Flex>
          {loading ? (
            <Text>Loading cost data...</Text>
          ) : costBreakdown.length === 0 ? (
            <Text>No cost data available</Text>
          ) : (
            <DataTable data={costBreakdown} columns={providerCostColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }}>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
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
            <DataTable data={modelCosts} columns={modelCostColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }}>
              <DataTable.Pagination defaultPageSize={15} />
            </DataTable>
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
                          <Text textStyle="small">{formatNumber(requests)}</Text>
                        </Flex>
                        <Flex justifyContent="space-between">
                          <Text textStyle="small">Tokens:</Text>
                          <Text textStyle="small">{formatNumber(totalTokens)}</Text>
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
              <DataTable data={serviceCosts} columns={serviceCostColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }} />
            ) : (
              <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No service data available</Text>
              </Flex>
            )}
          </Flex>
        </Surface>
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* FINOPS FOUNDATION: Time-of-Day Usage Heatmap — "WHEN does the money go?"     */}
      {/* Best Practice: Monitor usage patterns to identify peak waste + idle periods   */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Categorical.Color05.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <BarChartIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color05.Default }} />
              <Heading level={6}>Time-of-Day Usage Pattern</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--dt-colors-charts-categorical-color-05-default)', borderRadius: 10, fontWeight: 600 }}>FINOPS.ORG</Text>
              <Tooltip text="FinOps Foundation recommends monitoring usage patterns to detect peak/off-peak waste. If most cost concentrates in a few hours, consider scheduling batch workloads during quieter periods or right-sizing auto-scaling. UTC timezone.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about usage patterns"
                onClick={() => openAskAI({
                  domain: 'FinOps — Time-of-Day Usage',
                  itemLabel: 'Usage Heatmap',
                  data: {
                    'Peak Hour (UTC)': timeOfDayData ? `${String(timeOfDayData.peakHour).padStart(2, '0')}:00` : 'N/A',
                    'Quietest Hour (UTC)': timeOfDayData ? `${String(timeOfDayData.quietHour).padStart(2, '0')}:00` : 'N/A',
                    'Peak/Trough Ratio': timeOfDayData?.peakToTroughRatio?.toFixed(1) || 'N/A',
                    'Top 4 Hours Cost %': timeOfDayData?.top4HoursCostPct?.toFixed(0) || 'N/A',
                  },
                  suggestedPrompts: ['Why is usage concentrated in certain hours?', 'How can I flatten my usage curve?', 'What workloads can be shifted to off-peak hours?', 'Should I implement auto-scaling for AI workloads?'],
                })}
              />
            </Flex>
            {timeOfDayData && (
              <Flex gap={12} alignItems="center">
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  Peak: {String(timeOfDayData.peakHour).padStart(2, '0')}:00 UTC
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  {timeOfDayData.peakToTroughRatio.toFixed(1)}x peak/trough
                </Text>
              </Flex>
            )}
          </Flex>
          {timeOfDayLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : timeOfDayData ? (
            <Flex flexDirection="column" gap={12}>
              {/* Bar heatmap — each hour is a bar, color intensity by request count */}
              <Flex gap={2} alignItems="flex-end" style={{ height: 100 }}>
                {timeOfDayData.hours.map((h) => {
                  const maxReqs = Math.max(...timeOfDayData.hours.map(x => x.requestCount), 1);
                  const heightPct = (h.requestCount / maxReqs) * 100;
                  const isPeak = h.hour === timeOfDayData.peakHour;
                  const isQuiet = h.hour === timeOfDayData.quietHour;
                  const barColor = isPeak ? Colors.Charts.Status.Critical.Default
                    : isQuiet ? Colors.Charts.Status.Neutral.Default
                    : heightPct > 80 ? Colors.Charts.Status.Warning.Default
                    : heightPct > 40 ? Colors.Charts.Categorical.Color05.Default
                    : Colors.Charts.Status.Good.Default;
                  return (
                    <Tooltip key={h.hour} text={`${h.label} UTC — ${formatNumber(h.requestCount)} requests, $${h.estimatedCost.toFixed(2)} est. cost (${h.topProvider})`}>
                      <Flex
                        flexDirection="column"
                        alignItems="center"
                        style={{ flex: 1, minWidth: 0, cursor: 'help' }}
                      >
                        <Flex style={{
                          width: '100%',
                          height: `${Math.max(heightPct, 4)}%`,
                          backgroundColor: barColor,
                          borderRadius: '2px 2px 0 0',
                          minHeight: 4,
                          transition: 'height 0.3s ease',
                        }} />
                      </Flex>
                    </Tooltip>
                  );
                })}
              </Flex>
              {/* Hour labels */}
              <Flex gap={2}>
                {timeOfDayData.hours.map((h) => (
                  <Flex key={h.hour} style={{ flex: 1, minWidth: 0 }} justifyContent="center">
                    <Text style={{ fontSize: 8, color: Colors.Text.Neutral.Subdued }}>
                      {h.hour % 3 === 0 ? `${String(h.hour).padStart(2, '0')}` : ''}
                    </Text>
                  </Flex>
                ))}
              </Flex>
              {/* Top 4 hours callout */}
              <Surface style={{ padding: 10, backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
                <Text textStyle="small">{timeOfDayData.insight}</Text>
              </Surface>
            </Flex>
          ) : (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No time-of-day data available</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

          </Flex>
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: AI Economics — Token efficiency, Model Arbitrage, Training ROI */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="AI Economics" prefixIcon={<BarChartIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* FINOPS FOUNDATION: Context Window Creep Tracker                               */}
      {/* #1 hidden cost in GenAI — the compounding input tokens from conversation      */}
      {/* history resent every turn. Sets the stage for WHY efficiency is low below.    */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Status.Warning.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <WarningIcon style={{ width: 16, height: 16, color: Colors.Charts.Status.Warning.Default }} />
              <Heading level={6}>Context Window Creep</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--dt-colors-charts-status-warning-default)', borderRadius: 10, fontWeight: 600 }}>FINOPS.ORG #1 HIDDEN COST</Text>
              <Tooltip text="The FinOps Foundation identifies Context Window Creep as the #1 hidden cost in GenAI. LLM APIs are stateless — every turn resends the entire conversation history, causing input tokens to compound exponentially. A high input/output ratio (>5:1) signals context bloat eating your budget. Fix: implement conversation summarization, sliding window context, or prompt compression.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about context window creep"
                onClick={() => openAskAI({
                  domain: 'FinOps — Context Window Creep',
                  itemLabel: 'Context Window Analysis',
                  data: {
                    'Overall In/Out Ratio': contextCreepData?.overallRatio?.toFixed(1) || 'N/A',
                    'Creeping Requests %': contextCreepData?.creepingPct?.toFixed(0) || 'N/A',
                    'Est. Waste Cost': contextCreepData?.totalWasteCost?.toFixed(2) || 'N/A',
                    'Models Analysed': contextCreepData?.byModel?.length || 0,
                  },
                  suggestedPrompts: [
                    'Why is my input/output ratio so high?',
                    'How do I implement conversation summarization to reduce context?',
                    'What is the optimal context window strategy for my workloads?',
                    'How much can I save by reducing context window size?',
                  ],
                })}
              />
            </Flex>
            {contextCreepData && (
              <Flex gap={16} alignItems="center">
                <Flex flexDirection="column" alignItems="flex-end">
                  <Flex alignItems="baseline" gap={4}>
                    <Text style={{ fontSize: 24, fontWeight: 700, color: contextCreepData.overallRatio > 10 ? Colors.Text.Critical.Default : contextCreepData.overallRatio > 5 ? Colors.Text.Warning.Default : Colors.Text.Neutral.Default }}>
                      {contextCreepData.overallRatio.toFixed(1)}:1
                    </Text>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>avg ratio</Text>
                  </Flex>
                </Flex>
              </Flex>
            )}
          </Flex>
          {contextCreepLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : contextCreepData ? (
            <Flex flexDirection="column" gap={12}>
              {/* Summary strip */}
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Total Requests</Text>
                    <Text style={{ fontWeight: 700, fontSize: 18 }}>{formatNumber(contextCreepData.totalRequests)}</Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Creeping (ratio &gt;5:1)</Text>
                    <Text style={{ fontWeight: 700, fontSize: 18, color: contextCreepData.creepingPct > 50 ? Colors.Text.Critical.Default : Colors.Text.Warning.Default }}>
                      {formatPercent(contextCreepData.creepingPct)}
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Est. Waste from Bloat</Text>
                    <Text style={{ fontWeight: 700, fontSize: 18, color: Colors.Text.Warning.Default }}>
                      ${contextCreepData.totalWasteCost.toFixed(2)}
                    </Text>
                  </Flex>
                </Surface>
              </Flex>

              {/* Ratio distribution buckets */}
              <Flex gap={4} alignItems="flex-end" style={{ height: 60 }}>
                {contextCreepData.buckets.map((b) => {
                  const maxPct = Math.max(...contextCreepData.buckets.map(x => x.pctOfTotal), 1);
                  const heightPct = (b.pctOfTotal / maxPct) * 100;
                  const bgColor = b.severity === 'critical' ? Colors.Charts.Status.Critical.Default
                    : b.severity === 'high' ? Colors.Charts.Status.Warning.Default
                    : b.severity === 'medium' ? Colors.Charts.Categorical.Color05.Default
                    : Colors.Charts.Status.Good.Default;
                  return (
                    <Tooltip key={b.label} text={`${b.label}: ${formatNumber(b.requestCount)} requests (${b.pctOfTotal.toFixed(1)}%)`}>
                      <Flex flexDirection="column" alignItems="center" gap={4} style={{ flex: 1, cursor: 'help' }}>
                        <Flex style={{ width: '100%', height: `${Math.max(heightPct, 8)}%`, backgroundColor: bgColor, borderRadius: 3, minHeight: 6 }} />
                        <Text style={{ fontSize: 8, color: Colors.Text.Neutral.Subdued, textAlign: 'center' }}>{b.label.split(' ')[0]}</Text>
                      </Flex>
                    </Tooltip>
                  );
                })}
              </Flex>

              {/* Per-model breakdown — top offenders */}
              {contextCreepData.byModel.length > 0 && (
                <Flex flexDirection="column" gap={6}>
                  <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Top Models by Context Bloat</Text>
                  {contextCreepData.byModel.filter(m => m.severity !== 'low').slice(0, 5).map((m, i) => (
                    <Flex key={i} justifyContent="space-between" alignItems="center" style={{ padding: '4px 0', borderBottom: `1px solid var(--dt-colors-border-neutral-default)` }}>
                      <Flex gap={8} alignItems="center">
                        <Text style={{ fontSize: 9, padding: '1px 5px', backgroundColor: m.severity === 'critical' ? 'rgba(255,0,0,0.1)' : m.severity === 'high' ? 'rgba(255,165,0,0.1)' : 'rgba(245,158,11,0.1)', color: m.severity === 'critical' ? Colors.Text.Critical.Default : Colors.Text.Warning.Default, borderRadius: 8, fontWeight: 600 }}>{m.severity.toUpperCase()}</Text>
                        <Text style={{ fontWeight: 500, fontSize: 12 }}>{m.model}</Text>
                        <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>{m.provider}</Text>
                      </Flex>
                      <Flex gap={16} alignItems="center">
                        <Text style={{ fontSize: 11, fontWeight: 600 }}>{m.avgInputOutputRatio.toFixed(1)}:1</Text>
                        <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>{formatNumber(m.requestCount)} req</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600, color: Colors.Text.Warning.Default }}>${m.estimatedWasteCost.toFixed(2)} waste</Text>
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
              )}

              {/* Insight */}
              <Surface style={{ padding: 10, backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
                <Text textStyle="small">{contextCreepData.insight}</Text>
              </Surface>
            </Flex>
          ) : (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No context window data available (requires spans with both input and output tokens)</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

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
              <AskAIButton
                label="Ask AI about token efficiency"
                onClick={() => openAskAI({
                  domain: 'FinOps — Token Efficiency',
                  itemLabel: 'Token Efficiency Analysis',
                  data: { 'Models Analyzed': tokenEfficiency?.length || 0, 'Wasteful Models': tokenEfficiency?.filter((i: any) => i.isWasteful).length || 0 },
                  suggestedPrompts: ['Which models are the most wasteful and why?', 'How can I improve token efficiency?', 'What is a good efficiency ratio for my use case?', 'Compare input vs output token ratios across models'],
                })}
              />
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
            <DataTable data={tokenEfficiency.slice(0, 10)} columns={tokenEfficiencyColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }}>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : (
            <Flex justifyContent="center" alignItems="center" style={{ height: 100 }}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No efficiency data available</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* ── Model Arbitrage Matrix (from useModelArbitrage) ── */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Categorical.Color06.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color06.Default }} />
              <Heading level={6}>Model Arbitrage Matrix</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--dt-colors-charts-categorical-color-06-default)', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</Text>
              <Tooltip text="Compares all models across cost, latency, output efficiency, and reliability. Value Score weights: Cost 40%, Latency 20%, Output Efficiency 20%, Reliability 20%. Higher score = better value. Recommendations show where you can switch to a cheaper model with similar quality.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about model arbitrage"
                onClick={() => openAskAI({
                  domain: 'FinOps — Model Arbitrage',
                  itemLabel: 'Model Arbitrage Matrix',
                  data: { 'Models Compared': arbitrageData?.chatModels?.length || 0, 'Monthly Spend': arbitrageData?.totalMonthlySpend || 0, 'Potential Savings': arbitrageData?.potentialMonthlySavings || 0 },
                  suggestedPrompts: ['Which models offer the best value for my use cases?', 'Where can I save money by switching models?', 'Compare GPT-4o vs Claude for cost efficiency', 'What is the optimal model mix for my workload?'],
                })}
              />
            </Flex>
            {arbitrageData && (
              <Flex gap={12} alignItems="center">
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  ${formatNumber(arbitrageData.totalMonthlySpend)}/mo
                </Text>
                {arbitrageData.potentialMonthlySavings > 0 && (
                  <Text textStyle="small" style={{ color: STATUS_COLORS.ideal, fontWeight: 600 }}>
                    Save ${formatNumber(arbitrageData.potentialMonthlySavings)}/mo
                  </Text>
                )}
              </Flex>
            )}
          </Flex>
          {arbitrageLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : arbitrageData && arbitrageData.chatModels.length > 0 ? (
            <>
            <DataTable data={arbitrageData.chatModels.slice(0, 12)} columns={arbitrageColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }}>
              <DataTable.Pagination defaultPageSize={12} />
            </DataTable>
            {arbitrageData.recommendations.length > 0 && (
              <Surface style={{ padding: 12, marginTop: 8, backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: 6 }}>
                <Flex flexDirection="column" gap={6}>
                  <Text style={{ fontWeight: 600, fontSize: 12, color: STATUS_COLORS.ideal }}>Arbitrage Recommendations</Text>
                  {arbitrageData.recommendations.map((rec, i) => (
                    <Text key={i} textStyle="small">
                      Switch <strong>{rec.fromModel}</strong> → <strong>{rec.toModel}</strong>: save ${rec.monthlySavings.toFixed(2)}/mo — {rec.qualityImpact}
                    </Text>
                  ))}
                </Flex>
              </Surface>
            )}
            </>
          ) : (
            <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120 }}>
              <AiIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No model arbitrage data — requires multiple models with cost data</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* FINOPS FOUNDATION: Model Quality-Need Matching (KPI #10)                      */}
      {/* "Are you using a flagship model for tasks a balanced model could handle?"      */}
      {/* Narrative flow: Arbitrage shows VALUE, this shows OVER-PROVISIONING.           */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Categorical.Color03.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color03.Default }} />
              <Heading level={6}>Model Quality-Need Matching</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--dt-colors-charts-categorical-color-03-default)', borderRadius: 10, fontWeight: 600 }}>FINOPS.ORG KPI #10</Text>
              <Tooltip text="FinOps Foundation KPI #10: Are your models over-qualified for their tasks? Flagship models (MMLU 86+) cost 10-50x more than efficient models (MMLU <75). If your prompts are simple (short input), you may be paying for reasoning capability you don't need. Tier recommendation is based on average prompt complexity.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about model quality matching"
                onClick={() => openAskAI({
                  domain: 'FinOps — Model Quality Matching',
                  itemLabel: 'Quality-Need Analysis',
                  data: {
                    'Over-Provisioned Models': qualityMatchData?.overProvisionedCount || 0,
                    'Potential Savings': qualityMatchData?.totalPotentialSavings?.toFixed(2) || '0',
                    'Models Analysed': qualityMatchData?.models?.length || 0,
                  },
                  suggestedPrompts: [
                    'Which models should I downgrade to save money?',
                    'What MMLU score do I actually need for my workloads?',
                    'How do I implement model routing by prompt complexity?',
                    'What is the cost difference between flagship and efficient models?',
                  ],
                })}
              />
            </Flex>
            {qualityMatchData && qualityMatchData.overProvisionedCount > 0 && (
              <Flex gap={8} alignItems="center">
                <Text textStyle="small" style={{ color: Colors.Text.Warning.Default, fontWeight: 600 }}>
                  {qualityMatchData.overProvisionedCount} over-provisioned
                </Text>
                <Text textStyle="small" style={{ color: STATUS_COLORS.ideal, fontWeight: 600 }}>
                  Save ${qualityMatchData.totalPotentialSavings.toFixed(2)}
                </Text>
              </Flex>
            )}
          </Flex>
          {qualityMatchLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : qualityMatchData && qualityMatchData.models.length > 0 ? (
            <Flex flexDirection="column" gap={12}>
              {/* Model quality cards — only non-embedding models */}
              {qualityMatchData.models.filter(m => m.tier !== 'embedding').slice(0, 10).map((m, i) => {
                const tierColor = m.tier === 'flagship' ? Colors.Charts.Categorical.Color06.Default
                  : m.tier === 'balanced' ? Colors.Charts.Categorical.Color05.Default
                  : m.tier === 'efficient' ? Colors.Charts.Status.Good.Default
                  : Colors.Text.Neutral.Subdued;
                const recTierColor = m.recommendedTier === 'flagship' ? Colors.Charts.Categorical.Color06.Default
                  : m.recommendedTier === 'balanced' ? Colors.Charts.Categorical.Color05.Default
                  : Colors.Charts.Status.Good.Default;
                return (
                  <Flex key={i} justifyContent="space-between" alignItems="center" style={{ padding: '6px 0', borderBottom: `1px solid var(--dt-colors-border-neutral-default)` }}>
                    <Flex gap={8} alignItems="center" style={{ flex: 2 }}>
                      <Text style={{ fontWeight: 500, fontSize: 12 }}>{m.model}</Text>
                      <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>{m.provider}</Text>
                    </Flex>
                    <Flex gap={12} alignItems="center" style={{ flex: 3 }} justifyContent="flex-end">
                      <Flex gap={4} alignItems="center">
                        <Text style={{ fontSize: 9, padding: '1px 6px', backgroundColor: tierColor + '20', color: tierColor, borderRadius: 8, fontWeight: 600 }}>{m.tier.toUpperCase()}</Text>
                        {m.mmluScore > 0 && <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>MMLU {m.mmluScore}</Text>}
                      </Flex>
                      {m.isOverProvisioned && (
                        <Flex gap={4} alignItems="center">
                          <Text style={{ fontSize: 10, color: Colors.Text.Warning.Default }}>→</Text>
                          <Text style={{ fontSize: 9, padding: '1px 6px', backgroundColor: recTierColor + '20', color: recTierColor, borderRadius: 8, fontWeight: 600 }}>{m.recommendedTier.toUpperCase()}</Text>
                        </Flex>
                      )}
                      <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued, minWidth: 50, textAlign: 'right' }}>{formatNumber(m.requestCount)} req</Text>
                      <Text style={{ fontSize: 11, minWidth: 60, textAlign: 'right' }}>${m.estimatedCost.toFixed(2)}</Text>
                      {m.isOverProvisioned ? (
                        <Text style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS.ideal, minWidth: 70, textAlign: 'right' }}>
                          Save ${m.potentialSavings.toFixed(2)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued, minWidth: 70, textAlign: 'right' }}>
                          <CheckmarkIcon style={{ width: 10, height: 10 }} /> Right-sized
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                );
              })}

              {/* Insight */}
              <Surface style={{ padding: 10, backgroundColor: 'rgba(34, 197, 94, 0.06)' }}>
                <Text textStyle="small">{qualityMatchData.insight}</Text>
              </Surface>
            </Flex>
          ) : (
            <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120 }}>
              <AiIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No model quality data available</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* ── Training ROI (from useTrainingROI) ── */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Categorical.Color04.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <ServicesIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color04.Default }} />
              <Heading level={6}>Training & Fine-Tuning ROI</Heading>
              <Tooltip text="Tracks fine-tuning and training jobs from gen_ai.auditing business events. Shows investment, job status, and models being trained. Use this to understand your training spend and ensure ROI on custom models.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {trainingData && (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {trainingData.totalJobCount} job{trainingData.totalJobCount !== 1 ? 's' : ''} &bull; ${formatNumber(trainingData.totalInvestment)} invested
              </Text>
            )}
          </Flex>
          {trainingLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 100 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : trainingData && trainingData.totalJobCount > 0 ? (
            <Flex flexDirection="column" gap={12}>
              {/* Summary Cards */}
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ flex: '1 1 180px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Total Investment</Text>
                    <Heading level={4}>${formatNumber(trainingData.totalInvestment)}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 180px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Models Trained</Text>
                    <Heading level={4}>{trainingData.modelsTrainedCount}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 180px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Completed</Text>
                    <Heading level={4} style={{ color: STATUS_COLORS.good }}>{trainingData.completedJobs}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 180px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>In Progress</Text>
                    <Heading level={4} style={{ color: Colors.Charts.Categorical.Color01.Default }}>{trainingData.inProgressJobs}</Heading>
                  </Flex>
                </Surface>
              </Flex>
              <DataTable data={trainingData.jobs.slice(0, 8)} columns={trainingJobColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }} />
            </Flex>
          ) : (
            <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 100 }}>
              <ServicesIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No training jobs detected — requires gen_ai.auditing business events with type=training</Text>
            </Flex>
          )}
        </Flex>
      </Surface>

          </Flex>
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: Optimization Engine — Cache, Prompt Attribution, Recommendations */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Optimization Engine" prefixIcon={<RefreshIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
      {/* 🚀 UNIQUE GCC: Semantic Cache Savings ROI Calculator */}
      {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${STATUS_COLORS.ideal}` }}>
        <Flex flexDirection="column" gap={16}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <RefreshIcon style={{ width: 18, height: 18, color: STATUS_COLORS.ideal }} />
              <Heading level={6}>Semantic Cache Savings Calculator</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--dt-colors-charts-categorical-color-06-default)', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</Text>
              <Tooltip text="Identifies repeated prompts that could be cached. When you implement semantic caching, identical prompts return cached responses instead of calling the LLM again - saving tokens and cost. ROI shows potential savings if caching was implemented.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {cacheSavings && cacheSavings.totalCandidates > 0 && (
              <Text style={{ padding: '4px 12px', backgroundColor: STATUS_COLORS.ideal + '20', color: STATUS_COLORS.ideal, borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
                ${cacheSavings.totalPotentialSavings.toFixed(2)} potential savings
              </Text>
            )}
          </Flex>
          {cacheSavingsLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : cacheSavings && cacheSavings.totalCandidates > 0 ? (
            <>
              <Flex gap={16} style={{ flexWrap: 'wrap' }}>
                <Surface style={{ flex: '1 1 160px', padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Potential Savings</Text>
                    <Heading level={3} style={{ color: STATUS_COLORS.ideal }}>${cacheSavings.totalPotentialSavings.toFixed(2)}</Heading>
                    <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>↓ {((cacheSavings.totalPotentialSavings / Math.max(totalCost, 0.01)) * 100).toFixed(0)}% of current spend</Text>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Cache Candidates</Text>
                    <Heading level={3}>{cacheSavings.totalCandidates}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Repeated Requests</Text>
                    <Heading level={3}>{formatNumber(cacheSavings.totalRepetitiveRequests)}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ flex: '1 1 160px', padding: 12 }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Potential Cache Hit Rate</Text>
                    <Heading level={3}>{(cacheSavings.avgPotentialCacheHitRate * 100).toFixed(0)}%</Heading>
                  </Flex>
                </Surface>
              </Flex>
              <Flex flexDirection="column" gap={8}>
                <Text textStyle="small" style={{ fontWeight: 600 }}>Top Cache Candidates (by savings)</Text>
                <DataTable data={cacheSavings.topCandidates.slice(0, 5)} columns={cacheCandidateColumns} fullWidth variant={{ rowDensity: 'condensed' }} />
              </Flex>
              <Surface style={{ padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.08)', borderRadius: 6 }}>
                <Flex alignItems="flex-start" gap={8}>
                  <CheckmarkIcon style={{ width: 16, height: 16, color: STATUS_COLORS.ideal, marginTop: 2 }} />
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontWeight: 600, color: STATUS_COLORS.ideal }}>Recommended Action</Text>
                    <Text textStyle="small">
                      Implement semantic caching for these {cacheSavings.totalCandidates} prompt patterns to save
                      <strong> ${cacheSavings.totalPotentialSavings.toFixed(2)}</strong> ({((cacheSavings.totalPotentialSavings / Math.max(totalCost, 0.01)) * 100).toFixed(0)}% reduction).
                    </Text>
                  </Flex>
                </Flex>
              </Surface>
            </>
          ) : (
            <Flex flexDirection="column" alignItems="center" gap={8} style={{ padding: 24, opacity: 0.7 }}>
              <RefreshIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small">No repeated prompt patterns detected (5+ occurrences required)</Text>
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
        <Text style={{
          fontSize: 9, padding: '2px 6px',
          backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--dt-colors-charts-categorical-color-06-default)',
          borderRadius: 10, fontWeight: 600,
        }}>LIVE DATA</Text>
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

      {/* ── Prompt Cost Attribution (moved from Cost Intelligence) ── */}
      <Surface style={{ padding: 16, borderLeft: `4px solid ${Colors.Charts.Categorical.Color06.Default}` }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <DocumentIcon style={{ width: 16, height: 16, color: Colors.Charts.Categorical.Color06.Default }} />
              <Heading level={6}>Prompt Cost Attribution</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--dt-colors-charts-categorical-color-06-default)', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</Text>
              <Tooltip text="Attributes cost to individual prompt patterns using gen_ai.auditing business events. Identifies which prompts are consuming the most budget so you can optimize or consolidate them.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {promptAttrData && (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {promptAttrData.patterns.length} pattern{promptAttrData.patterns.length !== 1 ? 's' : ''} &bull; ${formatNumber(promptAttrData.totalPromptsCost)} total
              </Text>
            )}
          </Flex>
          {promptAttrLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
              <ProgressCircle size="small" />
            </Flex>
          ) : promptAttrData && promptAttrData.patterns.length > 0 ? (
            <DataTable data={promptAttrData.patterns.slice(0, 10)} columns={promptAttrColumns} sortable fullWidth variant={{ rowDensity: 'condensed' }}>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : (
            <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120 }}>
              <DocumentIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No prompt attribution data available — requires gen_ai.auditing business events</Text>
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
        </Tab>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: Forecast & Governance — Trends, projections, alerts, guardrails */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <Tab title="Forecast & Governance" prefixIcon={<MoneyIcon />}>
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* Cost Trend Chart */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <MoneyIcon style={{ width: 16, height: 16, color: Colors.Charts.Apdex.Good.Default }} />
              <Heading level={6}>Cost Trend by Provider</Heading>
              <Tooltip text="Shows estimated costs over time, grouped by AI provider. Use this to identify spending patterns, detect cost spikes, and compare provider costs.">
                <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
              <AskAIButton
                label="Ask AI about cost trends"
                onClick={() => openAskAI({
                  domain: 'FinOps — Cost Trends',
                  itemLabel: 'Cost Trend by Provider',
                  data: { 'Total Cost': totalCost, 'Providers Tracked': costTimeseriesData.length },
                  suggestedPrompts: ['Explain the cost trend over the last 7 days', 'Are there any cost anomalies or spikes?', 'Which provider is trending up the most?', 'Predict costs for the next week'],
                })}
              />
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

      {/* Budget Projection Strip */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: isDavisPowered ? Colors.Charts.Status.Good.Default : Colors.Text.Neutral.Subdued }} />
              <Heading level={6}>Budget Projection</Heading>
              {isDavisPowered && (
                <Text style={{ fontSize: 9, padding: '2px 8px', background: Colors.Charts.Status.Good.Default + '20', color: Colors.Charts.Status.Good.Default, borderRadius: 10, fontWeight: 700, letterSpacing: '0.5px' }}>DT INTELLIGENCE</Text>
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

      {/* Cost Optimization Insights */}
      {costInsights.length > 0 && (
        <Surface style={{ padding: 16, borderLeft: '4px solid ' + STATUS_COLORS.good }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16, color: STATUS_COLORS.good }} />
              <Heading level={6}>AI-Powered Cost Optimization Insights</Heading>
              <Text style={{ fontSize: 9, padding: '2px 6px', background: STATUS_COLORS.good + '20', color: STATUS_COLORS.good, borderRadius: 10, fontWeight: 700 }}>LIVE</Text>
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

      {/* Autonomous Cost Guardrails — includes Cost Velocity, sparkline, and per-provider breakdown */}
      <CostGuardrailPanel dailyBudget={budgetLimit} />

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

      {/* Ask Dynatrace Intelligence Sheet */}
      <AskAISheet
        show={askAISheet.show}
        onDismiss={closeAskAI}
        context={askAISheet.context}
      />
    </Flex>
  );
};

export default FinOps;
