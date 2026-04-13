// GenAI Control Center — MLOps Page
// Narrative flow: Fleet Summary → Needs Attention → Performance → SLOs → Registry
// All data from real gen_ai.* DQL queries — no mock data, no arbitrary scores.

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface, TitleBar } from '@dynatrace/strato-components/layouts';
import { Text, Strong } from '@dynatrace/strato-components/typography';
import { Tab, Tabs } from '@dynatrace/strato-components/navigation';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { DataTable } from '@dynatrace/strato-components/tables';
import { DonutChart, TimeseriesChart, XYChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
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

import { useMLOps } from '../hooks/useMLOps';
import { createDefaultTimeframe } from '../components/FilterBar';
import { StatusColors, CssTokens } from '../utils/design-tokens';
import { formatNumber, formatPercent, formatDurationMs, formatRelativeTime } from '../utils/formatting';
import type { MLOpsModelEntry, MLOpsSLOEntry, MLOpsSLOTrendPoint, MLOpsModelComparison } from '../types';

// ─── Metric Card ────────────────────────────────────────────

const MetricCard = ({ label, value, icon, color }: { label: string; value: string | number; icon?: React.ReactNode; color?: string }) => (
  <Surface style={{ padding: 16, minWidth: 140, flex: '1 1 140px' }}>
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" gap={6}>
        {icon}
        <Text style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Text>
      </Flex>
      <Text style={{ fontSize: 24, fontWeight: 700, color: color || 'inherit' }}>{value}</Text>
    </Flex>
  </Surface>
);

// ─── Needs Attention Panel ──────────────────────────────────

interface AttentionItem {
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
}

const NeedsAttentionPanel = ({ items }: { items: AttentionItem[] }) => {
  if (items.length === 0) return null;
  const criticalCount = items.filter(i => i.severity === 'critical').length;

  return (
    <Surface style={{
      padding: 16,
      borderLeft: `3px solid ${criticalCount > 0 ? StatusColors.critical : StatusColors.warning}`,
    }}>
      <Flex flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={8}>
          <WarningIcon style={{ width: 18, height: 18, color: criticalCount > 0 ? StatusColors.critical : StatusColors.warning }} />
          <Text style={{ fontWeight: 600, fontSize: 14 }}>
            {items.length} issue{items.length !== 1 ? 's' : ''} need{items.length === 1 ? 's' : ''} attention
          </Text>
        </Flex>
        <Flex flexDirection="column" gap={6}>
          {items.slice(0, 5).map((item, i) => (
            <Flex key={i} alignItems="flex-start" gap={8}>
              {item.severity === 'critical'
                ? <CriticalIcon style={{ width: 14, height: 14, color: StatusColors.critical, flexShrink: 0, marginTop: 2 }} />
                : <WarningIcon style={{ width: 14, height: 14, color: StatusColors.warning, flexShrink: 0, marginTop: 2 }} />
              }
              <Flex flexDirection="column" gap={2}>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</Text>
                <Text style={{ fontSize: 11, opacity: 0.7 }}>{item.detail}</Text>
              </Flex>
            </Flex>
          ))}
          {items.length > 5 && (
            <Text style={{ fontSize: 11, opacity: 0.5, paddingLeft: 22 }}>
              +{items.length - 5} more — see SLO Compliance tab
            </Text>
          )}
        </Flex>
      </Flex>
    </Surface>
  );
};

// ═══════════════════════════════════════════════════════════
// Tab 1: Performance Insights (highest signal, promoted)
// ═══════════════════════════════════════════════════════════

const PerformanceInsightsTab = ({
  comparison,
  usageTrend,
  registry,
}: {
  comparison: MLOpsModelComparison[];
  usageTrend: Array<{ model: string; timeBucket: string; requests: number; totalTokens: number }>;
  registry: MLOpsModelEntry[];
}) => {
  // Build timeseries for usage trend
  const usageTimeseriesData = useMemo((): Timeseries[] => {
    if (!usageTrend.length) return [];
    const byModel = new Map<string, Array<{ timestamp: Date; value: number }>>();
    for (const pt of usageTrend) {
      if (!byModel.has(pt.model)) byModel.set(pt.model, []);
      byModel.get(pt.model)!.push({ timestamp: new Date(pt.timeBucket), value: pt.requests });
    }
    const modelTotals = [...byModel.entries()].map(([m, pts]) => ({
      model: m,
      total: pts.reduce((s, p) => s + p.value, 0),
      pts,
    }));
    modelTotals.sort((a, b) => b.total - a.total);
    return modelTotals.slice(0, 6).map((m) => ({
      name: m.model,
      datapoints: m.pts
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map((p) => ({ start: p.timestamp, value: p.value })),
    }));
  }, [usageTrend]);

  // Provider donut
  const providerDonutData = useMemo(() => {
    const byProvider = new Map<string, number>();
    for (const m of registry) {
      byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + m.requests);
    }
    return { slices: [...byProvider.entries()].map(([category, value]) => ({ category, value })) };
  }, [registry]);

  // Latency ranking
  const latencyRanking = useMemo(() => {
    const sorted = [...comparison].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs).slice(0, 10);
    const maxLatency = Math.max(...sorted.map((m) => m.avgLatencyMs), 1);
    return { sorted, maxLatency };
  }, [comparison]);

  // Efficiency frontier: completion models only
  const completionModels = useMemo(
    () => comparison.filter(m => m.tokenEfficiency > 0 && m.avgLatencyMs > 0),
    [comparison],
  );

  // Top 3 frontier models (low latency + high efficiency)
  const frontierModels = useMemo(() => {
    if (completionModels.length === 0) return [];
    return [...completionModels]
      .sort((a, b) =>
        (a.avgLatencyMs / Math.max(a.tokenEfficiency, 0.01)) -
        (b.avgLatencyMs / Math.max(b.tokenEfficiency, 0.01)),
      )
      .slice(0, 3);
  }, [completionModels]);

  if (!comparison.length) return <Text>No model data found in the selected timeframe.</Text>;

  return (
    <Flex flexDirection="column" gap={16}>
      {/* Row 1: Efficiency Frontier (hero viz) + Provider Donut */}
      <Flex gap={16} flexWrap="wrap">
        <Surface style={{ flex: '2 1 400px', padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <AiIcon style={{ width: 14, height: 14 }} />
              <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Efficiency Frontier</Text>
              <Text style={{
                fontSize: 9,
                padding: '2px 6px',
                backgroundColor: 'var(--dt-colors-background-container-accent-subdued)',
                color: CssTokens.textAccent,
                borderRadius: 10,
                fontWeight: 600,
              }}>UNIQUE</Text>
            </Flex>
            <Text style={{ fontSize: 11, opacity: 0.6 }}>
              Bottom-right = optimal. Low latency + high token efficiency = best performance per token.
            </Text>
            {completionModels.length >= 2 ? (
              <Flex style={{ height: 260 }}>
                <XYChart
                  data={completionModels.map(m => ({
                    seriesName: m.model,
                    x0: m.avgLatencyMs,
                    y0: m.tokenEfficiency,
                  }))}
                  colorPalette="categorical"
                >
                  <XYChart.DotSeries
                    xAxisId="latency-axis"
                    yAxisId="efficiency-axis"
                    x0Accessor="x0"
                    y0Accessor="y0"
                    nameAccessor="seriesName"
                  />
                  <XYChart.XAxis id="latency-axis" type="numerical" position="bottom" label="Avg Latency (ms)" />
                  <XYChart.YAxis id="efficiency-axis" type="numerical" position="left" label="Token Efficiency (out/in)" />
                </XYChart>
              </Flex>
            ) : (
              <Text style={{ opacity: 0.5, padding: 16 }}>Need at least 2 completion models to display frontier.</Text>
            )}
            {/* Frontier leaders */}
            {frontierModels.length > 0 && (
              <Flex gap={8} flexWrap="wrap">
                {frontierModels.map((m, i) => (
                  <Surface key={m.model} style={{ flex: '1 1 140px', padding: 10, borderLeft: `3px solid ${i === 0 ? StatusColors.good : StatusColors.neutral}` }}>
                    <Flex flexDirection="column" gap={2}>
                      <Text style={{ fontSize: 10, opacity: 0.5 }}>{i === 0 ? 'Best overall' : `#${i + 1}`}</Text>
                      <Text style={{ fontSize: 12, fontWeight: 600 }}>{m.model}</Text>
                      <Text style={{ fontSize: 10, opacity: 0.6 }}>
                        {formatDurationMs(m.avgLatencyMs)} · {formatNumber(m.tokenEfficiency, { maximumFractionDigits: 2 })} eff · {formatNumber(m.requests, { maximumFractionDigits: 0 })} req
                      </Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>

        {/* Provider donut */}
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
      </Flex>

      {/* Row 2: Latency Ranking + Usage Trend */}
      <Flex gap={16} flexWrap="wrap">
        <Surface style={{ flex: '1 1 380px', padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <ClockIcon style={{ width: 14, height: 14 }} />
              <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Latency Ranking</Text>
            </Flex>
            <Text style={{ fontSize: 11, opacity: 0.6 }}>
              Fastest models at top. Color bands: green &lt;1s, yellow 1-3s, red &gt;3s.
            </Text>
            <Flex flexDirection="column" gap={6}>
              {latencyRanking.sorted.map((m) => {
                const barColor = m.avgLatencyMs < 1000
                  ? StatusColors.good
                  : m.avgLatencyMs < 3000
                    ? StatusColors.warning
                    : StatusColors.critical;
                return (
                  <Flex key={`${m.model}-${m.provider}`} flexDirection="column" gap={2}>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.model}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: 600, color: barColor }}>
                        {formatDurationMs(m.avgLatencyMs)}
                      </Text>
                    </Flex>
                    <Flex style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      overflow: 'hidden',
                    }}>
                      <Flex style={{
                        height: '100%',
                        width: `${(m.avgLatencyMs / latencyRanking.maxLatency) * 100}%`,
                        borderRadius: 4,
                        background: barColor,
                        transition: 'width 0.3s ease',
                      }} />
                    </Flex>
                  </Flex>
                );
              })}
              <Flex gap={12} style={{ marginTop: 4 }}>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 8, height: 8, borderRadius: '50%', background: StatusColors.good, flexShrink: 0 }} />
                  <Text style={{ fontSize: 10, opacity: 0.6 }}>&lt;1s</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 8, height: 8, borderRadius: '50%', background: StatusColors.warning, flexShrink: 0 }} />
                  <Text style={{ fontSize: 10, opacity: 0.6 }}>1-3s</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 8, height: 8, borderRadius: '50%', background: StatusColors.critical, flexShrink: 0 }} />
                  <Text style={{ fontSize: 10, opacity: 0.6 }}>&gt;3s</Text>
                </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Surface>

        {usageTimeseriesData.length > 0 && (
          <Surface style={{ flex: '1 1 380px', padding: 16 }}>
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={6}>
                <BarChartIcon style={{ width: 14, height: 14 }} />
                <Text style={{ fontWeight: 600, fontSize: 13 }}>Model Usage Trend</Text>
              </Flex>
              <Text style={{ fontSize: 11, opacity: 0.6 }}>
                Request volume over time for top 6 models. Spot traffic shifts and adoption patterns.
              </Text>
              <TimeseriesChart data={usageTimeseriesData} variant="bar" height={220}>
                <TimeseriesChart.Legend position="bottom" />
                <TimeseriesChart.Tooltip variant="shared" />
              </TimeseriesChart>
            </Flex>
          </Surface>
        )}
      </Flex>
    </Flex>
  );
};

