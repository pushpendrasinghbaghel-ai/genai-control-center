// ConversationIntelligence.tsx � Phase 8.2: Conversation-Level AI Observability
// Groups AI spans by conversation_id OR trace_id => turn counts, token usage, handoffs, long-dialogue alerts

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip, Modal, type ModalProps } from '@dynatrace/strato-components/overlays';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components/tables';
import { AiIcon, ChatIcon, WarningIcon, CheckmarkIcon, HelpIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { FilterBar } from '../components/FilterBar';
import { openTraceInDistributedTraces, TraceLink } from '../utils/traceLink';
import { useGlobalFilters } from '../context';
import { getTimeframeDqlClause } from '../context/FilterContext';
import {
  useDistinctServices,
  useDistinctProviders,
  useDistinctModels
} from '../hooks/useDQLQueries';


// ============================================
// Types
// ============================================

interface ConversationSummary {
  conversationId: string;
  totalTurns: number;
  totalTokens: number;
  avgLatencyMs: number;
  handoffCount: number;
  errorCount: number;
  durationMs: number;
  agentName: string;
  provider: string;
  model: string;
  isLong: boolean;
  hasErrors: boolean;
  hasHandoffs: boolean;
  groupedBy: 'conversation_id' | 'trace_id';  // New: tells user which grouping was used
  firstTimestamp?: string;
}

interface ConversationStats {
  totalConversations: number;
  avgTurnsPerConversation: number;
  avgTokensPerConversation: number;
  totalHandoffs: number;
  longConversationCount: number;
  errorRate: number;
  hasConversationIdData: boolean;  // New: tells if real conversation_id data exists
}

const LONG_TURN_THRESHOLD = 20;

// ============================================
// DQL Query Builders
// ============================================

/**
 * Builds a query that groups spans by conversation_id if available, otherwise trace_id.
 * Uses gen_ai.* attributes for token data and span attributes for grouping.
 */
function buildConversationListQuery(timeClause: string): string {
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.system) OR isNotNull(gen_ai.provider.name)
| fieldsAdd 
    session_key = coalesce(
      traceloop.association.properties.conversation_id,
      trace_id
    ),
    is_conversation_id = isNotNull(traceloop.association.properties.conversation_id)
| summarize
    turns = count(),
    agents = collectDistinct(coalesce(gen_ai.agent.name, traceloop.entity.name, "�")),
    models_used = collectDistinct(gen_ai.request.model),
    primary_model = takeFirst(gen_ai.request.model),
    primary_provider = takeFirst(coalesce(gen_ai.provider.name, gen_ai.system, "unknown")),
    total_input_tokens = sum(coalesce(toLong(gen_ai.usage.input_tokens), toLong(gen_ai.usage.prompt_tokens), 0)),
    total_output_tokens = sum(coalesce(toLong(gen_ai.usage.output_tokens), toLong(gen_ai.usage.completion_tokens), 0)),
    session_start = min(start_time),
    session_end = max(start_time),
    avg_latency = avg(duration) / 1000000,
    error_turns = countIf(span.status_code == "error" OR isNotNull(error.type)),
    handoff_count = countIf(contains(lower(span.name), "transfer") OR contains(lower(span.name), "handoff")),
    has_conv_id = takeAny(is_conversation_id)
  , by: { session_key }
| fieldsAdd
    duration_ms = toLong(session_end - session_start) / 1000000,
    total_tokens = total_input_tokens + total_output_tokens,
    has_errors = error_turns > 0,
    is_long = turns > ${LONG_TURN_THRESHOLD}
| sort session_end desc
| limit 200
`.trim();
}

/**
 * Get aggregate stats across all conversations/sessions.
 */
function buildConversationStatsQuery(timeClause: string): string {
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.system) OR isNotNull(gen_ai.provider.name)
| fieldsAdd 
    session_key = coalesce(
      traceloop.association.properties.conversation_id,
      trace_id
    )
| summarize
    total_spans = count(),
    unique_sessions = countDistinct(session_key),
    sessions_with_conv_id = countDistinct(traceloop.association.properties.conversation_id),
    error_spans = countIf(span.status_code == "error" OR isNotNull(error.type)),
    handoffs = countIf(contains(lower(span.name), "transfer") OR contains(lower(span.name), "handoff")),
    total_input_tokens = sum(coalesce(toLong(gen_ai.usage.input_tokens), toLong(gen_ai.usage.prompt_tokens), 0)),
    total_output_tokens = sum(coalesce(toLong(gen_ai.usage.output_tokens), toLong(gen_ai.usage.completion_tokens), 0))
`.trim();
}

