// Response Analytics Dashboard
// For ML Engineers & Developers: Token efficiency, output consistency, model comparison
// Based on real observable metrics from OpenTelemetry gen_ai.* spans

import React, { useEffect, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Select, SelectOption } from '@dynatrace/strato-components-preview/forms';
import { RefreshIcon, BarChartIcon, ServicesIcon, WarningIcon, CheckmarkIcon, HelpIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';

import { useResponseAnalytics, TokenEfficiencyMetrics, ModelComparison } from '../hooks/useResponseAnalytics';

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

export function ResponseAnalytics() {
  const { metrics, modelComparisons, loading, error, summary, analyzeResponses } = useResponseAnalytics();
  const [timeframe, setTimeframe] = useState('24h');
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'inefficient'>('overview');

  useEffect(() => {
    analyzeResponses(timeframe);
  }, [timeframe, analyzeResponses]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Title>Response Analytics</TitleBar.Title>
        <TitleBar.Subtitle>
          Token efficiency, output consistency, and model performance for ML Engineers
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <Select 
              value={timeframe} 
              onChange={(val) => val && setTimeframe(val)}
              aria-label="Select timeframe"
            >
              <SelectOption value="1h">Last 1 hour</SelectOption>
              <SelectOption value="6h">Last 6 hours</SelectOption>
              <SelectOption value="24h">Last 24 hours</SelectOption>
              <SelectOption value="7d">Last 7 days</SelectOption>
            </Select>
            <Button 
              onClick={() => analyzeResponses(timeframe)}
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
    </Flex>
  );
}
