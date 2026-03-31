/**
 * AI Services — Service health monitoring and auto-discovery
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, Chip } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components/overlays';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import type { Timeseries } from '@dynatrace/strato-components/charts';
import { ExternalLinkIcon, CheckmarkIcon, WarningIcon, CriticalIcon, HelpIcon, ServicesIcon, BarChartIcon, MoneyIcon, ClockIcon, AnalyticsIcon, AIModelIcon, LargeLanguageModelIcon } from '@dynatrace/strato-icons';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAIServicesDiscovery, useDistinctServices, useDistinctProviders, useDistinctModels, QueryFilters } from '../hooks';
import { FilterBar } from '../components/FilterBar';
import { DavisResponse } from '../components/DavisResponse';
import { useGlobalFilters } from '../context';
import { useAskAI } from '../hooks/useAskAI';
import type { AskAIContext, AskAIMessage } from '../hooks/useAskAI';
import { TextInput } from '@dynatrace/strato-components/forms';
import { AiIcon } from '@dynatrace/strato-icons';
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
      <Text style={{ 
        fontSize: size === 'large' ? 16 : 12, 
        fontWeight: size === 'large' ? 600 : 400, 
        color: statusToColorMap[status] 
      }}>
        {labels[status]}
      </Text>
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
    <Text style={{ display: 'flex', alignItems: 'center' }}>{icon}</Text>
    <Flex>
      <Flex style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</Flex>
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
        <Flex>
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
        </Flex>
      </Flex>
      
      <Flex alignItems="center" gap={16} style={{ flex: 3 }}>
        <Flex style={{ textAlign: 'right', minWidth: 55 }}>
          <Flex style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.requestCount)}</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>requests</Flex>
        </Flex>
        <Flex style={{ textAlign: 'right', minWidth: 65 }}>
          <Flex style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.totalTokens)}</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>tokens</Flex>
        </Flex>
        <Flex style={{ textAlign: 'right', minWidth: 50 }}>
          <Flex style={{ fontSize: 12, fontWeight: 600 }}>{Number(service.avgLatency || 0).toFixed(0)}ms</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>latency</Flex>
        </Flex>
        <Flex style={{ textAlign: 'right', minWidth: 50 }}>
          <Flex style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.errorRate || 0) > 5 
              ? 'var(--dt-colors-feedback-critical-default)' 
              : Number(service.errorRate || 0) > 1 
              ? 'var(--dt-colors-feedback-warning-default)' 
              : 'var(--dt-colors-feedback-success-default)'
          }}>
            {Number(service.errorRate || 0).toFixed(1)}%
          </Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>error rate</Flex>
        </Flex>
        <Flex style={{ textAlign: 'right', minWidth: 55 }}>
          <Flex style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(service.estimatedCost)}</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>cost</Flex>
        </Flex>
        <Flex style={{ textAlign: 'right', minWidth: 45 }}>
          <Flex style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.slowRequestRate || 0) > 10 
              ? 'var(--dt-colors-feedback-critical-default)' 
              : Number(service.slowRequestRate || 0) > 5 
              ? 'var(--dt-colors-feedback-warning-default)' 
              : 'var(--dt-colors-feedback-success-default)'
          }}>
            {Number(service.slowRequestRate || 0).toFixed(1)}%
          </Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>slow</Flex>
        </Flex>
      </Flex>
      
      <Button variant="accent" onClick={() => onInvestigate(service.serviceName)}>
        Investigate
      </Button>
    </Flex>
  );
};

const HealthOverviewTab: React.FC = () => {
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

  // Health Details Modal
  const [healthModalOpen, setHealthModalOpen] = useState(false);

  // Conversational AI follow-up in health modal
  const [healthChatInput, setHealthChatInput] = useState('');
  const healthAIContext = useMemo<AskAIContext>(() => {
    const svcList = services ?? [];
    const healthInfo = svcList.length > 0 ? calculateOverallHealth(svcList) : null;
    const criticalSvcs = svcList.filter(s => s.healthStatus === 'critical');
    const warningSvcs = svcList.filter(s => s.healthStatus === 'warning');
    const dataSnapshot: Record<string, string | number | boolean | null> = {
      overallHealth: healthInfo?.overallHealth ?? 'unknown',
      totalServices: svcList.length,
      criticalCount: criticalSvcs.length,
      warningCount: warningSvcs.length,
      avgErrorRate: healthInfo?.avgErrorRate ?? 0,
      avgLatency: healthInfo?.avgLatency ?? 0,
    };
    // Add top critical/warning service details
    criticalSvcs.slice(0, 3).forEach((s, i) => {
      dataSnapshot[`critical_${i + 1}`] = `${s.serviceName} (errorRate=${s.errorRate.toFixed(1)}% latency=${s.avgLatency.toFixed(0)}ms)`;
    });
    warningSvcs.slice(0, 3).forEach((s, i) => {
      dataSnapshot[`warning_${i + 1}`] = `${s.serviceName} (errorRate=${s.errorRate.toFixed(1)}% latency=${s.avgLatency.toFixed(0)}ms)`;
    });
    return {
      domain: 'Health Dashboard',
      itemLabel: healthInfo ? `Overall: ${healthInfo.overallHealth}` : undefined,
      data: dataSnapshot,
      suggestedPrompts: [
        'Why is the overall health critical? Which services need immediate attention?',
        'What is causing high error rates across my AI services?',
        'Analyze latency patterns and recommend optimizations',
        'Compare the health of different AI providers',
        'What should I investigate first to improve overall health?',
      ],
    };
  }, [services]);
  const { messages: healthChatMessages, isLoading: healthChatLoading, error: healthChatError, ask: askHealthAI, clearMessages: clearHealthChat } = useAskAI(healthAIContext);

  // Inject blink keyframes for streaming cursor
  useEffect(() => {
    const id = 'health-modal-blink';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}';
      document.head.appendChild(style);
    }
  }, []);

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
        {/* Health Status — clickable to open details modal */}
        <Flex 
          alignItems="center" 
          gap={12} 
          padding={12}
          role="button"
          tabIndex={0}
          onClick={() => setHealthModalOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') setHealthModalOpen(true); }}
          style={{ 
            background: 'var(--dt-colors-surface-default)',
            borderRadius: 6,
            border: '1px solid var(--dt-colors-border-neutral-default)',
            minWidth: 180,
            cursor: 'pointer',
          }}
        >
          <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
          <Text style={{ fontSize: 12 }}>
            {healthMetrics.criticalCount > 0 && (
              <Text style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>
                {healthMetrics.criticalCount} critical
              </Text>
            )}
            {healthMetrics.criticalCount > 0 && healthMetrics.warningCount > 0 && ' • '}
            {healthMetrics.warningCount > 0 && (
              <Text style={{ color: 'var(--dt-colors-feedback-warning-default)' }}>
                {healthMetrics.warningCount} warning{healthMetrics.warningCount !== 1 ? 's' : ''}
              </Text>
            )}
            {healthMetrics.criticalCount === 0 && healthMetrics.warningCount === 0 && (
              <Text style={{ color: 'var(--dt-colors-feedback-success-default)' }}>All healthy</Text>
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
              <Text style={{ fontSize: 9, padding: '2px 6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--dt-colors-charts-categorical-color-06-default)', borderRadius: 10, fontWeight: 600 }}>UNIQUE GCC</Text>
            </Flex>
            {anomalies.map((a, i) => (
              <Flex key={i} alignItems="center" gap={8} style={{ padding: '4px 0' }}>
                <Text style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: a.severity === 'critical' ? STATUS_COLORS.critical : a.severity === 'high' ? STATUS_COLORS.warning : STATUS_COLORS.neutral
                }} />
                <Text style={{ fontSize: 12 }}>
                  <strong>{a.metric === 'token_usage' ? 'Token Usage' : a.metric === 'error_rate' ? 'Error Rate' : a.metric === 'latency' ? 'Latency' : a.metric === 'request_volume' ? 'Request Volume' : a.metric}:</strong> {a.description}
                </Text>
                {a.severity !== 'none' && (
                  <Text style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                    backgroundColor: a.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: a.severity === 'critical' ? 'var(--dt-colors-charts-status-critical-default)' : 'var(--dt-colors-charts-status-warning-default)'
                  }}>
                    {a.severity.toUpperCase()}
                  </Text>
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
                  <Heading level={4}>{formatNumber(rt.count)}</Heading>
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
                    <Flex style={{ 
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
                    </Flex>
                    <Flex style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13 }}>{service.serviceName}</Text>
                      <Flex gap={12} style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatCurrency(service.estimatedCost)} cost
                        </Text>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatNumber(service.totalTokens)} tokens
                        </Text>
                      </Flex>
                    </Flex>
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
                <Flex style={{ height: 180 }}>
                  <TimeseriesChart data={otelTokens}>
                    <TimeseriesChart.Legend hidden />
                  </TimeseriesChart>
                </Flex>
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
                <Flex style={{ height: 180 }}>
                  <TimeseriesChart data={otelDuration}>
                    <TimeseriesChart.Legend hidden />
                  </TimeseriesChart>
                </Flex>
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
            <Flex style={{ width: 90 }} />
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

      {/* Health Details Modal */}
      {healthModalOpen && (
        <Modal
          title="Health Score Breakdown"
          onDismiss={() => { setHealthModalOpen(false); clearHealthChat(); }}
          show={true}
          size="large"
        >
          <Flex flexDirection="column" gap={16} padding={16}>
            {/* Overall Health Summary */}
            <Surface style={{ padding: 16, borderLeft: `4px solid ${getHealthStatusColor(healthMetrics.overallHealth)}` }}>
              <Flex alignItems="center" gap={12}>
                <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
                <Flex flexDirection="column" gap={2}>
                  <Text style={{ fontWeight: 600 }}>
                    {healthMetrics.criticalCount} critical, {healthMetrics.warningCount} warning, {healthMetrics.healthyCount} healthy
                  </Text>
                  <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                    out of {healthMetrics.totalServices} services &bull; Avg Error Rate: {healthMetrics.avgErrorRate.toFixed(1)}% &bull; Avg Latency: {healthMetrics.avgLatency.toFixed(0)}ms
                  </Text>
                </Flex>
              </Flex>
            </Surface>

            {/* Thresholds Reference */}
            <Surface style={{ padding: 12 }}>
              <Text textStyle="small" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Health Thresholds</Text>
              <Flex gap={16} flexWrap="wrap">
                <Flex alignItems="center" gap={4}>
                  <Text style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.critical }} />
                  <Text style={{ fontSize: 11 }}>Critical: error &gt;10% OR latency &gt;6s OR issueScore &gt;30</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Text style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.warning }} />
                  <Text style={{ fontSize: 11 }}>Warning: error &gt;5% OR latency &gt;3s OR issueScore &gt;15</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Text style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS.ideal }} />
                  <Text style={{ fontSize: 11 }}>Healthy: all below thresholds</Text>
                </Flex>
              </Flex>
              <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)', marginTop: 6, display: 'block' }}>
                issueScore = errorRate&times;2 + slowRequestRate&times;1 + lowOutputRate&times;0.5
              </Text>
            </Surface>

            {/* Per-Service Health Breakdown */}
            <Text style={{ fontWeight: 600 }}>Per-Service Breakdown</Text>
            <Flex flexDirection="column" gap={6}>
              {services
                .sort((a, b) => {
                  const order: Record<HealthStatus, number> = { critical: 0, warning: 1, healthy: 2, unknown: 3 };
                  return (order[a.healthStatus] ?? 3) - (order[b.healthStatus] ?? 3);
                })
                .map((svc, i) => {
                  const slowRate = svc.slowRequestRate ?? 0;
                  const lowOut = svc.lowOutputRate ?? 0;
                  const issueScore = svc.errorRate * 2 + slowRate * 1 + lowOut * 0.5;
                  const factors: string[] = [];
                  if (svc.errorRate > 10) factors.push(`error rate ${svc.errorRate.toFixed(1)}% (>10%)`);
                  else if (svc.errorRate > 5) factors.push(`error rate ${svc.errorRate.toFixed(1)}% (>5%)`);
                  if (svc.avgLatency > 6000) factors.push(`latency ${svc.avgLatency.toFixed(0)}ms (>6s)`);
                  else if (svc.avgLatency > 3000) factors.push(`latency ${svc.avgLatency.toFixed(0)}ms (>3s)`);
                  if (issueScore > 30) factors.push(`issueScore ${issueScore.toFixed(1)} (>30)`);
                  else if (issueScore > 15) factors.push(`issueScore ${issueScore.toFixed(1)} (>15)`);
                  if (slowRate > 20) factors.push(`slow requests ${slowRate.toFixed(1)}% (>20%)`);
                  if (factors.length === 0) factors.push('all within thresholds');

                  return (
                    <Surface key={`health-${i}`} style={{ padding: 10, borderLeft: `3px solid ${getHealthStatusColor(svc.healthStatus)}` }}>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Flex alignItems="center" gap={8} style={{ flex: 2 }}>
                          <HealthStatusBadge status={svc.healthStatus} />
                          <Text style={{ fontSize: 12, fontWeight: 600 }}>{svc.serviceName}</Text>
                        </Flex>
                        <Flex gap={12} style={{ flex: 3 }} flexWrap="wrap">
                          <Text style={{ fontSize: 11, minWidth: 80 }}>
                            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>Error: </Text>
                            <Text style={{ color: svc.errorRate > 10 ? STATUS_COLORS.critical : svc.errorRate > 5 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{svc.errorRate.toFixed(1)}%</Text>
                          </Text>
                          <Text style={{ fontSize: 11, minWidth: 80 }}>
                            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>Latency: </Text>
                            <Text style={{ color: svc.avgLatency > 6000 ? STATUS_COLORS.critical : svc.avgLatency > 3000 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{svc.avgLatency.toFixed(0)}ms</Text>
                          </Text>
                          <Text style={{ fontSize: 11, minWidth: 80 }}>
                            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>Slow: </Text>
                            <Text style={{ color: slowRate > 20 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>{slowRate.toFixed(1)}%</Text>
                          </Text>
                          <Text style={{ fontSize: 11, minWidth: 80 }}>
                            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>Low Output: </Text>
                            <Text>{lowOut.toFixed(1)}%</Text>
                          </Text>
                        </Flex>
                        <Flex style={{ flex: 2 }}>
                          <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                            {svc.healthStatus !== 'healthy' ? factors.join(' | ') : ''}
                          </Text>
                        </Flex>
                      </Flex>
                    </Surface>
                  );
                })}
            </Flex>

            {/* Dynatrace Intelligence — Context-Aware Analysis + Conversation */}
            <Surface style={{ padding: 16, borderTop: '2px solid var(--dt-colors-border-neutral-default)' }}>
              <Flex flexDirection="column" gap={12}>
                {/* Header */}
                <Flex alignItems="center" justifyContent="space-between">
                  <Flex alignItems="center" gap={8}>
                    <AiIcon style={{ width: 18, height: 18, color: 'var(--dt-colors-charts-categorical-color-06-default)' }} />
                    <Text style={{ fontWeight: 600 }}>Dynatrace Intelligence</Text>
                    <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>context-aware AI analysis</Text>
                  </Flex>
                  <Flex gap={8}>
                    {healthChatMessages.length > 0 && (
                      <Button variant="default" onClick={clearHealthChat} disabled={healthChatLoading}>
                        Clear
                      </Button>
                    )}
                    <Button
                      variant="accent"
                      onClick={() => {
                        const criticalSvcs = services.filter(s => s.healthStatus === 'critical');
                        const warningSvcs = services.filter(s => s.healthStatus === 'warning');
                        const hm = calculateOverallHealth(services);

                        // Build a context-rich analysis prompt with actual data
                        let prompt = `Analyze the health of my ${services.length} AI services. Overall health is ${hm.overallHealth.toUpperCase()}.`;
                        prompt += ` Average error rate: ${hm.avgErrorRate.toFixed(1)}%, average latency: ${hm.avgLatency.toFixed(0)}ms.`;

                        if (criticalSvcs.length > 0) {
                          prompt += `\n\nCRITICAL services (${criticalSvcs.length}):`;
                          criticalSvcs.forEach(s => {
                            const sr = s.slowRequestRate ?? 0;
                            const lo = s.lowOutputRate ?? 0;
                            prompt += `\n- ${s.serviceName}: error rate ${s.errorRate.toFixed(1)}%, latency ${s.avgLatency.toFixed(0)}ms, slow requests ${sr.toFixed(1)}%, low output ${lo.toFixed(1)}%, ${s.requestCount} requests`;
                          });
                        }
                        if (warningSvcs.length > 0) {
                          prompt += `\n\nWARNING services (${warningSvcs.length}):`;
                          warningSvcs.forEach(s => {
                            const sr = s.slowRequestRate ?? 0;
                            const lo = s.lowOutputRate ?? 0;
                            prompt += `\n- ${s.serviceName}: error rate ${s.errorRate.toFixed(1)}%, latency ${s.avgLatency.toFixed(0)}ms, slow requests ${sr.toFixed(1)}%, low output ${lo.toFixed(1)}%, ${s.requestCount} requests`;
                          });
                        }

                        prompt += '\n\nFor each unhealthy service, explain the most likely root cause, which specific thresholds are breached, and what immediate actions should be taken. Prioritize by severity.';

                        void askHealthAI(prompt);
                      }}
                      disabled={healthChatLoading}
                    >
                      {healthChatLoading && healthChatMessages.length <= 1 ? 'Analyzing...' : 'Run Dynatrace Intelligence Analysis'}
                    </Button>
                  </Flex>
                </Flex>

                {/* Context badge */}
                <Surface style={{ padding: 8, borderLeft: '3px solid var(--dt-colors-border-accent-default)', borderRadius: 4 }}>
                  <Flex alignItems="center" gap={6}>
                    <AiIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)' }} />
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      Context: {services.length} services &bull; {services.filter(s => s.healthStatus === 'critical').length} critical &bull; {services.filter(s => s.healthStatus === 'warning').length} warning &bull; Avg error {healthMetrics.avgErrorRate.toFixed(1)}% &bull; Avg latency {healthMetrics.avgLatency.toFixed(0)}ms
                    </Text>
                  </Flex>
                </Surface>

                {/* Suggested prompts — shown only before first message */}
                {healthChatMessages.length === 0 && healthAIContext.suggestedPrompts && (
                  <Flex flexDirection="column" gap={6}>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--dt-colors-text-secondary-default)' }}>Suggested Questions</Text>
                    <Flex gap={6} flexWrap="wrap">
                      {healthAIContext.suggestedPrompts.map((prompt, i) => (
                        <Chip
                          key={i}
                          onClick={() => { void askHealthAI(prompt); }}
                          disabled={healthChatLoading}
                          style={{ opacity: healthChatLoading ? 0.5 : 1 }}
                        >
                          {prompt}
                        </Chip>
                      ))}
                    </Flex>
                  </Flex>
                )}

                {/* Conversation thread */}
                {healthChatMessages.length > 0 && (
                  <Flex style={{ maxHeight: 350, overflowY: 'auto', padding: '4px 0' }}>
                    <Flex flexDirection="column" gap={8}>
                      {healthChatMessages.map((msg) => (
                        msg.role === 'user' ? (
                          <Flex key={msg.id} justifyContent="flex-end">
                            <Surface style={{ padding: '6px 12px', borderRadius: 12, borderBottomRightRadius: 4, maxWidth: '80%', background: 'var(--dt-colors-surface-primary-default)' }}>
                              <Text style={{ fontSize: 12 }}>{msg.content}</Text>
                            </Surface>
                          </Flex>
                        ) : (
                          <Flex key={msg.id} justifyContent="flex-start" gap={6}>
                            <AiIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-charts-categorical-color-06-default)', marginTop: 4, flexShrink: 0 }} />
                            <Surface style={{ padding: '8px 12px', borderRadius: 12, borderBottomLeftRadius: 4, maxWidth: '90%' }}>
                              {msg.isLoading && !msg.content ? (
                                <Flex alignItems="center" gap={6}>
                                  <ProgressCircle size="small" />
                                  <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>Analyzing your AI services...</Text>
                                </Flex>
                              ) : (
                                <>
                                  <DavisResponse content={msg.content} />
                                  {msg.isStreaming && (
                                    <Text style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--dt-colors-charts-categorical-color-06-default)', marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
                                  )}
                                </>
                              )}
                            </Surface>
                          </Flex>
                        )
                      ))}
                    </Flex>
                  </Flex>
                )}

                {/* Error state */}
                {healthChatError && (
                  <Flex alignItems="center" gap={8} style={{ padding: '6px 10px', backgroundColor: 'rgba(255,165,0,0.1)', borderRadius: 6 }}>
                    <Text textStyle="small" style={{ flex: 1, color: 'var(--dt-colors-text-warning-default)' }}>Dynatrace Intelligence is temporarily unavailable.</Text>
                  </Flex>
                )}

                {/* Chat input — always visible for follow-up questions */}
                <Flex gap={8} alignItems="center">
                  <Flex style={{ flex: 1 }}>
                    <TextInput
                      placeholder={healthChatMessages.length === 0 ? 'Ask about your AI service health...' : 'Ask a follow-up question...'}
                      value={healthChatInput}
                      onChange={(val) => setHealthChatInput(val ?? '')}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const trimmed = healthChatInput.trim();
                          if (trimmed && !healthChatLoading) {
                            setHealthChatInput('');
                            void askHealthAI(trimmed);
                          }
                        }
                      }}
                      disabled={healthChatLoading}
                    />
                  </Flex>
                  <Button
                    variant="emphasized"
                    onClick={() => {
                      const trimmed = healthChatInput.trim();
                      if (trimmed && !healthChatLoading) {
                        setHealthChatInput('');
                        void askHealthAI(trimmed);
                      }
                    }}
                    disabled={healthChatLoading || !healthChatInput.trim()}
                  >
                    {healthChatLoading ? <ProgressCircle size="small" /> : 'Ask'}
                  </Button>
                </Flex>

                {healthChatMessages.length === 0 && !healthChatLoading && (
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center' }}>
                    Click "Run Dynatrace Intelligence Analysis" for a context-aware deep dive, or ask any question about your AI services.
                  </Text>
                )}
              </Flex>
            </Surface>
          </Flex>
        </Modal>
      )}
    </Flex>
  );
};

// ============================================
// Main HealthDashboard
// ============================================

export const HealthDashboard: React.FC = () => {
  return <HealthOverviewTab />;
};