// ============================================
// Helpers
// ============================================

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function StatusPill({ label, color }: { label: string | number; color: string }) {
  return (
    <Text style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: color + '22', color,
    }}>
      {label}
    </Text>
  );
}

function KpiCard({ label, value, subtitle, valueColor }: {
  label: string; value: string; subtitle?: string; valueColor?: string;
}) {
  return (
    <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
      <Flex flexDirection="column" gap={6}>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{label}</Text>
        <Heading level={3} style={{ margin: 0, color: valueColor }}>{value}</Heading>
        {subtitle && <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{subtitle}</Text>}
      </Flex>
    </Surface>
  );
}

// ============================================
// Help Modal Component
// ============================================

function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal
      title="About Conversation Intelligence"
      show={isOpen}
      onDismiss={onClose}
      size="medium"
    >
      <Flex flexDirection="column" gap={16} style={{ padding: 8 }}>
        <Surface style={{ padding: 16, background: 'var(--dt-colors-surface-neutral-subdued)' }}>
          <Heading level={5} style={{ margin: '0 0 8px 0' }}>Purpose</Heading>
          <Text>
            This page provides <strong>session-level AI observability</strong> by grouping related AI spans 
            into logical conversations or sessions. Track turn counts, token usage, agent handoffs, and 
            detect long-running sessions that may indicate issues.
          </Text>
        </Surface>

        <Heading level={5} style={{ margin: 0 }}>Key Metrics Explained</Heading>
        <Flex flexDirection="column" gap={12}>
          <Flex gap={8}>
            <Text textStyle="base-emphasized" style={{ minWidth: 120 }}>Turns:</Text>
            <Text>Number of AI model calls within a session (request/response pairs)</Text>
          </Flex>
          <Flex gap={8}>
            <Text textStyle="base-emphasized" style={{ minWidth: 120 }}>Tokens:</Text>
            <Text>Total input + output tokens consumed across the entire session</Text>
          </Flex>
          <Flex gap={8}>
            <Text textStyle="base-emphasized" style={{ minWidth: 120 }}>Handoffs:</Text>
            <Text>Agent-to-agent transfers detected via "transfer" or "handoff" span patterns</Text>
          </Flex>
          <Flex gap={8}>
            <Text textStyle="base-emphasized" style={{ minWidth: 120 }}>Long Sessions:</Text>
            <Text>Sessions with &gt;{LONG_TURN_THRESHOLD} turns � may indicate stuck loops or unresolved queries</Text>
          </Flex>
        </Flex>

        <Surface style={{ padding: 16, background: 'var(--dt-colors-surface-neutral-subdued)', border: `1px solid ${Colors.Border.Neutral.Default}` }}>
          <Heading level={5} style={{ margin: '0 0 8px 0' }}>Data Sources</Heading>
          <Text textStyle="small" style={{ display: 'block', marginBottom: 8 }}>
            Sessions are grouped by (in order of preference):
          </Text>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li><code>traceloop.association.properties.conversation_id</code> � Explicit session ID from Traceloop/OpenLLMetry</li>
            <li><code>trace_id</code> � OpenTelemetry trace ID as fallback</li>
          </ol>
          <Text textStyle="small" style={{ display: 'block', marginTop: 12, color: Colors.Text.Neutral.Subdued }}>
            <strong>Tip:</strong> For best results, configure your OpenTelemetry instrumentation (e.g., Traceloop SDK) 
            to set <code>conversation_id</code> for multi-turn conversations.
          </Text>
        </Surface>

        <Heading level={5} style={{ margin: 0 }}>How to Populate Data</Heading>
        <Text>To see data on this page, your AI services must:</Text>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Be instrumented with OpenTelemetry GenAI semantic conventions</li>
          <li>Send spans with <code>gen_ai.request.model</code>, <code>gen_ai.system</code>, or <code>gen_ai.provider.name</code></li>
          <li>Include token usage: <code>gen_ai.usage.input_tokens</code> and <code>gen_ai.usage.output_tokens</code></li>
          <li>(Optional) Set <code>traceloop.association.properties.conversation_id</code> for multi-turn session grouping</li>
        </ol>

        <Flex justifyContent="flex-end" style={{ marginTop: 8 }}>
          <Button variant="emphasized" onClick={onClose}>Got it</Button>
        </Flex>
      </Flex>
    </Modal>
  );
}

