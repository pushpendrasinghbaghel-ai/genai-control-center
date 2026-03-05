// GenAI Control Center — RAG Health Score Panel
// Phase 3: Composite health visualization + self-healing action recommendations
// Integrates into the VectorDB page as a top-level health indicator

import React, { useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import {
  CheckmarkIcon, WarningIcon, CriticalIcon, HelpIcon, RefreshIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useRAGHealthScore } from '../hooks/useRAGHealthScore';
import type { RAGHealthDimension, HealingAction, RAGHealthTrend } from '../hooks/useRAGHealthScore';

const STATUS_COLORS = {
  healthy: Colors.Charts.Status.Ideal.Default,
  degraded: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckmarkIcon style={{ width: 14, height: 14, color: STATUS_COLORS.healthy }} />;
    case 'degraded': return <WarningIcon style={{ width: 14, height: 14, color: STATUS_COLORS.degraded }} />;
    case 'critical': return <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.critical }} />;
    default: return null;
  }
};

const scoreColor = (score: number) =>
  score >= 75 ? STATUS_COLORS.healthy : score >= 50 ? STATUS_COLORS.degraded : STATUS_COLORS.critical;

// ============================================
// Sparkline SVG for trend
// ============================================
const TrendSparkline: React.FC<{ data: RAGHealthTrend[]; width?: number; height?: number }> = ({
  data,
  width = 240,
  height = 48,
}) => {
  if (data.length < 2) return null;

  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const minY = Math.min(...data.map(d => d.compositeScore));
  const maxY = Math.max(...data.map(d => d.compositeScore));
  const rangeY = maxY - minY || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((d.compositeScore - minY) / rangeY) * h;
    return `${x},${y}`;
  }).join(' ');

  const latest = data[data.length - 1];
  const color = scoreColor(latest.compositeScore);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Healthy zone */}
      <rect x={padding} y={padding} width={w} height={h * 0.25} fill={STATUS_COLORS.healthy} opacity={0.06} rx={2} />
      {/* Degraded zone */}
      <rect x={padding} y={padding + h * 0.25} width={w} height={h * 0.25} fill={STATUS_COLORS.degraded} opacity={0.06} rx={2} />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest point */}
      <circle
        cx={padding + w}
        cy={padding + h - ((latest.compositeScore - minY) / rangeY) * h}
        r={3}
        fill={color}
      />
    </svg>
  );
};

// ============================================
// Dimension Score Bar
// ============================================
const DimensionBar: React.FC<{ dim: RAGHealthDimension }> = ({ dim }) => {
  const color = scoreColor(dim.score);
  return (
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" justifyContent="space-between">
        <Flex alignItems="center" gap={6}>
          {statusIcon(dim.status)}
          <Text textStyle="small" style={{ fontWeight: 600 }}>{dim.name}</Text>
          <Tooltip text={`Threshold — Healthy: <${dim.threshold.healthy}${dim.threshold.unit}, Degraded: <${dim.threshold.degraded}${dim.threshold.unit}`}>
            <HelpIcon style={{ width: 10, height: 10, color: Colors.Text.Neutral.Subdued, cursor: 'help' }} />
          </Tooltip>
        </Flex>
        <Text textStyle="small" style={{ fontWeight: 600, color }}>{dim.score}/100</Text>
      </Flex>
      <ProgressBar value={dim.score} style={{ height: 4 }} />
      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 10 }}>{dim.details}</Text>
    </Flex>
  );
};

// ============================================
// Healing Action Card
// ============================================
const HealingActionCard: React.FC<{ action: HealingAction }> = ({ action }) => {
  const sevColor = action.severity === 'critical' ? STATUS_COLORS.critical : STATUS_COLORS.degraded;
  return (
    <Flex
      alignItems="flex-start"
      gap={8}
      style={{
        padding: '10px 12px',
        borderRadius: 6,
        borderLeft: `3px solid ${sevColor}`,
        background: `${sevColor}08`,
      }}
    >
      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
        <Flex alignItems="center" gap={6}>
          <Surface style={{ padding: '1px 5px', borderRadius: 3, backgroundColor: `${sevColor}18` }}>
            <Text textStyle="small" style={{ color: sevColor, fontWeight: 600, fontSize: 9, textTransform: 'uppercase' as const }}>
              {action.severity}
            </Text>
          </Surface>
          <Text textStyle="small" style={{ fontWeight: 600 }}>{action.title}</Text>
          {action.automated && (
            <Surface style={{ padding: '1px 5px', borderRadius: 3, backgroundColor: 'rgba(99,102,241,0.1)' }}>
              <Text textStyle="small" style={{ fontSize: 9, color: '#6366f1' }}>AUTO</Text>
            </Surface>
          )}
        </Flex>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 11 }}>{action.description}</Text>
        <Text textStyle="small" style={{ color: STATUS_COLORS.healthy, fontSize: 10, fontWeight: 600 }}>
          Est. impact: {action.estimatedImpact}
        </Text>
      </Flex>
    </Flex>
  );
};

