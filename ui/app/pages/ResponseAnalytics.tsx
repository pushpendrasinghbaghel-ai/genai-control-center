// Response Analytics Dashboard — Redesigned
// Story: "Your AI services cost more than they should, deliver inconsistent answers,
// and one provider may be silently downgrading your model. Here are the services to fix today."
// Personas: SREs (error/latency), FinOps (token waste/cost), ML Engineers (model behavior), Product (truncation UX)

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { RefreshIcon, BarChartIcon, ServicesIcon, WarningIcon, CheckmarkIcon, HelpIcon, ChevronLeftIcon, ChevronRightIcon, CriticalIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { formatTime, formatNumber } from '../utils/formatting';

import {
  useResponseAnalytics,
  useResponseQualityTrends,
  useStreamingAnalysis,
  type TokenEfficiencyMetrics,
  type ModelComparison,
  type StreamingBatchEntry,
} from '../hooks/useResponseAnalytics';

import {
  useContentViewer,
  useFinishReasonAnalytics,
  useModelAliasing,
  usePromptLengthTrends,
  type FinishReasonBreakdown,
  type PromptResponseEntry,
} from '../hooks/useResponseContent';

// Status colors from Strato design tokens
const STATUS_COLORS = {
  excellent: Colors.Charts.Apdex.Excellent.Default,
  fair: Colors.Charts.Apdex.Fair.Default,
  poor: Colors.Charts.Apdex.Poor.Default,
};

// ============================================
// Helper: compute per-model truncation alerts
// ============================================
interface TruncationAlert extends FinishReasonBreakdown {
  truncationRate: number;
}

function computeTruncationAlerts(finishBreakdown: FinishReasonBreakdown[]): TruncationAlert[] {
  const totalByModel = new Map<string, number>();
  finishBreakdown.forEach(f => {
    const key = `${f.provider}:${f.model}`;
    totalByModel.set(key, (totalByModel.get(key) || 0) + f.count);
  });
  return finishBreakdown
    .filter(f => f.finishReason === 'length')
    .map(f => ({
      ...f,
      truncationRate: ((f.count / (totalByModel.get(`${f.provider}:${f.model}`) || f.count)) * 100),
    }))
    .filter(f => f.truncationRate >= 5)
    .sort((a, b) => b.truncationRate - a.truncationRate);
}

// Metric explanations for tooltips
const METRIC_TOOLTIPS = {
  tokenRatio: "Output tokens divided by input tokens. Higher ratio means the model generates more output per input token. Low ratio (<0.5x) with high input may indicate inefficient prompts.",
  inefficient: "Services with Token Ratio < 0.5x and >100 input tokens. These may benefit from prompt optimization, compression, or semantic caching.",
  inconsistent: "Services with high output variance (>10,000) or >20% of responses with <10 output tokens. This indicates unpredictable model behavior.",
  efficiencyScore: "Composite score (0-100) based on: Token Ratio (40%), Response Latency (30%), and Cost Efficiency (30%). Higher is better.",
  variance: "Statistical measure of how spread out the output token counts are. High variance means response lengths vary significantly.",
  lowOutputRate: "Percentage of requests that returned fewer than 10 output tokens. High rates may indicate failed or truncated responses.",
  // Response Health tooltips (industry-standard metrics only)
  errorRate: "Percentage of requests that returned errors (otel.status_code = ERROR). Standard SRE reliability metric.",
  avgLatency: "Average response time across all GenAI requests. Standard observability metric.",
  p95Latency: "95th percentile latency - 95% of requests complete faster than this. Standard SLO metric.",
};

// ============================================
// Efficiency Ring Component (SVG-based)
// ============================================
interface EfficiencyRingProps {
  value: number;
  maxValue: number;
  label: string;
  sublabel?: string;
  size?: number;
}

function EfficiencyRing({ value, maxValue, label, sublabel, size = 80 }: EfficiencyRingProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 70) return STATUS_COLORS.excellent;
    if (percentage >= 40) return STATUS_COLORS.fair;
    return STATUS_COLORS.poor;
  };

  return (
    <Flex flexDirection="column" alignItems="center" gap={4}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke='var(--dt-colors-border-neutral-default)'
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={size / 4}
          fontWeight="bold"
          fill="var(--dt-colors-text-primary-default)"
        >
          {typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 0) : value}
        </text>
      </svg>
      <Text textStyle="small-emphasized">{label}</Text>
      {sublabel && <Text textStyle="small" style={{ opacity: 0.7 }}>{sublabel}</Text>}
    </Flex>
  );
}

// ============================================
// Model Efficiency Card
// ============================================
interface ModelCardProps {
  model: ModelComparison;
  rank: number;
}

