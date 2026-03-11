// GenAI Control Center — Cost Guardrail Panel Component
// Displays cost velocity monitoring

import React, { useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { WarningIcon, CriticalIcon, HelpIcon,
  RefreshIcon, BarChartIcon, WorkflowsIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  useCostVelocity,
} from '../hooks/useCostGuardrails';
import type {
  ProviderCostVelocity,
} from '../hooks/useCostGuardrails';

// ============================================
// Status Colors — consistent with all GCC pages
// ============================================
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const velocityStatusColor = (status: string): string => {
  switch (status) {
    case 'critical': return STATUS_COLORS.critical;
    case 'warning': return STATUS_COLORS.warning;
    case 'elevated': return STATUS_COLORS.neutral;
    default: return STATUS_COLORS.good;
  }
};



// ============================================
// Mini SVG Sparkline for cost velocity
// ============================================
const VelocitySparkline: React.FC<{ points: { timestamp: number; costPerMinute: number }[] }> = ({ points }) => {
  if (points.length < 2) return null;

  const width = 260;
  const height = 48;
  const padding = 4;

  const maxVal = Math.max(...points.map(p => p.costPerMinute), 0.001);
  const minVal = Math.min(...points.map(p => p.costPerMinute));
  const range = maxVal - minVal || 1;

  const normalize = (v: number) => height - padding - ((v - minVal) / range) * (height - padding * 2);

  const pathData = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - padding * 2);
      const y = normalize(p.costPerMinute);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  // Fill area
  const first = padding;
  const last = padding + ((points.length - 1) / (points.length - 1)) * (width - padding * 2);
  const areaPath = `${pathData} L ${last.toFixed(1)} ${height} L ${first.toFixed(1)} ${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="vel-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={STATUS_COLORS.warning} stopOpacity="0.3" />
          <stop offset="100%" stopColor={STATUS_COLORS.warning} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#vel-grad)" />
      <path d={pathData} fill="none" stroke={STATUS_COLORS.warning} strokeWidth={1.5} />
      {/* Latest point dot */}
      {points.length > 0 && (() => {
        const lastPt = points[points.length - 1];
        const lx = padding + ((points.length - 1) / (points.length - 1)) * (width - padding * 2);
        const ly = normalize(lastPt.costPerMinute);
        return <circle cx={lx} cy={ly} r={3} fill={STATUS_COLORS.critical} />;
      })()}
    </svg>
  );
};

// ============================================
// Component: CostGuardrailPanel
// ============================================

interface CostGuardrailPanelProps {
  dailyBudget?: number;
  compact?: boolean;
}

export const CostGuardrailPanel: React.FC<CostGuardrailPanelProps> = ({
  dailyBudget = 1000,
  compact = false,
}) => {
  const { data: velocity, timeseries, loading: velocityLoading, refetch: refetchVelocity } = useCostVelocity();
  const [showDetails, setShowDetails] = useState(false);

  const handleRefresh = () => {
    void refetchVelocity();
  };

  // Format dollar/minute values
  const fmt = (v: number) => v >= 1 ? `$${v.toFixed(2)}` : v >= 0.01 ? `$${v.toFixed(3)}` : `$${v.toFixed(4)}`;

  if (compact) {
    // Compact mode — single row summary for embedding in other pages
    return (
      <Surface style={{ padding: 12, borderLeft: `3px solid ${velocityStatusColor(velocity?.status || 'normal')}` }}>
        <Flex alignItems="center" gap={16}>
          <Flex alignItems="center" gap={4}>
            <BarChartIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued }} />
            <Text textStyle="small" style={{ fontWeight: 600 }}>Cost Velocity</Text>
          </Flex>
          <Text textStyle="small" style={{ color: velocityStatusColor(velocity?.status || 'normal'), fontWeight: 600 }}>
            {velocityLoading ? '…' : velocity ? `${fmt(velocity.currentCostPerMinute)}/min` : 'N/A'}
          </Text>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            {velocity ? `${velocity.velocityRatio.toFixed(1)}x baseline` : ''}
          </Text>
        </Flex>
      </Surface>
    );
  }

  return (
    <Flex flexDirection="column" gap={16}>
      {/* Section Header */}
      <Flex alignItems="center" gap={8} justifyContent="space-between">
        <Flex alignItems="center" gap={8}>
          <WorkflowsIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued }} />
          <Text style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: Colors.Text.Neutral.Subdued, letterSpacing: '0.5px' }}>
            Autonomous Cost Guardrails
          </Text>
          <Tooltip text="Real-time cost velocity monitoring with agentic workflow enforcement. Detects cost spikes above baseline and can auto-trigger budget guardrails.">
            <HelpIcon style={{ width: 12, height: 12, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
          </Tooltip>
        </Flex>
        <Flex gap={8}>
          <Button variant="default" onClick={handleRefresh}>
            <RefreshIcon /> Refresh
          </Button>
          <Button variant="default" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </Flex>
      </Flex>

      {/* Primary Metric Row */}
      <Flex gap={16}>
        {/* Cost Velocity Card */}
        <Surface style={{
          flex: 1,
          padding: 16,
          borderLeft: `4px solid ${velocityStatusColor(velocity?.status || 'normal')}`,
        }}>
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={4}>
              <BarChartIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued }} />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontWeight: 600 }}>Cost Velocity</Text>
              <Tooltip text="Current cost-per-minute vs 24h baseline. Warning at 2x, Critical at 5x.">
                <HelpIcon style={{ width: 10, height: 10, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
              </Tooltip>
            </Flex>

            {velocityLoading ? (
              <Text>Loading…</Text>
            ) : velocity ? (
              <>
                <Heading level={2} style={{ color: velocityStatusColor(velocity.status) }}>
                  {fmt(velocity.currentCostPerMinute)}/min
                </Heading>
                <Flex alignItems="center" gap={8}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    Baseline: {fmt(velocity.baselineCostPerMinute)}/min
                  </Text>
                  <Text textStyle="small" style={{
                    fontWeight: 600,
                    color: velocityStatusColor(velocity.status),
                  }}>
                    {velocity.velocityRatio.toFixed(1)}x
                  </Text>
                  {velocity.status !== 'normal' && (
                    velocity.status === 'critical'
                      ? <CriticalIcon style={{ width: 12, height: 12, color: STATUS_COLORS.critical }} />
                      : <WarningIcon style={{ width: 12, height: 12, color: STATUS_COLORS.warning }} />
                  )}
                </Flex>
                <VelocitySparkline points={timeseries} />
              </>
            ) : (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No data</Text>
            )}
          </Flex>
        </Surface>


      </Flex>

      {/* Provider Cost Velocity Details (expandable) */}
      {showDetails && velocity && velocity.byProvider.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>
              PROVIDER COST VELOCITY BREAKDOWN
            </Text>
            <Flex flexDirection="column" gap={8}>
              {velocity.byProvider.map((pv: ProviderCostVelocity, i: number) => (
                <Flex key={`pv-${i}`} alignItems="center" gap={12} style={{ padding: '6px 0', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
                  <Text style={{ flex: 1, fontWeight: 600 }}>{pv.provider}</Text>
                  <Text textStyle="small" style={{ color: velocityStatusColor(pv.status) }}>
                    {fmt(pv.costPerMinute)}/min
                  </Text>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, width: 100 }}>
                    {pv.tokenVelocity.toFixed(0)} tok/min
                  </Text>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, width: 80 }}>
                    {pv.requestVelocity.toFixed(1)} req/min
                  </Text>
                  <Surface style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: velocityStatusColor(pv.status) + '22',
                  }}>
                    <Text textStyle="small" style={{ color: velocityStatusColor(pv.status), fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
                      {pv.status}
                    </Text>
                  </Surface>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default CostGuardrailPanel;
