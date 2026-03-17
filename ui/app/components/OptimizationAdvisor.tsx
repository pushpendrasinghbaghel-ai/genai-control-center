// GenAI Control Center — Optimization Advisor Panel
// Phase 4: Anti-pattern detection results + actionable recommendations
// Integrates into the AgentTools page

import React, { useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar, ProgressCircle } from '@dynatrace/strato-components/content';
import { Modal, Tooltip } from '@dynatrace/strato-components/overlays';
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
// Scoring Methodology Modal
// ============================================
const ScoringMethodologyModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal title="Optimization Score Methodology" show={open} onDismiss={onClose} size="medium">
    <Flex flexDirection="column" gap={16} style={{ padding: '8px 0' }}>
      {/* Methodology Overview */}
      <Surface style={{ padding: 16, background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 6 }}>
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600 }}>Scoring Approach</Text>
          <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Scores are based on <strong>industry SRE standards</strong> and <strong>LLM cost optimization research</strong>. 
            Each metric uses thresholds derived from Google SRE handbook principles, OpenAI best practices, 
            and Apdex (Application Performance Index) methodology.
          </Text>
        </Flex>
      </Surface>

      <Surface style={{ padding: 16, background: 'var(--dt-colors-surface-default)', borderRadius: 6 }}>
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600 }}>Overall Score Formula</Text>
          <Text textStyle="small" style={{ fontFamily: 'monospace', padding: '8px 12px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
            Overall = (Reliability × 0.30) + (Efficiency × 0.30) + (Latency × 0.25) + (Retry × 0.15)
          </Text>
          <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>
            Weights reflect production impact: reliability and cost efficiency are prioritized over latency for AI workloads.
          </Text>
        </Flex>
      </Surface>

      <Flex flexDirection="column" gap={12}>
        {/* Reliability Score */}
        <Surface style={{ padding: 12, borderLeft: `3px solid ${Colors.Charts.Categorical.Color04.Default}` }}>
          <Flex flexDirection="column" gap={6}>
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontWeight: 600, fontSize: 13 }}>🛡️ Reliability Score (30%)</Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>Based on Google SRE error budgets</Text>
            </Flex>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Uses industry-standard SLO tiers. Most production systems target 99.9% availability (0.1% error rate).
            </Text>
            <Flex flexDirection="column" gap={2} style={{ marginTop: 4, padding: '8px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ &lt;0.1% errors (99.9% SLO): 100</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ 0.1-1% errors (99% SLO): 90</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 1-5% errors: 70</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 5-10% errors: 50</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.critical }}>✗ &gt;10% errors: Linear decay to 0</Text>
            </Flex>
            <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              Source: Google SRE Handbook Ch. 4 "Service Level Objectives"
            </Text>
          </Flex>
        </Surface>

        {/* Efficiency Score */}
        <Surface style={{ padding: 12, borderLeft: `3px solid ${Colors.Charts.Categorical.Color02.Default}` }}>
          <Flex flexDirection="column" gap={6}>
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontWeight: 600, fontSize: 13 }}>💰 Efficiency Score (30%)</Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>Based on LLM context window utilization</Text>
            </Flex>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Measures token efficiency against model context limits. Optimal usage is 10-25% of context window 
              (enough context without waste). Thresholds based on GPT-4 128K / Claude 200K windows.
            </Text>
            <Flex flexDirection="column" gap={2} style={{ marginTop: 4, padding: '8px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ &lt;4K tokens (optimal): 100</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ 4-8K tokens (efficient): 85</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 8-16K tokens (moderate): 70</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 16-32K tokens (high): 50</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.critical }}>✗ &gt;32K tokens (wasteful): 30</Text>
            </Flex>
            <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              Source: OpenAI "GPT-4 Best Practices", Anthropic "Prompt Engineering Guide"
            </Text>
          </Flex>
        </Surface>

        {/* Latency Score */}
        <Surface style={{ padding: 12, borderLeft: `3px solid ${Colors.Charts.Categorical.Color03.Default}` }}>
          <Flex flexDirection="column" gap={6}>
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontWeight: 600, fontSize: 13 }}>⚡ Latency Score (25%)</Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>Based on Apdex methodology</Text>
            </Flex>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Uses Apdex (Application Performance Index) with T=10s threshold for AI agents. 
              Apdex formula: (Satisfied + Tolerating×0.5) / Total. AI workloads accept higher latency than web apps.
            </Text>
            <Flex flexDirection="column" gap={2} style={{ marginTop: 4, padding: '8px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ &lt;10s (satisfied): 100</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ 10-20s (tolerating): 75</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 20-40s (frustrating): 50</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.critical }}>✗ &gt;40s (frustrated): 25</Text>
            </Flex>
            <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              Source: Apdex Alliance Standard, adapted for AI workloads (T=10s vs T=4s for web)
            </Text>
          </Flex>
        </Surface>

        {/* Retry Score */}
        <Surface style={{ padding: 12, borderLeft: `3px solid ${Colors.Charts.Categorical.Color01.Default}` }}>
          <Flex flexDirection="column" gap={6}>
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontWeight: 600, fontSize: 13 }}>🔄 Retry Score (15%)</Text>
              <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', fontStyle: 'italic' }}>Based on distributed systems retry patterns</Text>
            </Flex>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Measures retry efficiency. AWS and GCP recommend max 3 retries with exponential backoff. 
              Score penalizes excessive retries which indicate unstable dependencies or poor error handling.
            </Text>
            <Flex flexDirection="column" gap={2} style={{ marginTop: 4, padding: '8px', background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 4 }}>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ 1-2 spans/trace (normal): 100</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.healthy }}>✓ 3 spans/trace (acceptable): 85</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.warning }}>⚠ 4-5 spans/trace (elevated): 60</Text>
              <Text textStyle="small" style={{ color: STATUS_COLORS.critical }}>✗ &gt;5 spans/trace (retry storm): 30</Text>
            </Flex>
            <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              Source: AWS Well-Architected Framework, GCP Retry Guidelines
            </Text>
          </Flex>
        </Surface>
      </Flex>

      <Surface style={{ padding: 12, background: 'var(--dt-colors-background-container-neutral-subdued)', borderRadius: 6 }}>
        <Flex flexDirection="column" gap={6}>
          <Text style={{ fontWeight: 600, fontSize: 13 }}>Score Interpretation</Text>
          <Flex gap={24}>
            <Flex alignItems="center" gap={6}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLORS.healthy }} />
              <Text textStyle="small">75-100: Production Ready</Text>
            </Flex>
            <Flex alignItems="center" gap={6}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLORS.warning }} />
              <Text textStyle="small">50-74: Needs Attention</Text>
            </Flex>
            <Flex alignItems="center" gap={6}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLORS.critical }} />
              <Text textStyle="small">0-49: Action Required</Text>
            </Flex>
          </Flex>
        </Flex>
      </Surface>
    </Flex>
  </Modal>
);

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
        <Tooltip text={`Reliability: ${Math.round(score.errorScore)} | Efficiency: ${Math.round(score.efficiencyScore)} | Latency: ${Math.round(score.latencyScore)} | Retry: ${Math.round(score.retryScore)}`}>
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
  const [showMethodology, setShowMethodology] = useState(false);

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
            <Tooltip text="Click to see how this score is calculated">
              <Flex
                alignItems="center"
                justifyContent="center"
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  border: `3px solid ${avgColor}`, background: `${avgColor}10`,
                  cursor: 'pointer',
                }}
                onClick={() => setShowMethodology(true)}
              >
                <Text style={{ fontSize: 22, fontWeight: 700, color: avgColor, lineHeight: 1 }}>{Math.round(avgScore)}</Text>
              </Flex>
            </Tooltip>
            <Flex flexDirection="column" gap={2}>
              <Flex alignItems="center" gap={8}>
                <Heading level={4}>Agent Optimization Advisor</Heading>
                <Button 
                  variant="default" 
                  onClick={() => setShowMethodology(true)}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  <HelpIcon style={{ width: 12, height: 12 }} />
                  <span style={{ marginLeft: 4 }}>How is this calculated?</span>
                </Button>
              </Flex>
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

      {/* Scoring Methodology Modal */}
      <ScoringMethodologyModal open={showMethodology} onClose={() => setShowMethodology(false)} />
    </Surface>
  );
};

export default OptimizationAdvisor;
