// Response Analytics Dashboard
// For ML Engineers & Developers: Token efficiency, output consistency, model comparison
// Based on real observable metrics from OpenTelemetry gen_ai.* spans

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { RefreshIcon, BarChartIcon, ServicesIcon, WarningIcon, CheckmarkIcon, HelpIcon, ArrowUpRightIcon, ArrowDownRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { formatTime, formatNumber } from '../utils/formatting';

import { 
  useResponseAnalytics, 
  useResponseQualityTrends,
  useStreamingAnalysis,
  TokenEfficiencyMetrics, 
  ModelComparison,
  QualityTrendDataPoint,
  QualityAnomaly
} from '../hooks/useResponseAnalytics';

import {
  useContentViewer,
  useFinishReasonAnalytics,
  useModelAliasing,
  usePromptLengthTrends,
} from '../hooks/useResponseContent';

// Status colors from Strato design tokens
const STATUS_COLORS = {
  excellent: Colors.Charts.Apdex.Excellent.Default,
  fair: Colors.Charts.Apdex.Fair.Default,
  poor: Colors.Charts.Apdex.Poor.Default,
};

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
            <Text textStyle="small">{metric.avgInputTokens.toFixed(0)} → {metric.avgOutputTokens.toFixed(0)}</Text>
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
// Main Response Analytics Page
// ============================================

/** Create a default Timeframe object (last 24 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

/** Convert Timeframe to simple string for hook */
const getTimeframeString = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-24h';
  if (from === 'now()-1h') return '1h';
  if (from === 'now()-6h') return '6h';
  if (from === 'now()-12h') return '12h';
  if (from === 'now()-24h') return '24h';
  if (from === 'now()-7d') return '7d';
  if (from === 'now()-30d') return '30d';
  return '24h';
};

