// GenAI Control Center — Agent Optimization Hook
// Phase 4: Anti-pattern detection engine for AI agent workflows
// Detects: excessive retries, tool loops, token waste, slow chains, redundant calls

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { formatNumber } from '../utils/formatting';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface AgentAntiPattern {
  id: string;
  type: AntiPatternType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  agentName: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  estimatedSavings: string;
  affectedTraces: number;
  detectedAt: number;
}

export type AntiPatternType =
  | 'excessive_retries'
  | 'tool_loop'
  | 'token_waste'
  | 'slow_chain'
  | 'redundant_calls'
  | 'error_cascade'
  | 'oversized_context'
  | 'model_mismatch';

export interface OptimizationScore {
  agentName: string;
  overallScore: number;       // 0-100
  retryScore: number;
  efficiencyScore: number;
  latencyScore: number;
  errorScore: number;
  antiPatternCount: number;
  totalTraces: number;
  avgDurationMs: number;
  avgTokensPerTrace: number;
  estimatedWasteUsd: number;
}

export interface OptimizationSummary {
  totalAgents: number;
  totalAntiPatterns: number;
  criticalPatterns: number;
  estimatedTotalWasteUsd: number;
  avgOptimizationScore: number;
  worstAgent: string;
  worstScore: number;
}

// ============================================
// DQL Queries — real data from gen_ai spans
// ============================================

/** Agent retry patterns — detect excessive retries by agent */
const AGENT_RETRY_PATTERN_QUERY = `
fetch spans, from: now()-6h, to: now()
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent" OR isNotNull(gen_ai.agent.name)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name, "unknown_agent")
| fieldsAdd is_error = (otel.status_code == "ERROR")
| summarize
    trace_count = countDistinct(trace_id),
    span_count = count(),
    error_count = countIf(is_error),
    avg_duration_ms = avg(duration / 1000000.0),
    max_duration_ms = max(duration / 1000000.0),
    by: { agent_name }
| fieldsAdd avg_spans_per_trace = toDouble(span_count) / toDouble(if(trace_count > 0, then: trace_count, else: 1))
| fieldsAdd error_rate = toDouble(error_count) / toDouble(if(span_count > 0, then: span_count, else: 1)) * 100
| sort span_count desc
`;

/** Tool call patterns per agent — detect loops and redundancies */
const TOOL_PATTERN_QUERY = `
fetch spans, from: now()-6h, to: now()
| filter (traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name))
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown_tool")
| fieldsAdd is_error = (otel.status_code == "ERROR")
| summarize
    call_count = count(),
    unique_traces = countDistinct(trace_id),
    error_count = countIf(is_error),
    avg_duration_ms = avg(duration / 1000000.0),
    by: { tool_name }
| fieldsAdd calls_per_trace = toDouble(call_count) / toDouble(if(unique_traces > 0, then: unique_traces, else: 1))
| sort calls_per_trace desc
| limit 50
`;

/** Per-trace tool usage for loop detection — count tools per trace */
const TRACE_TOOL_DEPTH_QUERY = `
fetch spans, from: now()-6h, to: now()
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool" OR isNotNull(gen_ai.tool.name)
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name, "unknown_tool")
| summarize
    tool_count = count(),
    unique_tools = countDistinct(tool_name),
    total_duration_ms = sum(duration / 1000000.0),
    by: { trace_id }
| filter tool_count > 5
| sort tool_count desc
| limit 100
`;

/** Token usage by agent — detect token waste */
const AGENT_TOKEN_QUERY = `
fetch spans, from: now()-6h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, service.name, "unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tokens = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tokens = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tokens),
    total_output = sum(output_tokens),
    llm_calls = count(),
    unique_traces = countDistinct(trace_id),
    avg_input_per_call = avg(input_tokens),
    max_input_per_call = max(input_tokens),
    models_used = collectDistinct(model, maxLength:5),
    by: { agent_name }
| sort total_input desc
`;

/** Slow chain detection — traces with high total duration */
const SLOW_CHAIN_QUERY = `
fetch spans, from: now()-6h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR traceloop.span.kind == "agent" OR traceloop.span.kind == "tool"
| summarize
    total_duration_ms = sum(duration / 1000000.0),
    span_count = count(),
    llm_calls = countIf(isNotNull(gen_ai.request.model)),
    tool_calls = countIf(traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool"),
    error_count = countIf(otel.status_code == "ERROR"),
    services = collectDistinct(service.name, maxLength:5),
    by: { trace_id }
| filter total_duration_ms > 30000
| sort total_duration_ms desc
| limit 50
`;

