// GenAI Control Center — Infrastructure Page
// Focus: what's NOT on other pages — deployment change tracking, service model config, model version history.
// Provider availability → /providers | Service metrics → /services | Davis problems → /problems

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { createDefaultTimeframe } from '../components/FilterBar';
import {
  HostsIcon,
  RefreshIcon,
  ServicesIcon,
  WorkflowsIcon,
  CodeIcon,
  AiIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useInfrastructure } from '../hooks';
import type { ServiceConfig, ModelHistoryEntry, DeploymentEvent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  healthy: Colors.Charts.Categorical.Color04.Default,
  warning: Colors.Charts.Categorical.Color06.Default,
  critical: Colors.Charts.Categorical.Color10.Default,
  neutral: Colors.Charts.Categorical.Color01.Default,
  purple: Colors.Charts.Categorical.Color05.Default,
};

const fmt = (n: number): string => (isFinite(n) ? n.toLocaleString() : '—');

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

const shortDate = (iso: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ─── Provider Badge ──────────────────────────────────────────────────────────

const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => {
  const colorMap: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#c07f4c',
    azure: '#0078d4',
    google: '#4285f4',
    bedrock: '#ff9900',
    cohere: '#39594d',
    mistral: '#ff7000',
  };
  const key = (provider ?? '').toLowerCase().split('.')[0];
  const color = Object.entries(colorMap).find(([k]) => key.includes(k))?.[1] ?? '#6b7280';
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 10,
      background: `${color}20`,
      color,
      border: `1px solid ${color}40`,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {provider || 'unknown'}
    </span>
  );
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
  const [timeframe, setTimeframe] = useState<Timeframe>(() => createDefaultTimeframe());
  const { deployments, serviceConfigs, modelHistory, loading, error, refetch } = useInfrastructure();

  useEffect(() => {
    void refetch(timeframe);
  }, [timeframe, refetch]);

  const kpis = useMemo(() => {
    const uniqueModels = new Set(serviceConfigs.map(s => s.model).filter(Boolean)).size;
    const multiModelServices = serviceConfigs.filter(s => s.modelVersions > 1).length;
    return {
      services: serviceConfigs.length,
      uniqueModels,
      deployments: deployments.length,
      multiModelServices,
    };
  }, [serviceConfigs, deployments]);

  return (
    <Flex flexDirection="column" gap={24} style={{ padding: 24, maxWidth: 1400 }}>

      {/* ─── Header ─── */}
      <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={12}>
        <Flex alignItems="center" gap={12}>
          <HostsIcon style={{ width: 28, height: 28, color: STATUS_COLORS.neutral }} />
          <Flex flexDirection="column" gap={0}>
            <Heading level={2}>AI Infrastructure</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>
              Service model config · Model version history · Deployment change events
            </Text>
          </Flex>
        </Flex>
        <Flex gap={8} alignItems="center">
          <TimeframeSelector value={timeframe} onChange={(tf) => tf && setTimeframe(tf)} />
          <Button variant="emphasized" onClick={() => refetch(timeframe)}>
            <RefreshIcon style={{ width: 14, height: 14 }} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </Flex>
      </Flex>

      {error && (
        <Surface style={{ padding: 12, background: `${STATUS_COLORS.critical}15`, border: `1px solid ${STATUS_COLORS.critical}` }}>
          <Text style={{ color: STATUS_COLORS.critical }}>Query error: {error.message}</Text>
        </Surface>
      )}

      {/* ─── KPI Cards ─── */}
      <Flex gap={16} flexWrap="wrap">
        <MetricCard
          icon={<ServicesIcon style={{ color: STATUS_COLORS.neutral }} />}
          label="AI Services"
          value={kpis.services}
          sub="services using AI models"
        />
        <MetricCard
          icon={<AiIcon style={{ color: STATUS_COLORS.purple }} />}
          label="Unique Models"
          value={kpis.uniqueModels}
          sub="distinct models in use"
          color={STATUS_COLORS.purple}
        />
        <MetricCard
          icon={<CodeIcon style={{ color: kpis.multiModelServices > 0 ? STATUS_COLORS.warning : STATUS_COLORS.healthy }} />}
          label="Multi-Model Services"
          value={kpis.multiModelServices}
          sub="using >1 model variant"
          color={kpis.multiModelServices > 0 ? STATUS_COLORS.warning : STATUS_COLORS.healthy}
        />
        <MetricCard
          icon={<WorkflowsIcon style={{ color: STATUS_COLORS.neutral }} />}
          label="Deployments"
          value={kpis.deployments}
          sub="in selected time range"
        />
      </Flex>

      {/* ─── Service Configuration Snapshot ─── */}
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <ServicesIcon />
          <Heading level={4}>AI Service Configuration</Heading>
          <Text textStyle="small" style={{ opacity: 0.6 }}>which model + provider each service is currently calling</Text>
        </Flex>

        {loading && serviceConfigs.length === 0 ? (
          <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>
        ) : serviceConfigs.length > 0 ? (
          <DataTable
            data={serviceConfigs}
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
                header: 'Current Model',
                id: 'model',
                accessor: 'model',
                cell: ({ value }) => (
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', color: STATUS_COLORS.purple }}>
                    {String(value ?? '—')}
                  </Text>
                ),
              },
              {
                header: 'Provider',
                id: 'provider',
                accessor: 'provider',
                width: 150,
                cell: ({ value }) => <ProviderBadge provider={String(value ?? '')} />,
              },
              {
                header: 'Model Variants',
                id: 'modelVersions',
                accessor: 'modelVersions',
                width: 130,
                cell: ({ value }) => {
                  const n = Number(value);
                  return (
                    <Text style={{ fontWeight: 600, color: n > 1 ? STATUS_COLORS.warning : 'inherit' }}>
                      {n > 1 ? `⚠ ${n} versions` : String(n)}
                    </Text>
                  );
                },
              },
              {
                header: 'Requests',
                id: 'requestCount',
                accessor: 'requestCount',
                width: 100,
                cell: ({ value }) => <Text style={{ fontWeight: 600 }}>{fmt(Number(value))}</Text>,
              },
              {
                header: 'Last Active',
                id: 'lastSeen',
                accessor: 'lastSeen',
                width: 130,
                cell: ({ value }) => (
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {relTime(String(value ?? ''))}
                  </Text>
                ),
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            No AI service configuration data found. Ensure services emit gen_ai.request.model or gen_ai.provider.name span attributes.
          </Text>
        )}
      </Surface>

      {/* ─── Model Version History + Deployments side by side ─── */}
      <Flex gap={16} flexWrap="wrap">

        {/* Model Usage History — 7d fixed window to capture full change history */}
        <Surface style={{ flex: '1 1 55%', padding: 16, minWidth: 340 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <AiIcon />
            <Heading level={4}>Model Usage History</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>last 7 days — detect model switches per service</Text>
          </Flex>

          {loading && modelHistory.length === 0 ? (
            <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>
          ) : modelHistory.length > 0 ? (
            <DataTable
              data={modelHistory}
              columns={[
                {
                  header: 'Service',
                  id: 'serviceName',
                  accessor: 'serviceName',
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Model',
                  id: 'model',
                  accessor: 'model',
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: STATUS_COLORS.purple }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Provider',
                  id: 'provider',
                  accessor: 'provider',
                  width: 130,
                  cell: ({ value }) => <ProviderBadge provider={String(value ?? '')} />,
                },
                {
                  header: 'Requests',
                  id: 'requestCount',
                  accessor: 'requestCount',
                  width: 90,
                  cell: ({ value }) => <Text style={{ fontSize: 11, fontWeight: 600 }}>{fmt(Number(value))}</Text>,
                },
                {
                  header: 'First Seen',
                  id: 'firstSeen',
                  accessor: 'firstSeen',
                  width: 120,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {shortDate(String(value ?? ''))}
                    </Text>
                  ),
                },
                {
                  header: 'Last Seen',
                  id: 'lastSeen',
                  accessor: 'lastSeen',
                  width: 120,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {relTime(String(value ?? ''))}
                    </Text>
                  ),
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={8} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              No model history data found for the last 7 days.
            </Text>
          )}
        </Surface>

        {/* Recent Deployments */}
        <Surface style={{ flex: '1 1 40%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <WorkflowsIcon />
            <Heading level={4}>Recent Deployments</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>changes that may affect AI behavior</Text>
          </Flex>

          {loading && deployments.length === 0 ? (
            <Flex justifyContent="center" padding={32}><ProgressCircle /></Flex>
          ) : deployments.length > 0 ? (
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
                  width: 130,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: STATUS_COLORS.neutral }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'When',
                  id: 'timestamp',
                  accessor: 'timestamp',
                  width: 120,
                  cell: ({ value }) => (
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {relTime(String(value ?? ''))}
                    </Text>
                  ),
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={8} />
            </DataTable>
          ) : (
            <Flex flexDirection="column" gap={8} style={{ padding: 16 }}>
              <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                {loading ? 'Loading…' : 'No deployment events found in this time range.'}
              </Text>
              <Text textStyle="small" style={{ opacity: 0.6 }}>
                Deployment events are captured by the Dynatrace OneAgent when new service versions are deployed.
              </Text>
            </Flex>
          )}
        </Surface>
      </Flex>

    </Flex>
  );
};
