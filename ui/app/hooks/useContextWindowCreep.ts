// GenAI Control Center — Context Window Creep Tracker
// FinOps Foundation's #1 hidden cost: the compounding input tokens from resending
// conversation history every turn. Input/Output ratio is the proxy metric —
// high ratios (>5:1) indicate context window bloat eating your budget.
// Narrative placement: Tab 3 "AI Economics" — explains WHY efficiency is low.

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface ContextCreepBucket {
  /** Label like "1-2x", "2-5x", "5-10x", "10-20x", "20x+" */
  label: string;
  /** Number of requests in this ratio bucket */
  requestCount: number;
  /** % of total requests */
  pctOfTotal: number;
  /** Avg input tokens in this bucket */
  avgInputTokens: number;
  /** Avg output tokens in this bucket */
  avgOutputTokens: number;
  /** Estimated cost contribution */
  estimatedCost: number;
  /** Severity: low, medium, high, critical */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextCreepByModel {
  model: string;
  provider: string;
  requestCount: number;
  avgInputOutputRatio: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  /** Estimated wasted cost from context bloat (input tokens above 2x output) */
  estimatedWasteCost: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextWindowCreepResult {
  /** Overall avg input/output ratio */
  overallRatio: number;
  /** Total requests analysed */
  totalRequests: number;
  /** Requests with ratio > 5 (potential creep) */
  creepingRequests: number;
  /** % of requests with ratio > 5 */
  creepingPct: number;
  /** Distribution buckets */
  buckets: ContextCreepBucket[];
  /** Per-model breakdown sorted by waste */
  byModel: ContextCreepByModel[];
  /** Estimated total wasted cost from context bloat */
  totalWasteCost: number;
  /** Narrative insight for the UI */
  insight: string;
}

// ============================================
// DQL — ratio distribution across all gen_ai spans
// ============================================

const CONTEXT_CREEP_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, 0))
| filter input_tok > 0 AND output_tok > 0
| fieldsAdd ratio = input_tok / output_tok,
            provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown")
| summarize total = count(),
            ratio_1_2 = countIf(ratio >= 1.0 AND ratio < 2.0),
            ratio_2_5 = countIf(ratio >= 2.0 AND ratio < 5.0),
            ratio_5_10 = countIf(ratio >= 5.0 AND ratio < 10.0),
            ratio_10_20 = countIf(ratio >= 10.0 AND ratio < 20.0),
            ratio_20_plus = countIf(ratio >= 20.0),
            avg_ratio = avg(ratio),
            creeping = countIf(ratio >= 5.0)
`;

const CONTEXT_CREEP_BY_MODEL_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, 0))
| filter input_tok > 0 AND output_tok > 0
| fieldsAdd provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown")
| summarize request_count = count(),
            avg_input = avg(input_tok),
            avg_output = avg(output_tok),
            avg_ratio = avg(input_tok / output_tok),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
  by: { model, provider }
| sort avg_ratio desc
| limit 20
`;

// ============================================
// Helpers
// ============================================

function ratioSeverity(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 20) return 'critical';
  if (ratio >= 10) return 'high';
  if (ratio >= 5) return 'medium';
  return 'low';
}

function buildInsight(overallRatio: number, creepingPct: number, topModel?: ContextCreepByModel): string {
  if (creepingPct > 50) {
    const modelNote = topModel ? ` Top offender: ${topModel.model} (${topModel.avgInputOutputRatio.toFixed(1)}:1 ratio).` : '';
    return `⚠️ ${creepingPct.toFixed(0)}% of your requests have input/output ratio >5:1 — a strong signal of Context Window Creep. You're paying for resending conversation history on every turn.${modelNote} Consider implementing conversation summarization or sliding window context.`;
  }
  if (creepingPct > 20) {
    return `${creepingPct.toFixed(0)}% of requests show potential context window bloat (ratio >5:1). Monitor closely — this is the #1 hidden cost identified by the FinOps Foundation.`;
  }
  return `Context window usage looks healthy. ${(100 - creepingPct).toFixed(0)}% of requests have efficient input/output ratios.`;
}

