// GenAI Control Center - Agent Tools Hook
// Monitors AI agent tool usage, detects infinite loops, and tracks tool flows

import React, { useState, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { QueryFilters } from './useDQLQueries';
import { buildTimeRangeClauseFromTimeframe } from '../queries/dql-queries';

// ============================================
// Types
// ============================================

export interface ToolUsage {
  toolName: string;
  callCount: number;
  avgDuration: number;  // in ms
  errorCount: number;
  errorRate: number;
  uniqueTraces: number;
  avgCallsPerTrace: number;
}

export interface AgentInfo {
  agentName: string;
  traceCount: number;
  toolCallCount: number;
  avgToolsPerTrace: number;
  avgDuration: number;
  errorCount: number;
  errorRate: number;
  sampleTraceId?: string;
  lastSeen?: string;
}

export interface AgentFlow {
  agentName: string;
  toolSequence: string[];
  occurrences: number;
  avgDuration: number;
  toolCount: number;    // Number of unique tools in this flow
  traceId?: string;     // Sample trace ID for linking to distributed traces
  timestamp?: string;   // Timestamp of the sample trace
}

export interface SuspiciousLoop {
  toolName: string;
  traceId: string;
  callCount: number;
  totalDuration: number;
  agentName: string;
  detectedAt: string;
}

export interface AgentToolsSummary {
  totalToolCalls: number;
  uniqueTools: number;
  avgCallsPerTrace: number;
  totalAgents: number;
  suspiciousLoopCount: number;
  topTool: string;
  topToolCalls: number;
}

// New types for enhanced analytics
export interface AgentTokenCost {
  agentName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  llmCalls: number;
  estimatedCostUsd: number;
}

export interface AgentHandoff {
  sourceAgent: string;
  targetAgent: string;
  handoffCount: number;
  avgDurationMs: number;
}

export interface AgentLatencyBreakdown {
  agentName: string;
  llmTimeMs: number;
  toolTimeMs: number;
  totalTimeMs: number;
  llmCalls: number;
  toolCalls: number;
  llmPct: number;
  toolPct: number;
}

// Retry pattern tracking
// Agent Tool Reliability - shows tool usage patterns and reliability metrics per agent
export interface AgentToolReliability {
  agentName: string;
  toolName: string;
  totalCalls: number;
  errorCount: number;
  tracesCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  errorRate: number;
  callsPerTrace: number;
}

// Tool co-occurrence for topology
export interface ToolCoOccurrence {
  tool1: string;
  tool2: string;
  coOccurrenceCount: number;
  avgSequenceGap: number;  // How many steps apart they typically are
}

// Time-series trend data for charts
export interface ToolCallsTrend {
  timestamp: string;
  callCount: number;
  uniqueTools: number;
}

export interface AgentActivityTrend {
  timestamp: string;
  agentName: string;
  invocationCount: number;
  avgDurationMs: number;
}

// NEW: Agent → Backend Service Dependencies
export interface AgentServiceDependency {
  agentName: string;
  serviceName: string;
  serviceType: 'http' | 'database' | 'messaging' | 'grpc' | 'other';
  entityId?: string;
  callCount: number;
  avgLatencyMs: number;
  errorRate: number;
  lastSeen: string;
}

// NEW: Agent → LLM Provider Relationships
export interface AgentLLMProvider {
  agentName: string;
  provider: string;
  model: string;
  callCount: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorRate: number;
  estimatedCostUsd: number;
}

// NEW: Agent with Dynatrace Entity Mapping
export interface AgentEntityMapping {
  agentName: string;
  entityId: string;
  entityName: string;
  traceCount: number;
  avgDuration: number;
}

// ============================================
// DQL Queries
// ============================================

const buildTimeFilter = (filters?: QueryFilters): string => {
  return buildTimeRangeClauseFromTimeframe(filters?.timeframe);
};

// Tool Usage Query - aggregates tool calls with correct error detection
const TOOL_USAGE_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| fieldsAdd is_error = if(otel.status_code == "ERROR" OR span.status == "error" OR isNotNull(error.type), then: 1, else: 0)
| summarize 
    call_count = count(),
    avg_duration = avg(duration) / 1000000,
    error_count = sum(is_error),
    unique_traces = countDistinct(trace.id),
    by: { tool_name }
| fieldsAdd error_rate = if(call_count > 0, then: toDouble(error_count) / toDouble(call_count) * 100, else: 0.0)
| fieldsAdd avg_calls_per_trace = if(unique_traces > 0, then: toDouble(call_count) / toDouble(unique_traces), else: 0.0)
| sort call_count desc
| limit 50
`;

// Agent List Query - get all agents with their metrics
// This query finds agents and counts errors from agent spans directly
const AGENT_LIST_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| fieldsAdd is_error = if(otel.status_code == "ERROR" OR span.status == "error" OR isNotNull(error.type) OR otel.status_code == "2", then: 1, else: 0)
| summarize 
    trace_count = countDistinct(trace.id),
    total_duration = sum(duration) / 1000000,
    error_count = sum(is_error),
    span_count = count(),
    sample_trace_id = takeFirst(trace.id),
    last_seen = max(start_time),
    by: { agent_name }
| fieldsAdd avg_duration = if(span_count > 0, then: total_duration / span_count, else: 0.0)
| fieldsAdd error_rate = if(span_count > 0, then: toDouble(error_count) / toDouble(span_count) * 100, else: 0.0)
| filter agent_name != "Unknown Agent"
| sort trace_count desc
| limit 50
`;

// Tool calls per agent query - to get tool call counts for each agent
const AGENT_TOOL_CALLS_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | fields trace.id, agent_name
  ], sourceField:trace.id, lookupField:trace.id, prefix:"agent."
