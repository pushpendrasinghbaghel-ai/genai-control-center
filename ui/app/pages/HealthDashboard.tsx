/**
 * Health Dashboard - Pillar A: Auto-Discovery & Health-at-a-Glance
 * Standard Dynatrace app with FilterBar and deep linking to Services app
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { ExternalLinkIcon, CheckmarkIcon, WarningIcon, CriticalIcon, HelpIcon, ServicesIcon, BarChartIcon, MoneyIcon, ClockIcon, AnalyticsIcon, AIModelIcon, LargeLanguageModelIcon } from '@dynatrace/strato-icons';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAIServicesDiscovery, useDistinctServices, useDistinctProviders, useDistinctModels, QueryFilters } from '../hooks';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { calculateOverallHealth, formatNumber, formatCurrency, getHealthStatusColor } from '../utils';
import { detectTokenAnomalyAdaptive, detectErrorRateAnomaly, detectLatencyNovelty, detectRequestVolumeSeasonalAnomaly, type AnomalyResult } from '../utils/davisAnalyzers';
import type { AIService, HealthStatus } from '../types';

// Strato Design Tokens for status colors
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

// Health Status Badge Component
const HealthStatusBadge: React.FC<{ status: HealthStatus; size?: 'small' | 'large' }> = ({ 
  status, 
  size = 'small' 
}) => {
  const statusToColorMap: Record<HealthStatus, string> = {
    healthy: STATUS_COLORS.ideal,
    warning: STATUS_COLORS.warning,
    critical: STATUS_COLORS.critical,
    unknown: STATUS_COLORS.neutral,
  };
  const icons: Record<HealthStatus, React.ReactNode> = { 
    healthy: <CheckmarkIcon aria-hidden="true" style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: statusToColorMap.healthy }} />, 
    warning: <WarningIcon aria-hidden="true" style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: statusToColorMap.warning }} />, 
    critical: <CriticalIcon aria-hidden="true" style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: statusToColorMap.critical }} />, 
    unknown: <HelpIcon aria-hidden="true" style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: statusToColorMap.unknown }} /> 
  };
  const labels: Record<HealthStatus, string> = { 
    healthy: 'Healthy', 
    warning: 'Warning', 
    critical: 'Critical', 
    unknown: 'Unknown' 
  };
  
  return (
    <Flex alignItems="center" gap={4} aria-label={`Status: ${labels[status]}`}>
      {icons[status]}
      <span style={{ 
        fontSize: size === 'large' ? 16 : 12, 
        fontWeight: size === 'large' ? 600 : 400, 
        color: statusToColorMap[status] 
      }}>
        {labels[status]}
      </span>
    </Flex>
  );
};

// Metric Card Component - Compact horizontal layout
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
      border: '1px solid var(--dt-colors-border-neutral-default)'
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</div>
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

/**
 * Navigate directly to the new Services app for an entity
 * Opens in a new window/tab using getIntentLink with window.open
 */
