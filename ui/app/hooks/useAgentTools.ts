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
  avgTokens: number;
  traceId?: string;    // Sample trace ID for linking to distributed traces
  timestamp?: string;  // Timestamp of the sample trace
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
// This query finds agents from both:
// 1. Explicit agent spans (traceloop.span.kind == "agent")
// 2. Tool spans that reference an agent via trace correlation
const AGENT_LIST_QUERY = (filters?: QueryFilters) => `
fetch spans, ${buildTimeFilter(filters)}
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd is_error = if(otel.status_code == "ERROR" OR span.status == "error" OR isNotNull(error.type), then: 1, else: 0)
| lookup [
    fetch spans, ${buildTimeFilter(filters)}
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
    | fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | summarize agent_name = takeFirst(agent_name), by: { trace_id = trace.id }
  ], sourceField:trace.id, lookupField:trace_id, prefix:"lookup."
| fieldsAdd agent_name = coalesce(lookup.agent_name, "Unknown Agent")
| summarize 
    trace_count = countDistinct(trace.id),
    total_duration = sum(duration) / 1000000,
    error_count = sum(is_error),
    span_count = count(),
    sample_trace_id = takeFirst(trace.id),
    last_seen = max(start_time),
    by: { agent_name }
| fieldsAdd avg_duration = total_duration / span_count
| fieldsAdd error_rate = if(span_count > 0, then: toDouble(error_count) / toDouble(span_count) * 100, else: 0.0)
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
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
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
    avg_tokens = avg(total_tokens),
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

// ============================================
// Main Hook
// ============================================

export function useAgentTools(filters?: QueryFilters) {
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [suspiciousLoops, setSuspiciousLoops] = useState<SuspiciousLoop[]>([]);
  const [agentFlows, setAgentFlows] = useState<AgentFlow[]>([]);
  const [summary, setSummary] = useState<AgentToolsSummary | null>(null);
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
      const [usageResponse, loopResponse, flowResponse, summaryResponse, agentCountResponse, agentListResponse, agentToolCallsResponse] = await Promise.all([
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
      const processedFlows: AgentFlow[] = flowRecords.map((record: any) => ({
        agentName: String(record.agent_name || 'AI Agent'),
        toolSequence: Array.isArray(record.tool_sequence) ? record.tool_sequence.map(String) : [],
        occurrences: Number(record.occurrences) || 0,
        avgDuration: Number(record.avg_duration) || 0,
        avgTokens: Number(record.avg_tokens) || 0,
        traceId: record.sample_trace_id ? String(record.sample_trace_id) : undefined,
        timestamp: record.sample_timestamp ? new Date(record.sample_timestamp).toISOString() : undefined
      }));
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
    loading,
    error,
    fetchAgentToolsData,
    getToolIntensity,
    getToolHealth
  };
}