// Cost estimation now uses centralized estimateCost from ../utils/helpers

// ============================================
// Safe DQL executor
// ============================================

async function safeDql(query: string): Promise<any[]> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
    });
    return response.result?.records || [];
  } catch (err) {
    console.warn('[GCC:AgentOptimization] DQL error:', err);
    return [];
  }
}

// ============================================
// Anti-Pattern Detectors
// ============================================

function detectRetryAntiPatterns(agentRecords: any[]): AgentAntiPattern[] {
  const patterns: AgentAntiPattern[] = [];
  for (const r of agentRecords) {
    const agent = String(r.agent_name || 'unknown');
    const spansPerTrace = Number(r.avg_spans_per_trace) || 0;
    const errorRate = Number(r.error_rate) || 0;
    const traceCount = Number(r.trace_count) || 0;

    // Excessive retries: >5 agent spans per trace suggests retry loops
    if (spansPerTrace > 5) {
      patterns.push({
        id: `retry-${agent}-${Date.now()}`,
        type: 'excessive_retries',
        severity: spansPerTrace > 10 ? 'critical' : 'high',
        agentName: agent,
        title: `Excessive Retries: ${agent}`,
        description: `Agent averages ${spansPerTrace.toFixed(1)} spans per trace, suggesting retry loops or excessive re-planning.`,
        evidence: `${spansPerTrace.toFixed(1)} avg spans/trace across ${traceCount} traces`,
        recommendation: 'Add max-retry limits, implement exponential backoff, or improve initial prompt clarity to reduce re-planning.',
        estimatedSavings: `${Math.round((spansPerTrace - 3) * traceCount * 0.002 * 100) / 100} USD/6h in wasted LLM calls`,
        affectedTraces: traceCount,
        detectedAt: Date.now(),
      });
    }

    // Error cascade: high error rate in agent spans
    if (errorRate > 10 && traceCount > 5) {
      patterns.push({
        id: `errorcascade-${agent}-${Date.now()}`,
        type: 'error_cascade',
        severity: errorRate > 30 ? 'critical' : 'high',
        agentName: agent,
        title: `Error Cascade: ${agent}`,
        description: `${errorRate.toFixed(1)}% error rate across agent spans. Errors in one step may cascade through the chain.`,
        evidence: `${Number(r.error_count)} errors in ${Number(r.span_count)} spans`,
        recommendation: 'Add circuit breakers between agent steps. Implement graceful degradation for non-critical tool failures.',
        estimatedSavings: 'Prevent cascading failures affecting downstream services',
        affectedTraces: traceCount,
        detectedAt: Date.now(),
      });
    }
  }
  return patterns;
}

function detectToolLoopPatterns(toolRecords: any[], traceDepthRecords: any[]): AgentAntiPattern[] {
  const patterns: AgentAntiPattern[] = [];

  // Tools called too many times per trace
  for (const r of toolRecords) {
    const tool = String(r.tool_name || 'unknown');
    const callsPerTrace = Number(r.calls_per_trace) || 0;
    const totalCalls = Number(r.call_count) || 0;

    if (callsPerTrace > 3) {
      patterns.push({
        id: `toolloop-${tool}-${Date.now()}`,
        type: 'tool_loop',
        severity: callsPerTrace > 8 ? 'critical' : callsPerTrace > 5 ? 'high' : 'medium',
        agentName: `tool:${tool}`,
        title: `Tool Loop: ${tool}`,
        description: `Tool "${tool}" is called ${callsPerTrace.toFixed(1)} times per trace on average. This may indicate a loop or inefficient retry logic.`,
        evidence: `${totalCalls} total calls across ${Number(r.unique_traces)} traces`,
        recommendation: `Add deduplication: cache tool results within a trace context. Limit max calls per tool per execution to 3.`,
        estimatedSavings: `${Math.round((callsPerTrace - 2) * Number(r.unique_traces) * 0.001 * 100) / 100} USD/6h`,
        affectedTraces: Number(r.unique_traces) || 0,
        detectedAt: Date.now(),
      });
    }
  }

  // Traces with too many tools (fan-out anti-pattern)
  const deepTraces = traceDepthRecords.filter((r: any) => Number(r.tool_count) > 15);
  if (deepTraces.length > 3) {
    patterns.push({
      id: `fanout-${Date.now()}`,
      type: 'tool_loop',
      severity: 'high',
      agentName: 'multiple agents',
      title: 'Excessive Tool Fan-Out',
      description: `${deepTraces.length} traces have >15 tool calls each. This suggests over-decomposed planning or redundant tool invocations.`,
      evidence: `Worst trace: ${Number(deepTraces[0]?.tool_count)} tool calls in ${Number(deepTraces[0]?.total_duration_ms || 0).toFixed(0)}ms`,
      recommendation: 'Consolidate tool calls. Use batch operations instead of individual calls. Review agent planning prompts.',
      estimatedSavings: '30-50% reduction in agent execution time',
      affectedTraces: deepTraces.length,
      detectedAt: Date.now(),
    });
  }

  return patterns;
}

