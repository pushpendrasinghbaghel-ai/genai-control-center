// GenAI Control Center — MLOps Page
// Model Registry, AI SLOs, Model Comparison.
// All data sourced from real gen_ai.* DQL queries — no mock data, no arbitrary scores.

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Strong } from '@dynatrace/strato-components/typography';
import { Tab, Tabs } from '@dynatrace/strato-components/navigation';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { DataTable } from '@dynatrace/strato-components/tables';
import { DonutChart, TimeseriesChart, XYChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import { TextInput } from '@dynatrace/strato-components/forms';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import type { Timeframe } from '@dynatrace/strato-components/core';
import {
  RefreshIcon,
  AiIcon,
  CheckmarkIcon,
  CriticalIcon,
  WarningIcon,
  ServicesIcon,
  BarChartIcon,
  ClockIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';

import { useMLOps } from '../hooks/useMLOps';
import { createDefaultTimeframe } from '../components/FilterBar';
import type { MLOpsModelEntry, MLOpsSLOEntry, MLOpsSLOTrendPoint, MLOpsModelComparison } from '../types';

// ─── Helpers ────────────────────────────────────────────────

const fmt = (n: number): string => (isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—');
const fmtInt = (n: number): string => (isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—');
const fmtPct = (n: number): string => (isFinite(n) ? `${n.toFixed(2)}%` : '—');

const relTime = (iso: string): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  } catch { return iso; }
};

const STATUS_COLORS = {
  pass: Colors.Charts.Status.Ideal.Default,
  warning: Colors.Charts.Status.Warning.Default,
  fail: Colors.Charts.Status.Critical.Default,
  neutral: Colors.Charts.Categorical.Color01.Default,
};

// ─── Metric Card ────────────────────────────────────────────

const MetricCard = ({ label, value, icon, color }: { label: string; value: string | number; icon?: React.ReactNode; color?: string }) => (
  <Surface style={{ padding: 16, minWidth: 140, flex: 1 }}>
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" gap={6}>
        {icon}
        <Text style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Text>
      </Flex>
      <Text style={{ fontSize: 24, fontWeight: 700, color: color || 'inherit' }}>{value}</Text>
    </Flex>
  </Surface>
);

// ═══════════════════════════════════════════════════════════
// Tab 1: Model Registry
// ═══════════════════════════════════════════════════════════

const ModelRegistryTab = ({ data, usageTrend }: { data: MLOpsModelEntry[]; usageTrend: Array<{ model: string; timeBucket: string; requests: number; totalTokens: number }> }) => {
  // Build timeseries data for model usage trend
  const usageTimeseriesData = useMemo((): Timeseries[] => {
    if (!usageTrend.length) return [];
    const byModel = new Map<string, Array<{ timestamp: Date; value: number }>>();
    for (const pt of usageTrend) {
      if (!byModel.has(pt.model)) byModel.set(pt.model, []);
      byModel.get(pt.model)!.push({ timestamp: new Date(pt.timeBucket), value: pt.requests });
    }
    // Top 6 models by total requests
    const modelTotals = [...byModel.entries()].map(([m, pts]) => ({ model: m, total: pts.reduce((s, p) => s + p.value, 0), pts }));
    modelTotals.sort((a, b) => b.total - a.total);
    return modelTotals.slice(0, 6).map((m) => ({
      name: m.model,
      datapoints: m.pts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).map((p) => ({ start: p.timestamp, value: p.value })),
    }));
  }, [usageTrend]);

  // DonutChart: requests by provider
  const providerDonutData = useMemo(() => {
    const byProvider = new Map<string, number>();
    for (const m of data) {
      byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + m.requests);
    }
    return { slices: [...byProvider.entries()].map(([category, value]) => ({ category, value })) };
  }, [data]);
  const columns = useMemo(() => [
    {
      id: 'model',
      header: 'Model',
      accessor: (row: MLOpsModelEntry) => row.model,
      cell: ({ value }: { value: string }) => <Strong>{value}</Strong>,
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: (row: MLOpsModelEntry) => row.provider,
    },
    {
      id: 'requests',
      header: 'Requests',
      accessor: (row: MLOpsModelEntry) => row.requests,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmtInt(value)}</Text>,
    },
    {
      id: 'avgLatencyMs',
      header: 'Avg Latency (ms)',
      accessor: (row: MLOpsModelEntry) => row.avgLatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'p95LatencyMs',
      header: 'P95 (ms)',
      accessor: (row: MLOpsModelEntry) => row.p95LatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessor: (row: MLOpsModelEntry) => row.errorRate,
      cell: ({ value }: { value: number }) => (
        <Text style={{ color: value > 5 ? STATUS_COLORS.fail : value > 1 ? STATUS_COLORS.warning : STATUS_COLORS.pass }}>
          {fmtPct(value)}
        </Text>
      ),
    },
    {
      id: 'totalTokens',
      header: 'Total Tokens',
      accessor: (row: MLOpsModelEntry) => row.totalInputTokens + row.totalOutputTokens,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmtInt(value)}</Text>,
    },
    {
      id: 'services',
      header: 'Services',
      accessor: (row: MLOpsModelEntry) => row.services.length,
      cell: ({ value }: { value: number }) => <Text>{value}</Text>,
    },
    {
      id: 'firstSeen',
      header: 'First Seen',
      accessor: (row: MLOpsModelEntry) => row.firstSeen,
      cell: ({ value }: { value: string }) => <Text>{relTime(value)}</Text>,
    },
    {
      id: 'lastSeen',
      header: 'Last Active',
      accessor: (row: MLOpsModelEntry) => row.lastSeen,
      cell: ({ value }: { value: string }) => <Text>{relTime(value)}</Text>,
    },
  ], []);

  if (!data.length) return <Text>No models found in the selected timeframe.</Text>;

  return (
    <Flex flexDirection="column" gap={12}>
      <Text style={{ opacity: 0.7 }}>
        All model+provider combinations discovered from gen_ai.* spans. Sorted by request volume.
      </Text>

      {/* Visual row: Provider donut + Usage trend */}
      <Flex gap={16} flexWrap="wrap">
        {providerDonutData.slices.length > 0 && (
          <Surface style={{ flex: '1 1 280px', padding: 16 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <ServicesIcon style={{ width: 14, height: 14 }} />
                <Text style={{ fontWeight: 600, fontSize: 13 }}>Requests by Provider</Text>
              </Flex>
              <DonutChart data={providerDonutData} height={200}>
                <DonutChart.Legend position="right" />
                <DonutChart.Toolbar hidden />
              </DonutChart>
            </Flex>
          </Surface>
        )}
        {usageTimeseriesData.length > 0 && (
          <Surface style={{ flex: '2 1 400px', padding: 16 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <BarChartIcon style={{ width: 14, height: 14 }} />
                <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Usage Trend (Top 6)</Text>
              </Flex>
              <TimeseriesChart data={usageTimeseriesData} variant="bar" height={200}>
                <TimeseriesChart.Legend position="bottom" />
                <TimeseriesChart.Tooltip variant="shared" />
              </TimeseriesChart>
            </Flex>
          </Surface>
        )}
      </Flex>

      <DataTable data={data} columns={columns} sortable resizable>
        <DataTable.Pagination defaultPageSize={10} />
      </DataTable>
    </Flex>
  );
};

// ═══════════════════════════════════════════════════════════
// Tab 2: AI SLOs
// ═══════════════════════════════════════════════════════════

const SLOTab = ({
  data,
  sloConfig,
  onConfigChange,
  sloTrend,
}: {
  data: MLOpsSLOEntry[];
  sloConfig: { latencyThresholdMs: number; errorBudgetPct: number };
  onConfigChange: (cfg: { latencyThresholdMs: number; errorBudgetPct: number }) => void;
  sloTrend: MLOpsSLOTrendPoint[];
}) => {
  const passing = data.filter((e) => e.meetsLatencySlo && e.meetsErrorSlo).length;
  const failing = data.filter((e) => !e.meetsLatencySlo || !e.meetsErrorSlo).length;

  const columns = useMemo(() => [
    {
      id: 'service',
      header: 'Service',
      accessor: (row: MLOpsSLOEntry) => row.serviceName,
      cell: ({ value }: { value: string }) => <Strong>{value}</Strong>,
    },
    {
      id: 'model',
      header: 'Model',
      accessor: (row: MLOpsSLOEntry) => row.model,
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: (row: MLOpsSLOEntry) => row.provider,
    },
    {
      id: 'requests',
      header: 'Requests',
      accessor: (row: MLOpsSLOEntry) => row.totalRequests,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmtInt(value)}</Text>,
    },
    {
      id: 'latencyCompliance',
      header: `Latency SLO (< ${sloConfig.latencyThresholdMs}ms)`,
      accessor: (row: MLOpsSLOEntry) => row.latencyCompliance,
      cell: ({ value, rowData }: { value: number; rowData: MLOpsSLOEntry }) => (
        <Flex alignItems="center" gap={4}>
          {rowData.meetsLatencySlo
            ? <CheckmarkIcon style={{ color: STATUS_COLORS.pass, width: 14 }} />
            : <CriticalIcon style={{ color: STATUS_COLORS.fail, width: 14 }} />
          }
          <Text style={{ color: rowData.meetsLatencySlo ? STATUS_COLORS.pass : STATUS_COLORS.fail }}>
            {fmtPct(value)}
          </Text>
        </Flex>
      ),
    },
    {
      id: 'errorRate',
      header: `Error SLO (< ${sloConfig.errorBudgetPct}%)`,
      accessor: (row: MLOpsSLOEntry) => row.errorRate,
      cell: ({ value, rowData }: { value: number; rowData: MLOpsSLOEntry }) => (
        <Flex alignItems="center" gap={4}>
          {rowData.meetsErrorSlo
            ? <CheckmarkIcon style={{ color: STATUS_COLORS.pass, width: 14 }} />
            : <CriticalIcon style={{ color: STATUS_COLORS.fail, width: 14 }} />
          }
          <Text style={{ color: rowData.meetsErrorSlo ? STATUS_COLORS.pass : STATUS_COLORS.fail }}>
            {fmtPct(value)}
          </Text>
        </Flex>
      ),
    },
    {
      id: 'errorBudget',
      header: 'Error Budget Remaining',
      accessor: (row: MLOpsSLOEntry) => row.errorBudgetRemaining,
      cell: ({ value }: { value: number }) => (
        <Text style={{ color: value >= 0 ? STATUS_COLORS.pass : STATUS_COLORS.fail }}>
          {value >= 0 ? `${value.toFixed(3)}%` : `${value.toFixed(3)}% (EXHAUSTED)`}
        </Text>
      ),
    },
    {
      id: 'p95',
      header: 'P95 (ms)',
      accessor: (row: MLOpsSLOEntry) => row.p95LatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
  ], [sloConfig]);

  return (
    <Flex flexDirection="column" gap={16}>
      {/* SLO Config */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={16} flexWrap="wrap">
          <Text><Strong>SLO Thresholds:</Strong></Text>
          <Flex alignItems="center" gap={6}>
            <Text>Latency &lt;</Text>
            <TextInput
              value={String(sloConfig.latencyThresholdMs)}
              onChange={(val) => { const n = parseInt(val || '3000', 10); if (n > 0) onConfigChange({ ...sloConfig, latencyThresholdMs: n }); }}
              style={{ width: 80 }}
            />
            <Text>ms</Text>
          </Flex>
          <Flex alignItems="center" gap={6}>
            <Text>Error budget &lt;</Text>
            <TextInput
              value={String(sloConfig.errorBudgetPct)}
              onChange={(val) => { const n = parseFloat(val || '1.0'); if (n >= 0) onConfigChange({ ...sloConfig, errorBudgetPct: n }); }}
              style={{ width: 60 }}
            />
            <Text>%</Text>
          </Flex>
          <Text style={{ opacity: 0.6, fontSize: 11 }}>
            Compliance is computed from actual span data. &ldquo;Latency SLO&rdquo; = % requests faster than threshold. &ldquo;Error SLO&rdquo; = error rate within budget.
          </Text>
        </Flex>
      </Surface>

      {/* Summary */}
      <Flex gap={12}>
        <MetricCard
          label="Passing"
          value={passing}
          icon={<CheckmarkIcon style={{ color: STATUS_COLORS.pass, width: 16 }} />}
          color={STATUS_COLORS.pass}
        />
        <MetricCard
          label="Failing"
          value={failing}
          icon={<CriticalIcon style={{ color: STATUS_COLORS.fail, width: 16 }} />}
          color={failing > 0 ? STATUS_COLORS.fail : STATUS_COLORS.pass}
        />
        <MetricCard
          label="Total Endpoints"
          value={data.length}
          icon={<ServicesIcon style={{ width: 16 }} />}
        />
      </Flex>

      {/* SLO Trend Chart */}
      {sloTrend.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <ClockIcon style={{ width: 14, height: 14 }} />
              <Text style={{ fontWeight: 600, fontSize: 13 }}>SLO Compliance Trend</Text>
              <Text style={{ fontSize: 11, opacity: 0.6 }}>(hourly latency compliance %)</Text>
            </Flex>
            <TimeseriesChart
              data={[{
                name: 'Latency Compliance',
                datapoints: sloTrend.map((p) => ({ start: new Date(p.timeBucket), value: p.latencyCompliance })),
              }]}
              variant="area"
              height={180}
              colorPalette={[STATUS_COLORS.pass]}
            >
              <TimeseriesChart.Tooltip variant="shared" />
              <TimeseriesChart.Legend hidden />
            </TimeseriesChart>
          </Flex>
        </Surface>
      )}

      {data.length === 0
        ? <Text>No SLO data available in the selected timeframe.</Text>
        : <DataTable data={data} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
      }
    </Flex>
  );
};

// ═══════════════════════════════════════════════════════════
// Tab 3: Model Comparison
// ═══════════════════════════════════════════════════════════

const ModelComparisonTab = ({ data }: { data: MLOpsModelComparison[] }) => {
  const columns = useMemo(() => [
    {
      id: 'model',
      header: 'Model',
      accessor: (row: MLOpsModelComparison) => row.model,
      cell: ({ value }: { value: string }) => <Strong>{value}</Strong>,
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: (row: MLOpsModelComparison) => row.provider,
    },
    {
      id: 'requests',
      header: 'Requests',
      accessor: (row: MLOpsModelComparison) => row.requests,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmtInt(value)}</Text>,
    },
    {
      id: 'avgLatency',
      header: 'Avg Latency (ms)',
      accessor: (row: MLOpsModelComparison) => row.avgLatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'p50',
      header: 'P50 (ms)',
      accessor: (row: MLOpsModelComparison) => row.p50LatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'p95',
      header: 'P95 (ms)',
      accessor: (row: MLOpsModelComparison) => row.p95LatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'p99',
      header: 'P99 (ms)',
      accessor: (row: MLOpsModelComparison) => row.p99LatencyMs,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'avgInput',
      header: 'Avg Input Tokens',
      accessor: (row: MLOpsModelComparison) => row.avgInput,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'avgOutput',
      header: 'Avg Output Tokens',
      accessor: (row: MLOpsModelComparison) => row.avgOutput,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{fmt(value)}</Text>,
    },
    {
      id: 'tokenEfficiency',
      header: 'Token Efficiency (out/in)',
      accessor: (row: MLOpsModelComparison) => row.tokenEfficiency,
      cell: ({ value }: { value: number }) => <Text style={{ textAlign: 'right', display: 'block' }}>{value.toFixed(3)}</Text>,
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessor: (row: MLOpsModelComparison) => row.errorRate,
      cell: ({ value }: { value: number }) => (
        <Text style={{ color: value > 5 ? STATUS_COLORS.fail : value > 1 ? STATUS_COLORS.warning : STATUS_COLORS.pass }}>
          {fmtPct(value)}
        </Text>
      ),
    },
  ], []);

  if (!data.length) return <Text>No model data found in the selected timeframe.</Text>;

  // Sort by latency for horizontal bar chart
  const sortedByLatency = [...data].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs).slice(0, 10);
  const maxLatency = Math.max(...sortedByLatency.map((m) => m.avgLatencyMs), 1);

  return (
    <Flex flexDirection="column" gap={12}>
      <Text style={{ opacity: 0.7 }}>
        Side-by-side performance comparison of all models. Latency percentiles, token usage, and error rates are computed directly from span data.
      </Text>

      {/* Latency comparison bar chart */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={6}>
            <ClockIcon style={{ width: 14, height: 14 }} />
            <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Latency Comparison (Avg)</Text>
          </Flex>
          <Flex flexDirection="column" gap={6}>
            {sortedByLatency.map((m) => {
              const barColor = m.avgLatencyMs < 1000 ? STATUS_COLORS.pass : m.avgLatencyMs < 3000 ? STATUS_COLORS.warning : STATUS_COLORS.fail;
              return (
                <Flex key={`${m.model}-${m.provider}`} flexDirection="column" gap={2}>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text style={{ fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.model} <span style={{ opacity: 0.5 }}>({m.provider})</span>
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: barColor }}>{fmt(m.avgLatencyMs)}ms</Text>
                  </Flex>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--dt-colors-background-container-neutral-subdued)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(m.avgLatencyMs / maxLatency) * 100}%`, borderRadius: 4, background: barColor, transition: 'width 0.3s ease' }} />
                  </div>
                </Flex>
              );
            })}
            <Flex gap={12} style={{ marginTop: 4 }}>
              <Flex alignItems="center" gap={4}><span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.pass }} /><Text style={{ fontSize: 10, opacity: 0.6 }}>&lt;1s</Text></Flex>
              <Flex alignItems="center" gap={4}><span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.warning }} /><Text style={{ fontSize: 10, opacity: 0.6 }}>1-3s</Text></Flex>
              <Flex alignItems="center" gap={4}><span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.fail }} /><Text style={{ fontSize: 10, opacity: 0.6 }}>&gt;3s</Text></Flex>
            </Flex>
          </Flex>
        </Flex>
      </Surface>

      {/* Model Efficiency Frontier — Scatter: Latency vs Token Efficiency */}
      <Surface style={{ padding: 16 }}>
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={6}>
            <AiIcon style={{ width: 14, height: 14 }} />
            <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Efficiency Frontier</Text>
            <span style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</span>
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.6 }}>
            Models in the bottom-right quadrant (high efficiency, low latency) are on the efficiency frontier — optimal performance per token.
          </Text>
          {(() => {
            // Only show completion models (filter out embedding models with 0 output)
            const completionModels = data.filter(m => m.tokenEfficiency > 0 && m.avgLatencyMs > 0);
            if (completionModels.length < 2) return <Text textStyle="small" style={{ opacity: 0.5, padding: 16 }}>Need at least 2 completion models to display efficiency frontier.</Text>;

            const scatterData = completionModels.map(m => ({
              seriesName: m.model,
              x0: m.avgLatencyMs,
              y0: m.tokenEfficiency,
            }));

            return (
              <div style={{ height: 300 }}>
                <XYChart data={scatterData} colorPalette="categorical">
                  <XYChart.DotSeries
                    xAxisId="latency-axis"
                    yAxisId="efficiency-axis"
                    x0Accessor="x0"
                    y0Accessor="y0"
                    nameAccessor="seriesName"
                  />
                  <XYChart.XAxis id="latency-axis" type="numerical" position="bottom" label="Avg Latency (ms)" />
                  <XYChart.YAxis id="efficiency-axis" type="numerical" position="left" label="Token Efficiency (output/input)" />
                </XYChart>
              </div>
            );
          })()}
          {/* Frontier summary — top 3 most efficient models */}
          {(() => {
            const completionModels = data.filter(m => m.tokenEfficiency > 0 && m.avgLatencyMs > 0);
            if (completionModels.length === 0) return null;
            // Efficiency frontier score: higher efficiency + lower latency = better
            const sorted = [...completionModels].sort((a, b) => (a.avgLatencyMs / Math.max(a.tokenEfficiency, 0.01)) - (b.avgLatencyMs / Math.max(b.tokenEfficiency, 0.01)));
            const frontier = sorted.slice(0, 3);
            return (
              <Flex gap={8} style={{ marginTop: 4 }}>
                {frontier.map((m, i) => (
                  <Surface key={m.model} style={{ flex: 1, padding: 10, borderLeft: `3px solid ${i === 0 ? STATUS_COLORS.pass : STATUS_COLORS.neutral}` }}>
                    <Flex flexDirection="column" gap={2}>
                      <Text style={{ fontSize: 10, opacity: 0.5 }}>{i === 0 ? '🏆 Best' : `#${i + 1}`}</Text>
                      <Text style={{ fontSize: 12, fontWeight: 600 }}>{m.model}</Text>
                      <Text style={{ fontSize: 10, opacity: 0.6 }}>{fmt(m.avgLatencyMs)}ms · {m.tokenEfficiency.toFixed(2)} eff · {fmtInt(m.requests)} req</Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            );
          })()}
        </Flex>
      </Surface>

      <DataTable data={data} columns={columns} sortable resizable>
        <DataTable.Pagination defaultPageSize={10} />
      </DataTable>
    </Flex>
  );
};

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

