// GenAI Control Center — Model Quality-Need Matching (FinOps Foundation KPI #10)
// "Are you using GPT-4o for tasks that GPT-4o-mini could handle?"
// Uses benchmark scores (MMLU, etc.) stored in rate card config to detect over-provisioned models.
// Narrative placement: Tab 3 "AI Economics" AFTER Model Arbitrage — adds the "quality need" dimension.

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Model Benchmark Database
// ============================================

/**
 * Approximate MMLU scores and cost tiers for common models.
 * Source: Public benchmark leaderboards, updated periodically.
 * Users can override via rate card in future iterations.
 */
export interface ModelBenchmark {
  model: string;
  patterns: string[];        // fuzzy match patterns
  mmluScore: number;         // 0-100 (higher = smarter)
  tier: 'flagship' | 'balanced' | 'efficient' | 'embedding';
  description: string;
}

export const MODEL_BENCHMARKS: ModelBenchmark[] = [
  // Flagship (MMLU 86+) — use only for complex reasoning
  { model: 'gpt-4o', patterns: ['gpt-4o', 'gpt4o'], mmluScore: 88, tier: 'flagship', description: 'GPT-4o flagship' },
  { model: 'gpt-4-turbo', patterns: ['gpt-4-turbo', 'gpt4-turbo'], mmluScore: 86, tier: 'flagship', description: 'GPT-4 Turbo' },
  { model: 'claude-3-opus', patterns: ['claude-3-opus', 'claude3-opus'], mmluScore: 87, tier: 'flagship', description: 'Claude 3 Opus' },
  { model: 'gemini-2.5-pro', patterns: ['gemini-2.5-pro', 'gemini-25-pro'], mmluScore: 89, tier: 'flagship', description: 'Gemini 2.5 Pro' },
  { model: 'gemini-1.5-pro', patterns: ['gemini-1.5-pro', 'gemini-15-pro'], mmluScore: 85, tier: 'flagship', description: 'Gemini 1.5 Pro' },
  { model: 'llama3.1:405b', patterns: ['llama3.1:405b', 'llama-3.1-405b'], mmluScore: 86, tier: 'flagship', description: 'Llama 3.1 405B' },

  // Balanced (MMLU 75-85) — good for most tasks
  { model: 'gpt-4o-mini', patterns: ['gpt-4o-mini', 'gpt4o-mini'], mmluScore: 82, tier: 'balanced', description: 'GPT-4o Mini' },
  { model: 'claude-3.5-sonnet', patterns: ['claude-3.5-sonnet', 'claude-35-sonnet'], mmluScore: 84, tier: 'balanced', description: 'Claude 3.5 Sonnet' },
  { model: 'claude-3-sonnet', patterns: ['claude-3-sonnet', 'claude3-sonnet'], mmluScore: 79, tier: 'balanced', description: 'Claude 3 Sonnet' },
  { model: 'gemini-2.0-flash', patterns: ['gemini-2.0-flash', 'gemini-20-flash'], mmluScore: 80, tier: 'balanced', description: 'Gemini 2.0 Flash' },
  { model: 'gemini-1.5-flash', patterns: ['gemini-1.5-flash', 'gemini-15-flash'], mmluScore: 78, tier: 'balanced', description: 'Gemini 1.5 Flash' },
  { model: 'llama3.1:8b', patterns: ['llama3.1:8b', 'llama-3.1-8b'], mmluScore: 73, tier: 'balanced', description: 'Llama 3.1 8B' },

  // Efficient (MMLU <75) — for simple tasks, classification, extraction
  { model: 'gpt-3.5-turbo', patterns: ['gpt-3.5-turbo', 'gpt-35-turbo', 'gpt35'], mmluScore: 70, tier: 'efficient', description: 'GPT-3.5 Turbo' },
  { model: 'claude-3-haiku', patterns: ['claude-3-haiku', 'claude3-haiku'], mmluScore: 75, tier: 'efficient', description: 'Claude 3 Haiku' },
  { model: 'mistral-small', patterns: ['mistral-small'], mmluScore: 68, tier: 'efficient', description: 'Mistral Small' },
  { model: 'orca-mini:3b', patterns: ['orca-mini', 'orca-mini:3b'], mmluScore: 55, tier: 'efficient', description: 'Orca Mini 3B' },

  // Embedding models — not scored on MMLU
  { model: 'text-embedding-ada-002', patterns: ['ada-002', 'text-embedding-ada'], mmluScore: 0, tier: 'embedding', description: 'Ada Embedding' },
  { model: 'text-embedding-3-large', patterns: ['text-embedding-3-large'], mmluScore: 0, tier: 'embedding', description: 'OAI Embed Large' },
  { model: 'text-embedding-3-small', patterns: ['text-embedding-3-small'], mmluScore: 0, tier: 'embedding', description: 'OAI Embed Small' },
  { model: 'titan-embed-text-v1', patterns: ['titan-embed'], mmluScore: 0, tier: 'embedding', description: 'Titan Embedding' },
  { model: 'textembedding-gecko', patterns: ['textembedding-gecko', 'gecko'], mmluScore: 0, tier: 'embedding', description: 'Gecko Embedding' },
];

// ============================================
// Types for hook output
// ============================================

