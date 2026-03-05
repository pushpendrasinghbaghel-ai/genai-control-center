// GenAI Control Center — Provider Status & Failover Intelligence (Phase 5)
// Full production page: provider health cards, failover events, model health,
// error bursts, trend sparklines, readiness gauge.
// All data from useProviderFailover hook — zero mocks.

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import {
  RefreshIcon, CheckmarkIcon, WarningIcon, CriticalIcon,
  HelpIcon, SmartscapeIcon, BarChartIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useProviderFailover, type ProviderHealth, type ProviderModelHealth, type ProviderErrorBurst, type FailoverEvent, type ProviderTrendPoint } from '../hooks/useProviderFailover';

// ─── Constants ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  healthy: Colors.Charts.Status.Ideal.Default,
  degraded: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
  down: '#b91c1c',
  unknown: Colors.Text.Neutral.Subdued,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  healthy: <CheckmarkIcon style={{ color: STATUS_COLORS.healthy }} />,
  degraded: <WarningIcon style={{ color: STATUS_COLORS.degraded }} />,
  critical: <CriticalIcon style={{ color: STATUS_COLORS.critical }} />,
  down: <CriticalIcon style={{ color: STATUS_COLORS.down }} />,
  unknown: <HelpIcon style={{ color: STATUS_COLORS.unknown }} />,
};

// ─── Sparkline Component ────────────────────────────────────────

