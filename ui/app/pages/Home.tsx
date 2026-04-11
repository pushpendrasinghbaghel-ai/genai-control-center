import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Button } from "@dynatrace/strato-components/buttons";
import { TitleBar } from "@dynatrace/strato-components/layouts";
import { TimeframeSelector } from "@dynatrace/strato-components/filters";
import { TimeseriesChart, DonutChart } from "@dynatrace/strato-components/charts";
import { Tooltip, Modal } from "@dynatrace/strato-components/overlays";
import type { Timeseries } from "@dynatrace/strato-components/charts";
import type { Timeframe } from "@dynatrace/strato-components/core";
import { Colors } from "@dynatrace/strato-design-tokens";
import {
  AiIcon,
  AgentIcon,
  BarChartIcon,
  MoneyIcon,
  ServiceLevelObjectivesIcon,
  WarningIcon,
  ClockIcon,
  HostsIcon,
  ServicesIcon,
  HomeIcon,
  HelpIcon,
  ResearchIcon,
  CheckmarkIcon,
  CriticalIcon,
  AIModelIcon,
  LargeLanguageModelIcon,
  DavisCoPilotIcon,
} from "@dynatrace/strato-icons";
import { useAIServicesDiscovery, useAIServicesTrend, useTokensByProvider, useErrorRateTrendByModel, useLatencyTrendByProvider, useTokenEfficiencyByProvider, useModelUsageTrend, useAgentTools } from "../hooks";
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

/** Create a default Timeframe object (last 2 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-2h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});


/** Get display label for timeframe */
const getTimeframeLabel = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-2h';
  if (from === 'now()-2h') return 'Last 24 Hours';
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
      flex: '1 1 130px',
    }}
  >
    <Flex style={{ color: color || 'var(--dt-colors-text-secondary-default)' }}>{icon}</Flex>
    <Flex flexDirection="column" gap={0}>
      <Strong style={{ fontSize: 18, color: color || 'inherit', lineHeight: 1.2 }}>{value}</Strong>
      <Paragraph style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)', textTransform: 'uppercase', margin: 0 }}>{label}</Paragraph>
    </Flex>
  </Flex>
);


