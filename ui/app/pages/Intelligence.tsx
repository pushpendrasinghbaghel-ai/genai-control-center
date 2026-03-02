// GenAI Control Center — Dynatrace Intelligence
// Single full-width chat window with agentic tool orchestration
// Terminology: "Dynatrace Intelligence" (Perform 2026), not "Davis"

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text, Strong } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  AiIcon,
  HelpIcon,
  DeleteIcon,
  PlusIcon,
  ExternalLinkIcon,
  CheckmarkIcon,
  CriticalIcon,
  WarningIcon,
  RefreshIcon,
} from '@dynatrace/strato-icons';
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

const DEFAULT_TIMEFRAME = '2h';

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
      return <Text style={{ whiteSpace: 'pre-wrap' }}>{block.content}</Text>;
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
  <Flex gap={8} flexWrap="wrap" style={{ marginTop: 8 }}>
    {chips.map((chip, i) => (
      <Button
        key={i}
        variant="default"
        onClick={() => onSelect(chip.query)}
        disabled={disabled}
        style={{
          fontSize: 12,
          padding: '4px 12px',
          borderRadius: 16,
        }}
      >
        {chip.label}
      </Button>
    ))}
  </Flex>
);

// ============================================
// Chat Message Bubble
// ============================================

const MessageBubble: React.FC<{
  message: ChatMessage;
  onFollowUp: (query: string) => void;
  isLastAssistant: boolean;
  disabled?: boolean;
}> = ({ message, onFollowUp, isLastAssistant, disabled }) => {
  const isUser = message.role === 'user';

  return (
    <Flex
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      style={{ width: '100%' }}
    >
      <Surface style={{
        padding: '12px 16px',
        maxWidth: isUser ? '70%' : '95%',
        minWidth: isUser ? undefined : '60%',
        backgroundColor: isUser
          ? 'rgba(99, 102, 241, 0.08)'
          : 'rgba(255, 255, 255, 0.95)',
        border: isUser ? '1px solid rgba(99, 102, 241, 0.2)' : undefined,
      }}>
        <Flex flexDirection="column" gap={4}>
          {/* Role Label */}
          <Flex gap={4} alignItems="center">
            {isUser
              ? <HelpIcon style={{ width: 14, height: 14, color: Colors.Text.Primary.Default }} />
              : <AiIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-accent-default)' }} />
            }
            <Text textStyle="small" style={{
              color: isUser ? Colors.Text.Primary.Default : Colors.Text.Neutral.Subdued,
              fontWeight: 600,
            }}>
              {isUser ? 'You' : 'Dynatrace Intelligence'}
            </Text>
            {/* Selection badge for assistant messages */}
            {!isUser && message.selectionMethod && (
              <Tooltip text={message.selectionReasoning || `Tool selection: ${message.selectionMethod}`}>
                <Text textStyle="small" style={{
                  color: Colors.Text.Neutral.Subdued,
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(0,0,0,0.04)',
                }}>
                  {message.selectionMethod === 'ai' ? 'Dynatrace Intelligence' : message.selectionMethod}
                </Text>
              </Tooltip>
            )}
            {/* Tool badges */}
            {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
              <Flex gap={4}>
                {message.toolsUsed.map((t, i) => (
                  <Text key={i} textStyle="small" style={{
                    color: Colors.Text.Neutral.Subdued,
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(0,0,0,0.04)',
                  }}>
                    {t.replace(/_/g, ' ')}
                  </Text>
                ))}
              </Flex>
            )}
          </Flex>

          {/* Content */}
          {message.isLoading ? (
            <Flex alignItems="center" gap={8} style={{ padding: '12px 0' }}>
              <ProgressCircle size="small" />
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                Analyzing with Dynatrace Intelligence...
              </Text>
            </Flex>
          ) : (
            <>
              {/* Rich blocks */}
              {message.blocks && message.blocks.length > 0 ? (
                <Flex flexDirection="column" gap={4}>
                  {/* Summary text */}
                  {message.content && (
                    <Text style={{ whiteSpace: 'pre-wrap', marginBottom: 4 }}>{message.content}</Text>
                  )}
                  {/* Native block rendering */}
                  {message.blocks.map((block, i) => (
                    <BlockRenderer key={i} block={block} />
                  ))}
                </Flex>
              ) : (
                <Text style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
              )}

              {/* Follow-up chips (only on the last assistant message) */}
              {!isUser && isLastAssistant && message.followUps && message.followUps.length > 0 && (
                <FollowUpChips
                  chips={message.followUps}
                  onSelect={onFollowUp}
                  disabled={disabled}
                />
              )}
            </>
          )}
        </Flex>
      </Surface>
    </Flex>
  );
};

