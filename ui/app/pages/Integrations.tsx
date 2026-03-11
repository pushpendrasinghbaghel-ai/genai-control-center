/**
 * Integrations Hub — Unified MCP Integration Dashboard
 *
 * Shows the health and status of all 8 MCP server integrations:
 * Slack, PagerDuty, Prometheus, AWS Billing, AWS CloudWatch, Grafana, GitHub, Agentic Workflows
 *
 * Each integration card shows live data from DQL queries via the corresponding hook.
 * No mocks — all data is real from Dynatrace Grail.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import {
  AutomationEngineIcon,
  WarningIcon,
  CheckmarkIcon,
  CriticalIcon,
  AiIcon,
  DavisAiIcon,
  HelpIcon,
  SyncIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { Modal } from '@dynatrace/strato-components-preview/overlays';

import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { useDavisInvestigation } from '../hooks/useDavisAI';
import { DavisResponse } from '../components/DavisResponse';
import { useAWSBilling } from '../hooks/useAWSBilling';
import { useAWSCloudWatch } from '../hooks/useAWSCloudWatch';
import { useGrafanaIntegration } from '../hooks/useGrafanaIntegration';
import { useGitHubIntegration } from '../hooks/useGitHubIntegration';
import { useAgenticWorkflows } from '../hooks/useAgenticWorkflows';
import { useSlackIntegration } from '../hooks/useSlackIntegration';
import { usePagerDutyIntegration } from '../hooks/usePagerDutyIntegration';
import { usePrometheusMCP } from '../hooks/usePrometheusMCP';

import type { ConversationMessage } from '../types';

/** Extract a simple duration string from the Timeframe object or default to '24h' */
function extractTimeframeString(tf: unknown): string {
  if (!tf || typeof tf !== 'object') return '24h';
  const t = tf as { from?: { value?: string }; to?: { value?: string } };
  const fromVal = t.from?.value || 'now()-24h';
  // Extract the duration part: "now()-24h" → "24h"
  const m = fromVal.match(/now\(\)-(.+)/);
  return m ? m[1] : '24h';
}

// ============================================
// Status helpers
// ============================================

