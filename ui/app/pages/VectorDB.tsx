// RAG / Vector DB Observability Dashboard
// Surfaces Viatris Domain 3 metrics: Vector store health, embedding pipelines, RAG pipeline E2E
// Data: ~115K Pinecone spans/week + ~113K embedding spans/week

import React, { useState, useMemo, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import {
  RefreshIcon, DatabaseIcon, BarChartIcon, WarningIcon,
  CheckmarkIcon, HelpIcon, CriticalIcon, AiIcon,
  ClockIcon, ResearchIcon, ExternalLinkIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useVectorDB } from '../hooks/useVectorDB';
import { createDefaultTimeframe } from '../context';
import type { QueryFilters } from '../hooks/useDQLQueries';
import type { RAGPipelineTrace } from '../types';

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

/**
 * Open a specific trace in the Dynatrace Distributed Tracing app
 * Uses the same intent-based navigation pattern as AgentTools / Governance pages
 */
const openTraceInDistributedTraces = (traceId: string, timestamp?: string): void => {
  const timeDate = timestamp ? new Date(timestamp) : new Date();
  const startTime = new Date(timeDate.getTime() - 10 * 60 * 1000).toISOString();
  const endTime = new Date(timeDate.getTime() + 10 * 60 * 1000).toISOString();
  const intentUrl = getIntentLink(
    {
      'trace_id': traceId,
      'dt.timeframe': { from: startTime, to: endTime },
    },
    'dynatrace.distributedtracing',
    'view-trace'
  );
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
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
    <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>
        {value}
      </div>
      <Flex alignItems="center" gap={4}>
        <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</div>
        {tooltip && (
          <Tooltip text={tooltip}>
            <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        )}
      </Flex>
    </div>
  </Flex>
);

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
  const filters: QueryFilters = { timeframe };

  const {
    latency, volumeTimeseries, cacheCandidates, summary,
    embeddingProviders, embeddingTimeseries,
    pipelineTraces,
    ttftByModel, ttftSummary,
    chainSteps,
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

      {/* ─── Row 2: Latency Percentiles + Embedding Providers ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Latency Cards */}
        <Surface style={{ padding: 16 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <BarChartIcon />
            <Heading level={4}>Pinecone Latency Percentiles</Heading>
          </Flex>
          <Flex gap={8}>
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

        {/* Embedding Providers Table */}
        <Surface style={{ flex: 1, padding: 16, minWidth: 340 }}>
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

      {/* ─── Row 3: RAG Chain Performance ─── */}
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
                    <span style={{
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

      {/* ─── Row 4: RAG Pipeline Traces + TTFT ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Full RAG Pipeline Traces */}
        <Surface style={{ flex: '1 1 55%', padding: 16, minWidth: 320 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <DatabaseIcon />
            <Heading level={4}>Top Slowest RAG Pipeline Traces</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>embed / retrieve / generate steps detected</Text>
          </Flex>
          {pipelineTraces.length > 0 ? (
            <DataTable
              data={pipelineTraces}
              columns={[
                {
                  header: 'Trace ID',
                  id: 'traceId',
                  accessor: 'traceId',
                  width: 160,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--dt-colors-text-secondary-default)' }}>
                      {String(value ?? '').slice(0, 16)}…
                    </Text>
                  ),
                },
                {
                  header: 'E2E Latency',
                  id: 'totalDurationMs',
                  accessor: 'totalDurationMs',
                  width: 100,
                  cell: ({ value }) => {
                    const ms = Number(value ?? 0);
                    return <Text style={{ color: latencyColor(ms), fontWeight: 600 }}>{fmtMs(ms)}</Text>;
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
                  header: 'Pipeline',
                  id: 'isFullPipeline',
                  accessor: 'isFullPipeline',
                  width: 100,
                  cell: ({ rowData }) => {
                    const t = rowData as RAGPipelineTrace;
                    return (
                      <Flex gap={4}>
                        {(['E', 'R', 'G'] as const).map((badge, i) => {
                          const active = i === 0 ? t.hasEmbed : i === 1 ? t.hasRetrieve : t.hasGenerate;
                          const color =
                            i === 0 ? CHART_COLORS.embeddings
                            : i === 1 ? CHART_COLORS.pinecone
                            : Colors.Charts.Categorical.Color02.Default;
                          return (
                            <Text
                              key={badge}
                              style={{
                                fontSize: 10,
                                padding: '2px 5px',
                                borderRadius: 3,
                                background: active ? `${color}30` : 'var(--dt-colors-background-base-default)',
                                color: active ? color : 'var(--dt-colors-text-secondary-default)',
                                border: `1px solid ${active ? color : 'var(--dt-colors-border-neutral-default)'}`,
                                fontWeight: 600,
                              }}
                            >
                              {badge}
                            </Text>
                          );
                        })}
                      </Flex>
                    );
                  },
                },
                {
                  header: '',
                  id: 'actions',
                  accessor: 'traceId',
                  width: 48,
                  cell: ({ value }) => {
                    const id = String(value ?? '');
                    if (!id) return <span />;
                    return (
                      <Tooltip text={`Open in Distributed Tracing: ${id.slice(0, 16)}…`}>
                        <Button variant="default" onClick={() => openTraceInDistributedTraces(id)}>
                          <ExternalLinkIcon style={{ width: 14, height: 14 }} />
                        </Button>
                      </Tooltip>
                    );
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{loading ? 'Loading…' : 'No RAG pipeline traces found'}</Text>
          )}
        </Surface>

        {/* TTFT by Model */}
        <Surface style={{ flex: '1 1 40%', padding: 16, minWidth: 280 }}>
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
                  width: 180,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                  ),
                },
                {
                  header: 'Avg TTFT',
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
                  header: 'p95 TTFT',
                  id: 'p95TtftMs',
                  accessor: 'p95TtftMs',
                  width: 80,
                  cell: ({ value }) => <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{fmtMs(Number(value ?? 0))}</Text>,
                },
                {
                  header: 'Rating',
                  id: 'rating',
                  accessor: 'avgTtftMs',
                  width: 80,
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

      {/* ─── Row 5: Cache Candidates + Agent Retries ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Cache Candidates */}
        <Surface style={{ flex: '1 1 50%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <DatabaseIcon />
            <Heading level={4}>Semantic Cache Opportunities</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>repeated Pinecone queries</Text>
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
                  header: 'Savings Potential',
                  id: 'savingsPotentialMs',
                  accessor: 'savingsPotentialMs',
                  width: 120,
                  cell: ({ value }) => (
                    <Text style={{ color: STATUS_COLORS.ideal, fontWeight: 600 }}>
                      {fmtMs(Number(value ?? 0))}
                    </Text>
                  ),
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              {loading ? 'Loading…' : 'No repeated queries detected'}
            </Text>
          )}
        </Surface>

      </Flex>
    </Flex>
  );
};