// ============================================
// Main Panel
// ============================================

interface RAGHealthPanelProps {
  compact?: boolean;
}

export const RAGHealthPanel: React.FC<RAGHealthPanelProps> = ({ compact = false }) => {
  const { healthScore, trend, loading, refetch } = useRAGHealthScore();

  if (loading && !healthScore) {
    return (
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8}>
          <ProgressCircle size="small" />
          <Text textStyle="small">Computing RAG health score…</Text>
        </Flex>
      </Surface>
    );
  }

  if (!healthScore) return null;

  const scoreNum = healthScore.compositeScore;
  const color = scoreColor(scoreNum);

  if (compact) {
    return (
      <Surface style={{ padding: 12 }}>
        <Flex alignItems="center" gap={12}>
          <Flex flexDirection="column" alignItems="center" gap={2}>
            <Text style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{Math.round(scoreNum)}</Text>
            <Text textStyle="small" style={{ color, fontWeight: 600, fontSize: 9, textTransform: 'uppercase' as const }}>
              {healthScore.status}
            </Text>
          </Flex>
          <TrendSparkline data={trend} width={140} height={36} />
          {healthScore.healingActions.length > 0 && (
            <Surface style={{ padding: '2px 6px', borderRadius: 3, backgroundColor: `${STATUS_COLORS.degraded}18` }}>
              <Text textStyle="small" style={{ color: STATUS_COLORS.degraded, fontWeight: 600, fontSize: 10 }}>
                {healthScore.healingActions.length} action{healthScore.healingActions.length > 1 ? 's' : ''}
              </Text>
            </Surface>
          )}
        </Flex>
      </Surface>
    );
  }

  return (
    <Surface style={{ padding: 16 }}>
      <Flex flexDirection="column" gap={16}>
        {/* Header */}
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={12}>
            <Flex
              alignItems="center"
              justifyContent="center"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: `3px solid ${color}`,
                background: `${color}10`,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{Math.round(scoreNum)}</Text>
            </Flex>
            <Flex flexDirection="column" gap={2}>
              <Heading level={4}>RAG Health Score</Heading>
              <Flex alignItems="center" gap={6}>
                {statusIcon(healthScore.status)}
                <Text textStyle="small" style={{ color, fontWeight: 600, textTransform: 'uppercase' as const }}>
                  {healthScore.status}
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  · {new Date(healthScore.lastUpdated).toLocaleTimeString()}
                </Text>
              </Flex>
            </Flex>
          </Flex>
          <Flex alignItems="center" gap={8}>
            <TrendSparkline data={trend} />
            <Button variant="default" onClick={refetch}>
              <RefreshIcon />
            </Button>
          </Flex>
        </Flex>

        {/* Dimensions */}
        <Flex flexDirection="column" gap={12}>
          <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Health Dimensions</Text>
          {healthScore.dimensions.map(dim => (
            <DimensionBar key={dim.name} dim={dim} />
          ))}
        </Flex>

        {/* Healing Actions */}
        {healthScore.healingActions.length > 0 && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>
                Self-Healing Actions
              </Text>
              <Surface style={{ padding: '1px 5px', borderRadius: 3, backgroundColor: `${color}18` }}>
                <Text textStyle="small" style={{ color, fontWeight: 600, fontSize: 9 }}>
                  {healthScore.healingActions.length}
                </Text>
              </Surface>
            </Flex>
            {healthScore.healingActions.map(action => (
              <HealingActionCard key={action.id} action={action} />
            ))}
          </Flex>
        )}

        {/* All Healthy */}
        {healthScore.healingActions.length === 0 && (
          <Flex alignItems="center" gap={8} style={{ padding: 12, borderRadius: 6, background: `${STATUS_COLORS.healthy}08` }}>
            <CheckmarkIcon style={{ color: STATUS_COLORS.healthy }} />
            <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>
              All RAG dimensions healthy. No remediation needed.
            </Text>
          </Flex>
        )}
      </Flex>
    </Surface>
  );
};

export default RAGHealthPanel;