// ═══════════════════════════════════════════════════════════
// Tab 2: SLO Compliance
// ═══════════════════════════════════════════════════════════

const SLOComplianceTab = ({
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
  const exhaustedCount = data.filter((e) => e.errorBudgetRemaining < 0).length;

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
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>
          {formatNumber(value, { maximumFractionDigits: 0 })}
        </Text>
      ),
    },
    {
      id: 'latencyCompliance',
      header: `Latency SLO (< ${formatNumber(sloConfig.latencyThresholdMs, { maximumFractionDigits: 0 })}ms)`,
      accessor: (row: MLOpsSLOEntry) => row.latencyCompliance,
      cell: ({ value, rowData }: { value: number; rowData: MLOpsSLOEntry }) => (
        <Flex alignItems="center" gap={4}>
          {rowData.meetsLatencySlo
            ? <CheckmarkIcon style={{ color: StatusColors.good, width: 14 }} />
            : <CriticalIcon style={{ color: StatusColors.critical, width: 14 }} />
          }
          <Text style={{ color: rowData.meetsLatencySlo ? StatusColors.good : StatusColors.critical }}>
            {formatPercent(value, 2)}
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
            ? <CheckmarkIcon style={{ color: StatusColors.good, width: 14 }} />
            : <CriticalIcon style={{ color: StatusColors.critical, width: 14 }} />
          }
          <Text style={{ color: rowData.meetsErrorSlo ? StatusColors.good : StatusColors.critical }}>
            {formatPercent(value, 2)}
          </Text>
        </Flex>
      ),
    },
    {
      id: 'errorBudget',
      header: 'Error Budget',
      accessor: (row: MLOpsSLOEntry) => row.errorBudgetRemaining,
      cell: ({ value }: { value: number }) => {
        const status = value < 0 ? 'exhausted' : value < 0.5 ? 'at-risk' : 'healthy';
        const color = status === 'exhausted'
          ? StatusColors.critical
          : status === 'at-risk'
            ? StatusColors.warning
            : StatusColors.good;
        const label = status === 'exhausted' ? 'EXHAUSTED' : status === 'at-risk' ? 'AT RISK' : '';
        return (
          <Flex alignItems="center" gap={4}>
            <Text style={{ color, fontWeight: status !== 'healthy' ? 600 : 400 }}>
              {formatNumber(value, { maximumFractionDigits: 3 })}%
            </Text>
            {label && (
              <Text style={{ fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase' }}>
                {label}
              </Text>
            )}
          </Flex>
        );
      },
    },
    {
      id: 'p95',
      header: 'P95',
      accessor: (row: MLOpsSLOEntry) => row.p95LatencyMs,
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDurationMs(value)}</Text>
      ),
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
              onChange={(val) => {
                const n = parseInt(val || '3000', 10);
                if (n > 0) onConfigChange({ ...sloConfig, latencyThresholdMs: n });
              }}
              style={{ width: 80 }}
            />
            <Text>ms</Text>
          </Flex>
          <Flex alignItems="center" gap={6}>
            <Text>Error budget &lt;</Text>
            <TextInput
              value={String(sloConfig.errorBudgetPct)}
              onChange={(val) => {
                const n = parseFloat(val || '1.0');
                if (n >= 0) onConfigChange({ ...sloConfig, errorBudgetPct: n });
              }}
              style={{ width: 60 }}
            />
            <Text>%</Text>
          </Flex>
        </Flex>
      </Surface>

      {/* Summary cards */}
      <Flex gap={12} flexWrap="wrap">
        <MetricCard
          label="Passing"
          value={passing}
          icon={<CheckmarkIcon style={{ color: StatusColors.good, width: 16 }} />}
          color={StatusColors.good}
        />
        <MetricCard
          label="Failing"
          value={failing}
          icon={<CriticalIcon style={{ color: StatusColors.critical, width: 16 }} />}
          color={failing > 0 ? StatusColors.critical : StatusColors.good}
        />
        <MetricCard
          label="Budget Exhausted"
          value={exhaustedCount}
          icon={<WarningIcon style={{ color: exhaustedCount > 0 ? StatusColors.critical : StatusColors.good, width: 16 }} />}
          color={exhaustedCount > 0 ? StatusColors.critical : StatusColors.good}
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
              colorPalette={[StatusColors.good]}
            >
              <TimeseriesChart.Tooltip variant="shared" />
              <TimeseriesChart.Legend hidden />
            </TimeseriesChart>
          </Flex>
        </Surface>
      )}

      {data.length === 0
        ? <Text>No SLO data available in the selected timeframe.</Text>
        : (
          <DataTable data={data} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        )
      }
    </Flex>
  );
};

