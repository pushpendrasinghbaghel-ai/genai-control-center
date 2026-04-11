// GenAI Control Center — Model Arbitrage Advisor
// Phase 3: "Should I use GPT-4o or Claude or Llama?" answered from YOUR production data
// Compares all models on the same service: cost, latency, output quality, error rate → value score

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface ModelArbitrageRow {
  model: string;
  provider: string;
  requestCount: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
  errorRate: number;
  costPerRequest: number;
  totalCost: number;
  outputInputRatio: number;
  valueScore: number;         // 0-100 normalised
  category: 'chat' | 'embedding';
}

export interface ArbitrageRecommendation {
  action: string;
  monthlySavings: number;
  qualityImpact: string;
  fromModel: string;
  toModel: string;
  type: 'cost_saving' | 'quality_upgrade' | 'reliability';
}

export interface ModelArbitrageResult {
  chatModels: ModelArbitrageRow[];
  embeddingModels: ModelArbitrageRow[];
  recommendations: ArbitrageRecommendation[];
  totalMonthlySpend: number;
  potentialMonthlySavings: number;
}

// ============================================
// DQL Query
// ============================================

const MODEL_ARBITRAGE_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown"),
            input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
            is_error = if(span.status_code == "Error", 1, else: 0)
| summarize request_count = count(),
            avg_input = avg(input_tok),
            avg_output = avg(output_tok),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
            avg_duration_ns = avg(duration),
            error_count = sum(is_error),
  by: { model, provider }
