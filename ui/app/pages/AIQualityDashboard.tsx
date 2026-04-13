// AI Quality Dashboard
// Industry-standard quality scoring (NIST AI RMF, DORA/SRE, Apdex, FinOps)
// Redesigned with 4-tab structure: Quality Alerts | Score Explorer | Instruction Quality | Forecasts

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Modal } from '@dynatrace/strato-components/overlays';
import { DataTable } from '@dynatrace/strato-components/tables';
import { Tab, Tabs } from '@dynatrace/strato-components/navigation';
import {
  WarningIcon, CriticalIcon, CheckmarkIcon, HelpIcon, AiIcon,
  IdeaIcon, LineChartIcon, CrosshairIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  useAIQualityScoring, useDavisForecasting,
  AIQualityScore, ForecastResult,
  SCORING_WEIGHTS, SCORING_STANDARDS,
} from '../hooks/useAIQuality';
import { useInstructionQuality, type InstructionQualityMetric } from '../hooks/useInstructionQuality';
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--dt-colors-border-neutral-default)"
          strokeWidth={8}
        />
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
      <Flex flexDirection="column" alignItems="center" justifyContent="center" style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <Text style={{ fontSize: size / 3, fontWeight: 700, lineHeight: 1, color: getColor(score) }}>
          {score}
        </Text>
        {label && (
          <Text style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--dt-colors-text-secondary-default)' }}>
            {label}
          </Text>
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
        overflow: 'hidden',
      }}>
        <Flex style={{
          height: '100%',
          width: `${value}%`,
          background: getColor(value),
          borderRadius: 4,
          transition: 'width 0.3s ease-in-out',
        }} />
      </Flex>
    </Flex>
  );
};