| filter isNotNull(agent.agent_name)
| summarize 
    tool_call_count = count(),
    unique_traces = countDistinct(trace.id),
    by: { agent_name = agent.agent_name }
| fieldsAdd avg_tools_per_trace = if(unique_traces > 0, then: toDouble(tool_call_count) / toDouble(unique_traces), else: 0.0)
`;

// Loop Detection Query - finds traces with suspicious tool call patterns
const LOOP_DETECTION_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| summarize 
    tool_calls = count(),
    total_duration = sum(duration) / 1000000,
    detected_at = max(start_time),
    by: { trace_id = trace.id, tool_name }
| filter tool_calls > 10
| sort tool_calls desc
| limit 20
`;

// Agent Flow Query - shows tool calling sequences with sample trace for linking
const AGENT_FLOW_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| summarize 
    tool_sequence = collectDistinct(tool_name),
    call_count = count(),
    avg_duration = avg(duration) / 1000000,
    latest_timestamp = max(start_time),
    by: { trace_id = trace.id }
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace_id, lookupField:trace_id, prefix:"lookup."
| fieldsAdd agent_name = coalesce(lookup.agent_name, "Unknown Agent")
| summarize 
    occurrences = count(),
    avg_duration = avg(avg_duration),
    avg_tool_calls = avg(call_count),
    sample_trace_id = takeFirst(trace_id),
    sample_timestamp = max(latest_timestamp),
    by: { agent_name, tool_sequence }
| sort occurrences desc
| limit 100
`;

// Summary Query - high-level metrics
const SUMMARY_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| summarize 
    total_calls = count(),
    unique_tools = countDistinct(tool_name),
    unique_traces = countDistinct(trace.id)
| fieldsAdd avg_calls_per_trace = if(unique_traces > 0, then: toDouble(total_calls) / toDouble(unique_traces), else: 0.0)
`;

// Agent Count Query - separate query for counting unique agents
const AGENT_COUNT_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| summarize unique_agents = countDistinct(agent_name)
`;

// Token Cost per Agent Query
const AGENT_TOKEN_COST_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| fieldsAdd input_tokens = toLong(gen_ai.usage.input_tokens)
| fieldsAdd output_tokens = toLong(gen_ai.usage.output_tokens)
| summarize 
    total_input_tokens = sum(input_tokens),
    total_output_tokens = sum(output_tokens),
    llm_calls = countIf(isNotNull(gen_ai.usage.input_tokens)),
    by: { agent_name }
| fieldsAdd total_tokens = total_input_tokens + total_output_tokens
| fieldsAdd est_cost_usd = (toDouble(total_input_tokens) * 0.00000015) + (toDouble(total_output_tokens) * 0.0000006)
| sort total_tokens desc
`;