// ============================================
// Welcome Screen
// ============================================

const WelcomeScreen: React.FC<{
  onSendQuery: (query: string) => void;
}> = ({ onSendQuery }) => {
  const quickInvestigations = getQuickInvestigations();

  return (
    <Flex
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={24}
      style={{ flex: 1, padding: 40 }}
    >
      <Flex flexDirection="column" alignItems="center" gap={8}>
        <AiIcon style={{ width: 48, height: 48, color: 'var(--dt-colors-text-accent-default)' }} />
        <Heading level={3}>Dynatrace Intelligence</Heading>
        <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 500 }}>
          Your agentic AI companion for GenAI observability. Ask questions in natural language —
          I'll automatically select and execute the right analysis tools.
        </Text>
      </Flex>

      {/* Quick Investigation Chips */}
      <Flex flexDirection="column" gap={8} alignItems="center">
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          Quick Investigations
        </Text>
        <Flex gap={8} flexWrap="wrap" justifyContent="center" style={{ maxWidth: 600 }}>
          {quickInvestigations.map((q, i) => (
            <Button
              key={i}
              variant="default"
              onClick={() => onSendQuery(q.query)}
              style={{
                fontSize: 13,
                padding: '6px 16px',
                borderRadius: 20,
              }}
            >
              {q.label}
            </Button>
          ))}
        </Flex>
      </Flex>

      {/* Examples */}
      <Flex flexDirection="column" gap={4} alignItems="center">
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          Try asking:
        </Text>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
          "How are my AI services doing?" • "Compare OpenAI vs Anthropic" • "Forecast token usage"
        </Text>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
          "Why is latency high?" • "Which model is cheapest?" • "Detect anomalies"
        </Text>
      </Flex>
    </Flex>
  );
};

// ============================================
// Session Sidebar
// ============================================

