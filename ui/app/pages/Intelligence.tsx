// GenAI Control Center — GenAI Intelligence
// Single full-width chat with agentic tool orchestration
// Free-flowing Q&A about GenAI services, agents, models, costs, etc.

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Strong } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';

import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  AiIcon,
  HelpIcon,
  DeleteIcon,
  PlusIcon,
  CheckmarkIcon,
  CriticalIcon,
  WarningIcon,
  RefreshIcon,
  ServicesIcon,
  MoneyIcon,
  ClockIcon,
  BarChartIcon,
  AnalyticsIcon,
  SecurityIcon,
  DocumentIcon,
  ArrowRightIcon,
  DavisAiIcon,
  CodeIcon,
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@dynatrace/strato-icons';
import { showToast } from '@dynatrace/strato-components-preview/notifications';
import { orchestrate, getQuickInvestigations, listAvailableTools } from '../agent';
import type {
  ChatMessage,
  MessageBlock,
  TableBlock,
  MetricBlock,
  AlertBlock,
  ChartBlock,
  AnalyzerBlock,
  FollowUpChip,
} from '../agent';
import {
  listSessions,
  createSession,
  deleteSession,
  loadMessages,
  saveMessages,
  getOrCreateActiveSession,
  getConversationHistory,
} from '../utils/chatMemory';
import type { ChatSession } from '../utils/chatMemory';

// ============================================
// Constants
// ============================================

/** Convert a Dynatrace Timeframe object to a simple string like "2h" for the orchestrator */
function timeframeToString(tf: Timeframe | null): string {
  if (!tf?.from?.value) return '2h';
  const fromVal = tf.from.value;
  // Expression format: "now()-2h" => "2h"
  const m = fromVal.match(/now\(\)\s*-\s*(\d+[mhdw])/);
  if (m) return m[1];
  // Fallback: try to compute from absolute dates
  if (tf.from?.absoluteDate && tf.to?.absoluteDate) {
    const diffMs = new Date(tf.to.absoluteDate).getTime() - new Date(tf.from.absoluteDate).getTime();
    const hours = diffMs / (1000 * 60 * 60);
    if (hours <= 1) return `${Math.round(hours * 60)}m`;
    if (hours <= 48) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  }
  return '2h';
}

/** Default timeframe: last 2 hours */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-2h', type: 'expression' as const, absoluteDate: new Date(Date.now() - 2 * 3600000).toISOString() },
  to: { value: 'now()', type: 'expression' as const, absoluteDate: new Date().toISOString() },
});

/** Icon style for suggested prompt chips */
const CHIP_ICON_STYLE: React.CSSProperties = { width: 13, height: 13, flexShrink: 0 };

/** Suggested prompts — free-flowing GenAI Q&A style (not investigation-focused) */
const SUGGESTED_PROMPTS: { icon: React.ReactNode; label: string; query: string }[] = [
  { icon: <ServicesIcon style={CHIP_ICON_STYLE} />,  label: 'My AI inventory',   query: 'How many services, providers, models, and agents do I have?' },
  { icon: <AiIcon style={CHIP_ICON_STYLE} />,        label: 'Agent activity',    query: 'Tell me about my AI agents and their activity' },
  { icon: <CheckmarkIcon style={CHIP_ICON_STYLE} />, label: 'Service health',    query: 'How are my AI services doing right now?' },
  { icon: <MoneyIcon style={CHIP_ICON_STYLE} />,     label: 'Cost breakdown',    query: 'Show me a cost breakdown by provider and model' },
  { icon: <ClockIcon style={CHIP_ICON_STYLE} />,     label: 'Latency check',     query: 'Which services or models have the highest latency?' },
  { icon: <CriticalIcon style={CHIP_ICON_STYLE} />,  label: 'Error analysis',    query: 'What are the top errors across my AI services?' },
  { icon: <BarChartIcon style={CHIP_ICON_STYLE} />,  label: 'Token usage',       query: 'Which models are consuming the most tokens?' },
  { icon: <AnalyticsIcon style={CHIP_ICON_STYLE} />, label: 'Usage trends',      query: 'Show me usage trends over time' },
  { icon: <DavisAiIcon style={CHIP_ICON_STYLE} />,   label: 'Forecast spend',    query: 'Forecast my token usage and costs for the next 24 hours' },
  { icon: <SecurityIcon style={CHIP_ICON_STYLE} />,  label: 'Anomaly detection', query: 'Are there any anomalies in my AI services?' },
  { icon: <DocumentIcon style={CHIP_ICON_STYLE} />,  label: 'Compare providers', query: 'Compare performance across all my AI providers' },
  { icon: <CodeIcon style={CHIP_ICON_STYLE} />,      label: 'Embedding perf',   query: 'How are my embedding models performing?' },
  { icon: <ArrowRightIcon style={CHIP_ICON_STYLE} />,label: 'RAG pipeline',      query: 'Analyze my RAG pipeline — embedding vs generation' },
  { icon: <DocumentIcon style={CHIP_ICON_STYLE} />,  label: 'Executive summary', query: 'Give me a full executive summary of GenAI operations' },
];

/** Icon style for welcome tiles (larger) */
const TILE_ICON_STYLE: React.CSSProperties = { width: 22, height: 22 };

