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

// ─── Methodology Help Modal ─────────────────────────────────────

const MethodologyHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'health' | 'readiness' | 'status'>('health');
  
  const sections = [
    { key: 'health' as const, label: 'Health Index' },
    { key: 'readiness' as const, label: 'Failover Readiness' },
    { key: 'status' as const, label: 'Status Thresholds' },
  ];

  return (
    <Modal title="Calculation Methodology" show={isOpen} onDismiss={onClose} size="large">
      <Flex flexDirection="column" gap={16} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Section Tabs */}
        <Flex gap={8}>
          {sections.map((s) => (
            <Button
              key={s.key}
              variant={activeSection === s.key ? 'accent' : 'default'}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </Flex>

        {/* Health Index Section */}
        {activeSection === 'health' && (
          <Flex flexDirection="column" gap={16}>
            <Surface padding={16} style={{ borderLeft: `3px solid ${STATUS_COLORS.healthy}` }}>
              <Flex flexDirection="column" gap={8}>
                <Heading level={5} style={{ margin: 0 }}>Provider Health Index (0–100)</Heading>
                <Text style={{ fontSize: 13, lineHeight: 1.5 }}>
                  The Health Index is a weighted composite score calculated from four real-time dimensions,
                  each contributing 25 points to the total score. All data is sourced from gen_ai.* OpenTelemetry spans.
                </Text>
              </Flex>
            </Surface>

            {/* Reliability Score */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>1. Reliability Score</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Measures error rate based on span.status_code == "error"</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: score = 100 × (1 − errorRate / 10)</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • 0% error rate → 100 (full 25 pts) | • 5% error rate → 50 (12.5 pts) | • ≥10% error rate → 0 (0 pts)
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Performance Score */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>2. Performance Score</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Based on p95 latency percentile (optimal for AI inference workloads)</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: score = 100 × (1 − (p95_ms − 500) / 4500)</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • ≤500ms → 100 (full 25 pts) | • 2000ms → 67 (16.7 pts) | • ≥5000ms → 0 (0 pts)
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Availability Score */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>3. Availability Score</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Uptime percentage: 100 × (1 − errors / total)</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: score = (availability − 90) × 10</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • 99.9%+ → 100 (full 25 pts) | • 99% → 90 (22.5 pts) | • 95% → 50 (12.5 pts) | • &lt;90% → 0 (0 pts)
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Freshness Score */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>4. Freshness Score</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Time since last successful span (detects brownouts/silent failures)</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: score = 100 × (1 − (minutesSinceLastSeen − 5) / 55)</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • ≤5 min ago → 100 (full 25 pts) | • 30 min ago → 55 (13.8 pts) | • ≥60 min ago → 0 (0 pts)
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            <Surface padding={12} style={{ borderLeft: `3px solid ${STATUS_COLORS.degraded}` }}>
              <Flex alignItems="center" gap={8}>
                <BarChartIcon />
                <Text style={{ fontSize: 13 }}>
                  <strong>Final Health Index</strong> = (Reliability + Performance + Availability + Freshness) / 4
                </Text>
              </Flex>
            </Surface>
          </Flex>
        )}

        {/* Failover Readiness Section */}
        {activeSection === 'readiness' && (
          <Flex flexDirection="column" gap={16}>
            <Surface padding={16} style={{ borderLeft: `3px solid ${STATUS_COLORS.healthy}` }}>
              <Flex flexDirection="column" gap={8}>
                <Heading level={5} style={{ margin: 0 }}>Failover Readiness Score (0–100)</Heading>
                <Text style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Measures your infrastructure's ability to handle provider outages. A high score means you're
                  well-positioned to failover traffic with minimal disruption.
                </Text>
              </Flex>
            </Surface>

            {/* Redundancy */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>1. Provider Redundancy</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Ratio of healthy providers to total providers</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: (healthyCount / totalProviders) × 25</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      Example: 3 of 4 providers healthy → 18.75 pts
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Diversification */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>2. Traffic Diversification</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Penalizes single-provider concentration (avoids single point of failure)</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: if maxShare ≤ 50% → 25 pts; else 25 × (1 − (maxShare − 0.5) × 2)</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • ≤50% to largest provider → full 25 pts | • 75% to one provider → 0 pts
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Average Health */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>3. Average Health</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Mean health index across all providers</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: (avgHealthIndex / 100) × 25</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      Example: Average health 80 → 20 pts
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            {/* Stability */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={8}>
                  <Text style={{ fontSize: 14, fontWeight: 700 }}>4. Stability</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS.healthy }}>(max 25 pts)</Text>
                </Flex>
                <Text style={{ fontSize: 13 }}>Penalizes critical/down providers</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>Formula: 25 × (1 − criticalOrDownCount / totalProviders)</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                      • No critical/down → full 25 pts | • 1 of 4 critical → 18.75 pts
                    </Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>
          </Flex>
        )}

        {/* Status Thresholds Section */}
        {activeSection === 'status' && (
          <Flex flexDirection="column" gap={16}>
            <Surface padding={16} style={{ borderLeft: `3px solid ${STATUS_COLORS.healthy}` }}>
              <Flex flexDirection="column" gap={8}>
                <Heading level={5} style={{ margin: 0 }}>Provider Status Classification</Heading>
                <Text style={{ fontSize: 13 }}>
                  Provider status is derived from the Health Index using these thresholds:
                </Text>
              </Flex>
            </Surface>

            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                {[
                  { status: 'healthy', range: '80–100', desc: 'Provider operating within normal parameters', color: STATUS_COLORS.healthy },
                  { status: 'degraded', range: '60–79', desc: 'Elevated errors or latency; monitor closely', color: STATUS_COLORS.degraded },
                  { status: 'critical', range: '30–59', desc: 'Significant issues; consider failover', color: STATUS_COLORS.critical },
                  { status: 'down', range: '0–29', desc: 'Provider effectively unavailable; failover recommended', color: STATUS_COLORS.down },
                ].map((s) => (
                  <Flex key={s.status} alignItems="center" gap={12}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: s.color }} />
                    <Text style={{ width: 70, fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</Text>
                    <Text style={{ width: 60, fontFamily: 'monospace', fontSize: 12 }}>{s.range}</Text>
                    <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{s.desc}</Text>
                  </Flex>
                ))}
              </Flex>
            </Surface>

            <Surface padding={16}>
              <Flex flexDirection="column" gap={8}>
                <Heading level={6} style={{ margin: 0 }}>Model-Level Status</Heading>
                <Text style={{ fontSize: 13 }}>Individual models are classified separately based on:</Text>
                <Surface padding={12} style={{ backgroundColor: 'var(--dt-colors-background-surface-subdued)' }}>
                  <Flex flexDirection="column" gap={4}>
                    <Text style={{ fontSize: 12 }}>• <strong>unknown</strong>: No data in last 30 minutes</Text>
                    <Text style={{ fontSize: 12 }}>• <strong>critical</strong>: Error rate &gt; 20%</Text>
                    <Text style={{ fontSize: 12 }}>• <strong>degraded</strong>: Error rate &gt; 5%</Text>
                    <Text style={{ fontSize: 12 }}>• <strong>healthy</strong>: Error rate ≤ 5%</Text>
                  </Flex>
                </Surface>
              </Flex>
            </Surface>

            <Surface padding={16} style={{ borderLeft: `3px solid ${STATUS_COLORS.degraded}` }}>
              <Flex flexDirection="column" gap={8}>
                <Heading level={6} style={{ margin: 0 }}>Data Source</Heading>
                <Text style={{ fontSize: 13 }}>
                  All metrics are computed in real-time from OpenTelemetry gen_ai.* semantic convention spans
                  stored in Dynatrace Grail. No mock data is used.
                </Text>
                <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
                  Required attributes: gen_ai.provider.name, gen_ai.request.model, span.status_code, duration
                </Text>
              </Flex>
            </Surface>
          </Flex>
        )}
      </Flex>
    </Modal>
  );
};

// ─── Main Page ──────────────────────────────────────────────────

export const ProviderStatus: React.FC = () => {
  const { providers, errorBursts, modelHealth, failoverEvents, trendData, overallReadiness, loading, error, refetch } = useProviderFailover();
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'errors' | 'events'>('overview');
  const [showMethodologyHelp, setShowMethodologyHelp] = useState(false);

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
          <Flex gap={8}>
            <Tooltip text="View calculation methodology">
              <Button variant="default" onClick={() => setShowMethodologyHelp(true)}>
                <Button.Prefix><HelpIcon /></Button.Prefix>
                Methodology
              </Button>
            </Tooltip>
            <Button variant="accent" onClick={() => refetch()} disabled={loading}>
              <Button.Prefix><RefreshIcon /></Button.Prefix>
              Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Methodology Help Modal */}
      <MethodologyHelpModal isOpen={showMethodologyHelp} onClose={() => setShowMethodologyHelp(false)} />

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