const SessionSidebar: React.FC<{
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, collapsed, onToggle }) => {
  if (collapsed) {
    return (
      <Flex flexDirection="column" gap={8} style={{ width: 40, padding: '12px 4px', alignItems: 'center' }}>
        <Tooltip text="Expand sessions">
          <Button variant="default" onClick={onToggle} aria-label="Expand sessions">
            <ExternalLinkIcon />
          </Button>
        </Tooltip>
        <Tooltip text="New session">
          <Button variant="default" onClick={onNewSession} aria-label="New session">
            <PlusIcon />
          </Button>
        </Tooltip>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={8} style={{
      width: 220,
      padding: 12,
      borderRight: '1px solid rgba(0,0,0,0.08)',
      overflowY: 'auto',
    }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text textStyle="small" style={{ fontWeight: 600, color: Colors.Text.Neutral.Subdued }}>
          Sessions
        </Text>
        <Flex gap={4}>
          <Tooltip text="New session">
            <Button variant="default" onClick={onNewSession} aria-label="New session">
              <PlusIcon />
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

      <Flex flexDirection="column" gap={4}>
        {sessions.map(s => (
          <Flex
            key={s.id}
            justifyContent="space-between"
            alignItems="center"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: s.id === activeSessionId
                ? 'rgba(99, 102, 241, 0.1)'
                : 'transparent',
            }}
            onClick={() => onSelectSession(s.id)}
          >
            <Text textStyle="small" style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: s.id === activeSessionId ? 600 : 400,
            }}>
              {s.title}
            </Text>
            <Tooltip text="Delete session">
              <Button
                variant="default"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDeleteSession(s.id);
                }}
                aria-label="Delete session"
                style={{ padding: 2, minWidth: 'auto' }}
              >
                <DeleteIcon style={{ width: 12, height: 12 }} />
              </Button>
            </Tooltip>
          </Flex>
        ))}
        {sessions.length === 0 && (
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, fontStyle: 'italic' }}>
            No sessions yet
          </Text>
        )}
      </Flex>
    </Flex>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      const result = await orchestrate(query.trim(), DEFAULT_TIMEFRAME, history);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: result.handled ? result.markdown : getUnhandledResponse(query),
        timestamp: new Date(),
        blocks: result.blocks,
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
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `I encountered an issue while processing your request: ${err instanceof Error ? err.message : String(err)}. Please try again or rephrase your question.`,
        timestamp: new Date(),
        blocks: [{
          type: 'alert',
          severity: 'warning',
          title: 'Analysis Error',
          message: err instanceof Error ? err.message : String(err),
        }],
        followUps: getDefaultFollowUps(),
      };

      const finalMessages = [...messages, userMsg, errorMsg];
      setMessages(finalMessages);
      saveMessages(activeSessionId, finalMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeSessionId]);

  const handleSubmit = useCallback(() => {
    sendQuery(inputValue);
  }, [inputValue, sendQuery]);

  const handleClearConversation = useCallback(() => {
    setMessages([]);
    saveMessages(activeSessionId, []);
    setSessions(listSessions());
  }, [activeSessionId]);

  return (
    <Flex flexDirection="column" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <AiIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Dynatrace Intelligence</TitleBar.Title>
        <TitleBar.Subtitle>Agentic GenAI observability • Natural language investigation</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8}>
            <Button variant="default" onClick={handleClearConversation} aria-label="Clear conversation">
              <RefreshIcon /> Clear
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Main Content: Sidebar + Chat */}
      <Flex style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Session Sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Chat Area */}
        <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Messages */}
          <Flex
            flexDirection="column"
            gap={12}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 24px',
            }}
          >
            {messages.length === 0 ? (
              <WelcomeScreen onSendQuery={sendQuery} />
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onFollowUp={sendQuery}
                  isLastAssistant={idx === lastAssistantIdx}
                  disabled={isLoading}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </Flex>

          {/* Input Bar */}
          <Surface style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(0,0,0,0.08)',
          }}>
            <Flex gap={8} alignItems="center">
              <Flex style={{ flex: 1 }}>
                <TextInput
                  placeholder="Ask about your GenAI services..."
                  value={inputValue}
                  onChange={(value) => setInputValue(value ?? '')}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </Flex>
              <Button
                variant="emphasized"
                onClick={handleSubmit}
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? (
                  <Flex gap={4} alignItems="center">
                    <ProgressCircle size="small" />
                    Analyzing...
                  </Flex>
                ) : (
                  'Send'
                )}
              </Button>
            </Flex>
            <Text textStyle="small" style={{
              color: Colors.Text.Neutral.Subdued,
              marginTop: 4,
              fontSize: 11,
            }}>
              Powered by Dynatrace Intelligence — agentic analysis with DQL, forecasting, and anomaly detection
            </Text>
          </Surface>
        </Flex>
      </Flex>
    </Flex>
  );
};

// ============================================
// Helpers
// ============================================

function getUnhandledResponse(query: string): string {
  return `I wasn't able to find a specific analysis tool for "${query}". Here's what I can help with:\n\n${listAvailableTools()}\n\nTry rephrasing your question or pick one of the suggestions below.`;
}

function getDefaultFollowUps(): FollowUpChip[] {
  return [
    { label: 'Service Health', query: 'How are my AI services doing?' },
    { label: 'Cost Analysis', query: 'Show me cost breakdown by provider' },
    { label: 'Detect Anomalies', query: 'Are there any anomalies in my AI services?' },
  ];
}

export default Intelligence;
