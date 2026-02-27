// ConversationIntelligence.tsx — Phase 8.2: Conversation-Level AI Observability
// Groups AI spans by conversation_id => turn counts, token usage, handoffs, long-dialogue alerts

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { AiIcon, ChatIcon, WarningIcon, CheckmarkIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  CONVERSATION_LIST_QUERY,
  CONVERSATION_STATS_QUERY,
  LONG_CONVERSATION_QUERY,
} from '../queries/dql-queries';
import type { QueryFilters } from '../queries/dql-queries';


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
  isLong: boolean;
  hasErrors: boolean;
  hasHandoffs: boolean;
}

interface ConversationStats {
  totalConversations: number;
  avgTurnsPerConversation: number;
  avgTokensPerConversation: number;
  totalHandoffs: number;
  longConversationCount: number;
  errorRate: number;
}

const LONG_TURN_THRESHOLD = 20;
const TIME_OPTIONS = ['1h', '2h', '6h', '24h', '7d'];

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
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: color + '22', color,
    }}>
      {label}
    </span>
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
// Main Page
// ============================================

export function ConversationIntelligence() {
  const [timeframe, setTimeframe] = useState('2h');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'long' | 'errors' | 'handoffs'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters: QueryFilters = { timeRange: timeframe };
    try {
      const [listRes, statsRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: CONVERSATION_LIST_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: CONVERSATION_STATS_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      const rows: ConversationSummary[] = (listRes.result?.records || []).map((r: any) => {
        const turns = Number(r['total_turns'] || 0);
        const errors = Number(r['error_count'] || 0);
        const handoffs = Number(r['handoff_count'] || 0);
        return {
          conversationId: String(r['conversation_id'] || r['traceloop.association.properties.conversation_id'] || '—'),
          totalTurns: turns,
          totalTokens: Number(r['total_tokens'] || 0),
          avgLatencyMs: Number(r['avg_latency_ms'] || 0),
          handoffCount: handoffs,
          errorCount: errors,
          durationMs: Number(r['duration_ms'] || r['total_duration_ms'] || 0),
          agentName: String(r['agent_name'] || r['traceloop.entity.name'] || r['gen_ai.request.model'] || 'unknown'),
          provider: String(r['provider'] || r['gen_ai.provider.name'] || 'unknown'),
          isLong: turns >= LONG_TURN_THRESHOLD,
          hasErrors: errors > 0,
          hasHandoffs: handoffs > 0,
        };
      });
      setConversations(rows);

      const sr = (statsRes.result?.records || [])[0];
      const total = Number(sr?.['total_conversations'] ?? rows.length) || rows.length;
      const errCount = rows.filter(c => c.hasErrors).length;
      setStats({
        totalConversations: total,
        avgTurnsPerConversation: Number(sr?.['avg_turns'] ?? 0) || (rows.length ? rows.reduce((s, c) => s + c.totalTurns, 0) / rows.length : 0),
        avgTokensPerConversation: Number(sr?.['avg_tokens'] ?? 0) || (rows.length ? rows.reduce((s, c) => s + c.totalTokens, 0) / rows.length : 0),
        totalHandoffs: Number(sr?.['handoffs'] ?? rows.reduce((s, c) => s + c.handoffCount, 0)),
        longConversationCount: rows.filter(c => c.isLong).length,
        errorRate: total ? (errCount / total) * 100 : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

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
      id: 'conversationId', header: 'Conversation ID', accessor: 'conversationId', width: 200,
      cell: ({ value }: { value: unknown }) => {
        const v = value as string;
        return (
          <Tooltip text={v}>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {v === '—' ? '—' : v.substring(0, 22) + (v.length > 22 ? '' : '')}
            </span>
          </Tooltip>
        );
      },
    },
    {
      id: 'totalTurns', header: 'Turns', accessor: 'totalTurns', width: 80,
      cell: ({ value, rowData }: { value: unknown; rowData: ConversationSummary }) => (
        <Flex alignItems="center" gap={4}>
          <span style={{ color: rowData.isLong ? Colors.Text.Warning.Default : undefined }}>{value as number}</span>
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
      cell: ({ value }: { value: unknown }) => <span>{formatNum(value as number)}</span>,
    },
    {
      id: 'avgLatencyMs', header: 'Avg Latency', accessor: 'avgLatencyMs', width: 110,
      cell: ({ value }: { value: unknown }) => {
        const ms = value as number;
        return <span style={{ color: ms > 5000 ? Colors.Text.Warning.Default : undefined }}>{formatMs(ms)}</span>;
      },
    },
    {
      id: 'handoffCount', header: 'Handoffs', accessor: 'handoffCount', width: 90,
      cell: ({ value }: { value: unknown }) => {
        const n = value as number;
        return n > 0
          ? <StatusPill label={n} color={'#1b7fc4'} />
          : <span style={{ color: Colors.Text.Neutral.Subdued }}>—</span>;
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
      cell: ({ value }: { value: unknown }) => <span>{formatMs(value as number)}</span>,
    },
    {
      id: 'agentName', header: 'Agent', accessor: 'agentName',
      cell: ({ value }: { value: unknown }) => <span>{value as string}</span>,
    },
    {
      id: 'provider', header: 'Provider', accessor: 'provider', width: 130,
      cell: ({ value }: { value: unknown }) => <span>{value as string}</span>,
    },
  ], []);

  const longCount = conversations.filter(c => c.isLong).length;

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true"><ChatIcon /></TitleBar.Prefix>
        <TitleBar.Title>Conversation Intelligence</TitleBar.Title>
        <TitleBar.Subtitle>Session-level AI observability — turns, handoffs, token usage &amp; long-dialogue detection</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            {TIME_OPTIONS.map(t => (
              <Button key={t} variant={timeframe === t ? 'emphasized' : 'default'}
                onClick={() => setTimeframe(t)} style={{ padding: '4px 10px', fontSize: 12 }}>{t}</Button>
            ))}
            <Button onClick={fetchData} disabled={loading}>
              {loading ? <ProgressCircle size="small" /> : 'Refresh'}
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

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
        <KpiCard label="Total Sessions" value={loading ? '' : formatNum(stats?.totalConversations ?? conversations.length)} subtitle={`last ${timeframe}`} />
        <KpiCard label="Avg Turns / Session" value={loading ? '' : (stats?.avgTurnsPerConversation ?? 0).toFixed(1)} subtitle="exchange depth"
          valueColor={(stats?.avgTurnsPerConversation ?? 0) > 10 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
        <KpiCard label="Avg Tokens / Session" value={loading ? '' : formatNum(stats?.avgTokensPerConversation ?? 0)} subtitle="input + output" />
        <KpiCard label="Agent Handoffs" value={loading ? '' : formatNum(stats?.totalHandoffs ?? 0)} subtitle="transfer_to patterns"
          valueColor={(stats?.totalHandoffs ?? 0) > 0 ? Colors.Text.Warning.Default : undefined} />
        <KpiCard label="Long Conversations" value={loading ? '' : formatNum(longCount)} subtitle={`> ${LONG_TURN_THRESHOLD} turns`}
          valueColor={longCount > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
        <KpiCard label="Error Rate" value={loading ? '' : `${(stats?.errorRate ?? 0).toFixed(1)}%`} subtitle="sessions with errors"
          valueColor={(stats?.errorRate ?? 0) > 5 ? Colors.Text.Critical.Default : (stats?.errorRate ?? 0) > 1 ? Colors.Text.Warning.Default : Colors.Text.Success.Default} />
      </Flex>

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
                  Sessions &gt;{LONG_TURN_THRESHOLD} turns may indicate unresolved queries or agent loops — consuming{' '}
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
      <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Flex alignItems="center" justifyContent="space-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
          <Flex alignItems="center" gap={8}>
            <ChatIcon style={{ width: 15, height: 15 }} />
            <Heading level={5} style={{ margin: 0 }}>
              {activeTab === 'all' ? 'All Conversations' : activeTab === 'long' ? 'Long Conversations'
                : activeTab === 'errors' ? 'Sessions with Errors' : 'Sessions with Agent Handoffs'}
            </Heading>
            <StatusPill label={filtered.length} color={Colors.Text.Neutral.Subdued} />
          </Flex>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Grouped by <code>traceloop.association.properties.conversation_id</code>
          </Text>
        </Flex>

        {loading ? (
          <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
            <ProgressCircle /><Text>Loading conversation data...</Text>
          </Flex>
        ) : filtered.length === 0 ? (
          <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
            <ChatIcon style={{ width: 32, height: 32, color: Colors.Text.Neutral.Subdued }} />
            <Heading level={5} style={{ color: Colors.Text.Neutral.Subdued }}>No conversations found</Heading>
            <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 400 }}>
              Requires <code>traceloop.association.properties.conversation_id</code> in your AI spans.
            </Text>
          </Flex>
        ) : (
          <DataTable data={filtered} columns={columns} fullWidth />
        )}
      </Surface>

      <Surface style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 6 }}>
        <Flex alignItems="flex-start" gap={8}>
          <AiIcon style={{ width: 14, height: 14, color: Colors.Text.Neutral.Subdued, marginTop: 2 }} />
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Sessions grouped by <code>traceloop.association.properties.conversation_id</code>.
            Agent handoffs detected via <code>transfer_to</code> span patterns.
            Long conversations (&gt;{LONG_TURN_THRESHOLD} turns) may indicate unresolved user intent, agent loops, or missing fallback logic.
          </Text>
        </Flex>
      </Surface>
    </Flex>
  );
}

export default ConversationIntelligence;
