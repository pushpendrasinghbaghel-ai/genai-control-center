// Response Analytics Dashboard
// For ML Engineers & Developers: Token efficiency, output consistency, model comparison
// Based on real observable metrics from OpenTelemetry gen_ai.* spans

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { RefreshIcon, BarChartIcon, ServicesIcon, WarningIcon, CheckmarkIcon, HelpIcon, ArrowUpRightIcon, ArrowDownRightIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { TimeseriesChart } from '@dynatrace/strato-components-preview/charts';
import type { Timeseries } from '@dynatrace/strato-components-preview/charts';

import { 
  useResponseAnalytics, 
  useResponseQualityTrends,
  TokenEfficiencyMetrics, 
  ModelComparison,
  QualityTrendDataPoint,
  QualityAnomaly
} from '../hooks/useResponseAnalytics';

// Status colors from Strato design tokens
const STATUS_COLORS = {
  excellent: Colors.Charts.Apdex.Excellent.Default,
  fair: Colors.Charts.Apdex.Fair.Default,
  poor: Colors.Charts.Apdex.Poor.Default,
};

// Metric explanations for tooltips
const METRIC_TOOLTIPS = {
  tokenRatio: "Output tokens divided by input tokens. Higher ratio means the model generates more output per input token. Low ratio (<0.5x) with high input may indicate inefficient prompts.",
  inefficient: "Services with Token Ratio < 0.5x and >100 input tokens. These may benefit from prompt optimization, compression, or semantic caching.",
  inconsistent: "Services with high output variance (>10,000) or >20% of responses with <10 output tokens. This indicates unpredictable model behavior.",
  efficiencyScore: "Composite score (0-100) based on: Token Ratio (40%), Response Latency (30%), and Cost Efficiency (30%). Higher is better.",
  variance: "Statistical measure of how spread out the output token counts are. High variance means response lengths vary significantly.",
  lowOutputRate: "Percentage of requests that returned fewer than 10 output tokens. High rates may indicate failed or truncated responses.",
  // Quality Trends tooltips
  qualityHealthScore: "Composite score (0-100) measuring overall response quality. Calculated as: 100 - (Empty Rate × 2) - (Error Rate × 3) - (Truncated Rate × 0.5) - (Latency Penalty). Higher is better.",
  emptyResponseRate: "Percentage of responses with fewer than 5 output tokens. High rates may indicate model failures, incorrect prompts, or embedding-only operations.",
  errorRate: "Percentage of requests that returned errors (otel.status_code = ERROR). High rates indicate model or service reliability issues.",
  truncatedRate: "Percentage of responses with 5-20 output tokens. May indicate max_tokens limits, model cutoffs, or incomplete generations.",
  avgLatency: "Average response time across all GenAI requests. Latency > 5s contributes to quality score degradation.",
  trendDirection: "Compares first half vs second half of the timeframe. Improving = error rate decreased by >20%. Degrading = error rate increased by >20%.",
  qualityAnomaly: "Automated detection when a metric exceeds 2× its average value. Anomalies are flagged as Warning (5-20%) or Critical (>20%).",
};

// ============================================
// Efficiency Ring Component (SVG-based)
// ============================================
interface EfficiencyRingProps {
  value: number;
  maxValue: number;
  label: string;
  sublabel?: string;
  size?: number;
}

function EfficiencyRing({ value, maxValue, label, sublabel, size = 80 }: EfficiencyRingProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 70) return STATUS_COLORS.excellent;
    if (percentage >= 40) return STATUS_COLORS.fair;
    return STATUS_COLORS.poor;
  };

  return (
    <Flex flexDirection="column" alignItems="center" gap={4}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={size / 4}
          fontWeight="bold"
        >
          {typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 0) : value}
        </text>
      </svg>
      <Text textStyle="small-emphasized">{label}</Text>
      {sublabel && <Text textStyle="small" style={{ opacity: 0.7 }}>{sublabel}</Text>}
    </Flex>
  );
}