// Agent Handoff Query - tracks transfers between agents
// Agent Handoff Query - tracks transfers between agents (normalized to lowercase for consistency)
const AGENT_HANDOFF_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| filter contains(tool_name, "transfer_to")
| fieldsAdd target_agent = lower(replaceString(replaceString(tool_name, "transfer_to_", ""), ".tool", ""))
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = lower(coalesce(gen_ai.agent.name, traceloop.entity.name, span.name))
    | summarize source_agent = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace.id, lookupField:trace_id, prefix:"src."
| fieldsAdd source_agent = coalesce(src.source_agent, "unknown")
| summarize 
    handoff_count = count(),
    avg_duration_ms = avg(duration) / 1000000,
    by: { source_agent, target_agent }
| sort handoff_count desc
`;

// Agent Latency Breakdown Query - LLM time vs Tool time
const AGENT_LATENCY_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| filter span.name == "AzureChatOpenAI.chat"
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| summarize 
    llm_time_ns = sum(duration),
    llm_calls = count(),
    by: { agent_name }
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
    | lookup [
        fetch spans, ${buildTimeFilter(filters)}
        | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
        | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
        | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
      ], sourceField:trace.id, lookupField:trace_id, prefix:"a."
    | summarize tool_time_ns = sum(duration), tool_calls = count(), by: { agent_name = a.agent_name }
  ], sourceField:agent_name, lookupField:agent_name, prefix:"tool."
| fieldsAdd tool_time_ns = coalesce(tool.tool_time_ns, 0)
| fieldsAdd tool_calls = coalesce(tool.tool_calls, 0)
| fieldsAdd total_time_ns = llm_time_ns + tool_time_ns
| fieldsAdd llm_time_ms = llm_time_ns / 1000000
| fieldsAdd tool_time_ms = tool_time_ns / 1000000
| fieldsAdd total_time_ms = total_time_ns / 1000000
| fieldsAdd llm_pct = (llm_time_ns * 100) / total_time_ns
| fieldsAdd tool_pct = (tool_time_ns * 100) / total_time_ns
| sort total_time_ms desc
`;

// Agent Tool Reliability Query - shows tool usage patterns per agent
// Includes metrics useful for identifying retry candidates and reliability issues
const AGENT_TOOL_RELIABILITY_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = lower(coalesce(gen_ai.tool.name, span.name, "unknown"))
| fieldsAdd is_error = if(span.status.code == "ERROR", then: 1, else: 0)
| fieldsAdd duration_ms = toDouble(duration) / 1000000.0
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = lower(coalesce(gen_ai.agent.name, traceloop.entity.name, span.name))
    | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace.id, lookupField:trace_id, prefix:"a."
| fieldsAdd agent_name = coalesce(a.agent_name, "unknown")
| summarize 
    total_calls = count(),
    error_count = sum(is_error),
    traces_count = countDistinct(trace.id),
    avg_duration_ms = avg(duration_ms),
    p95_duration_ms = percentile(duration_ms, 95),
    by: { agent_name, tool_name }
| fieldsAdd 
    error_rate = 100.0 * toDouble(error_count) / toDouble(total_calls),
    calls_per_trace = toDouble(total_calls) / toDouble(traces_count)
| filter total_calls >= 5
| sort total_calls desc
| limit 50
`;

// Tool Co-occurrence Query - finds tools that appear together in traces
const TOOL_COOCCURRENCE_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = lower(coalesce(gen_ai.tool.name, span.name, "unknown"))
| summarize tools = collectDistinct(tool_name), tool_count = count(), by: { trace_id = trace.id }
| filter tool_count >= 2
| expand tool1 = tools
| expand tool2 = tools
| filter tool1 < tool2
| summarize 
    co_occurrence_count = count(),
    by: { tool1, tool2 }
| sort co_occurrence_count desc
| limit 50
`;

// Tool Calls Trend - time-series of tool call volume over time
const TOOL_CALLS_TREND_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown")
| summarize 
    call_count = count(),
    unique_tools = countDistinct(tool_name),
    by: { time_bucket = bin(start_time, 1h) }
| sort time_bucket asc
`;

// Agent Activity Trend - time-series of agent invocations per agent
const AGENT_ACTIVITY_TREND_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| summarize 
    invocation_count = countDistinct(trace.id),
    avg_duration_ms = avg(duration) / 1000000,
    by: { agent_name, time_bucket = bin(start_time, 1h) }
| sort time_bucket asc, invocation_count desc
| limit 500
`;