// ============================================
// Main Page
// ============================================

export function ConversationIntelligence() {
  // Global filters from Dynatrace FilterBar
  const { filters, setFilters } = useGlobalFilters();
  const timeClause = getTimeframeDqlClause(filters.timeframe);

  // Data for FilterBar dropdowns
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: providers } = useDistinctProviders();
  const { data: models } = useDistinctModels();

  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'long' | 'errors' | 'handoffs'>('all');
  const [showHelp, setShowHelp] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: buildConversationListQuery(timeClause), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: buildConversationStatsQuery(timeClause), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      const rows: ConversationSummary[] = (listRes.result?.records || []).map((r: any) => {
        const turns = Number(r['turns'] || 0);
        const errors = Number(r['error_turns'] || 0);
        const handoffs = Number(r['handoff_count'] || 0);
        const hasConvId = Boolean(r['has_conv_id']);
        const agents = r['agents'] as string[] || [];
        return {
          conversationId: String(r['session_key'] || '�'),
          totalTurns: turns,
          totalTokens: Number(r['total_tokens'] || 0),
          avgLatencyMs: Number(r['avg_latency'] || 0),
          handoffCount: handoffs,
          errorCount: errors,
          durationMs: Number(r['duration_ms'] || 0),
          agentName: agents.length > 0 ? agents[0] : 'unknown',
          provider: String(r['primary_provider'] || 'unknown'),
          model: String(r['primary_model'] || 'unknown'),
          isLong: turns >= LONG_TURN_THRESHOLD,
          hasErrors: errors > 0,
          hasHandoffs: handoffs > 0,
          groupedBy: hasConvId ? 'conversation_id' : 'trace_id',
          firstTimestamp: r['session_start'] ? String(r['session_start']) : undefined,
        };
      });
      setConversations(rows);

      const sr = (statsRes.result?.records || [])[0];
      const total = Number(sr?.['unique_sessions'] ?? rows.length) || rows.length;
      const sessionsWithConvId = Number(sr?.['sessions_with_conv_id'] ?? 0);
      const errCount = rows.filter(c => c.hasErrors).length;
      setStats({
        totalConversations: total,
        avgTurnsPerConversation: rows.length ? rows.reduce((s, c) => s + c.totalTurns, 0) / rows.length : 0,
        avgTokensPerConversation: rows.length ? rows.reduce((s, c) => s + c.totalTokens, 0) / rows.length : 0,
        totalHandoffs: Number(sr?.['handoffs'] ?? rows.reduce((s, c) => s + c.handoffCount, 0)),
        longConversationCount: rows.filter(c => c.isLong).length,
        errorRate: total ? (errCount / total) * 100 : 0,
        hasConversationIdData: sessionsWithConvId > 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation data');
    } finally {
      setLoading(false);
    }
  }, [timeClause]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'long': return conversations.filter(c => c.isLong);
      case 'errors': return conversations.filter(c => c.hasErrors);
      case 'handoffs': return conversations.filter(c => c.hasHandoffs);
      default: return conversations;
    }
  }, [conversations, activeTab]);

  const columns = useMemo<DataTableColumnDef<ConversationSummary>[]>(() => [
    {
      id: 'conversationId', header: 'Session ID', accessor: 'conversationId', width: 200,
      cell: ({ value, rowData }: { value: unknown; rowData: ConversationSummary }) => {
        const v = value as string;
        const isTraceId = rowData.groupedBy === 'trace_id';
        return (
          <Flex alignItems="center" gap={4}>
            {isTraceId ? (
              <TraceLink traceId={v} timestamp={rowData.firstTimestamp} truncate={20} />
            ) : (
              <Tooltip text={`${v}\n\nGrouped by: conversation_id`}>
                <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {v.substring(0, 20) + (v.length > 20 ? '…' : '')}
                </Text>
              </Tooltip>
            )}
            {isTraceId && (
              <Tooltip text="Grouped by trace_id (no conversation_id in spans)">
                <Text style={{ fontSize: 9, color: Colors.Text.Neutral.Subdued, padding: '1px 4px', background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 3 }}>trace</Text>
              </Tooltip>
            )}
          </Flex>
        );
      },
    },
    {
      id: 'totalTurns', header: 'Turns', accessor: 'totalTurns', width: 80,
      cell: ({ value, rowData }: { value: unknown; rowData: ConversationSummary }) => (
        <Flex alignItems="center" gap={4}>
          <Text style={{ color: rowData.isLong ? Colors.Text.Warning.Default : undefined }}>{value as number}</Text>
          {rowData.isLong && (
            <Tooltip text={`Long conversation (>${LONG_TURN_THRESHOLD} turns)`}>
              <WarningIcon style={{ width: 11, height: 11, color: Colors.Text.Warning.Default }} />
            </Tooltip>
          )}
        </Flex>
      ),
    },
    {
      id: 'totalTokens', header: 'Tokens', accessor: 'totalTokens', width: 90,
      cell: ({ value }: { value: unknown }) => <Text>{formatNum(value as number)}</Text>,
    },
    {
      id: 'avgLatencyMs', header: 'Avg Latency', accessor: 'avgLatencyMs', width: 110,
      cell: ({ value }: { value: unknown }) => {
        const ms = value as number;
        return <Text style={{ color: ms > 5000 ? Colors.Text.Warning.Default : undefined }}>{formatMs(ms)}</Text>;
      },
    },
    {
      id: 'model', header: 'Model', accessor: 'model', width: 140,
      cell: ({ value }: { value: unknown }) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{value as string}</Text>,
    },
    {
      id: 'handoffCount', header: 'Handoffs', accessor: 'handoffCount', width: 90,
      cell: ({ value }: { value: unknown }) => {
        const n = value as number;
        return n > 0
          ? <StatusPill label={n} color={'var(--dt-colors-charts-categorical-color-01-default)'} />
          : <Text style={{ color: Colors.Text.Neutral.Subdued }}>�</Text>;
      },
    },
    {
      id: 'errorCount', header: 'Errors', accessor: 'errorCount', width: 80,
      cell: ({ value }: { value: unknown }) => {
        const n = value as number;
        return n > 0
          ? <StatusPill label={n} color={Colors.Text.Critical.Default} />
          : <CheckmarkIcon style={{ width: 12, height: 12, color: Colors.Text.Success.Default }} />;
      },
    },
    {
      id: 'durationMs', header: 'Duration', accessor: 'durationMs', width: 100,
      cell: ({ value }: { value: unknown }) => <Text>{formatMs(value as number)}</Text>,
    },
    {
      id: 'provider', header: 'Provider', accessor: 'provider', width: 120,
      cell: ({ value }: { value: unknown }) => <Text>{value as string}</Text>,
    },
  ], []);

  const longCount = conversations.filter(c => c.isLong).length;

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true"><ChatIcon /></TitleBar.Prefix>
        <TitleBar.Title>Conversation Intelligence</TitleBar.Title>
        <TitleBar.Subtitle>Session-level AI observability � turns, handoffs, token usage &amp; long-dialogue detection</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <Tooltip text="Learn how to use this page">
              <Button variant="default" onClick={() => setShowHelp(true)}>
                <Flex alignItems="center" gap={4}>
                  <HelpIcon style={{ width: 14, height: 14 }} />
                  <Text>Help</Text>
                </Flex>
              </Button>
            </Tooltip>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Dynatrace Standard FilterBar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={fetchData}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={providers || []}
        availableModels={models || []}
      />

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {error && (
        <Surface style={{ padding: 12, borderRadius: 6, border: `1px solid ${Colors.Text.Critical.Default}50` }}>
          <Flex alignItems="center" gap={8}>
            <WarningIcon style={{ color: Colors.Text.Critical.Default }} />
            <Text style={{ color: Colors.Text.Critical.Default }}>{error}</Text>
          </Flex>
        </Surface>
      )}

      {/* KPI Row */}
      <Flex gap={12} flexWrap="wrap">
        <KpiCard label="Total Sessions" value={loading ? '�' : formatNum(stats?.totalConversations ?? conversations.length)} subtitle="grouped sessions" />
        <KpiCard label="Avg Turns / Session" value={loading ? '�' : (stats?.avgTurnsPerConversation ?? 0).toFixed(1)} subtitle="exchange depth"
          valueColor={(stats?.avgTurnsPerConversation ?? 0) > 10 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
        <KpiCard label="Avg Tokens / Session" value={loading ? '�' : formatNum(stats?.avgTokensPerConversation ?? 0)} subtitle="input + output" />
        <KpiCard label="Agent Handoffs" value={loading ? '�' : formatNum(stats?.totalHandoffs ?? 0)} subtitle="transfer patterns"
          valueColor={(stats?.totalHandoffs ?? 0) > 0 ? Colors.Text.Warning.Default : undefined} />
        <KpiCard label="Long Conversations" value={loading ? '�' : formatNum(longCount)} subtitle={`> ${LONG_TURN_THRESHOLD} turns`}
          valueColor={longCount > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
        <KpiCard label="Error Rate" value={loading ? '�' : `${(stats?.errorRate ?? 0).toFixed(1)}%`} subtitle="sessions with errors"
          valueColor={(stats?.errorRate ?? 0) > 5 ? Colors.Text.Critical.Default : (stats?.errorRate ?? 0) > 1 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
      </Flex>

      {/* Info banner about data source */}
      {stats && !stats.hasConversationIdData && conversations.length > 0 && (
        <Surface style={{ padding: 12, borderRadius: 6, background: 'var(--dt-colors-surface-neutral-subdued)', border: `1px solid ${Colors.Border.Neutral.Default}`, flexShrink: 0 }}>
          <Flex alignItems="center" gap={8}>
            <AiIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Default }} />
            <Flex flexDirection="column" gap={2}>
              <Text textStyle="small-emphasized">Sessions grouped by trace_id</Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                No <code>conversation_id</code> found. All spans sharing the same <code>trace_id</code> are grouped as one session.
                {conversations.length === 1 && ' If you see only 1 session, your spans likely share a single parent trace.'}{' '}
                <Text style={{ cursor: 'pointer', color: Colors.Text.Primary.Default, textDecoration: 'underline' }} onClick={() => setShowHelp(true)}>Learn more</Text>
              </Text>
            </Flex>
          </Flex>
        </Surface>
      )}

      {longCount > 0 && (
        <Surface style={{ padding: 12, borderRadius: 6, background: Colors.Text.Warning.Default + '12', border: `1px solid ${Colors.Text.Warning.Default}50` }}>
          <Flex alignItems="center" justifyContent="space-between">
            <Flex alignItems="center" gap={8}>
              <WarningIcon style={{ color: Colors.Text.Warning.Default, width: 16, height: 16 }} />
              <Flex flexDirection="column" gap={2}>
                <Text textStyle="base-emphasized" style={{ color: Colors.Text.Warning.Default }}>
                  {longCount} Long Session{longCount > 1 ? 's' : ''} Detected
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  Sessions &gt;{LONG_TURN_THRESHOLD} turns may indicate unresolved queries or agent loops � consuming{' '}
                  {formatNum(conversations.filter(c => c.isLong).reduce((s, c) => s + c.totalTokens, 0))} tokens combined.
                </Text>
              </Flex>
            </Flex>
            <Button variant="default" onClick={() => setActiveTab('long')}>View Long Sessions</Button>
          </Flex>
        </Surface>
      )}

      {/* Tabs */}
      <Flex gap={8}>
        {([
          ['all', `All (${conversations.length})`],
          ['long', `Long >${LONG_TURN_THRESHOLD} turns (${conversations.filter(c => c.isLong).length})`],
          ['errors', `With Errors (${conversations.filter(c => c.hasErrors).length})`],
          ['handoffs', `Handoffs (${conversations.filter(c => c.hasHandoffs).length})`],
        ] as [string, string][]).map(([id, label]) => (
          <Button key={id} variant={activeTab === id ? 'emphasized' : 'default'}
            onClick={() => setActiveTab(id as typeof activeTab)}>{label}</Button>
        ))}
      </Flex>

      {/* Table */}
      <Surface style={{ flex: 1, minHeight: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Flex alignItems="center" justifyContent="space-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
          <Flex alignItems="center" gap={8}>
            <ChatIcon style={{ width: 15, height: 15 }} />
            <Heading level={5} style={{ margin: 0 }}>
              {activeTab === 'all' ? 'All Sessions' : activeTab === 'long' ? 'Long Sessions'
                : activeTab === 'errors' ? 'Sessions with Errors' : 'Sessions with Agent Handoffs'}
            </Heading>
            <StatusPill label={filtered.length} color={Colors.Text.Neutral.Subdued} />
          </Flex>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Grouped by <code>{stats?.hasConversationIdData ? 'conversation_id' : 'trace_id'}</code>
          </Text>
        </Flex>

        {loading ? (
          <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
            <ProgressCircle /><Text>Loading conversation data...</Text>
          </Flex>
        ) : filtered.length === 0 ? (
          <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
            <ChatIcon style={{ width: 32, height: 32, color: Colors.Text.Neutral.Subdued }} />
            <Heading level={5} style={{ color: Colors.Text.Neutral.Subdued }}>No sessions found</Heading>
            <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 500 }}>
              This page requires GenAI spans with <code>gen_ai.request.model</code>, <code>gen_ai.system</code>, or <code>gen_ai.provider.name</code> attributes.
            </Text>
            <Button variant="default" onClick={() => setShowHelp(true)} style={{ marginTop: 8 }}>
              <Flex alignItems="center" gap={4}>
                <HelpIcon style={{ width: 14, height: 14 }} />
                Learn how to populate data
              </Flex>
            </Button>
          </Flex>
        ) : (
          <Flex style={{ flex: 1, overflow: 'auto' }}>
            <DataTable data={filtered} columns={columns} fullWidth />
          </Flex>
        )}
      </Surface>

      <Surface style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 6, flexShrink: 0 }}>
        <Flex alignItems="flex-start" gap={8}>
          <AiIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, marginTop: 2 }} />
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Sessions grouped by <code>conversation_id</code> (preferred) or <code>trace_id</code> (fallback).
            Agent handoffs detected via "transfer" or "handoff" span name patterns.
            Long conversations (&gt;{LONG_TURN_THRESHOLD} turns) may indicate unresolved user intent, agent loops, or missing fallback logic.
            <Text style={{ cursor: 'pointer', color: Colors.Text.Primary.Default, marginLeft: 8 }} onClick={() => setShowHelp(true)}>Need help?</Text>
          </Text>
        </Flex>
      </Surface>
    </Flex>
  );
}

export default ConversationIntelligence;
