// AI Quality Dashboard
// Industry-standard quality scoring (NIST AI RMF, DORA/SRE, Apdex, FinOps),
// paginated DataTable, scoring methodology modal, and Davis AI analysis

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Modal } from '@dynatrace/strato-components/overlays';
import { DataTable } from '@dynatrace/strato-components/tables';
import { WarningIcon, CriticalIcon, CheckmarkIcon, HelpIcon, AiIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  useAIQualityScoring, useDavisForecasting,
  AIQualityScore, ForecastResult,
  SCORING_WEIGHTS, SCORING_STANDARDS,
} from '../hooks/useAIQuality';
import { DavisResponse } from '../components/DavisResponse';
import { formatNumber } from '../utils/formatting';

// ============================================
// Quality Score Ring Component
// ============================================

const QualityScoreRing: React.FC<{
  score: number;
  size?: number;
  label?: string;
}> = ({ score, size = 120, label }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  
  const getColor = (s: number) => {
    if (s >= 80) return 'var(--dt-colors-charts-status-good-default)';
    if (s >= 60) return 'var(--dt-colors-charts-status-warning-default)';
    return 'var(--dt-colors-charts-status-critical-default)';
  };

  return (
    <Flex style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--dt-colors-border-neutral-default)"
          strokeWidth={8}
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <Flex style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
      }}>
        <Flex style={{ fontSize: size / 3, fontWeight: 700, color: getColor(score) }}>
          {score}
        </Flex>
        {label && (
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
            {label}
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};

// ============================================
// Dimension Bar Component
// ============================================

const DimensionBar: React.FC<{
  label: string;
  value: number;
  icon?: string;
}> = ({ label, value }) => {
  const getColor = (v: number) => {
    if (v >= 80) return Colors.Charts.Apdex.Excellent.Default;
    if (v >= 60) return Colors.Charts.Apdex.Good.Default;
    if (v >= 40) return Colors.Charts.Apdex.Fair.Default;
    return Colors.Charts.Apdex.Poor.Default;
  };

  return (
    <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text textStyle="small">{label}</Text>
        <Text textStyle="small" style={{ fontWeight: 600 }}>{value}%</Text>
      </Flex>
      <Flex style={{
        height: 8,
        borderRadius: 4,
        background: 'var(--dt-colors-border-neutral-default)',
        overflow: 'hidden'
      }}>
        <Flex style={{
          height: '100%',
          width: `${value}%`,
          background: getColor(value),
          borderRadius: 4,
          transition: 'width 0.3s ease-in-out'
        }} />
      </Flex>
    </Flex>
  );
};

// ============================================
// Forecast Chart Component
// ============================================

const ForecastChart: React.FC<{
  forecast: ForecastResult;
  budget?: number;
}> = ({ forecast, budget }) => {
  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = forecast.forecasts;
  if (points.length === 0) return null;

  // Calculate scales
  const maxValue = Math.max(...points.map(p => p.upperBound), budget || 0) * 1.1;
  const minValue = 0;

  const xScale = (idx: number) => padding.left + (idx / (points.length - 1)) * chartWidth;
  const yScale = (val: number) => padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;

  // Create path strings
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.value)}`).join(' ');
  const areaPath = `
    M ${xScale(0)} ${yScale(points[0].lowerBound)}
    ${points.map((p, i) => `L ${xScale(i)} ${yScale(p.lowerBound)}`).join(' ')}
    ${points.slice().reverse().map((p, i) => `L ${xScale(points.length - 1 - i)} ${yScale(p.upperBound)}`).join(' ')}
    Z
  `;

  const getTrendIcon = () => {
    if (forecast.trend === 'increasing') return <Text style={{ color: 'var(--dt-colors-feedback-success-default)' }}>↑</Text>;
    if (forecast.trend === 'decreasing') return <Text style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>↓</Text>;
    return <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>→</Text>;
  };

  return (
    <Surface style={{ padding: 16 }}>
      <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
        <Flex alignItems="center" gap={8}>
          <Heading level={6}>
            {forecast.metric.charAt(0).toUpperCase() + forecast.metric.slice(1)} Forecast
          </Heading>
          <Text>{getTrendIcon()}</Text>
          {forecast.anomalyDetected && (
            <Text style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(244, 67, 54, 0.2)',
              color: 'var(--dt-colors-charts-status-critical-default)',
              fontSize: 10
            }}>
              ANOMALY
            </Text>
          )}
        </Flex>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          Confidence: {(forecast.confidence * 100).toFixed(0)}%
        </Text>
      </Flex>

      <svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight * (1 - pct)}
              x2={width - padding.right}
              y2={padding.top + chartHeight * (1 - pct)}
              stroke="var(--dt-colors-border-neutral-default)"
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <text
              x={padding.left - 8}
              y={padding.top + chartHeight * (1 - pct) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--dt-colors-text-secondary-default)"
            >
              {(maxValue * pct).toFixed(0)}
            </text>
          </g>
        ))}

        {/* Confidence interval area */}
        <path
          d={areaPath}
          fill="rgba(33, 150, 243, 0.2)"
        />

        {/* Forecast line */}
        <path
          d={linePath}
          fill="none"
          stroke='var(--dt-colors-charts-categorical-color-01-default)'
          strokeWidth={2}
        />

        {/* Budget line if provided */}
        {budget && (
          <g>
            <line
              x1={padding.left}
              y1={yScale(budget)}
              x2={width - padding.right}
              y2={yScale(budget)}
              stroke='var(--dt-colors-charts-status-critical-default)'
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <text
              x={width - padding.right}
              y={yScale(budget) - 5}
              textAnchor="end"
              fontSize={10}
              fill='var(--dt-colors-charts-status-critical-default)'
            >
              Budget: ${budget}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 5}
          fontSize={10}
          fill="var(--dt-colors-text-secondary-default)"
        >
          Now
        </text>
        <text
          x={width - padding.right}
          y={height - 5}
          textAnchor="end"
          fontSize={10}
          fill="var(--dt-colors-text-secondary-default)"
        >
          +7 days
        </text>
      </svg>

      {forecast.budgetBreachDay && (
        <Flex 
          alignItems="center" 
          gap={8} 
          padding={8}
          style={{ 
            background: 'rgba(244, 67, 54, 0.1)', 
            borderRadius: 4, 
            marginTop: 8 
          }}
        >
          <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />
          <Text textStyle="small" style={{ color: Colors.Text.Critical.Default }}>
            Budget breach predicted in <strong>{forecast.budgetBreachDay} days</strong>
          </Text>
        </Flex>
      )}
    </Surface>
  );
};

// ============================================
// Scoring Methodology Modal
// ============================================

const ScoringMethodologyModal: React.FC<{
  show: boolean;
  onDismiss: () => void;
}> = ({ show, onDismiss }) => {
  const dimensionKeys = Object.keys(SCORING_STANDARDS) as (keyof typeof SCORING_STANDARDS)[];

  return (
    <Modal title="AI Quality Scoring Methodology" show={show} onDismiss={onDismiss} size="large">
      <Flex flexDirection="column" gap={20} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        {/* Overview */}
        <Surface style={{ padding: 16, background: 'var(--dt-colors-background-container-neutral-subdued)' }}>
          <Heading level={6} style={{ marginBottom: 8 }}>Overview</Heading>
          <Text textStyle="small">
            The AI Quality Score is a composite metric derived from industry-recognised frameworks.
            Each service+model combination is scored 0–100 across five dimensions, then combined using
            the weights below to produce an overall grade (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F &lt; 60).
            All scores are computed from real-time OpenTelemetry gen_ai.* span telemetry — no synthetic benchmarks.
          </Text>
        </Surface>

        {/* Weights Summary */}
        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 12 }}>Dimension Weights</Heading>
          <Flex flexDirection="column" gap={8}>
            {dimensionKeys.map((key) => {
              const weight = SCORING_WEIGHTS[key as keyof typeof SCORING_WEIGHTS];
              const info = SCORING_STANDARDS[key];
              return (
                <Flex key={key} justifyContent="space-between" alignItems="center">
                  <Text style={{ fontWeight: 600 }}>{info.name}</Text>
                  <Flex alignItems="center" gap={8}>
                    <Flex style={{
                      width: 120, height: 8, borderRadius: 4,
                      background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden'
                    }}>
                      <Flex style={{
                        height: '100%', width: `${weight * 100}%`, borderRadius: 4,
                        background: 'var(--dt-colors-charts-categorical-default-09)',
                      }} />
                    </Flex>
                    <Text textStyle="small" style={{ fontWeight: 600, minWidth: 40 }}>{(weight * 100).toFixed(0)}%</Text>
                  </Flex>
                </Flex>
              );
            })}
          </Flex>
        </Surface>

        {/* Dimension Details */}
        {dimensionKeys.map((key) => {
          const info = SCORING_STANDARDS[key];
          return (
            <Surface key={key} style={{ padding: 16, borderLeft: '3px solid var(--dt-colors-charts-categorical-default-09)' }}>
              <Flex flexDirection="column" gap={6}>
                <Heading level={6}>{info.name}</Heading>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
                  Reference: {info.reference}
                </Text>
                <Text textStyle="small">{info.description}</Text>
              </Flex>
            </Surface>
          );
        })}

        {/* Grade Scale */}
        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 12 }}>Grade Scale</Heading>
          <Flex gap={12} style={{ flexWrap: 'wrap' }}>
            {[
              { grade: 'A', range: '90 – 100', color: 'var(--dt-colors-charts-status-good-default)' },
              { grade: 'B', range: '80 – 89', color: 'var(--dt-colors-charts-status-good-default)' },
              { grade: 'C', range: '70 – 79', color: 'var(--dt-colors-charts-status-warning-default)' },
              { grade: 'D', range: '60 – 69', color: 'var(--dt-colors-charts-status-critical-default)' },
              { grade: 'F', range: '< 60', color: 'var(--dt-colors-charts-status-critical-default)' },
            ].map(({ grade, range, color }) => (
              <Flex key={grade} alignItems="center" gap={8} style={{ minWidth: 120 }}>
                <Text style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 4, fontWeight: 700, fontSize: 14,
                  background: `${color}20`, color,
                }}>{grade}</Text>
                <Text textStyle="small">{range}</Text>
              </Flex>
            ))}
          </Flex>
        </Surface>
      </Flex>
    </Modal>
  );
};

// ============================================
// Davis AI Analysis Modal
// ============================================

const DavisAnalysisModal: React.FC<{
  show: boolean;
  onDismiss: () => void;
  service: AIQualityScore | null;
  analysisText: string;
  loading: boolean;
}> = ({ show, onDismiss, service, analysisText, loading }) => (
  <Modal
    title={`Dynatrace Intelligence Analysis: ${service?.serviceName || ''}`}
    show={show}
    onDismiss={onDismiss}
    size="large"
  >
    <Flex flexDirection="column" gap={16} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
      {service && (
        <Surface style={{ padding: 12, background: 'var(--dt-colors-background-container-neutral-subdued)' }}>
          <Flex gap={16} alignItems="center">
            <QualityScoreRing score={service.overallScore} size={64} label={service.grade} />
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontWeight: 600 }}>{service.model} • {service.provider}</Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {formatNumber(service.rawMetrics.requestCount)} requests |
                Error rate: {service.rawMetrics.errorRate.toFixed(2)}% |
                Avg latency: {service.rawMetrics.avgLatencyMs.toFixed(0)}ms
              </Text>
            </Flex>
          </Flex>
        </Surface>
      )}

      {loading ? (
        <Flex flexDirection="column" alignItems="center" padding={32} gap={12}>
          <ProgressCircle />
          <Text textStyle="small">Dynatrace Intelligence is analysing this service...</Text>
        </Flex>
      ) : (
        <Surface style={{ padding: 16 }}>
          <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
            <AiIcon style={{ width: 16, height: 16 }} />
            <Text style={{ fontWeight: 600 }}>Dynatrace Intelligence Analysis</Text>
          </Flex>
          {analysisText ? (
            <DavisResponse content={analysisText} />
          ) : (
            <Text>No analysis available.</Text>
          )}
        </Surface>
      )}
    </Flex>
  </Modal>
);

// ============================================
// Main Quality Dashboard Component
// ============================================

export const AIQualityDashboard: React.FC = () => {
  const { scores, loading, error, summary, analyzeQuality, analyzeScoreWithDavis } = useAIQualityScoring();
  const { forecasts, loading: forecastLoading, generateForecast } = useDavisForecasting();
  const [selectedService, setSelectedService] = useState<AIQualityScore | null>(null);
  const [budget, setBudget] = useState<number>(1000);
  const [showMethodology, setShowMethodology] = useState(false);
  const [davisModalOpen, setDavisModalOpen] = useState(false);
  const [davisAnalysis, setDavisAnalysis] = useState('');
  const [davisLoading, setDavisLoading] = useState(false);

  // Initial analysis
  useEffect(() => {
    analyzeQuality('24h');
  }, [analyzeQuality]);

  // Generate forecasts
  const handleGenerateForecasts = useCallback(async () => {
    await Promise.all([
      generateForecast('tokens', 7),
      generateForecast('cost', 7, budget),
      generateForecast('requests', 7)
    ]);
  }, [generateForecast, budget]);

  // Davis AI analysis for a specific service
  const handleDavisAnalysis = useCallback(async (service: AIQualityScore) => {
    setSelectedService(service);
    setDavisModalOpen(true);
    setDavisLoading(true);
    setDavisAnalysis('');
    try {
      const result = await analyzeScoreWithDavis(service);
      setDavisAnalysis(result);
    } finally {
      setDavisLoading(false);
    }
  }, [analyzeScoreWithDavis]);

  const tokenForecast = forecasts.find(f => f.metric === 'tokens');
  const costForecast = forecasts.find(f => f.metric === 'cost');
  const requestForecast = forecasts.find(f => f.metric === 'requests');

  // Grade badge renderer
  const GradeBadge: React.FC<{ grade: string; score: number }> = ({ grade, score }) => {
    const color = score >= 90 ? 'var(--dt-colors-charts-status-good-default)' : score >= 80 ? 'var(--dt-colors-charts-status-good-default)' : score >= 70 ? 'var(--dt-colors-charts-status-warning-default)' : score >= 60 ? 'var(--dt-colors-charts-status-critical-default)' : 'var(--dt-colors-charts-status-critical-default)';
    return (
      <Text style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 4, fontWeight: 700, fontSize: 14,
        background: `${color}20`, color,
      }}>{grade}</Text>
    );
  };

  // Dimension bar inline
  const DimBar: React.FC<{ value: number; width?: number }> = ({ value, width = 60 }) => {
    const color = value >= 80 ? 'var(--dt-colors-charts-status-good-default)' : value >= 60 ? 'var(--dt-colors-charts-status-warning-default)' : 'var(--dt-colors-charts-status-critical-default)';
    return (
      <Flex alignItems="center" gap={6}>
        <Flex style={{
          width, height: 6, borderRadius: 3,
          background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden'
        }}>
          <Flex style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3 }} />
        </Flex>
        <Text textStyle="small" style={{ fontWeight: 600, minWidth: 28, fontSize: 11 }}>{value}</Text>
      </Flex>
    );
  };

  // DataTable columns
  const columns = useMemo(() => [
    {
      header: 'Service',
      id: 'serviceName',
      accessor: 'serviceName',
      cell: ({ value, rowData }: { value: string; rowData: AIQualityScore }) => (
        <Flex flexDirection="column" gap={2}>
          <Text style={{ fontWeight: 600, fontSize: 12 }}>{String(value ?? '—')}</Text>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 11 }}>
            {rowData.model} • {rowData.provider}
          </Text>
        </Flex>
      ),
    },
    {
      header: 'Score',
      id: 'overallScore',
      accessor: 'overallScore',
      width: 80,
      cell: ({ value, rowData }: { value: number; rowData: AIQualityScore }) => (
        <Flex alignItems="center" gap={6}>
          <GradeBadge grade={rowData.grade} score={Number(value)} />
          <Text style={{ fontWeight: 700, fontSize: 13 }}>{String(value)}</Text>
        </Flex>
      ),
    },
    {
      header: 'Reliability',
      id: 'reliability',
      accessor: (row: AIQualityScore) => row.dimensions.reliability,
      width: 110,
      cell: ({ value }: any) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Latency',
      id: 'latencyPerformance',
      accessor: (row: AIQualityScore) => row.dimensions.latencyPerformance,
      width: 110,
      cell: ({ value }: any) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Completeness',
      id: 'outputCompleteness',
      accessor: (row: AIQualityScore) => row.dimensions.outputCompleteness,
      width: 110,
      cell: ({ value }: any) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Cost Eff.',
      id: 'costEfficiency',
      accessor: (row: AIQualityScore) => row.dimensions.costEfficiency,
      width: 100,
      cell: ({ value }: any) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Groundedness',
      id: 'groundedness',
      accessor: (row: AIQualityScore) => row.dimensions.groundedness,
      width: 110,
      cell: ({ value }: any) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Requests',
      id: 'requestCount',
      accessor: (row: AIQualityScore) => row.rawMetrics.requestCount,
      width: 90,
      cell: ({ value }: any) => <Text style={{ fontWeight: 600 }}>{formatNumber(Number(value))}</Text>,
    },
    {
      header: 'Flags',
      id: 'flags',
      accessor: (row: AIQualityScore) => row.flags.length,
      width: 80,
      cell: ({ rowData }: { rowData: AIQualityScore }) => {
        const flags = rowData.flags;
        if (flags.length === 0) return <CheckmarkIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-charts-status-good-default)' }} />;
        const hasCritical = flags.some(f => f.severity === 'critical');
        return (
          <Flex alignItems="center" gap={4}>
            {hasCritical
              ? <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-charts-status-critical-default)' }} />
              : <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-charts-status-warning-default)' }} />}
            <Text textStyle="small" style={{ fontWeight: 600 }}>{flags.length}</Text>
          </Flex>
        );
      },
    },
    {
      header: '',
      id: 'actions',
      accessor: 'serviceName',
      width: 100,
      cell: ({ rowData }: { rowData: AIQualityScore }) => (
        <Button
          variant="default"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDavisAnalysis(rowData); }}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <Flex alignItems="center" gap={4}>
            <AiIcon style={{ width: 12, height: 12 }} />
            Analyze
          </Flex>
        </Button>
      ),
    },
  ], [handleDavisAnalysis]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <CheckmarkIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Quality Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>Industry-standard scoring (NIST AI RMF, DORA/SRE, Apdex, FinOps)</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8}>
            <Button variant="default" onClick={() => setShowMethodology(true)} aria-label="View scoring methodology">
              <Flex alignItems="center" gap={4}>
                <HelpIcon style={{ width: 14, height: 14 }} />
                Scoring Logic
              </Flex>
            </Button>
            <Button variant="default" onClick={() => analyzeQuality('24h')} disabled={loading} aria-label="Refresh quality analysis">
              {loading ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
            <Button variant="emphasized" onClick={handleGenerateForecasts} disabled={forecastLoading} aria-label="Generate forecasts">
              {forecastLoading ? 'Forecasting...' : 'Generate Forecasts'}
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Summary Cards */}
      {summary && (
        <Flex gap={12}>
          <Surface style={{ flex: 1, padding: 16, textAlign: 'center' }}>
            <QualityScoreRing score={summary.averageScore} size={100} label="Overall" />
            <Text textStyle="small" style={{ marginTop: 8 }}>
              {summary.totalServices} services • {summary.totalModels} models
            </Text>
          </Surface>
          
          <Surface style={{ flex: 2, padding: 16 }}>
            <Heading level={6} style={{ marginBottom: 12 }}>Quality Flags</Heading>
            <Flex gap={16}>
              <Flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                <Flex style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Critical.Default }}>
                  {summary.criticalCount}
                </Flex>
                <Text textStyle="small">Critical</Text>
              </Flex>
              <Flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                <Flex style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Warning.Default }}>
                  {summary.warningCount}
                </Flex>
                <Text textStyle="small">Warning</Text>
              </Flex>
              <Flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                <Flex style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Success.Default }}>
                  {summary.totalModels - summary.criticalCount - summary.warningCount}
                </Flex>
                <Text textStyle="small">Healthy</Text>
              </Flex>
            </Flex>
          </Surface>

          <Surface style={{ flex: 2, padding: 16 }}>
            <Heading level={6} style={{ marginBottom: 12 }}>Provider Quality</Heading>
            <Flex flexDirection="column" gap={8}>
              {Object.entries(summary.byProvider || {}).slice(0, 4).map(([provider, data]) => (
                <Flex key={provider} justifyContent="space-between" alignItems="center">
                  <Text>{provider}</Text>
                  <Flex alignItems="center" gap={8}>
                    <ProgressBar 
                      value={data.avgScore} 
                      style={{ width: 80 }}
                    />
                    <Text textStyle="small" style={{ fontWeight: 600, minWidth: 35 }}>
                      {Math.round(data.avgScore)}%
                    </Text>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Loading State */}
      {loading && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <ProgressCircle size="large" />
          <Text style={{ marginTop: 16 }}>Analyzing AI service quality...</Text>
        </Surface>
      )}

      {/* Error State */}
      {error && (
        <Surface style={{ padding: 24, textAlign: 'center' }}>
          <Text style={{ color: Colors.Text.Critical.Default }}>Error: {error.message}</Text>
          <Button variant="default" onClick={() => analyzeQuality('24h')} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </Surface>
      )}

      {/* Service Quality — Paginated DataTable */}
      {!loading && scores.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
            <Flex alignItems="center" gap={8}>
              <Heading level={5}>Service Quality Scores</Heading>
              <Button
                variant="default"
                onClick={() => setShowMethodology(true)}
                style={{ fontSize: 11, padding: '2px 6px' }}
              >
                <HelpIcon style={{ width: 12, height: 12 }} /> How is this scored?
              </Button>
            </Flex>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Click "Analyze" for Dynatrace Intelligence insights on any service
            </Text>
          </Flex>
          <DataTable
            data={scores}
            columns={columns}
            sortable
            resizable
          >
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Surface>
      )}

      {/* Selected Service Details (inline expansion) */}
      {selectedService && !davisModalOpen && (
        <Surface style={{ padding: 16 }}>
          <Flex justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 16 }}>
            <Heading level={5}>
              {selectedService.serviceName} - Detailed Analysis
            </Heading>
            <Flex gap={8}>
              <Button variant="emphasized" onClick={() => handleDavisAnalysis(selectedService)}>
                <Flex alignItems="center" gap={4}>
                  <AiIcon style={{ width: 14, height: 14 }} />
                  Dynatrace Intelligence Analysis
                </Flex>
              </Button>
              <Button variant="default" onClick={() => setSelectedService(null)}>
                Close
              </Button>
            </Flex>
          </Flex>

          <Flex gap={24}>
            {/* Dimension Details */}
            <Flex flexDirection="column" gap={12} style={{ flex: 1 }}>
              <Text style={{ fontWeight: 600 }}>Quality Dimensions</Text>
              <DimensionBar label="Reliability (DORA/SRE)" value={selectedService.dimensions.reliability} />
              <DimensionBar label="Latency Perf. (Apdex)" value={selectedService.dimensions.latencyPerformance} />
              <DimensionBar label="Output Completeness (NIST)" value={selectedService.dimensions.outputCompleteness} />
              <DimensionBar label="Cost Efficiency (FinOps)" value={selectedService.dimensions.costEfficiency} />
              <DimensionBar label="Groundedness (NIST AI 100-1)" value={selectedService.dimensions.groundedness} />
            </Flex>

            {/* Flags */}
            <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
              <Text style={{ fontWeight: 600 }}>Quality Flags</Text>
              {selectedService.flags.length === 0 ? (
                <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>
                  No quality issues detected
                </Text>
              ) : (
                selectedService.flags.map((flag, idx) => (
                  <Surface key={idx} style={{ 
                    padding: 8, 
                    borderLeft: `3px solid ${flag.severity === 'critical' ? 'var(--dt-colors-charts-status-critical-default)' : 'var(--dt-colors-charts-status-warning-default)'}`
                  }}>
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        {flag.severity === 'critical' 
                          ? <CriticalIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-charts-status-critical-default)' }} />
                          : <WarningIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-charts-status-warning-default)' }} />}
                        <Text textStyle="small" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                          {flag.type.replace('_', ' ')}
                        </Text>
                      </Flex>
                      <Text textStyle="small">{flag.message}</Text>
                      {flag.evidence && (
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          {flag.evidence}
                        </Text>
                      )}
                    </Flex>
                  </Surface>
                ))
              )}
            </Flex>

            {/* Recommendations */}
            <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
              <Text style={{ fontWeight: 600 }}>Recommendations</Text>
              {selectedService.recommendations.map((rec, idx) => (
                <Flex key={idx} alignItems="flex-start" gap={8}>
                  <Text style={{ fontSize: 14 }}>&#x1F4A1;</Text>
                  <Text textStyle="small">{rec}</Text>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}

      {/* Forecasts Section */}
      {(tokenForecast || costForecast || requestForecast) && (
        <Flex flexDirection="column" gap={12}>
          <Heading level={5}>Dynatrace Intelligence Forecasts (7-day projection)</Heading>
          <Flex gap={12} style={{ flexWrap: 'wrap' }}>
            {tokenForecast && <ForecastChart forecast={tokenForecast} />}
            {costForecast && <ForecastChart forecast={costForecast} budget={budget} />}
            {requestForecast && <ForecastChart forecast={requestForecast} />}
          </Flex>
        </Flex>
      )}

      {/* No Data State */}
      {!loading && scores.length === 0 && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <WarningIcon style={{ width: 48, height: 48, color: 'var(--dt-colors-text-secondary-default)' }} />
          <Heading level={5} style={{ marginTop: 16 }}>No GenAI Services Found</Heading>
          <Text style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
            Ensure your AI services are instrumented with OpenTelemetry gen_ai.* semantic conventions.
          </Text>
        </Surface>
      )}

      {/* Scoring Methodology Modal */}
      <ScoringMethodologyModal show={showMethodology} onDismiss={() => setShowMethodology(false)} />

      {/* Davis AI Analysis Modal */}
      <DavisAnalysisModal
        show={davisModalOpen}
        onDismiss={() => { setDavisModalOpen(false); setDavisAnalysis(''); }}
        service={selectedService}
        analysisText={davisAnalysis}
        loading={davisLoading}
      />
    </Flex>
  );
};

export default AIQualityDashboard;
