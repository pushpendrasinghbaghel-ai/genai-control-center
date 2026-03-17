// GenAI Control Center — Security Audit Trail Page
// Phase 2: Real-time security monitoring, incident management, compliance audit

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { DataTable } from '@dynatrace/strato-components/tables';
import {
  RefreshIcon, WarningIcon, CriticalIcon, CheckmarkIcon,
  HelpIcon, LockIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useSecurityAutoResponse } from '../hooks/useSecurityAutoResponse';

const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

const severityColor = (sev: string) => {
  switch (sev) {
    case 'critical': return STATUS_COLORS.critical;
    case 'high': return '#ff5722';
    case 'medium': return STATUS_COLORS.warning;
    default: return STATUS_COLORS.neutral;
  }
};

const typeLabel = (type: string) => {
  const labels: Record<string, string> = {
    pii_leak: '🔓 PII Leak',
    prompt_injection: '💉 Prompt Injection',
    jailbreak: '🔓 Jailbreak',
    hallucination: '🌫️ Hallucination',
    data_exfiltration: '📤 Data Exfiltration',
    policy_violation: '📋 Policy Violation',
  };
  return labels[type] || type;
};

export const SecurityAuditTrail: React.FC = () => {
  const {
    events,
    incidents,
    summary,
    riskScores,
    loading,
    refetch,
    updateIncidentStatus,
  } = useSecurityAutoResponse();

  const [selectedTab, setSelectedTab] = useState<'overview' | 'incidents' | 'events' | 'risk'>('overview');

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <LockIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Security Audit Trail</TitleBar.Title>
        <TitleBar.Subtitle>Real-time security monitoring, auto-response & compliance audit</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button variant="default" onClick={refetch}>
            <RefreshIcon /> Refresh
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Summary Cards */}
      <Flex gap={16}>
        <Surface style={{ flex: 1, padding: 16, borderLeft: `4px solid ${summary && summary.criticalEvents > 0 ? STATUS_COLORS.critical : STATUS_COLORS.good}` }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Security Events (24h)</Text>
            <Heading level={2} style={{ color: summary && summary.totalEvents > 0 ? STATUS_COLORS.warning : STATUS_COLORS.good }}>
              {loading ? '…' : summary?.totalEvents || 0}
            </Heading>
            <Flex gap={8}>
              {summary && summary.criticalEvents > 0 && (
                <Text textStyle="small" style={{ color: STATUS_COLORS.critical, fontWeight: 600 }}>
                  {summary.criticalEvents} critical
                </Text>
              )}
              {summary && summary.highEvents > 0 && (
                <Text textStyle="small" style={{ color: '#ff5722', fontWeight: 600 }}>
                  {summary.highEvents} high
                </Text>
              )}
            </Flex>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16, borderLeft: `4px solid ${STATUS_COLORS.warning}` }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Open Incidents</Text>
            <Heading level={2}>{loading ? '…' : summary?.openIncidents || 0}</Heading>
            <Text textStyle="small">{summary?.mitigatedIncidents || 0} mitigated</Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16, borderLeft: `4px solid ${STATUS_COLORS.neutral}` }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Auto-Responses</Text>
            <Heading level={2}>{loading ? '…' : summary?.autoResponsesTriggered || 0}</Heading>
            <Text textStyle="small">Autonomous actions triggered</Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16, borderLeft: `4px solid ${STATUS_COLORS.neutral}` }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Affected Services</Text>
            <Heading level={2}>{loading ? '…' : summary?.affectedServices || 0}</Heading>
            <Flex gap={8}>
              <Text textStyle="small">PII: {summary?.piiLeakCount || 0}</Text>
              <Text textStyle="small">Injection: {summary?.injectionCount || 0}</Text>
            </Flex>
          </Flex>
        </Surface>
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        {(['overview', 'incidents', 'events', 'risk'] as const).map(tab => (
          <Button key={tab} variant={selectedTab === tab ? 'emphasized' : 'default'} onClick={() => setSelectedTab(tab)}>
            {tab === 'overview' ? 'Overview' : tab === 'incidents' ? `Incidents (${incidents.length})` : tab === 'events' ? `Events (${events.length})` : 'Risk Scores'}
          </Button>
        ))}
      </Flex>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <Flex flexDirection="column" gap={16}>
          {/* Risk Distribution */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Text style={{ fontWeight: 600 }}>Security Risk Distribution</Text>
              {summary ? (
                <Flex gap={16}>
                  {[
                    { label: 'Critical', count: summary.criticalEvents, color: STATUS_COLORS.critical },
                    { label: 'High', count: summary.highEvents, color: '#ff5722' },
                    { label: 'Medium', count: summary.mediumEvents, color: STATUS_COLORS.warning },
                    { label: 'Low', count: summary.lowEvents, color: STATUS_COLORS.neutral },
                  ].map(item => (
                    <Flex key={item.label} flexDirection="column" gap={4} style={{ flex: 1 }}>
                      <Flex alignItems="center" gap={6}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
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

          {/* Recent Critical Events */}
          <Surface style={{ padding: 16 }}>
            <Flex flexDirection="column" gap={12}>
              <Text style={{ fontWeight: 600 }}>Recent Critical/High Events</Text>
              {events.filter(e => e.severity === 'critical' || e.severity === 'high').slice(0, 5).map(e => (
                <Flex key={e.id} alignItems="center" gap={12} style={{ padding: '8px 0', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
                  {e.severity === 'critical' ? (
                    <CriticalIcon style={{ width: 14, height: 14, color: STATUS_COLORS.critical }} />
                  ) : (
                    <WarningIcon style={{ width: 14, height: 14, color: '#ff5722' }} />
                  )}
                  <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
                    <Text textStyle="small" style={{ fontWeight: 600 }}>{typeLabel(e.type)}</Text>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      {e.serviceName} • {e.model} • {e.detectionMethod}
                    </Text>
                  </Flex>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </Text>
                </Flex>
              ))}
              {events.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0 && (
                <Flex alignItems="center" gap={8} style={{ padding: 12 }}>
                  <CheckmarkIcon style={{ width: 14, height: 14, color: STATUS_COLORS.good }} />
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No critical or high severity events detected. Environment is secure.</Text>
                </Flex>
              )}
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Incidents Tab */}
      {selectedTab === 'incidents' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Text style={{ fontWeight: 600 }}>Security Incidents</Text>
            {incidents.length === 0 ? (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No active incidents.</Text>
            ) : (
              incidents.map(inc => (
                <Surface key={inc.id} style={{ padding: 12, borderLeft: `3px solid ${severityColor(inc.severity)}` }}>
                  <Flex flexDirection="column" gap={8}>
                    <Flex alignItems="center" justifyContent="space-between">
                      <Flex alignItems="center" gap={8}>
                        <Surface style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: severityColor(inc.severity) + '22' }}>
                          <Text textStyle="small" style={{ color: severityColor(inc.severity), fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
                            {inc.severity}
                          </Text>
                        </Surface>
                        <Text style={{ fontWeight: 600 }}>{inc.title}</Text>
                      </Flex>
                      <Flex gap={4}>
                        {inc.status !== 'closed' && (
                          <>
                            <Button variant="default" onClick={() => updateIncidentStatus(inc.id, 'mitigated')}>
                              Mitigate
                            </Button>
                            <Button variant="default" onClick={() => updateIncidentStatus(inc.id, 'closed')}>
                              Close
                            </Button>
                          </>
                        )}
                      </Flex>
                    </Flex>
                    <Flex gap={16}>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Service: {inc.serviceName}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Traces: {inc.affectedTraces}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Status: {inc.status}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        Created: {new Date(inc.createdAt).toLocaleString()}
                      </Text>
                    </Flex>
                    {inc.autoResponseActions.length > 0 && (
                      <Flex flexDirection="column" gap={4}>
                        <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Auto-Response Actions:</Text>
                        {inc.autoResponseActions.map(a => (
                          <Flex key={a.id} alignItems="center" gap={6}>
                            <CheckmarkIcon style={{ width: 10, height: 10, color: a.status === 'executed' ? STATUS_COLORS.good : STATUS_COLORS.warning }} />
                            <Text textStyle="small">{a.details}</Text>
                          </Flex>
                        ))}
                      </Flex>
                    )}
                    {/* Audit Trail */}
                    <Flex flexDirection="column" gap={4}>
                      <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>Audit Trail:</Text>
                      {inc.auditTrail.map((entry, i) => (
                        <Flex key={i} alignItems="center" gap={6}>
                          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, width: 70, fontSize: 10 }}>
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </Text>
                          <Text textStyle="small" style={{ fontSize: 10, backgroundColor: 'rgba(99,102,241,0.1)', padding: '1px 4px', borderRadius: 2 }}>
                            {entry.actor}
                          </Text>
                          <Text textStyle="small">{entry.action}</Text>
                        </Flex>
                      ))}
                    </Flex>
                  </Flex>
                </Surface>
              ))
            )}
          </Flex>
        </Surface>
      )}

      {/* Events Tab */}
      {selectedTab === 'events' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontWeight: 600 }}>Security Events (Last 24h)</Text>
            {events.length === 0 ? (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No security events detected.</Text>
            ) : (
              events.slice(0, 50).map(e => (
                <Flex key={e.id} alignItems="center" gap={8} style={{ padding: '6px 0', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
                  <Surface style={{ padding: '2px 5px', borderRadius: 3, backgroundColor: severityColor(e.severity) + '22', minWidth: 52, textAlign: 'center' as const }}>
                    <Text textStyle="small" style={{ color: severityColor(e.severity), fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>
                      {e.severity}
                    </Text>
                  </Surface>
                  <Text textStyle="small" style={{ width: 120 }}>{typeLabel(e.type)}</Text>
                  <Text textStyle="small" style={{ flex: 1, color: Colors.Text.Neutral.Subdued }}>{e.serviceName}</Text>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{e.model}</Text>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, width: 70 }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </Text>
                </Flex>
              ))
            )}
          </Flex>
        </Surface>
      )}

      {/* Risk Scores Tab */}
      {selectedTab === 'risk' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Text style={{ fontWeight: 600 }}>Service Risk Scores</Text>
            {riskScores.length === 0 ? (
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>No risk data available.</Text>
            ) : (
              riskScores.map((rs, i) => (
                <Flex key={i} alignItems="center" gap={12} style={{ padding: '8px 0', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
                  <Text style={{ flex: 1, fontWeight: 600 }}>{rs.serviceName}</Text>
                  <Text textStyle="small" style={{ width: 80 }}>{rs.totalPrompts} prompts</Text>
                  <Text textStyle="small" style={{ width: 80, color: rs.riskRate > 10 ? STATUS_COLORS.critical : rs.riskRate > 5 ? STATUS_COLORS.warning : STATUS_COLORS.good }}>
                    {rs.riskRate.toFixed(1)}% risky
                  </Text>
                  <ProgressBar value={Math.min(rs.riskRate, 100)} style={{ width: 100 }} />
                  <Text textStyle="small" style={{ width: 100, color: Colors.Text.Neutral.Subdued }}>{rs.topRiskType || 'none'}</Text>
                </Flex>
              ))
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default SecurityAuditTrail;