// ============================================
// Forecast Chart Component (custom SVG - Strato has no confidence-band chart)
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

  const maxValue = Math.max(...points.map(p => p.upperBound), budget || 0) * 1.1;
  const minValue = 0;

  const xScale = (idx: number) => padding.left + (idx / (points.length - 1)) * chartWidth;
  const yScale = (val: number) => padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.value)}`).join(' ');
  const areaPath = `
    M ${xScale(0)} ${yScale(points[0].lowerBound)}
    ${points.map((p, i) => `L ${xScale(i)} ${yScale(p.lowerBound)}`).join(' ')}
    ${points.slice().reverse().map((p, i) => `L ${xScale(points.length - 1 - i)} ${yScale(p.upperBound)}`).join(' ')}
    Z
  `;

  const trendArrow = forecast.trend === 'increasing' ? 'up' : forecast.trend === 'decreasing' ? 'down' : 'stable';
  const trendColor = forecast.trend === 'increasing'
    ? 'var(--dt-colors-charts-status-critical-default)'
    : forecast.trend === 'decreasing'
      ? 'var(--dt-colors-charts-status-good-default)'
      : 'var(--dt-colors-text-secondary-default)';

  return (
    <Surface style={{ padding: 16, flex: '1 1 380px' }}>
      <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
        <Flex alignItems="center" gap={8}>
          <Heading level={6}>
            {forecast.metric.charAt(0).toUpperCase() + forecast.metric.slice(1)} Forecast
          </Heading>
          <Text style={{ color: trendColor, fontWeight: 700, fontSize: 12 }}>{trendArrow}</Text>
          {forecast.anomalyDetected && (
            <Text style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--dt-colors-background-container-critical-default)',
              color: 'var(--dt-colors-text-critical-default)',
              fontSize: 10,
              fontWeight: 700,
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

        <path
          d={areaPath}
          fill="var(--dt-colors-charts-categorical-color-01-default)"
          fillOpacity={0.15}
        />

        <path
          d={linePath}
          fill="none"
          stroke="var(--dt-colors-charts-categorical-color-01-default)"
          strokeWidth={2}
        />

        {budget && (
          <g>
            <line
              x1={padding.left}
              y1={yScale(budget)}
              x2={width - padding.right}
              y2={yScale(budget)}
              stroke="var(--dt-colors-charts-status-critical-default)"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <text
              x={width - padding.right}
              y={yScale(budget) - 5}
              textAnchor="end"
              fontSize={10}
              fill="var(--dt-colors-charts-status-critical-default)"
            >
              Budget: ${budget}
            </text>
          </g>
        )}

        <text x={padding.left} y={height - 5} fontSize={10} fill="var(--dt-colors-text-secondary-default)">
          Now
        </text>
        <text x={width - padding.right} y={height - 5} textAnchor="end" fontSize={10} fill="var(--dt-colors-text-secondary-default)">
          +7 days
        </text>
      </svg>

      {forecast.budgetBreachDay && (
        <Flex
          alignItems="center"
          gap={8}
          padding={8}
          style={{
            background: 'var(--dt-colors-background-container-critical-default)',
            borderRadius: 4,
            marginTop: 8,
          }}
        >
          <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-critical-default)' }} />
          <Text textStyle="small" style={{ color: 'var(--dt-colors-text-critical-default)' }}>
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
        <Surface style={{ padding: 16, background: 'var(--dt-colors-background-container-neutral-subdued)' }}>
          <Heading level={6} style={{ marginBottom: 8 }}>Overview</Heading>
          <Text textStyle="small">
            The AI Quality Score is a composite metric derived from industry-recognised frameworks.
            Each service+model combination is scored 0-100 across five dimensions, then combined using
            the weights below to produce an overall grade (A{'>='} 90, B{'>='} 80, C{'>='} 70, D{'>='} 60, F {'<'} 60).
            All scores are computed from real-time OpenTelemetry gen_ai.* span telemetry - no synthetic benchmarks.
          </Text>
        </Surface>

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
                      background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden',
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

        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 12 }}>Grade Scale</Heading>
          <Flex gap={12} style={{ flexWrap: 'wrap' }}>
            {[
              { grade: 'A', range: '90 - 100', color: 'var(--dt-colors-charts-status-good-default)' },
              { grade: 'B', range: '80 - 89', color: 'var(--dt-colors-charts-status-good-default)' },
              { grade: 'C', range: '70 - 79', color: 'var(--dt-colors-charts-status-warning-default)' },
              { grade: 'D', range: '60 - 69', color: 'var(--dt-colors-charts-status-critical-default)' },
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
              <Text style={{ fontWeight: 600 }}>{service.model} - {service.provider}</Text>
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
// Grade Badge helper
// ============================================

const GradeBadge: React.FC<{ grade: string; score: number }> = ({ grade, score }) => {
  const color = score >= 80
    ? 'var(--dt-colors-charts-status-good-default)'
    : score >= 70
      ? 'var(--dt-colors-charts-status-warning-default)'
      : 'var(--dt-colors-charts-status-critical-default)';
  return (
    <Text style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 4, fontWeight: 700, fontSize: 14,
      background: `${color}20`, color,
    }}>{grade}</Text>
  );
};

// ============================================
// Inline dim-bar helper
// ============================================

const DimBar: React.FC<{ value: number; width?: number }> = ({ value, width = 60 }) => {
  const color = value >= 80
    ? 'var(--dt-colors-charts-status-good-default)'
    : value >= 60
      ? 'var(--dt-colors-charts-status-warning-default)'
      : 'var(--dt-colors-charts-status-critical-default)';
  return (
    <Flex alignItems="center" gap={6}>
      <Flex style={{
        width, height: 6, borderRadius: 3,
        background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden',
      }}>
        <Flex style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3 }} />
      </Flex>
      <Text textStyle="small" style={{ fontWeight: 600, minWidth: 28, fontSize: 11 }}>{value}</Text>
    </Flex>
  );
};

// ============================================
// TAB 1: Quality Alerts
// ============================================

const QualityAlertsTab: React.FC<{
  scores: AIQualityScore[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onAnalyze: (s: AIQualityScore) => void;
  onShowMethodology: () => void;
}> = ({ scores, loading, error, onRetry, onAnalyze, onShowMethodology }) => {
  const alertServices = useMemo(
    () => scores.filter(s => s.overallScore < 70).sort((a, b) => a.overallScore - b.overallScore),
    [scores],
  );
  const healthyCount = scores.filter(s => s.overallScore >= 80).length;
  const warningCount = scores.filter(s => s.overallScore >= 70 && s.overallScore < 80).length;
  const criticalCount = scores.filter(s => s.overallScore < 70).length;

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={48} gap={12}>
        <ProgressCircle />
        <Text textStyle="small">Analyzing AI service quality...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Surface style={{ padding: 24, textAlign: 'center' }}>
        <Text style={{ color: Colors.Text.Critical.Default }}>Error: {error.message}</Text>
        <Button variant="default" onClick={onRetry} style={{ marginTop: 16 }}>Retry</Button>
      </Surface>
    );
  }

  if (scores.length === 0) {
    return (
      <Surface style={{ padding: 48, textAlign: 'center' }}>
        <WarningIcon style={{ width: 48, height: 48, color: 'var(--dt-colors-text-secondary-default)' }} />
        <Heading level={5} style={{ marginTop: 16 }}>No GenAI Services Found</Heading>
        <Text style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
          Ensure your AI services are instrumented with OpenTelemetry gen_ai.* semantic conventions.
        </Text>
      </Surface>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      <Flex gap={12} style={{ flexWrap: 'wrap' }}>
        <Surface style={{ flex: '1 1 140px', padding: '14px 20px', borderLeft: '4px solid var(--dt-colors-charts-status-critical-default)' }}>
          <Heading level={3} style={{ color: 'var(--dt-colors-charts-status-critical-default)' }}>{criticalCount}</Heading>
          <Text textStyle="small">Needs attention (D / F)</Text>
        </Surface>
        <Surface style={{ flex: '1 1 140px', padding: '14px 20px', borderLeft: '4px solid var(--dt-colors-charts-status-warning-default)' }}>
          <Heading level={3} style={{ color: 'var(--dt-colors-charts-status-warning-default)' }}>{warningCount}</Heading>
          <Text textStyle="small">Acceptable (C)</Text>
        </Surface>
        <Surface style={{ flex: '1 1 140px', padding: '14px 20px', borderLeft: '4px solid var(--dt-colors-charts-status-good-default)' }}>
          <Heading level={3} style={{ color: 'var(--dt-colors-charts-status-good-default)' }}>{healthyCount}</Heading>
          <Text textStyle="small">Healthy (A / B)</Text>
        </Surface>
        <Surface style={{ flex: '1 1 140px', padding: '14px 20px' }}>
          <Heading level={3}>{scores.length}</Heading>
          <Text textStyle="small">Total services monitored</Text>
        </Surface>
      </Flex>

      {alertServices.length === 0 && (
        <Surface style={{ padding: 40, textAlign: 'center' }}>
          <CheckmarkIcon style={{ width: 40, height: 40, color: 'var(--dt-colors-charts-status-good-default)' }} />
          <Heading level={5} style={{ marginTop: 12 }}>All AI services are healthy</Heading>
          <Text textStyle="small" style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
            Every service has a quality score of 70 or above. Check Score Explorer for the full breakdown.
          </Text>
        </Surface>
      )}

      {alertServices.length > 0 && (
        <Flex flexDirection="column" gap={8}>
          <Flex justifyContent="space-between" alignItems="center">
            <Heading level={6}>Services requiring action</Heading>
            <Button variant="default" onClick={onShowMethodology} style={{ fontSize: 11, padding: '2px 8px' }}>
              <Flex alignItems="center" gap={4}>
                <HelpIcon style={{ width: 12, height: 12 }} />
                How is this scored?
              </Flex>
            </Button>
          </Flex>

          {alertServices.map((s) => {
            const worstDim = Object.entries(s.dimensions).reduce((a, b) => b[1] < a[1] ? b : a);
            const dimLabel: Record<string, string> = {
              reliability: 'Reliability',
              latencyPerformance: 'Latency',
              outputCompleteness: 'Completeness',
              costEfficiency: 'Cost Efficiency',
              groundedness: 'Groundedness',
            };
            const criticalFlags = s.flags.filter(f => f.severity === 'critical');
            const warningFlags = s.flags.filter(f => f.severity === 'warning');

            return (
              <Surface key={s.serviceId || s.serviceName} style={{
                padding: 16,
                borderLeft: `4px solid ${s.overallScore < 60
                  ? 'var(--dt-colors-charts-status-critical-default)'
                  : 'var(--dt-colors-charts-status-warning-default)'
                }`,
              }}>
                <Flex justifyContent="space-between" alignItems="flex-start" gap={12}>
                  <Flex alignItems="center" gap={12} style={{ flex: 1 }}>
                    <GradeBadge grade={s.grade} score={s.overallScore} />
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        <Text style={{ fontWeight: 700 }}>{s.serviceName}</Text>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          {s.model} - {s.provider}
                        </Text>
                      </Flex>
                      <Flex gap={12} style={{ flexWrap: 'wrap' }}>
                        <Text textStyle="small">
                          Weakest: <strong>{dimLabel[worstDim[0]] ?? worstDim[0]}</strong> ({worstDim[1]})
                        </Text>
                        {criticalFlags.length > 0 && (
                          <Flex alignItems="center" gap={4}>
                            <CriticalIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-charts-status-critical-default)' }} />
                            <Text textStyle="small" style={{ color: 'var(--dt-colors-charts-status-critical-default)', fontWeight: 600 }}>
                              {criticalFlags.length} critical flag{criticalFlags.length > 1 ? 's' : ''}
                            </Text>
                          </Flex>
                        )}
                        {warningFlags.length > 0 && (
                          <Flex alignItems="center" gap={4}>
                            <WarningIcon style={{ width: 12, height: 12, color: 'var(--dt-colors-charts-status-warning-default)' }} />
                            <Text textStyle="small" style={{ color: 'var(--dt-colors-charts-status-warning-default)', fontWeight: 600 }}>
                              {warningFlags.length} warning{warningFlags.length > 1 ? 's' : ''}
                            </Text>
                          </Flex>
                        )}
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          {formatNumber(s.rawMetrics.requestCount)} requests - {s.rawMetrics.errorRate.toFixed(1)}% errors - {s.rawMetrics.avgLatencyMs.toFixed(0)}ms avg
                        </Text>
                      </Flex>
                      {criticalFlags[0] && (
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
                          "{criticalFlags[0].message}"
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                  <Button
                    variant="emphasized"
                    onClick={() => onAnalyze(s)}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Flex alignItems="center" gap={4}>
                      <AiIcon style={{ width: 14, height: 14 }} />
                      Analyze
                    </Flex>
                  </Button>
                </Flex>
              </Surface>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
};

// ============================================
// TAB 2: Score Explorer
// ============================================

const ScoreExplorerTab: React.FC<{
  scores: AIQualityScore[];
  loading: boolean;
  onAnalyze: (s: AIQualityScore) => void;
  onShowMethodology: () => void;
}> = ({ scores, loading, onAnalyze, onShowMethodology }) => {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const selectedService = activeRowId !== null ? scores[parseInt(activeRowId)] ?? null : null;

  const columns = useMemo(() => [
    {
      header: 'Service',
      id: 'serviceName',
      accessor: 'serviceName' as const,
      cell: ({ value, rowData }: { value: string; rowData: AIQualityScore }) => (
        <Flex flexDirection="column" gap={2}>
          <Text style={{ fontWeight: 600, fontSize: 12 }}>{String(value ?? '-')}</Text>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 11 }}>
            {rowData.model} - {rowData.provider}
          </Text>
        </Flex>
      ),
    },
    {
      header: 'Score',
      id: 'overallScore',
      accessor: 'overallScore' as const,
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
      cell: ({ value }: { value: number }) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Latency',
      id: 'latencyPerformance',
      accessor: (row: AIQualityScore) => row.dimensions.latencyPerformance,
      width: 110,
      cell: ({ value }: { value: number }) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Completeness',
      id: 'outputCompleteness',
      accessor: (row: AIQualityScore) => row.dimensions.outputCompleteness,
      width: 110,
      cell: ({ value }: { value: number }) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Cost Eff.',
      id: 'costEfficiency',
      accessor: (row: AIQualityScore) => row.dimensions.costEfficiency,
      width: 100,
      cell: ({ value }: { value: number }) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Groundedness',
      id: 'groundedness',
      accessor: (row: AIQualityScore) => row.dimensions.groundedness,
      width: 110,
      cell: ({ value }: { value: number }) => <DimBar value={Number(value)} />,
    },
    {
      header: 'Requests',
      id: 'requestCount',
      accessor: (row: AIQualityScore) => row.rawMetrics.requestCount,
      width: 90,
      cell: ({ value }: { value: number }) => <Text style={{ fontWeight: 600 }}>{formatNumber(Number(value))}</Text>,
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
      accessor: 'serviceName' as const,
      width: 100,
      cell: ({ rowData }: { rowData: AIQualityScore }) => (
        <Button
          variant="default"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onAnalyze(rowData); }}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          <Flex alignItems="center" gap={4}>
            <AiIcon style={{ width: 12, height: 12 }} />
            Analyze
          </Flex>
        </Button>
      ),
    },
  ], [onAnalyze]);

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={48} gap={12}>
        <ProgressCircle />
        <Text textStyle="small">Loading quality scores...</Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          {scores.length} service{scores.length !== 1 ? 's' : ''} scored across 5 industry frameworks. Click a row for details.
        </Text>
        <Button variant="default" onClick={onShowMethodology} style={{ fontSize: 11, padding: '4px 10px' }}>
          <Flex alignItems="center" gap={4}>
            <HelpIcon style={{ width: 12, height: 12 }} />
            Scoring Logic
          </Flex>
        </Button>
      </Flex>

      <Surface style={{ padding: 0 }}>
        <DataTable
          data={scores}
          columns={columns}
          sortable
          resizable
          interactiveRows={true}
          activeRow={activeRowId}
          onActiveRowChange={(id) => setActiveRowId(prev => prev === id ? null : id)}
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      </Surface>

      {selectedService && (
        <Surface style={{ padding: 16 }}>
          <Flex justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 16 }}>
            <Heading level={6}>{selectedService.serviceName} - Detailed View</Heading>
            <Flex gap={8}>
              <Button variant="emphasized" onClick={() => onAnalyze(selectedService)}>
                <Flex alignItems="center" gap={4}>
                  <AiIcon style={{ width: 14, height: 14 }} />
                  Davis Analysis
                </Flex>
              </Button>
              <Button variant="default" onClick={() => setActiveRowId(null)}>Close</Button>
            </Flex>
          </Flex>

          <Flex gap={24} style={{ flexWrap: 'wrap' }}>
            <Flex flexDirection="column" gap={12} style={{ flex: '1 1 200px' }}>
              <Text style={{ fontWeight: 600 }}>Quality Dimensions</Text>
              <DimensionBar label="Reliability (DORA/SRE)" value={selectedService.dimensions.reliability} />
              <DimensionBar label="Latency Perf. (Apdex)" value={selectedService.dimensions.latencyPerformance} />
              <DimensionBar label="Output Completeness (NIST)" value={selectedService.dimensions.outputCompleteness} />
              <DimensionBar label="Cost Efficiency (FinOps)" value={selectedService.dimensions.costEfficiency} />
              <DimensionBar label="Groundedness (NIST AI 100-1)" value={selectedService.dimensions.groundedness} />
            </Flex>

            <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px' }}>
              <Text style={{ fontWeight: 600 }}>Quality Flags</Text>
              {selectedService.flags.length === 0 ? (
                <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>No quality issues detected</Text>
              ) : (
                selectedService.flags.map((flag, idx) => (
                  <Surface key={idx} style={{
                    padding: 8,
                    borderLeft: `3px solid ${flag.severity === 'critical'
                      ? 'var(--dt-colors-charts-status-critical-default)'
                      : 'var(--dt-colors-charts-status-warning-default)'
                    }`,
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
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{flag.evidence}</Text>
                      )}
                    </Flex>
                  </Surface>
                ))
              )}
            </Flex>

            <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px' }}>
              <Text style={{ fontWeight: 600 }}>Recommendations</Text>
              {selectedService.recommendations.map((rec, idx) => (
                <Flex key={idx} alignItems="flex-start" gap={8}>
                  <IdeaIcon style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--dt-colors-charts-status-warning-default)', marginTop: 2 }} />
                  <Text textStyle="small">{rec}</Text>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

// ============================================
// TAB 3: Instruction Quality
// ============================================

const InstructionQualityTab: React.FC<{
  metrics: InstructionQualityMetric[];
  summary: ReturnType<typeof useInstructionQuality>['summary'];
  loading: boolean;
  onRefresh: () => void;
}> = ({ metrics, summary, loading, onRefresh }) => {
  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={48} gap={12}>
        <ProgressCircle />
        <Text textStyle="small">Analyzing instruction-following quality...</Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      <Surface style={{ padding: 16, background: 'var(--dt-colors-background-container-neutral-subdued)' }}>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex flexDirection="column" gap={4}>
            <Heading level={6}>Does your AI do what it's told?</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Computed from real production spans - no benchmark datasets or LLM judges required.
              Detects word-limit violations and thin responses via DQL.
            </Text>
          </Flex>
          <Button variant="default" onClick={onRefresh} disabled={loading}>
            {loading ? 'Analyzing...' : 'Refresh (7d)'}
          </Button>
        </Flex>
      </Surface>

      {summary && (
        <Flex gap={12} style={{ flexWrap: 'wrap' }}>
          <Surface style={{ flex: '1 1 150px', padding: '14px 20px' }}>
            <Text textStyle="small" style={{ opacity: 0.7, marginBottom: 4 }}>Models Tested</Text>
            <Heading level={4}>{summary.modelsWithConstraintData} / {summary.totalModels}</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>have word-limit data</Text>
          </Surface>

          <Surface style={{ flex: '1 1 150px', padding: '14px 20px' }}>
            <Text textStyle="small" style={{ opacity: 0.7, marginBottom: 4 }}>Avg Compliance</Text>
            <Heading level={4} style={{
              color: summary.overallComplianceRate >= 70
                ? 'var(--dt-colors-charts-status-good-default)'
                : summary.overallComplianceRate >= 40
                  ? 'var(--dt-colors-charts-status-warning-default)'
                  : 'var(--dt-colors-charts-status-critical-default)',
            }}>
              {summary.overallComplianceRate}%
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>follow word limits</Text>
          </Surface>

          <Surface style={{ flex: '1 1 150px', padding: '14px 20px' }}>
            <Text textStyle="small" style={{ opacity: 0.7, marginBottom: 4 }}>Thin Response Rate</Text>
            <Heading level={4} style={{
              color: summary.overallThinRate < 5
                ? 'var(--dt-colors-charts-status-good-default)'
                : summary.overallThinRate < 15
                  ? 'var(--dt-colors-charts-status-warning-default)'
                  : 'var(--dt-colors-charts-status-critical-default)',
            }}>
              {summary.overallThinRate}%
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>less than 20 output tokens (avg)</Text>
          </Surface>

          {summary.bestCompliantModel && (
            <Surface style={{ flex: '1 1 150px', padding: '14px 20px', borderLeft: '3px solid var(--dt-colors-charts-status-good-default)' }}>
              <Text textStyle="small" style={{ opacity: 0.7, marginBottom: 4 }}>Best Model</Text>
              <Text style={{ fontWeight: 700, fontSize: 13 }}>{summary.bestCompliantModel}</Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>highest compliance</Text>
            </Surface>
          )}

          {summary.worstCompliantModel && (
            <Surface style={{ flex: '1 1 150px', padding: '14px 20px', borderLeft: '3px solid var(--dt-colors-charts-status-critical-default)' }}>
              <Text textStyle="small" style={{ opacity: 0.7, marginBottom: 4 }}>Worst Model</Text>
              <Text style={{ fontWeight: 700, fontSize: 13 }}>{summary.worstCompliantModel}</Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>most violations</Text>
            </Surface>
          )}
        </Flex>
      )}

      {metrics.filter(m => m.hasConstraintData).length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 16 }}>Constraint Compliance Leaderboard</Heading>
          <Flex flexDirection="column" gap={12}>
            {metrics
              .filter(m => m.hasConstraintData)
              .sort((a, b) => b.complianceRate - a.complianceRate)
              .map((m: InstructionQualityMetric) => {
                const compColor = m.complianceRate >= 70
                  ? 'var(--dt-colors-charts-status-good-default)'
                  : m.complianceRate >= 40
                    ? 'var(--dt-colors-charts-status-warning-default)'
                    : 'var(--dt-colors-charts-status-critical-default)';
                return (
                  <Flex key={m.model} alignItems="center" gap={12}>
                    <Text style={{ minWidth: 200, fontWeight: 600, fontSize: 12 }}>{m.model}</Text>
                    <Flex style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden' }}>
                      <Flex style={{ height: '100%', width: `${m.complianceRate}%`, background: compColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </Flex>
                    <Text style={{ minWidth: 44, fontWeight: 700, fontSize: 12, color: compColor, textAlign: 'right' }}>
                      {m.complianceRate}%
                    </Text>
                    {m.violationRate > 70 && (
                      <Flex style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: 'var(--dt-colors-background-container-critical-default)',
                        color: 'var(--dt-colors-text-critical-default)',
                        whiteSpace: 'nowrap',
                      }}>
                        {m.violationRate}% ignore limit
                      </Flex>
                    )}
                    <Text textStyle="small" style={{ minWidth: 90, color: Colors.Text.Neutral.Subdued, textAlign: 'right' }}>
                      avg {m.avgWordCount} words
                    </Text>
                  </Flex>
                );
              })
            }
          </Flex>
        </Surface>
      )}

      {metrics.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 16 }}>Thin Response Rate - All Models</Heading>
          <Flex flexDirection="column" gap={8}>
            {metrics
              .sort((a, b) => b.thinResponseRate - a.thinResponseRate)
              .map((m: InstructionQualityMetric) => {
                const thinColor = m.thinResponseRate < 5
                  ? 'var(--dt-colors-charts-status-good-default)'
                  : m.thinResponseRate < 15
                    ? 'var(--dt-colors-charts-status-warning-default)'
                    : 'var(--dt-colors-charts-status-critical-default)';
                return (
                  <Flex key={m.model} alignItems="center" gap={12}>
                    <Text style={{ minWidth: 200, fontSize: 12 }}>{m.model}</Text>
                    <Flex style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--dt-colors-border-neutral-default)', overflow: 'hidden' }}>
                      <Flex style={{ height: '100%', width: `${Math.min(m.thinResponseRate, 100)}%`, background: thinColor, borderRadius: 3 }} />
                    </Flex>
                    <Text style={{ minWidth: 44, fontSize: 12, fontWeight: 600, color: thinColor, textAlign: 'right' }}>
                      {m.thinResponseRate.toFixed(1)}%
                    </Text>
                    <Text textStyle="small" style={{ minWidth: 80, color: Colors.Text.Neutral.Subdued, textAlign: 'right' }}>
                      {formatNumber(m.totalRequests)} reqs
                    </Text>
                  </Flex>
                );
              })
            }
          </Flex>
        </Surface>
      )}

      {!summary && !loading && (
        <Surface style={{ padding: 32, textAlign: 'center' }}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>
            No instruction quality data found. Ensure spans include gen_ai.completion.0.content and word-limit prompts.
          </Text>
        </Surface>
      )}

      <Surface style={{ padding: '8px 12px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          Source: real gen_ai.* production spans via DQL. Constraint detection: prompts containing "words" keyword. Thin response: less than 20 output tokens.
        </Text>
      </Surface>
    </Flex>
  );
};

// ============================================
// TAB 4: Forecasts - auto-load on mount
// ============================================

const ForecastsTab: React.FC<{
  forecasts: ForecastResult[];
  loading: boolean;
  budget: number;
  onGenerate: () => void;
}> = ({ forecasts, loading, budget, onGenerate }) => {
  useEffect(() => {
    if (forecasts.length === 0 && !loading) {
      onGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tokenForecast = forecasts.find(f => f.metric === 'tokens');
  const costForecast = forecasts.find(f => f.metric === 'cost');
  const requestForecast = forecasts.find(f => f.metric === 'requests');

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={48} gap={12}>
        <ProgressCircle />
        <Text textStyle="small">Generating 7-day forecasts with Dynatrace Intelligence...</Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} style={{ paddingTop: 16 }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={6}>7-Day AI Usage Forecasts</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Powered by Dynatrace Davis AI - confidence intervals and anomaly detection included.
          </Text>
        </Flex>
        <Button variant="default" onClick={onGenerate} disabled={loading}>
          Regenerate Forecasts
        </Button>
      </Flex>

      {forecasts.length === 0 && !loading && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <LineChartIcon style={{ width: 40, height: 40, color: 'var(--dt-colors-text-secondary-default)' }} />
          <Heading level={6} style={{ marginTop: 12 }}>No forecast data yet</Heading>
          <Text textStyle="small" style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
            Forecasts are being generated automatically. This may take a few seconds.
          </Text>
        </Surface>
      )}

      <Flex gap={16} style={{ flexWrap: 'wrap' }}>
        {tokenForecast && <ForecastChart forecast={tokenForecast} />}
        {costForecast && <ForecastChart forecast={costForecast} budget={budget} />}
        {requestForecast && <ForecastChart forecast={requestForecast} />}
      </Flex>
    </Flex>
  );
};

// ============================================
// Main Quality Dashboard Component
// ============================================

export const AIQualityDashboard: React.FC = () => {
  const { scores, loading, error, summary, analyzeQuality, analyzeScoreWithDavis } = useAIQualityScoring();
  const { forecasts, loading: forecastLoading, generateForecast } = useDavisForecasting();
  const { metrics: iqMetrics, summary: iqSummary, loading: iqLoading, analyze: analyzeIQ } = useInstructionQuality();
  const [budget] = useState<number>(1000);
  const [showMethodology, setShowMethodology] = useState(false);
  const [davisModalOpen, setDavisModalOpen] = useState(false);
  const [davisAnalysis, setDavisAnalysis] = useState('');
  const [davisLoading, setDavisLoading] = useState(false);
  const [davisService, setDavisService] = useState<AIQualityScore | null>(null);

  useEffect(() => {
    analyzeQuality('24h');
    analyzeIQ('7d');
  }, [analyzeQuality, analyzeIQ]);

  const handleGenerateForecasts = useCallback(async () => {
    await Promise.all([
      generateForecast('tokens', 7),
      generateForecast('cost', 7, budget),
      generateForecast('requests', 7),
    ]);
  }, [generateForecast, budget]);

  const handleDavisAnalysis = useCallback(async (service: AIQualityScore) => {
    setDavisService(service);
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

  const summaryLine = summary
    ? `${summary.totalServices ?? scores.length} services - avg score ${summary.averageScore ?? '-'} - ${scores.filter(s => s.overallScore < 70).length} need attention`
    : 'NIST AI RMF - DORA/SRE - Apdex - FinOps';

  return (
    <Flex flexDirection="column" gap={0} padding={16}>
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <CrosshairIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Quality Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>{summaryLine}</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button
            variant="default"
            onClick={() => { analyzeQuality('24h'); analyzeIQ('7d'); }}
            disabled={loading || iqLoading}
            aria-label="Refresh quality analysis"
          >
            {loading ? 'Analyzing...' : 'Refresh'}
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      <Tabs defaultIndex={0}>

        <Tab title="Quality Alerts" prefixIcon={<CriticalIcon />}>
          <QualityAlertsTab
            scores={scores}
            loading={loading}
            error={error}
            onRetry={() => analyzeQuality('24h')}
            onAnalyze={handleDavisAnalysis}
            onShowMethodology={() => setShowMethodology(true)}
          />
        </Tab>

        <Tab title="Score Explorer" prefixIcon={<CheckmarkIcon />}>
          <ScoreExplorerTab
            scores={scores}
            loading={loading}
            onAnalyze={handleDavisAnalysis}
            onShowMethodology={() => setShowMethodology(true)}
          />
        </Tab>

        <Tab title="Instruction Quality" prefixIcon={<AiIcon />}>
          <InstructionQualityTab
            metrics={iqMetrics}
            summary={iqSummary}
            loading={iqLoading}
            onRefresh={() => analyzeIQ('7d')}
          />
        </Tab>

        <Tab title="Forecasts" prefixIcon={<LineChartIcon />}>
          <ForecastsTab
            forecasts={forecasts}
            loading={forecastLoading}
            budget={budget}
            onGenerate={handleGenerateForecasts}
          />
        </Tab>

      </Tabs>

      <ScoringMethodologyModal show={showMethodology} onDismiss={() => setShowMethodology(false)} />

      <DavisAnalysisModal
        show={davisModalOpen}
        onDismiss={() => { setDavisModalOpen(false); setDavisAnalysis(''); }}
        service={davisService}
        analysisText={davisAnalysis}
        loading={davisLoading}
      />
    </Flex>
  );
};

export default AIQualityDashboard;