// NEW: Agent → Backend Service Dependencies Query
// Finds HTTP, database, and other service calls made within agent traces
const AGENT_SERVICE_DEPENDENCIES_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter isNotNull(http.url) OR isNotNull(db.system) OR isNotNull(rpc.system) OR isNotNull(messaging.system)
| fieldsAdd service_type = if(isNotNull(db.system), then: "database", 
    else: if(isNotNull(http.url), then: "http",
    else: if(isNotNull(rpc.system), then: "grpc",
    else: if(isNotNull(messaging.system), then: "messaging", else: "other"))))
| fieldsAdd service_name = coalesce(
    db.system,
    http.host,
    rpc.service,
    messaging.destination.name,
    peer.service,
    server.address,
    net.peer.name,
    span.name
  )
| fieldsAdd is_error = if(otel.status_code == "ERROR" OR span.status == "error" OR http.status_code >= 400, then: 1, else: 0)
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace.id, lookupField:trace_id, prefix:"agent."
| filter isNotNull(agent.agent_name)
| summarize 
    call_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    error_count = sum(is_error),
    last_seen = max(start_time),
    entity_id = takeFirst(dt.entity.service),
    by: { agent_name = agent.agent_name, service_name, service_type }
| fieldsAdd error_rate = if(call_count > 0, then: 100.0 * toDouble(error_count) / toDouble(call_count), else: 0.0)
| sort call_count desc
| limit 100
`;

// NEW: Agent → LLM Provider Relationships Query
// Shows which AI providers/models each agent uses
const AGENT_LLM_PROVIDER_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter isNotNull(gen_ai.request.model)
| fieldsAdd is_error = if(otel.status_code == "ERROR" OR span.status == "error", then: 1, else: 0)
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace.id, lookupField:trace_id, prefix:"agent."
| filter isNotNull(agent.agent_name)
| summarize 
    call_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    total_input_tokens = sum(toLong(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))),
    total_output_tokens = sum(toLong(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))),
    error_count = sum(is_error),
    by: { agent_name = agent.agent_name, provider = gen_ai.provider.name, model = gen_ai.request.model }
| fieldsAdd error_rate = if(call_count > 0, then: 100.0 * toDouble(error_count) / toDouble(call_count), else: 0.0)
| fieldsAdd est_cost_usd = (toDouble(total_input_tokens) * 0.00000015) + (toDouble(total_output_tokens) * 0.0000006)
| sort call_count desc
| limit 100
`;

// NEW: Agent → Dynatrace Entity Mapping Query
// Maps agents to their host Dynatrace service entities
const AGENT_ENTITY_MAPPING_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| filter isNotNull(dt.entity.service)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| summarize 
    trace_count = countDistinct(trace.id),
    avg_duration = avg(duration) / 1000000,
    entity_name = takeFirst(service.name),
    by: { agent_name, entity_id = dt.entity.service }