function detectTokenWastePatterns(tokenRecords: any[]): AgentAntiPattern[] {
  const patterns: AgentAntiPattern[] = [];

  for (const r of tokenRecords) {
    const agent = String(r.agent_name || 'unknown');
    const avgInputPerCall = Number(r.avg_input_per_call) || 0;
    const maxInputPerCall = Number(r.max_input_per_call) || 0;
    const totalInput = Number(r.total_input) || 0;
    const totalOutput = Number(r.total_output) || 0;
    const llmCalls = Number(r.llm_calls) || 0;
    const traces = Number(r.unique_traces) || 0;
    const models = (r.models_used || []).map(String);

    // Oversized context: avg input > 4000 tokens per call
    if (avgInputPerCall > 4000) {
      const wasteTokens = (avgInputPerCall - 2000) * llmCalls;
      const wasteCost = estimateCost('unknown', wasteTokens, 0, models[0] || 'gpt-4o');

      patterns.push({
        id: `context-${agent}-${Date.now()}`,
        type: 'oversized_context',
        severity: avgInputPerCall > 8000 ? 'critical' : 'high',
        agentName: agent,
        title: `Oversized Context: ${agent}`,
        description: `Average input is ${Math.round(avgInputPerCall)} tokens/call (max: ${Math.round(maxInputPerCall)}). Large context windows waste tokens and increase latency.`,
        evidence: `${formatNumber(Math.round(totalInput))} total input tokens across ${llmCalls} LLM calls`,
        recommendation: 'Implement context windowing: summarize older messages, use RAG to inject only relevant context, truncate system prompts.',
        estimatedSavings: `~$${wasteCost.toFixed(2)}/6h by trimming to 2K avg`,
        affectedTraces: traces,
        detectedAt: Date.now(),
      });
    }

    // Model mismatch: using expensive models for simple tasks
    if (models.some(m => m.includes('gpt-4') && !m.includes('mini')) && avgInputPerCall < 500 && llmCalls > 20) {
      const currentCost = estimateCost('openai', totalInput, totalOutput, 'gpt-4o');
      const miniCost = estimateCost('openai', totalInput, totalOutput, 'gpt-4o-mini');
      const savings = currentCost - miniCost;

      if (savings > 0.01) {
        patterns.push({
          id: `modelmismatch-${agent}-${Date.now()}`,
          type: 'model_mismatch',
          severity: savings > 1 ? 'high' : 'medium',
          agentName: agent,
          title: `Model Mismatch: ${agent}`,
          description: `Using ${models[0]} for ${llmCalls} calls with avg ${Math.round(avgInputPerCall)} tokens/call. A smaller model would handle this at lower cost.`,
          evidence: `Current cost: $${currentCost.toFixed(2)}/6h. Mini model cost: $${miniCost.toFixed(2)}/6h`,
          recommendation: `Switch to GPT-4o-mini or Claude 3 Haiku for short, simple agent tasks. Reserve larger models for complex reasoning.`,
          estimatedSavings: `$${savings.toFixed(2)}/6h (${((savings / currentCost) * 100).toFixed(0)}% reduction)`,
          affectedTraces: traces,
          detectedAt: Date.now(),
        });
      }
    }
  }

  return patterns;
}