function ModelCard({ model, rank }: ModelCardProps) {
  return (
    <Surface style={{ padding: '16px', minWidth: '220px', flex: '1 1 220px' }}>
      <Flex flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={8}>
          <Flex style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: rank === 1 ? STATUS_COLORS.excellent : 'var(--dt-colors-border-neutral-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: rank === 1 ? 'white' : '#333',
            fontWeight: 'bold'
          }}>
            #{rank}
          </Flex>
          <Flex flexDirection="column">
            <Text textStyle="base-emphasized">{model.model}</Text>
            <Text textStyle="small" style={{ opacity: 0.7 }}>{model.provider}</Text>
          </Flex>
        </Flex>

        <Tooltip text={METRIC_TOOLTIPS.efficiencyScore}>
          <Flex>
            <EfficiencyRing
              value={model.efficiencyScore}
              maxValue={100}
              label="Efficiency Score"
              sublabel={`${formatNumber(model.totalRequests)} requests`}
              size={80}
            />
          </Flex>
        </Tooltip>

        <Flex flexDirection="column" gap={8}>
          <Flex justifyContent="space-between">
            <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
              <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                <Text textStyle="small">Token Ratio</Text>
                <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
              </Flex>
            </Tooltip>
            <Text textStyle="small-emphasized">{model.avgTokenRatio.toFixed(2)}x</Text>
          </Flex>
          <Flex justifyContent="space-between">
            <Text textStyle="small">Avg Latency</Text>
            <Text textStyle="small-emphasized">{model.avgLatency.toFixed(0)}ms</Text>
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.7 }}>
            Est. ${model.estimatedCostPer1K.toFixed(2)}/1K requests
          </Text>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Model Rankings with Pagination
// ============================================
const MODELS_PER_PAGE = 6;

function ModelRankingsPaginated({ models }: { models: ModelComparison[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(models.length / MODELS_PER_PAGE));
  const startIdx = page * MODELS_PER_PAGE;
  const pageModels = models.slice(startIdx, startIdx + MODELS_PER_PAGE);

  // Reset to first page when models change
  useEffect(() => {
    setPage(0);
  }, [models.length]);

  if (models.length === 0) return null;

  return (
    <Flex flexDirection="column" gap={16}>
      <Flex gap={16} flexWrap="wrap">
        {pageModels.map((model, idx) => (
          <ModelCard key={`${model.provider}-${model.model}`} model={model} rank={startIdx + idx + 1} />
        ))}
      </Flex>

      {totalPages > 1 && (
        <Flex justifyContent="space-between" alignItems="center">
          <Text textStyle="small" style={{ opacity: 0.7 }}>
            Showing {startIdx + 1}–{Math.min(startIdx + MODELS_PER_PAGE, models.length)} of {models.length} models
          </Text>
          <Flex alignItems="center" gap={8}>
            <Button
              variant="default"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <Button.Prefix><ChevronLeftIcon /></Button.Prefix>
              Previous
            </Button>
            <Text textStyle="small-emphasized">
              Page {page + 1} of {totalPages}
            </Text>
            <Button
              variant="default"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              Next
              <Button.Suffix><ChevronRightIcon /></Button.Suffix>
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

// ============================================
// Service Row Component
// ============================================
interface ServiceRowProps {
  metric: TokenEfficiencyMetrics;
}

function ServiceRow({ metric }: ServiceRowProps) {
  return (
    <Surface style={{ padding: '12px', marginBottom: '8px' }}>
      <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
        <Flex flexDirection="column" gap={4} style={{ minWidth: '200px', flex: '1' }}>
          <Flex alignItems="center" gap={8}>
            <Text textStyle="base-emphasized">{metric.serviceName}</Text>
            {metric.inefficient && (
              <Tooltip text="Low token efficiency - high input, low output">
                <Text style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: STATUS_COLORS.poor,
                  color: 'white',
                  fontSize: '10px'
                }}>
                  Inefficient
                </Text>
              </Tooltip>
            )}
            {metric.inconsistent && (
              <Tooltip text="High output variance - inconsistent responses">
                <Text style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: STATUS_COLORS.fair,
                  color: 'white',
                  fontSize: '10px'
                }}>
                  Inconsistent
                </Text>
              </Tooltip>
            )}
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.7 }}>{metric.model} • {metric.provider}</Text>
        </Flex>

        <Flex gap={24} alignItems="center" flexWrap="wrap">
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Requests</Text>
            <Text textStyle="base-emphasized">{formatNumber(metric.requestCount)}</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Token Ratio</Text>
            </Tooltip>
            <Text style={{ 
              color: metric.inefficient ? STATUS_COLORS.poor : 'inherit',
              fontWeight: metric.inefficient ? 600 : 400
            }}>
              {metric.tokenRatio.toFixed(2)}x
            </Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Avg In/Out</Text>
            <Text textStyle="small">{metric.avgInputTokens.toFixed(0)} ? {metric.avgOutputTokens.toFixed(0)}</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Tooltip text={METRIC_TOOLTIPS.variance}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Variance</Text>
            </Tooltip>
            <Text style={{ 
              color: metric.inconsistent ? STATUS_COLORS.fair : 'inherit',
              fontWeight: metric.inconsistent ? 600 : 400
            }}>
              {metric.outputVariance.toFixed(0)}
            </Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Latency</Text>
            <Text textStyle="small">{metric.avgLatency.toFixed(0)}ms</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Cost</Text>
            <Text textStyle="small">${metric.estimatedCost.toFixed(2)}</Text>
          </Flex>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Streaming DataTable column definitions
// ============================================
function useStreamingColumns() {
  return useMemo(() => [
    {
      id: 'mode',
      header: 'Mode',
      accessor: (row: StreamingBatchEntry) => row.mode,
      cell: ({ value }: { value: string }) => (
        <Text style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: value === 'Streaming'
            ? 'var(--dt-colors-surface-statusok-subdued)'
            : 'var(--dt-colors-surface-neutral-default)',
          color: value === 'Streaming' ? STATUS_COLORS.excellent : 'inherit',
        }}>
          {value}
        </Text>
      ),
    },
    { id: 'provider', header: 'Provider', accessor: 'provider' },
    { id: 'model', header: 'Model', accessor: 'model' },
    {
      id: 'requests',
      header: 'Requests',
      accessor: (row: StreamingBatchEntry) => formatNumber(row.requestCount),
    },
    {
      id: 'avgLatency',
      header: 'Avg Latency',
      accessor: (row: StreamingBatchEntry) => row.avgLatencyMs >= 1000
        ? `${(row.avgLatencyMs / 1000).toFixed(2)}s`
        : `${Math.round(row.avgLatencyMs)}ms`,
    },
    {
      id: 'p95Latency',
      header: 'P95 Latency',
      accessor: (row: StreamingBatchEntry) => row.p95LatencyMs >= 1000
        ? `${(row.p95LatencyMs / 1000).toFixed(2)}s`
        : `${Math.round(row.p95LatencyMs)}ms`,
    },
    {
      id: 'avgOutput',
      header: 'Avg Output',
      accessor: (row: StreamingBatchEntry) => Math.round(row.avgOutputTokens),
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessor: (row: StreamingBatchEntry) => row.errorRate,
      cell: ({ value }: { value: number }) => (
        <Text style={{
          color: value > 5 ? STATUS_COLORS.poor
            : value > 1 ? STATUS_COLORS.fair
            : STATUS_COLORS.excellent,
        }}>
          {value.toFixed(2)}%
        </Text>
      ),
    },
  ], []);
}