/** Big icon tiles shown on the welcome screen */
const WELCOME_TILES: { icon: React.ReactNode; label: string; sub: string; query: string; color: string }[] = [
  { icon: <CheckmarkIcon style={TILE_ICON_STYLE} />,  label: 'Health',     sub: 'Service status',   query: 'How are my AI services doing right now?',                  color: '#2ab6a4' },
  { icon: <MoneyIcon style={TILE_ICON_STYLE} />,      label: 'Costs',      sub: 'Spend & tokens',   query: 'Show me a cost breakdown by provider and model',           color: '#f5a623' },
  { icon: <AiIcon style={TILE_ICON_STYLE} />,         label: 'Agents',     sub: 'Activity & tools',  query: 'Tell me about my AI agents and their activity',            color: '#7b61ff' },
  { icon: <CriticalIcon style={TILE_ICON_STYLE} />,   label: 'Errors',     sub: 'Top failures',     query: 'What are the top errors across my AI services?',            color: '#e74c3c' },
  { icon: <BarChartIcon style={TILE_ICON_STYLE} />,   label: 'Tokens',     sub: 'Usage by model',   query: 'Which models are consuming the most tokens?',               color: '#3498db' },
];

/** Category colors for suggested prompt chips */
const CATEGORY_COLORS: Record<string, string> = {
  general: '#7b61ff',
  health: '#2ab6a4',
  performance: '#3498db',
  cost: '#f5a623',
  agents: '#9b59b6',
  security: '#e74c3c',
  analysis: '#3498db',
  inventory: '#2ab6a4',
};

/** Tool Help Guide — organized by tier (Observe / Analyze / Act) — toggleable panel */
const TOOL_HELP_GUIDE: { tier: string; color: string; tools: { name: string; prompt: string; desc: string }[] }[] = [
  {
    tier: 'Observe',
    color: '#3498db',
    tools: [
      { name: 'Service Inventory', prompt: 'How many services, providers, models, and agents do I have?', desc: 'List all AI services, providers, models' },
      { name: 'Service Health', prompt: 'How are my AI services doing right now?', desc: 'Check health status of all AI services' },
      { name: 'Token Usage', prompt: 'Which models are consuming the most tokens?', desc: 'Token consumption by model' },
      { name: 'Usage Trends', prompt: 'Show me usage trends over time', desc: 'Track usage patterns over time' },
      { name: 'Agent Activity', prompt: 'Tell me about my AI agents and their activity', desc: 'Agent tools, sessions, and traces' },
    ],
  },
  {
    tier: 'Analyze',
    color: '#9b59b6',
    tools: [
      { name: 'Cost Breakdown', prompt: 'Show me a cost breakdown by provider and model', desc: 'Detailed cost analysis by provider' },
      { name: 'Latency Analysis', prompt: 'Which services or models have the highest latency?', desc: 'Performance bottleneck detection' },
      { name: 'Error Analysis', prompt: 'What are the top errors across my AI services?', desc: 'Error pattern and root cause analysis' },
      { name: 'Anomaly Detection', prompt: 'Are there any anomalies in my AI services?', desc: 'AI-powered anomaly detection' },
      { name: 'Provider Comparison', prompt: 'Compare performance across all my AI providers', desc: 'Side-by-side provider comparison' },
      { name: 'Embedding Performance', prompt: 'How are my embedding models performing?', desc: 'Embedding latency and throughput' },
    ],
  },
  {
    tier: 'Act',
    color: '#2ab6a4',
    tools: [
      { name: 'Forecast Spend', prompt: 'Forecast my token usage and costs for the next 24 hours', desc: 'Predict future spend and usage' },
      { name: 'Executive Summary', prompt: 'Give me a full executive summary of GenAI operations', desc: 'Comprehensive operations report' },
      { name: 'RAG Pipeline', prompt: 'Analyze my RAG pipeline — embedding vs generation', desc: 'End-to-end RAG pipeline analysis' },
    ],
  },
];

// ============================================
// Block Renderers (native Strato components)
// ============================================

