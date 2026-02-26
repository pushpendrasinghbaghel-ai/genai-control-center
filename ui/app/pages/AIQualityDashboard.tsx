// AI Quality Dashboard
// Unique quality scoring, hallucination detection, and Davis AI-powered forecasting

import React, { useState, useEffect, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { WarningIcon, CriticalIcon, CheckmarkIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAIQualityScoring, useDavisForecasting, AIQualityScore, ForecastResult } from '../hooks/useAIQuality';

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
    if (s >= 80) return '#4CAF50';
    if (s >= 60) return '#ff9800';
    return '#f44336';
  };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
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
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: size / 3, fontWeight: 700, color: getColor(score) }}>
          {score}
        </div>
        {label && (
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
            {label}
          </div>
        )}
      </div>
    </div>
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
      <div style={{
        height: 8,
        borderRadius: 4,
        background: 'var(--dt-colors-border-neutral-default)',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: getColor(value),
          borderRadius: 4,
          transition: 'width 0.3s ease-in-out'
        }} />
      </div>
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
    if (forecast.trend === 'increasing') return <span style={{ color: 'var(--dt-colors-feedback-success-default)' }}>↑</span>;
    if (forecast.trend === 'decreasing') return <span style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>↓</span>;
    return <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>→</span>;
  };

  return (
    <Surface style={{ padding: 16 }}>
      <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
        <Flex alignItems="center" gap={8}>
          <Heading level={6}>
            {forecast.metric.charAt(0).toUpperCase() + forecast.metric.slice(1)} Forecast
          </Heading>
          <span>{getTrendIcon()}</span>
          {forecast.anomalyDetected && (
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(244, 67, 54, 0.2)',
              color: '#f44336',
              fontSize: 10
            }}>
              ANOMALY
            </span>
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
          stroke="#2196F3"
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
              stroke="#f44336"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <text
              x={width - padding.right}
              y={yScale(budget) - 5}
              textAnchor="end"
              fontSize={10}
              fill="#f44336"
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
// Main Quality Dashboard Component
// ============================================

export const AIQualityDashboard: React.FC = () => {
  const { scores, loading, error, summary, analyzeQuality } = useAIQualityScoring();
  const { forecasts, loading: forecastLoading, generateForecast } = useDavisForecasting();
  const [selectedService, setSelectedService] = useState<AIQualityScore | null>(null);
  const [budget, setBudget] = useState<number>(1000);

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

  const tokenForecast = forecasts.find(f => f.metric === 'tokens');
  const costForecast = forecasts.find(f => f.metric === 'cost');
  const requestForecast = forecasts.find(f => f.metric === 'requests');

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <CheckmarkIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Quality Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>Quality scoring & Dynatrace Intelligence Forecasting</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8}>
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
                <div style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Critical.Default }}>
                  {summary.criticalCount}
                </div>
                <Text textStyle="small">Critical</Text>
              </Flex>
              <Flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Warning.Default }}>
                  {summary.warningCount}
                </div>
                <Text textStyle="small">Warning</Text>
              </Flex>
              <Flex flexDirection="column" alignItems="center" style={{ flex: 1 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: Colors.Text.Success.Default }}>
                  {summary.totalServices - summary.criticalCount - summary.warningCount}
                </div>
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

      {/* Service Quality Cards */}
      {!loading && scores.length > 0 && (
        <Flex flexDirection="column" gap={12}>
          <Heading level={5}>Service Quality Scores</Heading>
          <Flex gap={12} style={{ flexWrap: 'wrap' }}>
            {scores.map((service) => (
              <Surface 
                key={service.serviceId} 
                style={{ 
                  width: 'calc(50% - 6px)', 
                  padding: 16,
                  cursor: 'pointer',
                  border: selectedService?.serviceId === service.serviceId 
                    ? '2px solid var(--dt-colors-border-primary-default)' 
                    : '1px solid transparent'
                }}
                onClick={() => setSelectedService(service)}
              >
                <Flex gap={16}>
                  <QualityScoreRing score={service.overallScore} size={80} />
                  
                  <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <div>
                        <Text style={{ fontWeight: 600 }}>{service.serviceName}</Text>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          {service.model} • {service.provider}
                        </Text>
                      </div>
                      {service.flags.length > 0 && (
                        <Flex gap={4}>
                          {service.flags.slice(0, 2).map((flag, idx) => (
                            <span 
                              key={idx}
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                background: flag.severity === 'critical' 
                                  ? 'rgba(244, 67, 54, 0.2)' 
                                  : 'rgba(255, 152, 0, 0.2)',
                                color: flag.severity === 'critical' ? '#f44336' : '#ff9800'
                              }}
                            >
                              {flag.type}
                            </span>
                          ))}
                        </Flex>
                      )}
                    </Flex>
                    
                    <Flex gap={12}>
                      <DimensionBar label="Response" value={service.dimensions.responseQuality} />
                      <DimensionBar label="Latency" value={service.dimensions.latencyConsistency} />
                      <DimensionBar label="Reliability" value={service.dimensions.errorResilience} />
                    </Flex>
                  </Flex>
                </Flex>
              </Surface>
            ))}
          </Flex>
        </Flex>
      )}

      {/* Selected Service Details */}
      {selectedService && (
        <Surface style={{ padding: 16 }}>
          <Flex justifyContent="space-between" alignItems="flex-start" style={{ marginBottom: 16 }}>
            <Heading level={5}>
              {selectedService.serviceName} - Detailed Analysis
            </Heading>
            <Button variant="default" onClick={() => setSelectedService(null)}>
              Close
            </Button>
          </Flex>

          <Flex gap={24}>
            {/* Dimension Details */}
            <Flex flexDirection="column" gap={12} style={{ flex: 1 }}>
              <Text style={{ fontWeight: 600 }}>Quality Dimensions</Text>
              <DimensionBar label="Response Quality" value={selectedService.dimensions.responseQuality} />
              <DimensionBar label="Latency Consistency" value={selectedService.dimensions.latencyConsistency} />
              <DimensionBar label="Reliability (0% errors)" value={selectedService.dimensions.errorResilience} />
              <DimensionBar label="Cost Efficiency" value={selectedService.dimensions.costEfficiency} />
              <DimensionBar label="Hallucination Risk" value={selectedService.dimensions.hallucationRisk} />
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
                    borderLeft: `3px solid ${flag.severity === 'critical' ? '#f44336' : '#ff9800'}`
                  }}>
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        {flag.severity === 'critical' 
                          ? <CriticalIcon style={{ width: 12, height: 12, color: '#f44336' }} />
                          : <WarningIcon style={{ width: 12, height: 12, color: '#ff9800' }} />}
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
                  <span>💡</span>
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
    </Flex>
  );
};

export default AIQualityDashboard;