// ============================================
// Content viewer DataTable column definitions
// ============================================
function useContentColumns() {
  return useMemo(() => [
    {
      id: 'timestamp',
      header: 'Time',
      accessor: (row: PromptResponseEntry) => formatTime(row.timestamp),
    },
    { id: 'provider', header: 'Provider', accessor: 'provider' },
    { id: 'requestModel', header: 'Model', accessor: 'requestModel' },
    {
      id: 'finishReason',
      header: 'Finish',
      accessor: (row: PromptResponseEntry) => row.finishReason,
      cell: ({ value }: { value: string }) => (
        <Text style={{ color: value === 'length' ? STATUS_COLORS.fair : 'inherit', fontWeight: value === 'length' ? 600 : 400 }}>
          {value || '—'}
        </Text>
      ),
    },
    { id: 'promptPreview', header: 'Prompt (preview)', accessor: 'promptPreview' },
    { id: 'responsePreview', header: 'Response (preview)', accessor: 'responsePreview' },
    {
      id: 'inputTokens',
      header: 'In Tokens',
      accessor: (row: PromptResponseEntry) => row.inputTokens,
    },
    {
      id: 'outputTokens',
      header: 'Out Tokens',
      accessor: (row: PromptResponseEntry) => row.outputTokens,
    },
    {
      id: 'duration',
      header: 'Duration',
      accessor: (row: PromptResponseEntry) => `${(row.durationMs / 1000).toFixed(2)}s`,
    },
  ], []);
}

// ============================================
// Main Response Analytics Page
// ============================================

/** Create a default Timeframe object (last 2 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-2h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});


/** Convert Timeframe to simple string for hook */
const getTimeframeString = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-2h';
  if (from === 'now()-1h') return '1h';
  if (from === 'now()-6h') return '6h';
  if (from === 'now()-12h') return '12h';
  if (from === 'now()-7d') return '7d';
  if (from === 'now()-30d') return '30d';
  return '2h';
};