/** Render a MetricBlock as a row of KPI cards */
const MetricBlockRenderer: React.FC<{ block: MetricBlock }> = ({ block }) => (
  <Flex gap={12} flexWrap="wrap" style={{ marginTop: 8, marginBottom: 8 }}>
    {block.metrics.map((m, i) => {
      const color = m.severity === 'critical'
        ? Colors.Text.Critical.Default
        : m.severity === 'warning'
          ? Colors.Text.Warning.Default
          : m.severity === 'healthy'
            ? Colors.Text.Success.Default
            : Colors.Text.Neutral.Default;
      return (
        <Surface key={i} style={{ padding: '10px 16px', minWidth: 100 }}>
          <Flex flexDirection="column" gap={2}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {m.label}
            </Text>
            <Heading level={5} style={{ color, margin: 0 }}>
              {m.value}{m.unit ? ` ${m.unit}` : ''}
            </Heading>
            {m.trend && (
              <Text textStyle="small" style={{
                color: m.trend === 'up' ? Colors.Text.Critical.Default :
                  m.trend === 'down' ? Colors.Text.Success.Default :
                    Colors.Text.Neutral.Subdued,
              }}>
                {m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'}
              </Text>
            )}
          </Flex>
        </Surface>
      );
    })}
  </Flex>
);

/**
 * Lightweight inline markdown renderer.
 * Handles: **bold**, ### headings, `code`, - bullet lists, numbered lists, \n paragraphs.
 * No external dependencies — built for chat message rendering.
 */
const MarkdownText: React.FC<{ content: string; style?: React.CSSProperties }> = ({ content, style }) => {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const Tag = listType === 'ol' ? 'ol' : 'ul';
        result.push(<Tag key={`list-${result.length}`} style={{ margin: '4px 0 4px 16px', padding: 0 }}>{listItems}</Tag>);
        listItems = [];
        listType = null;
      }
    };

    const renderInline = (text: string): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      // Process inline: **bold**, `code`, *italic*
      const inlineRegex = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\_(.+?)\_)|(\*([^*]+)\*)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let key = 0;
      while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push(text.slice(lastIndex, match.index));
        }
        if (match[2]) {
          nodes.push(<strong key={`b${key++}`}>{match[2]}</strong>);
        } else if (match[4]) {
          nodes.push(<code key={`c${key++}`} style={{
            fontSize: '0.9em', padding: '1px 4px', borderRadius: 3,
            backgroundColor: 'var(--dt-colors-background-default-secondary)',
            fontFamily: 'monospace',
          }}>{match[4]}</code>);
        } else if (match[6]) {
          nodes.push(<em key={`i${key++}`}>{match[6]}</em>);
        } else if (match[8]) {
          nodes.push(<em key={`i2${key++}`}>{match[8]}</em>);
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
      }
      return nodes;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Empty line = paragraph break
      if (line.trim() === '') {
        flushList();
        result.push(<div key={`br-${i}`} style={{ height: 6 }} />);
        continue;
      }

      // Headings
      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        flushList();
        const level = hMatch[1].length;
        const sizes = [18, 16, 14, 13];
        result.push(
          <div key={`h-${i}`} style={{ fontWeight: 600, fontSize: sizes[level - 1] || 13, margin: '6px 0 2px' }}>
            {renderInline(hMatch[2])}
          </div>
        );
        continue;
      }

      // Unordered list items (- or *)
      const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(<li key={`li-${i}`} style={{ marginBottom: 2, fontSize: 13 }}>{renderInline(ulMatch[1])}</li>);
        continue;
      }

      // Ordered list items (1. 2. etc.)
      const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; }
        listItems.push(<li key={`li-${i}`} style={{ marginBottom: 2, fontSize: 13 }}>{renderInline(olMatch[1])}</li>);
        continue;
      }

      // Regular text
      flushList();
      result.push(<div key={`p-${i}`} style={{ lineHeight: 1.5, fontSize: 13 }}>{renderInline(line)}</div>);
    }
    flushList();
    return result;
  }, [content]);

  return <div style={style}>{elements}</div>;
};

/** Render a TableBlock using Strato DataTable */
const TableBlockRenderer: React.FC<{ block: TableBlock }> = ({ block }) => {
  const tableData = useMemo(() =>
    block.rows.map((row, rowIdx) => {
      const obj: Record<string, string> = { _id: String(rowIdx) };
      block.headers.forEach((h, colIdx) => {
        obj[h] = row[colIdx] ?? '';
      });
      return obj;
    }), [block]);

  const columns = useMemo(
    () => block.headers.map(h => ({
      id: h,
      header: h,
      accessor: h,
      autoWidth: true,
    })),
    [block.headers]
  );

  return (
    <Flex flexDirection="column" gap={4} style={{ marginTop: 8, marginBottom: 8 }}>
      <DataTable data={tableData} columns={columns} fullWidth>
        <DataTable.Pagination defaultPageSize={5} />
      </DataTable>
      {block.caption && (
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
          {block.caption}
        </Text>
      )}
    </Flex>
  );
};

/** Render an AlertBlock as a styled banner */
const AlertBlockRenderer: React.FC<{ block: AlertBlock }> = ({ block }) => {
  const bgColor = block.severity === 'critical'
    ? 'rgba(220, 38, 38, 0.08)'
    : block.severity === 'warning'
      ? 'rgba(245, 158, 11, 0.08)'
      : block.severity === 'success'
        ? 'rgba(34, 197, 94, 0.08)'
        : 'rgba(59, 130, 246, 0.08)';

  const icon = block.severity === 'critical'
    ? <CriticalIcon style={{ width: 16, height: 16, color: Colors.Text.Critical.Default }} />
    : block.severity === 'warning'
      ? <WarningIcon style={{ width: 16, height: 16, color: Colors.Text.Warning.Default }} />
      : block.severity === 'success'
        ? <CheckmarkIcon style={{ width: 16, height: 16, color: Colors.Text.Success.Default }} />
        : <HelpIcon style={{ width: 16, height: 16, color: Colors.Text.Primary.Default }} />;

  return (
    <Surface style={{ padding: '10px 14px', backgroundColor: bgColor, marginTop: 4, marginBottom: 4 }}>
      <Flex gap={8} alignItems="flex-start">
        {icon}
        <Flex flexDirection="column" gap={2}>
          <Strong>{block.title}</Strong>
          <Text textStyle="small">{block.message}</Text>
        </Flex>
      </Flex>
    </Surface>
  );
};