| sort request_count desc
| limit 30
`;

// ============================================
// Helpers
// ============================================

const EMBEDDING_PATTERNS = ['embed', 'gecko', 'ada-002', 'titan-embed', 'textembedding'];

function isEmbeddingModel(model: string): boolean {
  const lower = model.toLowerCase();
  return EMBEDDING_PATTERNS.some(p => lower.includes(p));
}

function calculateValueScores(models: ModelArbitrageRow[]): ModelArbitrageRow[] {
  if (models.length === 0) return [];

  const maxCost = Math.max(...models.map(m => m.costPerRequest), 0.0001);
  const maxLatency = Math.max(...models.map(m => m.avgDurationMs), 1);
  const maxOutputRatio = Math.max(...models.map(m => m.outputInputRatio), 0.01);

  return models.map(m => {
    // Efficiency factors (0-1 each, higher is better)
    const costEff = 1 - (m.costPerRequest / maxCost);
    const latencyEff = 1 - (m.avgDurationMs / maxLatency);
    const outputEff = m.outputInputRatio / maxOutputRatio;
    const reliability = 1 - m.errorRate;

    // Weighted composite: cost 40%, latency 20%, output quality 20%, reliability 20%
    const score = (costEff * 0.4 + latencyEff * 0.2 + outputEff * 0.2 + reliability * 0.2) * 100;
    return { ...m, valueScore: Math.round(Math.max(0, Math.min(100, score))) };
  });
}

function generateRecommendations(
  chatModels: ModelArbitrageRow[],
): ArbitrageRecommendation[] {
  const recs: ArbitrageRecommendation[] = [];
  if (chatModels.length < 2) return recs;

  const sorted = [...chatModels].sort((a, b) => a.costPerRequest - b.costPerRequest);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];

  // Recommend shifting from expensive to cheap if quality is comparable
  if (
    cheapest.provider !== mostExpensive.provider &&
    cheapest.errorRate <= mostExpensive.errorRate + 0.02 &&
    cheapest.avgDurationMs <= mostExpensive.avgDurationMs * 2
  ) {
    const savingsPerReq = mostExpensive.costPerRequest - cheapest.costPerRequest;
    const shiftableReqs = Math.floor(mostExpensive.requestCount * 0.6);
    const monthlySavings = savingsPerReq * shiftableReqs * 30;

    if (monthlySavings > 0.5) {
      recs.push({
        action: `Route ${Math.round(shiftableReqs / mostExpensive.requestCount * 100)}% of ${mostExpensive.model} traffic to ${cheapest.model}`,
        monthlySavings,
        qualityImpact: cheapest.errorRate <= mostExpensive.errorRate ? 'No quality degradation' : `< ${((cheapest.errorRate - mostExpensive.errorRate) * 100).toFixed(1)}% increased errors`,
        fromModel: mostExpensive.model,
        toModel: cheapest.model,
        type: 'cost_saving',
      });
    }
  }

  // Self-hosted model recommendation (Ollama = $0)
  const selfHosted = chatModels.find(m => m.costPerRequest === 0 && m.requestCount > 10);
  if (selfHosted) {
    const paidModels = chatModels.filter(m => m.costPerRequest > 0);
    const avgPaidCost = paidModels.reduce((s, m) => s + m.totalCost, 0);
    if (avgPaidCost > 0) {
      recs.push({
        action: `Increase ${selfHosted.model} (self-hosted) usage for simple queries`,
        monthlySavings: avgPaidCost * 0.2 * 30,
        qualityImpact: `Self-hosted model has ${(selfHosted.errorRate * 100).toFixed(1)}% error rate`,
        fromModel: 'paid models',
        toModel: selfHosted.model,
        type: 'cost_saving',
      });
    }
  }

  // High error rate alert
  const unreliable = chatModels.filter(m => m.errorRate > 0.05 && m.requestCount > 20);
  const reliable = chatModels.find(m => m.errorRate < 0.01 && m.requestCount > 20);
  unreliable.forEach(model => {
    if (reliable) {
      recs.push({
        action: `${model.model} has ${(model.errorRate * 100).toFixed(1)}% error rate — consider ${reliable.model} (${(reliable.errorRate * 100).toFixed(1)}%)`,
        monthlySavings: 0,
        qualityImpact: `Reduce errors by ${((model.errorRate - reliable.errorRate) * 100).toFixed(1)} percentage points`,
        fromModel: model.model,
        toModel: reliable.model,
        type: 'reliability',
      });
    }
  });

  return recs;
}

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
    console.warn('[GCC:ModelArbitrage] DQL error:', err);
    return [];
  }
}

// ============================================
// Hook
// ============================================

export function useModelArbitrage() {
  const [data, setData] = useState<ModelArbitrageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const records = await safeDql(MODEL_ARBITRAGE_QUERY);

      const allRows: ModelArbitrageRow[] = records.map((r: any) => {
        const provider = String(r.provider || 'unknown');
        const model = String(r.model || 'unknown');
        const avgInput = Number(r.avg_input) || 0;
        const avgOutput = Number(r.avg_output) || 0;
        const totalInput = Number(r.total_input) || 0;
        const totalOutput = Number(r.total_output) || 0;
        const requestCount = Number(r.request_count) || 0;
        const errorCount = Number(r.error_count) || 0;
        const avgDurationNs = Number(r.avg_duration_ns) || 0;

        const totalCost = estimateCost(provider, totalInput, totalOutput, model);
        const costPerRequest = requestCount > 0 ? totalCost / requestCount : 0;

        return {
          model,
          provider,
          requestCount,
          avgInputTokens: Math.round(avgInput),
          avgOutputTokens: Math.round(avgOutput),
          totalInputTokens: Math.round(totalInput),
          totalOutputTokens: Math.round(totalOutput),
          avgDurationMs: avgDurationNs / 1_000_000,
          errorRate: requestCount > 0 ? errorCount / requestCount : 0,
          costPerRequest,
          totalCost,
          outputInputRatio: avgInput > 0 ? avgOutput / avgInput : 0,
          valueScore: 0, // calculated below
          category: isEmbeddingModel(model) ? 'embedding' : 'chat',
        };
      });

      const chatModels = calculateValueScores(allRows.filter(m => m.category === 'chat'));
      const embeddingModels = calculateValueScores(allRows.filter(m => m.category === 'embedding'));

      // Sort by value score descending
      chatModels.sort((a, b) => b.valueScore - a.valueScore);
      embeddingModels.sort((a, b) => b.valueScore - a.valueScore);

      const recommendations = generateRecommendations(chatModels);
      const totalMonthlySpend = allRows.reduce((s, m) => s + m.totalCost, 0) * 30;
      const potentialMonthlySavings = recommendations.reduce((s, r) => s + r.monthlySavings, 0);

      setData({
        chatModels,
        embeddingModels,
        recommendations,
        totalMonthlySpend,
        potentialMonthlySavings,
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
