// GenAI Control Center — Adversarial Prompt Threat Intelligence Page
// Davis AI-powered detection of sophisticated prompt attacks that bypass regex

import React, { useState, useMemo, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import {
  RefreshIcon, WarningIcon, CriticalIcon, CheckmarkIcon,
  HelpIcon, LockIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { formatDateTime } from '../utils/formatting';
import {
  useAdversarialThreatDetection,
  ThreatFinding,
  ThreatTechnique,
} from '../hooks/useAdversarialThreatDetection';

// ============================================
// Constants
// ============================================

const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: STATUS_COLORS.critical,
  high: 'var(--dt-colors-charts-status-critical-default)',
  medium: STATUS_COLORS.warning,
  low: STATUS_COLORS.neutral,
};

const TECHNIQUE_LABELS: Record<ThreatTechnique, string> = {
  authority_impersonation: 'Authority Impersonation',
  multi_stage_extraction: 'Multi-Stage Extraction',
  context_manipulation: 'Context Manipulation',
  obfuscated_pii_harvesting: 'Obfuscated PII Harvesting',
  roleplay_escalation: 'Roleplay Escalation',
  indirect_injection: 'Indirect Injection',
  goal_hijacking: 'Goal Hijacking',
  token_smuggling: 'Token Smuggling',
  safe: 'Safe',
};

const TECHNIQUE_DESCRIPTIONS: Record<ThreatTechnique, string> = {
  authority_impersonation: 'User claims elevated privileges to override safety controls',
  multi_stage_extraction: 'Gradual context-building across prompts to extract sensitive info',
  context_manipulation: 'Instructions embedded within seemingly innocent data payloads',
  obfuscated_pii_harvesting: 'Requesting PII in encoded, reversed, or indirect forms',
  roleplay_escalation: 'Fiction/roleplay framing to bypass safety guidelines',
  indirect_injection: 'Malicious instructions smuggled through external data or tools',
  goal_hijacking: 'Subtly redirecting the model away from its intended purpose',
  token_smuggling: 'Unicode tricks, homoglyphs, or invisible character manipulation',
  safe: 'No adversarial technique detected',
};

const DAVIS_STATUS_LABELS: Record<string, string> = {
  idle: 'Waiting',
  running: 'Analyzing prompts...',
  complete: 'Analysis complete',
  error: 'Analysis failed',
};

// ============================================
// Sub-components
// ============================================

function SummaryCard({ label, value, sublabel, borderColor, valueColor }: {
  label: string;
  value: string | number;
  sublabel?: string;
  borderColor: string;
  valueColor?: string;
}) {
  return (
    <Surface style={{ flex: 1, padding: 16, borderLeft: `4px solid ${borderColor}` }}>
      <Flex flexDirection="column" gap={8}>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{label}</Text>
        <Heading level={2} style={valueColor ? { color: valueColor } : undefined}>{value}</Heading>
        {sublabel && <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{sublabel}</Text>}
      </Flex>
    </Surface>
  );
}

function ThreatCard({ finding, onSelect }: { finding: ThreatFinding; onSelect: () => void }) {
  const severityColor = SEVERITY_COLORS[finding.severity] || STATUS_COLORS.neutral;
  return (
    <Surface
      style={{ padding: 12, borderLeft: `3px solid ${severityColor}`, cursor: 'pointer' }}
      onClick={onSelect}
    >
      <Flex flexDirection="column" gap={8}>
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={8}>
            <Text style={{
              padding: '2px 8px', borderRadius: 4,
              backgroundColor: severityColor + '22',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
              color: severityColor,
            }}>
              {finding.severity}
            </Text>
            <Text style={{ fontWeight: 600 }}>{TECHNIQUE_LABELS[finding.technique]}</Text>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Risk: {finding.riskScore}/100
            </Text>
          </Flex>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            {formatDateTime(finding.timestamp)}
          </Text>
        </Flex>

        <Text textStyle="small" style={{ fontFamily: 'monospace', opacity: 0.8 }}>
          {finding.promptPreview}
        </Text>

        <Flex gap={16}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Service: {finding.serviceName}
          </Text>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Model: {finding.model}
          </Text>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Confidence: {(finding.confidence * 100).toFixed(0)}%
          </Text>
          {finding.behavioralContext.isAnomalousTime && (
            <Text textStyle="small" style={{ color: STATUS_COLORS.warning, fontWeight: 600 }}>
              Anomalous Time
            </Text>
          )}
          {finding.behavioralContext.velocitySpike && (
            <Text textStyle="small" style={{ color: STATUS_COLORS.warning, fontWeight: 600 }}>
              Velocity Spike
            </Text>
          )}
        </Flex>
      </Flex>
    </Surface>
  );
}

function ThreatDetailPanel({ finding, onClose }: { finding: ThreatFinding; onClose: () => void }) {
  const severityColor = SEVERITY_COLORS[finding.severity] || STATUS_COLORS.neutral;

  return (
    <Surface style={{ padding: 20 }}>
      <Flex flexDirection="column" gap={16}>
        {/* Header */}
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={12}>
            {finding.severity === 'critical' ? (
              <CriticalIcon style={{ width: 20, height: 20, color: severityColor }} />
            ) : (
              <WarningIcon style={{ width: 20, height: 20, color: severityColor }} />
            )}
            <Heading level={4}>{TECHNIQUE_LABELS[finding.technique]}</Heading>
            <Text style={{
              padding: '2px 10px', borderRadius: 12,
              backgroundColor: severityColor, color: 'white',
              fontSize: 12, fontWeight: 600,
            }}>
              Risk: {finding.riskScore}/100
            </Text>
          </Flex>
          <Button variant="default" onClick={onClose}>Close</Button>
        </Flex>

        {/* Technique description */}
        <Surface style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <Text textStyle="small">{TECHNIQUE_DESCRIPTIONS[finding.technique]}</Text>
        </Surface>

        {/* Davis Explanation */}
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600 }}>Davis AI Analysis</Text>
          <Text textStyle="small">{finding.explanation}</Text>
        </Flex>

        {/* Evidence Chain */}
        {finding.evidenceChain.length > 0 && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontWeight: 600 }}>Evidence Chain</Text>
            {finding.evidenceChain.map((evidence, i) => (
              <Flex key={i} alignItems="flex-start" gap={8}>
                <Text textStyle="small" style={{ color: severityColor, fontWeight: 600, minWidth: 20 }}>
                  {i + 1}.
                </Text>
                <Text textStyle="small">{evidence}</Text>
              </Flex>
            ))}
          </Flex>
        )}

        {/* Behavioral Context */}
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600 }}>Behavioral Context</Text>
          <Flex gap={16}>
            <Flex alignItems="center" gap={4}>
              {finding.behavioralContext.isAnomalousTime ? (
                <WarningIcon style={{ width: 12, height: 12, color: STATUS_COLORS.warning }} />
              ) : (
                <CheckmarkIcon style={{ width: 12, height: 12, color: STATUS_COLORS.good }} />
              )}
              <Text textStyle="small">
                Time-of-day: {finding.behavioralContext.isAnomalousTime ? 'Anomalous' : 'Normal'}
              </Text>
            </Flex>
            <Flex alignItems="center" gap={4}>
              {finding.behavioralContext.velocitySpike ? (
                <WarningIcon style={{ width: 12, height: 12, color: STATUS_COLORS.warning }} />
              ) : (
                <CheckmarkIcon style={{ width: 12, height: 12, color: STATUS_COLORS.good }} />
              )}
              <Text textStyle="small">
                Request velocity: {finding.behavioralContext.velocitySpike ? 'Spike detected' : 'Normal'}
              </Text>
            </Flex>
          </Flex>
        </Flex>

        {/* Metadata */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontWeight: 600 }}>Details</Text>
          <Flex gap={24} flexWrap="wrap">
            <Text textStyle="small"><strong>Service:</strong> {finding.serviceName}</Text>
            <Text textStyle="small"><strong>Provider:</strong> {finding.provider}</Text>
            <Text textStyle="small"><strong>Model:</strong> {finding.model}</Text>
            <Text textStyle="small"><strong>Confidence:</strong> {(finding.confidence * 100).toFixed(0)}%</Text>
            <Text textStyle="small"><strong>Detected:</strong> {formatDateTime(finding.timestamp)}</Text>
            {finding.traceId && (
              <Text textStyle="small"><strong>Trace:</strong> {finding.traceId.substring(0, 16)}...</Text>
            )}
          </Flex>
        </Flex>

        {/* Prompt Preview */}
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600 }}>Prompt (preview)</Text>
          <Surface style={{ padding: 12, fontFamily: 'monospace', fontSize: 12, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const }}>
            {finding.promptPreview}
          </Surface>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Main Page
