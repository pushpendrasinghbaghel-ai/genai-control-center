// GenAI Control Center — Prompt-Level Cost Attribution
// Phase 4: "67% of your spend is on RAG prompts. Here are the exact patterns."
// Groups prompts by pattern prefix, calculates cost per pattern using rate cards

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface PromptCostPattern {
  patternPrefix: string;        // first 80 chars of normalised prompt
  model: string;
  provider: string;
  occurrences: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCostUsd: number;
  avgCostPerCall: number;
  pctOfTotalCost: number;
}

export interface PromptCostAttributionResult {
  patterns: PromptCostPattern[];
  totalPromptsCost: number;
  topPatternPct: number;
  uniquePatterns: number;
  totalPrompts: number;
}

// ============================================
// DQL Queries
// ============================================

/**
 * Two-stage attribution:
 * 1. Get prompt patterns (from gen_ai.auditing BizEvents)
 * 2. Get token stats per model (from gen_ai spans)
 * Then join in TypeScript by pattern → model → rate card pricing
 */

/** Stage 1: Prompt patterns with occurrence counts and model info */
const PROMPT_PATTERNS_QUERY = `
fetch bizevents, from: now()-2h, to: now()
| filter event.type == "gen_ai.auditing"
| filter gen_ai.type == "prompt.input"
| fieldsAdd prompt_prefix = substring(toString(gen_ai.prompt), from:0, to:80),
            model = toString(gen_ai.model),
            system = toString(gen_ai.system)
| summarize occurrences = count(),
  by: { prompt_prefix, model, system }
| sort occurrences desc
| limit 25
`;

/** Stage 2: Average tokens per model (for cost estimation) */
const MODEL_AVG_TOKENS_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown"),
            provider = coalesce(gen_ai.provider.name, "unknown"),
            input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize avg_input = avg(input_tok),
            avg_output = avg(output_tok),
            total_requests = count(),
  by: { model, provider }
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
    console.warn('[GCC:PromptAttribution] DQL error:', err);
    return [];
  }
}

// Provider name normalisation: gen_ai.system → provider name used in rate cards
function normalizeProvider(system: string): string {
  const s = (system || '').toLowerCase();
  if (s.includes('openai') || s.includes('az.ai')) return 'azure_openai';
  if (s.includes('bedrock') || s.includes('amazon')) return 'amazon_bedrock';
  if (s.includes('vertex') || s.includes('google')) return 'google';
  if (s.includes('anthropic')) return 'anthropic';
  if (s.includes('ollama')) return 'ollama';
  if (s.includes('cohere')) return 'cohere';
  return s || 'unknown';
}

// ============================================
// Hook
// ============================================

export function usePromptCostAttribution() {
  const [data, setData] = useState<PromptCostAttributionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [patternRecords, modelTokenRecords] = await Promise.all([
        safeDql(PROMPT_PATTERNS_QUERY),
        safeDql(MODEL_AVG_TOKENS_QUERY),
      ]);

      // Build a lookup: model → { avgInput, avgOutput, provider }
      const modelLookup = new Map<string, { avgInput: number; avgOutput: number; provider: string }>();
      modelTokenRecords.forEach((r: any) => {
        const model = String(r.model || '').toLowerCase();
        modelLookup.set(model, {
          avgInput: Number(r.avg_input) || 200,
          avgOutput: Number(r.avg_output) || 100,
          provider: String(r.provider || 'unknown'),
        });
      });

      // Calculate cost per pattern
      let totalCost = 0;
      let totalPrompts = 0;
      const patterns: PromptCostPattern[] = patternRecords.map((r: any) => {
        const patternPrefix = String(r.prompt_prefix || '').trim();
        const model = String(r.model || 'unknown');
        const system = String(r.system || '');
        const occurrences = Number(r.occurrences) || 0;

        // Resolve avg tokens for this model
        const modelKey = model.toLowerCase();
        const modelStats = modelLookup.get(modelKey);
        const avgInput = modelStats?.avgInput ?? 200;
        const avgOutput = modelStats?.avgOutput ?? 100;
        const provider = modelStats?.provider ?? normalizeProvider(system);

        // Cost per call using rate card
        const singleCallCost = estimateCost(provider, avgInput, avgOutput, model);
        const patternTotalCost = singleCallCost * occurrences;

        totalCost += patternTotalCost;
        totalPrompts += occurrences;

        return {
          patternPrefix,
          model,
          provider,
          occurrences,
          avgInputTokens: Math.round(avgInput),
          avgOutputTokens: Math.round(avgOutput),
          totalCostUsd: patternTotalCost,
          avgCostPerCall: singleCallCost,
          pctOfTotalCost: 0, // computed below
        };
      });

      // Compute percentage of total
      patterns.forEach(p => {
        p.pctOfTotalCost = totalCost > 0 ? (p.totalCostUsd / totalCost) * 100 : 0;
      });

      // Sort by total cost descending
      patterns.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

      setData({
        patterns,
        totalPromptsCost: totalCost,
        topPatternPct: patterns.length > 0 ? patterns[0].pctOfTotalCost : 0,
        uniquePatterns: patterns.length,
        totalPrompts,
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
