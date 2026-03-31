// RAG / Vector DB Observability Dashboard
// Surfaces Viatris Domain 3 metrics: Vector store health, embedding pipelines, RAG pipeline E2E
// Data: ~115K Pinecone spans/week + ~113K embedding spans/week

import React, { useState, useMemo, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components/overlays';
import { DataTable } from '@dynatrace/strato-components/tables';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import { XYChart, HoneycombChart, TreeMap } from '@dynatrace/strato-components/charts';
import { Tabs, Tab } from '@dynatrace/strato-components/navigation';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { openTraceInDistributedTraces, TraceLink } from '../utils/traceLink';
import {
  RefreshIcon, DatabaseIcon, BarChartIcon, WarningIcon,
  CheckmarkIcon, HelpIcon, CriticalIcon, AiIcon,
  ClockIcon, ResearchIcon, ExternalLinkIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useVectorDB } from '../hooks/useVectorDB';
import { RAGHealthPanel } from '../components/RAGHealthPanel';
import { createDefaultTimeframe } from '../context';
import type { QueryFilters } from '../hooks/useDQLQueries';
import type { RAGPipelineTrace, PipelineFlowStage, LatencyBucket } from '../types';
import { formatDateTime, formatTime } from '../utils/formatting';

// ============================================
// Constants
// ============================================

const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const CHART_COLORS = {
  pinecone:   Colors.Charts.Categorical.Color01.Default,
  embeddings: Colors.Charts.Categorical.Color06.Default,
  latency:    Colors.Charts.Categorical.Color03.Default,
  errors:     Colors.Charts.Status.Critical.Default,
};

const STEP_COLORS: Record<string, string> = {
  'Embedding':       Colors.Charts.Categorical.Color06.Default,
  'Vector Retrieve': Colors.Charts.Categorical.Color01.Default,
  'LLM Call':        Colors.Charts.Categorical.Color02.Default,
  'Agent Task':      Colors.Charts.Categorical.Color03.Default,
  'Tool Call':       Colors.Charts.Categorical.Color04.Default,
  'Workflow':        Colors.Charts.Categorical.Color05.Default,
};

// ============================================
// Helpers
// ============================================

const fmt = (n: number, decimals = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: decimals });

