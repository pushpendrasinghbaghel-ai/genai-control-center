// GenAI Control Center - AI Model Drift Detection
// Track model behavior changes, semantic drift, and version updates

import React, { useMemo, useState, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { 
  RefreshIcon, 
  WarningIcon, 
  CheckmarkIcon, 
  CriticalIcon, 
  HelpIcon,
  AiIcon,
  BarChartIcon,
  ClockIcon,
  DocumentIcon,
  SettingIcon,
  ResearchIcon,
  ServicesIcon
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';

import { useModelDrift, type ModelDriftSummary, type DriftAnomaly, type DriftMetric } from '../hooks/useModelDrift';
import { formatNumber } from '../utils';

// ============================================
// Status Colors
// ============================================
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const DRIFT_COLORS = {
  normal: Colors.Charts.Status.Ideal.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

// ============================================
// Helper Components
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
      flex: '1 1 140px'
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

const DriftScoreGauge: React.FC<{ score: number; size?: 'small' | 'large' }> = ({ score, size = 'small' }) => {
  const color = score >= 70 ? STATUS_COLORS.critical : score >= 40 ? STATUS_COLORS.warning : STATUS_COLORS.ideal;
  const label = score >= 70 ? 'Critical' : score >= 40 ? 'Warning' : 'Normal';
  
  return (
    <Flex alignItems="center" gap={8}>
      <div style={{ position: 'relative', width: size === 'large' ? 60 : 40, height: size === 'large' ? 60 : 40 }}>
        <svg width="100%" height="100%" viewBox="0 0 40 40">
          {/* Background circle */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="var(--dt-colors-border-neutral-default)"
            strokeWidth="4"
          />
          {/* Progress circle */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${score} ${100 - score}`}
            strokeDashoffset="25"
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
        </svg>
        <span style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: size === 'large' ? 14 : 10,
          fontWeight: 600,
          color
        }}>
          {score}
        </span>
      </div>
      {size === 'large' && (
        <Text style={{ color, fontWeight: 500 }}>{label}</Text>
      )}
    </Flex>
  );
};

const TrendBadge: React.FC<{ trend: 'improving' | 'stable' | 'degrading' }> = ({ trend }) => {
  const config = {
    improving: { color: STATUS_COLORS.ideal, icon: '↑', label: 'Improving' },
    stable: { color: STATUS_COLORS.neutral, icon: '→', label: 'Stable' },
    degrading: { color: STATUS_COLORS.critical, icon: '↓', label: 'Degrading' }
  };
  const { color, icon, label } = config[trend];
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 4,
      backgroundColor: `${color}20`,
      color,
      fontSize: 11,
      fontWeight: 500
    }}>
      {icon} {label}
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: 'normal' | 'warning' | 'critical' }> = ({ severity }) => {
  const config = {
    normal: { color: STATUS_COLORS.ideal, icon: CheckmarkIcon, label: 'Normal' },
    warning: { color: STATUS_COLORS.warning, icon: WarningIcon, label: 'Warning' },
    critical: { color: STATUS_COLORS.critical, icon: CriticalIcon, label: 'Critical' }
  };
  const { color, icon: Icon, label } = config[severity];
  
  return (
    <Flex alignItems="center" gap={4}>
      <Icon style={{ width: 14, height: 14, color }} />
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </Flex>
  );
};

// ============================================
// Model Drift Detail Modal
// ============================================

interface ServiceUsage {
  serviceName: string;
  entityId: string;
  requestCount: number;
  avgLatency: number;
  errorRate: number;
}

interface DriftDetailModalProps {
  summary: ModelDriftSummary;
  onClose: () => void;
  onCaptureBaseline: (model: string) => void;
  onClearBaseline: (model: string) => void;
}

const DriftDetailModal: React.FC<DriftDetailModalProps> = ({ 
  summary, 
  onClose, 
  onCaptureBaseline,
  onClearBaseline 
}) => {
  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState<ServiceUsage[]>([]);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

  // Fetch services using this model
  useEffect(() => {
    const fetchServices = async () => {
      setServicesLoading(true);
      try {
        const response = await queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-7d
              | filter gen_ai.request.model == "${summary.model}" 
                AND gen_ai.provider.name == "${summary.provider}"
              | summarize {
                  request_count = count(),
                  avg_latency = avg(duration) / 1000000,
                  error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0
                }, by: { dt.entity.service, service.name }
              | sort request_count desc
              | limit 10
            `,
            requestTimeoutMilliseconds: 30000
          }
        });
        const records = response.result?.records || [];
        setServices(records.map((r: any) => ({
          serviceName: r['service.name'] || 'Unknown Service',
          entityId: r['dt.entity.service'] || '',
          requestCount: Number(r.request_count) || 0,
          avgLatency: Number(r.avg_latency) || 0,
          errorRate: Number(r.error_rate) || 0
        })));
      } catch (err) {
        console.error('Failed to fetch services:', err);
      } finally {
        setServicesLoading(false);
      }
    };
    fetchServices();
  }, [summary.model, summary.provider]);

  // Generate DRIFT SCORE trend (primary chart)
  const driftScoreTrend = useMemo((): Timeseries[] => {
    const now = Date.now();
    // Simulate drift score progression over 7 days (daily points)
    const baselineDrift = 10; // Started at low drift
    const currentDrift = summary.overallDriftScore;
    
    return [{
      name: 'Drift Score',
      datapoints: Array.from({ length: 7 }, (_, i) => {
        const timestamp = new Date(now - (6 - i) * 86400000); // 7 days
        const progress = i / 6;
        // Non-linear progression with some variance
        const value = baselineDrift + (currentDrift - baselineDrift) * Math.pow(progress, 0.7) + (Math.random() - 0.5) * 8;
        return { 
          start: timestamp, 
          end: new Date(timestamp.getTime() + 86400000), 
          value: Math.max(0, Math.min(100, value)) 
        };
      })
    }] as Timeseries[];
  }, [summary.overallDriftScore]);

  // Detailed metrics trend (optional, on-demand)
  const detailedTrendData = useMemo((): Timeseries[] => {
    if (!showDetailedMetrics) return [];
    
    const now = Date.now();
    const latencyMetric = summary.metrics.find(m => m.metricName === 'Average Latency');
    const qualityMetric = summary.metrics.find(m => m.metricName === 'Avg Output Tokens');
    const efficiencyMetric = summary.metrics.find(m => m.metricName === 'Token Efficiency');
    
    const trends: Timeseries[] = [];
    
    if (latencyMetric) {
      trends.push({
        name: 'Latency Δ%',
        datapoints: Array.from({ length: 7 }, (_, i) => {
          const timestamp = new Date(now - (6 - i) * 86400000);
          const progress = i / 6;
          const value = latencyMetric.changePercent * progress + (Math.random() - 0.5) * 5;
          return { start: timestamp, end: new Date(timestamp.getTime() + 86400000), value };
        })
      });
    }
    
    if (qualityMetric) {
      trends.push({
        name: 'Quality Δ%',
        datapoints: Array.from({ length: 7 }, (_, i) => {
          const timestamp = new Date(now - (6 - i) * 86400000);
          const progress = i / 6;
          const value = qualityMetric.changePercent * progress + (Math.random() - 0.5) * 5;
          return { start: timestamp, end: new Date(timestamp.getTime() + 86400000), value };
        })
      });
    }
    
    return trends as Timeseries[];
  }, [summary, showDetailedMetrics]);

  const operationTypeConfig = {
    chat: { color: STATUS_COLORS.good, label: 'Chat' },
    embeddings: { color: STATUS_COLORS.neutral, label: 'Embeddings' },
    completion: { color: STATUS_COLORS.warning, label: 'Completion' },
    unknown: { color: 'inherit', label: 'Unknown' }
  };
  const opConfig = operationTypeConfig[summary.operationType] || operationTypeConfig.unknown;
  
  return (
    <Modal title={`Drift Analysis: ${summary.model}`} show={true} onDismiss={onClose} size="large">
      <Flex flexDirection="column" gap={20} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex flexDirection="column" gap={4}>
            <Flex alignItems="center" gap={8}>
              <Text textStyle="base-emphasized">{summary.model}</Text>
              <span style={{ 
                display: 'inline-flex',
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: `${opConfig.color}20`,
                color: opConfig.color,
                fontSize: 11,
                fontWeight: 500
              }}>
                {opConfig.label}
              </span>
            </Flex>
            <Text textStyle="small" style={{ opacity: 0.7 }}>{summary.provider}</Text>
          </Flex>
          <DriftScoreGauge score={summary.overallDriftScore} size="large" />
        </Flex>

        {/* Baseline Actions */}
        <Surface style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small-emphasized">Baseline Period</Text>
              <Text textStyle="small" style={{ opacity: 0.7 }}>{summary.baselinePeriod}</Text>
            </Flex>
            <Flex gap={8}>
              <Button variant="emphasized" onClick={() => onCaptureBaseline(summary.model)}>
                <DocumentIcon /> Capture New Baseline
              </Button>
              <Button variant="default" onClick={() => onClearBaseline(summary.model)}>
                Clear Baseline
              </Button>
            </Flex>
          </Flex>
        </Surface>

        {/* Metrics Table */}
        <Flex flexDirection="column" gap={8}>
          <Text textStyle="base-emphasized">Drift Metrics (7 metrics)</Text>
          <Surface style={{ borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>METRIC</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>BASELINE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>CURRENT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>CHANGE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>DRIFT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>TREND</th>
                </tr>
              </thead>
              <tbody>
                {summary.metrics.map((metric, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{metric.metricName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontFamily: 'monospace' }}>
                      {metric.metricName.includes('Latency') 
                        ? `${metric.baselineValue.toFixed(0)}ms` 
                        : metric.metricName.includes('Rate')
                        ? `${metric.baselineValue.toFixed(2)}%`
                        : metric.metricName.includes('Efficiency')
                        ? metric.baselineValue.toFixed(3)
                        : formatNumber(metric.baselineValue)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontFamily: 'monospace' }}>
                      {metric.metricName.includes('Latency') 
                        ? `${metric.currentValue.toFixed(0)}ms` 
                        : metric.metricName.includes('Rate')
                        ? `${metric.currentValue.toFixed(2)}%`
                        : metric.metricName.includes('Efficiency')
                        ? metric.currentValue.toFixed(3)
                        : formatNumber(metric.currentValue)}
                    </td>
                    <td style={{ 
                      padding: '10px 12px', 
                      textAlign: 'right', 
                      fontSize: 13, 
                      fontFamily: 'monospace',
                      color: metric.changePercent > 0 
                        ? (metric.metricName.includes('Output') || metric.metricName.includes('Efficiency') ? STATUS_COLORS.ideal : STATUS_COLORS.critical)
                        : (metric.metricName.includes('Output') || metric.metricName.includes('Efficiency') ? STATUS_COLORS.critical : STATUS_COLORS.ideal)
                    }}>
                      {metric.changePercent >= 0 ? '+' : ''}{metric.changePercent.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <DriftScoreGauge score={metric.driftScore} size="small" />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <TrendBadge trend={metric.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </Flex>

        {/* Drift Score Trend (Primary) */}
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" justifyContent="space-between">
            <Flex alignItems="center" gap={8}>
              <BarChartIcon style={{ width: 14, height: 14 }} />
              <Text textStyle="base-emphasized">Drift Score Trend (7 days)</Text>
            </Flex>
            <Button 
              variant="default" 
              onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {showDetailedMetrics ? 'Hide Details' : 'Show Metric Details'}
            </Button>
          </Flex>
          <Surface style={{ padding: 12, borderRadius: 6 }}>
            <TimeseriesChart
              data={[...driftScoreTrend, ...detailedTrendData]}
              variant="line"
              height={140}
            >
              <TimeseriesChart.Legend />
              <TimeseriesChart.Tooltip variant="shared" />
            </TimeseriesChart>
          </Surface>
          {/* Drift threshold lines explanation */}
          <Flex gap={16} justifyContent="center" style={{ fontSize: 10, opacity: 0.6 }}>
            <span>🟢 Normal: 0-39</span>
            <span>🟡 Warning: 40-69</span>
            <span>🔴 Critical: 70+</span>
          </Flex>
        </Flex>

        {/* Services & Agents Using This Model - Business Impact */}
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={8}>
            <ServicesIcon style={{ width: 14, height: 14 }} />
            <Text textStyle="base-emphasized">Business Impact - Services Using This Model</Text>
          </Flex>
          {servicesLoading ? (
            <Flex justifyContent="center" padding={16}>
              <ProgressCircle aria-label="Loading services" />
            </Flex>
          ) : services.length > 0 ? (
            <Surface style={{ borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>SERVICE / AGENT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>REQUESTS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>AVG LATENCY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>ERROR RATE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>IMPACT</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, idx) => {
                    // Calculate impact based on request volume and drift severity
                    const requestShare = services.length > 0 ? (svc.requestCount / services.reduce((sum, s) => sum + s.requestCount, 0)) * 100 : 0;
                    const impactLevel = requestShare > 50 ? 'High' : requestShare > 20 ? 'Medium' : 'Low';
                    const impactColor = impactLevel === 'High' ? STATUS_COLORS.critical : impactLevel === 'Medium' ? STATUS_COLORS.warning : STATUS_COLORS.neutral;
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>
                          <Flex flexDirection="column" gap={2}>
                            <Text textStyle="small-emphasized">{svc.serviceName}</Text>
                            {svc.entityId && (
                              <Text textStyle="small" style={{ opacity: 0.5, fontSize: 10 }}>{svc.entityId}</Text>
                            )}
                          </Flex>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>
                          {formatNumber(svc.requestCount)}
                          <span style={{ fontSize: 10, opacity: 0.6 }}> ({requestShare.toFixed(0)}%)</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace' }}>
                          {svc.avgLatency.toFixed(0)}ms
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: svc.errorRate > 1 ? STATUS_COLORS.critical : 'inherit' }}>
                          {svc.errorRate.toFixed(2)}%
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: `${impactColor}20`,
                            color: impactColor,
                            fontSize: 10,
                            fontWeight: 600
                          }}>
                            {impactLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Surface>
          ) : (
            <Surface style={{ padding: 16, borderRadius: 6, textAlign: 'center' }}>
              <Text textStyle="small" style={{ opacity: 0.6 }}>No service data available for this model</Text>
            </Surface>
          )}
          {services.length > 0 && summary.severity !== 'normal' && (
            <Surface style={{ padding: 10, borderRadius: 6, backgroundColor: `${STATUS_COLORS.warning}10`, borderLeft: `3px solid ${STATUS_COLORS.warning}` }}>
              <Text textStyle="small" style={{ opacity: 0.9 }}>
                ⚠️ <strong>Drift Impact:</strong> {services.length} service(s) consuming this model. 
                {summary.severity === 'critical' 
                  ? ' Critical drift may affect user experience and business outcomes.'
                  : ' Monitor closely for potential degradation.'}
              </Text>
            </Surface>
          )}
        </Flex>

        {/* Anomalies */}
        {summary.anomalies.length > 0 && (
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="base-emphasized">Detected Anomalies</Text>
            {summary.anomalies.map((anomaly, idx) => (
              <Surface key={idx} style={{ 
                padding: 12, 
                borderRadius: 6,
                borderLeft: `3px solid ${anomaly.severity === 'critical' ? STATUS_COLORS.critical : STATUS_COLORS.warning}`
              }}>
                <Flex flexDirection="column" gap={4}>
                  <Flex alignItems="center" gap={8}>
                    {anomaly.severity === 'critical' 
                      ? <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.critical }} />
                      : <WarningIcon style={{ width: 14, height: 14, color: STATUS_COLORS.warning }} />
                    }
                    <Text textStyle="small-emphasized">{anomaly.title}</Text>
                  </Flex>
                  <Text textStyle="small" style={{ opacity: 0.8 }}>{anomaly.description}</Text>
                </Flex>
              </Surface>
            ))}
          </Flex>
        )}
      </Flex>
    </Modal>
  );
};

// ============================================
// Main Component
// ============================================

/** Create a default Timeframe (last 7 days for drift detection) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-7d', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

export const ModelDrift: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [selectedModel, setSelectedModel] = useState<ModelDriftSummary | null>(null);
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all');
  
  const {
    versions,
    driftSummaries,
    anomalies,
    loading,
    error,
    lastRefresh,
    refetch,
    captureBaseline,
    clearBaseline,
    totalModels,
    totalProviders,
    totalCombinations,
    modelsWithDrift,
    criticalDriftCount,
    avgDriftScore
  } = useModelDrift(timeframe);

  // Filter summaries by operation type
  const filteredSummaries = useMemo(() => {
    if (operationTypeFilter === 'all') return driftSummaries;
    return driftSummaries.filter(s => s.operationType === operationTypeFilter);
  }, [driftSummaries, operationTypeFilter]);

  // Count by operation type for filter badges
  const operationTypeCounts = useMemo(() => {
    const counts = { chat: 0, embeddings: 0, completion: 0, unknown: 0 };
    driftSummaries.forEach(s => {
      if (counts[s.operationType] !== undefined) {
        counts[s.operationType]++;
      }
    });
    return counts;
  }, [driftSummaries]);

  // Generate mock trend data for visualization
  const driftTrendData = useMemo((): Timeseries[] => {
    if (filteredSummaries.length === 0) return [];
    
    // Create trend lines for top 5 models by drift score
    const topModels = filteredSummaries.slice(0, 5);
    const now = Date.now();
    
    return topModels.map((summary) => ({
      name: summary.model,
      datapoints: Array.from({ length: 24 }, (_, i) => {
        const timestamp = new Date(now - (23 - i) * 3600000);
        return {
          start: timestamp,
          end: new Date(timestamp.getTime() + 3600000),
          value: Math.max(0, summary.overallDriftScore + (Math.random() - 0.5) * 20)
        };
      })
    })) as Timeseries[];
  }, [filteredSummaries]);

  // DataTable columns for drift summaries (using any[] type for flexibility)
  const driftTableColumns: any[] = [
    {
      id: 'model',
      header: 'Model',
      accessor: 'model',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => (
        <Flex flexDirection="column" gap={2}>
          <Text textStyle="small-emphasized">{rowData.model}</Text>
          <Text textStyle="small" style={{ opacity: 0.6 }}>{rowData.provider}</Text>
        </Flex>
      ),
      minWidth: 180
    },
    {
      id: 'operationType',
      header: 'Type',
      accessor: 'operationType',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => {
        const typeConfig = {
          chat: { color: STATUS_COLORS.good, label: 'Chat' },
          embeddings: { color: STATUS_COLORS.neutral, label: 'Embed' },
          completion: { color: STATUS_COLORS.warning, label: 'Compl' },
          unknown: { color: 'inherit', label: 'Other' }
        };
        const config = typeConfig[rowData.operationType] || typeConfig.unknown;
        return (
          <span style={{ 
            display: 'inline-flex',
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: `${config.color}20`,
            color: config.color,
            fontSize: 11,
            fontWeight: 500
          }}>
            {config.label}
          </span>
        );
      },
      minWidth: 70
    },
    {
      id: 'driftScore',
      header: 'Drift Score',
      accessor: 'overallDriftScore',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => <DriftScoreGauge score={rowData.overallDriftScore} />,
      minWidth: 100
    },
    {
      id: 'severity',
      header: 'Status',
      accessor: 'severity',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => <SeverityBadge severity={rowData.severity} />,
      minWidth: 100
    },
    {
      id: 'latencyChange',
      header: 'Latency Δ',
      accessor: 'metrics',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => {
        const latencyMetric = rowData.metrics.find(m => m.metricName === 'Average Latency');
        if (!latencyMetric) return <span>-</span>;
        return (
          <span style={{ 
            color: latencyMetric.changePercent > 20 ? STATUS_COLORS.critical : 
                   latencyMetric.changePercent > 10 ? STATUS_COLORS.warning : 
                   'inherit'
          }}>
            {latencyMetric.changePercent >= 0 ? '+' : ''}{latencyMetric.changePercent.toFixed(1)}%
          </span>
        );
      },
      minWidth: 90
    },
    {
      id: 'qualityChange',
      header: 'Quality Δ',
      accessor: 'metrics',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => {
        const outputMetric = rowData.metrics.find(m => m.metricName === 'Avg Output Tokens');
        if (!outputMetric) return <span>-</span>;
        return (
          <span style={{ 
            color: outputMetric.changePercent < -20 ? STATUS_COLORS.critical : 
                   outputMetric.changePercent < -10 ? STATUS_COLORS.warning : 
                   'inherit'
          }}>
            {outputMetric.changePercent >= 0 ? '+' : ''}{outputMetric.changePercent.toFixed(1)}%
          </span>
        );
      },
      minWidth: 90
    },
    {
      id: 'efficiency',
      header: 'Efficiency',
      accessor: 'metrics',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => {
        const effMetric = rowData.metrics.find(m => m.metricName === 'Token Efficiency');
        if (!effMetric) return <span>-</span>;
        return (
          <Tooltip text={`Output/Input ratio: ${effMetric.currentValue.toFixed(2)} (${effMetric.changePercent >= 0 ? '+' : ''}${effMetric.changePercent.toFixed(1)}% from baseline)`}>
            <span style={{ 
              color: effMetric.changePercent < -30 ? STATUS_COLORS.critical : 
                     effMetric.changePercent < -15 ? STATUS_COLORS.warning : 
                     effMetric.changePercent > 10 ? STATUS_COLORS.ideal :
                     'inherit',
              cursor: 'help'
            }}>
              {effMetric.currentValue.toFixed(2)}
            </span>
          </Tooltip>
        );
      },
      minWidth: 80
    },
    {
      id: 'anomalies',
      header: 'Anomalies',
      accessor: 'anomalies',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => (
        <span style={{ 
          color: rowData.anomalies.length > 0 ? STATUS_COLORS.warning : 'inherit',
          fontWeight: rowData.anomalies.length > 0 ? 600 : 400
        }}>
          {rowData.anomalies.length}
        </span>
      ),
      minWidth: 80
    },
    {
      id: 'baseline',
      header: 'Baseline',
      accessor: 'baselinePeriod',
      cell: ({ value }: { value: string }) => (
        <Text textStyle="small" style={{ opacity: 0.7 }}>{value}</Text>
      ),
      minWidth: 120
    },
    {
      id: 'actions',
      header: '',
      accessor: 'model',
      cell: ({ rowData }: { rowData: ModelDriftSummary }) => (
        <Button variant="default" onClick={() => setSelectedModel(rowData)}>
          Analyze
        </Button>
      ),
      minWidth: 90
    }
  ];

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      {/* TitleBar */}
      <TitleBar>
        <TitleBar.Prefix>
          <ResearchIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Model Drift Detection</TitleBar.Title>
        <TitleBar.Subtitle>Track model behavior changes, semantic drift, and version updates</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <TimeframeSelector
              value={timeframe}
              onChange={(tf) => tf && setTimeframe(tf)}
            />
            <Button variant="emphasized" onClick={refetch} disabled={loading}>
              <RefreshIcon /> Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Summary Cards */}
      <Flex gap={12} flexWrap="wrap">
        <MetricCard
          icon={<AiIcon style={{ width: 18, height: 18, color: STATUS_COLORS.good }} />}
          label="Unique Models"
          value={totalModels}
          tooltip="Number of unique AI model names detected"
        />
        <MetricCard
          icon={<DocumentIcon style={{ width: 18, height: 18, color: STATUS_COLORS.neutral }} />}
          label="Providers"
          value={totalProviders}
          tooltip="Number of unique AI providers (OpenAI, Azure, etc.)"
        />
        <MetricCard
          icon={<CriticalIcon style={{ width: 18, height: 18, color: anomalies.length > 0 ? STATUS_COLORS.warning : STATUS_COLORS.neutral }} />}
          label="Anomalies"
          value={anomalies.length}
          color={anomalies.length > 0 ? STATUS_COLORS.warning : undefined}
          tooltip="Total anomalies detected (latency spikes, quality drops, errors, etc.)"
        />
        <MetricCard
          icon={<WarningIcon style={{ width: 18, height: 18, color: STATUS_COLORS.warning }} />}
          label="With Drift"
          value={modelsWithDrift}
          color={modelsWithDrift > 0 ? STATUS_COLORS.warning : undefined}
          tooltip="Models with drift score ≥ 40 (warning or critical)"
        />
        <MetricCard
          icon={<CriticalIcon style={{ width: 18, height: 18, color: STATUS_COLORS.critical }} />}
          label="Critical"
          value={criticalDriftCount}
          color={criticalDriftCount > 0 ? STATUS_COLORS.critical : undefined}
          tooltip="Combinations with drift score ≥ 70 requiring immediate attention"
        />
        <MetricCard
          icon={<BarChartIcon style={{ width: 18, height: 18 }} />}
          label="Avg Score"
          value={avgDriftScore}
          color={avgDriftScore >= 70 ? STATUS_COLORS.critical : avgDriftScore >= 40 ? STATUS_COLORS.warning : STATUS_COLORS.ideal}
          tooltip="Average drift score across all combinations (0-100)"
        />
      </Flex>

      {/* Anomaly Alert Banner */}
      {anomalies.length > 0 && (
        <Surface style={{ 
          padding: 12, 
          borderRadius: 6, 
          backgroundColor: `${STATUS_COLORS.warning}10`,
          borderLeft: `3px solid ${STATUS_COLORS.warning}`
        }}>
          <Flex alignItems="center" gap={12}>
            <WarningIcon style={{ width: 20, height: 20, color: STATUS_COLORS.warning }} />
            <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
              <Text textStyle="small-emphasized" style={{ color: STATUS_COLORS.warning }}>
                {anomalies.length} Drift Anomalies Detected
              </Text>
              <Text textStyle="small" style={{ opacity: 0.8 }}>
                {anomalies.filter(a => a.severity === 'critical').length} critical, {anomalies.filter(a => a.severity === 'warning').length} warnings
              </Text>
            </Flex>
            <Button variant="default" onClick={() => {
              const firstAnomalyModel = driftSummaries.find(s => s.anomalies.length > 0);
              if (firstAnomalyModel) setSelectedModel(firstAnomalyModel);
            }}>
              View Details
            </Button>
          </Flex>
        </Surface>
      )}

      {/* Operation Type Filter */}
      <Flex alignItems="center" gap={8}>
        <Text textStyle="small" style={{ opacity: 0.7 }}>Filter by type:</Text>
        <Flex gap={4}>
          <Button 
            variant={operationTypeFilter === 'all' ? 'emphasized' : 'default'}
            onClick={() => setOperationTypeFilter('all')}
          >
            All ({driftSummaries.length})
          </Button>
          {operationTypeCounts.chat > 0 && (
            <Button 
              variant={operationTypeFilter === 'chat' ? 'emphasized' : 'default'}
              onClick={() => setOperationTypeFilter('chat')}
            >
              Chat ({operationTypeCounts.chat})
            </Button>
          )}
          {operationTypeCounts.embeddings > 0 && (
            <Button 
              variant={operationTypeFilter === 'embeddings' ? 'emphasized' : 'default'}
              onClick={() => setOperationTypeFilter('embeddings')}
            >
              Embeddings ({operationTypeCounts.embeddings})
            </Button>
          )}
          {operationTypeCounts.completion > 0 && (
            <Button 
              variant={operationTypeFilter === 'completion' ? 'emphasized' : 'default'}
              onClick={() => setOperationTypeFilter('completion')}
            >
              Completion ({operationTypeCounts.completion})
            </Button>
          )}
          {operationTypeCounts.unknown > 0 && (
            <Button 
              variant={operationTypeFilter === 'unknown' ? 'emphasized' : 'default'}
              onClick={() => setOperationTypeFilter('unknown')}
            >
              Other ({operationTypeCounts.unknown})
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16 }}>
        {/* Drift Scores Table */}
        <Surface padding={16} style={{ borderRadius: 8 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16 }} />
              <Heading level={6}>Model Drift Scores</Heading>
              <Tooltip text="Drift score measures how much model behavior has changed from baseline. Higher scores indicate more significant changes that may affect quality or performance.">
                <HelpIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
              </Tooltip>
            </Flex>

            {loading ? (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle aria-label="Loading drift data" />
              </Flex>
            ) : filteredSummaries.length > 0 ? (
              <DataTable
                data={filteredSummaries}
                columns={driftTableColumns}
                sortable
                resizable
              >
                <DataTable.EmptyState>No models found</DataTable.EmptyState>
              </DataTable>
            ) : (
              <Flex flexDirection="column" alignItems="center" padding={32} gap={8}>
                <AiIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <Text style={{ opacity: 0.6 }}>No model data available for drift analysis</Text>
                <Text textStyle="small" style={{ opacity: 0.4 }}>Models need at least 7 days of data for baseline comparison</Text>
              </Flex>
            )}
          </Flex>
        </Surface>

        {/* Right Sidebar */}
        <Flex flexDirection="column" gap={16}>
          {/* Drift Trend Chart */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <BarChartIcon style={{ width: 14, height: 14 }} />
                <Text textStyle="small-emphasized">Drift Score Trend (24h)</Text>
              </Flex>
              {driftTrendData.length > 0 ? (
                <TimeseriesChart
                  data={driftTrendData}
                  variant="line"
                  height={180}
                >
                  <TimeseriesChart.Tooltip variant="shared" />
                  <TimeseriesChart.Legend position="bottom" />
                </TimeseriesChart>
              ) : (
                <Flex justifyContent="center" alignItems="center" style={{ height: 180, opacity: 0.5 }}>
                  <Text textStyle="small">Insufficient data for trend</Text>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* What is Model Drift? */}
          <Surface padding={16} style={{ borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <HelpIcon style={{ width: 14, height: 14 }} />
                <Text textStyle="small-emphasized">Understanding Model Drift</Text>
              </Flex>
              <Text textStyle="small" style={{ lineHeight: 1.6, opacity: 0.8 }}>
                <strong>Model Drift</strong> detects AI behavior changes using 7 metrics:
              </Text>
              <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 11, lineHeight: 1.7, opacity: 0.7 }}>
                <li><strong>Latency</strong> (25%) - Response time degradation</li>
                <li><strong>Output Tokens</strong> (15%) - Quality/completeness</li>
                <li><strong>Error Rate</strong> (20%) - Reliability issues</li>
                <li><strong>P95 Latency</strong> (15%) - Tail latency spikes</li>
                <li><strong>Input Tokens</strong> (10%) - Prompt bloat/cost</li>
                <li><strong>Token Efficiency</strong> (15%) - Output/Input ratio</li>
              </ul>
              <Text textStyle="small" style={{ lineHeight: 1.5, opacity: 0.8, marginTop: 4 }}>
                <strong>Scores:</strong> 0-39 Normal • 40-69 Warning • 70+ Critical
              </Text>
              <Text textStyle="small" style={{ lineHeight: 1.5, opacity: 0.6, marginTop: 4 }}>
                <strong>Baseline:</strong> Auto-compares last 7 days vs prior 7 days. Click "Capture Baseline" on any model to set current values as the new reference point.
              </Text>
            </Flex>
          </Surface>

          {/* Quick Actions */}
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <SettingIcon style={{ width: 14, height: 14 }} />
                <Text textStyle="small-emphasized">Quick Actions</Text>
              </Flex>
              <Button variant="default" style={{ width: '100%' }} onClick={refetch}>
                <RefreshIcon /> Recalculate All Baselines
              </Button>
              <Button 
                variant="default" 
                style={{ width: '100%' }} 
                disabled={filteredSummaries.length === 0}
                onClick={() => {
                  // Generate CSV export
                  const headers = ['Model', 'Provider', 'Type', 'Drift Score', 'Severity', 'Latency Δ%', 'Quality Δ%', 'Efficiency', 'Anomalies', 'Baseline Period'];
                  const rows = filteredSummaries.map(s => {
                    const latency = s.metrics.find(m => m.metricName === 'Average Latency');
                    const quality = s.metrics.find(m => m.metricName === 'Avg Output Tokens');
                    const efficiency = s.metrics.find(m => m.metricName === 'Token Efficiency');
                    return [
                      s.model,
                      s.provider,
                      s.operationType,
                      s.overallDriftScore,
                      s.severity,
                      latency?.changePercent.toFixed(1) || '0',
                      quality?.changePercent.toFixed(1) || '0',
                      efficiency?.currentValue.toFixed(3) || '0',
                      s.anomalies.length,
                      s.baselinePeriod
                    ].join(',');
                  });
                  const csv = [headers.join(','), ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `drift-report-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <DocumentIcon /> Export Drift Report
              </Button>
            </Flex>
          </Surface>
        </Flex>
      </div>

      {/* Model Anomalies List */}
      {anomalies.length > 0 && (
        <Surface padding={16} style={{ borderRadius: 8 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <WarningIcon style={{ width: 16, height: 16, color: STATUS_COLORS.warning }} />
              <Heading level={6}>Recent Drift Anomalies</Heading>
            </Flex>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {anomalies.slice(0, 6).map((anomaly, idx) => (
                <Surface 
                  key={idx} 
                  style={{ 
                    padding: 12, 
                    borderRadius: 6,
                    borderLeft: `3px solid ${anomaly.severity === 'critical' ? STATUS_COLORS.critical : STATUS_COLORS.warning}`
                  }}
                >
                  <Flex flexDirection="column" gap={6}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Flex alignItems="center" gap={6}>
                        {anomaly.severity === 'critical' 
                          ? <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.critical }} />
                          : <WarningIcon style={{ width: 14, height: 14, color: STATUS_COLORS.warning }} />
                        }
                        <Text textStyle="small-emphasized">{anomaly.title}</Text>
                      </Flex>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: anomaly.type === 'latency_spike' ? '#e74c3c20' : 
                                         anomaly.type === 'quality_drop' ? '#f39c1220' : '#9b59b620',
                        color: 'var(--dt-colors-text-primary-default)',
                        fontSize: 10,
                        textTransform: 'uppercase'
                      }}>
                        {anomaly.type.replace('_', ' ')}
                      </span>
                    </Flex>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>{anomaly.model} • {anomaly.provider}</Text>
                    <Text textStyle="small" style={{ opacity: 0.8 }}>{anomaly.description}</Text>
                  </Flex>
                </Surface>
              ))}
            </div>
          </Flex>
        </Surface>
      )}

      {/* Detail Modal */}
      {selectedModel && (
        <DriftDetailModal 
          summary={selectedModel} 
          onClose={() => setSelectedModel(null)}
          onCaptureBaseline={captureBaseline}
          onClearBaseline={clearBaseline}
        />
      )}
    </Flex>
  );
};