// ═══════════════════════════════════════════════════════════
// Tab 3: Model Registry (full inventory)
// ═══════════════════════════════════════════════════════════

const ModelRegistryTab = ({ data }: { data: MLOpsModelEntry[] }) => {
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
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>
          {formatNumber(value, { maximumFractionDigits: 0 })}
        </Text>
      ),
    },
    {
      id: 'avgLatencyMs',
      header: 'Avg Latency',
      accessor: (row: MLOpsModelEntry) => row.avgLatencyMs,
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDurationMs(value)}</Text>
      ),
    },
    {
      id: 'p95LatencyMs',
      header: 'P95',
      accessor: (row: MLOpsModelEntry) => row.p95LatencyMs,
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDurationMs(value)}</Text>
      ),
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessor: (row: MLOpsModelEntry) => row.errorRate,
      cell: ({ value }: { value: number }) => (
        <Text style={{ color: value > 5 ? StatusColors.critical : value > 1 ? StatusColors.warning : StatusColors.good }}>
          {formatPercent(value, 2)}
        </Text>
      ),
    },
    {
      id: 'totalTokens',
      header: 'Total Tokens',
      accessor: (row: MLOpsModelEntry) => row.totalInputTokens + row.totalOutputTokens,
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>
          {formatNumber(value, { maximumFractionDigits: 0 })}
        </Text>
      ),
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
      cell: ({ value }: { value: string }) => <Text>{formatRelativeTime(value)}</Text>,
    },
    {
      id: 'lastSeen',
      header: 'Last Active',
      accessor: (row: MLOpsModelEntry) => row.lastSeen,
      cell: ({ value }: { value: string }) => <Text>{formatRelativeTime(value)}</Text>,
    },
  ], []);

  if (!data.length) return <Text>No models found in the selected timeframe.</Text>;

  return (
    <Flex flexDirection="column" gap={12}>
      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        Complete inventory of all model + provider combinations discovered from gen_ai.* spans, sorted by request volume.
      </Text>
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

  useEffect(() => {
    refetch(timeframe);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => { refetch(timeframe); };
  const handleTimeframeChange = (tf: Timeframe) => { setTimeframe(tf); refetch(tf); };

  // ─── Narrative: attention items (auto-surfaced issues) ───
  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];

    // Exhausted error budgets are critical
    for (const entry of sloEntries) {
      if (entry.errorBudgetRemaining < 0) {
        items.push({
          severity: 'critical',
          title: `${entry.serviceName} / ${entry.model}`,
          detail: `Error budget EXHAUSTED (${formatNumber(entry.errorBudgetRemaining, { maximumFractionDigits: 3 })}%). Current error rate: ${formatPercent(entry.errorRate, 1)}.`,
        });
      } else if (!entry.meetsLatencySlo) {
        items.push({
          severity: 'warning',
          title: `${entry.serviceName} / ${entry.model}`,
          detail: `Latency SLO failing — compliance at ${formatPercent(entry.latencyCompliance, 1)}. P95: ${formatDurationMs(entry.p95LatencyMs)}.`,
        });
      } else if (!entry.meetsErrorSlo) {
        items.push({
          severity: 'warning',
          title: `${entry.serviceName} / ${entry.model}`,
          detail: `Error SLO breached — ${formatPercent(entry.errorRate, 1)} error rate. Budget: ${formatNumber(entry.errorBudgetRemaining, { maximumFractionDigits: 3 })}% remaining.`,
        });
      }
    }

    // High error rate models not already captured via SLOs
    const sloModelKeys = new Set(sloEntries.map(e => `${e.model}|${e.provider}`));
    for (const m of registry) {
      if (m.errorRate > 5 && !sloModelKeys.has(`${m.model}|${m.provider}`)) {
        items.push({
          severity: 'warning',
          title: `${m.model} (${m.provider})`,
          detail: `High error rate: ${formatPercent(m.errorRate, 1)} across ${formatNumber(m.requests, { maximumFractionDigits: 0 })} requests.`,
        });
      }
    }

    // Sort critical first
    items.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
    return items;
  }, [sloEntries, registry]);

  // ─── Narrative: headline ───
  const narrativeText = useMemo(() => {
    if (totalModels === 0) return 'No AI models detected in the selected timeframe.';
    if (sloViolationCount === 0) {
      return `All ${totalModels} model${totalModels !== 1 ? 's' : ''} across ${totalProviders} provider${totalProviders !== 1 ? 's' : ''} are meeting SLOs.`;
    }
    return `${sloViolationCount} endpoint${sloViolationCount !== 1 ? 's' : ''} violating SLOs out of ${sloEntries.length} monitored — review recommended.`;
  }, [totalModels, totalProviders, sloViolationCount, sloEntries.length]);

  const narrativeColor = sloViolationCount === 0 ? StatusColors.good : StatusColors.warning;

  return (
    <Flex flexDirection="column" gap={16} style={{ padding: '0 16px 16px' }}>
      {/* Title Bar */}
      <TitleBar>
        <TitleBar.Title>MLOps</TitleBar.Title>
        <TitleBar.Subtitle>Model Performance, SLOs &amp; Fleet Health</TitleBar.Subtitle>
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
                Updated {formatRelativeTime(lastRefresh)}
              </Text>
            )}
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Error banner */}
      {error && (
        <Surface style={{ padding: 12, borderLeft: `3px solid ${StatusColors.critical}` }}>
          <Text style={{ color: StatusColors.critical }}>{error.message}</Text>
        </Surface>
      )}

      {/* Loading state */}
      {loading && (
        <Flex justifyContent="center" style={{ padding: 32 }}>
          <ProgressCircle />
        </Flex>
      )}

      {/* Narrative hero + content */}
      {!loading && (
        <>
          {/* Fleet health headline */}
          <Surface style={{ padding: 16, borderLeft: `3px solid ${narrativeColor}` }}>
            <Flex alignItems="center" gap={8}>
              {sloViolationCount === 0
                ? <CheckmarkIcon style={{ color: narrativeColor, width: 20, height: 20 }} />
                : <WarningIcon style={{ color: narrativeColor, width: 20, height: 20 }} />
              }
              <Text style={{ fontSize: 14, fontWeight: 600, color: narrativeColor }}>
                {narrativeText}
              </Text>
            </Flex>
          </Surface>

          {/* Summary metrics */}
          <Flex gap={12} flexWrap="wrap">
            <MetricCard label="Models" value={totalModels} icon={<AiIcon style={{ width: 16 }} />} />
            <MetricCard label="Providers" value={totalProviders} icon={<ServicesIcon style={{ width: 16 }} />} />
            <MetricCard label="Total Requests" value={formatNumber(totalRequests, { maximumFractionDigits: 0 })} icon={<BarChartIcon style={{ width: 16 }} />} />
            <MetricCard
              label="SLO Violations"
              value={sloViolationCount}
              icon={<WarningIcon style={{ width: 16, color: sloViolationCount > 0 ? StatusColors.warning : StatusColors.good }} />}
              color={sloViolationCount > 0 ? StatusColors.warning : StatusColors.good}
            />
          </Flex>

          {/* Needs Attention — auto-surfaced issues */}
          <NeedsAttentionPanel items={attentionItems} />

          {/* Tabs — reordered for story: insights first, compliance second, inventory last */}
          <Tabs defaultIndex={0}>
            <Tab title="Performance Insights" prefixIcon={<BarChartIcon />}>
              <PerformanceInsightsTab comparison={comparison} usageTrend={usageTrend} registry={registry} />
            </Tab>
            <Tab title="SLO Compliance" prefixIcon={<CheckmarkIcon />}>
              <SLOComplianceTab data={sloEntries} sloConfig={sloConfig} onConfigChange={setSloConfig} sloTrend={sloTrend} />
            </Tab>
            <Tab title="Model Registry" prefixIcon={<AiIcon />}>
              <ModelRegistryTab data={registry} />
            </Tab>
          </Tabs>
        </>
      )}
    </Flex>
  );
};
