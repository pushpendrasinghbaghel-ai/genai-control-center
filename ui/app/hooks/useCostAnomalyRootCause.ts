// GenAI Control Center — Cost Anomaly Root Cause Analysis
// Phase 6: When cost velocity spikes, explain WHY
// Compares model distribution in the anomaly window vs 24h baseline

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface ModelDistribution {
  model: string;
  provider: string;
  requestCount: number;
  pct: number;
  costUsd: number;
}

export interface CostAnomalyRootCause {
  detected: boolean;
  rootCause: string;
  baselineDistribution: ModelDistribution[];
  currentDistribution: ModelDistribution[];
  costImpactPerHour: number;
  topShifts: { model: string; baselinePct: number; currentPct: number; direction: 'up' | 'down' }[];
}

// ============================================
// DQL Queries
// ============================================

/** Model distribution over the last 24h (baseline) */
const BASELINE_DIST_QUERY = `
fetch spans, from: now()-24h, to: now()-30m
| filter isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown"),
            provider = coalesce(gen_ai.provider.name, "unknown"),
            input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize request_count = count(),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
  by: { model, provider }
| sort request_count desc
`;

/** Model distribution in the last 30 minutes (anomaly window) */
const CURRENT_DIST_QUERY = `
fetch spans, from: now()-30m, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown"),
            provider = coalesce(gen_ai.provider.name, "unknown"),
            input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize request_count = count(),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
  by: { model, provider }
| sort request_count desc
`;

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
    console.warn('[GCC:AnomalyRootCause] DQL error:', err);
    return [];
  }
}

function toDistribution(records: any[]): ModelDistribution[] {
  const totalReqs = records.reduce((s, r) => s + (Number(r.request_count) || 0), 0);
  return records.map(r => {
    const model = String(r.model || 'unknown');
    const provider = String(r.provider || 'unknown');
    const requestCount = Number(r.request_count) || 0;
    const totalInput = Number(r.total_input) || 0;
    const totalOutput = Number(r.total_output) || 0;
    return {
      model,
      provider,
      requestCount,
      pct: totalReqs > 0 ? (requestCount / totalReqs) * 100 : 0,
      costUsd: estimateCost(provider, totalInput, totalOutput, model),
    };
  });
}

// ============================================
// Hook
// ============================================

export function useCostAnomalyRootCause(velocityRatio: number) {
  const [data, setData] = useState<CostAnomalyRootCause | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    // Only analyse when velocity indicates a spike (ratio > 2 = warning)
    if (velocityRatio < 2) {
      setData({ detected: false, rootCause: '', baselineDistribution: [], currentDistribution: [], costImpactPerHour: 0, topShifts: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [baselineRecords, currentRecords] = await Promise.all([
        safeDql(BASELINE_DIST_QUERY),
        safeDql(CURRENT_DIST_QUERY),
      ]);

      const baseline = toDistribution(baselineRecords);
      const current = toDistribution(currentRecords);

      // Find significant distribution shifts
      const baselineMap = new Map(baseline.map(b => [b.model, b]));
      const shifts: CostAnomalyRootCause['topShifts'] = [];
      const rootCauseParts: string[] = [];

      current.forEach(c => {
        const b = baselineMap.get(c.model);
        const baselinePct = b?.pct ?? 0;
        const diff = c.pct - baselinePct;

        if (Math.abs(diff) > 5) { // >5 percentage point shift
          shifts.push({
            model: c.model,
            baselinePct: Math.round(baselinePct),
            currentPct: Math.round(c.pct),
            direction: diff > 0 ? 'up' : 'down',
          });
        }
      });

      // Build root cause narrative
      const upShifts = shifts.filter(s => s.direction === 'up').sort((a, b) => (b.currentPct - b.baselinePct) - (a.currentPct - a.baselinePct));
      const downShifts = shifts.filter(s => s.direction === 'down');

      if (upShifts.length > 0) {
        const top = upShifts[0];
        rootCauseParts.push(`${top.model} usage surged from ${top.baselinePct}% to ${top.currentPct}%`);
      }
      if (downShifts.length > 0) {
        const top = downShifts[0];
        rootCauseParts.push(`${top.model} dropped from ${top.baselinePct}% to ${top.currentPct}%`);
      }

      // Cost impact: difference between current window hourly cost vs baseline hourly cost
      const baselineCostPerHour = baseline.reduce((s, b) => s + b.costUsd, 0) / 24;
      const currentCostPerHour = current.reduce((s, c) => s + c.costUsd, 0) * 2; // 30min → 1hr
      const costImpact = currentCostPerHour - baselineCostPerHour;

      const rootCause = rootCauseParts.length > 0
        ? `Model distribution shifted: ${rootCauseParts.join(' while ')}`
        : `Traffic volume increased ${velocityRatio.toFixed(1)}x above baseline`;

      setData({
        detected: shifts.length > 0 || velocityRatio >= 2,
        rootCause,
        baselineDistribution: baseline,
        currentDistribution: current,
        costImpactPerHour: costImpact,
        topShifts: shifts,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [velocityRatio]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