function detectSlowChainPatterns(slowChainRecords: any[]): AgentAntiPattern[] {
  const patterns: AgentAntiPattern[] = [];

  if (slowChainRecords.length > 0) {
    const worst = slowChainRecords[0];
    const worstDuration = Number(worst.total_duration_ms) || 0;
    const avgDuration = slowChainRecords.reduce((s: number, r: any) => s + (Number(r.total_duration_ms) || 0), 0) / slowChainRecords.length;

    patterns.push({
      id: `slowchain-${Date.now()}`,
      type: 'slow_chain',
      severity: worstDuration > 120000 ? 'critical' : worstDuration > 60000 ? 'high' : 'medium',
      agentName: 'multiple agents',
      title: `Slow Agent Chains Detected`,
      description: `${slowChainRecords.length} traces exceed 30s. Avg: ${(avgDuration / 1000).toFixed(1)}s, worst: ${(worstDuration / 1000).toFixed(1)}s.`,
      evidence: `Worst trace: ${Number(worst.span_count)} spans, ${Number(worst.llm_calls)} LLM calls, ${Number(worst.tool_calls)} tool calls`,
      recommendation: 'Parallelize independent tool calls. Use streaming for LLM responses. Add timeout limits per agent step (15s recommended).',
      estimatedSavings: '40-60% latency reduction through parallelization',
      affectedTraces: slowChainRecords.length,
      detectedAt: Date.now(),
    });
  }

  return patterns;
}

// ============================================
// Hook: useAgentOptimization
// ============================================

