import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Button } from "@dynatrace/strato-components/buttons";
import { TitleBar } from "@dynatrace/strato-components-preview/layouts";
import { TimeframeSelector } from "@dynatrace/strato-components-preview/filters";
import { TimeseriesChart, DonutChart } from "@dynatrace/strato-components-preview/charts";
import { Tooltip } from "@dynatrace/strato-components-preview/overlays";
import type { Timeseries } from "@dynatrace/strato-components-preview/charts";
import type { Timeframe } from "@dynatrace/strato-components-preview/core";
import { Colors } from "@dynatrace/strato-design-tokens";
import {
  AiIcon,
  BarChartIcon,
  MoneyIcon,
  SmartscapeIcon,
  ServiceLevelObjectivesIcon,
  SecurityIcon,
  WorkflowsIcon,
  WarningIcon,
  ClockIcon,
  HostsIcon,
  ServicesIcon,
  HomeIcon,
  HelpIcon
} from "@dynatrace/strato-icons";
import { useAIServicesDiscovery, useAIServicesTrend, useTokensByProvider, useErrorRateTrendByModel, useLatencyTrendByProvider, useTokenEfficiencyByProvider, useModelUsageTrend } from "../hooks";
import { calculateOverallHealth, formatNumber, formatCurrency } from "../utils";

// Dynatrace Status Color Tokens (following Status and Health guidelines)
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,     // Success/Healthy state
  good: Colors.Charts.Status.Good.Default,       // Informational/Primary
  neutral: Colors.Charts.Status.Neutral.Default, // Inactive/Unknown
  warning: Colors.Charts.Status.Warning.Default, // Warning state
  critical: Colors.Charts.Status.Critical.Default, // Critical/Error state
};

// Dynatrace Chart Color Palette (using Strato categorical colors)
const CHART_COLORS = {
  primary: Colors.Charts.Categorical.Color01.Default,
  secondary: Colors.Charts.Categorical.Color02.Default,
  tertiary: Colors.Charts.Categorical.Color03.Default,
  quaternary: Colors.Charts.Categorical.Color04.Default,
  // Status colors for semantic meaning
  success: STATUS_COLORS.ideal,
  warning: STATUS_COLORS.warning,
  critical: STATUS_COLORS.critical,
};

// Full categorical palette for multi-series charts (12 distinct colors)
const CATEGORICAL_PALETTE = [
  Colors.Charts.Categorical.Color01.Default,
  Colors.Charts.Categorical.Color02.Default,
  Colors.Charts.Categorical.Color03.Default,
  Colors.Charts.Categorical.Color04.Default,
  Colors.Charts.Categorical.Color05.Default,
  Colors.Charts.Categorical.Color06.Default,
  Colors.Charts.Categorical.Color07.Default,
  Colors.Charts.Categorical.Color08.Default,
  Colors.Charts.Categorical.Color09.Default,
  Colors.Charts.Categorical.Color10.Default,
  Colors.Charts.Categorical.Color11.Default,
  Colors.Charts.Categorical.Color12.Default,
];

/** Create a default Timeframe object (last 24 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});


/** Get display label for timeframe */
const getTimeframeLabel = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-24h';
  if (from === 'now()-24h') return 'Last 24 Hours';
  if (from === 'now()-1h') return 'Last Hour';
  if (from === 'now()-6h') return 'Last 6 Hours';
  if (from === 'now()-12h') return 'Last 12 Hours';
  if (from === 'now()-7d') return 'Last 7 Days';
  if (from === 'now()-30d') return 'Last 30 Days';
  return 'Custom';
};

// Compact stat card for the executive dashboard - inline style
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}> = ({ label, value, icon, trend, color }) => (
  <Flex 
    alignItems="center" 
    gap={8}
    padding={12}
    style={{ 
      borderRadius: 6, 
      background: 'var(--dt-colors-surface-default)',
      border: '1px solid var(--dt-colors-border-neutral-default)',
      minWidth: 130
    }}
  >
    <span style={{ color: color || 'var(--dt-colors-text-secondary-default)', display: 'flex' }}>{icon}</span>
    <Flex flexDirection="column" gap={0}>
      <span style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)', textTransform: 'uppercase' }}>{label}</span>
    </Flex>
  </Flex>
);