const openEntityInServices = (entityId: string): void => {
  // Use dt.entity.service for service entities
  // Use 'dynatrace.services' for the Services app
  const intentUrl = getIntentLink(
    { 'dt.entity.service': entityId },
    'dynatrace.services',
    'view-service'
  );
  
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

// Service Row Component - Compact table-style layout with full metrics
const ServiceRow: React.FC<{ 
  service: AIService; 
  onInvestigate: (name: string) => void 
}> = ({ service, onInvestigate }) => {
  
  const handleOpenInServices = () => {
    if (service.entityId) {
      openEntityInServices(service.entityId);
    }
  };

  return (
    <Flex 
      padding={12} 
      justifyContent="space-between" 
      alignItems="center"
      style={{ 
        borderBottom: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      <Flex alignItems="center" gap={12} style={{ flex: 2 }}>
        <HealthStatusBadge status={service.healthStatus} />
        <div>
          <Flex alignItems="center" gap={6}>
            <Text style={{ fontWeight: 600, fontSize: 13 }}>{service.serviceName}</Text>
            {service.entityId && (
              <Button 
                variant="default"
                onClick={handleOpenInServices}
                title="Open in Services"
                style={{ padding: 2, minWidth: 'auto' }}
              >
                <ExternalLinkIcon />
              </Button>
            )}
          </Flex>
          <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
            <LargeLanguageModelIcon style={{ width: 12, height: 12, verticalAlign: 'middle', marginRight: 3 }} />
            {service.modelName || 'Unknown'} • {service.provider || 'Unknown'}
          </Text>
        </div>
      </Flex>
      
      <Flex alignItems="center" gap={16} style={{ flex: 3 }}>
        <div style={{ textAlign: 'right', minWidth: 55 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.requestCount)}</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>requests</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 65 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.totalTokens)}</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>tokens</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{Number(service.avgLatency || 0).toFixed(0)}ms</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>latency</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <div style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.errorRate || 0) > 5 
              ? 'var(--dt-colors-feedback-critical-default)' 
              : Number(service.errorRate || 0) > 1 
              ? 'var(--dt-colors-feedback-warning-default)' 
              : 'var(--dt-colors-feedback-success-default)'
          }}>
            {Number(service.errorRate || 0).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>error rate</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 55 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(service.estimatedCost)}</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>cost</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 45 }}>
          <div style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.slowRequestRate || 0) > 10 
              ? 'var(--dt-colors-feedback-critical-default)' 
              : Number(service.slowRequestRate || 0) > 5 
              ? 'var(--dt-colors-feedback-warning-default)' 
              : 'var(--dt-colors-feedback-success-default)'
          }}>
            {Number(service.slowRequestRate || 0).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>slow</div>
        </div>
      </Flex>
      
      <Button variant="accent" onClick={() => onInvestigate(service.serviceName)}>
        Investigate
      </Button>
    </Flex>
  );
};

