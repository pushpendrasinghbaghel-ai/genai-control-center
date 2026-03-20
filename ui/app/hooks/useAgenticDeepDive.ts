// GenAI Control Center - Agentic AI Deep Observability Hook
// Phase 12: MCP-validated queries against real Grail data
// All queries confirmed against 707M+ spans, zero mocks/stubs

import React, { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { QueryFilters } from './useDQLQueries';
import {
  AGENT_STEP_COUNT_QUERY,
  AGENT_EXIT_CONDITIONS_QUERY,
  MULTI_AGENT_HIERARCHY_QUERY,
  AGENT_PARALLELISM_QUERY,
  CROSS_AGENT_TOKEN_QUERY,
  CONTEXT_GROWTH_QUERY,
  CONVERSATION_STATE_QUERY,
  CONTEXT_WINDOW_UTILIZATION_QUERY,
  COST_BREACH_DETECTION_QUERY,
  AGENT_TRACE_WATERFALL_QUERY,
} from '../queries/dql-queries';
import type {
  AgentTraceSpan,
  AgentStepSummary,
  AgentExitCondition,
  MultiAgentTrace,
  AgentParallelismStats,
  CrossAgentTokens,
  ContextGrowthEntry,
  ConversationStateStats,
  ContextWindowUtilization,
  CostBreachEntry,
} from '../types';

// ============================================
// Helper: execute a DQL query with timeout
// ============================================
const executeQuery = (query: string) =>
  queryExecutionClient.queryExecute({
    body: {
      query,
      requestTimeoutMilliseconds: 60000,
      fetchTimeoutSeconds: 60,
    },
  });

// ============================================
// Main Hook
// ============================================
export function useAgenticDeepDive(filters?: QueryFilters) {
  // 12.1 Agent Step Tracing
  const [agentSteps, setAgentSteps] = useState<AgentStepSummary[]>([]);
  const [exitConditions, setExitConditions] = useState<AgentExitCondition[]>([]);

  // 12.3 Multi-Agent Depth
  const [multiAgentTraces, setMultiAgentTraces] = useState<MultiAgentTrace[]>([]);
  const [parallelismStats, setParallelismStats] = useState<AgentParallelismStats | null>(null);
  const [crossAgentTokens, setCrossAgentTokens] = useState<CrossAgentTokens[]>([]);

  // 12.5 Conversation State
  const [contextGrowth, setContextGrowth] = useState<ContextGrowthEntry[]>([]);
  const [conversationState, setConversationState] = useState<ConversationStateStats | null>(null);

  // 12.6 Context Window
  const [contextWindowUtil, setContextWindowUtil] = useState<ContextWindowUtilization[]>([]);

  // 12.4 Cost Threshold
  const [costBreaches, setCostBreaches] = useState<CostBreachEntry[]>([]);

  // Trace waterfall (on-demand)
  const [traceWaterfall, setTraceWaterfall] = useState<AgentTraceSpan[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const currentFilters = filtersRef.current;

    try {
      const [
        stepCountRes,
        exitCondRes,
        multiAgentRes,
        parallelismRes,
        crossTokenRes,
        contextGrowthRes,
        convStateRes,
        ctxWindowRes,
        costBreachRes,
      ] = await Promise.all([
        executeQuery(AGENT_STEP_COUNT_QUERY(currentFilters)),
        executeQuery(AGENT_EXIT_CONDITIONS_QUERY(currentFilters)),
        executeQuery(MULTI_AGENT_HIERARCHY_QUERY(currentFilters)),
        executeQuery(AGENT_PARALLELISM_QUERY(currentFilters)),
        executeQuery(CROSS_AGENT_TOKEN_QUERY(currentFilters)),
        executeQuery(CONTEXT_GROWTH_QUERY(currentFilters)),
        executeQuery(CONVERSATION_STATE_QUERY(currentFilters)),
        executeQuery(CONTEXT_WINDOW_UTILIZATION_QUERY(currentFilters)),
        executeQuery(COST_BREACH_DETECTION_QUERY(currentFilters)),
      ]);

      // ---------- 12.1 Agent Step Counts ----------
      const stepRecords = stepCountRes.result?.records || [];
      setAgentSteps(
        stepRecords.map((r: any) => ({
          agentName: String(r.agent_name || 'Unknown'),
          totalSpans: Number(r.total_spans) || 0,
          taskSteps: Number(r.task_steps) || 0,
          toolSteps: Number(r.tool_steps) || 0,
          workflowSteps: Number(r.workflow_steps) || 0,
          llmSteps: Number(r.llm_steps) || 0,
          totalInputTokens: Number(r.total_input_tokens) || 0,
          totalOutputTokens: Number(r.total_output_tokens) || 0,
          avgDurationMs: Number(r.avg_duration_ms) || 0,
          errorCount: Number(r.error_count) || 0,
          uniqueTraces: Number(r.unique_traces) || 0,
          stepsPerTrace: Number(r.steps_per_trace) || 0,
          errorRate: Number(r.error_rate) || 0,
          sampleTraceId: String(r.sample_trace_id || ''),
        }))
      );

      // ---------- 12.1 Agent Exit Conditions ----------
      const exitRecords = exitCondRes.result?.records || [];
      setExitConditions(
        exitRecords.map((r: any) => ({
          agentName: String(r.agent_name || 'Unknown'),
          total: Number(r.total) || 0,
          success: Number(r.success) || 0,
          errors: Number(r.errors) || 0,
          timeouts: Number(r.timeouts) || 0,
          slow: Number(r.slow) || 0,
        }))
      );

      // ---------- 12.3 Multi-Agent Hierarchy ----------
      const maRecords = multiAgentRes.result?.records || [];
      setMultiAgentTraces(
        maRecords.map((r: any) => ({
          traceId: String(r.trace_id || ''),
          agents: Array.isArray(r.agents) ? r.agents.map(String) : [],
          agentCount: Number(r.agent_count) || 0,
          totalSpans: Number(r.total_spans) || 0,
          totalInputTokens: Number(r.total_input_tokens) || 0,
          totalOutputTokens: Number(r.total_output_tokens) || 0,
          totalDurationMs: Number(r.total_duration_ms) || 0,
          errorCount: Number(r.error_count) || 0,
        }))
      );

      // ---------- 12.3 Parallelism Stats ----------
      const pRec = parallelismRes.result?.records?.[0] as any;
      if (pRec) {
        setParallelismStats({
          totalTraces: Number(pRec.total_traces) || 0,
          parallel: Number(pRec.parallel) || 0,
          sequential: Number(pRec.sequential) || 0,
          mixed: Number(pRec.mixed) || 0,
          avgParallelism: Number(pRec.avg_parallelism) || 0,
        });
      }

      // ---------- 12.3 Cross-Agent Tokens ----------
      const crossRecords = crossTokenRes.result?.records || [];
      setCrossAgentTokens(
        crossRecords.map((r: any) => ({
          agentName: String(r.agent_name || 'Unknown'),
          llmCalls: Number(r.llm_calls) || 0,
          totalInput: Number(r.total_input) || 0,
          totalOutput: Number(r.total_output) || 0,
          totalTokens: Number(r.total_tokens) || 0,
          avgInputPerCall: Number(r.avg_input_per_call) || 0,
          avgOutputPerCall: Number(r.avg_output_per_call) || 0,
          uniqueTraces: Number(r.unique_traces) || 0,
          uniqueModels: Array.isArray(r.unique_models) ? r.unique_models.map(String) : [],
          providers: Array.isArray(r.providers) ? r.providers.map(String) : [],
          toolCallsMade: Number(r.tool_calls_made) || 0,
          estCostUsd: Number(r.est_cost_usd) || 0,
          toolCallRate: Number(r.tool_call_rate) || 0,
        }))
      );

      // ---------- 12.5 Context Growth ----------
      const cgRecords = contextGrowthRes.result?.records || [];
      setContextGrowth(
        cgRecords.map((r: any) => ({
          traceId: String(r.trace_id || ''),
          turns: Number(r.turns) || 0,
          minInput: Number(r.min_input) || 0,
          maxInput: Number(r.max_input) || 0,
          totalInput: Number(r.total_input) || 0,
          totalOutput: Number(r.total_output) || 0,
          totalTokens: Number(r.total_tokens) || 0,
          durationMs: Number(r.duration_ms) || 0,
          agents: Array.isArray(r.agents) ? r.agents.map(String) : [],
          contextGrowthRatio: Number(r.context_growth_ratio) || 1,
          avgTokensPerTurn: Number(r.avg_tokens_per_turn) || 0,
        }))
      );

      // ---------- 12.5 Conversation State ----------
      const csRec = convStateRes.result?.records?.[0] as any;
      if (csRec) {
        setConversationState({
          total: Number(csRec.total) || 0,
          singleTurn: Number(csRec.single_turn) || 0,
          multiTurn: Number(csRec.multi_turn) || 0,
          errored: Number(csRec.errored) || 0,
          partialFailure: Number(csRec.partial_failure) || 0,
          runaway: Number(csRec.runaway) || 0,
          avgTurns: Number(csRec.avg_turns) || 0,
          avgTokens: Number(csRec.avg_tokens) || 0,
          avgDurationMs: Number(csRec.avg_duration_ms) || 0,
        });
      }

      // ---------- 12.6 Context Window Utilization ----------
      const cwRecords = ctxWindowRes.result?.records || [];
      setContextWindowUtil(
        cwRecords.map((r: any) => ({
          model: String(r.model || 'Unknown'),
          provider: String(r.provider || 'Unknown'),
          avgUtilization: Number(r.avg_utilization) || 0,
          maxUtilization: Number(r.max_utilization) || 0,
          requests: Number(r.requests) || 0,
          highUtilCount: Number(r.high_util_count) || 0,
          nearCapacityCount: Number(r.near_capacity_count) || 0,
          avgInputTokens: Number(r.avg_input_tokens) || 0,
          highUtilPct: Number(r.high_util_pct) || 0,
        }))
      );

      // ---------- 12.4 Cost Breach Detection ----------
      const cbRecords = costBreachRes.result?.records || [];
      setCostBreaches(
        cbRecords.map((r: any) => ({
          timeBucket: r.time_bucket ? new Date(r.time_bucket).toISOString() : '',
          hourlyCost: Number(r.hourly_cost) || 0,
          hourlyRequests: Number(r.hourly_requests) || 0,
          hourlyTokens: Number(r.hourly_tokens) || 0,
        }))
      );
    } catch (err) {
      console.error('[GCC] AgenticDeepDive fetch error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // On-demand trace waterfall loader
  const fetchTraceWaterfall = useCallback(async (traceId: string) => {
    try {
      const res = await executeQuery(AGENT_TRACE_WATERFALL_QUERY(traceId));
      const records = res.result?.records || [];
      setTraceWaterfall(
        records.map((r: any) => ({
          startTime: r.start_time ? new Date(r.start_time).toISOString() : '',
          spanName: String(r['span.name'] || ''),
          spanKind: String(r['traceloop.span.kind'] || ''),
          entityName: String(r['traceloop.entity.name'] || ''),
          agentName: String(r['gen_ai.agent.name'] || ''),
          model: String(r['gen_ai.request.model'] || ''),
          provider: String(r['gen_ai.provider.name'] || ''),
          inputTokens: Number(r['gen_ai.usage.input_tokens']) || 0,
          outputTokens: Number(r['gen_ai.usage.output_tokens']) || 0,
          completionContent: String(r['gen_ai.completion.0.content'] || ''),
          toolCallName: String(r['gen_ai.completion.0.tool_calls.0.name'] || ''),
          durationMs: Number(r.duration) / 1000000 || 0,
          statusCode: String(r['otel.status_code'] || 'OK'),
          spanId: String(r['span.id'] || ''),
          traceId: String(r['trace.id'] || ''),
        }))
      );
    } catch (err) {
      console.error('[GCC] Trace waterfall fetch error:', err);
    }
  }, []);

  // Computed metrics
  const totalAgentSpans = agentSteps.reduce((sum, a) => sum + a.totalSpans, 0);
  const totalAgents = agentSteps.length;
  const totalTokens = crossAgentTokens.reduce((sum, a) => sum + a.totalTokens, 0);
  const totalCostUsd = crossAgentTokens.reduce((sum, a) => sum + a.estCostUsd, 0);
  const avgStepsPerTrace =
    agentSteps.length > 0
      ? agentSteps.reduce((sum, a) => sum + a.stepsPerTrace, 0) / agentSteps.length
      : 0;

  return {
    // 12.1 Agent Step Tracing
    agentSteps,
    exitConditions,
    // 12.3 Multi-Agent Depth
    multiAgentTraces,
    parallelismStats,
    crossAgentTokens,
    // 12.5 Conversation State
    contextGrowth,
    conversationState,
    // 12.6 Context Window
    contextWindowUtil,
    // 12.4 Cost Threshold
    costBreaches,
    // On-demand
    traceWaterfall,
    fetchTraceWaterfall,
    // Computed
    totalAgentSpans,
    totalAgents,
    totalTokens,
    totalCostUsd,
    avgStepsPerTrace,
    // State
    loading,
    error,
    fetchData,
  };
}