const fmtMs = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 0.1) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(3)}ms`;
};

const healthColor = (errorRate: number) => {
  if (errorRate < 1) return STATUS_COLORS.ideal;
  if (errorRate < 5) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
};

const latencyColor = (ms: number) => {
  if (ms < 100) return STATUS_COLORS.ideal;
  if (ms < 500) return STATUS_COLORS.good;
  if (ms < 1000) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
};



// ============================================
// MetricCard — matches AgentTools / ModelDrift canonical pattern
// ============================================

const MetricCard: React.FC<{
  value: string | number;
  label: string;
  icon: React.ReactNode;
  color?: string;
  tooltip?: string;
}> = ({ value, label, icon, color, tooltip }) => (
  <Flex
    alignItems="center"
    gap={8}
    padding={12}
    style={{
      background: 'var(--dt-colors-surface-default)',
      borderRadius: 6,
      border: '1px solid var(--dt-colors-border-neutral-default)',
      flex: '1 1 160px',
    }}
  >
    <Text style={{ display: 'flex', alignItems: 'center' }}>{icon}</Text>
    <Flex>
      <Flex style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>
        {value}
      </Flex>
      <Flex alignItems="center" gap={4}>
        <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</Flex>
        {tooltip && (
          <Tooltip text={tooltip}>
            <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        )}
      </Flex>
    </Flex>
  </Flex>
);

// ============================================
// RAG Trace Detail Modal
// ============================================
interface RAGTraceDetailModalProps {
  trace: RAGPipelineTrace;
  onClose: () => void;
}

const RAGTraceDetailModal: React.FC<RAGTraceDetailModalProps> = ({ trace, onClose }) => {
  const steps = [
    { label: 'Embedding',       badge: 'E', active: trace.hasEmbed,    color: CHART_COLORS.embeddings },
    { label: 'Vector Retrieve', badge: 'R', active: trace.hasRetrieve, color: CHART_COLORS.pinecone },
    { label: 'LLM Generate',    badge: 'G', active: trace.hasGenerate, color: Colors.Charts.Categorical.Color02.Default },
  ];
  const completedSteps = steps.filter(s => s.active).length;
  const isFullPipeline = trace.isFullPipeline;

  const rating = (() => {
    const ms = trace.totalDurationMs;
    if (ms < 500)  return { label: 'Excellent', color: STATUS_COLORS.ideal };
    if (ms < 2000) return { label: 'Good',      color: STATUS_COLORS.good };
    if (ms < 5000) return { label: 'Fair',      color: STATUS_COLORS.warning };
    return               { label: 'Slow',       color: STATUS_COLORS.critical };
  })();

  const findings: { type: 'info' | 'warning' | 'critical'; text: string }[] = [];
  if (isFullPipeline) {
    findings.push({ type: 'info', text: 'Full RAG pipeline confirmed: Embedding → Vector Retrieve → LLM Generate stages all present.' });
  } else {
    const missing = steps.filter(s => !s.active).map(s => s.label);
    findings.push({ type: 'warning', text: `Partial pipeline — only ${completedSteps}/3 stages detected. Missing: ${missing.join(', ')}. Check if missing stages are traced in a separate context.` });
  }
  if (trace.totalDurationMs > 5000) {
    findings.push({ type: 'critical', text: `High E2E latency (${fmtMs(trace.totalDurationMs)}). Investigate vector retrieval bottlenecks; consider result caching or embedding quantisation.` });
  } else if (trace.totalDurationMs > 2000) {
    findings.push({ type: 'warning', text: `Moderate latency (${fmtMs(trace.totalDurationMs)}). Review LLM model selection and retrieval top-k configuration.` });
  }
  if (trace.spanCount > 15) {
    findings.push({ type: 'warning', text: `High span count (${trace.spanCount}). May indicate nested retrieval loops, retry attempts, or fan-out chunk processing.` });
  }
  if (!isFullPipeline && trace.hasRetrieve && !trace.hasEmbed) {
    findings.push({ type: 'info', text: 'Retrieve-only: query embedding may be happening outside this trace context or using a cached vector.' });
  }
  if (findings.filter(f => f.type !== 'info').length === 0 && isFullPipeline) {
    findings.push({ type: 'info', text: 'No anomalies detected. Pipeline looks healthy.' });
  }

  const findingColor = (type: string) =>
    type === 'critical' ? STATUS_COLORS.critical : type === 'warning' ? STATUS_COLORS.warning : STATUS_COLORS.good;

  return (
    <Modal title="RAG Pipeline Trace Analysis" show onDismiss={onClose} size="large">
      <Flex flexDirection="column" gap={20} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        {/* KPI row */}
        <Flex gap={12} flexWrap="wrap">
          <Surface style={{ padding: 12, flex: '1 1 130px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>E2E Latency</Text>
              <Text style={{ fontSize: 22, fontWeight: 700, color: rating.color }}>{fmtMs(trace.totalDurationMs)}</Text>
              <Text style={{ fontSize: 11, color: rating.color, fontWeight: 600 }}>{rating.label}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 130px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Spans in Trace</Text>
              <Text style={{ fontSize: 22, fontWeight: 700 }}>{trace.spanCount}</Text>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>total spans</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 130px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Pipeline Stages</Text>
              <Text style={{ fontSize: 22, fontWeight: 700, color: isFullPipeline ? STATUS_COLORS.ideal : STATUS_COLORS.warning }}>
                {completedSteps}/3
              </Text>
              <Text style={{ fontSize: 11, color: isFullPipeline ? STATUS_COLORS.ideal : STATUS_COLORS.warning }}>
                {isFullPipeline ? 'Full pipeline' : 'Partial'}
              </Text>
            </Flex>
          </Surface>
          {trace.serviceName && (
            <Surface style={{ padding: 12, flex: '1 1 160px' }}>
              <Flex flexDirection="column" gap={4}>
                <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Service</Text>
                <Text style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {trace.serviceName}
                </Text>
              </Flex>
            </Surface>
          )}
        </Flex>

        {/* Trace metadata */}
        <Surface style={{ padding: 14 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="flex-start" gap={12}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', width: 80, flexShrink: 0, paddingTop: 2 }}>Trace ID</Text>
              <TraceLink traceId={trace.traceId || ''} timestamp={trace.traceStart} truncate={32} />
            </Flex>
            {trace.traceStart && (
              <Flex alignItems="center" gap={12}>
                <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', width: 80, flexShrink: 0 }}>Timestamp</Text>
                <Text style={{ fontSize: 11 }}>{formatDateTime(trace.traceStart)}</Text>
              </Flex>
            )}
          </Flex>
        </Surface>

        {/* Pipeline stage visualization */}
        <Surface style={{ padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>Pipeline Stages</Text>
          <Flex alignItems="center" style={{ overflowX: 'auto' }}>
            {steps.map((step, i) => (
              <React.Fragment key={step.badge}>
                <Flex flexDirection="column" alignItems="center" gap={8} style={{ minWidth: 110, padding: '0 8px' }}>
                  <Flex style={{
                    width: 52, height: 52, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: step.active ? `${step.color}20` : 'var(--dt-colors-background-base-default)',
                    border: `2px solid ${step.active ? step.color : 'var(--dt-colors-border-neutral-default)'}`,
                    boxShadow: step.active ? `0 0 0 4px ${step.color}10` : 'none',
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: step.active ? step.color : 'var(--dt-colors-text-secondary-default)' }}>
                      {step.badge}
                    </Text>
                  </Flex>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: step.active ? step.color : 'var(--dt-colors-text-secondary-default)', textAlign: 'center' }}>
                    {step.label}
                  </Text>
                  <Text style={{ fontSize: 10, color: step.active ? STATUS_COLORS.ideal : STATUS_COLORS.warning }}>
                    {step.active ? '✓ Detected' : '✗ Missing'}
                  </Text>
                </Flex>
                {i < steps.length - 1 && (
                  <Flex style={{ flex: 1, height: 2, background: 'var(--dt-colors-border-neutral-default)', marginBottom: 20, minWidth: 32 }} />
                )}
              </React.Fragment>
            ))}
          </Flex>
        </Surface>

        {/* Analysis findings */}
        <Surface style={{ padding: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Analysis Findings</Text>
          <Flex flexDirection="column" gap={8}>
            {findings.map((f, i) => (
              <Flex key={i} alignItems="flex-start" gap={8} style={{
                padding: '10px 12px', borderRadius: 4,
                background: `${findingColor(f.type)}12`,
                borderLeft: `3px solid ${findingColor(f.type)}`,
              }}>
                <Text style={{ fontSize: 12, color: findingColor(f.type), flexShrink: 0 }}>
                  {f.type === 'critical' ? '🔴' : f.type === 'warning' ? '🟡' : 'ℹ️'}
                </Text>
                <Text style={{ fontSize: 12 }}>{f.text}</Text>
              </Flex>
            ))}
          </Flex>
        </Surface>

        {/* Actions */}
        <Flex gap={12} justifyContent="flex-end">
          <Button variant="default" onClick={onClose}>Close</Button>
          {trace.traceId && (
            <Button variant="emphasized" onClick={() => openTraceInDistributedTraces(trace.traceId, trace.traceStart)}>
              <Button.Prefix><ExternalLinkIcon /></Button.Prefix>
              View in Distributed Tracing
            </Button>
          )}
        </Flex>
      </Flex>
    </Modal>
  );
};

// ============================================
// Advanced Visualization Sub-Components (Phase 5.5)
// ============================================

// ─── Animated Pipeline Flow ───
const STAGE_ORDER: PipelineFlowStage['stage'][] = ['Embed', 'Retrieve', 'Generate'];

const STAGE_META: Record<string, { color: string; icon: string; label: string }> = {
  Embed:    { color: Colors.Charts.Categorical.Color06.Default, icon: 'E', label: 'Embedding' },
  Retrieve: { color: Colors.Charts.Categorical.Color01.Default, icon: 'R', label: 'Vector Retrieve' },
  Generate: { color: Colors.Charts.Categorical.Color02.Default, icon: 'G', label: 'LLM Generate' },
};

const PipelineFunnel: React.FC<{ stages: PipelineFlowStage[] }> = ({ stages }) => {
  const stageMap = useMemo(() => {
    const map: Record<string, PipelineFlowStage> = {};
    stages.forEach((s) => { map[s.stage] = s; });
    return map;
  }, [stages]);

  const maxCount = useMemo(() => Math.max(...stages.map((s) => s.totalCount), 1), [stages]);

  return (
    <Flex flexDirection="column" gap={4}>
      {STAGE_ORDER.map((stageName, idx) => {
        const stage = stageMap[stageName];
        const meta = STAGE_META[stageName];
        const count = stage?.totalCount ?? 0;
        const latency = stage?.avgLatencyMs ?? 0;
        const errRate = stage?.errorRate ?? 0;
        const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8;
        const prevCount = idx > 0 ? (stageMap[STAGE_ORDER[idx - 1]]?.totalCount ?? 0) : 0;
        const dropOff = idx > 0 && prevCount > 0 ? ((prevCount - count) / prevCount * 100) : 0;

        return (
          <Flex key={stageName} alignItems="center" gap={12} style={{ padding: '6px 0' }}>
            {/* Stage label */}
            <Flex alignItems="center" gap={6} style={{ minWidth: 130 }}>
              <Flex style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: `${meta.color}15`, border: `2px solid ${meta.color}`,
              }}>
                <Text style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.icon}</Text>
              </Flex>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>{meta.label}</Text>
            </Flex>

            {/* Funnel bar */}
            <Flex style={{ flex: 1, position: 'relative', height: 36 }}>
              <Flex style={{
                width: `${widthPct}%`, height: '100%', borderRadius: 6,
                background: `linear-gradient(90deg, ${meta.color}30, ${meta.color}60)`,
                border: `1px solid ${meta.color}`,
                display: 'flex', alignItems: 'center', paddingLeft: 12,
                transition: 'width 0.6s ease-out',
              }}>
                <Text style={{ fontSize: 14, fontWeight: 700 }}>{fmt(count)}</Text>
                <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', marginLeft: 8 }}>
                  {fmtMs(latency)} avg
                </Text>
              </Flex>
            </Flex>

            {/* Drop-off + error rate */}
            <Flex flexDirection="column" alignItems="flex-end" style={{ minWidth: 80 }}>
              {idx > 0 && dropOff > 0 && (
                <Text style={{ fontSize: 10, color: STATUS_COLORS.warning }}>
                  ▼ {dropOff.toFixed(1)}% drop
                </Text>
              )}
              {errRate > 0 && (
                <Text style={{ fontSize: 10, color: STATUS_COLORS.critical }}>
                  {errRate.toFixed(1)}% err
                </Text>
              )}
            </Flex>
          </Flex>
        );
      })}
    </Flex>
  );
};

// ─── Latency Heatmap (XYChart.RectSeries) ───
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface HeatmapCellImport {
  hourOfDay: number;
  dayOfWeek: number;
  totalCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

const LatencyHeatmap: React.FC<{ cells: HeatmapCellImport[] }> = ({ cells }) => {
  const heatmapData = useMemo(() =>
    cells.map((c) => ({
      vertical: { start: DAY_LABELS[c.dayOfWeek] ?? `Day${c.dayOfWeek}` },
      horizontal: { start: `${String(c.hourOfDay).padStart(2, '0')}:00`, end: `${String(c.hourOfDay + 1).padStart(2, '0')}:00` },
      cell: { latency: Math.round(c.avgLatencyMs) },
    })),
    [cells],
  );

  if (heatmapData.length === 0) return null;

  return (
    <XYChart data={heatmapData} style={{ height: 240 }}>
      <XYChart.RectSeries
        xAxisId="x-axis"
        yAxisId="y-axis"
        x0Accessor="horizontal.start"
        x1Accessor="horizontal.end"
        y0Accessor="vertical.start"
        valueAccessor="cell.latency"
        valueAccessorLabel="Avg Latency (ms)"
        colorPalette="categorical"
      />
      <XYChart.XAxis id="x-axis" type="categorical" position="bottom" label="Hour of Day" />
      <XYChart.YAxis id="y-axis" type="categorical" position="left" label="Day" />
    </XYChart>
  );
};

// ─── Token Distribution TreeMap ───
interface TreemapEntryImport {
  provider: string;
  model: string;
  tokenSum: number;
  requestCount: number;
  avgLatencyMs: number;
}

const TokenDistributionTreeMap: React.FC<{ entries: TreemapEntryImport[] }> = ({ entries }) => {
  const treeData = useMemo(() => {
    const byProvider: Record<string, { name: string; value: number; nodes: Array<{ name: string; value: number }> }> = {};
    entries.forEach((e) => {
      if (!byProvider[e.provider]) {
        byProvider[e.provider] = { name: e.provider, value: 0, nodes: [] };
      }
      byProvider[e.provider].value += e.tokenSum;
      byProvider[e.provider].nodes.push({ name: e.model, value: e.tokenSum });
    });
    const clusters = Object.values(byProvider).sort((a, b) => b.value - a.value);
    const totalTokens = clusters.reduce((s, c) => s + c.value, 0);
    return {
      tree: {
        name: 'All Providers',
        value: totalTokens,
        nodes: clusters,
      },
    };
  }, [entries]);

  return (
    <TreeMap
      data={treeData}
      height={280}
      labelsDisplay="all"
      colorPalette="categorical"
    >
      <TreeMap.Legend />
    </TreeMap>
  );
};

// ============================================
// Main Page
// ============================================

// Thresholds for full LLM response duration (span duration as TTFT proxy)
// Streaming TTFT thresholds (sub-second) don't apply here; use response latency bands
const ttftRating = (ms: number): { label: string; color: string } => {
  if (ms < 2000)  return { label: 'Excellent', color: STATUS_COLORS.ideal };
  if (ms < 5000)  return { label: 'Good',      color: STATUS_COLORS.good };
  if (ms < 10000) return { label: 'Fair',      color: STATUS_COLORS.warning };
  return                 { label: 'Slow',      color: STATUS_COLORS.critical };
};

export const VectorDB: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe | null>(createDefaultTimeframe);
  const [selectedTrace, setSelectedTrace] = useState<RAGPipelineTrace | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const filters: QueryFilters = { timeframe };

  const {
    latency, volumeTimeseries, cacheCandidates, summary,
    embeddingProviders, embeddingTimeseries,
    pipelineTraces,
    ttftByModel, ttftSummary,
    chainSteps,
    indexPerformance, ingestionTimeseries,
    resultSetSizes, sourceDocMetadata,
    tokenizationDrift, retrievalAnomalies, contextEffectiveness,
    heatmapCells, pipelineFlowStages, tokenTreemap, modelHoneycomb, eventStream,
    latencyBuckets,
    loading, error, refetch,
  } = useVectorDB(filters);

  // Auto-load on mount and whenever the timeframe changes
  useEffect(() => {
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  const volumeSeries: Timeseries[] = useMemo(() =>
    volumeTimeseries.length > 0
      ? [{
          name: 'Pinecone Queries',
          color: CHART_COLORS.pinecone,
          datapoints: volumeTimeseries
            .filter((d) => d.timestamp > 0)
            .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.queries })),
        }]
      : [],
    [volumeTimeseries]);

  const embeddingSeriesData: Timeseries[] = useMemo(() =>
    embeddingTimeseries.length > 0
      ? [{
          name: 'Embedding Calls',
          color: CHART_COLORS.embeddings,
          datapoints: embeddingTimeseries
            .filter((d) => d.timestamp > 0)
            .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.embeddings })),
        }]
      : [],
    [embeddingTimeseries]);

  const maxStepMs = useMemo(
    () => Math.max(...chainSteps.map((s) => s.avgDurationMs), 1),
    [chainSteps]);

  // Phase 5.4 computed series
  const ingestionSeries: Timeseries[] = useMemo(() =>
    ingestionTimeseries.length > 0
      ? [{
          name: 'Upserts / hour',
          color: Colors.Charts.Categorical.Color04.Default,
          datapoints: ingestionTimeseries
            .filter((d) => d.timestamp > 0)
            .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.upserts })),
        }]
      : [],
    [ingestionTimeseries]);

  const tokenDriftSeries: Timeseries[] = useMemo(() => {
    if (tokenizationDrift.length === 0) return [];
    return [
      {
        name: 'Avg Prompt Tokens',
        color: Colors.Charts.Categorical.Color01.Default,
        datapoints: tokenizationDrift
          .filter((d) => d.timestamp > 0)
          .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.avgPromptTokens })),
      },
      {
        name: 'p95 Prompt Tokens',
        color: Colors.Charts.Categorical.Color03.Default,
        datapoints: tokenizationDrift
          .filter((d) => d.timestamp > 0)
          .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.p95PromptTokens })),
      },
      {
        name: 'Avg Completion Tokens',
        color: Colors.Charts.Categorical.Color06.Default,
        datapoints: tokenizationDrift
          .filter((d) => d.timestamp > 0)
          .map((d) => ({ start: new Date(d.timestamp), end: new Date(d.timestamp + 3_600_000), value: d.avgCompletionTokens })),
      },
    ];
  }, [tokenizationDrift]);

  const anomalyCount = useMemo(
    () => retrievalAnomalies.filter((a) => a.isAnomalous).length,
    [retrievalAnomalies]);


  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* ─── Title Bar ─── */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <DatabaseIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>RAG &amp; Vector DB</TitleBar.Title>
        <TitleBar.Subtitle>
          Pinecone vector store · Embedding pipelines · RAG E2E performance · TTFT · Agent retries
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex alignItems="center" gap={8}>
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <Button onClick={refetch} disabled={loading} variant="emphasized">
              {loading ? <ProgressCircle size="small" /> : <RefreshIcon />}
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Error banner */}
      {error && (
        <Flex
          alignItems="center"
          gap={8}
          padding={12}
          style={{
            background: 'var(--dt-colors-feedback-critical-background)',
            border: '1px solid var(--dt-colors-feedback-critical-default)',
            borderRadius: 6,
          }}
        >
          <CriticalIcon style={{ color: 'var(--dt-colors-feedback-critical-default)' }} />
          <Text style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>{error.message}</Text>
        </Flex>
      )}

      {/* ─── Tabs Navigation ─── */}
      <Tabs selectedIndex={activeTab} onChange={(index) => setActiveTab(index)}>
        <Tab title="Overview">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
          {/* ─── Summary KPI Row ─── */}
      <Flex gap={8} flexWrap="wrap">
        <MetricCard
          value={summary ? fmt(summary.totalPineconeQueries) : '—'}
          label="Pinecone Queries"
          icon={<DatabaseIcon style={{ color: CHART_COLORS.pinecone }} />}
          tooltip="Total vector DB query spans (db.system=pinecone)"
        />
        <MetricCard
          value={summary ? fmt(summary.totalEmbeddings) : '—'}
          label="Embedding Calls"
          icon={<AiIcon style={{ color: CHART_COLORS.embeddings }} />}
          tooltip="Total embedding generation calls across all providers"
        />
        <MetricCard
          value={latency ? fmtMs(latency.avgLatencyMs) : '—'}
          label="Avg Retrieval Latency"
          icon={<BarChartIcon style={{ color: latency ? latencyColor(latency.avgLatencyMs) : 'inherit' }} />}
          color={latency ? latencyColor(latency.avgLatencyMs) : undefined}
          tooltip="Average Pinecone query latency. Good: <100ms | Warning: <500ms | Critical: >1s"
        />
        <MetricCard
          value={latency ? `${latency.errorRate.toFixed(1)}%` : '—'}
          label="Vector Store Error Rate"
          icon={
            latency && latency.errorRate >= 1
              ? <WarningIcon style={{ color: healthColor(latency.errorRate) }} />
              : <CheckmarkIcon style={{ color: STATUS_COLORS.ideal }} />
          }
          color={latency ? healthColor(latency.errorRate) : undefined}
          tooltip="Pinecone span error rate (span.status_code=error). Good: <1%"
        />
        <MetricCard
          value={summary ? fmt(summary.fullPipelineTraces) : '—'}
          label="Full RAG Pipelines"
          icon={<ResearchIcon style={{ color: STATUS_COLORS.ideal }} />}
          color={STATUS_COLORS.ideal}
          tooltip="Traces containing all three stages: embed + retrieve + generate"
        />
        {ttftSummary && ttftSummary.count > 0 && (
          <MetricCard
            value={fmtMs(ttftSummary.avgTtftMs)}
            label="Avg LLM Response Latency"
            icon={<ClockIcon style={{ color: ttftRating(ttftSummary.avgTtftMs).color }} />}
            color={ttftRating(ttftSummary.avgTtftMs).color}
            tooltip={`LLM response latency proxy (p95: ${fmtMs(ttftSummary.p95TtftMs)}). Uses span duration as TTFT estimate since gen_ai.server.time_to_first_token is not instrumented.`}
          />
        )}
      </Flex>

      {/* ─── Row 1: Volume Timeseries ─── */}
      <Flex gap={16} flexWrap="wrap">
        <Surface style={{ flex: '1 1 48%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <DatabaseIcon />
            <Heading level={4}>Pinecone Query Volume</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>queries / hour</Text>
          </Flex>
          {volumeSeries.length > 0 ? (
            <TimeseriesChart data={volumeSeries} style={{ height: 180 }} />
          ) : (
            <Flex alignItems="center" justifyContent="center" style={{ height: 180 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No Pinecone span data detected'}
              </Text>
            </Flex>
          )}
        </Surface>

        <Surface style={{ flex: '1 1 48%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <AiIcon />
            <Heading level={4}>Embedding Generation Volume</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>calls / hour</Text>
          </Flex>
          {embeddingSeriesData.length > 0 ? (
            <TimeseriesChart data={embeddingSeriesData} style={{ height: 180 }} />
          ) : (
            <Flex alignItems="center" justifyContent="center" style={{ height: 180 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No embedding span data detected'}
              </Text>
            </Flex>
          )}
        </Surface>
      </Flex>

      {/* Embedding Providers Table */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <AiIcon />
          <Heading level={4}>Embedding Providers</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>volume &amp; latency by provider/model</Text>
        </Flex>
        {embeddingProviders.length > 0 ? (
          <DataTable
            data={embeddingProviders}
            columns={[
              { header: 'Provider', id: 'provider', accessor: 'provider', width: 100 },
              { header: 'Model', id: 'model', accessor: 'model', width: 180, cell: ({ value }) => (
                <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
              )},
              { header: 'Calls', id: 'callCount', accessor: 'callCount', width: 80,
                cell: ({ value }) => <Text>{fmt(Number(value ?? 0))}</Text> },
              { header: 'Avg Latency', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 100,
                cell: ({ value }) => {
                  const ms = Number(value ?? 0);
                  return <Text style={{ color: latencyColor(ms) }}>{fmtMs(ms)}</Text>;
                }},
              { header: 'p95', id: 'p95LatencyMs', accessor: 'p95LatencyMs', width: 90,
                cell: ({ value }) => (
                  <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>
                )},
              { header: 'Err%', id: 'errorRate', accessor: 'errorRate', width: 70,
                cell: ({ value }) => {
                  const rate = Number(value ?? 0);
                  return <Text style={{ color: healthColor(rate) }}>{rate.toFixed(1)}%</Text>;
                }},
            ]}
          >
            <DataTable.Pagination defaultPageSize={5} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No embedding data'}</Text>
        )}
      </Surface>
          </Flex>
        </Tab>

        <Tab title="Health Score">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
            <RAGHealthPanel />
          </Flex>
        </Tab>

        <Tab title="Pipeline Performance">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      {/* ─── RAG Chain Performance ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <BarChartIcon />
          <Heading level={4}>RAG Chain Step Performance</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>average latency per pipeline step</Text>
        </Flex>
        {chainSteps.length > 0 ? (
          <DataTable
            data={chainSteps}
            columns={[
              {
                header: 'Step', id: 'stepLabel', accessor: 'stepLabel', width: 160,
                cell: ({ value }) => (
                  <Flex alignItems="center" gap={6}>
                    <Text style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: STEP_COLORS[String(value)] ?? Colors.Charts.Categorical.Color05.Default,
                    }} />
                    <Text style={{ fontWeight: 500 }}>{String(value ?? '—')}</Text>
                  </Flex>
                ),
              },
              {
                header: 'Avg Latency', id: 'avgDurationMs', accessor: 'avgDurationMs', width: 240,
                cell: ({ value }) => {
                  const ms = Number(value ?? 0);
                  const pct = maxStepMs > 0 ? Math.min((ms / maxStepMs) * 100, 100) : 0;
                  return (
                    <Flex alignItems="center" gap={8}>
                      <ProgressBar value={pct} max={100} style={{ flex: 1, minWidth: 80 }} />
                      <Text style={{ minWidth: 55, textAlign: 'right', fontWeight: 500 }}>{fmtMs(ms)}</Text>
                    </Flex>
                  );
                },
              },
              {
                header: 'p95', id: 'p95DurationMs', accessor: 'p95DurationMs', width: 90,
                cell: ({ value }) => (
                  <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>
                ),
              },
              {
                header: 'Calls', id: 'callCount', accessor: 'callCount', width: 80,
                cell: ({ value }) => <Text>{fmt(Number(value ?? 0))}</Text>,
              },
              {
                header: 'Err%', id: 'errorRate', accessor: 'errorRate', width: 70,
                cell: ({ value }) => {
                  const rate = Number(value ?? 0);
                  return <Text style={{ color: rate > 1 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{rate.toFixed(1)}%</Text>;
                },
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={5} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            {loading ? 'Loading…' : 'No pipeline step data'}
          </Text>
        )}
      </Surface>

      {/* ─── Row 4: Top Slowest RAG Pipeline Traces (full width) ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <DatabaseIcon />
          <Heading level={4}>Top Slowest RAG Pipeline Traces</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>click any row for detailed analysis · embed / retrieve / generate</Text>
        </Flex>
        {pipelineTraces.length > 0 ? (
          <DataTable
            data={pipelineTraces}
            columns={[
              {
                header: 'Trace ID',
                id: 'traceId',
                accessor: 'traceId',
                minWidth: 240,
                cell: ({ value, rowData }: any) => (
                  <TraceLink traceId={String(value ?? '')} timestamp={rowData?.traceStart} truncate={24} />
                ),
              },
              {
                header: 'Service',
                id: 'serviceName',
                accessor: 'serviceName',
                width: 180,
                cell: ({ value }) => (
                  <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {String(value ?? '—')}
                  </Text>
                ),
              },
              {
                header: 'Start Time',
                id: 'traceStart',
                accessor: 'traceStart',
                width: 150,
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {value ? formatTime(String(value)) : '—'}
                  </Text>
                ),
              },
              {
                header: 'E2E Latency',
                id: 'totalDurationMs',
                accessor: 'totalDurationMs',
                width: 110,
                cell: ({ value }) => {
                  const ms = Number(value ?? 0);
                  return <Text style={{ color: latencyColor(ms), fontWeight: 700 }}>{fmtMs(ms)}</Text>;
                },
              },
              {
                header: 'Spans',
                id: 'spanCount',
                accessor: 'spanCount',
                width: 70,
                cell: ({ value }) => <Text>{String(value ?? '—')}</Text>,
              },
              {
                header: 'Stages',
                id: 'stages',
                accessor: 'isFullPipeline',
                width: 110,
                cell: ({ rowData }) => {
                  const t = rowData as RAGPipelineTrace;
                  return (
                    <Flex gap={4}>
                      {([
                        { b: 'E', active: t.hasEmbed,    color: CHART_COLORS.embeddings },
                        { b: 'R', active: t.hasRetrieve, color: CHART_COLORS.pinecone },
                        { b: 'G', active: t.hasGenerate, color: Colors.Charts.Categorical.Color02.Default },
                      ] as const).map(({ b, active, color }) => (
                        <Text key={b} style={{
                          fontSize: 10, padding: '2px 5px', borderRadius: 3, fontWeight: 700,
                          background: active ? `${color}30` : 'var(--dt-colors-background-base-default)',
                          color: active ? color : 'var(--dt-colors-text-secondary-default)',
                          border: `1px solid ${active ? color : 'var(--dt-colors-border-neutral-default)'}`,
                        }}>{b}</Text>
                      ))}
                    </Flex>
                  );
                },
              },
              {
                header: 'Actions',
                id: 'actions',
                accessor: 'traceId',
                width: 100,
                cell: ({ rowData }) => {
                  const t = rowData as RAGPipelineTrace;
                  return (
                    <Flex gap={4}>
                      <Tooltip text="Analyze trace">
                        <Button variant="default" onClick={() => setSelectedTrace(t)}>
                          <ResearchIcon style={{ width: 14, height: 14 }} />
                        </Button>
                      </Tooltip>
                      {t.traceId && (
                        <Tooltip text="View in Distributed Tracing">
                          <Button variant="default" onClick={() => openTraceInDistributedTraces(t.traceId, t.traceStart)}>
                            <ExternalLinkIcon style={{ width: 14, height: 14 }} />
                          </Button>
                        </Tooltip>
                      )}
                    </Flex>
                  );
                },
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No RAG pipeline traces found'}</Text>
        )}
      </Surface>

      {/* TTFT by Model */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <ClockIcon />
          <Heading level={4}>Response Latency by Model (TTFT proxy)</Heading>
          <Tooltip text="gen_ai.server.time_to_first_token is only set when streaming is explicitly instrumented. Showing span duration as TTFT proxy.">
            <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        </Flex>
        {ttftByModel.length > 0 ? (
          <DataTable
            data={ttftByModel}
            columns={[
              {
                header: 'Model',
                id: 'model',
                accessor: 'model',
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                ),
              },
              {
                header: 'Avg',
                id: 'avgTtftMs',
                accessor: 'avgTtftMs',
                width: 90,
                cell: ({ value }) => {
                  const ms = Number(value ?? 0);
                  const r = ttftRating(ms);
                  return <Text style={{ color: r.color, fontWeight: 600 }}>{fmtMs(ms)}</Text>;
                },
              },
              {
                header: 'p95',
                id: 'p95TtftMs',
                accessor: 'p95TtftMs',
                width: 80,
                cell: ({ value }) => <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>,
              },
              {
                header: 'Rating',
                id: 'rating',
                accessor: 'avgTtftMs',
                width: 90,
                cell: ({ value }) => {
                  const r = ttftRating(Number(value ?? 0));
                  return (
                    <Text style={{
                      fontSize: 11, fontWeight: 600, color: r.color,
                      background: `${r.color}20`, borderRadius: 4,
                      padding: '2px 6px', display: 'inline-block',
                    }}>
                      {r.label}
                    </Text>
                  );
                },
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={5} />
          </DataTable>
        ) : (
          <Flex flexDirection="column" gap={8} alignItems="center" justifyContent="center" style={{ height: 120 }}>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>No LLM call data detected</Text>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Requires spans with gen_ai.request.model
            </Text>
          </Flex>
        )}
      </Surface>
          </Flex>
        </Tab>

        <Tab title="Vector Store">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      {/* Latency Percentiles */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <BarChartIcon />
          <Heading level={4}>Pinecone Latency Percentiles</Heading>
        </Flex>
        <Flex gap={8} flexWrap="wrap">
          {latency ? (
            (['avg', 'p50', 'p95', 'p99'] as const).map((key) => {
              const val = key === 'avg' ? latency.avgLatencyMs
                : key === 'p50' ? latency.p50Ms
                : key === 'p95' ? latency.p95Ms
                : latency.p99Ms;
              const color = latencyColor(val);
              return (
                <Flex
                  key={key}
                  flexDirection="column"
                  alignItems="center"
                  gap={4}
                  padding={12}
                  style={{
                    background: 'var(--dt-colors-surface-default)',
                    border: '1px solid var(--dt-colors-border-neutral-default)',
                    borderRadius: 6,
                    minWidth: 80,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 700, color }}>{fmtMs(val)}</Text>
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', textTransform: 'uppercase' }}>{key}</Text>
                </Flex>
              );
            })
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No data'}</Text>
          )}
        </Flex>
      </Surface>

      {/* Index Performance + Data Ingestion Metrics */}
      <Flex gap={16} flexWrap="wrap">
        {/* Index Performance — operation type latency split */}
        <Surface style={{ flex: '1 1 50%', padding: 16, minWidth: 280 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <BarChartIcon />
            <Heading level={4}>Index Performance by Operation</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>query · upsert · delete latency split</Text>
          </Flex>
          {indexPerformance.length > 0 ? (
            <DataTable
              data={indexPerformance}
              columns={[
                {
                  header: 'Operation', id: 'opType', accessor: 'opType',
                  cell: ({ value }) => {
                    const op = String(value ?? '');
                    const color = op === 'upsert'
                      ? Colors.Charts.Categorical.Color04.Default
                      : op === 'delete'
                        ? STATUS_COLORS.critical
                        : Colors.Charts.Categorical.Color01.Default;
                    return (
                      <Flex alignItems="center" gap={6}>
                        <Text style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
                        <Text style={{ fontWeight: 600, textTransform: 'capitalize' }}>{op}</Text>
                      </Flex>
                    );
                  },
                },
                {
                  header: 'Avg', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)), fontWeight: 600 }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'p95', id: 'p95LatencyMs', accessor: 'p95LatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'p99', id: 'p99LatencyMs', accessor: 'p99LatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)) }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Calls', id: 'callCount', accessor: 'callCount', width: 70,
                  cell: ({ value }) => <Text>{fmt(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Err%', id: 'errorRate', accessor: 'errorRate', width: 60,
                  cell: ({ value }) => {
                    const r = Number(value ?? 0);
                    return <Text style={{ color: r > 1 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{r.toFixed(1)}%</Text>;
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Flex flexDirection="column" gap={8} alignItems="center" justifyContent="center" style={{ height: 100 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No index operation data — requires vector store spans with db.operation attribute'}
              </Text>
            </Flex>
          )}
        </Surface>

        {/* Data Ingestion Metrics — upsert throughput timeseries */}
        <Surface style={{ flex: '1 1 45%', padding: 16, minWidth: 280 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 4 }}>
            <DatabaseIcon />
            <Heading level={4}>Data Ingestion Metrics</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>upsert throughput over time</Text>
          </Flex>
          {ingestionSeries.length > 0 ? (
            <TimeseriesChart data={ingestionSeries} style={{ height: 160 }} />
          ) : (
            <Flex flexDirection="column" gap={8} alignItems="center" justifyContent="center" style={{ height: 120 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No upsert/ingestion spans detected'}
              </Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                Requires spans with db.operation == "upsert" or span name containing "upsert"/"ingest"
              </Text>
            </Flex>
          )}
          {/* Ingestion KPIs */}
          {ingestionTimeseries.length > 0 && (() => {
            const totalUpserts = ingestionTimeseries.reduce((s, d) => s + d.upserts, 0);
            const totalErrors = ingestionTimeseries.reduce((s, d) => s + d.errors, 0);
            const avgLat = ingestionTimeseries.reduce((s, d) => s + d.avgUpsertLatencyMs, 0) / ingestionTimeseries.length;
            return (
              <Flex gap={12} flexWrap="wrap" style={{ marginTop: 12 }}>
                <MetricCard value={fmt(totalUpserts)} label="Total Upserts" icon={<DatabaseIcon style={{ width: 16, height: 16 }} />} color={Colors.Charts.Categorical.Color04.Default} />
                <MetricCard value={fmtMs(avgLat)} label="Avg Upsert Latency" icon={<ClockIcon style={{ width: 16, height: 16 }} />} color={latencyColor(avgLat)} />
                <MetricCard value={fmt(totalErrors)} label="Ingest Errors" icon={<WarningIcon style={{ width: 16, height: 16 }} />} color={totalErrors > 0 ? STATUS_COLORS.warning : STATUS_COLORS.ideal} />
              </Flex>
            );
          })()}
        </Surface>
      </Flex>

      {/* Result Set Sizes + Source Document Metadata */}
      <Flex gap={16} flexWrap="wrap">
        {/* Query Volume by Namespace */}
        <Surface style={{ flex: '1 1 48%', padding: 16, minWidth: 280 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <BarChartIcon />
            <Heading level={4}>Query Volume by Index/Namespace</Heading>
            <Tooltip text="Query distribution across namespaces and indexes. High concentration in one namespace may indicate load-balancing opportunities. Error rates reveal per-namespace reliability.">
              <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
            </Tooltip>
          </Flex>
          {resultSetSizes.length > 0 ? (
            <DataTable
              data={resultSetSizes}
              columns={[
                {
                  header: 'Namespace', id: 'namespace', accessor: 'namespace',
                  cell: ({ value }) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{String(value ?? 'default')}</Text>,
                },
                {
                  header: 'Index', id: 'indexName', accessor: 'indexName', width: 120,
                  cell: ({ value }) => <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>,
                },
                {
                  header: 'Queries', id: 'queryCount', accessor: 'queryCount', width: 80,
                  cell: ({ value }) => <Text style={{ fontWeight: 600 }}>{fmt(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Avg Lat', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 90,
                  cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)), fontWeight: 600 }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'p95 Lat', id: 'p95LatencyMs', accessor: 'p95LatencyMs', width: 90,
                  cell: ({ value }) => <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Err%', id: 'errorRate', accessor: 'errorRate', width: 60,
                  cell: ({ value }) => {
                    const r = Number(value ?? 0);
                    return <Text style={{ color: r > 1 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{r.toFixed(1)}%</Text>;
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              {loading ? 'Loading…' : 'No index/namespace data — requires db.system attribute on vector store spans'}
            </Text>
          )}
        </Surface>

        {/* Source Document Metadata */}
        <Surface style={{ flex: '1 1 48%', padding: 16, minWidth: 280 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <DatabaseIcon />
            <Heading level={4}>Source Document Metadata</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>namespace · index · latency attribution</Text>
          </Flex>
          {sourceDocMetadata.length > 0 ? (
            <DataTable
              data={sourceDocMetadata}
              columns={[
                {
                  header: 'Namespace', id: 'namespace', accessor: 'namespace',
                  cell: ({ value }) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{String(value ?? 'default')}</Text>,
                },
                {
                  header: 'Store', id: 'dbSystem', accessor: 'dbSystem', width: 100,
                  cell: ({ value }) => (
                    <Text style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: 'var(--dt-colors-background-base-default)',
                      border: '1px solid var(--dt-colors-border-neutral-default)',
                      fontFamily: 'monospace',
                    }}>{String(value ?? '—')}</Text>
                  ),
                },
                {
                  header: 'Queries', id: 'queryCount', accessor: 'queryCount', width: 80,
                  cell: ({ value }) => <Text style={{ fontWeight: 600 }}>{fmt(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Avg Lat', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)) }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Err%', id: 'errorRate', accessor: 'errorRate', width: 60,
                  cell: ({ value }) => {
                    const r = Number(value ?? 0);
                    return <Text style={{ color: r > 1 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{r.toFixed(1)}%</Text>;
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              {loading ? 'Loading…' : 'No namespace/index data — requires db.namespace or db.name attributes on vector store spans'}
            </Text>
          )}
        </Surface>
      </Flex>
          </Flex>
        </Tab>

        <Tab title="Data Quality">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      {/* Semantic Cache Opportunities */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <DatabaseIcon />
          <Heading level={4}>Semantic Cache Opportunities</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>repeated Pinecone queries that could be cached</Text>
        </Flex>
        {cacheCandidates.length > 0 ? (
          <DataTable
            data={cacheCandidates}
            columns={[
              {
                header: 'Query Preview',
                id: 'queryPreview',
                accessor: 'queryPreview',
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--dt-colors-text-secondary-default)' }}>
                    {String(value ?? '').slice(0, 60) + (String(value ?? '').length > 60 ? '…' : '')}
                  </Text>
                ),
              },
              {
                header: 'Repeats',
                id: 'count',
                accessor: 'count',
                width: 80,
                cell: ({ value }) => (
                  <Text style={{ fontWeight: 600, color: Number(value ?? 0) > 10 ? STATUS_COLORS.warning : 'inherit' }}>
                    {fmt(Number(value ?? 0))}
                  </Text>
                ),
              },
              {
                header: 'Avg Latency',
                id: 'avgLatencyMs',
                accessor: 'avgLatencyMs',
                width: 100,
                cell: ({ value }) => <Text>{fmtMs(Number(value ?? 0))}</Text>,
              },
              {
                header: 'Savings',
                id: 'savingsPotentialMs',
                accessor: 'savingsPotentialMs',
                width: 100,
                cell: ({ value }) => (
                  <Text style={{ color: STATUS_COLORS.ideal, fontWeight: 600 }}>
                    {fmtMs(Number(value ?? 0))}
                  </Text>
                ),
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            {loading ? 'Loading…' : 'No repeated queries detected'}
          </Text>
        )}
      </Surface>

      {/* Tokenization Drift + Retrieval Anomalies */}
      <Flex gap={16} flexWrap="wrap">
        {/* Tokenization Drift */}
        <Surface style={{ flex: '1 1 55%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 4 }}>
            <ResearchIcon />
            <Heading level={4}>Tokenization Drift</Heading>
            <Tooltip text="Rising prompt token averages signal context bloat (larger retrieved chunks). Falling averages may indicate context truncation or retrieval degradation.">
              <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
            </Tooltip>
          </Flex>
          {tokenDriftSeries.length > 0 ? (
            <TimeseriesChart data={tokenDriftSeries} style={{ height: 180 }} />
          ) : (
            <Flex flexDirection="column" gap={8} alignItems="center" justifyContent="center" style={{ height: 140 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No token usage data detected'}
              </Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                Requires spans with gen_ai.usage.prompt_tokens or gen_ai.usage.input_tokens
              </Text>
            </Flex>
          )}
          {tokenizationDrift.length > 0 && (() => {
            const latest = tokenizationDrift[tokenizationDrift.length - 1];
            const prev = tokenizationDrift.length > 1 ? tokenizationDrift[tokenizationDrift.length - 2] : null;
            const drift = prev && prev.avgPromptTokens > 0
              ? ((latest.avgPromptTokens - prev.avgPromptTokens) / prev.avgPromptTokens) * 100
              : 0;
            return (
              <Flex gap={12} flexWrap="wrap" style={{ marginTop: 12 }}>
                <MetricCard value={fmt(latest.avgPromptTokens, 0)} label="Latest Avg Prompt Tokens" icon={<AiIcon style={{ width: 16, height: 16 }} />} />
                <MetricCard value={fmt(latest.p95PromptTokens, 0)} label="p95 Prompt Tokens" icon={<BarChartIcon style={{ width: 16, height: 16 }} />} color={latest.p95PromptTokens > 4000 ? STATUS_COLORS.warning : undefined} />
                <MetricCard
                  value={`${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%`}
                  label="Hour-over-hour drift"
                  icon={<ResearchIcon style={{ width: 16, height: 16 }} />}
                  color={Math.abs(drift) > 20 ? STATUS_COLORS.warning : STATUS_COLORS.ideal}
                />
              </Flex>
            );
          })()}
        </Surface>

        {/* Retrieval Anomalies */}
        <Surface style={{ flex: '1 1 40%', padding: 16, minWidth: 260 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <WarningIcon style={{ color: anomalyCount > 0 ? STATUS_COLORS.warning : 'inherit' }} />
            <Heading level={4}>Retrieval Anomalies</Heading>
            <Tooltip text="Hours where p99 latency is ≥3× the average. Indicates heavy-tail spikes from index fragmentation, large result sets, cold cache, or network blips.">
              <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
            </Tooltip>
            {anomalyCount > 0 && (
              <Text style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                background: `${STATUS_COLORS.warning}25`, color: STATUS_COLORS.warning,
              }}>
                {anomalyCount} anomalous hour{anomalyCount > 1 ? 's' : ''}
              </Text>
            )}
          </Flex>
          {retrievalAnomalies.length > 0 ? (
            <DataTable
              data={retrievalAnomalies.filter((a) => a.isAnomalous).slice(0, 10).concat(
                retrievalAnomalies.filter((a) => !a.isAnomalous).slice(0, Math.max(0, 8 - retrievalAnomalies.filter((a) => a.isAnomalous).length))
              )}
              columns={[
                {
                  header: 'Hour', id: 'timestamp', accessor: 'timestamp', width: 90,
                  cell: ({ value, rowData }) => {
                    const a = rowData as any;
                    return (
                      <Flex alignItems="center" gap={4}>
                        {a.isAnomalous && <CriticalIcon style={{ width: 12, height: 12, color: STATUS_COLORS.warning }} />}
                        <Text style={{ fontSize: 11 }}>
                          {value ? formatTime(String(Number(value))) : '—'}
                        </Text>
                      </Flex>
                    );
                  },
                },
                {
                  header: 'Avg Lat', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)) }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'p99 Lat', id: 'p99LatencyMs', accessor: 'p99LatencyMs', width: 80,
                  cell: ({ value }) => <Text style={{ fontWeight: 600, color: latencyColor(Number(value ?? 0)) }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'p99/avg', id: 'anomalyRatio', accessor: 'anomalyRatio', width: 70,
                  cell: ({ value, rowData }) => {
                    const ratio = Number(value ?? 0);
                    const a = rowData as any;
                    return (
                      <Text style={{ fontWeight: 600, color: a.isAnomalous ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
                        {ratio.toFixed(1)}×
                      </Text>
                    );
                  },
                },
                {
                  header: 'Queries', id: 'queryCount', accessor: 'queryCount', width: 70,
                  cell: ({ value }) => <Text>{fmt(Number(value ?? 0))}</Text>,
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={8} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              {loading ? 'Loading…' : 'No retrieval data in the selected timeframe'}
            </Text>
          )}
        </Surface>
      </Flex>

      {/* Context Retrieval Effectiveness */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <CheckmarkIcon />
          <Heading level={4}>Context Retrieval Effectiveness</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>success rate · latency by namespace</Text>
          <Tooltip text="Success rate = retrieval calls without error status. Low success rates surface per-namespace reliability gaps. Fallback namespace 'all' = db.system used when db.namespace is not set.">
            <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        </Flex>
        {contextEffectiveness.length > 0 ? (
          <DataTable
            data={contextEffectiveness}
            columns={[
              {
                header: 'Namespace', id: 'namespace', accessor: 'namespace',
                cell: ({ value }) => <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500 }}>{String(value ?? 'default')}</Text>,
              },
              {
                header: 'Success Rate', id: 'successRate', accessor: 'successRate', width: 280,
                cell: ({ value }) => {
                  const rate = Number(value ?? 0);
                  const color = rate >= 99 ? STATUS_COLORS.ideal : rate >= 95 ? STATUS_COLORS.good : rate >= 90 ? STATUS_COLORS.warning : STATUS_COLORS.critical;
                  return (
                    <Flex alignItems="center" gap={8}>
                      <ProgressBar value={rate} max={100} style={{ flex: 1, minWidth: 100 }} />
                      <Text style={{ minWidth: 50, textAlign: 'right', fontWeight: 700, color }}>
                        {rate.toFixed(1)}%
                      </Text>
                    </Flex>
                  );
                },
              },
              {
                header: 'Success', id: 'successfulQueries', accessor: 'successfulQueries', width: 80,
                cell: ({ value }) => <Text style={{ color: STATUS_COLORS.ideal }}>{fmt(Number(value ?? 0))}</Text>,
              },
              {
                header: 'Failed', id: 'failedQueries', accessor: 'failedQueries', width: 70,
                cell: ({ value }) => {
                  const v = Number(value ?? 0);
                  return <Text style={{ color: v > 0 ? STATUS_COLORS.critical : 'inherit' }}>{fmt(v)}</Text>;
                },
              },
              {
                header: 'Avg Latency', id: 'avgLatencyMs', accessor: 'avgLatencyMs', width: 100,
                cell: ({ value }) => <Text style={{ color: latencyColor(Number(value ?? 0)) }}>{fmtMs(Number(value ?? 0))}</Text>,
              },
              {
                header: 'p95 Latency', id: 'p95LatencyMs', accessor: 'p95LatencyMs', width: 100,
                cell: ({ value }) => <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>,
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            {loading ? 'Loading…' : 'No context retrieval data — requires vector store spans without upsert operations'}
          </Text>
        )}
      </Surface>
          </Flex>
        </Tab>

        <Tab title="Live View">
          <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>

      {/* ─── Pipeline Funnel ─── */}
      <Surface style={{ padding: 20 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 16 }}>
          <AiIcon />
          <Heading level={4}>RAG Pipeline Funnel</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>stage throughput · drop-off rates</Text>
          <Tooltip text="Shows how many requests flow through each RAG stage. Drop-off % indicates requests that didn't reach the next stage — useful for identifying pipeline breaks.">
            <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        </Flex>
        {pipelineFlowStages.length > 0 ? (
          <PipelineFunnel stages={pipelineFlowStages} />
        ) : (
          <Flex alignItems="center" justifyContent="center" style={{ height: 160 }}>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No pipeline flow data'}</Text>
          </Flex>
        )}
      </Surface>

      {/* ─── Latency Histogram ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <BarChartIcon />
          <Heading level={4}>Latency Distribution</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>all RAG spans · histogram by latency band</Text>
          <Tooltip text="Distribution of span durations across latency bands. Bimodal distributions (fast cache hits + slow misses) are invisible in percentile tables but clearly visible here.">
            <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        </Flex>
        {latencyBuckets.some((b) => b.spanCount > 0) ? (() => {
          const maxBucket = Math.max(...latencyBuckets.map((b) => b.spanCount), 1);
          const totalSpans = latencyBuckets.reduce((s, b) => s + b.spanCount, 0);
          return (
            <Flex flexDirection="column" gap={4}>
              {latencyBuckets.map((b) => {
                const pct = totalSpans > 0 ? (b.spanCount / totalSpans * 100) : 0;
                const widthPct = maxBucket > 0 ? (b.spanCount / maxBucket * 100) : 0;
                const isHigh = b.bucket.includes('2-5s') || b.bucket.includes('5s+');
                const barColor = isHigh ? STATUS_COLORS.critical
                  : b.bucket.includes('1-2s') || b.bucket.includes('500ms') ? STATUS_COLORS.warning
                  : Colors.Charts.Categorical.Color01.Default;
                return (
                  <Flex key={b.bucket} alignItems="center" gap={8}>
                    <Text style={{ fontSize: 11, minWidth: 80, textAlign: 'right', color: 'var(--dt-colors-text-secondary-default)' }}>
                      {b.bucket}
                    </Text>
                    <Flex style={{ flex: 1, height: 24, position: 'relative' }}>
                      <Flex style={{
                        width: `${Math.max(widthPct, 1)}%`, height: '100%', borderRadius: 4,
                        background: barColor, opacity: 0.7,
                        transition: 'width 0.4s ease-out',
                      }} />
                    </Flex>
                    <Text style={{ fontSize: 12, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                      {fmt(b.spanCount)}
                    </Text>
                    <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)', minWidth: 45, textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </Text>
                  </Flex>
                );
              })}
              <Flex gap={8} style={{ marginTop: 8, paddingLeft: 88 }}>
                <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                  Total: {fmt(totalSpans)} spans
                </Text>
              </Flex>
            </Flex>
          );
        })() : (
          <Flex alignItems="center" justifyContent="center" style={{ height: 160 }}>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No latency data'}</Text>
          </Flex>
        )}
      </Surface>

      {/* ─── Row: Heatmap + TreeMap ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Latency Heatmap */}
        <Surface style={{ flex: '1 1 55%', padding: 16, minWidth: 420 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <BarChartIcon />
            <Heading level={4}>Retrieval Latency Heatmap</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>avg latency · hour of day × day of week</Text>
          </Flex>
          {heatmapCells.length > 0 ? (
            <LatencyHeatmap cells={heatmapCells} />
          ) : (
            <Flex alignItems="center" justifyContent="center" style={{ height: 240 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No heatmap data'}</Text>
            </Flex>
          )}
        </Surface>

        {/* Token Distribution TreeMap */}
        <Surface style={{ flex: '1 1 40%', padding: 16, minWidth: 320 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <ResearchIcon />
            <Heading level={4}>Token Distribution</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>by provider → model</Text>
          </Flex>
          {tokenTreemap.length > 0 ? (
            <TokenDistributionTreeMap entries={tokenTreemap} />
          ) : (
            <Flex alignItems="center" justifyContent="center" style={{ height: 240 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No token data'}</Text>
            </Flex>
          )}
        </Surface>
      </Flex>

      {/* ─── Model Honeycomb Grid ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <DatabaseIcon />
          <Heading level={4}>AI Model Landscape</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>each tile = one model · color = avg latency · hover for details</Text>
        </Flex>
        {modelHoneycomb.length > 0 ? (
          <HoneycombChart
            data={modelHoneycomb.map((m) => ({
              name: m.model,
              value: m.avgLatencyMs,
              provider: m.provider,
              requestCount: m.requestCount,
              totalTokens: m.totalTokens,
              errorRate: m.errorRate,
            }))}
            height={300}
          >
            <HoneycombChart.Legend />
          </HoneycombChart>
        ) : (
          <Flex alignItems="center" justifyContent="center" style={{ height: 200 }}>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No model data'}</Text>
          </Flex>
        )}
      </Surface>

          </Flex>
        </Tab>
      </Tabs>

      {/* ─── Trace Analysis Modal (outside tabs) ─── */}
      {selectedTrace && (
        <RAGTraceDetailModal trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
      )}
    </Flex>
  );
};