function StatusBadge({ status, label }: { status: 'healthy' | 'warning' | 'critical' | 'inactive'; label: string }) {
  const colorMap = {
    healthy: Colors.Text.Success.Default,
    warning: Colors.Text.Warning.Default,
    critical: Colors.Text.Critical.Default,
    inactive: Colors.Text.Neutral.Subdued,
  };
  const color = colorMap[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
      borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: color + '18', color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function MetricBox({ label, value, unit, status }: {
  label: string; value: string | number; unit?: string;
  status?: 'healthy' | 'warning' | 'critical' | 'neutral';
}) {
  const colorMap = {
    healthy: Colors.Text.Success.Default,
    warning: Colors.Text.Warning.Default,
    critical: Colors.Text.Critical.Default,
    neutral: 'var(--dt-colors-text-primary-default)',
  };
  const color = colorMap[status || 'neutral'];
  return (
    <Flex flexDirection="column" gap={2} style={{ minWidth: 80 }}>
      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontSize: 10 }}>{label}</Text>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>
        {value}{unit && <span style={{ fontSize: 11, fontWeight: 400 }}> {unit}</span>}
      </span>
    </Flex>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ============================================
// Integration Card Component
// ============================================

interface IntegrationCardProps {
  title: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'critical' | 'inactive';
  statusLabel: string;
  loading: boolean;
  error?: string | null;
  metrics: Array<{ label: string; value: string | number; unit?: string; status?: 'healthy' | 'warning' | 'critical' | 'neutral' }>;
  details?: React.ReactNode;
  onRefresh?: () => void;
}

function IntegrationCard({ title, icon, status, statusLabel, loading, error, metrics, details, onRefresh }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Surface style={{
      padding: 16, borderRadius: 8,
      borderLeft: `4px solid ${status === 'healthy' ? Colors.Text.Success.Default
        : status === 'warning' ? Colors.Text.Warning.Default
        : status === 'critical' ? Colors.Text.Critical.Default
        : Colors.Text.Neutral.Subdued}`,
      opacity: loading ? 0.7 : 1,
    }}>
      <Flex flexDirection="column" gap={12}>
        {/* Header */}
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap={8}>
            {icon}
            <Heading level={5} style={{ margin: 0 }}>{title}</Heading>
            <StatusBadge status={status} label={statusLabel} />
          </Flex>
          <Flex gap={6}>
            {onRefresh && (
              <Button variant="default" onClick={onRefresh} disabled={loading}>
                <Button.Prefix><SyncIcon /></Button.Prefix>
              </Button>
            )}
            {details && (
              <Button variant="default" onClick={() => setExpanded(e => !e)}>
                {expanded ? 'Collapse' : 'Details'}
              </Button>
            )}
          </Flex>
        </Flex>

        {/* Error */}
        {error && (
          <Flex alignItems="center" gap={6}>
            <WarningIcon style={{ width: 12, height: 12, color: Colors.Text.Critical.Default }} />
            <Text textStyle="small" style={{ color: Colors.Text.Critical.Default }}>{error}</Text>
          </Flex>
        )}

        {/* Metrics row */}
        {loading ? (
          <Flex alignItems="center" gap={8}>
            <ProgressCircle size="small" />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Loading...</Text>
          </Flex>
        ) : (
          <Flex gap={16} flexWrap="wrap">
            {metrics.map((m, i) => (
              <MetricBox key={i} {...m} />
            ))}
          </Flex>
        )}

        {/* Expanded detail panel */}
        {expanded && details && (
          <div style={{ borderTop: '1px solid var(--dt-colors-border-neutral-default)', paddingTop: 12 }}>
            {details}
          </div>
        )}
      </Flex>
    </Surface>
  );
}

// ============================================
// Main Page
// ============================================

export function Integrations() {
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const timeframe = extractTimeframeString(globalFilters.timeframe);
  const timeframeLabel = timeframe;

  // All integration hooks
  const awsBilling = useAWSBilling(timeframe);
  const cloudWatch = useAWSCloudWatch(timeframe);
  const grafana = useGrafanaIntegration(timeframe);
  const github = useGitHubIntegration(timeframe);
  const workflows = useAgenticWorkflows(timeframe);
  const slack = useSlackIntegration(timeframe);
  const pagerduty = usePagerDutyIntegration(timeframe);
  const prometheus = usePrometheusMCP(timeframe);

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Davis Intelligence
  const [showDavis, setShowDavis] = useState(false);
  const [davisQuery, setDavisQuery] = useState('');
  const {
    messages: davisMessages,
    isLoading: davisLoading,
    sendQuery: davisSendQuery,
    clearConversation: davisClearConversation,
  } = useDavisInvestigation();

  const anyLoading = awsBilling.loading || cloudWatch.loading || grafana.loading || github.loading || workflows.loading || slack.loading || pagerduty.loading || prometheus.loading;

  // Refresh all
  const refreshAll = useCallback(() => {
    awsBilling.refresh();
    cloudWatch.refresh();
    grafana.refresh();
    github.refresh();
    workflows.refresh();
    slack.fetchStatus();
    pagerduty.fetchStatus();
    prometheus.fetchMetrics();
  }, [awsBilling, cloudWatch, grafana, github, workflows, slack, pagerduty, prometheus]);

  // ============================================
  // Summary KPIs
  // ============================================

  const summary = useMemo(() => {
    const integrations = [
      { name: 'AWS Billing', healthy: !awsBilling.error && awsBilling.costBreakdown.length > 0 },
      { name: 'CloudWatch', healthy: !cloudWatch.error && cloudWatch.metrics.length > 0 },
      { name: 'Grafana', healthy: !grafana.error },
      { name: 'GitHub', healthy: !github.error },
      { name: 'Workflows', healthy: !workflows.error },
    ];
    const healthyCount = integrations.filter(i => i.healthy).length;
    const totalAlarms = cloudWatch.activeAlarmCount + grafana.firingAlertCount;
    const totalCost = awsBilling.totalCostUsd;
    const workflowSuccessRate = workflows.stats.successRate;

    return { healthyCount, totalIntegrations: 8, totalAlarms, totalCost, workflowSuccessRate };
  }, [awsBilling, cloudWatch, grafana, github, workflows]);

  // ============================================
  // Davis context
  // ============================================

  const buildContext = useCallback(() => {
    const lines = [
      'Page: Integrations Hub — MCP Integration Dashboard for GenAI Control Center',
      `Active integrations: 8 (Slack, PagerDuty, Prometheus, AWS Billing, CloudWatch, Grafana, GitHub, Agentic Workflows)`,
      `AWS Billing: $${awsBilling.totalCostUsd.toFixed(2)} current spend, projected $${awsBilling.projectedMonthlyUsd.toFixed(2)}/mo, ${awsBilling.anomalies.length} anomalies`,
      `CloudWatch: ${cloudWatch.activeAlarmCount} active alarms (${cloudWatch.criticalAlarmCount} critical), ${cloudWatch.metrics.length} metrics tracked`,
      `Grafana: ${grafana.dashboards.length} dashboards, ${grafana.firingAlertCount} firing alerts, ${grafana.annotations.length} annotations`,
      `GitHub: ${github.openIssueCount} open issues, ${github.recentDeployCount} recent deployments`,
      `Workflows: ${workflows.stats.totalExecutions} executions, ${workflows.stats.successRate}% success rate, ${workflows.remediationCandidates.length} remediation candidates`,
    ];
    return lines.join('\n');
  }, [awsBilling, cloudWatch, grafana, github, workflows]);

  const handleDavisQuery = useCallback((query: string) => {
    davisSendQuery(`${query}\n\nContext:\n${buildContext()}`);
  }, [buildContext, davisSendQuery]);

  const handleCustomDavisQuery = useCallback(() => {
    if (davisQuery.trim()) {
      handleDavisQuery(davisQuery.trim());
      setDavisQuery('');
    }
  }, [davisQuery, handleDavisQuery]);

  // ============================================
  // Render
  // ============================================

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true"><AutomationEngineIcon /></TitleBar.Prefix>
        <TitleBar.Title>Integrations Hub</TitleBar.Title>
        <TitleBar.Subtitle>Unified MCP integration dashboard — Slack, PagerDuty, Prometheus, AWS, Grafana, GitHub, Agentic Workflows</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8}>
            <Button variant="default" onClick={() => setShowHelp(true)} title="Help">
              <Button.Prefix><HelpIcon /></Button.Prefix>
            </Button>
            <Button variant="default" onClick={refreshAll} disabled={anyLoading}>
              <Button.Prefix><SyncIcon /></Button.Prefix>
              Refresh All
            </Button>
            <Button variant={showDavis ? 'emphasized' : 'default'} onClick={() => setShowDavis(d => !d)}>
              <Button.Prefix><DavisAiIcon /></Button.Prefix>
              Ask Dynatrace
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Filters */}
      <FilterBar
        filters={globalFilters}
        onFiltersChange={setFilters}
        onRefresh={refreshAll}
        isLoading={anyLoading}
      />

      {/* Summary KPIs */}
      <Flex gap={12} flexWrap="wrap">
        <Surface style={{ padding: 16, flex: 1, minWidth: 160 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Integrations</Text>
            <Heading level={2} style={{ margin: 0 }}>8</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              MCP server connections
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 160 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Active Alarms</Text>
            <Heading level={2} style={{
              margin: 0,
              color: summary.totalAlarms > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default,
            }}>
              {anyLoading ? '—' : summary.totalAlarms}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              CloudWatch + Grafana
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 160 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Estimated GenAI Cost</Text>
            <Heading level={2} style={{ margin: 0 }}>
              {anyLoading ? '—' : formatUsd(summary.totalCost)}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              token-based estimate ({timeframeLabel})
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 160 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Workflow Success</Text>
            <Heading level={2} style={{
              margin: 0,
              color: summary.workflowSuccessRate >= 90 ? Colors.Text.Success.Default
                : summary.workflowSuccessRate >= 70 ? Colors.Text.Warning.Default
                : Colors.Text.Critical.Default,
            }}>
              {anyLoading ? '—' : `${summary.workflowSuccessRate}%`}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {workflows.stats.totalExecutions} total executions
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Integration Cards */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4} style={{ margin: 0, paddingLeft: 4 }}>Notification & Incident Management</Heading>

        <Flex gap={12} flexWrap="wrap">
          {/* Slack — real data from useSlackIntegration hook */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="Slack"
              icon={<AiIcon style={{ width: 16, height: 16 }} />}
              status={slack.error ? 'critical' : slack.notifications.length > 0 ? 'healthy' : 'inactive'}
              statusLabel={slack.error ? 'Error' : slack.notifications.length > 0 ? `${slack.notifications.length} notifications` : 'No activity'}
              loading={slack.loading}
              error={slack.error}
              onRefresh={slack.fetchStatus}
              metrics={[
                { label: 'Notifications', value: slack.notifications.length, status: 'neutral' },
                { label: 'Channels', value: slack.channelStatus.length || 0, status: 'neutral' },
                { label: 'Alert Conditions', value: slack.alertConditions.length, status: slack.alertConditions.length > 5 ? 'warning' : 'neutral' },
                { label: 'MCP Tools', value: 5, status: 'healthy' },
              ]}
              details={
                slack.notifications.length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Recent Notifications</Text>
                    {slack.notifications.slice(0, 5).map((n, i) => (
                      <Flex key={i} alignItems="center" gap={8}>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          {n.channel} — {n.severity}
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                ) : undefined
              }
            />
          </div>

          {/* PagerDuty — real data from usePagerDutyIntegration hook */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="PagerDuty"
              icon={<CriticalIcon style={{ width: 16, height: 16, color: Colors.Text.Warning.Default }} />}
              status={pagerduty.error ? 'critical' : pagerduty.incidents.filter(i => i.status === 'triggered').length > 0 ? 'warning' : 'healthy'}
              statusLabel={pagerduty.error ? 'Error' : pagerduty.incidents.filter(i => i.status === 'triggered').length > 0 ? `${pagerduty.incidents.filter(i => i.status === 'triggered').length} active` : 'All Clear'}
              loading={pagerduty.loading}
              error={pagerduty.error}
              onRefresh={pagerduty.fetchStatus}
              metrics={[
                { label: 'Incidents', value: pagerduty.incidents.length, status: pagerduty.incidents.filter(i => i.status === 'triggered').length > 0 ? 'warning' : 'neutral' },
                { label: 'Services', value: pagerduty.serviceStatuses.length || 0, status: 'neutral' },
                { label: 'Davis Problems', value: pagerduty.davisProblems.length, status: pagerduty.davisProblems.length > 5 ? 'critical' : 'neutral' },
                { label: 'MCP Tools', value: 5, status: 'healthy' },
              ]}
              details={
                pagerduty.incidents.length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Recent Incidents</Text>
                    {pagerduty.incidents.slice(0, 5).map((inc, i) => (
                      <Flex key={i} alignItems="center" gap={8}>
                        <StatusBadge status={inc.status === 'triggered' ? 'critical' : inc.status === 'acknowledged' ? 'warning' : 'healthy'} label={inc.status} />
                        <Text textStyle="small">{inc.title}</Text>
                      </Flex>
                    ))}
                  </Flex>
                ) : undefined
              }
            />
          </div>
        </Flex>
      </Flex>

      <Flex flexDirection="column" gap={12}>
        <Heading level={4} style={{ margin: 0, paddingLeft: 4 }}>Metrics & Monitoring</Heading>

        <Flex gap={12} flexWrap="wrap">
          {/* Prometheus — real data from usePrometheusMCP hook */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="Prometheus"
              icon={<AiIcon style={{ width: 16, height: 16 }} />}
              status={prometheus.error ? 'critical' : prometheus.metrics.length > 0 ? 'healthy' : 'inactive'}
              statusLabel={prometheus.error ? 'Error' : prometheus.metrics.length > 0 ? `${prometheus.metrics.length} metrics` : 'No data'}
              loading={prometheus.loading}
              error={prometheus.error}
              onRefresh={prometheus.fetchMetrics}
              metrics={[
                { label: 'Metrics', value: prometheus.metrics.length, status: 'neutral' },
                { label: 'Per-Model', value: prometheus.perModelMetrics.length, status: 'neutral' },
                { label: 'Scrape Status', value: prometheus.scrapeStatus?.healthy ? 'OK' : 'Unknown', status: prometheus.scrapeStatus?.healthy ? 'healthy' : 'neutral' },
                { label: 'MCP Tools', value: 4, status: 'healthy' },
              ]}
              details={
                prometheus.genaiMetrics ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">GenAI Metrics Summary</Text>
                    <Flex gap={16} flexWrap="wrap">
                      <MetricBox label="Total Requests" value={formatNum(prometheus.genaiMetrics.totalRequests)} />
                      <MetricBox label="Error Rate" value={`${prometheus.genaiMetrics.errorRate.toFixed(1)}%`} status={prometheus.genaiMetrics.errorRate > 5 ? 'critical' : 'healthy'} />
                      <MetricBox label="Avg Latency" value={`${Math.round(prometheus.genaiMetrics.avgLatencyMs)}ms`} />
                      <MetricBox label="Total Tokens" value={formatNum(prometheus.genaiMetrics.totalTokens)} />
                    </Flex>
                  </Flex>
                ) : undefined
              }
            />
          </div>

          {/* AWS CloudWatch */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="AWS CloudWatch"
              icon={<WarningIcon style={{ width: 16, height: 16, color: Colors.Text.Warning.Default }} />}
              status={cloudWatch.criticalAlarmCount > 0 ? 'critical'
                : cloudWatch.activeAlarmCount > 0 ? 'warning' : 'healthy'}
              statusLabel={cloudWatch.criticalAlarmCount > 0 ? `${cloudWatch.criticalAlarmCount} Critical`
                : cloudWatch.activeAlarmCount > 0 ? `${cloudWatch.activeAlarmCount} Alarms`
                : 'All Clear'}
              loading={cloudWatch.loading}
              error={cloudWatch.error}
              onRefresh={cloudWatch.refresh}
              metrics={[
                { label: 'Alarms', value: cloudWatch.alarms.length, status: cloudWatch.criticalAlarmCount > 0 ? 'critical' : 'neutral' },
                { label: 'Metrics', value: cloudWatch.metrics.length, status: 'neutral' },
                { label: 'Dashboard', value: cloudWatch.dashboardWidgets.length, unit: 'widgets', status: 'neutral' },
                { label: 'Log Errors', value: cloudWatch.logErrors.length, status: cloudWatch.logErrors.length > 10 ? 'warning' : 'neutral' },
              ]}
              details={
                cloudWatch.alarms.length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Active Alarms</Text>
                    {cloudWatch.alarms.slice(0, 5).map((a, i) => (
                      <Flex key={i} alignItems="center" gap={8}>
                        {a.severity === 'CRITICAL'
                          ? <CriticalIcon style={{ width: 12, height: 12, color: Colors.Text.Critical.Default }} />
                          : <WarningIcon style={{ width: 12, height: 12, color: Colors.Text.Warning.Default }} />}
                        <Text textStyle="small">{a.title}</Text>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, marginLeft: 'auto' }}>{a.source}</Text>
                      </Flex>
                    ))}
                  </Flex>
                ) : null
              }
            />
          </div>
        </Flex>
      </Flex>

      <Flex flexDirection="column" gap={12}>
        <Heading level={4} style={{ margin: 0, paddingLeft: 4 }}>Cost & Visualization</Heading>

        <Flex gap={12} flexWrap="wrap">
          {/* AWS Billing */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="AWS Billing & Cost"
              icon={<AiIcon style={{ width: 16, height: 16 }} />}
              status={awsBilling.budgetStatus?.status === 'exceeded' ? 'critical'
                : awsBilling.budgetStatus?.status === 'critical' ? 'critical'
                : awsBilling.budgetStatus?.status === 'warning' ? 'warning'
                : 'healthy'}
              statusLabel={awsBilling.budgetStatus
                ? `${awsBilling.budgetStatus.utilizationPct}% of budget`
                : 'Calculating...'}
              loading={awsBilling.loading}
              error={awsBilling.error}
              onRefresh={awsBilling.refresh}
              metrics={[
                { label: 'Current Spend', value: formatUsd(awsBilling.totalCostUsd), status: awsBilling.budgetStatus?.status === 'critical' ? 'critical' : 'neutral' },
                { label: 'Projected/Mo', value: formatUsd(awsBilling.projectedMonthlyUsd), status: awsBilling.projectedMonthlyUsd > awsBilling.config.monthlyBudget ? 'critical' : 'neutral' },
                { label: 'Models', value: awsBilling.costBreakdown.length, status: 'neutral' },
                { label: 'Anomalies', value: awsBilling.anomalies.length, status: awsBilling.anomalies.length > 0 ? 'warning' : 'healthy' },
              ]}
              details={
                awsBilling.costBreakdown.length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Top Cost Drivers</Text>
                    {awsBilling.costBreakdown.slice(0, 5).map((b, i) => (
                      <Flex key={i} alignItems="center" justifyContent="space-between">
                        <Text textStyle="small" style={{ fontFamily: 'monospace' }}>{b.service}</Text>
                        <Text textStyle="small" style={{ fontWeight: 700 }}>{formatUsd(b.costUsd)}</Text>
                      </Flex>
                    ))}
                    {awsBilling.budgetStatus && (
                      <ProgressBar value={Math.min(awsBilling.budgetStatus.utilizationPct, 100)} />
                    )}
                  </Flex>
                ) : null
              }
            />
          </div>

          {/* Grafana */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="Grafana"
              icon={<AiIcon style={{ width: 16, height: 16 }} />}
              status={grafana.firingAlertCount > 0 ? 'warning' : 'healthy'}
              statusLabel={grafana.firingAlertCount > 0 ? `${grafana.firingAlertCount} Firing` : 'Healthy'}
              loading={grafana.loading}
              error={grafana.error}
              onRefresh={grafana.refresh}
              metrics={[
                { label: 'Dashboards', value: grafana.dashboards.length, status: 'neutral' },
                { label: 'Alerts', value: grafana.alerts.length, status: grafana.firingAlertCount > 0 ? 'warning' : 'neutral' },
                { label: 'Annotations', value: grafana.annotations.length, status: 'neutral' },
                { label: 'Syncs', value: grafana.syncStatus.totalSyncs, status: grafana.syncStatus.failed > 0 ? 'warning' : 'neutral' },
              ]}
              details={
                grafana.alerts.filter(a => a.state !== 'inactive').length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Active Alerts</Text>
                    {grafana.alerts.filter(a => a.state !== 'inactive').slice(0, 5).map((a, i) => (
                      <Flex key={i} alignItems="center" gap={8}>
                        {a.state === 'firing'
                          ? <CriticalIcon style={{ width: 12, height: 12, color: Colors.Text.Critical.Default }} />
                          : <WarningIcon style={{ width: 12, height: 12, color: Colors.Text.Warning.Default }} />}
                        <Text textStyle="small">{a.title}</Text>
                        <StatusBadge
                          status={a.state === 'firing' ? 'critical' : 'warning'}
                          label={a.state}
                        />
                      </Flex>
                    ))}
                  </Flex>
                ) : null
              }
            />
          </div>
        </Flex>
      </Flex>

      <Flex flexDirection="column" gap={12}>
        <Heading level={4} style={{ margin: 0, paddingLeft: 4 }}>DevOps & Automation</Heading>

        <Flex gap={12} flexWrap="wrap">
          {/* GitHub */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="GitHub"
              icon={<AiIcon style={{ width: 16, height: 16 }} />}
              status={github.openIssueCount > 5 ? 'warning' : 'healthy'}
              statusLabel={`${github.openIssueCount} Open Issues`}
              loading={github.loading}
              error={github.error}
              onRefresh={github.refresh}
              metrics={[
                { label: 'Open Issues', value: github.openIssueCount, status: github.openIssueCount > 5 ? 'warning' : 'neutral' },
                { label: 'Deployments', value: github.recentDeployCount, status: 'neutral' },
                { label: 'WF Events', value: github.workflowStats.total, status: 'neutral' },
                { label: 'Auto-Created', value: github.workflowStats.issuesCreated, status: 'neutral' },
              ]}
              details={
                github.issues.length > 0 ? (
                  <Flex flexDirection="column" gap={6}>
                    <Text textStyle="small-emphasized">Recent Issues</Text>
                    {github.issues.slice(0, 5).map((iss, i) => (
                      <Flex key={i} alignItems="center" gap={8}>
                        {iss.state === 'open'
                          ? <WarningIcon style={{ width: 12, height: 12, color: Colors.Text.Warning.Default }} />
                          : <CheckmarkIcon style={{ width: 12, height: 12, color: Colors.Text.Success.Default }} />}
                        <Text textStyle="small" style={{ flex: 1 }}>{iss.title}</Text>
                        <Flex gap={4}>
                          {iss.labels.slice(0, 2).map((l, j) => (
                            <span key={j} style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 8,
                              background: 'var(--dt-colors-surface-neutral-subdued)',
                              color: Colors.Text.Neutral.Subdued,
                            }}>{l}</span>
                          ))}
                        </Flex>
                      </Flex>
                    ))}
                  </Flex>
                ) : null
              }
            />
          </div>

          {/* Agentic Workflows */}
          <div style={{ flex: 1, minWidth: 380 }}>
            <IntegrationCard
              title="Agentic Workflows"
              icon={<AutomationEngineIcon style={{ width: 16, height: 16 }} />}
              status={workflows.stats.successRate >= 90 ? 'healthy'
                : workflows.stats.successRate >= 70 ? 'warning'
                : workflows.stats.totalExecutions === 0 ? 'inactive'
                : 'critical'}
              statusLabel={workflows.stats.totalExecutions > 0
                ? `${workflows.stats.successRate}% Success`
                : 'No Executions'}
              loading={workflows.loading}
              error={workflows.error}
              onRefresh={workflows.refresh}
              metrics={[
                { label: 'Executions', value: workflows.stats.totalExecutions, status: 'neutral' },
                { label: 'Success', value: `${workflows.stats.successRate}%`, status: workflows.stats.successRate >= 90 ? 'healthy' : workflows.stats.successRate >= 70 ? 'warning' : 'critical' },
                { label: 'Failed', value: workflows.stats.failed, status: workflows.stats.failed > 0 ? 'critical' : 'healthy' },
                { label: 'Templates', value: workflows.templates.length, status: 'neutral' },
              ]}
              details={
                <Flex flexDirection="column" gap={8}>
                  <Text textStyle="small-emphasized">Workflow Templates</Text>
                  {workflows.templates.map((t, i) => (
                    <Flex key={i} alignItems="center" gap={8}>
                      <CheckmarkIcon style={{ width: 12, height: 12, color: Colors.Text.Success.Default }} />
                      <Text textStyle="small" style={{ flex: 1 }}>{t.name}</Text>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 8,
                        background: 'var(--dt-colors-surface-neutral-subdued)',
                        color: Colors.Text.Neutral.Subdued,
                      }}>{t.category}</span>
                    </Flex>
                  ))}

                  {workflows.remediationCandidates.length > 0 && (
                    <>
                      <Text textStyle="small-emphasized" style={{ marginTop: 8 }}>Remediation Candidates</Text>
                      {workflows.remediationCandidates.slice(0, 3).map((c, i) => (
                        <Flex key={i} alignItems="center" gap={8}>
                          <CriticalIcon style={{ width: 12, height: 12, color: Colors.Text.Critical.Default }} />
                          <Text textStyle="small">{c.provider}/{c.model} — {c.errorRate.toFixed(1)}% errors</Text>
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 8,
                            background: Colors.Text.Warning.Default + '18',
                            color: Colors.Text.Warning.Default,
                          }}>→ {c.suggestedWorkflow}</span>
                        </Flex>
                      ))}
                    </>
                  )}
                </Flex>
              }
            />
          </div>
        </Flex>
      </Flex>

      {/* MCP Server Tools Reference */}
      <Surface style={{ padding: 16, borderRadius: 8 }}>
        <Flex flexDirection="column" gap={12}>
          <Flex alignItems="center" gap={8}>
            <AutomationEngineIcon style={{ width: 16, height: 16 }} />
            <Heading level={5} style={{ margin: 0 }}>MCP Server Tool Inventory</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              37 integration tools + 28 core tools = 65 total MCP tools
            </Text>
          </Flex>
          <Flex gap={16} flexWrap="wrap">
            {[
              { name: 'Slack', tools: 5, prefix: 'slack_' },
              { name: 'PagerDuty', tools: 5, prefix: 'pagerduty_' },
              { name: 'Prometheus', tools: 4, prefix: 'prometheus_' },
              { name: 'AWS Billing', tools: 5, prefix: 'aws_billing_' },
              { name: 'AWS CloudWatch', tools: 5, prefix: 'cloudwatch_' },
              { name: 'Grafana', tools: 6, prefix: 'grafana_' },
              { name: 'GitHub', tools: 6, prefix: 'github_' },
              { name: 'Workflows', tools: 6, prefix: 'workflow_' },
            ].map((group, i) => (
              <Surface key={i} style={{
                padding: '8px 14px', borderRadius: 6,
                background: 'var(--dt-colors-surface-neutral-subdued)',
                minWidth: 120,
              }}>
                <Flex flexDirection="column" gap={2}>
                  <Text textStyle="small-emphasized">{group.name}</Text>
                  <Flex alignItems="center" gap={4}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{group.tools}</span>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>tools</Text>
                  </Flex>
                  <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: 9, color: Colors.Text.Neutral.Subdued }}>
                    {group.prefix}*
                  </Text>
                </Flex>
              </Surface>
            ))}
          </Flex>
        </Flex>
      </Surface>

      {/* Davis AI Panel */}
      {showDavis && (
        <Surface style={{ padding: 20, borderRadius: 8, border: '1px solid var(--dt-colors-border-neutral-default)', maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          <Flex flexDirection="column" gap={12} style={{ flex: 1, minHeight: 0 }}>
            <Flex alignItems="center" justifyContent="space-between">
              <Flex alignItems="center" gap={8}>
                <DavisAiIcon style={{ width: 20, height: 20, color: 'var(--dt-colors-text-accent-default)' }} />
                <Heading level={4} style={{ margin: 0 }}>Dynatrace Intelligence</Heading>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  Ask about integration health, costs, alerts, or workflows
                </Text>
              </Flex>
              {davisMessages.length > 0 && (
                <Button variant="default" onClick={davisClearConversation}>Clear</Button>
              )}
            </Flex>

            <Flex gap={8} flexWrap="wrap">
              {[
                { label: 'Integration health overview', query: 'Give me a comprehensive overview of all GenAI integration health across all 8 connected MCP servers.' },
                { label: 'Cost anomaly analysis', query: 'Analyze the current GenAI cost patterns. Are there any anomalies or unexpected spending patterns across providers?' },
                { label: 'Active alarms breakdown', query: `There are ${summary.totalAlarms} active alarms across CloudWatch and Grafana. Break down the root causes and suggest remediation actions.` },
                { label: 'Workflow optimization', query: `Workflow success rate is ${summary.workflowSuccessRate}%. Analyze execution patterns and suggest improvements.` },
              ].map((q, i) => (
                <Button key={i} variant="default" onClick={() => handleDavisQuery(q.query)} style={{ fontSize: 11 }}>
                  <Button.Prefix><AiIcon /></Button.Prefix>
                  {q.label}
                </Button>
              ))}
            </Flex>

            <Flex gap={8} alignItems="center">
              <div style={{ flex: 1 }}>
                <TextInput
                  placeholder="Ask about integrations, costs, alerts, or workflows..."
                  value={davisQuery}
                  onChange={setDavisQuery}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCustomDavisQuery(); }}
                />
              </div>
              <Button variant="emphasized" onClick={handleCustomDavisQuery} disabled={!davisQuery.trim() || davisLoading}>
                <Button.Prefix><DavisAiIcon /></Button.Prefix>
                Ask
              </Button>
            </Flex>

            {(davisMessages.length > 0 || davisLoading) && (
              <div style={{ flex: 1, overflow: 'auto', minHeight: 120, maxHeight: 320, borderTop: '1px solid var(--dt-colors-border-neutral-default)', paddingTop: 12 }}>
                <Flex flexDirection="column" gap={12}>
                  {davisMessages.map((msg: ConversationMessage, i: number) => (
                    <div key={msg.id || i} style={{ width: '100%' }}>
                      {msg.role === 'user' ? (
                        <Flex gap={8} alignItems="flex-start">
                          <HelpIcon style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, color: 'var(--dt-colors-text-primary-default)' }} />
                          <Text textStyle="small" style={{ fontWeight: 600 }}>{msg.content}</Text>
                        </Flex>
                      ) : msg.isLoading ? (
                        <Flex gap={8} alignItems="center">
                          <ProgressCircle size="small" />
                          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Analyzing integrations...</Text>
                        </Flex>
                      ) : (
                        <Surface style={{ padding: 12, borderRadius: 6, borderLeft: '3px solid var(--dt-colors-text-accent-default)' }}>
                          <DavisResponse content={msg.content} />
                        </Surface>
                      )}
                    </div>
                  ))}
                </Flex>
              </div>
            )}
          </Flex>
        </Surface>
      )}

      {/* Help Modal */}
      <Modal
        title="Integrations Hub — Help Guide"
        show={showHelp}
        onDismiss={() => setShowHelp(false)}
        size="medium"
      >
        <Flex flexDirection="column" gap={20} style={{ padding: 8 }}>
          {/* Overview */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={5} style={{ margin: 0, color: Colors.Text.Primary.Default }}>What is the Integrations Hub?</Heading>
            <Text>
              The Integrations Hub provides a unified view of all external system connections that feed data into GenAI Control Center.
              Each integration card shows live telemetry pulled from Dynatrace Grail via DQL queries — no mocks, all real data.
            </Text>
          </Flex>

          {/* KPI Section */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={5} style={{ margin: 0, color: Colors.Text.Primary.Default }}>Understanding the Summary KPIs</Heading>
            <Flex flexDirection="column" gap={4} style={{ paddingLeft: 12 }}>
              <Text><strong>Integrations:</strong> Total number of MCP server connections (8 total: Slack, PagerDuty, Prometheus, AWS Billing, CloudWatch, Grafana, GitHub, Agentic Workflows)</Text>
              <Text><strong>Active Alarms:</strong> Combined count of firing alerts from CloudWatch + Grafana. Red means alerts need attention.</Text>
              <Text><strong>Estimated GenAI Cost:</strong> Token-based cost estimate derived from gen_ai.usage.* span attributes, mapped to provider pricing.</Text>
              <Text><strong>Workflow Success:</strong> Success rate of automated remediation workflows. Below 90% indicates workflow failures to investigate.</Text>
            </Flex>
          </Flex>

          {/* Integration Cards */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={5} style={{ margin: 0, color: Colors.Text.Primary.Default }}>Reading Integration Cards</Heading>
            <Flex flexDirection="column" gap={4} style={{ paddingLeft: 12 }}>
              <Text><strong>Status Badge:</strong> Green = healthy, Yellow = warning, Red = critical, Gray = inactive/no data</Text>
              <Text><strong>Metrics Row:</strong> Key performance indicators for each integration (requests, errors, latency, etc.)</Text>
              <Text><strong>Details Button:</strong> Expand to see recent activity, tables, and drill-down data</Text>
              <Text><strong>Refresh Button:</strong> Re-fetch the latest data from Grail for that integration</Text>
            </Flex>
          </Flex>

          {/* Integration Types */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={5} style={{ margin: 0, color: Colors.Text.Primary.Default }}>Integration Categories</Heading>
            <Flex flexDirection="column" gap={6} style={{ paddingLeft: 12 }}>
              <Surface style={{ padding: 12, borderRadius: 6, borderLeft: `3px solid ${Colors.Text.Success.Default}` }}>
                <Text><strong>Notification & Incident:</strong> Slack and PagerDuty — shows alert notifications, incidents, and on-call status</Text>
              </Surface>
              <Surface style={{ padding: 12, borderRadius: 6, borderLeft: `3px solid ${Colors.Text.Warning.Default}` }}>
                <Text><strong>Observability:</strong> Prometheus, CloudWatch, Grafana — metrics, alarms, dashboards, and annotations</Text>
              </Surface>
              <Surface style={{ padding: 12, borderRadius: 6, borderLeft: `3px solid var(--dt-colors-text-accent-default)` }}>
                <Text><strong>DevOps:</strong> GitHub — repository issues, pull requests, deployments, and CI/CD status</Text>
              </Surface>
              <Surface style={{ padding: 12, borderRadius: 6, borderLeft: `3px solid var(--dt-colors-text-primary-default)` }}>
                <Text><strong>Automation:</strong> Agentic Workflows — automated remediation execution stats, candidates, and templates</Text>
              </Surface>
              <Surface style={{ padding: 12, borderRadius: 6, borderLeft: `3px solid ${Colors.Text.Critical.Default}` }}>
                <Text><strong>Cost:</strong> AWS Billing — spend breakdown by provider/model, anomaly detection, cost projections</Text>
              </Surface>
            </Flex>
          </Flex>

          {/* Ask Davis */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={5} style={{ margin: 0, color: Colors.Text.Primary.Default }}>Using "Ask Dynatrace"</Heading>
            <Text>
              Click the "Ask Dynatrace" button to open Dynatrace Intelligence chat. It has full context of all integration data and can:
            </Text>
            <Flex flexDirection="column" gap={4} style={{ paddingLeft: 12 }}>
              <Text>• Summarize integration health across all systems</Text>
              <Text>• Explain anomalies in cost or error rates</Text>
              <Text>• Recommend actions based on current alerts</Text>
              <Text>• Correlate issues across multiple integrations</Text>
            </Flex>
          </Flex>

          {/* Quick Tips */}
          <Surface style={{ padding: 12, background: Colors.Background.Container.Neutral.Emphasized, borderRadius: 6 }}>
            <Flex flexDirection="column" gap={6}>
              <Text style={{ fontWeight: 600 }}>💡 Pro Tips</Text>
              <Text textStyle="small">• Use the global time filter (top bar) to change the analysis window for all integrations at once</Text>
              <Text textStyle="small">• Red status badges require immediate attention — click Details to investigate</Text>
              <Text textStyle="small">• Cost anomalies (z-score {">"} 1.5) indicate unusual spending patterns worth reviewing</Text>
              <Text textStyle="small">• Provider deep-dives auto-trigger suggested Dynatrace Intelligence questions for quick analysis</Text>
            </Flex>
          </Surface>
        </Flex>
      </Modal>
    </Flex>
  );
}

export default Integrations;
