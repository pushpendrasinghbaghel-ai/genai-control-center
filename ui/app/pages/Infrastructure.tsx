// GenAI Control Center — Infrastructure Page (Phase 6)
// AI infrastructure health: provider availability, service workloads, Davis problems, deployments.

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { SelectV2 } from '@dynatrace/strato-components-preview/forms';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import {
  HostsIcon,
  RefreshIcon,
  ServicesIcon,
  WorkflowsIcon,
  CheckmarkIcon,
  WarningIcon,
  CriticalIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useInfrastructure } from '../hooks';
import type { InfraProvider, InfraServiceWorkload, DavisProblem, DeploymentEvent } from '../types';

// ─── Colors & helpers ──────────────────────────────────────────────────────

const STATUS_COLORS = {
  healthy: Colors.Charts.Categorical.Color04.Default,  // green
  warning: Colors.Charts.Categorical.Color06.Default,  // yellow/orange
  critical: Colors.Charts.Categorical.Color10.Default, // red
  neutral: Colors.Charts.Categorical.Color01.Default,  // blue
};

const availabilityColor = (pct: number): string => {
  if (pct >= 99) return STATUS_COLORS.healthy;
  if (pct >= 95) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
};

const errorRateColor = (rate: number): string => {
  if (rate < 2) return STATUS_COLORS.healthy;
  if (rate < 10) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
};

const severityColor = (sev: string): string => {
  const s = sev.toUpperCase();
  if (s.includes('AVAILABILITY') || s === 'ERROR') return STATUS_COLORS.critical;
  if (s.includes('SLOW') || s === 'PERFORMANCE') return STATUS_COLORS.warning;
  return STATUS_COLORS.neutral;
};

const fmtMs = (ms: number): string => {
  if (!isFinite(ms) || ms === 0) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
};

const fmt = (n: number): string => (isFinite(n) ? n.toLocaleString() : '—');

const statusIcon = (status: string) => {
  const s = status.toUpperCase();
  if (s.includes('OPEN') || s.includes('ACTIVE')) return <CriticalIcon style={{ color: STATUS_COLORS.critical, width: 14, height: 14 }} />;
  if (s.includes('RESOLVED') || s.includes('CLOSED')) return <CheckmarkIcon style={{ color: STATUS_COLORS.healthy, width: 14, height: 14 }} />;
  return <WarningIcon style={{ color: STATUS_COLORS.warning, width: 14, height: 14 }} />;
};