export const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();

  // Data hooks with filters - use empty filters first to get available options
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();
  
  // Create a mapping from entity name to entity ID
  const serviceNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (availableServiceOptions) {
      availableServiceOptions.forEach(opt => {
        map.set(opt.entityName, opt.entityId);
      });
    }
    return map;
  }, [availableServiceOptions]);

  // Convert FilterOptions to QueryFilters for hooks
  // When user selects a service name, convert it to entity ID for querying
  const queryFilters: QueryFilters = useMemo(() => {
    const serviceEntityId = filters.serviceFilter 
      ? serviceNameToIdMap.get(filters.serviceFilter) || filters.serviceFilter
      : undefined;
    
    return {
      timeframe: filters.timeframe,
      serviceName: serviceEntityId,
      provider: filters.providerFilter || undefined,
      model: filters.modelFilter || undefined
    };
  }, [filters, serviceNameToIdMap]);

  // Data hooks with filters
  const { data: services, loading, error, refetch } = useAIServicesDiscovery(queryFilters);

  // Davis Anomaly Detection
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  const runAnomalyDetection = useCallback(async () => {
    setAnomalyLoading(true);
    try {
      const [tokenAnomaly, errorAnomaly, latencyNovelty, seasonalAnomaly] = await Promise.all([
        detectTokenAnomalyAdaptive(2).catch(() => null),
        detectErrorRateAnomaly(2).catch(() => null),
        detectLatencyNovelty(2).catch(() => null),
        detectRequestVolumeSeasonalAnomaly(2).catch(() => null),
      ]);
      const results: AnomalyResult[] = [];
      if (tokenAnomaly?.success && tokenAnomaly.hasAnomaly) results.push(tokenAnomaly);
      if (errorAnomaly?.success && errorAnomaly.hasAnomaly) results.push(errorAnomaly);
      if (latencyNovelty?.success && latencyNovelty.noveltyType !== 'NONE') {
        results.push({
          success: true,
          metric: latencyNovelty.metric,
          hasAnomaly: true,
          severity: latencyNovelty.noveltyScore > 0.8 ? 'critical' : latencyNovelty.noveltyScore > 0.5 ? 'high' : 'medium',
          description: latencyNovelty.description,
        });
      }
      if (seasonalAnomaly?.success && seasonalAnomaly.hasAnomaly) results.push(seasonalAnomaly);
      setAnomalies(results);
    } catch {
      // Analyzers unavailable — silently ignore
    } finally {
      setAnomalyLoading(false);
    }
  }, []);

  useEffect(() => {
    runAnomalyDetection();
  }, [runAnomalyDetection]);

  // OTel Native Metrics (pre-aggregated, 0 GB cost)
  const [otelTokens, setOtelTokens] = useState<Timeseries[]>([]);
  const [otelDuration, setOtelDuration] = useState<Timeseries[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { queryExecutionClient } = await import('@dynatrace-sdk/client-query');
        const [tokResp, durResp] = await Promise.all([
          queryExecutionClient.queryExecute({
            body: { query: 'timeseries avg(gen_ai.client.token.usage), from:now()-2h', requestTimeoutMilliseconds: 30000, fetchTimeoutSeconds: 30 }
          }),
          queryExecutionClient.queryExecute({
            body: { query: 'timeseries avg(gen_ai.client.operation.duration), from:now()-2h', requestTimeoutMilliseconds: 30000, fetchTimeoutSeconds: 30 }
          }),
        ]);
        const toTimeseries = (records: any[], metricKey: string, name: string): Timeseries[] => {
          if (!records?.length) return [];
          const rec = records[0];
          const tf = rec.timeframe;
          const vals = rec[metricKey] as (number | null)[];
          if (!tf || !vals) return [];
          const interval = Number(rec.interval) || 60000000000;
          const start = new Date(tf.start).getTime();
          return [{
            name,
            datapoints: vals.map((v, i) => ({ start: new Date(start + i * (interval / 1000000)), value: v ?? 0 }))
          }];
        };
        setOtelTokens(toTimeseries(tokResp.result?.records || [], 'avg(gen_ai.client.token.usage)', 'Avg Token Usage'));
        setOtelDuration(toTimeseries(durResp.result?.records || [], 'avg(gen_ai.client.operation.duration)', 'Avg Duration (s)'));
      } catch { /* OTel metrics not available */ }
    })();
  }, []);

  // Request Type Breakdown (chat/completion/embeddings)
  const [requestTypes, setRequestTypes] = useState<{ type: string; count: number; avgDuration: number }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { queryExecutionClient } = await import('@dynatrace-sdk/client-query');
        const resp = await queryExecutionClient.queryExecute({
          body: {
            query: `fetch spans, from:now()-2h | filter isNotNull(llm.request.type) | summarize cnt = count(), avg_dur = avg(duration), by: { llm.request.type } | sort cnt desc`,
            requestTimeoutMilliseconds: 30000, fetchTimeoutSeconds: 30,
          },
        });
        const records = resp.result?.records || [];
        setRequestTypes(records.map((r: any) => ({
          type: String(r['llm.request.type'] || 'unknown'),
          count: Number(r.cnt) || 0,
          avgDuration: (Number(r.avg_dur) || 0) / 1e6, // ns → ms
        })));
      } catch { /* request type data not available */ }
    })();
  }, []);

  const handleInvestigate = (serviceName: string) => {
    navigate(`/davis?service=${encodeURIComponent(serviceName)}`);
  };

  // Loading state
  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '40vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={12}>
          <ProgressCircle />
          <Text>Discovering AI services...</Text>
        </Flex>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '40vh' }}>
        <Surface>
          <Flex padding={24} flexDirection="column" alignItems="center" gap={12}>
            <WarningIcon style={{ width: 36, height: 36, color: 'var(--dt-colors-feedback-warning-default)' }} />
            <Heading level={5}>Error Loading Data</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              {error.message}
            </Text>
            <Button variant="accent" onClick={refetch}>Retry</Button>
          </Flex>
        </Surface>
      </Flex>
    );
  }

  // Empty state
  if (!services || services.length === 0) {
    return (
      <Flex flexDirection="column" gap={16} padding={16}>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refetch}
          isLoading={loading}
          availableServices={availableServiceOptions || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />

        <Flex justifyContent="center" alignItems="center" style={{ minHeight: '35vh' }}>
          <Surface>
            <Flex padding={24} flexDirection="column" alignItems="center" gap={12}>
              <ServicesIcon style={{ width: 36, height: 36, color: 'var(--dt-colors-text-secondary-default)' }} />
              <Heading level={5}>No AI Services Found</Heading>
              <Text style={{ 
                color: 'var(--dt-colors-text-secondary-default)', 
                textAlign: 'center', 
                maxWidth: 380,
                fontSize: 13 
              }}>
                No services with gen_ai.* attributes were detected. 
                Adjust the time range or ensure your AI services are instrumented.
              </Text>
              <Button variant="accent" onClick={refetch}>Refresh</Button>
            </Flex>
          </Surface>
        </Flex>
      </Flex>
    );
  }

  const healthMetrics = calculateOverallHealth(services);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <ServicesIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Services</TitleBar.Title>
        <TitleBar.Subtitle>Auto-discovered services using GenAI APIs with health and performance metrics</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button variant="accent" onClick={() => navigate('/architect')} aria-label="View AI Architect recommendations">
            Recommendations
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Service count indicator */}
      <Flex alignItems="center" gap={8}>
        <ServicesIcon aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
        <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
          {services.length} AI service{services.length !== 1 ? 's' : ''} discovered
        </Text>
      </Flex>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Health Status + Metrics Row - Compact inline */}
      <Flex gap={12} alignItems="stretch" flexWrap="wrap">
        {/* Health Status */}
        <Flex 
          alignItems="center" 
          gap={12} 
          padding={12}
          style={{ 
            background: 'var(--dt-colors-surface-default)',
            borderRadius: 6,
            border: '1px solid var(--dt-colors-border-neutral-default)',
            minWidth: 180
          }}
        >
          <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
          <Text style={{ fontSize: 12 }}>
            {healthMetrics.criticalCount > 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>
                {healthMetrics.criticalCount} critical
              </span>
            )}
            {healthMetrics.criticalCount > 0 && healthMetrics.warningCount > 0 && ' • '}
            {healthMetrics.warningCount > 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-warning-default)' }}>
                {healthMetrics.warningCount} warning{healthMetrics.warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {healthMetrics.criticalCount === 0 && healthMetrics.warningCount === 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-success-default)' }}>All healthy</span>
            )}
          </Text>
        </Flex>

        {/* Metrics - Compact - Key aggregates only (avoid duplicating per-row data) */}
        <MetricCard 
          value={services.length} 
          label="Services" 
          icon={<ServicesIcon style={{ width: 18, height: 18 }} />} 
          tooltip="Total number of services using gen_ai.* OpenTelemetry attributes. Each service represents a unique application calling AI APIs."
        />
        <MetricCard 
          value={formatNumber(healthMetrics.totalRequests)} 
          label="Requests" 
          icon={<AnalyticsIcon style={{ width: 18, height: 18 }} />} 
          tooltip="Total number of AI API requests across all services in the selected timeframe."
        />
        <MetricCard 
          value={formatNumber(healthMetrics.totalTokensToday)} 
          label="Tokens" 
          icon={<BarChartIcon style={{ width: 18, height: 18 }} />} 
          tooltip="Sum of all input (prompt) and output (completion) tokens across all services. 1K tokens ≈ 750 words."
        />
        <MetricCard 
          value={formatCurrency(healthMetrics.totalCostToday)} 
          label="Cost" 
          icon={<MoneyIcon style={{ width: 18, height: 18 }} />} 
          tooltip="Estimated cost based on token usage × provider pricing. Uses public rates (varies by provider and model)."
        />
        <MetricCard 
          value={`${healthMetrics.avgLatency.toFixed(0)}ms`} 
          label="Avg Latency" 
          icon={<ClockIcon style={{ width: 18, height: 18 }} />} 
          tooltip="Average response time across all AI requests. Higher latency may indicate model complexity, long prompts, or provider issues."
        />
      </Flex>

      {/* Davis Anomaly Alerts */}
      {anomalies.length > 0 && (
        <Surface style={{ padding: 12, borderLeft: `4px solid ${STATUS_COLORS.critical}` }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <CriticalIcon style={{ width: 16, height: 16, color: STATUS_COLORS.critical }} />
              <Text style={{ fontWeight: 600, fontSize: 13 }}>Davis AI Anomaly Detection</Text>
              <span style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</span>
            </Flex>
            {anomalies.map((a, i) => (
              <Flex key={i} alignItems="center" gap={8} style={{ padding: '4px 0' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: a.severity === 'critical' ? STATUS_COLORS.critical : a.severity === 'high' ? STATUS_COLORS.warning : STATUS_COLORS.neutral
                }} />
                <Text style={{ fontSize: 12 }}>
                  <strong>{a.metric === 'token_usage' ? 'Token Usage' : a.metric === 'error_rate' ? 'Error Rate' : a.metric === 'latency' ? 'Latency' : a.metric === 'request_volume' ? 'Request Volume' : a.metric}:</strong> {a.description}
                </Text>
                {a.severity !== 'none' && (
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                    backgroundColor: a.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: a.severity === 'critical' ? '#ef4444' : '#f59e0b'
                  }}>
                    {a.severity.toUpperCase()}
                  </span>
                )}
              </Flex>
            ))}
          </Flex>
        </Surface>
      )}

      {/* Request Type Breakdown (chat/completion/embeddings) */}
      {requestTypes.length > 0 && (
        <Flex gap={16} flexWrap="wrap">
          {requestTypes.map(rt => {
            const totalReqs = requestTypes.reduce((s, r) => s + r.count, 0);
            const pct = totalReqs > 0 ? ((rt.count / totalReqs) * 100).toFixed(1) : '0';
            return (
              <Surface key={rt.type} style={{ flex: '1 1 180px', padding: 16 }}>
                <Flex flexDirection="column" gap={6}>
                  <Flex alignItems="center" gap={6}>
                    <LargeLanguageModelIcon style={{ width: 14, height: 14 }} />
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, textTransform: 'capitalize' }}>{rt.type}</Text>
                  </Flex>
                  <Heading level={4}>{rt.count.toLocaleString()}</Heading>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    {pct}% &bull; avg {rt.avgDuration.toFixed(0)}ms
                  </Text>
                </Flex>
              </Surface>
            );
          })}
        </Flex>
      )}

      {/* Top Consumers - Quick insight into highest usage services */}
      {services.length > 1 && (
        <Surface>
          <Flex padding={16} flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <AnalyticsIcon style={{ width: 16, height: 16 }} />
              <Text style={{ fontWeight: 600 }}>Top Consumers</Text>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                Services with highest AI usage
              </Text>
            </Flex>
            <Flex gap={16} flexWrap="wrap">
              {services
                .sort((a, b) => b.estimatedCost - a.estimatedCost)
                .slice(0, 3)
                .map((service, idx) => (
                  <Flex 
                    key={`top-${idx}`}
                    padding={12}
                    gap={12}
                    alignItems="center"
                    style={{ 
                      background: 'var(--dt-colors-background-default-secondary)',
                      borderRadius: 6,
                      flex: '1 1 200px',
                      minWidth: 200
                    }}
                  >
                    <div style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      background: idx === 0 ? 'var(--dt-colors-feedback-warning-default)' : 'var(--dt-colors-border-neutral-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: idx === 0 ? '#000' : 'inherit'
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13 }}>{service.serviceName}</Text>
                      <Flex gap={12} style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatCurrency(service.estimatedCost)} cost
                        </Text>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatNumber(service.totalTokens)} tokens
                        </Text>
                      </Flex>
                    </div>
                  </Flex>
                ))}
            </Flex>
          </Flex>
        </Surface>
      )}

      {/* OTel Native Metrics — Pre-aggregated, 0 GB query cost */}
      {(otelTokens.length > 0 || otelDuration.length > 0) && (
        <Flex gap={16} flexWrap="wrap">
          {otelTokens.length > 0 && (
            <Surface style={{ flex: '1 1 400px', padding: 16 }}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={6}>
                  <BarChartIcon style={{ width: 14, height: 14 }} />
                  <Text style={{ fontWeight: 600, fontSize: 13 }}>Token Usage (OTel Metric)</Text>
                  <Tooltip text="Pre-aggregated gen_ai.client.token.usage metric — zero query cost">
                    <HelpIcon style={{ width: 12, height: 12, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <div style={{ height: 180 }}>
                  <TimeseriesChart data={otelTokens}>
                    <TimeseriesChart.Legend hidden />
                  </TimeseriesChart>
                </div>
              </Flex>
            </Surface>
          )}
          {otelDuration.length > 0 && (
            <Surface style={{ flex: '1 1 400px', padding: 16 }}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={6}>
                  <ClockIcon style={{ width: 14, height: 14 }} />
                  <Text style={{ fontWeight: 600, fontSize: 13 }}>Operation Duration (OTel Metric)</Text>
                  <Tooltip text="Pre-aggregated gen_ai.client.operation.duration metric — zero query cost">
                    <HelpIcon style={{ width: 12, height: 12, opacity: 0.5, cursor: 'help' }} />
                  </Tooltip>
                </Flex>
                <div style={{ height: 180 }}>
                  <TimeseriesChart data={otelDuration}>
                    <TimeseriesChart.Legend hidden />
                  </TimeseriesChart>
                </div>
              </Flex>
            </Surface>
          )}
        </Flex>
      )}

      {/* Service List - Table Style */}
      <Surface>
        <Flex flexDirection="column">
          {/* Table Header */}
          <Flex 
            padding={12} 
            style={{ 
              borderBottom: '1px solid var(--dt-colors-border-neutral-default)',
              background: 'var(--dt-colors-background-default-secondary)'
            }}
          >
            <Text style={{ flex: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>
              Service
            </Text>
            <Flex style={{ flex: 3 }} gap={16}>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 55 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Requests</Text>
                <Tooltip text="Total number of AI API calls made by this service">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 65 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</Text>
                <Tooltip text="Total input + output tokens consumed by this service">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 50 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Latency</Text>
                <Tooltip text="Average response time for AI requests from this service">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 50 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Errors</Text>
                <Tooltip text="Percentage of failed AI requests. >1% is warning, >5% is critical">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 55 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Cost</Text>
                <Tooltip text="Estimated cost based on tokens × provider pricing">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={4} style={{ textAlign: 'right', minWidth: 45 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Slow%</Text>
                <Tooltip text="Requests taking >3 seconds. High % indicates performance issues">
                  <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                </Tooltip>
              </Flex>
            </Flex>
            <div style={{ width: 90 }} />
          </Flex>
          
          {/* Service Rows */}
          {services
            .sort((a, b) => b.totalTokens - a.totalTokens)
            .map((service, index) => (
              <ServiceRow 
                key={`${service.serviceName}-${service.modelName}-${index}`} 
                service={service} 
                onInvestigate={handleInvestigate} 
              />
            ))}
        </Flex>
      </Surface>
    </Flex>
  );
};