export const Home = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [showMaturityModal, setShowMaturityModal] = useState(false);
  
  // Core data hooks
  const { data: services, loading } = useAIServicesDiscovery();
  const healthMetrics = services ? calculateOverallHealth(services) : null;
  
  // Agent tools data for stat cards
  const { summary: agentSummary, fetchAgentToolsData } = useAgentTools();
  
  // Fetch agent data on mount
  React.useEffect(() => {
    fetchAgentToolsData();
  }, [fetchAgentToolsData]);
  
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

  // ── AI Observability Insights ────────────────────────────────────────────
  // Replaces the old "AI Maturity Score" with two genuinely useful views:
  //   1. Coverage Meter — what % of the gen_ai telemetry surface GCC can see
  //   2. Actionable Findings — specific, data-driven recommendations
  //
  // Design philosophy:
  //   - No composite score with subjective weights
  //   - Every finding maps to a concrete action + a page in GCC
  //   - Coverage is binary per-check (it's there or it isn't)
  //   - Follows Dynatrace "findings" model (like Davis problems)
  const aiInsights = useMemo(() => {
    const svcList = services ?? [];
    const svcCount = svcList.length;
    const errRate = healthMetrics?.avgErrorRate ?? 0;
    const healthyCount = healthMetrics?.healthyCount ?? 0;
    const criticalCount = healthMetrics?.criticalCount ?? 0;
    const agentCount = agentSummary?.totalAgents ?? 0;
    const tokenVol = chartTotals.tokens;
    const requestVol = chartTotals.requests;
    const costVol = chartTotals.cost;
    const avgLatency = healthMetrics?.avgLatency ?? 0;

    // Unique providers & models across all services
    const uniqueProviders = new Set<string>();
    const uniqueModels = new Set<string>();
    svcList.forEach((svc) => {
      const provArr = svc.providers && svc.providers.length > 0
        ? svc.providers
        : (svc.provider && svc.provider !== 'Unknown' && !svc.provider.match(/^\d+ providers?$/) ? [svc.provider] : []);
      const modArr = svc.models && svc.models.length > 0
        ? svc.models
        : (svc.modelName && svc.modelName !== 'Unknown' && !svc.modelName.match(/^\d+ models?$/) ? [svc.modelName] : []);
      provArr.forEach((p) => p && p !== 'Unknown' && uniqueProviders.add(p));
      modArr.forEach((m) => m && m !== 'Unknown' && uniqueModels.add(m));
    });
    const providerCount = uniqueProviders.size;
    const modelCount = uniqueModels.size;

    // Services with token telemetry (gen_ai.usage.* is opt-in)
    const svcWithTokens = svcList.filter(s => (s.totalTokens ?? 0) > 0).length;
    // Services with BOTH provider AND model (not just OR)
    const svcWithBoth = svcList.filter(s => {
      const hasProvider = s.providers && s.providers.length > 0
        ? s.providers.some(p => p && p !== 'Unknown')
        : (s.provider && s.provider !== 'Unknown' && !s.provider.match(/^\d+ providers?$/));
      const hasModel = s.models && s.models.length > 0
        ? s.models.some(m => m && m !== 'Unknown')
        : (s.modelName && s.modelName !== 'Unknown' && !s.modelName.match(/^\d+ models?$/));
      return hasProvider && hasModel;
    }).length;

    // ─── COVERAGE CHECKS ───
    // Each check is binary: the telemetry surface is covered or it isn't.
    // This is a sales accelerator ("you're using X% of what GCC can show you")
    // and an honest representation with zero subjective weighting.
    type CoverageCheck = {
      label: string;
      covered: boolean;
      detail: string;
      category: 'instrumentation' | 'reliability' | 'cost' | 'governance' | 'observability';
    };

    const coverageChecks: CoverageCheck[] = [
      // Instrumentation surface
      {
        label: 'Service discovery',
        covered: svcCount > 0,
        detail: svcCount > 0 ? `${svcCount} AI service${svcCount !== 1 ? 's' : ''} detected` : 'No gen_ai.* spans found',
        category: 'instrumentation',
      },
      {
        label: 'Token telemetry',
        covered: svcWithTokens > 0,
        detail: svcWithTokens > 0 ? `${svcWithTokens}/${svcCount} services reporting gen_ai.usage.*` : 'No token usage data (gen_ai.usage.* not emitted)',
        category: 'instrumentation',
      },
      {
        label: 'Full attribution',
        covered: svcWithBoth === svcCount && svcCount > 0,
        detail: svcCount > 0 ? `${svcWithBoth}/${svcCount} services have both provider + model` : 'No services',
        category: 'instrumentation',
      },
      // Reliability surface
      {
        label: 'Error monitoring',
        covered: requestVol > 0,
        detail: requestVol > 0 ? `${errRate.toFixed(1)}% error rate across ${formatNumber(requestVol)} requests` : 'No request traffic yet',
        category: 'reliability',
      },
      {
        label: 'Latency tracking',
        covered: avgLatency > 0,
        detail: avgLatency > 0 ? `P50 latency: ${avgLatency.toFixed(0)}ms` : 'No latency data available',
        category: 'reliability',
      },
      // Cost surface
      {
        label: 'Cost tracking',
        covered: costVol > 0,
        detail: costVol > 0 ? `${formatCurrency(costVol)} tracked this period` : 'No cost data — enable token telemetry for cost estimation',
        category: 'cost',
      },
      {
        label: 'Multi-provider visibility',
        covered: providerCount >= 2,
        detail: providerCount >= 2 ? `${providerCount} providers: ${[...uniqueProviders].join(', ')}` : `${providerCount} provider${providerCount !== 1 ? 's' : ''} — single-provider = no cost comparison`,
        category: 'cost',
      },
      // Governance surface
      {
        label: 'Model inventory',
        covered: modelCount >= 1,
        detail: modelCount > 0 ? `${modelCount} model${modelCount !== 1 ? 's' : ''}: ${[...uniqueModels].slice(0, 4).join(', ')}${modelCount > 4 ? '…' : ''}` : 'No models identified',
        category: 'governance',
      },
      {
        label: 'Health monitoring',
        covered: svcCount > 0 && criticalCount === 0,
        detail: criticalCount > 0 ? `${criticalCount} service${criticalCount !== 1 ? 's' : ''} in critical state` : (svcCount > 0 ? 'All services healthy' : 'No services to monitor'),
        category: 'governance',
      },
      // Observability surface
      {
        label: 'Agent tracing',
        covered: agentCount > 0,
        detail: agentCount > 0 ? `${agentCount} agent${agentCount !== 1 ? 's' : ''} with tool-call tracing` : 'No agentic workflows traced',
        category: 'observability',
      },
    ];

    const coveredCount = coverageChecks.filter(c => c.covered).length;
    const totalChecks = coverageChecks.length;
    const coveragePercent = Math.round((coveredCount / totalChecks) * 100);

    // ─── ACTIONABLE FINDINGS ───
    // Each finding is: severity + message + action + link to GCC page
    // Generated from data, not from arbitrary thresholds
    type Finding = {
      severity: 'critical' | 'warning' | 'info';
      title: string;
      detail: string;
      action: string;
      link: string;
      linkLabel: string;
    };

    const findings: Finding[] = [];

    // Critical findings
    if (svcCount === 0) {
      findings.push({
        severity: 'critical',
        title: 'No AI services discovered',
        detail: 'GCC requires gen_ai.* OpenTelemetry spans to function. No instrumented AI services were found in the selected timeframe.',
        action: 'Instrument your AI services with OTel gen_ai semantic conventions, then verify in the Health Dashboard.',
        link: '/health',
        linkLabel: 'Health Dashboard',
      });
    }

    if (criticalCount > 0) {
      findings.push({
        severity: 'critical',
        title: `${criticalCount} service${criticalCount !== 1 ? 's' : ''} in critical state`,
        detail: `${criticalCount} of ${svcCount} AI services have critical error rates (>10%). This indicates active reliability issues.`,
        action: 'Investigate error patterns and consider enabling automated remediation workflows.',
        link: '/operations',
        linkLabel: 'Operations',
      });
    }

    if (errRate > 5 && requestVol > 0) {
      findings.push({
        severity: 'critical',
        title: `Error rate at ${errRate.toFixed(1)}%`,
        detail: `Your aggregate AI error rate exceeds 5%. Common causes: rate limiting (429), auth failures, model overload. Industry target: <1%.`,
        action: 'Check error breakdown by provider and model. Set up auto-scaling or fallback provider workflows.',
        link: '/health',
        linkLabel: 'Health Dashboard',
      });
    }

    // Warning findings
    if (svcCount > 0 && svcWithTokens === 0) {
      findings.push({
        severity: 'warning',
        title: 'No token telemetry on any service',
        detail: `All ${svcCount} services are missing gen_ai.usage.input_tokens / output_tokens. Without this, cost tracking and token efficiency analysis are blind.`,
        action: 'Enable gen_ai.usage.* attributes in your OTel instrumentation. This is the single highest-impact improvement.',
        link: '/developer-experience',
        linkLabel: 'Developer Experience',
      });
    } else if (svcCount > 0 && svcWithTokens < svcCount) {
      findings.push({
        severity: 'warning',
        title: `Token telemetry gap: ${svcCount - svcWithTokens} service${svcCount - svcWithTokens !== 1 ? 's' : ''} missing`,
        detail: `${svcWithTokens}/${svcCount} services report token usage. The remaining ${svcCount - svcWithTokens} are invisible to cost tracking.`,
        action: 'Add gen_ai.usage.* attributes to the uncovered services for full FinOps visibility.',
        link: '/finops',
        linkLabel: 'FinOps',
      });
    }

    if (providerCount === 1 && svcCount > 0) {
      findings.push({
        severity: 'warning',
        title: `Single-provider dependency: ${[...uniqueProviders][0]}`,
        detail: 'All AI traffic routes through one provider. This creates concentration risk for availability, pricing, and compliance.',
        action: 'Consider adding a fallback provider. GCC can compare latency, cost, and error rates across providers.',
        link: '/finops',
        linkLabel: 'FinOps',
      });
    }

    if (svcCount > 0 && svcWithBoth < svcCount) {
      findings.push({
        severity: 'warning',
        title: `Incomplete attribution: ${svcCount - svcWithBoth} service${svcCount - svcWithBoth !== 1 ? 's' : ''} missing provider or model`,
        detail: `${svcWithBoth}/${svcCount} services have both gen_ai.provider.name and gen_ai.request.model. Incomplete attribution limits governance and cost analysis.`,
        action: 'Ensure all AI services emit both provider and model attributes in their gen_ai spans.',
        link: '/governance',
        linkLabel: 'Governance',
      });
    }

    if (agentCount === 0 && svcCount > 0) {
      findings.push({
        severity: 'warning',
        title: 'No agent tracing enabled',
        detail: 'Agentic AI workflows (tool calls, chain-of-thought, multi-step reasoning) are not being traced. You have no visibility into autonomous AI behavior.',
        action: 'Instrument agent frameworks with gen_ai tool-call spans to enable the Agent Analytics page.',
        link: '/agent-tools',
        linkLabel: 'Agent Analytics',
      });
    }

    // Informational findings
    if (errRate <= 1 && requestVol > 0 && criticalCount === 0) {
      findings.push({
        severity: 'info',
        title: 'Reliability is strong',
        detail: `${errRate.toFixed(1)}% error rate with ${healthyCount}/${svcCount} healthy services. This meets DORA "Elite" performance band (<1%).`,
        action: 'Consider setting up SLO-based alerting to protect this level of performance.',
        link: '/operations',
        linkLabel: 'Operations',
      });
    }

    if (coveredCount === totalChecks) {
      findings.push({
        severity: 'info',
        title: 'Full observability coverage',
        detail: 'All telemetry surfaces are active — service discovery, token metrics, cost tracking, attribution, agent tracing, and health monitoring.',
        action: 'Explore AI Quality and Conversation Intelligence for deeper analysis.',
        link: '/ai-quality',
        linkLabel: 'AI Quality',
      });
    }

    // Sort: critical → warning → info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Overall status color based on worst finding
    const worstSeverity = findings.length > 0 ? findings[0].severity : 'info';
    const statusColor = worstSeverity === 'critical' ? STATUS_COLORS.critical
      : worstSeverity === 'warning' ? STATUS_COLORS.warning
      : STATUS_COLORS.ideal;

    return {
      coverageChecks,
      coveredCount,
      totalChecks,
      coveragePercent,
      findings,
      statusColor,
    };
  }, [services, healthMetrics, agentSummary, chartTotals]);

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
              <StatCard 
                icon={<AgentIcon style={{ width: 18, height: 18 }} aria-hidden="true" />} 
                label="Agents" 
                value={agentSummary?.totalAgents ?? 0}
              />
            </Flex>
          ) : (
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>No AI services discovered</Text>
          )}
      </Flex>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION: Usage & Cost Trends */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {healthMetrics && (
        <>
          <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
            <BarChartIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
            <Text textStyle="small" style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)', letterSpacing: '0.5px' }}>Usage & Cost Trends</Text>
          </Flex>

          {/* Usage & Cost Grid - 2 per row for readability */}
          <Flex style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', 
            gap: 16,
          }}>
            {/* Token Trend - Real DQL Timeseries */}
            <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={8}>
                  <BarChartIcon style={{ width: 14, height: 14, color: CHART_COLORS.primary }} aria-hidden="true" />
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Token Usage Trend</Text>
                  <Tooltip text="Total tokens (input + output) consumed over time by provider. Each color = different provider. Spikes indicate high usage periods. 1K tokens ≈ 750 words.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Text style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.primary }}>{formatNumber(chartTotals.tokens)}</Text>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <BarChartIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No token data in timeframe</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Cost Trend</Text>
                  <Tooltip text="Estimated costs based on token usage × provider pricing. Uses public rates (OpenAI $0.50-$15/MTok). Watch for unexpected spikes indicating cost anomalies.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Text style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.warning }}>{formatCurrency(chartTotals.cost)}</Text>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <MoneyIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No cost data in timeframe</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Request Volume</Text>
                  <Tooltip text="Total number of AI API calls (chat completions, embeddings, etc.) over time. Higher volume = more active usage. Each request consumes tokens and incurs cost.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Text style={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.secondary }}>
                  {formatNumber(chartTotals.requests)}
                </Text>
              </Flex>
              {trendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ServicesIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No request data in timeframe</Text>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* Token Distribution by Provider - DonutChart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <AiIcon style={{ width: 14, height: 14, color: CHART_COLORS.tertiary }} />
                <Text style={{ fontSize: 12, fontWeight: 600 }}>Tokens by Provider</Text>
                <Tooltip text="Distribution of token consumption across AI providers. High concentration in one provider = vendor lock-in risk. Consider multi-provider strategy for resilience.">
                  <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              {providerLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                        <Flex style={{ 
                          width: 10, height: 10, borderRadius: 2, 
                          backgroundColor: item.color,
                          flexShrink: 0
                        }} />
                        <Text style={{ color: 'var(--dt-colors-text-secondary-default)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.category}
                        </Text>
                        <Text style={{ fontWeight: 600 }}>
                          {providerData?.find(p => p.provider === item.category)?.percentage.toFixed(0)}%
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              ) : (
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <AiIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No provider data available</Text>
                </Flex>
              )}
            </Flex>
          </Surface>
          </Flex>

          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          {/* SECTION: Performance & Quality */}
          {/* ══════════════════════════════════════════════════════════════════════════════ */}
          <Flex alignItems="center" gap={8} style={{ marginTop: 16 }}>
            <ClockIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
            <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)', letterSpacing: '0.5px' }}>Performance & Quality</Text>
          </Flex>

          {/* Performance Grid - 2 per row for readability */}
          <Flex style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', 
            gap: 16,
          }}>
            {/* Error Rate Trend by Provider - Line Chart */}
            <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={6}>
                  <WarningIcon style={{ width: 14, height: 14, color: CHART_COLORS.critical }} />
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Error Rate by Provider (%)</Text>
                  <Tooltip text="Percentage of failed AI requests per provider. Errors include: rate limits (429), auth failures (401), model overload (503). Target: <1% error rate.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {errorRateTimeseriesData.length > 0 && (
                  <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {errorRateTimeseriesData.length} provider{errorRateTimeseriesData.length > 1 ? 's' : ''} with errors
                  </Text>
                )}
              </Flex>
              {errorTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <WarningIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No errors in timeframe 🎉</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>P95 Latency by Provider (ms)</Text>
                  <Tooltip text="95th percentile response time. P95 means 95% of requests complete faster than this. Higher values = slower responses. Compare providers to identify performance differences.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {latencyTimeseriesData.length > 0 && (
                  <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {latencyTimeseriesData.length} provider{latencyTimeseriesData.length > 1 ? 's' : ''}
                  </Text>
                )}
              </Flex>
              {latencyTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ClockIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No latency data available</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Token Efficiency by Provider</Text>
                  <Tooltip text="Output/Input token ratio. Higher = more output per input (efficient). Values <0.5 suggest large prompts with small responses (potential waste). Optimize by reducing context size.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {efficiencyTimeseriesData.length > 0 && (
                  <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    output/input ratio
                  </Text>
                )}
              </Flex>
              {efficiencyTrendLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <ServiceLevelObjectivesIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No token data available</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>Model Usage Trend</Text>
                  <Tooltip text="Request count by model over time. Shows which models are most used. Use this to identify model popularity, plan capacity, and detect unexpected model switches.">
                    <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {modelUsageTimeseriesData.length > 0 && (
                  <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    Top {modelUsageTimeseriesData.length} models
                  </Text>
                )}
              </Flex>
              {modelUsageLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180 }}>
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
                <Flex justifyContent="center" alignItems="center" flexDirection="column" gap={4} style={{ height: 180, color: 'var(--dt-colors-text-secondary-default)' }}>
                  <AiIcon style={{ width: 24, height: 24, opacity: 0.3 }} />
                  <Text style={{ fontSize: 11 }}>No model usage data available</Text>
                </Flex>
              )}
            </Flex>
          </Surface>
          </Flex>
        </>
      )}

      {/* ─── AI Observability Insights ─── */}
      <Surface style={{ padding: 20 }}>
        <Flex flexDirection="column" gap={16}>
          {/* Header row */}
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <ResearchIcon style={{ color: aiInsights.statusColor }} />
              <Text style={{ fontWeight: 700, fontSize: 16 }}>AI Observability Insights</Text>
              <Tooltip text="Coverage shows which telemetry surfaces GCC can see. Findings are actionable, data-driven recommendations.">
                <Flex
                  onClick={() => setShowMaturityModal(true)}
                  style={{ cursor: 'pointer', color: 'var(--dt-colors-text-secondary-default)' }}
                  aria-label="View details"
                >
                  <HelpIcon style={{ width: 16, height: 16 }} />
                </Flex>
              </Tooltip>
            </Flex>
            {/* Coverage percentage badge */}
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Telemetry Coverage</Text>
              <Text style={{
                fontSize: 20, fontWeight: 800,
                color: aiInsights.coveragePercent === 100 ? STATUS_COLORS.ideal
                  : aiInsights.coveragePercent >= 70 ? STATUS_COLORS.good
                  : aiInsights.coveragePercent >= 40 ? STATUS_COLORS.warning
                  : STATUS_COLORS.critical,
              }}>
                {aiInsights.coveragePercent}%
              </Text>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                ({aiInsights.coveredCount}/{aiInsights.totalChecks})
              </Text>
            </Flex>
          </Flex>

          {/* Coverage checks — responsive horizontal grid */}
          <Flex style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {aiInsights.coverageChecks.map((check) => (
              <Tooltip key={check.label} text={check.detail}>
                <Flex
                  alignItems="center"
                  gap={6}
                  padding={8}
                  style={{
                    borderRadius: 6,
                    background: check.covered
                      ? `${STATUS_COLORS.ideal}12`
                      : 'var(--dt-colors-background-base-default)',
                    border: `1px solid ${check.covered ? `${STATUS_COLORS.ideal}40` : 'var(--dt-colors-border-neutral-default)'}`,
                    cursor: 'default',
                  }}
                >
                  {check.covered
                    ? <CheckmarkIcon style={{ width: 14, height: 14, color: STATUS_COLORS.ideal, flexShrink: 0 }} />
                    : <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.warning, flexShrink: 0 }} />
                  }
                  <Text style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.2 }}>{check.label}</Text>
                </Flex>
              </Tooltip>
            ))}
          </Flex>

          {/* Findings */}
          {aiInsights.findings.length > 0 && (
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)', letterSpacing: '0.5px' }}>
                  Findings ({aiInsights.findings.filter(f => f.severity !== 'info').length} action{aiInsights.findings.filter(f => f.severity !== 'info').length !== 1 ? 's' : ''} needed)
                </Text>
              </Flex>
              <Flex style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
                {aiInsights.findings.slice(0, 6).map((finding, i) => {
                  const findingColor = finding.severity === 'critical' ? STATUS_COLORS.critical
                    : finding.severity === 'warning' ? STATUS_COLORS.warning
                    : STATUS_COLORS.ideal;
                  return (
                    <Surface
                      key={i}
                      padding={12}
                      style={{
                        borderRadius: 8,
                        borderLeft: `3px solid ${findingColor}`,
                      }}
                    >
                      <Flex flexDirection="column" gap={6}>
                        <Flex justifyContent="space-between" alignItems="flex-start" gap={8}>
                          <Flex alignItems="center" gap={6} style={{ flex: 1 }}>
                            {finding.severity === 'critical' && <CriticalIcon style={{ width: 14, height: 14, color: findingColor, flexShrink: 0 }} />}
                            {finding.severity === 'warning' && <WarningIcon style={{ width: 14, height: 14, color: findingColor, flexShrink: 0 }} />}
                            {finding.severity === 'info' && <CheckmarkIcon style={{ width: 14, height: 14, color: findingColor, flexShrink: 0 }} />}
                            <Text style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{finding.title}</Text>
                          </Flex>
                          <Link to={finding.link} style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <Text style={{ fontSize: 10, fontWeight: 600, color: CHART_COLORS.primary, padding: '2px 8px', borderRadius: 4, background: `${CHART_COLORS.primary}14`, whiteSpace: 'nowrap' }}>
                              {finding.linkLabel} →
                            </Text>
                          </Link>
                        </Flex>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', lineHeight: 1.5 }}>
                          {finding.detail}
                        </Text>
                      </Flex>
                    </Surface>
                  );
                })}
              </Flex>
            </Flex>
          )}
        </Flex>
      </Surface>

      {/* ─── AI Observability Insights Detail Modal ─── */}
      <Modal
        title="AI Observability Insights"
        show={showMaturityModal}
        onDismiss={() => setShowMaturityModal(false)}
        size="large"
      >
        <Flex flexDirection="column" gap={20}>

          {/* Coverage overview */}
          <Flex alignItems="center" gap={16}>
            <Flex flexDirection="column" alignItems="center" gap={2}>
              <Text style={{
                fontSize: 52, fontWeight: 800, lineHeight: 1,
                color: aiInsights.coveragePercent === 100 ? STATUS_COLORS.ideal
                  : aiInsights.coveragePercent >= 70 ? STATUS_COLORS.good
                  : aiInsights.coveragePercent >= 40 ? STATUS_COLORS.warning
                  : STATUS_COLORS.critical,
              }}>
                {aiInsights.coveragePercent}%
              </Text>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>coverage</Text>
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Paragraph>
                <Strong>Telemetry Coverage</Strong> measures which gen_ai observability surfaces GCC can see in your environment.
                Each check is binary — the data is either flowing or it isn't. This is not a score with subjective weights;
                it's a factual inventory of your instrumentation.
              </Paragraph>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                {aiInsights.coveredCount} of {aiInsights.totalChecks} telemetry surfaces active
              </Text>
            </Flex>
          </Flex>

          {/* Coverage detail table */}
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontWeight: 700, fontSize: 14 }}>Coverage Breakdown</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--dt-colors-background-base-default)' }}>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', width: 40 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>Telemetry Surface</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {aiInsights.coverageChecks.map((check, i) => (
                  <tr key={check.label} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--dt-colors-background-base-default)' }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {check.covered
                        ? <CheckmarkIcon style={{ width: 16, height: 16, color: STATUS_COLORS.ideal }} />
                        : <CriticalIcon style={{ width: 16, height: 16, color: STATUS_COLORS.warning }} />
                      }
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{check.label}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--dt-colors-text-secondary-default)', textTransform: 'capitalize' }}>{check.category}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--dt-colors-text-secondary-default)' }}>{check.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Flex>

          {/* Findings detail */}
          {aiInsights.findings.length > 0 && (
            <Flex flexDirection="column" gap={8}>
              <Text style={{ fontWeight: 700, fontSize: 14 }}>Findings & Recommendations</Text>
              <Paragraph style={{ fontSize: 12 }}>
                Findings are auto-generated from your live telemetry. Each maps to a specific action and a page in GCC
                where you can investigate further. Critical findings indicate active issues; warnings highlight gaps
                in observability coverage.
              </Paragraph>
              {aiInsights.findings.map((finding, i) => {
                const findingColor = finding.severity === 'critical' ? STATUS_COLORS.critical
                  : finding.severity === 'warning' ? STATUS_COLORS.warning
                  : STATUS_COLORS.ideal;
                return (
                  <Surface
                    key={i}
                    padding={12}
                    style={{
                      borderRadius: 8,
                      borderLeft: `4px solid ${findingColor}`,
                    }}
                  >
                    <Flex flexDirection="column" gap={8}>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Flex alignItems="center" gap={8}>
                          {finding.severity === 'critical' && <CriticalIcon style={{ width: 16, height: 16, color: findingColor }} />}
                          {finding.severity === 'warning' && <WarningIcon style={{ width: 16, height: 16, color: findingColor }} />}
                          {finding.severity === 'info' && <CheckmarkIcon style={{ width: 16, height: 16, color: findingColor }} />}
                          <Text style={{ fontWeight: 700, fontSize: 13 }}>{finding.title}</Text>
                        </Flex>
                        <Text style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
                          color: findingColor, background: `${findingColor}18`,
                        }}>
                          {finding.severity}
                        </Text>
                      </Flex>
                      <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)', lineHeight: 1.6 }}>
                        {finding.detail}
                      </Text>
                      <Flex justifyContent="space-between" alignItems="center" style={{ paddingTop: 4, borderTop: '1px solid var(--dt-colors-border-neutral-default)' }}>
                        <Text style={{ fontSize: 11, fontWeight: 500 }}>
                          <Strong>Action:</Strong> {finding.action}
                        </Text>
                        <Link to={finding.link} onClick={() => setShowMaturityModal(false)} style={{ textDecoration: 'none', flexShrink: 0 }}>
                          <Button variant="default" style={{ fontSize: 11 }}>
                            {finding.linkLabel} →
                          </Button>
                        </Link>
                      </Flex>
                    </Flex>
                  </Surface>
                );
              })}
            </Flex>
          )}

          {/* Dynatrace Intelligence CTA */}
          <Surface padding={16} style={{ borderRadius: 8, background: `${STATUS_COLORS.good}18`, border: `1px solid ${STATUS_COLORS.good}40` }}>
            <Flex alignItems="center" gap={12} justifyContent="space-between" flexWrap="wrap">
              <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                <Flex alignItems="center" gap={8}>
                  <AiIcon style={{ color: STATUS_COLORS.good, width: 18, height: 18 }} />
                  <Text style={{ fontWeight: 700, fontSize: 13 }}>Deep-Dive with Dynatrace Intelligence</Text>
                </Flex>
                <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', lineHeight: 1.5 }}>
                  Ask Dynatrace Intelligence to analyze your AI infrastructure, correlate findings across services, and recommend prioritized actions.
                </Text>
              </Flex>
              <Link to="/intelligence" onClick={() => setShowMaturityModal(false)} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <Button variant="emphasized">
                  Ask Dynatrace Intelligence
                </Button>
              </Link>
            </Flex>
          </Surface>

        </Flex>
      </Modal>
    </Flex>
  );
};