// ============================================

export const ThreatIntelligence: React.FC = () => {
  const {
    findings,
    summary,
    trends,
    loading,
    error,
    davisAnalysisStatus,
    refetch,
  } = useAdversarialThreatDetection();

  const [selectedTab, setSelectedTab] = useState<'findings' | 'trends' | 'overview'>('overview');
  const [selectedFinding, setSelectedFinding] = useState<ThreatFinding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  // R2-#4: Reset selected finding when findings refresh (prevents stale detail panel)
  useEffect(() => { setSelectedFinding(null); }, [findings]);

  const filteredFindings = useMemo(() => {
    if (!severityFilter) return findings;
    return findings.filter(f => f.severity === severityFilter);
  }, [findings, severityFilter]);

  const hasThreats = summary && summary.threatsDetected > 0;

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Title */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <LockIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Adversarial Prompt Threat Intelligence</TitleBar.Title>
        <TitleBar.Subtitle>
          Davis AI semantic analysis — detecting sophisticated attacks regex cannot catch
          {davisAnalysisStatus === 'running' && ' • Analyzing...'}
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            {davisAnalysisStatus !== 'idle' && (
              <Tooltip text={DAVIS_STATUS_LABELS[davisAnalysisStatus]}>
                <Text textStyle="small" style={{
                  color: davisAnalysisStatus === 'complete' ? STATUS_COLORS.good
                    : davisAnalysisStatus === 'error' ? STATUS_COLORS.critical
                    : STATUS_COLORS.warning,
                  fontWeight: 600,
                }}>
                  {DAVIS_STATUS_LABELS[davisAnalysisStatus]}
                </Text>
              </Tooltip>
            )}
            <Button variant="default" onClick={refetch} disabled={loading}>
              <RefreshIcon /> Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Error state */}
      {error && (
        <Surface style={{ padding: 16, borderLeft: `4px solid ${STATUS_COLORS.critical}` }}>
          <Flex alignItems="center" gap={8}>
            <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.critical }} />
            <Text textStyle="small" style={{ color: STATUS_COLORS.critical }}>
              {error.message}
            </Text>
            <Button variant="default" onClick={refetch}>Retry</Button>
          </Flex>
        </Surface>
      )}

      {/* Summary Cards */}
      <Flex gap={16}>
        <SummaryCard
          label="Prompts Scanned (24h)"
          value={loading ? '…' : summary?.totalScanned || 0}
          sublabel={summary?.dqlError ? 'DQL query error' : undefined}
          borderColor={summary?.dqlError ? STATUS_COLORS.critical : STATUS_COLORS.neutral}
        />
        <SummaryCard
          label="Threats Detected"
          value={loading ? '…' : summary?.threatsDetected || 0}
          sublabel={summary ? `${summary.detectionRate.toFixed(1)}% detection rate` : undefined}
          borderColor={hasThreats ? STATUS_COLORS.critical : STATUS_COLORS.good}
          valueColor={hasThreats ? STATUS_COLORS.critical : STATUS_COLORS.good}
        />
        <SummaryCard
          label="Critical / High"
          value={loading ? '…' : `${summary?.criticalCount || 0} / ${summary?.highCount || 0}`}
          borderColor={(summary?.criticalCount || 0) > 0 ? STATUS_COLORS.critical : STATUS_COLORS.neutral}
        />
        <SummaryCard
          label="Affected Services"
          value={loading ? '…' : summary?.affectedServices || 0}
          sublabel={summary?.topTechnique ? `Top: ${TECHNIQUE_LABELS[summary.topTechnique]}` : undefined}
          borderColor={STATUS_COLORS.neutral}
        />
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        {(['overview', 'findings', 'trends'] as const).map(tab => (
          <Button key={tab} variant={selectedTab === tab ? 'emphasized' : 'default'} onClick={() => setSelectedTab(tab)}>
            {tab === 'overview' ? 'Overview' : tab === 'findings' ? `Findings (${findings.length})` : `Technique Trends (${trends.length})`}
          </Button>
        ))}
      </Flex>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <Flex flexDirection="column" gap={16}>
          {/* Risk Distribution */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <Text style={{ fontWeight: 600 }}>Threat Severity Distribution</Text>
                <Tooltip text="AI-classified adversarial prompt attacks grouped by Davis-assigned severity">
                  <HelpIcon style={{ width: 14, height: 14 }} />
                </Tooltip>
              </Flex>
              {summary ? (
                <Flex gap={16}>
                  {[
                    { label: 'Critical', count: summary.criticalCount, color: SEVERITY_COLORS.critical },
                    { label: 'High', count: summary.highCount, color: SEVERITY_COLORS.high },
                    { label: 'Medium', count: summary.mediumCount, color: SEVERITY_COLORS.medium },
                    { label: 'Low', count: summary.lowCount, color: SEVERITY_COLORS.low },
                  ].map(item => (
                    <Flex key={item.label} flexDirection="column" gap={4} style={{ flex: 1 }}>
                      <Flex alignItems="center" gap={6}>
                        <Flex style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                        <Text textStyle="small">{item.label}</Text>
                      </Flex>
                      <Heading level={3}>{item.count}</Heading>
                    </Flex>
                  ))}
                </Flex>
              ) : (
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Loading…</Text>
              )}
            </Flex>
          </Surface>

          {/* Top Threats */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Text style={{ fontWeight: 600 }}>Highest Risk Findings</Text>
              {findings.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 5).map(f => (
                <ThreatCard key={f.id} finding={f} onSelect={() => setSelectedFinding(f)} />
              ))}
              {findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0 && (
                <Flex alignItems="center" gap={8} style={{ padding: 12 }}>
                  <CheckmarkIcon style={{ width: 14, height: 14, color: STATUS_COLORS.good }} />
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    {loading ? 'Analyzing prompts with Davis AI...' : 'No critical or high severity adversarial techniques detected.'}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Surface>

          {/* How it works */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Text style={{ fontWeight: 600 }}>How Adversarial Threat Detection Works</Text>
              <Flex flexDirection="column" gap={8}>
                {[
                  { step: '1', title: 'Collect', desc: 'Fetch gen_ai.* spans from Grail with prompt content + behavioral context (hourly distribution, velocity)' },
                  { step: '2', title: 'Analyze', desc: 'Send prompt batches to Davis AI for semantic adversarial technique classification — catches what regex misses' },
                  { step: '3', title: 'Correlate', desc: 'Combine Davis classification with behavioral signals (anomalous time, velocity spikes) for enriched findings' },
                ].map(item => (
                  <Flex key={item.step} alignItems="flex-start" gap={12}>
                    <Text style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: '50%',
                      backgroundColor: STATUS_COLORS.neutral + '33',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {item.step}
                    </Text>
                    <Flex flexDirection="column" gap={2}>
                      <Text textStyle="small" style={{ fontWeight: 600 }}>{item.title}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{item.desc}</Text>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Findings Tab */}
      {selectedTab === 'findings' && (
        <Flex flexDirection="column" gap={12}>
          {/* Severity filter buttons */}
          <Flex gap={8}>
            <Button variant={severityFilter === null ? 'emphasized' : 'default'} onClick={() => setSeverityFilter(null)}>
              All ({findings.length})
            </Button>
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
              const count = findings.filter(f => f.severity === sev).length;
              return (
                <Button
                  key={sev}
                  variant={severityFilter === sev ? 'emphasized' : 'default'}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)} ({count})
                </Button>
              );
            })}
          </Flex>

          {/* Detail panel */}
          {selectedFinding && (
            <ThreatDetailPanel finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
          )}

          {/* Finding cards */}
          {filteredFindings.length === 0 ? (
            <Surface style={{ padding: 24, textAlign: 'center' as const }}>
              <Flex flexDirection="column" alignItems="center" gap={8}>
                <CheckmarkIcon style={{ width: 24, height: 24, color: STATUS_COLORS.good }} />
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                  {loading ? 'Analyzing prompts with Davis AI...' : 'No adversarial threats detected in the current window.'}
                </Text>
              </Flex>
            </Surface>
          ) : (
            filteredFindings.map(f => (
              <ThreatCard key={f.id} finding={f} onSelect={() => setSelectedFinding(f)} />
            ))
          )}
        </Flex>
      )}

      {/* Trends Tab */}
      {selectedTab === 'trends' && (
        <Flex flexDirection="column" gap={12}>
          {trends.length === 0 ? (
            <Surface style={{ padding: 24, textAlign: 'center' as const }}>
              <Flex flexDirection="column" alignItems="center" gap={8}>
                <CheckmarkIcon style={{ width: 24, height: 24, color: STATUS_COLORS.good }} />
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                  {loading ? 'Analyzing...' : 'No adversarial technique trends detected.'}
                </Text>
              </Flex>
            </Surface>
          ) : (
            trends.map(trend => (
              <Surface key={trend.technique} style={{ padding: 16 }}>
                <Flex flexDirection="column" gap={12}>
                  <Flex alignItems="center" justifyContent="space-between">
                    <Flex alignItems="center" gap={8}>
                      <WarningIcon style={{ width: 14, height: 14, color: trend.avgRiskScore >= 70 ? STATUS_COLORS.critical : STATUS_COLORS.warning }} />
                      <Text style={{ fontWeight: 600 }}>{TECHNIQUE_LABELS[trend.technique]}</Text>
                    </Flex>
                    <Flex gap={16}>
                      <Text textStyle="small" style={{ fontWeight: 600 }}>{trend.count} occurrences</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        Avg risk: {trend.avgRiskScore.toFixed(0)}/100
                      </Text>
                    </Flex>
                  </Flex>

                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    {TECHNIQUE_DESCRIPTIONS[trend.technique]}
                  </Text>

                  <Flex gap={16}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      First seen: {formatDateTime(trend.firstSeen)}
                    </Text>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      Last seen: {formatDateTime(trend.lastSeen)}
                    </Text>
                  </Flex>
                </Flex>
              </Surface>
            ))
          )}
        </Flex>
      )}
    </Flex>
  );
};