/** Render a ChartBlock (bar chart as simple horizontal bars) */
const ChartBlockRenderer: React.FC<{ block: ChartBlock }> = ({ block }) => {
  const maxVal = Math.max(...block.data.map(d => d.value), 1);
  return (
    <Surface style={{ padding: 12, marginTop: 8, marginBottom: 8 }}>
      <Text style={{ fontWeight: 600, marginBottom: 8 }}>{block.title}</Text>
      <Flex flexDirection="column" gap={6}>
        {block.data.slice(0, 10).map((d, i) => (
          <Flex key={i} gap={8} alignItems="center">
            <Text textStyle="small" style={{ minWidth: 120, textAlign: 'right' }}>
              {d.label}
            </Text>
            <Flex style={{ flex: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
              <Flex style={{
                width: `${(d.value / maxVal) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--dt-colors-charts-categorical-default-cat-01)',
                borderRadius: 4,
                minWidth: 2,
              }} />
            </Flex>
            <Text textStyle="small" style={{ minWidth: 60 }}>
              {d.value.toLocaleString()}{block.unit ? ` ${block.unit}` : ''}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Surface>
  );
};

/** Render an AnalyzerBlock (forecast, anomaly, novelty) */
const AnalyzerBlockRenderer: React.FC<{ block: AnalyzerBlock }> = ({ block }) => (
  <Surface style={{ padding: 12, marginTop: 8, marginBottom: 8, border: '1px solid rgba(0,0,0,0.08)' }}>
    <Flex flexDirection="column" gap={6}>
      <Text style={{ fontWeight: 600 }}>
        <AiIcon style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
        {block.analyzerName}
      </Text>
      {block.forecast && (
        <Flex flexDirection="column" gap={4}>
          <Flex gap={12}>
            <Text textStyle="small">Trend: <Strong>{block.forecast.trend}</Strong></Text>
            <Text textStyle="small">Quality: <Strong>{block.forecast.forecastQuality}</Strong></Text>
          </Flex>
          {block.forecast.budgetBreachDay && (
            <AlertBlockRenderer block={{
              type: 'alert',
              severity: 'warning',
              title: 'Budget Breach Projected',
              message: `At current rate, budget threshold will be breached in ~${block.forecast.budgetBreachDay} days`,
            }} />
          )}
        </Flex>
      )}
      {block.anomaly && (
        <Flex gap={8} alignItems="center">
          {block.anomaly.hasAnomaly
            ? <CriticalIcon style={{ width: 14, height: 14, color: Colors.Text.Critical.Default }} />
            : <CheckmarkIcon style={{ width: 14, height: 14, color: Colors.Text.Success.Default }} />
          }
          <Text textStyle="small">
            {block.anomaly.hasAnomaly
              ? `Anomaly detected (severity: ${block.anomaly.severity})`
              : 'No anomalies detected'}
          </Text>
        </Flex>
      )}
      {block.novelty && (
        <Flex gap={8} alignItems="center">
          {block.novelty.noveltyScore > 0.5
            ? <WarningIcon style={{ width: 14, height: 14, color: Colors.Text.Warning.Default }} />
            : <CheckmarkIcon style={{ width: 14, height: 14, color: Colors.Text.Success.Default }} />
          }
          <Text textStyle="small">
            {block.novelty.noveltyScore > 0.5
              ? `${block.novelty.noveltyType} detected (score: ${block.novelty.noveltyScore.toFixed(2)})`
              : 'No unusual patterns'}
          </Text>
        </Flex>
      )}
    </Flex>
  </Surface>
);

/** Render a single MessageBlock based on its type */
const BlockRenderer: React.FC<{ block: MessageBlock }> = ({ block }) => {
  switch (block.type) {
    case 'text':
      return <MarkdownText content={block.content} />;
    case 'metric':
      return <MetricBlockRenderer block={block} />;
    case 'table':
      return <TableBlockRenderer block={block} />;
    case 'alert':
      return <AlertBlockRenderer block={block} />;
    case 'chart':
      return <ChartBlockRenderer block={block} />;
    case 'analyzer':
      return <AnalyzerBlockRenderer block={block} />;
    default:
      return null;
  }
};

// ============================================
// Follow-Up Chips
// ============================================

const FollowUpChips: React.FC<{
  chips: FollowUpChip[];
  onSelect: (query: string) => void;
  disabled?: boolean;
}> = ({ chips, onSelect, disabled }) => (
  <Flex gap={6} flexWrap="wrap">
    {chips.map((chip, i) => (
      <div
        key={i}
        onClick={() => !disabled && onSelect(chip.query)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 16,
          border: '1px solid var(--dt-colors-border-neutral-default)',
          background: 'var(--dt-colors-surface-default)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontSize: 12,
          whiteSpace: 'nowrap' as const,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = 'var(--dt-colors-border-primary-default)';
            e.currentTarget.style.background = 'var(--dt-colors-background-default-secondary)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--dt-colors-border-neutral-default)';
          e.currentTarget.style.background = 'var(--dt-colors-surface-default)';
        }}
      >
        <ArrowRightIcon style={{ width: 11, height: 11 }} />
        <span>{chip.label}</span>
      </div>
    ))}
  </Flex>
);

// ============================================
// Chat Message Bubble
// ============================================

/** Render a DQL query code block (learned from DavisAssistant's inline DQL display) */
const DQLQueryBlock: React.FC<{ dql: string }> = ({ dql }) => (
  <div style={{
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    background: 'var(--dt-colors-background-default-secondary)',
  }}>
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      color: 'var(--dt-colors-text-secondary-default)',
      letterSpacing: '0.5px',
    }}>
      DQL Query
    </span>
    <code style={{
      display: 'block',
      fontSize: 11,
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      marginTop: 4,
      color: 'var(--dt-colors-text-primary-default)',
    }}>
      {dql}
    </code>
  </div>
);

const MessageBubble: React.FC<{
  message: ChatMessage;
  onFollowUp: (query: string) => void;
  isLastAssistant: boolean;
  disabled?: boolean;
}> = ({ message, onFollowUp, isLastAssistant, disabled }) => {
  const isUser = message.role === 'user';

  // Extract DQL from any chart/tool blocks that have it
  const dqlQuery = !isUser && message.blocks
    ? message.blocks
        .filter((b): b is ChartBlock => b.type === 'chart' && !!b.dql)
        .map(b => b.dql)
        .filter(Boolean)[0]
    : undefined;

  return (
    <Flex
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      style={{ width: '100%' }}
    >
      <div style={{
        padding: '12px 16px',
        maxWidth: isUser ? '70%' : '95%',
        minWidth: isUser ? undefined : '60%',
        borderRadius: 8,
        backgroundColor: isUser
          ? 'var(--dt-colors-feedback-info-subtle)'
          : 'var(--dt-colors-surface-default)',
        border: isUser
          ? 'none'
          : '1px solid var(--dt-colors-border-neutral-default)',
      }}>
        <Flex flexDirection="column" gap={4}>
          {/* Role Label + Timestamp (learned from DavisAssistant) */}
          <Flex alignItems="center" gap={6}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {isUser
                ? <HelpIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-primary-default)' }} />
                : <AiIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-accent-default)' }} />
              }
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const }}>
              {isUser ? 'You' : 'GenAI Intelligence'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
              {message.timestamp.toLocaleTimeString()}
            </span>
            {/* Selection badge */}
            {!isUser && message.selectionMethod && (
              <Tooltip text={message.selectionReasoning || `Tool selection: ${message.selectionMethod}`}>
                <span style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 8,
                  backgroundColor: 'var(--dt-colors-background-default-secondary)',
                  color: 'var(--dt-colors-text-secondary-default)',
                }}>
                  {message.selectionMethod === 'ai' ? 'AI-selected' : message.selectionMethod}
                </span>
              </Tooltip>
            )}
            {/* Tool badges */}
            {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
              <Flex gap={4}>
                {message.toolsUsed.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    borderRadius: 8,
                    backgroundColor: 'var(--dt-colors-background-default-secondary)',
                    color: 'var(--dt-colors-text-secondary-default)',
                  }}>
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </Flex>
            )}
          </Flex>

          {/* Content */}
          {message.isLoading ? (
            <Flex alignItems="center" gap={6} style={{ padding: '8px 0' }}>
              <AiIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-accent-default)' }} />
              <span style={{
                color: 'var(--dt-colors-text-secondary-default)',
                fontStyle: 'italic',
                fontSize: 12,
              }}>
                GenAI Intelligence is thinking...
              </span>
            </Flex>
          ) : (
            <>
              {/* Rich blocks */}
              {message.blocks && message.blocks.length > 0 ? (
                <Flex flexDirection="column" gap={4}>
                  {message.content && (
                    <MarkdownText content={message.content} />
                  )}
                  {message.blocks.map((block, i) => (
                    <BlockRenderer key={i} block={block} />
                  ))}
                </Flex>
              ) : (
                <MarkdownText content={message.content} />
              )}

              {/* Inline DQL query display (learned from DavisAssistant) */}
              {dqlQuery && <DQLQueryBlock dql={dqlQuery} />}

              {/* Follow-up chips inside the message (DB Explain Pro style — with separator) */}
              {!isUser && isLastAssistant && message.followUps && message.followUps.length > 0 && (
                <Flex
                  gap={6}
                  flexWrap="wrap"
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '1px solid var(--dt-colors-border-neutral-default)',
                  }}
                >
                  <FollowUpChips chips={message.followUps} onSelect={onFollowUp} disabled={disabled} />
                </Flex>
              )}
            </>
          )}
        </Flex>
      </div>
    </Flex>
  );
};

// ============================================
// (Welcome screen is now inline in the main component, matching DB Explain Pro)
// ============================================

// ============================================
// Session Sidebar (matches DB Explain Pro)
// ============================================

const SessionSidebar: React.FC<{
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isSidebarOpen: boolean;
  onToggle: () => void;
  hoveredSessionId: string | null;
  setHoveredSessionId: (id: string | null) => void;
}> = ({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, isSidebarOpen, onToggle, hoveredSessionId, setHoveredSessionId }) => {
  return (
    <Surface
      style={{
        width: isSidebarOpen ? 280 : 64,
        borderRight: '1px solid var(--dt-colors-border-neutral-default)',
        padding: '16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'width 0.2s ease',
      }}
    >
      <Flex alignItems="center" justifyContent="space-between">
        <Flex alignItems="center" gap={8} style={{ minWidth: 0 }}>
          <ChatIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-text-secondary-default)' }} />
          {isSidebarOpen && <Strong>Chats</Strong>}
        </Flex>
        <Tooltip text={isSidebarOpen ? 'Collapse' : 'Expand'}>
          <Button
            variant="default"
            onClick={onToggle}
            style={{ padding: '6px 8px', minWidth: 32 }}
          >
            {isSidebarOpen ? (
              <ChevronLeftIcon style={{ width: 16, height: 16 }} />
            ) : (
              <ChevronRightIcon style={{ width: 16, height: 16 }} />
            )}
          </Button>
        </Tooltip>
      </Flex>
      <Tooltip text="New chat">
        <Button
          variant="default"
          onClick={onNewSession}
          style={{ justifyContent: 'flex-start', gap: 8, padding: '8px 10px' }}
        >
          <PlusIcon style={{ width: 16, height: 16 }} />
          {isSidebarOpen && <span style={{ fontSize: 12 }}>New chat</span>}
        </Button>
      </Tooltip>
      <Flex flexDirection="column" gap={8} style={{ overflow: 'auto', minHeight: 0 }}>
        {sessions.length === 0 && isSidebarOpen && (
          <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            No chats yet.
          </Text>
        )}
        {sessions.map(session => {
          const isActive = session.id === activeSessionId;
          if (!isSidebarOpen) {
            return (
              <Tooltip key={session.id} text={session.title}>
                <Button
                  variant={isActive ? 'emphasized' : 'default'}
                  onClick={() => onSelectSession(session.id)}
                  style={{ padding: '8px 10px' }}
                >
                  <ChatIcon style={{ width: 16, height: 16 }} />
                </Button>
              </Tooltip>
            );
          }
          const showActions = hoveredSessionId === session.id || isActive;
          return (
            <Flex
              key={session.id}
              gap={8}
              alignItems="stretch"
              onMouseEnter={() => setHoveredSessionId(session.id)}
              onMouseLeave={() => setHoveredSessionId(null)}
            >
              <Button
                variant={isActive ? 'emphasized' : 'default'}
                onClick={() => onSelectSession(session.id)}
                style={{
                  flex: 1,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 10,
                }}
              >
                <Flex alignItems="center" gap={8} style={{ width: '100%' }}>
                  <ChatIcon style={{ width: 14, height: 14 }} />
                  <Flex flexDirection="column" alignItems="flex-start" style={{ gap: 4, overflow: 'hidden' }}>
                    <Strong style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                      {session.title}
                    </Strong>
                    <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
                      {new Date(session.updatedAt).toLocaleString()}
                    </Text>
                  </Flex>
                </Flex>
              </Button>
              <Flex
                gap={4}
                alignItems="center"
                style={{
                  opacity: showActions ? 1 : 0,
                  pointerEvents: showActions ? 'auto' : 'none',
                  transition: 'opacity 120ms ease',
                }}
              >
                <Tooltip text="Delete">
                  <Button
                    variant="default"
                    onClick={() => onDeleteSession(session.id)}
                    style={{ padding: '6px 8px', minWidth: 32 }}
                  >
                    <DeleteIcon style={{ width: 14, height: 14 }} />
                  </Button>
                </Tooltip>
              </Flex>
            </Flex>
          );
        })}
      </Flex>
    </Surface>
  );
};

// ============================================
// Main Intelligence Page
// ============================================

export const Intelligence: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe | null>(createDefaultTimeframe);
  const [showToolGuide, setShowToolGuide] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const recognitionRef = useRef<any>(null);
  const loadingPhaseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Resolve timeframe to string for orchestrator */
  const timeframeStr = useMemo(() => timeframeToString(timeframe), [timeframe]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize sessions on mount
  useEffect(() => {
    const allSessions = listSessions();
    setSessions(allSessions);
    const active = getOrCreateActiveSession();
    setActiveSessionId(active.id);
    setMessages(loadMessages(active.id));
    // Refresh sessions list to include the potentially new one
    setSessions(listSessions());
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading completes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Find the last assistant message index for follow-up chip rendering
  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && !messages[i].isLoading) return i;
    }
    return -1;
  }, [messages]);

  const hasMessages = messages.length > 0;

  // Global Ctrl+L shortcut to toggle tool guide
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setShowToolGuide(prev => !prev);
      }
      if (e.key === 'Escape' && showToolGuide) {
        setShowToolGuide(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showToolGuide]);

  // Voice input via Web Speech API (Chrome / Edge)
  const startVoiceInput = useCallback(async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showToast({ title: 'Not Supported', message: 'Voice input requires Chrome or Edge', type: 'warning' });
      return;
    }

    // Request microphone permission explicitly before starting recognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the stream immediately — we just needed the permission grant
      stream.getTracks().forEach(t => t.stop());
    } catch (permErr: any) {
      const msg = permErr?.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone in your browser settings.'
        : permErr?.name === 'NotFoundError'
          ? 'No microphone found. Please connect a microphone and try again.'
          : `Microphone error: ${permErr?.message || 'Unknown'}. If running inside Dynatrace, open the app at localhost:3000/ui directly.`;
      showToast({ title: 'Microphone Unavailable', message: msg, type: 'critical' });
      return;
    }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setInputValue(finalTranscript || interimTranscript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e: any) => {
      setIsListening(false);
      const errorMap: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Check browser permissions.',
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone found.',
        'network': 'Network error during speech recognition.',
        'aborted': 'Voice input was cancelled.',
      };
      const msg = errorMap[e?.error] || `Speech recognition error: ${e?.error || 'unknown'}`;
      if (e?.error !== 'aborted') {
        showToast({ title: 'Voice Error', message: msg, type: 'critical' });
      }
    };
    recognitionRef.current = rec;
    setIsListening(true);
    try {
      rec.start();
    } catch (startErr) {
      setIsListening(false);
      showToast({ title: 'Voice Error', message: 'Failed to start speech recognition. Try opening the app at localhost:3000/ui directly.', type: 'critical' });
    }
  }, []);

  const stopVoiceInput = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ---- Session Management ----

  const handleNewSession = useCallback(() => {
    const session = createSession();
    setSessions(listSessions());
    setActiveSessionId(session.id);
    setMessages([]);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setMessages(loadMessages(id));
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    const remaining = listSessions();
    setSessions(remaining);
    if (id === activeSessionId) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
        setMessages(loadMessages(remaining[0].id));
      } else {
        const newSession = createSession();
        setSessions(listSessions());
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    }
  }, [activeSessionId]);

  // ---- Send Query ----

  const sendQuery = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: `msg-${Date.now()}-loading`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    const newMessages = [...messages, userMsg, loadingMsg];
    setMessages(newMessages);
    setIsLoading(true);
    setInputValue('');

    try {
      // Get conversation history for context
      const history = getConversationHistory(activeSessionId, 10);

      // Orchestrate — AI tool selection + execution
      const result = await orchestrate(query.trim(), timeframeStr, history);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: result.handled ? result.markdown : getUnhandledResponse(query),
        timestamp: new Date(),
        blocks: result.handled ? result.blocks : getUnhandledBlocks(query),
        toolsUsed: result.toolsUsed,
        followUps: result.followUps || getDefaultFollowUps(),
        selectionMethod: result.selectionMethod,
        selectionReasoning: result.selectionReasoning,
      };

      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);

      // Persist
      saveMessages(activeSessionId, finalMessages);
      setSessions(listSessions());
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : String(err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        blocks: [
          {
            type: 'alert',
            severity: 'warning',
            title: 'Something went wrong',
            message: `I encountered an issue while processing your request. Please try again or rephrase your question.`,
          },
          {
            type: 'text',
            content: `**Error Details**\n\n\`${errDetail}\``,
          },
        ],
        followUps: getDefaultFollowUps(),
      };

      const finalMessages = [...messages, userMsg, errorMsg];
      setMessages(finalMessages);
      saveMessages(activeSessionId, finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeSessionId, timeframeStr]);

  const handleSubmit = useCallback((question?: string) => {
    sendQuery(question || inputValue);
  }, [inputValue, sendQuery]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearConversation = useCallback(() => {
    setMessages([]);
    saveMessages(activeSessionId, []);
    setSessions(listSessions());
  }, [activeSessionId]);

  return (
    <>
    <style>{`@keyframes dtVoicePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.5}}`}</style>
    <Flex style={{ height: '100%' }}>
      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isSidebarOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(prev => !prev)}
        hoveredSessionId={hoveredSessionId}
        setHoveredSessionId={setHoveredSessionId}
      />

      {/* Main Content */}
      <Flex flexDirection="column" style={{ flex: 1, minWidth: 0 }}>
        <Flex flexDirection="column" style={{ height: '100%', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

          {/* Branding — always visible above chat */}
          <Flex
            flexDirection="column"
            alignItems="center"
            style={{ padding: '24px 16px 16px', flexShrink: 0 }}
          >
            <AiIcon style={{ width: 48, height: 48, color: 'var(--dt-colors-text-accent-default)', marginBottom: 16 }} />
            <Flex alignItems="center" gap={8}>
              <Strong style={{ fontSize: 24, marginBottom: 0 }}>GenAI Intelligence</Strong>
              <Tooltip text="Click for tool guide">
                <Button
                  variant="default"
                  onClick={() => setShowToolGuide(prev => !prev)}
                  style={{
                    padding: 4,
                    minWidth: 0,
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HelpIcon style={{ width: 16, height: 16 }} />
                </Button>
              </Tooltip>
              <Tooltip text="Clear conversation">
                <Button
                  variant="default"
                  onClick={handleClearConversation}
                  style={{ padding: 4, minWidth: 0, borderRadius: '50%', width: 28, height: 28 }}
                >
                  <RefreshIcon style={{ width: 16, height: 16 }} />
                </Button>
              </Tooltip>
            </Flex>
            <Text style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', maxWidth: 480, marginTop: 8 }}>
              Ask anything about your GenAI services. I analyze real data from Dynatrace Grail and explain it with GenAI Intelligence.
            </Text>
          </Flex>

          {/* Tool Guide Panel — toggleable help */}
          {showToolGuide && (
            <Surface
              style={{
                margin: '0 16px 12px',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--dt-colors-border-neutral-default)',
                maxHeight: 420,
                overflow: 'auto',
              }}
            >
              <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
                <Strong style={{ fontSize: 16 }}>GenAI Intelligence Tools</Strong>
                <Button variant="default" onClick={() => setShowToolGuide(false)} style={{ padding: '2px 8px', fontSize: 12 }}>
                  Close
                </Button>
              </Flex>
              <Text style={{ fontSize: 13, color: 'var(--dt-colors-text-secondary-default)', marginBottom: 16 }}>
                Click any prompt to try it. Tools are organized by tier: Observe (data retrieval), Analyze (AI insights), and Act (recommendations).
              </Text>
              {TOOL_HELP_GUIDE.map((tierGroup) => (
                <Flex key={tierGroup.tier} flexDirection="column" style={{ marginBottom: 16 }}>
                  <Flex alignItems="center" gap={8} style={{ marginBottom: 8 }}>
                    <Strong style={{
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: tierGroup.color,
                      letterSpacing: '0.5px',
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: tierGroup.color + '15',
                    }}>
                      {tierGroup.tier}
                    </Strong>
                  </Flex>
                  <Flex flexDirection="column" gap={4}>
                    {tierGroup.tools.map((tool, ti) => (
                      <Flex
                        key={ti}
                        gap={12}
                        alignItems="center"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                        }}
                        onClick={() => {
                          setShowToolGuide(false);
                          handleSubmit(tool.prompt);
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--dt-colors-surface-neutral-default)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <Strong style={{ fontSize: 12, minWidth: 140 }}>{tool.name}</Strong>
                        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)', flex: 1 }}>{tool.desc}</Text>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-accent-default)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>"{tool.prompt}"</Text>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              ))}
            </Surface>
          )}

          {/* Chat Area */}
          <Flex
            flexDirection="column"
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '0 16px',
              minHeight: 0,
            }}
          >
            {/* Welcome — shown when no messages */}
            {!hasMessages && !isLoading && (
              <Flex
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                style={{ flex: 1 }}
              />
            )}

            {/* Messages */}
            {hasMessages && (
              <Flex flexDirection="column" style={{ paddingTop: 16 }} gap={12}>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onFollowUp={sendQuery}
                    isLastAssistant={idx === lastAssistantIdx}
                    disabled={isLoading}
                  />
                ))}
              </Flex>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <Flex flexDirection="column" gap={6} style={{ padding: 16 }}>
                <Flex alignItems="center" gap={12}>
                  <ProgressCircle size="small" />
                  <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                    {['Analyzing your question\u2026', 'Querying Dynatrace Grail\u2026', 'Running AI intelligence\u2026', 'Preparing response\u2026'][loadingPhase]}
                  </Text>
                </Flex>
              </Flex>
            )}

            <div ref={messagesEndRef} />
          </Flex>

          {/* Input Area — always at the bottom */}
          <Flex flexDirection="column" style={{ padding: '12px 16px', borderTop: hasMessages ? '1px solid var(--dt-colors-border-neutral-default)' : 'none' }}>
            {/* Filter bar: Timeframe */}
            <Flex gap={8} alignItems="center" style={{ marginBottom: 8 }}>
              <Tooltip text="Data timeframe for queries">
                <div>
                  <TimeframeSelector
                    value={timeframe}
                    onChange={(tf) => setTimeframe(tf)}
                  />
                </div>
              </Tooltip>
            </Flex>
            {/* Text input + Send */}
            <Flex gap={12} alignItems="center">
              <Tooltip text={isListening ? 'Stop listening' : 'Voice input — click, then speak your question'}>
                <Button
                  variant={isListening ? 'emphasized' : 'default'}
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  style={{ padding: '6px 10px', minWidth: 36, position: 'relative' }}
                >
                  {/* Inline mic SVG */}
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  {isListening && (
                    <span style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 7, height: 7, borderRadius: '50%',
                      backgroundColor: '#dc2626',
                      boxShadow: '0 0 0 0 #dc2626',
                      animation: 'dtVoicePulse 1.2s ease-in-out infinite',
                    }} />
                  )}
                </Button>
              </Tooltip>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    // Auto-expand height
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={handleKeyPress as any}
                  placeholder="Ask about your GenAI services, agents, models, costs..."
                  disabled={isLoading}
                  rows={1}
                  style={{
                    resize: 'none',
                    minHeight: 38,
                    maxHeight: 120,
                    overflowY: 'auto',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--dt-colors-border-neutral-default)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--dt-colors-background-base-default)',
                    color: 'var(--dt-colors-text-primary-default)',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              <Tooltip text="Send message">
                <Button
                  variant="emphasized"
                  onClick={() => handleSubmit()}
                  disabled={!inputValue.trim() || isLoading}
                >
                  Send
                </Button>
              </Tooltip>
            </Flex>
            <Text style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)', marginTop: 4, textAlign: 'center' }}>
              GenAI Intelligence &bull; Deterministic DQL + AI Explanation
            </Text>
          </Flex>

        </Flex>
      </Flex>
    </Flex>
    </>
  );
};

// ============================================
// Helpers
// ============================================

function getUnhandledResponse(_query: string): string {
  return '';
}

function getUnhandledBlocks(query: string): MessageBlock[] {
  return [
    {
      type: 'alert',
      severity: 'info',
      title: 'No specific tool matched',
      message: `I couldn't find a specialized tool for "${query}". Try one of the suggestions below, or rephrase your question.`,
    },
    {
      type: 'text',
      content: listAvailableTools(),
    },
  ];
}

function getDefaultFollowUps(): FollowUpChip[] {
  return [
    { label: 'Service overview', query: 'How are my AI services doing?' },
    { label: 'Cost breakdown', query: 'Show me cost breakdown by provider and model' },
    { label: 'Check for anomalies', query: 'Are there any anomalies in my AI services?' },
  ];
}

export default Intelligence;