// Pillar card with description explaining its purpose
const PillarCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  metrics?: string;
}> = ({ title, description, icon, path, color, metrics }) => (
  <Link to={path} style={{ textDecoration: 'none', flex: 1, minWidth: 200 }}>
    <Surface style={{ 
      borderRadius: 8, 
      height: '100%',
      borderTop: `3px solid ${color}`,
      cursor: 'pointer',
      transition: 'box-shadow 0.2s',
    }}>
      <Flex padding={16} flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={8}>
          <div style={{ 
            width: 36, height: 36, borderRadius: 8, 
            background: `${color}18`, display: 'flex', 
            alignItems: 'center', justifyContent: 'center'
          }}>
            {icon}
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        </Flex>
        <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)', lineHeight: 1.5 }}>
          {description}
        </span>
        {metrics && (
          <span style={{ fontSize: 11, fontWeight: 500, color }}>
            {metrics}
          </span>
        )}
      </Flex>
    </Surface>
  </Link>
);

export const Home = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [showDocs, setShowDocs] = useState(false); // Core Capabilities hidden by default
  
  // Core data hooks
  const { data: services, loading } = useAIServicesDiscovery();
  const healthMetrics = services ? calculateOverallHealth(services) : null;
  
  // Real DQL timeseries data
  const { data: trendData, loading: trendLoading } = useAIServicesTrend(timeframe);
  const { data: providerData, loading: providerLoading } = useTokensByProvider(timeframe);
  const { data: errorTrendData, loading: errorTrendLoading } = useErrorRateTrendByModel(timeframe);
  const { data: latencyTrendData, loading: latencyTrendLoading } = useLatencyTrendByProvider(timeframe);
  const { data: efficiencyTrendData, loading: efficiencyTrendLoading } = useTokenEfficiencyByProvider(timeframe);
  const { data: modelUsageData, loading: modelUsageLoading } = useModelUsageTrend(timeframe);

  // Calculate health color using Strato tokens
  const healthColor = healthMetrics?.overallHealth === 'healthy' 
    ? CHART_COLORS.success
    : healthMetrics?.overallHealth === 'warning'
    ? CHART_COLORS.warning
    : healthMetrics?.overallHealth === 'critical'
    ? CHART_COLORS.critical
    : 'inherit';

  // Use real DQL data for charts
  const tokenTimeseriesData = useMemo((): Timeseries[] => {
    if (trendData?.tokens && trendData.tokens.length > 0 && trendData.tokens[0].datapoints.length > 1) {
      return trendData.tokens as Timeseries[];
    }
    return [];
  }, [trendData]);

  const requestTimeseriesData = useMemo((): Timeseries[] => {
    if (trendData?.requests && trendData.requests.length > 0 && trendData.requests[0].datapoints.length > 1) {
      return trendData.requests as Timeseries[];
    }
    return [];
  }, [trendData]);

  const costTimeseriesData = useMemo((): Timeseries[] => {
    if (trendData?.cost && trendData.cost.length > 0 && trendData.cost[0].datapoints.length > 1) {
      return trendData.cost as Timeseries[];
    }
    return [];
  }, [trendData]);

  // Error rate trend data for line chart
  const errorRateTimeseriesData = useMemo((): Timeseries[] => {
    if (errorTrendData && errorTrendData.length > 0 && errorTrendData[0].datapoints.length > 1) {
      return errorTrendData as Timeseries[];
    }
    return [];
  }, [errorTrendData]);

  // Latency P95 trend data
  const latencyTimeseriesData = useMemo((): Timeseries[] => {
    if (latencyTrendData && latencyTrendData.length > 0 && latencyTrendData[0].datapoints.length > 1) {
      return latencyTrendData as Timeseries[];
    }
    return [];
  }, [latencyTrendData]);

  // Token efficiency ratio trend data
  const efficiencyTimeseriesData = useMemo((): Timeseries[] => {
    if (efficiencyTrendData && efficiencyTrendData.length > 0 && efficiencyTrendData[0].datapoints.length > 1) {
      return efficiencyTrendData as Timeseries[];
    }
    return [];
  }, [efficiencyTrendData]);

  // Model usage trend data
  const modelUsageTimeseriesData = useMemo((): Timeseries[] => {
    if (modelUsageData && modelUsageData.length > 0 && modelUsageData[0].datapoints.length > 1) {
      return modelUsageData as Timeseries[];
    }
    return [];
  }, [modelUsageData]);

  // DonutChart data for token distribution by provider
  const donutChartSlices = useMemo(() => {
    if (!providerData || providerData.length === 0) return [];
    return providerData.map((p, i) => ({
      category: p.provider,
      value: p.tokens,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]
    }));
  }, [providerData]);

  // Calculate totals for display (sum across all providers)
  const chartTotals = useMemo(() => {
    // Sum tokens across all provider series
    const tokenTotal = tokenTimeseriesData.length > 0 
      ? tokenTimeseriesData.reduce((total, series) => 
          total + series.datapoints.reduce((sum, d) => sum + d.value, 0), 0)
      : healthMetrics?.totalTokensToday || 0;
    
    // Sum cost across all provider series
    const costTotal = costTimeseriesData.length > 0
      ? costTimeseriesData.reduce((total, series) => 
          total + series.datapoints.reduce((sum, d) => sum + d.value, 0), 0)
      : healthMetrics?.totalCostToday || 0;
    
    // Sum requests across all provider series
    const requestTotal = requestTimeseriesData.length > 0
      ? requestTimeseriesData.reduce((total, series) => 
          total + series.datapoints.reduce((sum, d) => sum + d.value, 0), 0)
      : 0;
    
    return { tokens: tokenTotal, cost: costTotal, requests: requestTotal };
  }, [tokenTimeseriesData, costTimeseriesData, requestTimeseriesData, healthMetrics]);

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      {/* TitleBar - Following Dynatrace App Structure Guidelines */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <HomeIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Executive Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>GenAI infrastructure at a glance</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <TimeframeSelector
            value={timeframe}
            onChange={(tf) => tf && setTimeframe(tf)}
            aria-label="Select time range"
          />
        </TitleBar.Suffix>
      </TitleBar>

      {/* Executive Summary Stats */}
      <Flex flexDirection="column" gap={8}>
        
        {loading ? (
          <Flex justifyContent="center" padding={24}>
            <ProgressCircle aria-label="Loading dashboard data" />
          </Flex>
        ) : healthMetrics ? (
          <Flex gap={8} flexWrap="wrap">
              <StatCard 
                icon={<HostsIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Health" 
                value={healthMetrics.overallHealth.toUpperCase()} 
                color={healthColor}
              />
              <StatCard 
                icon={<ServicesIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Services" 
                value={healthMetrics.totalServices}
              />
              <StatCard 
                icon={<BarChartIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Tokens" 
                value={formatNumber(chartTotals.tokens)}
              />
              <StatCard 
                icon={<MoneyIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Cost" 
                value={formatCurrency(chartTotals.cost)}
              />
              <StatCard 
                icon={<ClockIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Latency" 
                value={`${healthMetrics.avgLatency.toFixed(0)}ms`}
              />
              <StatCard 
                icon={<WarningIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Slow Reqs" 
                value={`${healthMetrics.avgSlowRequestRate.toFixed(1)}%`}
                color={healthMetrics.avgSlowRequestRate > 10 
                  ? STATUS_COLORS.critical 
                  : healthMetrics.avgSlowRequestRate > 5 
                  ? STATUS_COLORS.warning
                  : STATUS_COLORS.ideal}
              />
            </Flex>
          ) : (
            <span style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12 }}>No AI services discovered</span>
          )}
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Usage & Cost Trends */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {healthMetrics && (
        <>
          <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
            <BarChartIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)', letterSpacing: '0.5px' }}>Usage & Cost Trends</span>
          </Flex>

          {/* Usage & Cost Grid - 2x2 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 16,
          }}>
            {/* Token Trend - Real DQL Timeseries */}
            <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={8}>
                  <BarChartIcon style={{ width: 14, height: 14, color: CHART_COLORS.primary }} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Token Usage Trend</span>
                  <Tooltip text="Total tokens (input + output) consumed over time by provider. Each color = different provider. Spikes indicate high usage periods. 1K tokens ≈ 750 words.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <span style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.primary }}>{formatNumber(chartTotals.tokens)}</span>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" aria-label="Loading token data" />
                </Flex>
              ) : tokenTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={tokenTimeseriesData}
                  variant="area"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <BarChartIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No token data in timeframe</span>
                </Flex>
              )}
            </Flex>
          </Surface>
          
          {/* Cost Trend - Derived from Token Data */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <MoneyIcon style={{ width: 14, height: 14, color: CHART_COLORS.warning }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Cost Trend</span>
                  <Tooltip text="Estimated costs based on token usage × provider pricing. Uses public rates (OpenAI $0.50-$15/MTok). Watch for unexpected spikes indicating cost anomalies.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <span style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.warning }}>{formatCurrency(chartTotals.cost)}</span>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : costTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={costTimeseriesData}
                  variant="area"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <MoneyIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No cost data in timeframe</span>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Request Volume - Real DQL Timeseries */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <ServicesIcon style={{ width: 14, height: 14, color: CHART_COLORS.secondary }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Request Volume</span>
                  <Tooltip text="Total number of AI API calls (chat completions, embeddings, etc.) over time. Higher volume = more active usage. Each request consumes tokens and incurs cost.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <span style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.secondary }}>
                  {formatNumber(chartTotals.requests)}
                </span>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : requestTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={requestTimeseriesData}
                  variant="area"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ServicesIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No request data in timeframe</span>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Token Distribution by Provider - DonutChart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <AiIcon style={{ width: 14, height: 14, color: CHART_COLORS.tertiary }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Tokens by Provider</span>
                <Tooltip text="Distribution of token consumption across AI providers. High concentration in one provider = vendor lock-in risk. Consider multi-provider strategy for resilience.">
                  <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              {providerLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : donutChartSlices.length > 0 ? (
                <Flex gap={16} alignItems="center">
                  <DonutChart
                    data={{ slices: donutChartSlices }}
                    height={100}
                  />
                  {/* Custom Legend */}
                  <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                    {donutChartSlices.slice(0, 5).map((item, i) => (
                      <Flex key={i} alignItems="center" gap={8} style={{ fontSize: 11 }}>
                        <div style={{ 
                          width: 10, height: 10, borderRadius: 2, 
                          backgroundColor: item.color,
                          flexShrink: 0
                        }} />
                        <span style={{ color: 'var(--dt-colors-text-secondary-default)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.category}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {providerData?.find(p => p.provider === item.category)?.percentage.toFixed(0)}%
                        </span>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <AiIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No provider data available</span>
                </Flex>
              )}
            </Flex>
          </Surface>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {/* SECTION: Performance & Quality */}
          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          <Flex alignItems="center" gap={8} style={{ marginTop: 16 }}>
            <ClockIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)', letterSpacing: '0.5px' }}>Performance & Quality</span>
          </Flex>

          {/* Performance Grid - 2x2 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 16,
          }}>
            {/* Error Rate Trend by Provider - Line Chart */}
            <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <WarningIcon style={{ width: 14, height: 14, color: CHART_COLORS.critical }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Error Rate by Provider (%)</span>
                  <Tooltip text="Percentage of failed AI requests per provider. Errors include: rate limits (429), auth failures (401), model overload (503). Target: <1% error rate.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {errorRateTimeseriesData.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {errorRateTimeseriesData.length} provider{errorRateTimeseriesData.length > 1 ? 's' : ''} with errors
                  </span>
                )}
              </Flex>
              {errorTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : errorRateTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={errorRateTimeseriesData}
                  variant="line"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <WarningIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No errors in timeframe 🎉</span>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Latency P95 Trend by Provider - Line Chart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <ClockIcon style={{ width: 14, height: 14, color: CHART_COLORS.secondary }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>P95 Latency by Provider (ms)</span>
                  <Tooltip text="95th percentile response time. P95 means 95% of requests complete faster than this. Higher values = slower responses. Compare providers to identify performance differences.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {latencyTimeseriesData.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {latencyTimeseriesData.length} provider{latencyTimeseriesData.length > 1 ? 's' : ''}
                  </span>
                )}
              </Flex>
              {latencyTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : latencyTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={latencyTimeseriesData}
                  variant="line"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ClockIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No latency data available</span>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Token Efficiency Trend by Provider - Line Chart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <ServiceLevelObjectivesIcon style={{ width: 14, height: 14, color: CHART_COLORS.success }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Token Efficiency by Provider</span>
                  <Tooltip text="Output/Input token ratio. Higher = more output per input (efficient). Values <0.5 suggest large prompts with small responses (potential waste). Optimize by reducing context size.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {efficiencyTimeseriesData.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    output/input ratio
                  </span>
                )}
              </Flex>
              {efficiencyTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : efficiencyTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={efficiencyTimeseriesData}
                  variant="line"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ServiceLevelObjectivesIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No token data available</span>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Model Usage Trend - Area Chart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <AiIcon style={{ width: 14, height: 14, color: CHART_COLORS.primary }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Model Usage Trend</span>
                  <Tooltip text="Request count by model over time. Shows which models are most used. Use this to identify model popularity, plan capacity, and detect unexpected model switches.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {modelUsageTimeseriesData.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    Top {modelUsageTimeseriesData.length} models
                  </span>
                )}
              </Flex>
              {modelUsageLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 120 }}>
                  <ProgressCircle size="small" />
                </Flex>
              ) : modelUsageTimeseriesData.length > 0 ? (
                <TimeseriesChart
                  data={modelUsageTimeseriesData}
                  variant="area"
                  height={120}
                  colorPalette={CATEGORICAL_PALETTE}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend hidden />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 120, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <AiIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <span style={{ fontSize: 11 }}>No model usage data available</span>
                </Flex>
              )}
            </Flex>
          </Surface>
          </div>
        </>
      )}

      {/* Core Capabilities - On-demand documentation panel */}
      <Surface style={{ borderRadius: 8 }}>
        <Flex 
          justifyContent="space-between" 
          alignItems="center" 
          padding={12}
          style={{ cursor: 'pointer' }}
          onClick={() => setShowDocs(!showDocs)}
        >
          <Flex alignItems="center" gap={8}>
            <AiIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>What can GenAI Control Center do?</span>
            <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', marginLeft: 8 }}>
              {showDocs ? '(click to hide)' : '(click to explore capabilities)'}
            </span>
          </Flex>
          <Button variant="default">
            {showDocs ? 'Hide' : 'Show Documentation'}
          </Button>
        </Flex>
        
        {showDocs && (
          <Flex flexDirection="column" gap={16} padding={16} style={{ paddingTop: 0 }}>
            {/* Primary Pillars Row */}
            <Flex gap={12} flexWrap="wrap">
              <PillarCard
                icon={<BarChartIcon style={{ width: 20, height: 20, color: CHART_COLORS.success }} />}
                title="Health Dashboard"
                description="Auto-discover all GenAI services in your environment. Monitor latency, error rates, and request volumes in real-time."
                path="/health"
                color={CHART_COLORS.success}
                metrics={healthMetrics ? `${healthMetrics.totalServices} services monitored` : undefined}
              />
              <PillarCard
                icon={<SmartscapeIcon style={{ width: 20, height: 20, color: CHART_COLORS.secondary }} />}
                title="AI Topology"
                description="Visualize the relationship between your services, AI providers, and models. Understand dependencies at a glance."
                path="/topology"
                color={CHART_COLORS.secondary}
              />
              <PillarCard
                icon={<ServiceLevelObjectivesIcon style={{ width: 20, height: 20, color: CHART_COLORS.tertiary }} />}
                title="Response Analytics"
                description="Analyze token efficiency, model performance rankings, and output consistency. Identify optimization opportunities."
                path="/analytics"
                color={CHART_COLORS.tertiary}
              />
              <PillarCard
                icon={<WarningIcon style={{ width: 20, height: 20, color: CHART_COLORS.critical }} />}
                title="Real-Time Problems"
                description="View active Dynatrace problems filtered to GenAI context. Get instant visibility into issues affecting AI services."
                path="/problems"
                color={CHART_COLORS.critical}
              />
            </Flex>

            {/* Secondary Pillars Row */}
            <Flex gap={12} flexWrap="wrap">
              <PillarCard
                icon={<MoneyIcon style={{ width: 20, height: 20, color: CHART_COLORS.warning }} />}
                title="FinOps"
                description="Track token consumption, estimate costs by provider and model. Set budgets and get alerts on overspending."
                path="/finops"
                color={CHART_COLORS.warning}
                metrics={chartTotals.cost > 0 ? formatCurrency(chartTotals.cost) + ' today' : undefined}
              />
              <PillarCard
                icon={<SecurityIcon style={{ width: 20, height: 20, color: CHART_COLORS.quaternary }} />}
                title="Governance"
                description="Ensure compliance with AI policies. Monitor prompt content, track data handling, and enforce security standards."
                path="/governance"
                color={CHART_COLORS.quaternary}
              />
              <PillarCard
                icon={<AiIcon style={{ width: 20, height: 20, color: Colors.Charts.Categorical.Color05.Default }} />}
                title="Davis Intelligence"
                description="Ask Davis CoPilot about your AI infrastructure. Get root cause analysis and intelligent recommendations."
                path="/intelligence"
                color={Colors.Charts.Categorical.Color05.Default}
              />
              <PillarCard
                icon={<WorkflowsIcon style={{ width: 20, height: 20, color: Colors.Charts.Categorical.Color06.Default }} />}
                title="Operations"
                description="Access runbooks and remediation workflows. Automate responses to common AI service issues."
                path="/operations"
                color={Colors.Charts.Categorical.Color06.Default}
              />
            </Flex>
          </Flex>
        )}
      </Surface>
    </Flex>
  );
};
