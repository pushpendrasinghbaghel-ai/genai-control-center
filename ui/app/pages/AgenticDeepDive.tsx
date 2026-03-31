// GenAI Control Center — Agentic AI Deep Observability
// Phase 12: Production-grade deep observability for agentic AI systems
// MCP-validated: All queries confirmed against real Grail data (707M+ spans)

import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Strong } from '@dynatrace/strato-components/typography';
import { Tab, Tabs } from '@dynatrace/strato-components/navigation';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { DataTable } from '@dynatrace/strato-components/tables';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { TimeframeSelector } from '@dynatrace/strato-components/filters';
import { Modal, Tooltip } from '@dynatrace/strato-components/overlays';
import type { Timeframe } from '@dynatrace/strato-components/core';
import {
  RefreshIcon,
  AiIcon,
  CheckmarkIcon,
  CriticalIcon,
  WarningIcon,
  AgentIcon,
  MoneyIcon,
  BarChartIcon,
  ClockIcon,
  WorkflowsIcon,
  HelpIcon,
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAgenticDeepDive } from '../hooks/useAgenticDeepDive';
import { useGlobalFilters } from '../context';
import { formatNumber } from '../utils';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { formatTime } from '../utils/formatting';
import type {
  AgentStepSummary,
  AgentExitCondition,
  MultiAgentTrace,
  CrossAgentTokens,
  ContextGrowthEntry,
  ContextWindowUtilization,
  CostBreachEntry,
  AgentTraceSpan,
} from '../types';

// ============================================
// Status Colors
// ============================================
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

// ============================================
// Metric Card Component
// ============================================
const MetricCard: React.FC<{
  value: string | number;
  label: string;
  icon: React.ReactNode;
  color?: string;
  tooltip?: string;
}> = ({ value, label, icon, color, tooltip }) => (
  <Flex
    alignItems="center"
    gap={8}
    padding={12}
    style={{
      background: 'var(--dt-colors-surface-default)',
      borderRadius: 6,
      border: '1px solid var(--dt-colors-border-neutral-default)',
      flex: '1 1 160px',
    }}
  >
    <Text style={{ display: 'flex', alignItems: 'center' }}>{icon}</Text>
    <Flex>
      <Flex style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</Flex>
      <Flex alignItems="center" gap={4}>
        <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</Flex>
        {tooltip && (
          <Tooltip text={tooltip}>
            <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        )}
      </Flex>
    </Flex>
  </Flex>
);

const formatDuration = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};