// ─── Metric Card ────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, sub, color }) => (
  <Surface style={{ flex: '1 1 180px', padding: 16, minWidth: 160 }}>
    <Flex alignItems="center" gap={8} style={{ marginBottom: 8 }}>
      {icon}
      <Text textStyle="small" style={{ opacity: 0.7 }}>{label}</Text>
    </Flex>
    <Text style={{ fontSize: 28, fontWeight: 700, color: color ?? 'inherit', lineHeight: 1 }}>
      {typeof value === 'number' ? fmt(value) : value}
    </Text>
    {sub && <Text textStyle="small" style={{ opacity: 0.6, marginTop: 4 }}>{sub}</Text>}
  </Surface>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const Infrastructure: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const { providers, workloads, problems, deployments, loading, error, refetch } = useInfrastructure();

  useEffect(() => {
    void refetch(timeRange);
  }, [timeRange, refetch]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalServices = workloads.length;
    const openProblems = problems.filter(p => p.status.toUpperCase().includes('OPEN') || p.status.toUpperCase().includes('ACTIVE')).length;
    const avgAvailability = providers.length > 0
      ? providers.reduce((s, p) => s + p.availabilityPct, 0) / providers.length
      : 100;
    const totalSpans = workloads.reduce((s, w) => s + w.spanCount, 0);
    return { totalServices, openProblems, avgAvailability, totalSpans };
  }, [workloads, problems, providers]);

  return (
    <Flex flexDirection="column" gap={24} style={{ padding: 24, maxWidth: 1400 }}>

      {/* ─── Header ─── */}
      <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={12}>
        <Flex alignItems="center" gap={12}>
          <HostsIcon style={{ width: 28, height: 28, color: STATUS_COLORS.neutral }} />
          <Flex flexDirection="column" gap={0}>
            <Heading level={2}>AI Infrastructure Health</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>
              Provider availability · Service workloads · Active problems · Deployments
            </Text>
          </Flex>
        </Flex>
        <Flex gap={8} alignItems="center">
          <Flex flexDirection="column" gap={2}>
            <Text textStyle="small">Time Range</Text>
            <SelectV2 value={timeRange} onChange={(v) => setTimeRange(String(v ?? '24h'))}>
              <SelectV2.Option value="1h">Last 1h</SelectV2.Option>
              <SelectV2.Option value="3h">Last 3h</SelectV2.Option>
              <SelectV2.Option value="6h">Last 6h</SelectV2.Option>
              <SelectV2.Option value="24h">Last 24h</SelectV2.Option>
              <SelectV2.Option value="2d">Last 2d</SelectV2.Option>
              <SelectV2.Option value="7d">Last 7d</SelectV2.Option>
            </SelectV2>
          </Flex>
          <Button variant="emphasized" onClick={() => refetch(timeRange)}>
            <RefreshIcon style={{ width: 14, height: 14 }} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </Flex>
      </Flex>

      {error && (
        <Surface style={{ padding: 12, background: `${STATUS_COLORS.critical}15`, border: `1px solid ${STATUS_COLORS.critical}` }}>
          <Text style={{ color: STATUS_COLORS.critical }}>⚠️ Query error: {error.message}</Text>
        </Surface>
      )}

      {/* ─── KPI Cards ─── */}
      <Flex gap={16} flexWrap="wrap">
        <MetricCard
          icon={<ServicesIcon style={{ color: STATUS_COLORS.neutral }} />}
          label="AI Services"
          value={kpis.totalServices}
          sub="instrumented workloads"
        />
        <MetricCard
          icon={<HostsIcon style={{ color: availabilityColor(kpis.avgAvailability) }} />}
          label="Avg Provider Availability"
          value={kpis.avgAvailability > 0 ? `${kpis.avgAvailability.toFixed(1)}%` : '—'}
          sub={providers.length > 0 ? `across ${providers.length} providers` : 'no data'}
          color={availabilityColor(kpis.avgAvailability)}
        />
        <MetricCard
          icon={<CriticalIcon style={{ color: kpis.openProblems > 0 ? STATUS_COLORS.critical : STATUS_COLORS.healthy }} />}
          label="Open Problems"
          value={kpis.openProblems}
          sub="active Davis problems"
          color={kpis.openProblems > 0 ? STATUS_COLORS.critical : STATUS_COLORS.healthy}
        />
        <MetricCard
          icon={<WorkflowsIcon style={{ color: STATUS_COLORS.neutral }} />}
          label="AI Span Volume"
          value={kpis.totalSpans}
          sub={`in last ${timeRange}`}
        />
      </Flex>

      {/* ─── Provider Availability ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 16 }}>
          <HostsIcon />
          <Heading level={4}>LLM Provider Availability</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>calculated from span error rates</Text>
        </Flex>
        {providers.length > 0 ? (
          <Flex flexDirection="column" gap={16}>
            {providers.map((p) => (
              <Flex key={p.provider} alignItems="center" gap={16} flexWrap="wrap">
                <Text style={{ width: 160, fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                  {p.provider || '(unknown)'}
                </Text>
                <Flex flex="1 1 300px" alignItems="center" gap={8}>
                  <ProgressBar
                    value={p.availabilityPct}
                    max={100}
                    style={{ flex: 1 }}
                  />
                  <Text style={{ width: 56, fontWeight: 700, color: availabilityColor(p.availabilityPct), textAlign: 'right' }}>
                    {p.availabilityPct.toFixed(1)}%
                  </Text>
                </Flex>
                <Flex gap={16}>
                  <Flex flexDirection="column" alignItems="flex-end">
                    <Text textStyle="small" style={{ opacity: 0.6 }}>Requests</Text>
                    <Text style={{ fontWeight: 600 }}>{fmt(p.total)}</Text>
                  </Flex>
                  <Flex flexDirection="column" alignItems="flex-end">
                    <Text textStyle="small" style={{ opacity: 0.6 }}>Errors</Text>
                    <Text style={{ fontWeight: 600, color: p.errors > 0 ? STATUS_COLORS.critical : 'inherit' }}>
                      {fmt(p.errors)}
                    </Text>
                  </Flex>
                  <Flex flexDirection="column" alignItems="flex-end">
                    <Text textStyle="small" style={{ opacity: 0.6 }}>Avg Latency</Text>
                    <Text style={{ fontWeight: 600 }}>{fmtMs(p.avgLatencyMs)}</Text>
                  </Flex>
                </Flex>
              </Flex>
            ))}
          </Flex>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            {loading ? 'Loading provider data…' : 'No provider data found. Ensure gen_ai.provider.name is set on your spans.'}
          </Text>
        )}
      </Surface>

      {/* ─── Service Workloads ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <ServicesIcon />
          <Heading level={4}>AI Service Workloads</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>services instrumented with gen_ai.* spans</Text>
        </Flex>
        {workloads.length > 0 ? (
          <DataTable
            data={workloads}
            columns={[
              {
                header: 'Service',
                id: 'serviceName',
                accessor: 'serviceName',
                cell: ({ value }) => (
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                    {String(value ?? '—')}
                  </Text>
                ),
              },
              {
                header: 'Provider',
                id: 'provider',
                accessor: 'provider',
                width: 130,
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                ),
              },
              {
                header: 'Span Volume',
                id: 'spanCount',
                accessor: 'spanCount',
                width: 110,
                cell: ({ value }) => <Text style={{ fontWeight: 600 }}>{fmt(Number(value))}</Text>,
              },
              {
                header: 'Error Rate',
                id: 'errorRate',
                accessor: 'errorRate',
                width: 100,
                cell: ({ value }) => {
                  const r = Number(value);
                  return (
                    <Text style={{ color: errorRateColor(r), fontWeight: 600 }}>
                      {r.toFixed(1)}%
                    </Text>
                  );
                },
              },
              {
                header: 'Avg Latency',
                id: 'avgLatencyMs',
                accessor: 'avgLatencyMs',
                width: 110,
                cell: ({ value }) => <Text>{fmtMs(Number(value))}</Text>,
              },
              {
                header: 'Models Used',
                id: 'modelCount',
                accessor: 'modelCount',
                width: 100,
                cell: ({ value }) => <Text>{String(value ?? '—')}</Text>,
              },
              {
                header: 'Last Seen',
                id: 'lastSeen',
                accessor: 'lastSeen',
                width: 150,
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {value ? new Date(String(value)).toLocaleTimeString() : '—'}
                  </Text>
                ),
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            {loading ? 'Loading…' : 'No AI service workloads detected.'}
          </Text>
        )}
      </Surface>

      {/* ─── Problems + Deployments side-by-side ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Davis Problems */}
        <Surface style={{ flex: '1 1 55%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <CriticalIcon />
            <Heading level={4}>Davis Problems</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>recent active or resolved problems</Text>
          </Flex>
          {problems.length > 0 ? (
            <DataTable
              data={problems}
              columns={[
                {
                  header: 'Problem',
                  id: 'title',
                  accessor: 'title',
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                  ),
                },
                {
                  header: 'Severity',
                  id: 'severity',
                  accessor: 'severity',
                  width: 110,
                  cell: ({ value }) => {
                    const s = String(value ?? '');
                    const c = severityColor(s);
                    return (
                      <Text style={{ fontSize: 11, fontWeight: 600, color: c, background: `${c}20`, padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                        {s || 'UNKNOWN'}
                      </Text>
                    );
                  },
                },
                {
                  header: 'Status',
                  id: 'status',
                  accessor: 'status',
                  width: 90,
                  cell: ({ value }) => (
                    <Flex gap={4} alignItems="center">
                      {statusIcon(String(value ?? ''))}
                      <Text style={{ fontSize: 11 }}>{String(value ?? '—')}</Text>
                    </Flex>
                  ),
                },
                {
                  header: 'Duration',
                  id: 'durationMin',
                  accessor: 'durationMin',
                  width: 80,
                  cell: ({ value }) => {
                    const m = Number(value ?? 0);
                    return <Text style={{ fontSize: 11 }}>{m > 60 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`}</Text>;
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Flex alignItems="center" gap={8} style={{ padding: 16 }}>
              <CheckmarkIcon style={{ color: STATUS_COLORS.healthy, width: 20, height: 20 }} />
              <Text style={{ color: STATUS_COLORS.healthy }}>
                {loading ? 'Loading…' : 'No Davis problems found in this time range — all clear!'}
              </Text>
            </Flex>
          )}
        </Surface>

        {/* Deployment Events */}
        <Surface style={{ flex: '1 1 40%', padding: 16, minWidth: 280 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <WorkflowsIcon />
            <Heading level={4}>Recent Deployments</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>deployment events for AI services</Text>
          </Flex>
          {deployments.length > 0 ? (
            <DataTable
              data={deployments}
              columns={[
                {
                  header: 'Entity',
                  id: 'entity',
                  accessor: 'entity',
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                  ),
                },
                {
                  header: 'Version',
                  id: 'version',
                  accessor: 'version',
                  width: 120,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: STATUS_COLORS.neutral }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Time',
                  id: 'timestamp',
                  accessor: 'timestamp',
                  width: 130,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {value ? new Date(String(value)).toLocaleTimeString() : '—'}
                    </Text>
                  ),
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', padding: 16 }}>
              {loading ? 'Loading…' : 'No deployment events found.'}
            </Text>
          )}
        </Surface>
      </Flex>

    </Flex>
  );
};