export function ResponseAnalytics() {
  const { metrics, modelComparisons, loading, error, summary, analyzeResponses } = useResponseAnalytics();
  const { 
    trendData, 
    summary: qualitySummary, 
    loading: qualityLoading, 
    analyzeQualityTrends 
  } = useResponseQualityTrends();
  const {
    entries: streamingEntries,
    summary: streamingSummary,
    loading: streamingLoading,
    analyze: analyzeStreaming
  } = useStreamingAnalysis();

  // New content-based hooks
  const { entries: contentEntries, loading: contentLoading, fetchContent } = useContentViewer();
  const { breakdown: finishBreakdown, summary: finishSummary, loading: finishLoading, analyze: analyzeFinish } = useFinishReasonAnalytics();
  const { aliases, loading: aliasLoading, detect: detectAliases } = useModelAliasing();
  const { trends: lengthTrends, loading: trendsLoading, fetchTrends } = usePromptLengthTrends();
  
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'inefficient' | 'quality' | 'streaming' | 'content' | 'finish' | 'aliasing' | 'lengths'>('overview');
  const [showQualityHelp, setShowQualityHelp] = useState(false);

  const timeframeString = useMemo(() => getTimeframeString(timeframe), [timeframe]);

  useEffect(() => {
    analyzeResponses(timeframeString);
    analyzeQualityTrends(timeframeString);
    analyzeStreaming(timeframeString);
    fetchContent(timeframeString);
    analyzeFinish(timeframeString);
    detectAliases(timeframeString);
    fetchTrends(timeframeString);
  }, [timeframeString, analyzeResponses, analyzeQualityTrends, analyzeStreaming, fetchContent, analyzeFinish, detectAliases, fetchTrends]);

  // Transform trend data for TimeseriesChart
  const qualityChartData: Timeseries[] = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    
    return [
      {
        name: 'Error Rate (%)',
        datapoints: trendData.map(d => ({
          start: new Date(d.timestamp),
          value: d.errorRate
        }))
      },
      {
        name: 'Avg Latency (s)',
        datapoints: trendData.map(d => ({
          start: new Date(d.timestamp),
          value: d.avgLatencyMs / 1000
        }))
      }
    ];
  }, [trendData]);

  // Transform prompt length trends for TimeseriesChart
  const lengthChartData: Timeseries[] = useMemo(() => {
    if (!lengthTrends || lengthTrends.length === 0) return [];
    return [
      {
        name: 'Avg Prompt Length (chars)',
        datapoints: lengthTrends.map(d => ({ start: d.timeBucket, value: d.avgPromptLength }))
      },
      {
        name: 'Avg Response Length (chars)',
        datapoints: lengthTrends.map(d => ({ start: d.timeBucket, value: d.avgResponseLength }))
      },
    ];
  }, [lengthTrends]);

  // Content table columns
  const contentColumns = useMemo(() => [
    { id: 'timestamp', header: 'Time', accessor: (row: any) => formatTime(row.timestamp), ratioWidth: 1 },
    { id: 'provider', header: 'Provider', accessor: 'provider', ratioWidth: 1 },
    { id: 'requestModel', header: 'Model', accessor: 'requestModel', ratioWidth: 1.2 },
    { id: 'promptPreview', header: 'Prompt', accessor: 'promptPreview', ratioWidth: 3 },
    { id: 'responsePreview', header: 'Response', accessor: 'responsePreview', ratioWidth: 3 },
    { id: 'finishReason', header: 'Finish', accessor: 'finishReason', ratioWidth: 0.7 },
    { id: 'inputTokens', header: 'In Tokens', accessor: 'inputTokens', ratioWidth: 0.7 },
    { id: 'outputTokens', header: 'Out Tokens', accessor: 'outputTokens', ratioWidth: 0.7 },
    { id: 'durationMs', header: 'Duration', accessor: (row: any) => `${(row.durationMs / 1000).toFixed(2)}s`, ratioWidth: 0.7 },
  ], []);

  // Finish reason table columns
  const finishColumns = useMemo(() => [
    { id: 'provider', header: 'Provider', accessor: 'provider', ratioWidth: 1 },
    { id: 'model', header: 'Model', accessor: 'model', ratioWidth: 1.5 },
    { id: 'finishReason', header: 'Finish Reason', accessor: 'finishReason', ratioWidth: 1 },
    { id: 'count', header: 'Count', accessor: 'count', ratioWidth: 0.7 },
    { id: 'avgDurationMs', header: 'Avg Duration', accessor: (row: any) => `${(row.avgDurationMs / 1000).toFixed(2)}s`, ratioWidth: 1 },
    { id: 'avgOutputTokens', header: 'Avg Out Tokens', accessor: (row: any) => Math.round(row.avgOutputTokens), ratioWidth: 1 },
    { id: 'avgResponseLength', header: 'Avg Resp Length', accessor: (row: any) => `${Math.round(row.avgResponseLength)} chars`, ratioWidth: 1 },
  ], []);

  // Model aliasing table columns
  const aliasColumns = useMemo(() => [
    { id: 'provider', header: 'Provider', accessor: 'provider', ratioWidth: 1 },
    { id: 'requestModel', header: 'Request Model', accessor: 'requestModel', ratioWidth: 1.5 },
    { id: 'responseModel', header: 'Response Model', accessor: 'responseModel', ratioWidth: 1.5 },
    { id: 'isMismatch', header: 'Mismatch', accessor: (row: any) => row.isMismatch ? '⚠️ Yes' : '✓ Match', ratioWidth: 0.8 },
    { id: 'count', header: 'Requests', accessor: 'count', ratioWidth: 0.7 },
    { id: 'avgDurationMs', header: 'Avg Duration', accessor: (row: any) => `${(row.avgDurationMs / 1000).toFixed(2)}s`, ratioWidth: 1 },
    { id: 'avgInputTokens', header: 'Avg In Tokens', accessor: (row: any) => Math.round(row.avgInputTokens), ratioWidth: 0.8 },
    { id: 'avgOutputTokens', header: 'Avg Out Tokens', accessor: (row: any) => Math.round(row.avgOutputTokens), ratioWidth: 0.8 },
  ], []);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Title>Response Analytics</TitleBar.Title>
        <TitleBar.Subtitle>
          Token efficiency, output consistency, and model performance for ML Engineers
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <TimeframeSelector
              value={timeframe}
              onChange={(tf) => tf && setTimeframe(tf)}
              aria-label="Select time range"
            />
            <Button 
              onClick={() => analyzeResponses(timeframeString)}
              aria-label="Refresh analytics"
            >
              <RefreshIcon /> Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {error && (
        <Surface style={{ padding: '16px', backgroundColor: STATUS_COLORS.poor }}>
          <Text style={{ color: 'white' }}>Error loading analytics: {error.message}</Text>
        </Surface>
      )}

      {/* Summary Cards */}
      {summary && (
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
              <Heading level={2}>{formatNumber(summary.totalRequests)}</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Tokens</Text>
              <Heading level={2}>{(summary.totalTokens / 1000000).toFixed(2)}M</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
                <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Token Ratio</Text>
                  <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                </Flex>
              </Tooltip>
              <Heading level={2}>{summary.avgTokenRatio.toFixed(2)}x</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>output/input</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Needs Attention</Text>
              <Flex gap={8} alignItems="baseline">
                <Heading level={2} style={{ 
                  color: summary.inefficientServices > 0 ? STATUS_COLORS.poor : 'inherit' 
                }}>
                  {summary.inefficientServices}
                </Heading>
                <Tooltip text={METRIC_TOOLTIPS.inefficient}>
                  <Text textStyle="small" style={{ cursor: 'help', textDecoration: 'underline dotted' }}>inefficient</Text>
                </Tooltip>
                <Heading level={2} style={{ 
                  color: summary.inconsistentServices > 0 ? STATUS_COLORS.fair : 'inherit' 
                }}>
                  {summary.inconsistentServices}
                </Heading>
                <Tooltip text={METRIC_TOOLTIPS.inconsistent}>
                  <Text textStyle="small" style={{ cursor: 'help', textDecoration: 'underline dotted' }}>inconsistent</Text>
                </Tooltip>
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Tab Navigation */}
      <Flex gap={8} style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: '8px' }}>
        <Button
          variant={activeTab === 'overview' ? 'accent' : 'default'}
          onClick={() => setActiveTab('overview')}
        >
          <BarChartIcon /> Model Rankings
        </Button>
        <Button
          variant={activeTab === 'services' ? 'accent' : 'default'}
          onClick={() => setActiveTab('services')}
        >
          <ServicesIcon /> Service Analysis
        </Button>
        <Button
          variant={activeTab === 'quality' ? 'accent' : 'default'}
          onClick={() => setActiveTab('quality')}
        >
          <BarChartIcon /> Response Health
        </Button>
        <Button
          variant={activeTab === 'inefficient' ? 'accent' : 'default'}
          onClick={() => setActiveTab('inefficient')}
        >
          <WarningIcon /> Needs Attention
        </Button>
        <Button
          variant={activeTab === 'streaming' ? 'accent' : 'default'}
          onClick={() => setActiveTab('streaming')}
        >
          Streaming vs Batch
          {streamingSummary && streamingSummary.streamingCount > 0 && (
            <Text style={{ 
              padding: '2px 6px', 
              borderRadius: '4px', 
              backgroundColor: Colors.Charts.Categorical.Color06.Default,
              color: 'white',
              fontSize: '9px',
              marginLeft: '4px',
              fontWeight: 600
            }}>
              LIVE
            </Text>
          )}
        </Button>
        <Button
          variant={activeTab === 'content' ? 'accent' : 'default'}
          onClick={() => setActiveTab('content')}
        >
          Prompt/Response Content
        </Button>
        <Button
          variant={activeTab === 'finish' ? 'accent' : 'default'}
          onClick={() => setActiveTab('finish')}
        >
          Finish Reasons
        </Button>
        <Button
          variant={activeTab === 'aliasing' ? 'accent' : 'default'}
          onClick={() => setActiveTab('aliasing')}
        >
          Model Aliasing
          {aliases.filter(a => a.isMismatch).length > 0 && (
            <Text style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: STATUS_COLORS.fair, color: 'white', fontSize: '9px', marginLeft: '4px', fontWeight: 600 }}>
              {aliases.filter(a => a.isMismatch).length}
            </Text>
          )}
        </Button>
        <Button
          variant={activeTab === 'lengths' ? 'accent' : 'default'}
          onClick={() => setActiveTab('lengths')}
        >
          Content Length Trends
        </Button>
      </Flex>

      {/* Model Rankings Tab */}
      {activeTab === 'overview' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <BarChartIcon />
              <Heading level={4}>Model Efficiency Rankings</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Based on token ratio, latency, and cost efficiency
              </Text>
            </Flex>

            {modelComparisons.length === 0 && !loading && (
              <Text style={{ opacity: 0.7 }}>
                No model data available. Ensure your services have gen_ai.* span attributes.
              </Text>
            )}

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            <ModelRankingsPaginated models={modelComparisons} />
          </Flex>
        </Surface>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <ServicesIcon />
              <Heading level={4}>Service-Level Analysis</Heading>
            </Flex>

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {!loading && metrics.length === 0 && (
              <Text style={{ opacity: 0.7 }}>
                No service data available. Ensure your services emit gen_ai.* span attributes.
              </Text>
            )}

            {metrics.map(metric => (
              <ServiceRow key={metric.serviceId} metric={metric} />
            ))}
          </Flex>
        </Surface>
      )}

      {/* Inefficient Requests Tab */}
      {activeTab === 'inefficient' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Heading level={4}>⚠️ Services Needing Optimization</Heading>
            <Text style={{ opacity: 0.7 }}>
              These services have low token efficiency (high input, low output) or high variance in outputs.
              This may indicate prompt optimization opportunities.
            </Text>

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {summary?.topInefficient && summary.topInefficient.length > 0 ? (
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Low Token Efficiency</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  High input tokens with low output - may benefit from prompt compression or caching
                </Text>
                {summary.topInefficient.map(m => (
                  <Surface key={m.serviceId} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small">{m.model} • {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} alignItems="center" flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Token Ratio</Text>
                          <Text style={{ color: STATUS_COLORS.poor, fontWeight: 600 }}>{m.tokenRatio.toFixed(2)}x</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Input</Text>
                          <Text>{m.avgInputTokens.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Output</Text>
                          <Text>{m.avgOutputTokens.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Cost</Text>
                          <Text>${m.estimatedCost.toFixed(2)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            ) : !loading && (
              <Flex alignItems="center" gap={8}>
                <CheckmarkIcon style={{ color: STATUS_COLORS.excellent }} />
                <Text style={{ color: STATUS_COLORS.excellent }}>
                  No inefficient services detected - all services have healthy token ratios!
                </Text>
              </Flex>
            )}

            {summary?.topInconsistent && summary.topInconsistent.length > 0 && (
              <Flex flexDirection="column" gap={12} style={{ marginTop: '16px' }}>
                <Heading level={5}>High Output Variance</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  Inconsistent output lengths may indicate unpredictable model behavior
                </Text>
                {summary.topInconsistent.map(m => (
                  <Surface key={`inconsistent-${m.serviceId}`} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small">{m.model} • {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} alignItems="center" flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Variance</Text>
                          <Text style={{ color: STATUS_COLORS.fair, fontWeight: 600 }}>{m.outputVariance.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Std Dev</Text>
                          <Text>{m.outputStdDev.toFixed(1)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Low Output %</Text>
                          <Text>{m.lowOutputRate.toFixed(1)}%</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {/* Streaming vs Batch Tab */}
      {activeTab === 'streaming' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <Heading level={4}>Streaming vs Batch Analysis</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Real-time breakdown using llm.is_streaming attribute from OpenTelemetry spans
              </Text>
            </Flex>

            {streamingLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Summary KPIs */}
            {streamingSummary && (
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Streaming Requests</Text>
                    <Heading level={3}>{formatNumber(streamingSummary.streamingCount)}</Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>
                      {streamingSummary.streamingPct.toFixed(1)}% of total
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Batch Requests</Text>
                    <Heading level={3}>{formatNumber(streamingSummary.batchCount)}</Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>
                      {(100 - streamingSummary.streamingPct).toFixed(1)}% of total
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Streaming Avg Latency</Text>
                    <Heading level={3}>
                      {streamingSummary.streamingAvgLatency >= 1000 
                        ? `${(streamingSummary.streamingAvgLatency / 1000).toFixed(1)}s`
                        : `${Math.round(streamingSummary.streamingAvgLatency)}ms`}
                    </Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
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

            {/* Per-model breakdown */}
            {streamingEntries.length > 0 ? (
              <Flex flexDirection="column" gap={8}>
                <Heading level={5}>Per-Model Breakdown</Heading>
                <Flex style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--dt-colors-border-neutral-default)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Mode</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Provider</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Model</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>Requests</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>Avg Latency</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>P95 Latency</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>Avg Output Tokens</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamingEntries.slice(0, 30).map((entry, idx) => (
                        <tr key={idx} style={{ 
                          borderBottom: '1px solid var(--dt-colors-border-neutral-default)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--dt-colors-surface-default-secondary)'
                        }}>
                          <td style={{ padding: '8px 12px' }}>
                            <Text style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              backgroundColor: entry.mode === 'Streaming' 
                                ? 'rgba(59, 130, 246, 0.15)' 
                                : 'rgba(156, 163, 175, 0.15)',
                              color: entry.mode === 'Streaming'
                                ? Colors.Charts.Categorical.Color06.Default
                                : 'inherit'
                            }}>
                              {entry.mode}
                            </Text>
                          </td>
                          <td style={{ padding: '8px 12px' }}>{entry.provider}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <Text textStyle="small-emphasized">{entry.model}</Text>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatNumber(entry.requestCount)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {entry.avgLatencyMs >= 1000 
                              ? `${(entry.avgLatencyMs / 1000).toFixed(2)}s`
                              : `${Math.round(entry.avgLatencyMs)}ms`}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {entry.p95LatencyMs >= 1000 
                              ? `${(entry.p95LatencyMs / 1000).toFixed(2)}s`
                              : `${Math.round(entry.p95LatencyMs)}ms`}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Math.round(entry.avgOutputTokens)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <Text style={{ 
                              color: entry.errorRate > 5 ? STATUS_COLORS.poor 
                                : entry.errorRate > 1 ? STATUS_COLORS.fair 
                                : STATUS_COLORS.excellent 
                            }}>
                              {entry.errorRate.toFixed(2)}%
                            </Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Flex>
              </Flex>
            ) : !streamingLoading && (
              <Text style={{ opacity: 0.7 }}>
                No streaming data available. Ensure your services have the llm.is_streaming span attribute.
              </Text>
            )}
          </Flex>
        </Surface>
      )}

      {/* Response Health Tab */}
      {activeTab === 'quality' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={20}>
            {/* Header with Help Button */}
            <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
              <Flex alignItems="center" gap={8}>
                <BarChartIcon />
                <Heading level={4}>Response Health</Heading>
              </Flex>
              <Flex alignItems="center" gap={8}>
                <Tooltip text="Learn about the metrics displayed">
                  <Button
                    variant={showQualityHelp ? 'accent' : 'default'}
                    onClick={() => setShowQualityHelp(!showQualityHelp)}
                  >
                    <HelpIcon /> {showQualityHelp ? 'Hide' : 'How It Works'}
                  </Button>
                </Tooltip>
                <Tooltip text="Refresh quality data">
                  <Button
                    variant="default"
                    onClick={() => analyzeQualityTrends(timeframeString)}
                    disabled={qualityLoading}
                  >
                    <RefreshIcon /> Refresh
                  </Button>
                </Tooltip>
              </Flex>
            </Flex>

            {/* Expandable Help Panel */}
            {showQualityHelp && (
              <Surface style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: 'var(--dt-colors-surface-neutral-default)',
                border: '1px solid var(--dt-colors-border-neutral-default)'
              }}>
                <Flex flexDirection="column" gap={16}>
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Text style={{ fontWeight: 600, fontSize: 15 }}>📊 RESPONSE HEALTH METRICS</Text>
                    <Button variant="default" style={{ padding: '2px 6px', minHeight: 'auto' }} onClick={() => setShowQualityHelp(false)}>✕</Button>
                  </Flex>
                  <Text style={{ fontSize: 13, opacity: 0.85 }}>
                    Industry-standard observability metrics from OpenTelemetry gen_ai.* semantic conventions. All metrics are directly measured - no derived scores.
                  </Text>
                  
                  <Flex gap={32} flexWrap="wrap">
                    {/* Metrics Explained */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 280px', minWidth: 280 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>METRICS</Text>
                      <Flex flexDirection="column" gap={8} style={{ fontSize: 12 }}>
                        <Text>• <strong>Error Rate:</strong> % of requests with otel.status_code = ERROR</Text>
                        <Text>• <strong>Avg Latency:</strong> Mean response time (duration field)</Text>
                        <Text>• <strong>P95 Latency:</strong> 95th percentile response time</Text>
                        <Text>• <strong>Request Count:</strong> Total GenAI span count</Text>
                      </Flex>
                    </Flex>
                    
                    {/* Data Source */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>DATA SOURCE</Text>
                      <Flex flexDirection="column" gap={4} style={{ fontSize: 12 }}>
                        <Text>• OpenTelemetry spans with gen_ai.* attributes</Text>
                        <Text>• Bucketed by time for trend analysis</Text>
                        <Text>• Filtered by gen_ai.provider.name or gen_ai.request.model</Text>
                      </Flex>
                    </Flex>
                    
                    {/* Thresholds */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>ALERT THRESHOLDS</Text>
                      <Flex flexDirection="column" gap={4} style={{ fontSize: 12 }}>
                        <Text>• <strong>Error Rate &gt; 5%:</strong> Highlighted red</Text>
                        <Text>• <strong>Latency &gt; 5s:</strong> Highlighted yellow</Text>
                      </Flex>
                      <Text style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Thresholds are configurable based on your SLOs.
                      </Text>
                    </Flex>
                  </Flex>
                </Flex>
              </Surface>
            )}

            {qualityLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Response Health Metrics - Industry Standard Only */}
            {qualitySummary && (
              <Flex gap={16} flexWrap="wrap">
                {/* Total Requests Card */}
                <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px' }}>
                  <Flex flexDirection="column" gap={8}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
                    <Heading level={3}>
                      {formatNumber(qualitySummary!.totalRequests)}
                    </Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>in timeframe</Text>
                  </Flex>
                </Surface>

                {/* Error Rate Card */}
                <Tooltip text={METRIC_TOOLTIPS.errorRate}>
                  <Surface style={{ 
                    padding: '20px', 
                    flex: '1 1 150px', 
                    minWidth: '150px', 
                    cursor: 'help',
                    borderLeft: qualitySummary!.errorRate > 5 ? `4px solid ${STATUS_COLORS.poor}` : undefined
                  }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Error Rate</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary!.errorRate > 5 ? STATUS_COLORS.poor : 'inherit'
                      }}>
                        {qualitySummary!.errorRate.toFixed(1)}%
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>otel.status_code = ERROR</Text>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Avg Latency Card */}
                <Tooltip text={METRIC_TOOLTIPS.avgLatency}>
                  <Surface style={{ 
                    padding: '20px', 
                    flex: '1 1 150px', 
                    minWidth: '150px', 
                    cursor: 'help',
                    borderLeft: qualitySummary!.avgLatencyMs > 5000 ? `4px solid ${STATUS_COLORS.fair}` : undefined
                  }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Latency</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary!.avgLatencyMs > 5000 ? STATUS_COLORS.fair : 'inherit'
                      }}>
                        {(qualitySummary!.avgLatencyMs / 1000).toFixed(2)}s
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>mean response time</Text>
                    </Flex>
                  </Surface>
                </Tooltip>
              </Flex>
            )}

            {/* Quality Trend Chart */}
            {qualityChartData.length > 0 && trendData.length > 0 && (
              <Surface style={{ padding: '20px' }}>
                <Flex flexDirection="column" gap={12}>
                  <Flex alignItems="center" gap={8}>
                    <Heading level={5}>Quality Metrics Over Time</Heading>
                    <Tooltip text="Error Rate plotted over time. Look for spikes that correlate with deployments or traffic changes.">
                      <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                    </Tooltip>
                  </Flex>
                  <Flex style={{ height: '300px' }}>
                    <TimeseriesChart
                      data={qualityChartData}
                    >
                      <TimeseriesChart.Legend />
                    </TimeseriesChart>
                  </Flex>
                </Flex>
              </Surface>
            )}

            {!qualitySummary && !qualityLoading && (
              <Text style={{ opacity: 0.7 }}>
                No data available. Ensure your services emit gen_ai.* span attributes.
              </Text>
            )}
          </Flex>
        </Surface>
      )}

      {/* ============================================ */}
      {/* Prompt/Response Content Viewer Tab */}
      {/* ============================================ */}
      {activeTab === 'content' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <Heading level={4}>Prompt & Response Content Viewer</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Browse actual LLM input/output from gen_ai.prompt.*.content and gen_ai.completion.0.content
              </Text>
            </Flex>

            {contentLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {contentEntries.length > 0 ? (
              <DataTable
                data={contentEntries}
                columns={contentColumns}
                sortable
                resizable
              >
                <DataTable.Pagination defaultPageSize={10} />
              </DataTable>
            ) : !contentLoading && (
              <Text style={{ opacity: 0.7 }}>
                No prompt/response content available. Spans need gen_ai.prompt.0.content or gen_ai.completion.0.content attributes.
              </Text>
            )}
          </Flex>
        </Surface>
      )}

      {/* ============================================ */}
      {/* Finish Reason Analytics Tab */}
      {/* ============================================ */}
      {activeTab === 'finish' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <Heading level={4}>Finish Reason Analytics</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Distribution of gen_ai.completion.0.finish_reason across providers and models
              </Text>
            </Flex>

            {finishLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Coverage KPIs */}
            {finishSummary && (
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Spans with Content</Text>
                    <Heading level={3}>{formatNumber(finishSummary.totalWithContent)}</Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>gen_ai.completion.0.content</Text>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Spans with Finish Reason</Text>
                    <Heading level={3}>{formatNumber(finishSummary.totalWithFinishReason)}</Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>gen_ai.completion.0.finish_reason</Text>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Response Length</Text>
                    <Heading level={3}>{Math.round(finishSummary.avgResponseLength)} chars</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Prompt Length</Text>
                    <Heading level={3}>{Math.round(finishSummary.avgPromptLength)} chars</Heading>
                  </Flex>
                </Surface>
              </Flex>
            )}

            {/* Finish Reason Distribution */}
            {finishSummary && finishSummary.finishReasonDistribution.length > 0 && (
              <Surface style={{ padding: '16px' }}>
                <Flex flexDirection="column" gap={12}>
                  <Heading level={5}>Finish Reason Distribution</Heading>
                  <Flex gap={8} flexWrap="wrap">
                    {finishSummary.finishReasonDistribution.map(d => (
                      <Surface key={d.reason} style={{ padding: '12px 16px', minWidth: '120px' }}>
                        <Flex flexDirection="column" gap={4} alignItems="center">
                          <Text textStyle="base-emphasized">{d.reason}</Text>
                          <Heading level={4}>{formatNumber(d.count)}</Heading>
                          <Text textStyle="small" style={{ opacity: 0.7 }}>{d.pct.toFixed(1)}%</Text>
                          <Flex style={{
                            width: '100%',
                            height: '4px',
                            borderRadius: '2px',
                            backgroundColor: 'var(--dt-colors-border-neutral-default)',
                            overflow: 'hidden'
                          }}>
                            <Flex style={{
                              width: `${Math.min(d.pct, 100)}%`,
                              height: '100%',
                              borderRadius: '2px',
                              backgroundColor: d.reason === 'stop' ? STATUS_COLORS.excellent
                                : d.reason === 'length' ? STATUS_COLORS.fair
                                : STATUS_COLORS.poor,
                            }} />
                          </Flex>
                        </Flex>
                      </Surface>
                    ))}
                  </Flex>
                </Flex>
              </Surface>
            )}

            {/* Per-model breakdown table */}
            {finishBreakdown.length > 0 ? (
              <>
                <Heading level={5}>Per-Model Finish Reason Breakdown</Heading>
                <DataTable
                  data={finishBreakdown}
                  columns={finishColumns}
                  sortable
                  resizable
                >
                  <DataTable.Pagination defaultPageSize={15} />
                </DataTable>
              </>
            ) : !finishLoading && (
              <Text style={{ opacity: 0.7 }}>
                No finish reason data available. Spans need gen_ai.completion.0.finish_reason attribute.
              </Text>
            )}
          </Flex>
        </Surface>
      )}

      {/* ============================================ */}
      {/* Model Aliasing Detection Tab */}
      {/* ============================================ */}
      {activeTab === 'aliasing' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <Heading level={4}>Model Aliasing Detection</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Compares gen_ai.request.model vs gen_ai.response.model to detect server-side model substitution
              </Text>
            </Flex>

            {aliasLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Mismatch Summary */}
            {aliases.length > 0 && (
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Total Model Pairs</Text>
                    <Heading level={3}>{aliases.length}</Heading>
                  </Flex>
                </Surface>
                <Surface style={{ 
                  padding: '16px', flex: '1 1 180px', minWidth: '180px',
                  borderLeft: aliases.filter(a => a.isMismatch).length > 0 ? `4px solid ${STATUS_COLORS.fair}` : undefined
                }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Mismatches Detected</Text>
                    <Heading level={3} style={{ color: aliases.filter(a => a.isMismatch).length > 0 ? STATUS_COLORS.fair : STATUS_COLORS.excellent }}>
                      {aliases.filter(a => a.isMismatch).length}
                    </Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>
                      request model ≠ response model
                    </Text>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Affected Requests</Text>
                    <Heading level={3}>
                      {formatNumber(aliases.filter(a => a.isMismatch).reduce((s, a) => s + a.count, 0))}
                    </Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Exact Matches</Text>
                    <Heading level={3} style={{ color: STATUS_COLORS.excellent }}>
                      {aliases.filter(a => !a.isMismatch).length}
                    </Heading>
                  </Flex>
                </Surface>
              </Flex>
            )}

            {aliases.length > 0 ? (
              <DataTable
                data={aliases}
                columns={aliasColumns}
                sortable
                resizable
              >
                <DataTable.Pagination defaultPageSize={15} />
              </DataTable>
            ) : !aliasLoading && (
              <Text style={{ opacity: 0.7 }}>
                No model aliasing data available. Spans need both gen_ai.request.model and gen_ai.response.model attributes.
              </Text>
            )}
          </Flex>
        </Surface>
      )}

      {/* ============================================ */}
      {/* Content Length Trends Tab */}
      {/* ============================================ */}
      {activeTab === 'lengths' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <Heading level={4}>Content Length Trends</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Track prompt and response content size over time from gen_ai.prompt/completion content attributes
              </Text>
            </Flex>

            {trendsLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Summary KPIs */}
            {lengthTrends.length > 0 && (
              <Flex gap={16} flexWrap="wrap">
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Prompt Length</Text>
                    <Heading level={3}>
                      {Math.round(lengthTrends.reduce((s, t) => s + t.avgPromptLength * t.requestCount, 0) / Math.max(lengthTrends.reduce((s, t) => s + t.requestCount, 0), 1))} chars
                    </Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Response Length</Text>
                    <Heading level={3}>
                      {Math.round(lengthTrends.reduce((s, t) => s + t.avgResponseLength * t.requestCount, 0) / Math.max(lengthTrends.reduce((s, t) => s + t.requestCount, 0), 1))} chars
                    </Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Max Prompt Length</Text>
                    <Heading level={3}>
                      {formatNumber(Math.max(...lengthTrends.map(t => t.maxPromptLength)))} chars
                    </Heading>
                  </Flex>
                </Surface>
                <Surface style={{ padding: '16px', flex: '1 1 180px', minWidth: '180px' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Max Response Length</Text>
                    <Heading level={3}>
                      {formatNumber(Math.max(...lengthTrends.map(t => t.maxResponseLength)))} chars
                    </Heading>
                  </Flex>
                </Surface>
              </Flex>
            )}

            {/* Timeseries chart */}
            {lengthChartData.length > 0 && lengthTrends.length > 0 && (
              <Surface style={{ padding: '20px' }}>
                <Flex flexDirection="column" gap={12}>
                  <Heading level={5}>Prompt & Response Length Over Time</Heading>
                  <Flex style={{ height: '300px' }}>
                    <TimeseriesChart data={lengthChartData}>
                      <TimeseriesChart.Legend />
                    </TimeseriesChart>
                  </Flex>
                </Flex>
              </Surface>
            )}

            {lengthTrends.length === 0 && !trendsLoading && (
              <Text style={{ opacity: 0.7 }}>
                No content length data available. Spans need gen_ai.prompt.0.content or gen_ai.completion.0.content attributes.
              </Text>
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
}