// ============================================
// Hook
// ============================================

export function useContextWindowCreep() {
  const [data, setData] = useState<ContextWindowCreepResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fire both queries in parallel
      const [distResult, modelResult] = await Promise.all([
        queryExecutionClient.queryExecute({ body: { query: CONTEXT_CREEP_QUERY, requestTimeoutMilliseconds: 30000 } }),
        queryExecutionClient.queryExecute({ body: { query: CONTEXT_CREEP_BY_MODEL_QUERY, requestTimeoutMilliseconds: 30000 } }),
      ]);

      // ── Parse distribution ──
      const distRecords = distResult?.result?.records || [];
      if (distRecords.length === 0) { setData(null); setLoading(false); return; }

      const d = distRecords[0] as Record<string, any>;
      const total = Number(d.total) || 0;
      const avgRatio = Number(d.avg_ratio) || 0;
      const creeping = Number(d.creeping) || 0;
      const creepingPct = total > 0 ? (creeping / total) * 100 : 0;

      const bucketDefs: Array<{ key: string; label: string; severity: ContextCreepBucket['severity'] }> = [
        { key: 'ratio_1_2', label: '1-2x (Healthy)', severity: 'low' },
        { key: 'ratio_2_5', label: '2-5x (Normal)', severity: 'low' },
        { key: 'ratio_5_10', label: '5-10x (Creeping)', severity: 'medium' },
        { key: 'ratio_10_20', label: '10-20x (Bloated)', severity: 'high' },
        { key: 'ratio_20_plus', label: '20x+ (Critical)', severity: 'critical' },
      ];

      const buckets: ContextCreepBucket[] = bucketDefs.map(b => {
        const count = Number(d[b.key]) || 0;
        return {
          label: b.label,
          requestCount: count,
          pctOfTotal: total > 0 ? (count / total) * 100 : 0,
          avgInputTokens: 0,  // Approximated from model data
          avgOutputTokens: 0,
          estimatedCost: 0,
          severity: b.severity,
        };
      });

      // ── Parse per-model ──
      const modelRecords = modelResult?.result?.records || [];
      const byModel: ContextCreepByModel[] = modelRecords.map((r: any) => {
        const model = String(r.model || 'unknown');
        const provider = String(r.provider || 'unknown');
        const reqCount = Number(r.request_count) || 0;
        const avgInput = Number(r.avg_input) || 0;
        const avgOutput = Number(r.avg_output) || 0;
        const ratio = Number(r.avg_ratio) || 0;
        const totalInput = Number(r.total_input) || 0;
        const totalOutput = Number(r.total_output) || 0;

        // Waste = cost of input tokens BEYOND what a 2:1 ratio would need
        // If ratio is 12:1 but "healthy" is 2:1, then 10/12 of input tokens are waste
        const healthyInputShare = Math.min(1, 2 / Math.max(ratio, 0.01));
        const wasteInputTokens = totalInput * (1 - healthyInputShare);
        const wasteCost = estimateCost(provider, wasteInputTokens, 0, model);

        return {
          model,
          provider,
          requestCount: reqCount,
          avgInputOutputRatio: ratio,
          avgInputTokens: avgInput,
          avgOutputTokens: avgOutput,
          estimatedWasteCost: wasteCost,
          severity: ratioSeverity(ratio),
        };
      });

      const totalWasteCost = byModel.reduce((s, m) => s + m.estimatedWasteCost, 0);
      const topModel = byModel.length > 0 ? byModel[0] : undefined;

      setData({
        overallRatio: avgRatio,
        totalRequests: total,
        creepingRequests: creeping,
        creepingPct,
        buckets,
        byModel,
        totalWasteCost,
        insight: buildInsight(avgRatio, creepingPct, topModel),
      });
    } catch (err) {
      console.error('[useContextWindowCreep] Query failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