export interface ModelQualityMatch {
  model: string;
  provider: string;
  requestCount: number;
  /** Matched benchmark or null */
  benchmark: ModelBenchmark | null;
  /** MMLU score (0 if unknown) */
  mmluScore: number;
  tier: 'flagship' | 'balanced' | 'efficient' | 'embedding' | 'unknown';
  /** Avg input tokens — proxy for task complexity */
  avgInputTokens: number;
  /** Avg output tokens */
  avgOutputTokens: number;
  /** Estimated cost ($) */
  estimatedCost: number;
  /** Is this model over-provisioned for its typical task? */
  isOverProvisioned: boolean;
  /** Recommended tier based on avg prompt size */
  recommendedTier: 'flagship' | 'balanced' | 'efficient';
  /** Potential savings from downgrading */
  potentialSavings: number;
}

export interface QualityNeedResult {
  /** All models with quality matching */
  models: ModelQualityMatch[];
  /** Number of over-provisioned models */
  overProvisionedCount: number;
  /** Total potential savings from right-sizing model quality */
  totalPotentialSavings: number;
  /** Narrative insight */
  insight: string;
}

// ============================================
// DQL — get model usage with token distribution
// ============================================

const MODEL_USAGE_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, 0)),
            provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown")
| summarize request_count = count(),
            avg_input = avg(input_tok),
            avg_output = avg(output_tok),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
  by: { model, provider }
| sort request_count desc
| limit 30
`;

// ============================================
// Helpers
// ============================================

function matchBenchmark(modelName: string): ModelBenchmark | null {
  const lower = modelName.toLowerCase();
  for (const b of MODEL_BENCHMARKS) {
    if (b.patterns.some(p => lower.includes(p))) return b;
  }
  return null;
}

/**
 * Heuristic: what model tier does this prompt complexity need?
 * - Short prompts (<50 avg input tokens) → simple tasks → efficient tier
 * - Medium prompts (50-200) → standard tasks → balanced tier
 * - Long prompts (200+) → complex context → flagship tier might be justified
 */
function recommendedTierForComplexity(avgInput: number): 'flagship' | 'balanced' | 'efficient' {
  if (avgInput > 200) return 'flagship';
  if (avgInput > 50) return 'balanced';
  return 'efficient';
}

const TIER_RANK: Record<string, number> = { embedding: 0, efficient: 1, balanced: 2, flagship: 3, unknown: 1 };

export function useModelQualityNeedMatching() {
  const [data, setData] = useState<QualityNeedResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryExecutionClient.queryExecute({
        body: { query: MODEL_USAGE_QUERY, requestTimeoutMilliseconds: 30000 },
      });

      const records = result?.result?.records || [];
      if (records.length === 0) { setData(null); setLoading(false); return; }

      const models: ModelQualityMatch[] = records.map((r: any) => {
        const model = String(r.model || 'unknown');
        const provider = String(r.provider || 'unknown');
        const reqCount = Number(r.request_count) || 0;
        const avgInput = Number(r.avg_input) || 0;
        const avgOutput = Number(r.avg_output) || 0;
        const totalInput = Number(r.total_input) || 0;
        const totalOutput = Number(r.total_output) || 0;

        const benchmark = matchBenchmark(model);
        const tier = benchmark?.tier || 'unknown';
        const mmlu = benchmark?.mmluScore || 0;
        const cost = estimateCost(provider, totalInput, totalOutput, model);
        const recTier = recommendedTierForComplexity(avgInput);

        // Over-provisioned = model tier is higher than what the task needs
        // Embedding models are never over-provisioned
        const isOverProvisioned = tier !== 'embedding' && tier !== 'unknown'
          && TIER_RANK[tier] > TIER_RANK[recTier];

        // Potential savings: estimate difference between current and recommended tier
        // Flagship → Balanced saves ~60%, Flagship → Efficient saves ~80%, Balanced → Efficient saves ~50%
        let savingsRate = 0;
        if (isOverProvisioned) {
          if (tier === 'flagship' && recTier === 'efficient') savingsRate = 0.80;
          else if (tier === 'flagship' && recTier === 'balanced') savingsRate = 0.60;
          else if (tier === 'balanced' && recTier === 'efficient') savingsRate = 0.50;
        }

        return {
          model,
          provider,
          requestCount: reqCount,
          benchmark,
          mmluScore: mmlu,
          tier: tier as ModelQualityMatch['tier'],
          avgInputTokens: avgInput,
          avgOutputTokens: avgOutput,
          estimatedCost: cost,
          isOverProvisioned,
          recommendedTier: recTier,
          potentialSavings: cost * savingsRate,
        };
      });

      const overProvisionedCount = models.filter(m => m.isOverProvisioned).length;
      const totalSavings = models.reduce((s, m) => s + m.potentialSavings, 0);

      // Build insight
      let insight: string;
      if (overProvisionedCount === 0) {
        insight = 'All models are appropriately matched to their task complexity. No quality over-provisioning detected.';
      } else {
        const topOver = models.filter(m => m.isOverProvisioned).sort((a, b) => b.potentialSavings - a.potentialSavings)[0];
        insight = `${overProvisionedCount} model(s) are over-provisioned for their typical prompt complexity. Top opportunity: ${topOver.model} (${topOver.tier} tier) is handling prompts that only need ${topOver.recommendedTier} tier — potential savings of $${topOver.potentialSavings.toFixed(2)}.`;
      }

      setData({ models, overProvisionedCount, totalPotentialSavings: totalSavings, insight });
    } catch (err) {
      console.error('[useModelQualityNeedMatching] Query failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
