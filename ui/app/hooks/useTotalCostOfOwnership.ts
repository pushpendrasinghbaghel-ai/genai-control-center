// GenAI Control Center — Total Cost of AI Ownership (TCoAI)
// Phase 2: The Iceberg — Token cost + Infrastructure cost + Training cost
// Only Dynatrace has all three in the same database.

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface TCoAICostLayer {
  category: 'token' | 'infrastructure' | 'training';
  label: string;
  costUsd: number;
  percentage: number;
  detail: string;
}

export interface TCoAISummary {
  totalDailyCost: number;
  tokenCost: number;
  infraCost: number;
  trainingCost: number;
  layers: TCoAICostLayer[];
  tokenPct: number;
  infraPct: number;
  trainingPct: number;
  infraProviderBreakdown: { provider: string; cost: number; regions: number; instances: number }[];
  trainingJobCount: number;
}

// ============================================
// DQL Queries
// ============================================

/** Token cost: aggregate gen_ai spans by provider + model for rate-card pricing */
const TOKEN_COST_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown"),
            input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize total_input = sum(input_tok),
            total_output = sum(output_tok),
            request_count = count(),
  by: { provider, model }
`;

/** Infrastructure cost: real cloud pricing from cost.list.price BizEvents */
const INFRA_COST_QUERY = `
fetch bizevents, from: now()-24h, to: now()
| filter event.type == "cost.list.price"
| summarize total_cost = sum(toDouble(price.total)),
            instance_count = countDistinct(resource.instance.type),
            region_count = countDistinct(cloud.region),
  by: { provider = cloud.provider }
`;

/** Training cost: fine-tuning jobs from gen_ai.auditing BizEvents */
const TRAINING_JOBS_QUERY = `
fetch bizevents, from: now()-24h, to: now()
| filter event.type == "gen_ai.auditing"
| filter gen_ai.type == "training"
| filter isNotNull(eventName)
| fieldsAdd params = toString(requestParameters)
| parse params, "ld 'baseModelIdentifier\":\"' ld:base_model '\"'"
| fieldsAdd status = coalesce(eventName, "unknown")
| summarize job_count = count(),
            models_trained = countDistinct(base_model),
  by: { base_model, status }
`;

// Approximate training cost per job by base model (from AWS Bedrock pricing docs)
const TRAINING_COST_PER_JOB: Record<string, number> = {
  'amazon.titan-text-express': 8.0,
  'amazon.titan-text-express-v1': 8.0,
  'amazon.titan-text-lite': 4.0,
  'amazon.titan-text-lite-v1': 4.0,
  'meta.llama3-1-8b': 12.0,
  'meta.llama3-1-70b': 45.0,
  'meta.llama3-1-405b': 90.0,
  'anthropic.claude-3-haiku': 6.0,
  'anthropic.claude-3-sonnet': 25.0,
  'cohere.command-r': 10.0,
};
const DEFAULT_TRAINING_COST = 10.0;

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
    console.warn('[GCC:TCoAI] DQL error:', err);
    return [];
  }
}

// ============================================
// Hook
// ============================================

export function useTotalCostOfOwnership() {
  const [data, setData] = useState<TCoAISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fire all three queries in parallel
      const [tokenRecords, infraRecords, trainingRecords] = await Promise.all([
        safeDql(TOKEN_COST_QUERY),
        safeDql(INFRA_COST_QUERY),
        safeDql(TRAINING_JOBS_QUERY),
      ]);

      // ── Token cost: sum rate-card-based cost per (provider, model) ──
      let tokenCost = 0;
      tokenRecords.forEach((r: any) => {
        const provider = String(r.provider || 'unknown');
        const model = String(r.model || 'unknown');
        const inputTok = Number(r.total_input) || 0;
        const outputTok = Number(r.total_output) || 0;
        tokenCost += estimateCost(provider, inputTok, outputTok, model);
      });

      // ── Infrastructure cost: real cloud pricing from BizEvents ──
      let infraCost = 0;
      const infraBreakdown: TCoAISummary['infraProviderBreakdown'] = [];
      infraRecords.forEach((r: any) => {
        const cost = Number(r.total_cost) || 0;
        infraCost += cost;
        infraBreakdown.push({
          provider: String(r.provider || 'unknown'),
          cost,
          regions: Number(r.region_count) || 0,
          instances: Number(r.instance_count) || 0,
        });
      });

      // ── Training cost: estimated from job count × per-job rate ──
      let trainingCost = 0;
      let trainingJobCount = 0;
      trainingRecords.forEach((r: any) => {
        const baseModel = String(r.base_model || '').toLowerCase();
        const jobCount = Number(r.job_count) || 0;
        trainingJobCount += jobCount;
        const perJob = Object.entries(TRAINING_COST_PER_JOB).find(
          ([key]) => baseModel.includes(key)
        )?.[1] ?? DEFAULT_TRAINING_COST;
        trainingCost += jobCount * perJob;
      });

      // ── Assemble TCoAI summary ──
      const totalDailyCost = tokenCost + infraCost + trainingCost;
      const safeTotal = totalDailyCost || 1; // avoid division by zero

      const layers: TCoAICostLayer[] = [
        {
          category: 'token',
          label: 'Token / API Cost',
          costUsd: tokenCost,
          percentage: (tokenCost / safeTotal) * 100,
          detail: `${tokenRecords.length} provider–model combinations`,
        },
        {
          category: 'infrastructure',
          label: 'Cloud Infrastructure',
          costUsd: infraCost,
          percentage: (infraCost / safeTotal) * 100,
          detail: `${infraBreakdown.reduce((s, b) => s + b.instances, 0)} instance types across ${infraBreakdown.reduce((s, b) => s + b.regions, 0)} regions`,
        },
        {
          category: 'training',
          label: 'Training & Fine-Tuning',
          costUsd: trainingCost,
          percentage: (trainingCost / safeTotal) * 100,
          detail: `${trainingJobCount} fine-tuning jobs`,
        },
      ];

      setData({
        totalDailyCost,
        tokenCost,
        infraCost,
        trainingCost,
        layers,
        tokenPct: (tokenCost / safeTotal) * 100,
        infraPct: (infraCost / safeTotal) * 100,
        trainingPct: (trainingCost / safeTotal) * 100,
        infraProviderBreakdown: infraBreakdown,
        trainingJobCount,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