// ============================================
// Model Efficiency Card
// ============================================
interface ModelCardProps {
  model: ModelComparison;
  rank: number;
}

function ModelCard({ model, rank }: ModelCardProps) {
  return (
    <Surface style={{ padding: '16px', minWidth: '220px', flex: '1 1 220px' }}>
      <Flex flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={8}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: rank === 1 ? STATUS_COLORS.excellent : '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: rank === 1 ? 'white' : '#333',
            fontWeight: 'bold'
          }}>
            #{rank}
          </div>
          <Flex flexDirection="column">
            <Text textStyle="base-emphasized">{model.model}</Text>
            <Text textStyle="small" style={{ opacity: 0.7 }}>{model.provider}</Text>
          </Flex>
        </Flex>

        <Tooltip text={METRIC_TOOLTIPS.efficiencyScore}>
          <div>
            <EfficiencyRing
              value={model.efficiencyScore}
              maxValue={100}
              label="Efficiency Score"
              sublabel={`${model.totalRequests.toLocaleString()} requests`}
              size={80}
            />
          </div>
        </Tooltip>

        <Flex flexDirection="column" gap={8}>
          <Flex justifyContent="space-between">
            <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
              <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                <Text textStyle="small">Token Ratio</Text>
                <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
              </Flex>
            </Tooltip>
            <Text textStyle="small-emphasized">{model.avgTokenRatio.toFixed(2)}x</Text>
          </Flex>
          <Flex justifyContent="space-between">
            <Text textStyle="small">Avg Latency</Text>
            <Text textStyle="small-emphasized">{model.avgLatency.toFixed(0)}ms</Text>
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.7 }}>
            Est. ${model.estimatedCostPer1K.toFixed(2)}/1K requests
          </Text>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Service Row Component
// ============================================
interface ServiceRowProps {
  metric: TokenEfficiencyMetrics;
}

function ServiceRow({ metric }: ServiceRowProps) {
  return (
    <Surface style={{ padding: '12px', marginBottom: '8px' }}>
      <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
        <Flex flexDirection="column" gap={4} style={{ minWidth: '200px', flex: '1' }}>
          <Flex alignItems="center" gap={8}>
            <Text textStyle="base-emphasized">{metric.serviceName}</Text>
            {metric.inefficient && (
              <Tooltip text="Low token efficiency - high input, low output">
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: STATUS_COLORS.poor,
                  color: 'white',
                  fontSize: '10px'
                }}>
                  Inefficient
                </span>
              </Tooltip>
            )}
            {metric.inconsistent && (
              <Tooltip text="High output variance - inconsistent responses">
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: STATUS_COLORS.fair,
                  color: 'white',
                  fontSize: '10px'
                }}>
                  Inconsistent
                </span>
              </Tooltip>
            )}
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.7 }}>{metric.model} • {metric.provider}</Text>
        </Flex>

        <Flex gap={24} alignItems="center" flexWrap="wrap">
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Requests</Text>
            <Text textStyle="base-emphasized">{metric.requestCount.toLocaleString()}</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Token Ratio</Text>
            </Tooltip>
            <Text style={{ 
              color: metric.inefficient ? STATUS_COLORS.poor : 'inherit',
              fontWeight: metric.inefficient ? 600 : 400
            }}>
              {metric.tokenRatio.toFixed(2)}x
            </Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Avg In/Out</Text>
            <Text textStyle="small">{metric.avgInputTokens.toFixed(0)} → {metric.avgOutputTokens.toFixed(0)}</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Tooltip text={METRIC_TOOLTIPS.variance}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Variance</Text>
            </Tooltip>
            <Text style={{ 
              color: metric.inconsistent ? STATUS_COLORS.fair : 'inherit',
              fontWeight: metric.inconsistent ? 600 : 400
            }}>
              {metric.outputVariance.toFixed(0)}
            </Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Latency</Text>
            <Text textStyle="small">{metric.avgLatency.toFixed(0)}ms</Text>
          </Flex>
          <Flex flexDirection="column" alignItems="flex-end">
            <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Cost</Text>
            <Text textStyle="small">${metric.estimatedCost.toFixed(2)}</Text>
          </Flex>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Main Response Analytics Page