const formatCost = (usd: number): string => {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// ============================================
// Tab 1: Agent Step Tracing
// ============================================
const AgentStepTracingTab: React.FC<{
  agentSteps: AgentStepSummary[];
  exitConditions: AgentExitCondition[];
  onViewTrace: (traceId: string) => void;
}> = ({ agentSteps, exitConditions, onViewTrace }) => {
  const stepColumns = useMemo(
    () => [
      {
        id: 'agentName',
        header: 'Agent',
        accessor: 'agentName',
        columnType: 'text' as const,
      },
      {
        id: 'totalSpans',
        header: 'Total Spans',
        accessor: 'totalSpans',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(value)}</Text>,
      },
      {
        id: 'stepsPerTrace',
        header: 'Avg Steps/Trace',
        accessor: 'stepsPerTrace',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{(value as number).toFixed(1)}</Text>,
      },
      {
        id: 'stepBreakdown',
        header: 'Step Breakdown (T/Tl/W/L)',
        accessor: (row: AgentStepSummary) =>
          `${formatNumber(row.taskSteps)} / ${formatNumber(row.toolSteps)} / ${formatNumber(row.workflowSteps)} / ${formatNumber(row.llmSteps)}`,
        columnType: 'text' as const,
      },
      {
        id: 'tokens',
        header: 'Tokens (In / Out)',
        accessor: (row: AgentStepSummary) =>
          `${formatTokens(row.totalInputTokens)} / ${formatTokens(row.totalOutputTokens)}`,
        columnType: 'text' as const,
      },
      {
        id: 'avgDurationMs',
        header: 'Avg Duration',
        accessor: 'avgDurationMs',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatDuration(value as number)}</Text>,
      },
      {
        id: 'errorRate',
        header: 'Error Rate',
        accessor: 'errorRate',
        columnType: 'number' as const,
        cell: ({ value }: any) => {
          const rate = value as number;
          return (
            <Text style={{ color: rate > 5 ? STATUS_COLORS.critical : rate > 0 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
              {rate.toFixed(1)}%
            </Text>
          );
        },
      },
      {
        id: 'uniqueTraces',
        header: 'Traces',
        accessor: 'uniqueTraces',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(value)}</Text>,
      },
    ],
    []
  );

  const exitColumns = useMemo(
    () => [
      { id: 'agentName', header: 'Agent', accessor: 'agentName', columnType: 'text' as const },
      { id: 'total', header: 'Total', accessor: 'total', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      {
        id: 'success',
        header: 'Success',
        accessor: 'success',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: STATUS_COLORS.ideal }}>{formatNumber(value)}</Text>
        ),
      },
      {
        id: 'errors',
        header: 'Errors',
        accessor: 'errors',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: (value as number) > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal }}>
            {formatNumber(value)}
          </Text>
        ),
      },
      {
        id: 'timeouts',
        header: 'Timeouts',
        accessor: 'timeouts',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: (value as number) > 0 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
            {formatNumber(value)}
          </Text>
        ),
      },
      {
        id: 'slow',
        header: 'Slow',
        accessor: 'slow',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: (value as number) > 0 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
            {formatNumber(value)}
          </Text>
        ),
      },
    ],
    []
  );

  return (
    <Flex flexDirection="column" gap={16} paddingTop={16}>
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Agent Step Counts</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            Steps per agent invocation with type breakdown: Task / Tool / Workflow / LLM
          </Text>
          <DataTable data={agentSteps} columns={stepColumns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>

      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Agent Exit Conditions</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            Inferred exit reasons: success, error, timeout (&gt;60s), or slow (&gt;30s)
          </Text>
          <DataTable data={exitConditions} columns={exitColumns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Tab 2: Multi-Agent Depth
// ============================================
const MultiAgentDepthTab: React.FC<{
  multiAgentTraces: MultiAgentTrace[];
  crossAgentTokens: CrossAgentTokens[];
  parallelismStats: { totalTraces: number; parallel: number; sequential: number; mixed: number; avgParallelism: number } | null;
}> = ({ multiAgentTraces, crossAgentTokens, parallelismStats }) => {
  const traceColumns = useMemo(
    () => [
      { id: 'traceId', header: 'Trace ID', accessor: (r: MultiAgentTrace) => r.traceId.substring(0, 16) + '...', columnType: 'text' as const },
      {
        id: 'agents',
        header: 'Agents',
        accessor: (r: MultiAgentTrace) => r.agents.join(' → '),
        columnType: 'text' as const,
      },
      { id: 'agentCount', header: 'Agent Count', accessor: 'agentCount', columnType: 'number' as const },
      { id: 'totalSpans', header: 'Spans', accessor: 'totalSpans', columnType: 'number' as const },
      {
        id: 'tokens',
        header: 'Tokens (In / Out)',
        accessor: (r: MultiAgentTrace) =>
          `${formatTokens(r.totalInputTokens)} / ${formatTokens(r.totalOutputTokens)}`,
        columnType: 'text' as const,
      },
      {
        id: 'totalDurationMs',
        header: 'Duration',
        accessor: 'totalDurationMs',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatDuration(value as number)}</Text>,
      },
      {
        id: 'errorCount',
        header: 'Errors',
        accessor: 'errorCount',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: (value as number) > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal }}>
            {value as number}
          </Text>
        ),
      },
    ],
    []
  );

  const tokenColumns = useMemo(
    () => [
      { id: 'agentName', header: 'Agent', accessor: 'agentName', columnType: 'text' as const },
      { id: 'llmCalls', header: 'LLM Calls', accessor: 'llmCalls', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      {
        id: 'totalTokens',
        header: 'Total Tokens',
        accessor: 'totalTokens',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatTokens(value as number)}</Text>,
      },
      {
        id: 'avgInputPerCall',
        header: 'Avg Input/Call',
        accessor: 'avgInputPerCall',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(Math.round(value as number))}</Text>,
      },
      {
        id: 'avgOutputPerCall',
        header: 'Avg Output/Call',
        accessor: 'avgOutputPerCall',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(Math.round(value as number))}</Text>,
      },
      {
        id: 'toolCallRate',
        header: 'Tool Call Rate',
        accessor: 'toolCallRate',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{(value as number).toFixed(1)}%</Text>,
      },
      {
        id: 'estCostUsd',
        header: 'Est. Cost',
        accessor: 'estCostUsd',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatCost(value as number)}</Text>,
      },
      {
        id: 'providers',
        header: 'Providers',
        accessor: (r: CrossAgentTokens) => r.providers.join(', '),
        columnType: 'text' as const,
      },
    ],
    []
  );

  return (
    <Flex flexDirection="column" gap={16} paddingTop={16}>
      {/* Parallelism Stats */}
      {parallelismStats && parallelismStats.totalTraces > 0 && (
        <Surface>
          <Flex flexDirection="column" gap={8} padding={16}>
            <Heading level={5}>Agent Execution Patterns</Heading>
            <Flex gap={16} flexWrap="wrap">
              <MetricCard value={parallelismStats.totalTraces} label="Multi-Agent Traces" icon={<WorkflowsIcon />} />
              <MetricCard
                value={parallelismStats.sequential}
                label="Sequential"
                icon={<ClockIcon />}
                color={STATUS_COLORS.ideal}
              />
              <MetricCard
                value={parallelismStats.parallel}
                label="Parallel"
                icon={<AgentIcon />}
                color={STATUS_COLORS.good}
              />
              <MetricCard
                value={parallelismStats.mixed}
                label="Mixed"
                icon={<BarChartIcon />}
                color={STATUS_COLORS.neutral}
              />
              <MetricCard
                value={parallelismStats.avgParallelism.toFixed(2)}
                label="Avg Parallelism Ratio"
                icon={<BarChartIcon />}
                tooltip="Ratio > 1.5 = parallel, 1.0 = sequential"
              />
            </Flex>
          </Flex>
        </Surface>
      )}

      {/* Cross-Agent Token Attribution */}
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Cross-Agent Token Attribution</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            Per-agent token consumption. Tokens from LLM spans only (task/tool spans have no tokens).
          </Text>
          <DataTable data={crossAgentTokens} columns={tokenColumns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>

      {/* Multi-Agent Traces */}
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Multi-Agent Traces</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            Traces involving 2+ agents. Hierarchy inferred from agent co-occurrence (parent_span_id is null in traceloop).
          </Text>
          <DataTable data={multiAgentTraces} columns={traceColumns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Tab 3: Conversation State & Context
// ============================================
const ConversationStateTab: React.FC<{
  contextGrowth: ContextGrowthEntry[];
  conversationState: { total: number; singleTurn: number; multiTurn: number; errored: number; partialFailure: number; runaway: number; avgTurns: number; avgTokens: number; avgDurationMs: number } | null;
}> = ({ contextGrowth, conversationState }) => {
  const growthColumns = useMemo(
    () => [
      { id: 'traceId', header: 'Trace ID', accessor: (r: ContextGrowthEntry) => r.traceId.substring(0, 16) + '...', columnType: 'text' as const },
      { id: 'turns', header: 'Turns', accessor: 'turns', columnType: 'number' as const },
      {
        id: 'contextGrowthRatio',
        header: 'Growth Ratio',
        accessor: 'contextGrowthRatio',
        columnType: 'number' as const,
        cell: ({ value }: any) => {
          const v = value as number;
          return (
            <Text style={{ color: v > 5 ? STATUS_COLORS.critical : v > 2 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
              {v.toFixed(1)}x
            </Text>
          );
        },
      },
      {
        id: 'tokens',
        header: 'Min → Max Input',
        accessor: (r: ContextGrowthEntry) => `${formatTokens(r.minInput)} → ${formatTokens(r.maxInput)}`,
        columnType: 'text' as const,
      },
      {
        id: 'avgTokensPerTurn',
        header: 'Avg Tokens/Turn',
        accessor: 'avgTokensPerTurn',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(Math.round(value as number))}</Text>,
      },
      {
        id: 'agents',
        header: 'Agents',
        accessor: (r: ContextGrowthEntry) => r.agents.filter(Boolean).join(', ') || '—',
        columnType: 'text' as const,
      },
      {
        id: 'durationMs',
        header: 'Duration',
        accessor: 'durationMs',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatDuration(value as number)}</Text>,
      },
    ],
    []
  );

  return (
    <Flex flexDirection="column" gap={16} paddingTop={16}>
      {/* Conversation State Summary */}
      {conversationState && conversationState.total > 0 && (
        <Surface>
          <Flex flexDirection="column" gap={8} padding={16}>
            <Heading level={5}>Conversation State Distribution</Heading>
            <Flex gap={16} flexWrap="wrap">
              <MetricCard
                value={formatNumber(conversationState.total)}
                label="Total Conversations"
                icon={<WorkflowsIcon />}
              />
              <MetricCard
                value={formatNumber(conversationState.singleTurn)}
                label="Single-Turn"
                icon={<ClockIcon />}
                color={STATUS_COLORS.ideal}
              />
              <MetricCard
                value={formatNumber(conversationState.multiTurn)}
                label="Multi-Turn"
                icon={<AgentIcon />}
                color={STATUS_COLORS.good}
              />
              <MetricCard
                value={formatNumber(conversationState.runaway)}
                label="Runaway (>20 turns)"
                icon={<WarningIcon />}
                color={conversationState.runaway > 0 ? STATUS_COLORS.warning : STATUS_COLORS.ideal}
              />
              <MetricCard
                value={formatNumber(conversationState.errored)}
                label="Errored"
                icon={<CriticalIcon />}
                color={conversationState.errored > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal}
              />
              <MetricCard
                value={conversationState.avgTurns.toFixed(1)}
                label="Avg Turns/Conversation"
                icon={<BarChartIcon />}
              />
              <MetricCard
                value={formatTokens(conversationState.avgTokens)}
                label="Avg Tokens/Conv"
                icon={<MoneyIcon />}
              />
            </Flex>
          </Flex>
        </Surface>
      )}

      {/* Context Growth Table */}
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Context Growth Analysis</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            Token escalation across conversation turns. High growth ratios indicate context accumulation.
            Uses trace.id as conversation proxy (conversation_id not populated in traceloop).
          </Text>
          <DataTable data={contextGrowth} columns={growthColumns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Tab 4: Context Window Utilization
// ============================================
const ContextWindowTab: React.FC<{
  contextWindowUtil: ContextWindowUtilization[];
}> = ({ contextWindowUtil }) => {
  const columns = useMemo(
    () => [
      { id: 'model', header: 'Model', accessor: 'model', columnType: 'text' as const },
      { id: 'provider', header: 'Provider', accessor: 'provider', columnType: 'text' as const },
      {
        id: 'avgUtilization',
        header: 'Avg Utilization',
        accessor: 'avgUtilization',
        columnType: 'number' as const,
        cell: ({ value }: any) => {
          const v = value as number;
          return (
            <Text style={{ color: v > 90 ? STATUS_COLORS.critical : v > 80 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
              {v.toFixed(1)}%
            </Text>
          );
        },
      },
      {
        id: 'maxUtilization',
        header: 'Peak Utilization',
        accessor: 'maxUtilization',
        columnType: 'number' as const,
        cell: ({ value }: any) => {
          const v = value as number;
          return (
            <Text style={{ color: v > 90 ? STATUS_COLORS.critical : v > 80 ? STATUS_COLORS.warning : STATUS_COLORS.ideal }}>
              {v.toFixed(1)}%
            </Text>
          );
        },
      },
      { id: 'requests', header: 'Requests', accessor: 'requests', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      {
        id: 'avgInputTokens',
        header: 'Avg Input Tokens',
        accessor: 'avgInputTokens',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatNumber(Math.round(value as number))}</Text>,
      },
      {
        id: 'nearCapacityCount',
        header: 'Near Capacity (>90%)',
        accessor: 'nearCapacityCount',
        columnType: 'number' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: (value as number) > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal }}>
            {formatNumber(value)}
          </Text>
        ),
      },
      {
        id: 'highUtilPct',
        header: 'High Util %',
        accessor: 'highUtilPct',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{(value as number).toFixed(1)}%</Text>,
      },
    ],
    []
  );

  return (
    <Flex flexDirection="column" gap={16} paddingTop={16}>
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Context Window Utilization by Model</Heading>
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            How much of each model's context window is being used. Model limits: GPT-4o (128K), Claude-3 (200K), Gemini (1M), Llama (8K).
          </Text>
          <DataTable data={contextWindowUtil} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Tab 5: Cost Threshold & Breach Detection
// ============================================
const CostThresholdTab: React.FC<{
  costBreaches: CostBreachEntry[];
}> = ({ costBreaches }) => {
  const avgCost = costBreaches.length > 0
    ? costBreaches.reduce((s, c) => s + c.hourlyCost, 0) / costBreaches.length
    : 0;
  const maxCost = costBreaches.length > 0
    ? Math.max(...costBreaches.map((c) => c.hourlyCost))
    : 0;
  const breachThreshold = avgCost * 2; // 2x average = breach
  const breachCount = costBreaches.filter((c) => c.hourlyCost > breachThreshold).length;

  const columns = useMemo(
    () => [
      {
        id: 'timeBucket',
        header: 'Hour',
        accessor: (r: CostBreachEntry) => {
          const d = new Date(r.timeBucket);
          return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        },
        columnType: 'text' as const,
      },
      {
        id: 'hourlyCost',
        header: 'Hourly Cost',
        accessor: 'hourlyCost',
        columnType: 'number' as const,
        cell: ({ value }: any) => {
          const v = value as number;
          const isBreach = v > breachThreshold;
          return (
            <Text style={{ color: isBreach ? STATUS_COLORS.critical : STATUS_COLORS.ideal, fontWeight: isBreach ? 600 : 400 }}>
              {formatCost(v)} {isBreach ? '⚠️' : ''}
            </Text>
          );
        },
      },
      { id: 'hourlyRequests', header: 'Requests', accessor: 'hourlyRequests', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatNumber(value)}</Text> },
      { id: 'hourlyTokens', header: 'Tokens', accessor: 'hourlyTokens', columnType: 'number' as const, cell: ({ value }: any) => <Text>{formatTokens(value as number)}</Text> },
    ],
    [breachThreshold]
  );

  return (
    <Flex flexDirection="column" gap={16} paddingTop={16}>
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <Heading level={5}>Hourly Cost Trend</Heading>
          <Flex gap={16} flexWrap="wrap">
            <MetricCard value={formatCost(avgCost)} label="Avg Hourly Cost" icon={<MoneyIcon />} />
            <MetricCard value={formatCost(maxCost)} label="Peak Hourly Cost" icon={<MoneyIcon />} color={STATUS_COLORS.warning} />
            <MetricCard
              value={breachCount}
              label="Breach Hours (>2x avg)"
              icon={<CriticalIcon />}
              color={breachCount > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal}
            />
            <MetricCard value={costBreaches.length} label="Data Points" icon={<BarChartIcon />} />
          </Flex>
        </Flex>
      </Surface>
      <Surface>
        <Flex flexDirection="column" gap={8} padding={16}>
          <DataTable data={costBreaches} columns={columns} sortable resizable>
            <DataTable.Pagination defaultPageSize={24} />
          </DataTable>
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Trace Waterfall Modal
// ============================================
const TraceWaterfallModal: React.FC<{
  traceId: string;
  spans: AgentTraceSpan[];
  onClose: () => void;
}> = ({ traceId, spans, onClose }) => {
  const columns = useMemo(
    () => [
      {
        id: 'startTime',
        header: 'Time',
        accessor: (r: AgentTraceSpan) => formatTime(r.startTime),
        columnType: 'text' as const,
      },
      { id: 'spanName', header: 'Span', accessor: 'spanName', columnType: 'text' as const },
      { id: 'spanKind', header: 'Kind', accessor: 'spanKind', columnType: 'text' as const },
      { id: 'agentName', header: 'Agent', accessor: 'agentName', columnType: 'text' as const },
      { id: 'model', header: 'Model', accessor: 'model', columnType: 'text' as const },
      {
        id: 'tokens',
        header: 'Tokens',
        accessor: (r: AgentTraceSpan) =>
          r.inputTokens || r.outputTokens ? `${r.inputTokens} / ${r.outputTokens}` : '—',
        columnType: 'text' as const,
      },
      {
        id: 'durationMs',
        header: 'Duration',
        accessor: 'durationMs',
        columnType: 'number' as const,
        cell: ({ value }: any) => <Text>{formatDuration(value as number)}</Text>,
      },
      {
        id: 'statusCode',
        header: 'Status',
        accessor: 'statusCode',
        columnType: 'text' as const,
        cell: ({ value }: any) => (
          <Text style={{ color: value === 'ERROR' ? STATUS_COLORS.critical : STATUS_COLORS.ideal }}>
            {value as string}
          </Text>
        ),
      },
    ],
    []
  );

  return (
    <Modal title={`Trace Waterfall: ${traceId.substring(0, 24)}...`} onDismiss={onClose} show={true} size="large">
      <Flex flexDirection="column" gap={8} padding={16}>
        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
          All spans in this trace ordered by start time. Parent-child relationships are unavailable (parent_span_id is null in traceloop).
        </Text>
        <DataTable data={spans} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={25} />
        </DataTable>
      </Flex>
    </Modal>
  );
};

// ============================================
// Main Page Component
// ============================================
export const AgenticDeepDive: React.FC = () => {
  const { filters: globalFilters } = useGlobalFilters();
  const [localTimeframe, setLocalTimeframe] = useState<Timeframe | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const queryFilters: QueryFilters = useMemo(() => ({
    ...globalFilters,
    ...(localTimeframe ? { timeframe: localTimeframe } : {}),
  }), [globalFilters, localTimeframe]);

  const {
    agentSteps,
    exitConditions,
    multiAgentTraces,
    parallelismStats,
    crossAgentTokens,
    contextGrowth,
    conversationState,
    contextWindowUtil,
    costBreaches,
    traceWaterfall,
    fetchTraceWaterfall,
    totalAgentSpans,
    totalAgents,
    totalTokens,
    totalCostUsd,
    avgStepsPerTrace,
    loading,
    error,
    fetchData,
  } = useAgenticDeepDive(queryFilters);

  useEffect(() => {
    fetchData();
  }, [fetchData, queryFilters]);

  const handleViewTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    fetchTraceWaterfall(traceId);
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Title Bar */}
      <TitleBar>
        <TitleBar.Title>Agentic AI Deep Observability</TitleBar.Title>
        <TitleBar.Subtitle>
          Phase 12 — Agent step tracing, multi-agent depth, conversation state, context windows, cost thresholds
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex alignItems="center" gap={8}>
            <TimeframeSelector onChange={setLocalTimeframe} />
            <Button onClick={fetchData} disabled={loading}>
              <Button.Prefix><RefreshIcon /></Button.Prefix>
              Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Error state */}
      {error && (
        <Surface>
          <Flex padding={16} alignItems="center" gap={8}>
            <CriticalIcon style={{ color: STATUS_COLORS.critical }} />
            <Text>Error loading data: {error.message}</Text>
          </Flex>
        </Surface>
      )}

      {/* Loading */}
      {loading && (
        <Flex justifyContent="center" padding={32}>
          <ProgressCircle />
        </Flex>
      )}

      {/* Summary Metrics */}
      {!loading && (
        <Flex gap={16} flexWrap="wrap">
          <MetricCard
            value={totalAgents}
            label="Active Agents"
            icon={<AgentIcon />}
            color={STATUS_COLORS.ideal}
          />
          <MetricCard
            value={formatNumber(totalAgentSpans)}
            label="Agent Spans"
            icon={<WorkflowsIcon />}
          />
          <MetricCard
            value={avgStepsPerTrace.toFixed(1)}
            label="Avg Steps/Trace"
            icon={<BarChartIcon />}
          />
          <MetricCard
            value={formatTokens(totalTokens)}
            label="Total Tokens"
            icon={<AiIcon />}
          />
          <MetricCard
            value={formatCost(totalCostUsd)}
            label="Est. Total Cost"
            icon={<MoneyIcon />}
            color={totalCostUsd > 100 ? STATUS_COLORS.warning : STATUS_COLORS.ideal}
          />
          <MetricCard
            value={multiAgentTraces.length}
            label="Multi-Agent Traces"
            icon={<AgentIcon />}
          />
        </Flex>
      )}

      {/* Tabs */}
      {!loading && (
        <Tabs>
          <Tab title="Agent Step Tracing" prefixIcon={<WorkflowsIcon />}>
            <AgentStepTracingTab
              agentSteps={agentSteps}
              exitConditions={exitConditions}
              onViewTrace={handleViewTrace}
            />
          </Tab>
          <Tab title="Multi-Agent Depth" prefixIcon={<AgentIcon />}>
            <MultiAgentDepthTab
              multiAgentTraces={multiAgentTraces}
              crossAgentTokens={crossAgentTokens}
              parallelismStats={parallelismStats}
            />
          </Tab>
          <Tab title="Conversation State" prefixIcon={<AiIcon />}>
            <ConversationStateTab
              contextGrowth={contextGrowth}
              conversationState={conversationState}
            />
          </Tab>
          <Tab title="Context Window" prefixIcon={<BarChartIcon />}>
            <ContextWindowTab contextWindowUtil={contextWindowUtil} />
          </Tab>
          <Tab title="Cost Threshold" prefixIcon={<MoneyIcon />}>
            <CostThresholdTab costBreaches={costBreaches} />
          </Tab>
        </Tabs>
      )}

      {/* Trace Waterfall Modal */}
      {selectedTraceId && (
        <TraceWaterfallModal
          traceId={selectedTraceId}
          spans={traceWaterfall}
          onClose={() => setSelectedTraceId(null)}
        />
      )}
    </Flex>
  );
};