const TrendSparkline: React.FC<{ data: ProviderTrendPoint[]; field: 'errorRate' | 'latencyMs'; width?: number; height?: number }> = ({
  data, field, width = 120, height = 28,
}) => {
  if (data.length < 2) return <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>No trend</Text>;
  const values = data.map((d) => d[field]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  const last = values[values.length - 1];
  const color = field === 'errorRate'
    ? (last > 10 ? STATUS_COLORS.critical : last > 3 ? STATUS_COLORS.degraded : STATUS_COLORS.healthy)
    : (last > 3000 ? STATUS_COLORS.critical : last > 1000 ? STATUS_COLORS.degraded : STATUS_COLORS.healthy);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Readiness Gauge ────────────────────────────────────────────

const ReadinessGauge: React.FC<{ value: number }> = ({ value }) => {
  const color = value >= 75 ? STATUS_COLORS.healthy : value >= 50 ? STATUS_COLORS.degraded : STATUS_COLORS.critical;
  return (
    <Flex flexDirection="column" alignItems="center" gap={4}>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={30} fill="none" stroke="var(--dt-colors-border-neutral-default)" strokeWidth={6} />
          <circle
            cx={36} cy={36} r={30} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={`${(value / 100) * 188.5} 188.5`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: 700, color }}>{value}</Text>
        </div>
      </div>
      <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Failover Readiness</Text>
    </Flex>
  );
};

// ─── Provider Card ──────────────────────────────────────────────

const ProviderHealthCard: React.FC<{ provider: ProviderHealth; trend: ProviderTrendPoint[] }> = ({ provider, trend }) => {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLORS[provider.status] || STATUS_COLORS.unknown;

  return (
    <Surface
      padding={16}
      style={{
        minWidth: 280, flex: '1 1 280px', maxWidth: 420,
        borderLeft: `4px solid ${color}`, cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Flex flexDirection="column" gap={8}>
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={8}>
            {STATUS_ICONS[provider.status]}
            <Heading level={5} style={{ margin: 0 }}>{provider.provider}</Heading>
          </Flex>
          <Flex alignItems="center" gap={6}>
            <Text style={{ fontSize: 22, fontWeight: 700, color }}>{provider.healthIndex}</Text>
            <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>/100</Text>
          </Flex>
        </Flex>

        {/* Quick stats */}
        <Flex gap={16} flexWrap="wrap">
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>Requests</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{provider.totalRequests.toLocaleString()}</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>Error Rate</Text>
            <Text style={{ fontSize: 13, fontWeight: 600, color: provider.errorRate > 5 ? STATUS_COLORS.critical : undefined }}>
              {provider.errorRate.toFixed(1)}%
            </Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>p95 Latency</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{provider.p95LatencyMs.toFixed(0)}ms</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>Availability</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{provider.availability.toFixed(1)}%</Text>
          </Flex>
        </Flex>

        {/* Trend sparklines */}
        <Flex gap={16}>
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>Error Trend (6h)</Text>
            <TrendSparkline data={trend} field="errorRate" />
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>Latency Trend (6h)</Text>
            <TrendSparkline data={trend} field="latencyMs" />
          </Flex>
        </Flex>

        {/* Expanded: sub-scores */}
        {expanded && (
          <Flex flexDirection="column" gap={6} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: 600 }}>Health Dimensions</Text>
            {([
              { label: 'Reliability', value: provider.reliabilityScore },
              { label: 'Performance', value: provider.performanceScore },
              { label: 'Availability', value: provider.availabilityScore },
              { label: 'Freshness', value: provider.freshnessScore },
            ] as const).map((dim) => (
              <Flex key={dim.label} alignItems="center" gap={8}>
                <Text style={{ fontSize: 11, width: 80 }}>{dim.label}</Text>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={dim.value} max={100}>
                    <ProgressBar.Label>{dim.value}/100</ProgressBar.Label>
                  </ProgressBar>
                </div>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
    </Surface>
  );
};

// ─── Failover Event Card ────────────────────────────────────────

const FailoverEventCard: React.FC<{ event: FailoverEvent }> = ({ event }) => {
  const sevColor = event.severity === 'critical' ? STATUS_COLORS.critical
    : event.severity === 'warning' ? STATUS_COLORS.degraded
    : STATUS_COLORS.healthy;
  const icon = event.severity === 'critical' ? '🔴' : event.severity === 'warning' ? '🟡' : 'ℹ️';

  return (
    <Surface padding={12} style={{ borderLeft: `3px solid ${sevColor}` }}>
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
          <Flex alignItems="center" gap={6}>
            <Text>{icon}</Text>
            <Text style={{ fontWeight: 600, fontSize: 13 }}>
              {event.fromProvider === event.toProvider
                ? `${event.fromProvider} — Monitoring`
                : `${event.fromProvider} → ${event.toProvider}`}
            </Text>
          </Flex>
          <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{event.reason}</Text>
        </Flex>
        <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued, whiteSpace: 'nowrap' }}>
          {new Date(event.timestamp).toLocaleTimeString()}
        </Text>
      </Flex>
    </Surface>
  );
};

// ─── Main Page ──────────────────────────────────────────────────

export const ProviderStatus: React.FC = () => {
  const { providers, errorBursts, modelHealth, failoverEvents, trendData, overallReadiness, loading, error, refetch } = useProviderFailover();
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'errors' | 'events'>('overview');

  // Sort providers: worst health first
  const sortedProviders = useMemo(
    () => [...providers].sort((a, b) => a.healthIndex - b.healthIndex),
    [providers],
  );

  // Provider status counts
  const statusCounts = useMemo(() => {
    const counts = { healthy: 0, degraded: 0, critical: 0, down: 0 };
    providers.forEach((p) => {
      if (p.status in counts) counts[p.status as keyof typeof counts]++;
    });
    return counts;
  }, [providers]);

  // Model health table columns
  const modelColumns = useMemo(() => [
    { id: 'provider', header: 'Provider', minWidth: 100 },
    { id: 'model', header: 'Model', minWidth: 140 },
    {
      id: 'requests', header: 'Requests', minWidth: 80,
      cell: ({ value }: any) => <Text>{Number(value).toLocaleString()}</Text>,
    },
    {
      id: 'errorRate', header: 'Error Rate', minWidth: 80,
      cell: ({ value }: any) => {
        const v = Number(value);
        return <Text style={{ color: v > 10 ? STATUS_COLORS.critical : v > 3 ? STATUS_COLORS.degraded : undefined }}>{v.toFixed(1)}%</Text>;
      },
    },
    {
      id: 'avgLatencyMs', header: 'Avg Latency', minWidth: 80,
      cell: ({ value }: any) => <Text>{Number(value).toFixed(0)}ms</Text>,
    },
    {
      id: 'status', header: 'Status', minWidth: 80,
      cell: ({ value }: any) => (
        <Flex alignItems="center" gap={4}>
          {STATUS_ICONS[value as string] || STATUS_ICONS.unknown}
          <Text style={{ fontSize: 12, textTransform: 'capitalize' }}>{value}</Text>
        </Flex>
      ),
    },
  ], []);

  // Error bursts table columns
  const errorColumns = useMemo(() => [
    { id: 'provider', header: 'Provider', minWidth: 100 },
    {
      id: 'errorMsg', header: 'Error Message', minWidth: 200,
      cell: ({ value }: any) => (
        <Tooltip text={String(value)}>
          <Text style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(value).slice(0, 80)}{String(value).length > 80 ? '…' : ''}
          </Text>
        </Tooltip>
      ),
    },
    {
      id: 'count', header: 'Count', minWidth: 60,
      cell: ({ value }: any) => <Text style={{ fontWeight: 600, color: STATUS_COLORS.critical }}>{value}</Text>,
    },
    {
      id: 'lastSeen', header: 'Last Seen', minWidth: 120,
      cell: ({ value }: any) => <Text style={{ fontSize: 12 }}>{value ? new Date(String(value)).toLocaleTimeString() : '—'}</Text>,
    },
  ], []);

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'models' as const, label: `Models (${modelHealth.length})` },
    { key: 'errors' as const, label: `Errors (${errorBursts.length})` },
    { key: 'events' as const, label: `Events (${failoverEvents.length})` },
  ];

  return (
    <Flex flexDirection="column" gap={0} style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Title>
          <Flex alignItems="center" gap={8}>
            <SmartscapeIcon />
            Provider Status & Failover
          </Flex>
        </TitleBar.Title>
        <TitleBar.Subtitle>
          Real-time provider health monitoring, failover readiness, and autonomous degradation detection
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button variant="accent" onClick={() => refetch()} disabled={loading}>
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Content */}
      <Flex flexDirection="column" gap={16} padding={16} style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <Flex justifyContent="center" padding={40}>
            <ProgressCircle aria-label="Loading provider data" />
            <Text style={{ marginLeft: 12 }}>Loading provider health data...</Text>
          </Flex>
        )}

        {error && !loading && (
          <Surface padding={20}>
            <Flex alignItems="center" gap={8}>
              <CriticalIcon style={{ color: STATUS_COLORS.critical }} />
              <Text>Error: {error.message}</Text>
              <Button variant="default" onClick={() => refetch()}>Retry</Button>
            </Flex>
          </Surface>
        )}

        {!loading && !error && (
          <>
            {/* Summary Row */}
            <Flex gap={12} flexWrap="wrap" alignItems="center">
              <ReadinessGauge value={overallReadiness} />

              <Surface padding={12} style={{ flex: '1 1 120px', textAlign: 'center' }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text style={{ fontSize: 24, fontWeight: 700 }}>{providers.length}</Text>
                  <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Providers</Text>
                </Flex>
              </Surface>
              <Surface padding={12} style={{ flex: '1 1 120px', textAlign: 'center' }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.healthy }}>{statusCounts.healthy}</Text>
                  <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Healthy</Text>
                </Flex>
              </Surface>
              <Surface padding={12} style={{ flex: '1 1 120px', textAlign: 'center' }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.degraded }}>{statusCounts.degraded}</Text>
                  <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Degraded</Text>
                </Flex>
              </Surface>
              <Surface padding={12} style={{ flex: '1 1 120px', textAlign: 'center' }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.critical }}>{statusCounts.critical + statusCounts.down}</Text>
                  <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Critical / Down</Text>
                </Flex>
              </Surface>
            </Flex>

            {/* Tab Bar */}
            <Flex gap={0}>
              {tabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'accent' : 'default'}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ borderRadius: 0 }}
                >
                  {tab.label}
                </Button>
              ))}
            </Flex>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Provider Health Index</Heading>
                <Flex gap={12} flexWrap="wrap">
                  {sortedProviders.map((p) => (
                    <ProviderHealthCard key={p.provider} provider={p} trend={trendData[p.provider] || []} />
                  ))}
                </Flex>

                {sortedProviders.length === 0 && (
                  <Surface padding={32}>
                    <Flex justifyContent="center">
                      <Text style={{ color: Colors.Text.Neutral.Subdued }}>No provider data available. AI spans with gen_ai.provider.name required.</Text>
                    </Flex>
                  </Surface>
                )}
              </Flex>
            )}

            {/* Models Tab */}
            {activeTab === 'models' && (
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Model Health per Provider</Heading>
                {modelHealth.length > 0 ? (
                  <DataTable data={modelHealth} columns={modelColumns} sortable resizable>
                    <DataTable.Pagination defaultPageSize={15} />
                  </DataTable>
                ) : (
                  <Surface padding={32}>
                    <Flex justifyContent="center">
                      <Text style={{ color: Colors.Text.Neutral.Subdued }}>No model-level data available.</Text>
                    </Flex>
                  </Surface>
                )}
              </Flex>
            )}

            {/* Errors Tab */}
            {activeTab === 'errors' && (
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Recent Error Bursts (Last Hour)</Heading>
                {errorBursts.length > 0 ? (
                  <DataTable data={errorBursts} columns={errorColumns} sortable resizable>
                    <DataTable.Pagination defaultPageSize={15} />
                  </DataTable>
                ) : (
                  <Surface padding={32}>
                    <Flex justifyContent="center">
                      <CheckmarkIcon style={{ color: STATUS_COLORS.healthy }} />
                      <Text style={{ marginLeft: 8, color: Colors.Text.Neutral.Subdued }}>No errors detected in the last hour.</Text>
                    </Flex>
                  </Surface>
                )}
              </Flex>
            )}

            {/* Events Tab */}
            {activeTab === 'events' && (
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <Heading level={5}>Failover Events & Recommendations</Heading>
                  <Tooltip text="Automatically detected provider health transitions. Events are generated when providers cross health thresholds.">
                    <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                {failoverEvents.length > 0 ? (
                  <Flex flexDirection="column" gap={8}>
                    {failoverEvents.map((ev, i) => (
                      <FailoverEventCard key={`${ev.fromProvider}-${ev.toProvider}-${i}`} event={ev} />
                    ))}
                  </Flex>
                ) : (
                  <Surface padding={32}>
                    <Flex justifyContent="center">
                      <CheckmarkIcon style={{ color: STATUS_COLORS.healthy }} />
                      <Text style={{ marginLeft: 8, color: Colors.Text.Neutral.Subdued }}>All providers healthy — no failover events.</Text>
                    </Flex>
                  </Surface>
                )}
              </Flex>
            )}
          </>
        )}
      </Flex>
    </Flex>
  );
};

export default ProviderStatus;