export function ResponseAnalytics() {
  const { metrics, modelComparisons, loading, error, summary, analyzeResponses } = useResponseAnalytics();
  const { trendData, summary: qualitySummary, loading: qualityLoading, analyzeQualityTrends } = useResponseQualityTrends();
  const { entries: streamingEntries, summary: streamingSummary, loading: streamingLoading, analyze: analyzeStreaming } = useStreamingAnalysis();
  const { entries: contentEntries, loading: contentLoading, fetchContent } = useContentViewer();
  const { breakdown: finishBreakdown, summary: finishSummary, loading: finishLoading, analyze: analyzeFinish } = useFinishReasonAnalytics();
  const { aliases, loading: aliasLoading, detect: detectAliases } = useModelAliasing();
  const { trends: lengthTrends, loading: trendsLoading, fetchTrends } = usePromptLengthTrends();

  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [activeTab, setActiveTab] = useState<'alerts' | 'quality' | 'intelligence' | 'trends' | 'evidence'>('alerts');

  const timeframeString = useMemo(() => getTimeframeString(timeframe), [timeframe]);
  const streamingColumns = useStreamingColumns();
  const contentColumns = useContentColumns();

  const refreshAll = useCallback((tf: string) => {
    analyzeResponses(tf);
    analyzeQualityTrends(tf);
    analyzeStreaming(tf);
    fetchContent(tf);
    analyzeFinish(tf);
    detectAliases(tf);
    fetchTrends(tf);
  }, [analyzeResponses, analyzeQualityTrends, analyzeStreaming, fetchContent, analyzeFinish, detectAliases, fetchTrends]);

  useEffect(() => { refreshAll(timeframeString); }, [timeframeString, refreshAll]);

  // Derived alert data
  const aliasMismatches = useMemo(() => aliases.filter(a => a.isMismatch), [aliases]);
  const truncationAlerts = useMemo(() => computeTruncationAlerts(finishBreakdown), [finishBreakdown]);
  const inefficientServices = useMemo(() => summary?.topInefficient ?? [], [summary]);
  const inconsistentServices = useMemo(() => summary?.topInconsistent ?? [], [summary]);
  const totalAlerts = aliasMismatches.length + truncationAlerts.length + inefficientServices.length + inconsistentServices.length;

  const overallTruncationPct = useMemo(() => {
    const lengthItem = finishSummary?.finishReasonDistribution.find(d => d.reason === 'length');
    return lengthItem?.pct ?? 0;
  }, [finishSummary]);

  // Chart data
  const qualityChartData: Timeseries[] = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return [
      { name: 'Error Rate (%)', datapoints: trendData.map(d => ({ start: new Date(d.timestamp), value: d.errorRate })) },
      { name: 'Avg Latency (s)', datapoints: trendData.map(d => ({ start: new Date(d.timestamp), value: d.avgLatencyMs / 1000 })) },
    ];
  }, [trendData]);

  const lengthChartData: Timeseries[] = useMemo(() => {
    if (!lengthTrends || lengthTrends.length === 0) return [];
    return [
      { name: 'Avg Prompt Length (chars)', datapoints: lengthTrends.map(d => ({ start: d.timeBucket, value: d.avgPromptLength })) },
      { name: 'Avg Response Length (chars)', datapoints: lengthTrends.map(d => ({ start: d.timeBucket, value: d.avgResponseLength })) },
    ];
  }, [lengthTrends]);

  const anyLoading = loading || aliasLoading || finishLoading;

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Title>Response Analytics</TitleBar.Title>
        <TitleBar.Subtitle>
          Token efficiency, truncation detection, model integrity, and response health — for SREs, FinOps, ML Engineers, and Product
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <TimeframeSelector
              value={timeframe}
              onChange={(tf) => tf && setTimeframe(tf)}
              aria-label="Select time range"
            />
            <Button onClick={() => refreshAll(timeframeString)} aria-label="Refresh analytics">
              <Button.Prefix><RefreshIcon /></Button.Prefix>
              Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* -- Model Aliasing Alert Banner --------------------------- */}
      {aliasMismatches.length > 0 && (
        <Surface style={{
          padding: '12px 20px',
          borderLeft: `4px solid ${STATUS_COLORS.poor}`,
          backgroundColor: 'var(--dt-colors-surface-critical-subdued)',
        }}>
          <Flex alignItems="center" gap={12} flexWrap="wrap">
            <CriticalIcon style={{ color: STATUS_COLORS.poor, flexShrink: 0 }} />
            <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
              <Text textStyle="base-emphasized" style={{ color: STATUS_COLORS.poor }}>
                Provider Override Detected: {aliasMismatches.length} model {aliasMismatches.length === 1 ? 'mismatch' : 'mismatches'} found
              </Text>
              <Text textStyle="small">
                You requested one model, but the provider served a different one.
                This may affect response quality and cost. See the <strong>Alerts</strong> tab for details.
              </Text>
            </Flex>
            <Button variant="default" onClick={() => setActiveTab('alerts')}>
              View Alerts
            </Button>
          </Flex>
        </Surface>
      )}

      {/* -- Summary KPI Row --------------------------------------- */}
      {summary && (
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: '16px 20px', flex: '1 1 180px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
              <Heading level={3}>{formatNumber(summary.totalRequests)}</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '16px 20px', flex: '1 1 180px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Tokens</Text>
              <Heading level={3}>{(summary.totalTokens / 1_000_000).toFixed(2)}M</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '16px 20px', flex: '1 1 180px' }}>
            <Flex flexDirection="column" gap={4}>
              <Tooltip text="Services with token ratio < 0.5x and >100 avg input tokens. High input, low output = prompt optimization opportunity.">
                <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>Inefficient Services</Text>
                  <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                </Flex>
              </Tooltip>
              <Heading level={3} style={{ color: summary.inefficientServices > 0 ? STATUS_COLORS.poor : 'inherit' }}>
                {summary.inefficientServices}
              </Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '16px 20px', flex: '1 1 180px' }}>
            <Flex flexDirection="column" gap={4}>
              <Tooltip text="Models where finish_reason = 'length' accounts for =5% of their responses. Users received cut-off answers.">
                <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>Truncation Rate</Text>
                  <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                </Flex>
              </Tooltip>
              <Heading level={3} style={{ color: overallTruncationPct > 5 ? STATUS_COLORS.fair : 'inherit' }}>
                {overallTruncationPct.toFixed(1)}%
              </Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>responses cut off</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '16px 20px', flex: '1 1 180px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Active Alerts</Text>
              <Heading level={3} style={{ color: totalAlerts > 0 ? STATUS_COLORS.poor : STATUS_COLORS.excellent }}>
                {totalAlerts}
              </Heading>
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* -- Tab Navigation ---------------------------------------- */}
      <Flex gap={8} style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: '8px' }} flexWrap="wrap">
        <Button variant={activeTab === 'alerts' ? 'accent' : 'default'} onClick={() => setActiveTab('alerts')}>
          <Button.Prefix><WarningIcon /></Button.Prefix>
          Alerts
          {totalAlerts > 0 && (
            <Text style={{ padding: '1px 6px', borderRadius: 10, backgroundColor: STATUS_COLORS.poor, color: 'var(--dt-colors-text-inversed-default)', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
              {totalAlerts}
            </Text>
          )}
        </Button>
        <Button variant={activeTab === 'quality' ? 'accent' : 'default'} onClick={() => setActiveTab('quality')}>
          <Button.Prefix><CheckmarkIcon /></Button.Prefix>
          Response Quality
        </Button>
        <Button variant={activeTab === 'intelligence' ? 'accent' : 'default'} onClick={() => setActiveTab('intelligence')}>
          <Button.Prefix><BarChartIcon /></Button.Prefix>
          Model Intelligence
        </Button>
        <Button variant={activeTab === 'trends' ? 'accent' : 'default'} onClick={() => setActiveTab('trends')}>
          <Button.Prefix><ServicesIcon /></Button.Prefix>
          Trends
        </Button>
        <Button variant={activeTab === 'evidence' ? 'accent' : 'default'} onClick={() => setActiveTab('evidence')}>
          Evidence
        </Button>
      </Flex>

      {/* ------------------------------------------------------------
          TAB 1: ALERTS — Unified triage view
          ------------------------------------------------------------ */}
      {activeTab === 'alerts' && (
        <Flex flexDirection="column" gap={16}>
          {anyLoading && (
            <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>
          )}
          {!anyLoading && totalAlerts === 0 && (
            <Surface style={{ padding: '32px' }}>
              <Flex flexDirection="column" alignItems="center" gap={12}>
                <CheckmarkIcon style={{ color: STATUS_COLORS.excellent, width: 32, height: 32 }} />
                <Heading level={4} style={{ color: STATUS_COLORS.excellent }}>All Clear</Heading>
                <Text style={{ opacity: 0.7 }}>No model mismatches, truncation alerts, or inefficiency flags detected in this time window.</Text>
              </Flex>
            </Surface>
          )}

          {/* -- A. Provider Override: Model Aliasing Mismatches --- */}
          {aliasMismatches.length > 0 && (
            <Surface style={{ padding: '20px', borderLeft: `3px solid ${STATUS_COLORS.poor}` }}>
              <Flex flexDirection="column" gap={16}>
                <Flex alignItems="center" gap={8}>
                  <CriticalIcon style={{ color: STATUS_COLORS.poor }} />
                  <Heading level={4}>Provider Override — Model Mismatch</Heading>
                  <Tooltip text="You requested a specific model, but the provider silently served a different one. This can mean worse quality, different pricing, and unpredictable behavior — all invisible to traditional monitoring.">
                    <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Text style={{ opacity: 0.8 }}>
                  The following requests received a <strong>different model</strong> than what was requested.
                  Your provider substituted a model — often during peak load or without notification.
                </Text>
                {aliasMismatches.map((a, idx) => (
                  <Surface key={idx} style={{ padding: '12px', borderLeft: `2px solid ${STATUS_COLORS.fair}` }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={12}>
                      <Flex flexDirection="column" gap={4}>
                        <Flex alignItems="center" gap={8}>
                          <Text textStyle="base-emphasized" style={{ color: STATUS_COLORS.poor }}>
                            {a.requestModel}
                          </Text>
                          <Text style={{ opacity: 0.5 }}>? served as ?</Text>
                          <Text textStyle="base-emphasized">{a.responseModel}</Text>
                        </Flex>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Provider: {a.provider}</Text>
                      </Flex>
                      <Flex gap={24} flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Affected Requests</Text>
                          <Text textStyle="base-emphasized">{formatNumber(a.count)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Latency</Text>
                          <Text>{a.avgDurationMs.toFixed(0)}ms</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Output Tokens</Text>
                          <Text>{Math.round(a.avgOutputTokens)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            </Surface>
          )}

          {/* -- B. Truncated Responses --------------------------- */}
          {truncationAlerts.length > 0 && (
            <Surface style={{ padding: '20px', borderLeft: `3px solid ${STATUS_COLORS.fair}` }}>
              <Flex flexDirection="column" gap={16}>
                <Flex alignItems="center" gap={8}>
                  <WarningIcon style={{ color: STATUS_COLORS.fair }} />
                  <Heading level={4}>Truncated Responses — Users Received Incomplete Answers</Heading>
                  <Tooltip text="finish_reason = 'length' means the model hit the token limit mid-response. Error rate is 0%, latency looks fine — but users got cut-off answers. Traditional monitoring misses this entirely.">
                    <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <Text style={{ opacity: 0.8 }}>
                  These models are hitting the <strong>max_tokens limit</strong> before completing their response.
                  Your uptime monitor shows green. Your users see a sentence that ends mid-word.
                </Text>
                {truncationAlerts.map((t, idx) => (
                  <Surface key={idx} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={12}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{t.model}</Text>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>{t.provider}</Text>
                      </Flex>
                      <Flex gap={24} flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Truncation Rate</Text>
                          <Text style={{ color: STATUS_COLORS.fair, fontWeight: 600 }}>{t.truncationRate.toFixed(1)}%</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Requests Cut Off</Text>
                          <Text>{formatNumber(t.count)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Output Tokens</Text>
                          <Text>{Math.round(t.avgOutputTokens)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
                <Text textStyle="small" style={{ opacity: 0.6 }}>
                  Fix: Increase max_tokens in your API call, or shorten the system prompt to leave more room for the response.
                </Text>
              </Flex>
            </Surface>
          )}

          {/* -- C. Inefficient Services ------------------------- */}
          {inefficientServices.length > 0 && (
            <Surface style={{ padding: '20px' }}>
              <Flex flexDirection="column" gap={16}>
                <Flex alignItems="center" gap={8}>
                  <WarningIcon style={{ color: STATUS_COLORS.poor }} />
                  <Heading level={4}>Token Inefficiency — Paying for Input, Getting Minimal Output</Heading>
                  <Tooltip text="Token ratio < 0.5x with > 100 avg input tokens. Large prompts generating tiny responses = money wasted. Consider prompt compression, few-shot removal, or semantic caching.">
                    <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {inefficientServices.map(m => (
                  <Surface key={m.serviceId} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={12}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>{m.model} · {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Token Ratio</Text>
                          <Text style={{ color: STATUS_COLORS.poor, fontWeight: 600 }}>{m.tokenRatio.toFixed(2)}x</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg In / Out</Text>
                          <Text textStyle="small">{m.avgInputTokens.toFixed(0)} ? {m.avgOutputTokens.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Period Cost</Text>
                          <Text>${m.estimatedCost.toFixed(2)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Tooltip text="Rough 30-day projection at current rate — makes the cost impact concrete.">
                            <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                              <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Monthly Waste</Text>
                              <HelpIcon style={{ width: 10, height: 10, opacity: 0.5 }} />
                            </Flex>
                          </Tooltip>
                          <Text style={{ color: STATUS_COLORS.poor, fontWeight: 600 }}>${(m.estimatedCost * 30).toFixed(0)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
                <Text textStyle="small" style={{ opacity: 0.6 }}>
                  Fix: Shorten system prompts, remove redundant context, implement semantic caching for repeated query patterns.
                </Text>
              </Flex>
            </Surface>
          )}

          {/* -- D. Inconsistent Services ---------------------- */}
          {inconsistentServices.length > 0 && (
            <Surface style={{ padding: '20px' }}>
              <Flex flexDirection="column" gap={16}>
                <Flex alignItems="center" gap={8}>
                  <WarningIcon style={{ color: STATUS_COLORS.fair }} />
                  <Heading level={4}>Output Inconsistency — Unpredictable Response Lengths</Heading>
                  <Tooltip text="High standard deviation in output token counts. Some requests get long responses, others get almost nothing — from the same service. Indicates non-deterministic prompts or unguarded open-ended questions.">
                    <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {inconsistentServices.map(m => (
                  <Surface key={`inc-${m.serviceId}`} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={12}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>{m.model} · {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Output Std Dev</Text>
                          <Text style={{ color: STATUS_COLORS.fair, fontWeight: 600 }}>{m.outputStdDev.toFixed(1)} tokens</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Low Output Rate</Text>
                          <Text>{m.lowOutputRate.toFixed(1)}%</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Requests</Text>
                          <Text>{formatNumber(m.requestCount)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
                <Text textStyle="small" style={{ opacity: 0.6 }}>
                  Fix: Add explicit output format instructions, use structured outputs, or set temperature to a lower value.
                </Text>
              </Flex>
            </Surface>
          )}
        </Flex>
      )}

      {/* ------------------------------------------------------------
          TAB 2: RESPONSE QUALITY — Health + Finish Reasons merged
          ------------------------------------------------------------ */}
      {activeTab === 'quality' && (
        <Flex flexDirection="column" gap={16}>
          {qualityLoading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}

          {qualitySummary && (
            <Flex gap={16} flexWrap="wrap">
              <Surface style={{ padding: '20px', flex: '1 1 160px' }}>
                <Flex flexDirection="column" gap={8}>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
                  <Heading level={3}>{formatNumber(qualitySummary.totalRequests)}</Heading>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>in timeframe</Text>
                </Flex>
              </Surface>
              <Tooltip text="% of requests where otel.status_code = ERROR — standard SRE reliability metric.">
                <Surface style={{
                  padding: '20px', flex: '1 1 160px', cursor: 'help',
                  borderLeft: qualitySummary.errorRate > 5 ? `4px solid ${STATUS_COLORS.poor}` : undefined,
                }}>
                  <Flex flexDirection="column" gap={8}>
                    <Flex alignItems="center" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Error Rate</Text>
                      <HelpIcon style={{ width: 11, height: 11, opacity: 0.4 }} />
                    </Flex>
                    <Heading level={3} style={{ color: qualitySummary.errorRate > 5 ? STATUS_COLORS.poor : 'inherit' }}>
                      {qualitySummary.errorRate.toFixed(1)}%
                    </Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>otel.status_code = ERROR</Text>
                  </Flex>
                </Surface>
              </Tooltip>
              <Tooltip text="Average response time for all GenAI span operations.">
                <Surface style={{
                  padding: '20px', flex: '1 1 160px', cursor: 'help',
                  borderLeft: qualitySummary.avgLatencyMs > 5000 ? `4px solid ${STATUS_COLORS.fair}` : undefined,
                }}>
                  <Flex flexDirection="column" gap={8}>
                    <Flex alignItems="center" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Latency</Text>
                      <HelpIcon style={{ width: 11, height: 11, opacity: 0.4 }} />
                    </Flex>
                    <Heading level={3} style={{ color: qualitySummary.avgLatencyMs > 5000 ? STATUS_COLORS.fair : 'inherit' }}>
                      {(qualitySummary.avgLatencyMs / 1000).toFixed(2)}s
                    </Heading>
                  </Flex>
                </Surface>
              </Tooltip>
              <Tooltip text="finish_reason = 'length' — model hit the token limit without completing the response. Users got cut-off answers.">
                <Surface style={{
                  padding: '20px', flex: '1 1 160px', cursor: 'help',
                  borderLeft: overallTruncationPct > 5 ? `4px solid ${STATUS_COLORS.fair}` : undefined,
                }}>
                  <Flex flexDirection="column" gap={8}>
                    <Flex alignItems="center" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Truncation Rate</Text>
                      <HelpIcon style={{ width: 11, height: 11, opacity: 0.4 }} />
                    </Flex>
                    <Heading level={3} style={{ color: overallTruncationPct > 5 ? STATUS_COLORS.fair : 'inherit' }}>
                      {overallTruncationPct.toFixed(1)}%
                    </Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>responses cut off</Text>
                  </Flex>
                </Surface>
              </Tooltip>
            </Flex>
          )}

          {finishSummary && finishSummary.finishReasonDistribution.length > 0 && (
            <Surface style={{ padding: '20px' }}>
              <Flex flexDirection="column" gap={16}>
                <Heading level={5}>Finish Reason Distribution</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  How responses ended. <strong>stop</strong> = complete. <strong>length</strong> = cut off by token limit.
                  <strong> content_filter</strong> = blocked. Other = model-specific signal.
                </Text>
                <Flex gap={12} flexWrap="wrap">
                  {finishSummary.finishReasonDistribution.map(item => {
                    const isStop = item.reason === 'stop';
                    const isLength = item.reason === 'length';
                    const borderColor = isStop ? STATUS_COLORS.excellent : isLength ? STATUS_COLORS.fair : STATUS_COLORS.poor;
                    return (
                      <Surface key={item.reason} style={{ padding: '12px 20px', flex: '1 1 140px', borderLeft: `3px solid ${borderColor}` }}>
                        <Flex flexDirection="column" gap={4}>
                          <Text textStyle="base-emphasized">{item.reason}</Text>
                          <Heading level={4}>{item.pct.toFixed(1)}%</Heading>
                          <Text textStyle="small" style={{ opacity: 0.7 }}>{formatNumber(item.count)} requests</Text>
                        </Flex>
                      </Surface>
                    );
                  })}
                </Flex>
              </Flex>
            </Surface>
          )}

          {finishBreakdown.length > 0 && (
            <Surface style={{ padding: '20px' }}>
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Finish Reasons by Model</Heading>
                <DataTable data={finishBreakdown} columns={[
                  { id: 'provider', header: 'Provider', accessor: 'provider' as const },
                  { id: 'model', header: 'Model', accessor: 'model' as const },
                  {
                    id: 'finishReason',
                    header: 'Finish Reason',
                    accessor: (row: FinishReasonBreakdown) => row.finishReason,
                    cell: ({ value }: { value: string }) => (
                      <Text style={{
                        color: value === 'stop' ? STATUS_COLORS.excellent
                          : value === 'length' ? STATUS_COLORS.fair
                          : STATUS_COLORS.poor,
                        fontWeight: value !== 'stop' ? 600 : 400,
                      }}>
                        {value}
                      </Text>
                    ),
                  },
                  { id: 'count', header: 'Count', accessor: (row: FinishReasonBreakdown) => formatNumber(row.count) },
                  { id: 'avgDuration', header: 'Avg Duration', accessor: (row: FinishReasonBreakdown) => `${(row.avgDurationMs / 1000).toFixed(2)}s` },
                  { id: 'avgOutTokens', header: 'Avg Out Tokens', accessor: (row: FinishReasonBreakdown) => Math.round(row.avgOutputTokens) },
                ]} sortable>
                  <DataTable.Pagination defaultPageSize={10} />
                </DataTable>
              </Flex>
            </Surface>
          )}

          {!qualityLoading && !finishLoading && !qualitySummary && finishBreakdown.length === 0 && (
            <Text style={{ opacity: 0.7 }}>No data available. Ensure your services emit gen_ai.* span attributes.</Text>
          )}
        </Flex>
      )}

      {/* ------------------------------------------------------------
          TAB 3: MODEL INTELLIGENCE — Rankings + Streaming
          ------------------------------------------------------------ */}
      {activeTab === 'intelligence' && (
        <Flex flexDirection="column" gap={16}>
          <Surface style={{ padding: '20px' }}>
            <Flex flexDirection="column" gap={16}>
              <Flex alignItems="center" gap={8}>
                <BarChartIcon />
                <Heading level={4}>Model Efficiency Rankings</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  Composite score: token ratio (40%), latency (30%), cost (30%)
                </Text>
              </Flex>
              {loading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}
              {!loading && modelComparisons.length === 0 && (
                <Text style={{ opacity: 0.7 }}>No model data available. Ensure your services emit gen_ai.* span attributes.</Text>
              )}
              <ModelRankingsPaginated models={modelComparisons} />
            </Flex>
          </Surface>

          <Surface style={{ padding: '20px' }}>
            <Flex flexDirection="column" gap={16}>
              <Flex alignItems="center" gap={8}>
                <Heading level={4}>Streaming vs Batch</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  Latency and throughput by mode (llm.is_streaming attribute)
                </Text>
              </Flex>
              {streamingLoading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}
              {streamingSummary && (
                <Flex gap={16} flexWrap="wrap">
                  <Surface style={{ padding: '16px', flex: '1 1 160px' }}>
                    <Flex flexDirection="column" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Streaming</Text>
                      <Heading level={3}>{streamingSummary.streamingPct.toFixed(1)}%</Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>{formatNumber(streamingSummary.streamingCount)} requests</Text>
                    </Flex>
                  </Surface>
                  <Surface style={{ padding: '16px', flex: '1 1 160px' }}>
                    <Flex flexDirection="column" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Streaming Avg Latency</Text>
                      <Heading level={3}>
                        {streamingSummary.streamingAvgLatency >= 1000
                          ? `${(streamingSummary.streamingAvgLatency / 1000).toFixed(1)}s`
                          : `${Math.round(streamingSummary.streamingAvgLatency)}ms`}
                      </Heading>
                    </Flex>
                  </Surface>
                  <Surface style={{ padding: '16px', flex: '1 1 160px' }}>
                    <Flex flexDirection="column" gap={4}>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>Batch Avg Latency</Text>
                      <Heading level={3}>
                        {streamingSummary.batchAvgLatency >= 1000
                          ? `${(streamingSummary.batchAvgLatency / 1000).toFixed(1)}s`
                          : `${Math.round(streamingSummary.batchAvgLatency)}ms`}
                      </Heading>
                    </Flex>
                  </Surface>
                </Flex>
              )}
              {streamingEntries.length > 0 ? (
                <DataTable data={streamingEntries} columns={streamingColumns} sortable>
                  <DataTable.Pagination defaultPageSize={15} />
                </DataTable>
              ) : !streamingLoading && (
                <Text style={{ opacity: 0.7 }}>
                  No streaming data. Ensure your services have the llm.is_streaming span attribute.
                </Text>
              )}
            </Flex>
          </Surface>

          {metrics.length > 0 && (
            <Surface style={{ padding: '20px' }}>
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>All Services — Token Efficiency Detail</Heading>
                {metrics.map(metric => (
                  <ServiceRow key={metric.serviceId} metric={metric} />
                ))}
              </Flex>
            </Surface>
          )}
        </Flex>
      )}

      {/* ------------------------------------------------------------
          TAB 4: TRENDS — Quality + Content Length over time
          ------------------------------------------------------------ */}
      {activeTab === 'trends' && (
        <Flex flexDirection="column" gap={16}>
          <Surface style={{ padding: '20px' }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <Heading level={4}>Response Health Over Time</Heading>
                <Tooltip text="Error rate and latency plotted over time. Spikes correlate with deployments, traffic changes, or provider incidents.">
                  <HelpIcon style={{ width: 14, height: 14, opacity: 0.4, cursor: 'help' }} />
                </Tooltip>
              </Flex>
              {qualityLoading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}
              {qualityChartData.length > 0 ? (
                <Flex style={{ height: 280 }}>
                  <TimeseriesChart data={qualityChartData}>
                    <TimeseriesChart.Legend />
                  </TimeseriesChart>
                </Flex>
              ) : !qualityLoading && (
                <Text style={{ opacity: 0.7 }}>No trend data. Ensure gen_ai.* span attributes are present.</Text>
              )}
            </Flex>
          </Surface>

          <Surface style={{ padding: '20px' }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <Heading level={4}>Prompt & Response Length Over Time</Heading>
                <Tooltip text="Average character length of prompts and responses over time. Rising prompt length drives token cost. Rising response length may indicate verbosity drift.">
                  <HelpIcon style={{ width: 14, height: 14, opacity: 0.4, cursor: 'help' }} />
                </Tooltip>
              </Flex>
              {trendsLoading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}
              {lengthChartData.length > 0 ? (
                <Flex style={{ height: 280 }}>
                  <TimeseriesChart data={lengthChartData}>
                    <TimeseriesChart.Legend />
                  </TimeseriesChart>
                </Flex>
              ) : !trendsLoading && (
                <Text style={{ opacity: 0.7 }}>
                  No length trend data. Spans need gen_ai.prompt.0.content or gen_ai.completion.0.content attributes.
                </Text>
              )}
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* ------------------------------------------------------------
          TAB 5: EVIDENCE — Raw I/O for debugging
          ------------------------------------------------------------ */}
      {activeTab === 'evidence' && (
        <Flex flexDirection="column" gap={16}>
          <Surface style={{
            padding: '12px 20px',
            borderLeft: `4px solid ${STATUS_COLORS.fair}`,
            backgroundColor: 'var(--dt-colors-surface-warning-subdued)',
          }}>
            <Text textStyle="small">
              <strong>For debugging flagged services only.</strong> This view shows raw LLM prompts and responses.
              Do not share screenshots of this tab publicly. Content is truncated at 300 / 500 chars for display.
            </Text>
          </Surface>
          {contentLoading && <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>}
          {contentEntries.length > 0 ? (
            <DataTable data={contentEntries} columns={contentColumns} sortable resizable>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : !contentLoading && (
            <Text style={{ opacity: 0.7 }}>
              No prompt/response content available.
              Spans need gen_ai.prompt.0.content or gen_ai.completion.0.content attributes.
            </Text>
          )}
        </Flex>
      )}
    </Flex>
  );
}