export const MLOps = () => {
  const [timeframe, setTimeframe] = useState<Timeframe | null>(createDefaultTimeframe());

  const {
    registry,
    sloEntries,
    sloTrend,
    comparison,
    usageTrend,
    sloConfig,
    setSloConfig,
    loading,
    error,
    lastRefresh,
    refetch,
    totalModels,
    totalProviders,
    totalRequests,
    sloViolationCount,
  } = useMLOps();

  // Initial load
  useEffect(() => {
    refetch(timeframe);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    refetch(timeframe);
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    refetch(tf);
  };

  return (
    <Flex flexDirection="column" gap={16} style={{ padding: '0 16px 16px' }}>
      {/* Title Bar */}
      <TitleBar>
        <TitleBar.Title>MLOps</TitleBar.Title>
        <TitleBar.Subtitle>
          Model Registry, SLOs &amp; Comparison — all from live gen_ai.* span data
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex alignItems="center" gap={8}>
            <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} />
            <Tooltip text="Refresh all data">
              <Button onClick={handleRefresh} disabled={loading}>
                <Button.Prefix><RefreshIcon /></Button.Prefix>
              </Button>
            </Tooltip>
            {lastRefresh && (
              <Text style={{ fontSize: 11, opacity: 0.5 }}>
                Updated {relTime(lastRefresh.toISOString())}
              </Text>
            )}
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Error banner */}
      {error && (
        <Surface style={{ padding: 12, borderLeft: `3px solid ${STATUS_COLORS.fail}` }}>
          <Text style={{ color: STATUS_COLORS.fail }}>{error.message}</Text>
        </Surface>
      )}

      {/* Loading state */}
      {loading && (
        <Flex justifyContent="center" style={{ padding: 32 }}>
          <ProgressCircle />
        </Flex>
      )}

      {/* Summary metrics */}
      {!loading && (
        <Flex gap={12} flexWrap="wrap">
          <MetricCard label="Models" value={totalModels} icon={<AiIcon style={{ width: 16 }} />} />
          <MetricCard label="Providers" value={totalProviders} icon={<ServicesIcon style={{ width: 16 }} />} />
          <MetricCard label="Total Requests" value={fmtInt(totalRequests)} icon={<BarChartIcon style={{ width: 16 }} />} />
          <MetricCard
            label="SLO Violations"
            value={sloViolationCount}
            icon={<WarningIcon style={{ width: 16, color: sloViolationCount > 0 ? STATUS_COLORS.warning : STATUS_COLORS.pass }} />}
            color={sloViolationCount > 0 ? STATUS_COLORS.warning : STATUS_COLORS.pass}
          />
        </Flex>
      )}

      {/* Tabs */}
      {!loading && (
        <Tabs>
          <Tab title="Model Registry" prefixIcon={<AiIcon />}>
            <ModelRegistryTab data={registry} usageTrend={usageTrend} />
          </Tab>
          <Tab title="AI SLOs" prefixIcon={<CheckmarkIcon />}>
            <SLOTab data={sloEntries} sloConfig={sloConfig} onConfigChange={setSloConfig} sloTrend={sloTrend} />
          </Tab>
          <Tab title="Model Comparison" prefixIcon={<BarChartIcon />}>
            <ModelComparisonTab data={comparison} />
          </Tab>
        </Tabs>
      )}
    </Flex>
  );
};