// ============================================

/** Create a default Timeframe object (last 24 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

/** Convert Timeframe to simple string for hook */
const getTimeframeString = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-24h';
  if (from === 'now()-1h') return '1h';
  if (from === 'now()-6h') return '6h';
  if (from === 'now()-12h') return '12h';
  if (from === 'now()-24h') return '24h';
  if (from === 'now()-7d') return '7d';
  if (from === 'now()-30d') return '30d';
  return '24h';
};

export function ResponseAnalytics() {
  const { metrics, modelComparisons, loading, error, summary, analyzeResponses } = useResponseAnalytics();
  const { 
    trendData, 
    summary: qualitySummary, 
    loading: qualityLoading, 
    analyzeQualityTrends 
  } = useResponseQualityTrends();
  
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'inefficient' | 'quality'>('overview');
  const [showQualityHelp, setShowQualityHelp] = useState(false);

  const timeframeString = useMemo(() => getTimeframeString(timeframe), [timeframe]);

  useEffect(() => {
    analyzeResponses(timeframeString);
    analyzeQualityTrends(timeframeString);
  }, [timeframeString, analyzeResponses, analyzeQualityTrends]);

  // Transform trend data for TimeseriesChart
  const qualityChartData: Timeseries[] = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    
    return [
      {
        name: 'Empty Rate (%)',
        datapoints: trendData.map(d => ({
          start: new Date(d.timestamp),
          value: d.emptyRate
        }))
      },
      {
        name: 'Error Rate (%)',
        datapoints: trendData.map(d => ({
          start: new Date(d.timestamp),
          value: d.errorRate
        }))
      }
    ];
  }, [trendData]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Title>Response Analytics</TitleBar.Title>
        <TitleBar.Subtitle>
          Token efficiency, output consistency, and model performance for ML Engineers
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <TimeframeSelector
              value={timeframe}
              onChange={(tf) => tf && setTimeframe(tf)}
              aria-label="Select time range"
            />
            <Button 
              onClick={() => analyzeResponses(timeframeString)}
              aria-label="Refresh analytics"
            >
              <RefreshIcon /> Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {error && (
        <Surface style={{ padding: '16px', backgroundColor: STATUS_COLORS.poor }}>
          <Text style={{ color: 'white' }}>Error loading analytics: {error.message}</Text>
        </Surface>
      )}

      {/* Summary Cards */}
      {summary && (
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
              <Heading level={2}>{summary.totalRequests.toLocaleString()}</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Total Tokens</Text>
              <Heading level={2}>{(summary.totalTokens / 1000000).toFixed(2)}M</Heading>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Tooltip text={METRIC_TOOLTIPS.tokenRatio}>
                <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Token Ratio</Text>
                  <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                </Flex>
              </Tooltip>
              <Heading level={2}>{summary.avgTokenRatio.toFixed(2)}x</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>output/input</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '20px', flex: '1 1 200px', minWidth: '200px' }}>
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Needs Attention</Text>
              <Flex gap={8} alignItems="baseline">
                <Heading level={2} style={{ 
                  color: summary.inefficientServices > 0 ? STATUS_COLORS.poor : 'inherit' 
                }}>
                  {summary.inefficientServices}
                </Heading>
                <Tooltip text={METRIC_TOOLTIPS.inefficient}>
                  <Text textStyle="small" style={{ cursor: 'help', textDecoration: 'underline dotted' }}>inefficient</Text>
                </Tooltip>
                <Heading level={2} style={{ 
                  color: summary.inconsistentServices > 0 ? STATUS_COLORS.fair : 'inherit' 
                }}>
                  {summary.inconsistentServices}
                </Heading>
                <Tooltip text={METRIC_TOOLTIPS.inconsistent}>
                  <Text textStyle="small" style={{ cursor: 'help', textDecoration: 'underline dotted' }}>inconsistent</Text>
                </Tooltip>
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Tab Navigation */}
      <Flex gap={8} style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
        <Button
          variant={activeTab === 'overview' ? 'accent' : 'default'}
          onClick={() => setActiveTab('overview')}
        >
          <BarChartIcon /> Model Rankings
        </Button>
        <Button
          variant={activeTab === 'services' ? 'accent' : 'default'}
          onClick={() => setActiveTab('services')}
        >
          <ServicesIcon /> Service Analysis
        </Button>
        <Button
          variant={activeTab === 'quality' ? 'accent' : 'default'}
          onClick={() => setActiveTab('quality')}
        >
          <BarChartIcon /> Quality Trends
          <span style={{ 
            padding: '2px 6px', 
            borderRadius: '4px', 
            backgroundColor: '#7c3aed',
            color: 'white',
            fontSize: '9px',
            marginLeft: '4px',
            fontWeight: 600
          }}>
            UNIQUE
          </span>
        </Button>
        <Button
          variant={activeTab === 'inefficient' ? 'accent' : 'default'}
          onClick={() => setActiveTab('inefficient')}
        >
          <WarningIcon /> Needs Attention
        </Button>
      </Flex>

      {/* Model Rankings Tab */}
      {activeTab === 'overview' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <BarChartIcon />
              <Heading level={4}>Model Efficiency Rankings</Heading>
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                Based on token ratio, latency, and cost efficiency
              </Text>
            </Flex>

            {modelComparisons.length === 0 && !loading && (
              <Text style={{ opacity: 0.7 }}>
                No model data available. Ensure your services have gen_ai.* span attributes.
              </Text>
            )}

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            <Flex gap={16} flexWrap="wrap">
              {modelComparisons.slice(0, 6).map((model, idx) => (
                <ModelCard key={`${model.provider}-${model.model}`} model={model} rank={idx + 1} />
              ))}
            </Flex>

            {modelComparisons.length > 6 && (
              <Surface style={{ padding: '12px' }}>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  +{modelComparisons.length - 6} more models
                </Text>
              </Surface>
            )}
          </Flex>
        </Surface>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <ServicesIcon />
              <Heading level={4}>Service-Level Analysis</Heading>
            </Flex>

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {!loading && metrics.length === 0 && (
              <Text style={{ opacity: 0.7 }}>
                No service data available. Ensure your services emit gen_ai.* span attributes.
              </Text>
            )}

            {metrics.map(metric => (
              <ServiceRow key={metric.serviceId} metric={metric} />
            ))}
          </Flex>
        </Surface>
      )}

      {/* Inefficient Requests Tab */}
      {activeTab === 'inefficient' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={16}>
            <Heading level={4}>⚠️ Services Needing Optimization</Heading>
            <Text style={{ opacity: 0.7 }}>
              These services have low token efficiency (high input, low output) or high variance in outputs.
              This may indicate prompt optimization opportunities.
            </Text>

            {loading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {summary?.topInefficient && summary.topInefficient.length > 0 ? (
              <Flex flexDirection="column" gap={12}>
                <Heading level={5}>Low Token Efficiency</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  High input tokens with low output - may benefit from prompt compression or caching
                </Text>
                {summary.topInefficient.map(m => (
                  <Surface key={m.serviceId} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small">{m.model} • {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} alignItems="center" flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Token Ratio</Text>
                          <Text style={{ color: STATUS_COLORS.poor, fontWeight: 600 }}>{m.tokenRatio.toFixed(2)}x</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Input</Text>
                          <Text>{m.avgInputTokens.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Output</Text>
                          <Text>{m.avgOutputTokens.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Cost</Text>
                          <Text>${m.estimatedCost.toFixed(2)}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            ) : !loading && (
              <Flex alignItems="center" gap={8}>
                <CheckmarkIcon style={{ color: STATUS_COLORS.excellent }} />
                <Text style={{ color: STATUS_COLORS.excellent }}>
                  No inefficient services detected - all services have healthy token ratios!
                </Text>
              </Flex>
            )}

            {summary?.topInconsistent && summary.topInconsistent.length > 0 && (
              <Flex flexDirection="column" gap={12} style={{ marginTop: '16px' }}>
                <Heading level={5}>High Output Variance</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  Inconsistent output lengths may indicate unpredictable model behavior
                </Text>
                {summary.topInconsistent.map(m => (
                  <Surface key={`inconsistent-${m.serviceId}`} style={{ padding: '12px' }}>
                    <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="base-emphasized">{m.serviceName}</Text>
                        <Text textStyle="small">{m.model} • {m.provider}</Text>
                      </Flex>
                      <Flex gap={24} alignItems="center" flexWrap="wrap">
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Variance</Text>
                          <Text style={{ color: STATUS_COLORS.fair, fontWeight: 600 }}>{m.outputVariance.toFixed(0)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Std Dev</Text>
                          <Text>{m.outputStdDev.toFixed(1)}</Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end">
                          <Text textStyle="small" style={{ opacity: 0.7 }}>Low Output %</Text>
                          <Text>{m.lowOutputRate.toFixed(1)}%</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {/* Quality Trends Tab - UNIQUE GCC FEATURE */}
      {activeTab === 'quality' && (
        <Surface style={{ padding: '20px' }}>
          <Flex flexDirection="column" gap={20}>
            {/* Header with Help Button */}
            <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
              <Flex alignItems="center" gap={8}>
                <BarChartIcon />
                <Heading level={4}>Response Quality Trends</Heading>
                <Tooltip text="Track AI response quality signals over time with automated anomaly detection">
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: Colors.Charts.Categorical.Color06.Default,
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 600
                  }}>
                    UNIQUE GCC
                  </span>
                </Tooltip>
              </Flex>
              <Flex alignItems="center" gap={8}>
                <Tooltip text="Learn how Quality Score is calculated">
                  <Button
                    variant={showQualityHelp ? 'accent' : 'default'}
                    onClick={() => setShowQualityHelp(!showQualityHelp)}
                  >
                    <HelpIcon /> {showQualityHelp ? 'Hide' : 'How It Works'}
                  </Button>
                </Tooltip>
                <Tooltip text="Refresh quality data">
                  <Button
                    variant="default"
                    onClick={() => analyzeQualityTrends(timeframeString)}
                    disabled={qualityLoading}
                  >
                    <RefreshIcon /> Refresh
                  </Button>
                </Tooltip>
              </Flex>
            </Flex>

            {/* Expandable Help Panel */}
            {showQualityHelp && (
              <Surface style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: 'var(--dt-colors-surface-neutral-default)',
                border: '1px solid var(--dt-colors-border-neutral-default)'
              }}>
                <Flex flexDirection="column" gap={16}>
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Text style={{ fontWeight: 600, fontSize: 15 }}>📊 QUALITY SCORE CALCULATION</Text>
                    <Button variant="default" style={{ padding: '2px 6px', minHeight: 'auto' }} onClick={() => setShowQualityHelp(false)}>✕</Button>
                  </Flex>
                  <Text style={{ fontSize: 13, opacity: 0.85 }}>
                    Measures AI response quality using observable metrics from OpenTelemetry gen_ai.* spans. No hallucination detection - only real, measurable signals.
                  </Text>
                  
                  <Flex gap={32} flexWrap="wrap">
                    {/* Score Formula */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 280px', minWidth: 280 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>SCORE FORMULA</Text>
                      <Text style={{ fontFamily: 'monospace', fontSize: 12, backgroundColor: 'var(--dt-colors-surface-default)', padding: 8, borderRadius: 4 }}>
                        Score = 100 - (Empty × 2) - (Error × 3) - (Truncated × 0.5) - (Latency Penalty)
                      </Text>
                      <Flex flexDirection="column" gap={4} style={{ fontSize: 12, paddingLeft: 8 }}>
                        <Text>• <strong>Empty Rate (×2):</strong> Responses &lt;5 tokens</Text>
                        <Text>• <strong>Error Rate (×3):</strong> Failed requests (highest weight)</Text>
                        <Text>• <strong>Truncated (×0.5):</strong> Short responses (5-20 tokens)</Text>
                        <Text>• <strong>Latency Penalty:</strong> +5 if avg &gt; 5s, +10 if &gt; 10s</Text>
                      </Flex>
                    </Flex>
                    
                    {/* Severity Thresholds */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>HEALTH SCORE LEVELS</Text>
                      <Flex flexDirection="column" gap={8} style={{ fontSize: 13 }}>
                        <Flex alignItems="center" gap={8}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: STATUS_COLORS.excellent }} />
                          <Text><strong>80-100</strong> = Excellent</Text>
                        </Flex>
                        <Text style={{ paddingLeft: 20, opacity: 0.7, fontSize: 11 }}>Healthy response quality</Text>
                        <Flex alignItems="center" gap={8}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: STATUS_COLORS.fair }} />
                          <Text><strong>50-79</strong> = Fair</Text>
                        </Flex>
                        <Text style={{ paddingLeft: 20, opacity: 0.7, fontSize: 11 }}>Some quality issues detected</Text>
                        <Flex alignItems="center" gap={8}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: STATUS_COLORS.poor }} />
                          <Text><strong>0-49</strong> = Poor</Text>
                        </Flex>
                        <Text style={{ paddingLeft: 20, opacity: 0.7, fontSize: 11 }}>Significant quality problems</Text>
                      </Flex>
                    </Flex>
                    
                    {/* Anomaly Detection */}
                    <Flex flexDirection="column" gap={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
                      <Text style={{ fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', paddingBottom: 4 }}>ANOMALY DETECTION</Text>
                      <Text style={{ fontSize: 12 }}>Auto-detects spikes when:</Text>
                      <Flex flexDirection="column" gap={4} style={{ fontSize: 12, paddingLeft: 8 }}>
                        <Text>• Metric exceeds <strong>2× average</strong></Text>
                        <Text>• Value is above <strong>5% threshold</strong></Text>
                      </Flex>
                      <Text style={{ fontSize: 12, marginTop: 8 }}>Anomaly types:</Text>
                      <Flex flexDirection="column" gap={2} style={{ fontSize: 11, paddingLeft: 8, opacity: 0.8 }}>
                        <Text>• Empty Response Spike</Text>
                        <Text>• Error Rate Spike</Text>
                        <Text>• Latency Spike</Text>
                        <Text>• Truncation Spike</Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Flex>
              </Surface>
            )}

            {qualityLoading && (
              <Flex justifyContent="center" padding={32}>
                <ProgressCircle />
              </Flex>
            )}

            {/* Quality Health Score */}
            {qualitySummary && (
              <Flex gap={16} flexWrap="wrap">
                {/* Main Health Score Card */}
                <Tooltip text={METRIC_TOOLTIPS.qualityHealthScore}>
                  <Surface style={{ 
                    padding: '20px', 
                    flex: '1 1 200px', 
                    minWidth: '200px',
                    borderLeft: `4px solid ${
                      qualitySummary.overallHealthScore >= 80 ? STATUS_COLORS.excellent :
                      qualitySummary.overallHealthScore >= 50 ? STATUS_COLORS.fair : STATUS_COLORS.poor
                    }`,
                    cursor: 'help'
                  }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Quality Health Score</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Flex alignItems="baseline" gap={8}>
                        <Heading level={1} style={{ 
                          color: qualitySummary.overallHealthScore >= 80 ? STATUS_COLORS.excellent :
                                 qualitySummary.overallHealthScore >= 50 ? STATUS_COLORS.fair : STATUS_COLORS.poor
                        }}>
                          {qualitySummary.overallHealthScore}
                        </Heading>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>/ 100</Text>
                      </Flex>
                      <Tooltip text={METRIC_TOOLTIPS.trendDirection}>
                        <Flex alignItems="center" gap={4} style={{ cursor: 'help' }}>
                          {qualitySummary.trendDirection === 'improving' && (
                            <><ArrowUpRightIcon style={{ color: STATUS_COLORS.excellent, width: 16 }} />
                            <Text textStyle="small" style={{ color: STATUS_COLORS.excellent }}>Improving</Text></>
                          )}
                          {qualitySummary.trendDirection === 'degrading' && (
                            <><ArrowDownRightIcon style={{ color: STATUS_COLORS.poor, width: 16 }} />
                            <Text textStyle="small" style={{ color: STATUS_COLORS.poor }}>Degrading</Text></>
                          )}
                          {qualitySummary.trendDirection === 'stable' && (
                            <Text textStyle="small" style={{ opacity: 0.7 }}>→ Stable</Text>
                          )}
                        </Flex>
                      </Tooltip>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Empty Response Rate Card */}
                <Tooltip text={METRIC_TOOLTIPS.emptyResponseRate}>
                  <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px', cursor: 'help' }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Empty Response Rate</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary.emptyResponseRate > 5 ? STATUS_COLORS.poor : 'inherit'
                      }}>
                        {qualitySummary.emptyResponseRate.toFixed(1)}%
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>responses with &lt;5 tokens</Text>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Error Rate Card */}
                <Tooltip text={METRIC_TOOLTIPS.errorRate}>
                  <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px', cursor: 'help' }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Error Rate</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary.errorRate > 5 ? STATUS_COLORS.poor : 'inherit'
                      }}>
                        {qualitySummary.errorRate.toFixed(1)}%
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>failed requests</Text>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Truncated Rate Card */}
                <Tooltip text={METRIC_TOOLTIPS.truncatedRate}>
                  <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px', cursor: 'help' }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Truncated Rate</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary.truncatedRate > 10 ? STATUS_COLORS.fair : 'inherit'
                      }}>
                        {qualitySummary.truncatedRate.toFixed(1)}%
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>short responses (5-20 tokens)</Text>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Avg Latency Card */}
                <Tooltip text={METRIC_TOOLTIPS.avgLatency}>
                  <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px', cursor: 'help' }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex alignItems="center" gap={4}>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>Avg Latency</Text>
                        <HelpIcon style={{ width: 12, height: 12, opacity: 0.5 }} />
                      </Flex>
                      <Heading level={3} style={{ 
                        color: qualitySummary.avgLatencyMs > 5000 ? STATUS_COLORS.fair : 'inherit'
                      }}>
                        {(qualitySummary.avgLatencyMs / 1000).toFixed(1)}s
                      </Heading>
                      <Text textStyle="small" style={{ opacity: 0.7 }}>response time</Text>
                    </Flex>
                  </Surface>
                </Tooltip>

                {/* Total Requests Card */}
                <Surface style={{ padding: '20px', flex: '1 1 150px', minWidth: '150px' }}>
                  <Flex flexDirection="column" gap={8}>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>Total Requests</Text>
                    <Heading level={3}>
                      {qualitySummary.totalRequests.toLocaleString()}
                    </Heading>
                    <Text textStyle="small" style={{ opacity: 0.7 }}>in timeframe</Text>
                  </Flex>
                </Surface>
              </Flex>
            )}

            {/* Quality Trend Chart */}
            {qualityChartData.length > 0 && trendData.length > 0 && (
              <Surface style={{ padding: '20px' }}>
                <Flex flexDirection="column" gap={12}>
                  <Flex alignItems="center" gap={8}>
                    <Heading level={5}>Quality Metrics Over Time</Heading>
                    <Tooltip text="Empty Response Rate and Error Rate plotted over time. Look for spikes that correlate with deployments or traffic changes.">
                      <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                    </Tooltip>
                  </Flex>
                  <div style={{ height: '300px' }}>
                    <TimeseriesChart
                      data={qualityChartData}
                    >
                      <TimeseriesChart.Legend />
                    </TimeseriesChart>
                  </div>
                </Flex>
              </Surface>
            )}

            {/* Recent Anomalies */}
            {qualitySummary?.recentAnomalies && qualitySummary.recentAnomalies.length > 0 && (
              <Surface style={{ padding: '20px', borderLeft: `4px solid ${STATUS_COLORS.fair}` }}>
                <Flex flexDirection="column" gap={12}>
                  <Flex alignItems="center" gap={8}>
                    <WarningIcon style={{ color: STATUS_COLORS.fair }} />
                    <Heading level={5}>Recent Quality Anomalies</Heading>
                    <Tooltip text={METRIC_TOOLTIPS.qualityAnomaly}>
                      <HelpIcon style={{ width: 14, height: 14, opacity: 0.5, cursor: 'help' }} />
                    </Tooltip>
                  </Flex>
                  <Text textStyle="small" style={{ opacity: 0.7 }}>
                    Automated detection of quality degradation events - metrics exceeding 2× their average value
                  </Text>
                  
                  <Flex flexDirection="column" gap={8}>
                    {qualitySummary.recentAnomalies.map((anomaly, idx) => (
                      <Surface key={idx} style={{ 
                        padding: '12px',
                        backgroundColor: anomaly.severity === 'critical' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                      }}>
                        <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
                          <Flex flexDirection="column" gap={4}>
                            <Flex alignItems="center" gap={8}>
                              <span style={{ 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                backgroundColor: anomaly.severity === 'critical' ? STATUS_COLORS.poor : STATUS_COLORS.fair,
                                color: 'white',
                                fontSize: '10px',
                                textTransform: 'uppercase'
                              }}>
                                {anomaly.severity}
                              </span>
                              <Text textStyle="base-emphasized">{anomaly.message}</Text>
                            </Flex>
                            <Text textStyle="small" style={{ opacity: 0.7 }}>
                              {new Date(anomaly.timestamp).toLocaleString()}
                            </Text>
                          </Flex>
                          <Flex alignItems="center" gap={12}>
                            <Flex flexDirection="column" alignItems="flex-end">
                              <Text textStyle="small" style={{ opacity: 0.7 }}>Value</Text>
                              <Text textStyle="base-emphasized">
                                {anomaly.type === 'latency_spike' 
                                  ? `${(anomaly.value / 1000).toFixed(1)}s`
                                  : `${anomaly.value.toFixed(1)}%`
                                }
                              </Text>
                            </Flex>
                            <Flex flexDirection="column" alignItems="flex-end">
                              <Text textStyle="small" style={{ opacity: 0.7 }}>Threshold</Text>
                              <Text textStyle="small">
                                {anomaly.type === 'latency_spike' 
                                  ? `${(anomaly.threshold / 1000).toFixed(1)}s`
                                  : `${anomaly.threshold.toFixed(1)}%`
                                }
                              </Text>
                            </Flex>
                          </Flex>
                        </Flex>
                      </Surface>
                    ))}
                  </Flex>
                </Flex>
              </Surface>
            )}

            {qualitySummary?.recentAnomalies?.length === 0 && !qualityLoading && (
              <Surface style={{ padding: '20px', borderLeft: `4px solid ${STATUS_COLORS.excellent}` }}>
                <Flex alignItems="center" gap={8}>
                  <CheckmarkIcon style={{ color: STATUS_COLORS.excellent }} />
                  <Text style={{ color: STATUS_COLORS.excellent }}>
                    No quality anomalies detected in the selected timeframe - responses are healthy!
                  </Text>
                </Flex>
              </Surface>
            )}

            {!qualitySummary && !qualityLoading && (
              <Text style={{ opacity: 0.7 }}>
                No quality data available. Ensure your services emit gen_ai.* span attributes with token counts.
              </Text>
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
}