export function useAgentOptimization() {
  const [antiPatterns, setAntiPatterns] = useState<AgentAntiPattern[]>([]);
  const [agentScores, setAgentScores] = useState<OptimizationScore[]>([]);
  const [summary, setSummary] = useState<OptimizationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [agentRecs, toolRecs, traceDepthRecs, tokenRecs, slowChainRecs] = await Promise.all([
        safeDql(AGENT_RETRY_PATTERN_QUERY),
        safeDql(TOOL_PATTERN_QUERY),
        safeDql(TRACE_TOOL_DEPTH_QUERY),
        safeDql(AGENT_TOKEN_QUERY),
        safeDql(SLOW_CHAIN_QUERY),
      ]);

      // Run all detectors
      const retryPatterns = detectRetryAntiPatterns(agentRecs);
      const toolPatterns = detectToolLoopPatterns(toolRecs, traceDepthRecs);
      const tokenPatterns = detectTokenWastePatterns(tokenRecs);
      const chainPatterns = detectSlowChainPatterns(slowChainRecs);

      const allPatterns = [...retryPatterns, ...toolPatterns, ...tokenPatterns, ...chainPatterns]
        .sort((a, b) => {
          const sev = { critical: 0, high: 1, medium: 2, low: 3 };
          return sev[a.severity] - sev[b.severity];
        });

      // ============================================
      // Industry-Standard Scoring Functions
      // ============================================
      
      // Reliability Score (Based on Google SRE error budgets)
      // 99.9% SLO = 0.1% error rate target
      const calcReliabilityScore = (errorRate: number): number => {
        if (errorRate < 0.1) return 100;      // 99.9%+ SLO
        if (errorRate < 1) return 90;          // 99%+ SLO
        if (errorRate < 5) return 70;          // 95%+ SLO
        if (errorRate < 10) return 50;         // 90%+ SLO
        // Linear decay from 50 to 0 for 10-50% error rates
        return Math.max(0, 50 - (errorRate - 10) * 1.25);
      };

      // Efficiency Score (Based on LLM context window utilization)
      // Optimal: 10-25% of context window (GPT-4: 128K, Claude: 200K)
      const calcEfficiencyScore = (avgTokens: number): number => {
        if (avgTokens < 4000) return 100;      // Optimal (<3% of context)
        if (avgTokens < 8000) return 85;       // Efficient (3-6%)
        if (avgTokens < 16000) return 70;      // Moderate (6-12%)
        if (avgTokens < 32000) return 50;      // High (12-25%)
        return 30;                              // Wasteful (>25%)
      };

      // Latency Score (Based on Apdex with T=10s for AI workloads)
      // AI agents tolerate higher latency than web apps (T=4s)
      const calcLatencyScore = (avgDurationMs: number): number => {
        if (avgDurationMs < 10000) return 100;   // Satisfied (<T)
        if (avgDurationMs < 20000) return 75;    // Tolerating (<2T)
        if (avgDurationMs < 40000) return 50;    // Frustrating (<4T)
        return 25;                                // Frustrated (>4T)
      };

      // Retry Score (Based on AWS/GCP retry guidelines - max 3 retries)
      const calcRetryScore = (spansPerTrace: number): number => {
        if (spansPerTrace <= 2) return 100;      // Normal (1-2 attempts)
        if (spansPerTrace <= 3) return 85;       // Acceptable (3 attempts = 2 retries)
        if (spansPerTrace <= 5) return 60;       // Elevated
        return 30;                                // Retry storm
      };

      // Compute per-agent optimization scores
      const agentMap = new Map<string, {
        retryScore: number; efficiencyScore: number; latencyScore: number;
        errorScore: number; patterns: number; traces: number;
        avgDuration: number; avgTokens: number; wasteUsd: number;
      }>();

      // Initialize from agent records
      agentRecs.forEach((r: any) => {
        const name = String(r.agent_name || 'unknown');
        const spansPerTrace = Number(r.avg_spans_per_trace) || 1;
        const errorRate = Number(r.error_rate) || 0;
        const avgDuration = Number(r.avg_duration_ms) || 0;

        agentMap.set(name, {
          retryScore: calcRetryScore(spansPerTrace),
          efficiencyScore: 85, // default until token data enriches
          latencyScore: calcLatencyScore(avgDuration),
          errorScore: calcReliabilityScore(errorRate),
          patterns: 0,
          traces: Number(r.trace_count) || 0,
          avgDuration,
          avgTokens: 0,
          wasteUsd: 0,
        });
      });

      // Enrich with token data
      tokenRecs.forEach((r: any) => {
        const name = String(r.agent_name || 'unknown');
        const existing = agentMap.get(name);
        if (!existing) return;
        const avgInput = Number(r.avg_input_per_call) || 0;
        existing.avgTokens = avgInput;
        existing.efficiencyScore = calcEfficiencyScore(avgInput);
      });

      // Count patterns per agent
      allPatterns.forEach(p => {
        const entry = agentMap.get(p.agentName);
        if (entry) entry.patterns++;
      });

      const scores: OptimizationScore[] = [];
      agentMap.forEach((v, name) => {
        // Weighted formula: Reliability 30%, Efficiency 30%, Latency 25%, Retry 15%
        // Weights reflect production priority: reliability and cost > latency for AI
        const overall = v.errorScore * 0.30 + v.efficiencyScore * 0.30 + v.latencyScore * 0.25 + v.retryScore * 0.15;
        scores.push({
          agentName: name,
          overallScore: overall,
          retryScore: v.retryScore,
          efficiencyScore: v.efficiencyScore,
          latencyScore: v.latencyScore,
          errorScore: v.errorScore,
          antiPatternCount: v.patterns,
          totalTraces: v.traces,
          avgDurationMs: v.avgDuration,
          avgTokensPerTrace: v.avgTokens,
          estimatedWasteUsd: v.wasteUsd,
        });
      });
      scores.sort((a, b) => a.overallScore - b.overallScore);


      // Summary
      const totalWaste = allPatterns.reduce((s, p) => {
        const match = p.estimatedSavings.match(/\$?([\d.]+)/);
        return s + (match ? parseFloat(match[1]) : 0);
      }, 0);

      const newSummary: OptimizationSummary = {
        totalAgents: scores.length,
        totalAntiPatterns: allPatterns.length,
        criticalPatterns: allPatterns.filter(p => p.severity === 'critical').length,
        estimatedTotalWasteUsd: totalWaste,
        avgOptimizationScore: scores.length > 0
          ? scores.reduce((s, sc) => s + sc.overallScore, 0) / scores.length
          : 100,
        worstAgent: scores.length > 0 ? scores[0].agentName : 'none',
        worstScore: scores.length > 0 ? scores[0].overallScore : 100,
      };

      setAntiPatterns(allPatterns);
      setAgentScores(scores);
      setSummary(newSummary);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { antiPatterns, agentScores, summary, loading, error, refetch };
}
