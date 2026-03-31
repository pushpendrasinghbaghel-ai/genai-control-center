// GenAI Control Center — Infrastructure Page
// Focus: what's NOT on other pages — deployment change tracking, service model config, model version history.
// Provider availability → /providers | Service metrics → /services | Davis problems → /problems

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { DataTable } from '@dynatrace/strato-components/tables';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { createDefaultTimeframe } from '../components/FilterBar';
import {
  HostsIcon,
  RefreshIcon,
  ServicesIcon,
  WorkflowsIcon,
  CodeIcon,
  AiIcon,
  WarningIcon,
  CriticalIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useInfrastructure, useProviderDeepDive } from '../hooks';
import type { K8sEvent, ProcessRestart, RateLimitError } from '../hooks/useInfrastructure';
import type { ServiceConfig, ModelHistoryEntry, DeploymentEvent } from '../types';
import { formatDateTime, formatNumber } from '../utils/formatting';


// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  healthy: Colors.Charts.Categorical.Color04.Default,
  warning: Colors.Charts.Categorical.Color06.Default,
  critical: Colors.Charts.Categorical.Color10.Default,
  neutral: Colors.Charts.Categorical.Color01.Default,
  purple: Colors.Charts.Categorical.Color05.Default,
};

const fmt = (n: number): string => (isFinite(n) ? formatNumber(n) : '—');

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
    return formatDateTime(iso, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ─── Provider Badge ──────────────────────────────────────────────────────────

const ProviderBadge: React.FC<{ provider: string }> = ({ provider }) => {
  const colorMap: Record<string, string> = {
    openai: 'var(--dt-colors-charts-categorical-color-03-default)',
    anthropic: 'var(--dt-colors-charts-categorical-color-04-default)',
    azure: 'var(--dt-colors-charts-categorical-color-01-default)',
    google: 'var(--dt-colors-charts-categorical-color-01-default)',
    bedrock: 'var(--dt-colors-charts-categorical-color-04-default)',
    cohere: 'var(--dt-colors-charts-categorical-color-07-default)',
    mistral: 'var(--dt-colors-charts-categorical-color-04-default)',
  };
  const key = (provider ?? '').toLowerCase().split('.')[0];
  const color = Object.entries(colorMap).find(([k]) => key.includes(k))?.[1] ?? 'var(--dt-colors-text-neutral-default)';
  return (
    <Text style={{
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
    </Text>
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
  const { deployments, serviceConfigs, modelHistory, k8sEvents, processRestarts, rateLimitErrors, loading, error, refetch } = useInfrastructure();
  const {
    crossProviderSummary,
    refetch: deepDiveRefetch,
  } = useProviderDeepDive();

  useEffect(() => {
    void refetch(timeframe);
    void deepDiveRefetch();
  }, [timeframe, refetch, deepDiveRefetch]);

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
        <MetricCard
          icon={<CriticalIcon style={{ color: rateLimitErrors.length > 0 ? STATUS_COLORS.critical : STATUS_COLORS.healthy }} />}
          label="Rate Limit Errors"
          value={rateLimitErrors.reduce((s, r) => s + r.errorCount, 0)}
          sub={rateLimitErrors.length > 0 ? `${rateLimitErrors.length} service/model combos` : 'no 429s detected'}
          color={rateLimitErrors.length > 0 ? STATUS_COLORS.critical : STATUS_COLORS.healthy}
        />
        <MetricCard
          icon={<WarningIcon style={{ color: processRestarts.length > 0 ? STATUS_COLORS.warning : STATUS_COLORS.healthy }} />}
          label="Process Restarts"
          value={processRestarts.reduce((s, r) => s + r.restarts, 0)}
          sub={processRestarts.length > 0 ? `${processRestarts.length} process groups` : 'all stable'}
          color={processRestarts.length > 0 ? STATUS_COLORS.warning : STATUS_COLORS.healthy}
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



      {/* ─── Cross-Provider Summary ─── */}
      {crossProviderSummary.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <ServicesIcon />
            <Heading level={4}>Cross-Provider Summary</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>unified view across all AI providers</Text>
          </Flex>
          <DataTable
            data={crossProviderSummary}
            columns={[
              {
                header: 'Provider',
                id: 'provider',
                accessor: 'provider',
                cell: ({ value }) => <ProviderBadge provider={String(value ?? '')} />,
              },
              {
                header: 'Requests',
                id: 'requests',
                accessor: 'requests',
                width: 100,
                cell: ({ value }) => <Text style={{ fontWeight: 600 }}>{fmt(Number(value))}</Text>,
              },
              {
                header: 'Input Tokens',
                id: 'totalInput',
                accessor: 'totalInput',
                width: 110,
                cell: ({ value }) => <Text>{fmt(Number(value))}</Text>,
              },
              {
                header: 'Output Tokens',
                id: 'totalOutput',
                accessor: 'totalOutput',
                width: 110,
                cell: ({ value }) => <Text>{fmt(Number(value))}</Text>,
              },
              {
                header: 'Avg Latency',
                id: 'avgLatencyMs',
                accessor: 'avgLatencyMs',
                width: 100,
                cell: ({ value }) => <Text>{Number(value).toFixed(0)}ms</Text>,
              },
              {
                header: 'p99 Latency',
                id: 'p99LatencyMs',
                accessor: 'p99LatencyMs',
                width: 100,
                cell: ({ value }) => <Text>{Number(value).toFixed(0)}ms</Text>,
              },
              {
                header: 'Error Rate',
                id: 'errorRate',
                accessor: 'errorRate',
                width: 100,
                cell: ({ value }) => {
                  const pct = Number(value);
                  return (
                    <Text style={{
                      fontWeight: 600,
                      color: pct > 5 ? STATUS_COLORS.critical : pct > 1 ? STATUS_COLORS.warning : STATUS_COLORS.healthy,
                    }}>
                      {pct.toFixed(1)}%
                    </Text>
                  );
                },
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Surface>
      )}

      {/* ─── Rate Limit Errors & Process Restarts (side by side) ─── */}
      <Flex gap={16} flexWrap="wrap">
        {/* Rate Limit Errors (429s) */}
        <Surface style={{ flex: '1 1 50%', padding: 16, minWidth: 340 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <CriticalIcon style={{ color: STATUS_COLORS.critical }} />
            <Heading level={4}>Rate Limit Errors (429)</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>services hitting provider rate limits</Text>
          </Flex>
          {rateLimitErrors.length > 0 ? (
            <DataTable
              data={rateLimitErrors}
              columns={[
                {
                  header: 'Service',
                  id: 'service',
                  accessor: 'service',
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Model',
                  id: 'model',
                  accessor: 'model',
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: STATUS_COLORS.purple }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Errors',
                  id: 'errorCount',
                  accessor: 'errorCount',
                  width: 80,
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontWeight: 700, color: STATUS_COLORS.critical }}>
                      {fmt(Number(value))}
                    </Text>
                  ),
                },
                {
                  header: 'Last Seen',
                  id: 'lastOccurrence',
                  accessor: 'lastOccurrence',
                  width: 120,
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {relTime(String(value ?? ''))}
                    </Text>
                  ),
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', padding: 16 }}>
              No rate limit (429) errors detected. All providers within quota.
            </Text>
          )}
        </Surface>

        {/* Process Restarts */}
        <Surface style={{ flex: '1 1 45%', padding: 16, minWidth: 300 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <WarningIcon style={{ color: STATUS_COLORS.warning }} />
            <Heading level={4}>Process Restarts</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>AI service process group restarts</Text>
          </Flex>
          {processRestarts.length > 0 ? (
            <DataTable
              data={processRestarts}
              columns={[
                {
                  header: 'Process Group',
                  id: 'processGroup',
                  accessor: 'processGroup',
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Host',
                  id: 'host',
                  accessor: 'host',
                  cell: ({ value }: { value: unknown }) => (
                    <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {String(value ?? '—')}
                    </Text>
                  ),
                },
                {
                  header: 'Restarts',
                  id: 'restarts',
                  accessor: 'restarts',
                  width: 80,
                  cell: ({ value }: { value: unknown }) => {
                    const n = Number(value);
                    return (
                      <Text style={{ fontWeight: 700, color: n > 3 ? STATUS_COLORS.critical : n > 1 ? STATUS_COLORS.warning : 'inherit' }}>
                        {fmt(n)}
                      </Text>
                    );
                  },
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={5} />
            </DataTable>
          ) : (
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', padding: 16 }}>
              No process restarts detected. All services stable.
            </Text>
          )}
        </Surface>
      </Flex>

      {/* ─── K8s & Platform Events ─── */}
      {k8sEvents.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <HostsIcon />
            <Heading level={4}>Platform Events</Heading>
            <Text textStyle="small" style={{ opacity: 0.6 }}>K8s events, errors, and process restarts</Text>
          </Flex>
          <DataTable
            data={k8sEvents}
            columns={[
              {
                header: 'Time',
                id: 'timestamp',
                accessor: 'timestamp',
                width: 130,
                cell: ({ value }: { value: unknown }) => (
                  <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                    {shortDate(String(value ?? ''))}
                  </Text>
                ),
              },
              {
                header: 'Kind',
                id: 'eventKind',
                accessor: 'eventKind',
                width: 120,
                cell: ({ value }: { value: unknown }) => {
                  const kind = String(value ?? '');
                  const isError = kind.includes('ERROR');
                  return (
                    <Text style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                      background: isError ? `${STATUS_COLORS.critical}20` : `${STATUS_COLORS.neutral}20`,
                      color: isError ? STATUS_COLORS.critical : STATUS_COLORS.neutral,
                    }}>
                      {kind || '—'}
                    </Text>
                  );
                },
              },
              {
                header: 'Type',
                id: 'eventType',
                accessor: 'eventType',
                width: 140,
                cell: ({ value }: { value: unknown }) => (
                  <Text style={{ fontSize: 11 }}>{String(value ?? '—')}</Text>
                ),
              },
              {
                header: 'Entity',
                id: 'entityName',
                accessor: 'entityName',
                cell: ({ value }: { value: unknown }) => (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{String(value ?? '—')}</Text>
                ),
              },
              {
                header: 'Details',
                id: 'content',
                accessor: 'content',
                cell: ({ value }: { value: unknown }) => (
                  <Text style={{ fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(value ?? '—')}
                  </Text>
                ),
              },
            ]}
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Surface>
      )}

    </Flex>
  );
};