| sort trace_count desc
| limit 50
`;

// ============================================
// Main Hook
// ============================================

export function useAgentTools(filters?: QueryFilters) {
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [suspiciousLoops, setSuspiciousLoops] = useState<SuspiciousLoop[]>([]);
  const [agentFlows, setAgentFlows] = useState<AgentFlow[]>([]);
  const [summary, setSummary] = useState<AgentToolsSummary | null>(null);
  const [agentTokenCosts, setAgentTokenCosts] = useState<AgentTokenCost[]>([]);
  const [agentHandoffs, setAgentHandoffs] = useState<AgentHandoff[]>([]);
  const [agentLatency, setAgentLatency] = useState<AgentLatencyBreakdown[]>([]);
  const [agentToolReliability, setAgentToolReliability] = useState<AgentToolReliability[]>([]);
  const [toolCoOccurrence, setToolCoOccurrence] = useState<ToolCoOccurrence[]>([]);
  const [toolCallsTrend, setToolCallsTrend] = useState<ToolCallsTrend[]>([]);
  const [agentActivityTrend, setAgentActivityTrend] = useState<AgentActivityTrend[]>([]);
  const [agentServiceDeps, setAgentServiceDeps] = useState<AgentServiceDependency[]>([]);
  const [agentLLMProviders, setAgentLLMProviders] = useState<AgentLLMProvider[]>([]);
  const [agentEntityMappings, setAgentEntityMappings] = useState<AgentEntityMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to always have latest filters in callback
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  const fetchAgentToolsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Use the ref to get current filters
    const currentFilters = filtersRef.current;
    
    // Debug: log the query being generated
    console.log('[GCC] Agent tools query timefilter:', buildTimeRangeClauseFromTimeframe(currentFilters?.timeframe));

    try {
      // Execute all queries in parallel
      const [usageResponse, loopResponse, flowResponse, summaryResponse, agentCountResponse, agentListResponse, agentToolCallsResponse, tokenCostResponse, handoffResponse, latencyResponse, retryResponse, coOccurrenceResponse, toolCallsTrendResponse, agentActivityTrendResponse, serviceDepsResponse, llmProviderResponse, entityMappingResponse] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: {
            query: TOOL_USAGE_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: LOOP_DETECTION_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_FLOW_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: SUMMARY_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_COUNT_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_LIST_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_TOOL_CALLS_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_TOKEN_COST_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_HANDOFF_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_LATENCY_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_TOOL_RELIABILITY_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: TOOL_COOCCURRENCE_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: TOOL_CALLS_TREND_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_ACTIVITY_TREND_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        // NEW: Agent Service Dependencies
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_SERVICE_DEPENDENCIES_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        // NEW: Agent LLM Providers
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_LLM_PROVIDER_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        // NEW: Agent Entity Mappings
        queryExecutionClient.queryExecute({
          body: {
            query: AGENT_ENTITY_MAPPING_QUERY(currentFilters),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        })
      ]);

      // Process tool usage
      const usageRecords = usageResponse.result?.records || [];
      const processedUsage: ToolUsage[] = usageRecords.map((record: any) => ({
        toolName: String(record.tool_name || 'Unknown').replace('.tool', ''),
        callCount: Number(record.call_count) || 0,
        avgDuration: Number(record.avg_duration) || 0,
        errorCount: Number(record.error_count) || 0,
        errorRate: Number(record.error_rate) || 0,
        uniqueTraces: Number(record.unique_traces) || 0,
        avgCallsPerTrace: Number(record.avg_calls_per_trace) || 0
      }));
      setToolUsage(processedUsage);

      // Process agent list with tool call counts
      const agentListRecords = agentListResponse.result?.records || [];
      const agentToolCallsRecords = agentToolCallsResponse.result?.records || [];
      const toolCallsMap = new Map<string, { toolCallCount: number; avgToolsPerTrace: number }>();
      agentToolCallsRecords.forEach((r: any) => {
        toolCallsMap.set(String(r.agent_name), {
          toolCallCount: Number(r.tool_call_count) || 0,
          avgToolsPerTrace: Number(r.avg_tools_per_trace) || 0
        });
      });
      
      const processedAgentList: AgentInfo[] = agentListRecords.map((record: any) => {
        const agentName = String(record.agent_name || 'Unknown');
        const toolData = toolCallsMap.get(agentName) || { toolCallCount: 0, avgToolsPerTrace: 0 };
        return {
          agentName,
          traceCount: Number(record.trace_count) || 0,
          toolCallCount: toolData.toolCallCount,
          avgToolsPerTrace: toolData.avgToolsPerTrace,
          avgDuration: Number(record.avg_duration) || 0,
          errorCount: Number(record.error_count) || 0,
          errorRate: Number(record.error_rate) || 0,
          sampleTraceId: record.sample_trace_id ? String(record.sample_trace_id) : undefined,
          lastSeen: record.last_seen ? new Date(record.last_seen).toISOString() : undefined
        };
      });
      setAgentList(processedAgentList);

      // Process suspicious loops
      const loopRecords = loopResponse.result?.records || [];
      const processedLoops: SuspiciousLoop[] = loopRecords.map((record: any) => ({
        toolName: String(record.tool_name || 'Unknown'),
        traceId: String(record.trace_id || ''),
        callCount: Number(record.tool_calls) || 0,
        totalDuration: Number(record.total_duration) || 0,
        agentName: 'AI Agent', // Agent name now comes from lookup in flow query
        detectedAt: record.detected_at ? new Date(record.detected_at).toISOString() : new Date().toISOString()
      }));
      setSuspiciousLoops(processedLoops);

      // Process agent flows
      const flowRecords = flowResponse.result?.records || [];
      const processedFlows: AgentFlow[] = flowRecords.map((record: any) => {
        const toolSeq = Array.isArray(record.tool_sequence) ? record.tool_sequence.map(String) : [];
        return {
          agentName: String(record.agent_name || 'AI Agent'),
          toolSequence: toolSeq,
          occurrences: Number(record.occurrences) || 0,
          avgDuration: Number(record.avg_duration) || 0,
          toolCount: toolSeq.length,
          traceId: record.sample_trace_id ? String(record.sample_trace_id) : undefined,
          timestamp: record.sample_timestamp ? new Date(record.sample_timestamp).toISOString() : undefined
        };
      });
      setAgentFlows(processedFlows);

      // Process summary with agent count from separate query
      const summaryRecord = summaryResponse.result?.records?.[0] as any;
      const agentCountRecord = agentCountResponse.result?.records?.[0] as any;
      if (summaryRecord) {
        const topTool = processedUsage[0];
        setSummary({
          totalToolCalls: Number(summaryRecord.total_calls) || 0,
          uniqueTools: Number(summaryRecord.unique_tools) || 0,
          avgCallsPerTrace: Number(summaryRecord.avg_calls_per_trace) || 0,
          totalAgents: Number(agentCountRecord?.unique_agents) || processedAgentList.length || 1,
          suspiciousLoopCount: processedLoops.length,
          topTool: topTool?.toolName || 'N/A',
          topToolCalls: topTool?.callCount || 0
        });
      }

      // Process token costs per agent
      const tokenCostRecords = tokenCostResponse.result?.records || [];
      const processedTokenCosts: AgentTokenCost[] = tokenCostRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        totalInputTokens: Number(record.total_input_tokens) || 0,
        totalOutputTokens: Number(record.total_output_tokens) || 0,
        totalTokens: Number(record.total_tokens) || 0,
        llmCalls: Number(record.llm_calls) || 0,
        estimatedCostUsd: Number(record.est_cost_usd) || 0
      }));
      setAgentTokenCosts(processedTokenCosts);

      // Process agent handoffs
      const handoffRecords = handoffResponse.result?.records || [];
      const processedHandoffs: AgentHandoff[] = handoffRecords.map((record: any) => ({
        sourceAgent: String(record.source_agent || 'Unknown'),
        targetAgent: String(record.target_agent || 'Unknown'),
        handoffCount: Number(record.handoff_count) || 0,
        avgDurationMs: Number(record.avg_duration_ms) || 0
      }));
      setAgentHandoffs(processedHandoffs);

      // Process latency breakdown
      const latencyRecords = latencyResponse.result?.records || [];
      const processedLatency: AgentLatencyBreakdown[] = latencyRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        llmTimeMs: Number(record.llm_time_ms) || 0,
        toolTimeMs: Number(record.tool_time_ms) || 0,
        totalTimeMs: Number(record.total_time_ms) || 0,
        llmCalls: Number(record.llm_calls) || 0,
        toolCalls: Number(record.tool_calls) || 0,
        llmPct: Number(record.llm_pct) || 0,
        toolPct: Number(record.tool_pct) || 0
      }));
      setAgentLatency(processedLatency);

      // Process tool reliability data
      const reliabilityRecords = retryResponse.result?.records || [];
      const processedReliability: AgentToolReliability[] = reliabilityRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        toolName: String(record.tool_name || 'Unknown'),
        totalCalls: Number(record.total_calls) || 0,
        errorCount: Number(record.error_count) || 0,
        tracesCount: Number(record.traces_count) || 0,
        avgDurationMs: Number(record.avg_duration_ms) || 0,
        p95DurationMs: Number(record.p95_duration_ms) || 0,
        errorRate: Number(record.error_rate) || 0,
        callsPerTrace: Number(record.calls_per_trace) || 1
      }));
      setAgentToolReliability(processedReliability);

      // Process tool co-occurrence for topology
      const coOccurrenceRecords = coOccurrenceResponse.result?.records || [];
      const processedCoOccurrence: ToolCoOccurrence[] = coOccurrenceRecords.map((record: any) => ({
        tool1: String(record.tool1 || 'Unknown'),
        tool2: String(record.tool2 || 'Unknown'),
        coOccurrenceCount: Number(record.co_occurrence_count) || 0,
        avgSequenceGap: 0 // Not calculated in current query
      }));
      setToolCoOccurrence(processedCoOccurrence);

      // Process tool calls trend
      const toolCallsTrendRecords = toolCallsTrendResponse.result?.records || [];
      const processedToolCallsTrend: ToolCallsTrend[] = toolCallsTrendRecords.map((record: any) => ({
        timestamp: record.time_bucket ? new Date(record.time_bucket).toISOString() : new Date().toISOString(),
        callCount: Number(record.call_count) || 0,
        uniqueTools: Number(record.unique_tools) || 0
      }));
      setToolCallsTrend(processedToolCallsTrend);

      // Process agent activity trend
      const agentActivityRecords = agentActivityTrendResponse.result?.records || [];
      const processedAgentActivity: AgentActivityTrend[] = agentActivityRecords.map((record: any) => ({
        timestamp: record.time_bucket ? new Date(record.time_bucket).toISOString() : new Date().toISOString(),
        agentName: String(record.agent_name || 'Unknown'),
        invocationCount: Number(record.invocation_count) || 0,
        avgDurationMs: Number(record.avg_duration_ms) || 0
      }));
      setAgentActivityTrend(processedAgentActivity);

      // NEW: Process agent service dependencies
      const serviceDepsRecords = serviceDepsResponse.result?.records || [];
      const processedServiceDeps: AgentServiceDependency[] = serviceDepsRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        serviceName: String(record.service_name || 'Unknown'),
        serviceType: String(record.service_type || 'other') as 'http' | 'database' | 'messaging' | 'grpc' | 'other',
        entityId: record.entity_id ? String(record.entity_id) : undefined,
        callCount: Number(record.call_count) || 0,
        avgLatencyMs: Number(record.avg_latency_ms) || 0,
        errorRate: Number(record.error_rate) || 0,
        lastSeen: record.last_seen ? new Date(record.last_seen).toISOString() : new Date().toISOString()
      }));
      setAgentServiceDeps(processedServiceDeps);

      // NEW: Process agent LLM providers
      const llmProviderRecords = llmProviderResponse.result?.records || [];
      const processedLLMProviders: AgentLLMProvider[] = llmProviderRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        provider: String(record.provider || 'Unknown'),
        model: String(record.model || 'Unknown'),
        callCount: Number(record.call_count) || 0,
        avgLatencyMs: Number(record.avg_latency_ms) || 0,
        totalInputTokens: Number(record.total_input_tokens) || 0,
        totalOutputTokens: Number(record.total_output_tokens) || 0,
        errorRate: Number(record.error_rate) || 0,
        estimatedCostUsd: Number(record.est_cost_usd) || 0
      }));
      setAgentLLMProviders(processedLLMProviders);

      // NEW: Process agent entity mappings
      const entityMappingRecords = entityMappingResponse.result?.records || [];
      const processedEntityMappings: AgentEntityMapping[] = entityMappingRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'Unknown'),
        entityId: String(record.entity_id || ''),
        entityName: String(record.entity_name || 'Unknown'),
        traceCount: Number(record.trace_count) || 0,
        avgDuration: Number(record.avg_duration) || 0
      }));
      setAgentEntityMappings(processedEntityMappings);

    } catch (err) {
      console.error('[GCC] Agent tools query failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch agent tools data'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Compute heatmap intensity (0-1) for visualization
  const getToolIntensity = useCallback((callCount: number): number => {
    if (toolUsage.length === 0) return 0;
    const maxCalls = Math.max(...toolUsage.map(t => t.callCount));
    return maxCalls > 0 ? callCount / maxCalls : 0;
  }, [toolUsage]);

  // Compute health status for a tool based on error rate
  const getToolHealth = useCallback((tool: ToolUsage): 'healthy' | 'warning' | 'critical' => {
    if (tool.errorRate > 10) return 'critical';
    if (tool.errorRate > 5) return 'warning';
    return 'healthy';
  }, []);

  return {
    toolUsage,
    agentList,
    suspiciousLoops,
    agentFlows,
    summary,
    agentTokenCosts,
    agentHandoffs,
    agentLatency,
    agentToolReliability,
    toolCoOccurrence,
    toolCallsTrend,
    agentActivityTrend,
    agentServiceDeps,
    agentLLMProviders,
    agentEntityMappings,
    loading,
    error,
    fetchAgentToolsData,
    getToolIntensity,
    getToolHealth
  };
}
