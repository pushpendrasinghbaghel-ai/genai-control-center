// GenAI Control Center — Optimization Advisor Panel
// Phase 4: Anti-pattern detection results + actionable recommendations
// Integrates into the AgentTools page

import React, { useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import {
  CheckmarkIcon, WarningIcon, CriticalIcon, HelpIcon, RefreshIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAgentOptimization } from '../hooks/useAgentOptimization';
import type { AgentAntiPattern, OptimizationScore } from '../hooks/useAgentOptimization';

const STATUS_COLORS = {
  healthy: Colors.Charts.Status.Ideal.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
};

const scoreColor = (s: number) => s >= 75 ? STATUS_COLORS.healthy : s >= 50 ? STATUS_COLORS.warning : STATUS_COLORS.critical;

const PATTERN_ICONS: Record<string, string> = {
  excessive_retries: '🔄',
  tool_loop: '🔁',
  token_waste: '💸',
  slow_chain: '🐌',
  redundant_calls: '📋',
  error_cascade: '💥',
  oversized_context: '📦',
  model_mismatch: '🔧',
};

const sevColor = (sev: string) => {
  switch (sev) {
    case 'critical': return STATUS_COLORS.critical;
    case 'high': return '#ff5722';
    case 'medium': return STATUS_COLORS.warning;
    default: return STATUS_COLORS.neutral;
  }
};

// ============================================
// Agent Score Row
// ============================================
const AgentScoreRow: React.FC<{ score: OptimizationScore }> = ({ score }) => {
  const color = scoreColor(score.overallScore);
  return (
    <Flex
      alignItems="center"
      gap={12}
      style={{ padding: '8px 0', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}
    >
      <Flex
        alignItems="center"
        justifyContent="center"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `2px solid ${color}`, background: `${color}10`,
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(score.overallScore)}</Text>
      </Flex>
      <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
        <Text style={{ fontWeight: 600, fontSize: 13 }}>{score.agentName}</Text>
        <Flex gap={8}>
          <Text textStyle="small" style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>
            {score.totalTraces} traces
          </Text>
          <Text textStyle="small" style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>
            {Math.round(score.avgDurationMs)}ms avg
          </Text>
          {score.antiPatternCount > 0 && (
            <Text textStyle="small" style={{ fontSize: 10, color: STATUS_COLORS.warning, fontWeight: 600 }}>
              {score.antiPatternCount} issue{score.antiPatternCount > 1 ? 's' : ''}
            </Text>
          )}
        </Flex>
      </Flex>
      <Flex gap={4} style={{ width: 200 }}>
        <Tooltip text={`Retry: ${Math.round(score.retryScore)} | Efficiency: ${Math.round(score.efficiencyScore)} | Latency: ${Math.round(score.latencyScore)} | Error: ${Math.round(score.errorScore)}`}>
          <ProgressBar value={score.overallScore} style={{ width: 120 }} />
        </Tooltip>
      </Flex>
    </Flex>
  );
};

// ============================================
// Anti-Pattern Card
// ============================================
const AntiPatternCard: React.FC<{ pattern: AgentAntiPattern }> = ({ pattern }) => {
  const [expanded, setExpanded] = useState(false);
  const color = sevColor(pattern.severity);
  const icon = PATTERN_ICONS[pattern.type] || '⚠️';

  return (
    <Surface
      style={{
        padding: 12,
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Flex flexDirection="column" gap={6}>
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={8}>
            <Text style={{ fontSize: 16 }}>{icon}</Text>
            <Surface style={{ padding: '1px 5px', borderRadius: 3, backgroundColor: `${color}18` }}>
              <Text textStyle="small" style={{ color, fontWeight: 600, fontSize: 9, textTransform: 'uppercase' as const }}>
                {pattern.severity}
              </Text>
            </Surface>
            <Text style={{ fontWeight: 600, fontSize: 13 }}>{pattern.title}</Text>
          </Flex>
          <Flex alignItems="center" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 10 }}>
              {pattern.affectedTraces} traces
            </Text>
            <Text textStyle="small" style={{ color: STATUS_COLORS.healthy, fontWeight: 600, fontSize: 10 }}>
              {pattern.estimatedSavings}
            </Text>
          </Flex>
        </Flex>

        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{pattern.description}</Text>

        {expanded && (
          <Flex flexDirection="column" gap={6} style={{ paddingTop: 6, borderTop: `1px solid ${Colors.Border.Neutral.Default}` }}>
            <Flex flexDirection="column" gap={2}>
              <Text textStyle="small" style={{ fontWeight: 600, fontSize: 10 }}>Evidence</Text>
              <Text textStyle="small" style={{ fontSize: 11, fontFamily: 'monospace' }}>{pattern.evidence}</Text>
            </Flex>
            <Flex flexDirection="column" gap={2}>
              <Text textStyle="small" style={{ fontWeight: 600, fontSize: 10, color: STATUS_COLORS.healthy }}>Recommendation</Text>
              <Text textStyle="small" style={{ fontSize: 11 }}>{pattern.recommendation}</Text>
            </Flex>
          </Flex>
        )}
      </Flex>
    </Surface>
  );
};

// ============================================
// Main Panel
// ============================================

interface OptimizationAdvisorProps {
  compact?: boolean;
}

export const OptimizationAdvisor: React.FC<OptimizationAdvisorProps> = ({ compact = false }) => {
  const { antiPatterns, agentScores, summary, loading, refetch } = useAgentOptimization();
  const [showAll, setShowAll] = useState(false);

  if (loading && !summary) {
    return (
      <Surface style={{ padding: 16 }}>
        <Flex alignItems="center" gap={8}>
          <ProgressCircle size="small" />
          <Text textStyle="small">Analyzing agent patterns…</Text>
        </Flex>
      </Surface>
    );
  }

  if (!summary) return null;

  const avgScore = summary.avgOptimizationScore;
  const avgColor = scoreColor(avgScore);

  if (compact) {
    return (
      <Surface style={{ padding: 12 }}>
        <Flex alignItems="center" gap={12}>
          <Flex flexDirection="column" alignItems="center" gap={2}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: avgColor, lineHeight: 1 }}>{Math.round(avgScore)}</Text>
            <Text textStyle="small" style={{ fontSize: 9, color: Colors.Text.Neutral.Subdued }}>OPT SCORE</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Text textStyle="small">{summary.totalAgents} agents, {summary.totalAntiPatterns} issues</Text>
            {summary.criticalPatterns > 0 && (
              <Text textStyle="small" style={{ color: STATUS_COLORS.critical, fontWeight: 600, fontSize: 10 }}>
                {summary.criticalPatterns} critical
              </Text>
            )}
          </Flex>
        </Flex>
      </Surface>
    );
  }

  const displayedPatterns = showAll ? antiPatterns : antiPatterns.slice(0, 5);

  return (
    <Surface style={{ padding: 16 }}>
      <Flex flexDirection="column" gap={16}>
        {/* Header with summary */}
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={12}>
            <Flex
              alignItems="center"
              justifyContent="center"
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: `3px solid ${avgColor}`, background: `${avgColor}10`,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: 700, color: avgColor, lineHeight: 1 }}>{Math.round(avgScore)}</Text>
            </Flex>
            <Flex flexDirection="column" gap={2}>
              <Heading level={4}>Agent Optimization Advisor</Heading>
              <Flex alignItems="center" gap={8}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  {summary.totalAgents} agents analyzed
                </Text>
                <Text textStyle="small" style={{ color: STATUS_COLORS.warning, fontWeight: 600 }}>
                  {summary.totalAntiPatterns} anti-pattern{summary.totalAntiPatterns !== 1 ? 's' : ''} detected
                </Text>
                {summary.estimatedTotalWasteUsd > 0 && (
                  <Text textStyle="small" style={{ color: STATUS_COLORS.critical, fontWeight: 600 }}>
                    ~${summary.estimatedTotalWasteUsd.toFixed(2)} potential savings/6h
                  </Text>
                )}
              </Flex>
            </Flex>
          </Flex>
          <Button variant="default" onClick={refetch}>
            <RefreshIcon />
          </Button>
        </Flex>

        {/* Agent Scores */}
        {agentScores.length > 0 && (
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Agent Health Scores</Text>
            {agentScores.slice(0, 8).map(sc => (
              <AgentScoreRow key={sc.agentName} score={sc} />
            ))}
          </Flex>
        )}

        {/* Anti-Patterns */}
        {antiPatterns.length > 0 && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={6}>
              <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>
                Detected Anti-Patterns
              </Text>
              {summary.criticalPatterns > 0 && (
                <Surface style={{ padding: '1px 5px', borderRadius: 3, backgroundColor: `${STATUS_COLORS.critical}18` }}>
                  <Text textStyle="small" style={{ color: STATUS_COLORS.critical, fontWeight: 600, fontSize: 9 }}>
                    {summary.criticalPatterns} CRITICAL
                  </Text>
                </Surface>
              )}
            </Flex>
            {displayedPatterns.map(p => (
              <AntiPatternCard key={p.id} pattern={p} />
            ))}
            {antiPatterns.length > 5 && (
              <Button variant="default" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show less' : `Show all ${antiPatterns.length} patterns`}
              </Button>
            )}
          </Flex>
        )}

        {/* All Clear */}
        {antiPatterns.length === 0 && (
          <Flex alignItems="center" gap={8} style={{ padding: 12, borderRadius: 6, background: `${STATUS_COLORS.healthy}08` }}>
            <CheckmarkIcon style={{ color: STATUS_COLORS.healthy }} />
            <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>
              No anti-patterns detected. All agent workflows are operating efficiently.
            </Text>
          </Flex>
        )}
      </Flex>
    </Surface>
  );
};

export default OptimizationAdvisor;
