// Response Analytics Hook
// Real metrics for ML Engineers: Token efficiency, output consistency, model comparison
// NO fake hallucination detection - only observable metrics from OpenTelemetry spans

import { useState, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface TokenEfficiencyMetrics {
  serviceId: string;
  serviceName: string;
  model: string;
  provider: string;
  requestCount: number;
  // Token metrics
  avgInputTokens: number;
  avgOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokenRatio: number; // output/input ratio - efficiency indicator
  // Consistency metrics
  outputVariance: number;
  outputStdDev: number;
  lowOutputRate: number; // % of requests with < 10 output tokens
  // Cost metrics
  estimatedCost: number;
  costPerRequest: number;
  // Latency
  avgLatency: number;
  p95Latency: number;
  // Flags
  inefficient: boolean; // low token ratio
  inconsistent: boolean; // high variance
  expensive: boolean; // high input, low output
}

export interface ModelComparison {
  model: string;
  provider: string;
  serviceCount: number;
  totalRequests: number;
  avgTokenRatio: number;
  avgOutputTokens: number;
  avgLatency: number;
  errorRate: number;
  estimatedCostPer1K: number;
  efficiencyScore: number; // computed: balance of quality vs cost
}

export interface PromptPattern {
  pattern: string; // First 100 chars normalized
  frequency: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgLatency: number;
  services: string[];
  cacheEligible: boolean; // repeated pattern = cacheable
}

export interface ResponseAnalyticsSummary {
  totalRequests: number;
  totalTokens: number;
  avgTokenRatio: number;
  inefficientServices: number;
  inconsistentServices: number;
  topInefficient: TokenEfficiencyMetrics[];
  topInconsistent: TokenEfficiencyMetrics[];
  modelRankings: ModelComparison[];
}

// ============================================
// Main Hook
// ============================================

export function useResponseAnalytics() {
  const [metrics, setMetrics] = useState<TokenEfficiencyMetrics[]>([]);
  const [modelComparisons, setModelComparisons] = useState<ModelComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyzeResponses = useCallback(async (timeframe: string = '24h') => {
    setLoading(true);
    setError(null);

    try {
      // Fetch token efficiency metrics grouped by service + model
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | summarize {
                request_count = count(),
                total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
                total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0)),
                avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
                avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
                output_variance = variance(coalesce(gen_ai.usage.output_tokens, 0)),
                avg_latency = avg(duration) / 1000000,
                p95_latency = percentile(duration / 1000000, 95),
                low_output_count = countIf(coalesce(gen_ai.usage.output_tokens, 0) < 10 AND coalesce(gen_ai.usage.output_tokens, 0) >= 0),
                error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
              }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
            | fieldsAdd output_std_dev = sqrt(output_variance)
            | fieldsAdd token_ratio = if(avg_input_tokens > 0, then: avg_output_tokens / avg_input_tokens, else: 0)
            | fieldsAdd low_output_rate = if(request_count > 0, then: low_output_count / request_count * 100, else: 0)
            | fieldsAdd error_rate = if(request_count > 0, then: error_count / request_count * 100, else: 0)
            | sort request_count desc
            | limit 100
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      
      // Fetch entity names
      const serviceEntityIds = [...new Set(records.map((r: any) => r['dt.entity.service']).filter(Boolean))];
      const entityNamesMap = new Map<string, string>();
      
      if (serviceEntityIds.length > 0) {
        try {
          const filterConditions = serviceEntityIds.map((id: string) => `id == "${id}"`).join(' OR ');
          const entityQuery = await queryExecutionClient.queryExecute({
            body: {
              query: `fetch dt.entity.service | filter ${filterConditions} | fields id, entity.name`,
              requestTimeoutMilliseconds: 30000,
              fetchTimeoutSeconds: 30
            }
          });
          (entityQuery.result?.records || []).forEach((rec: any) => {
            if (rec.id && rec['entity.name']) {
              entityNamesMap.set(rec.id, rec['entity.name']);
            }
          });
        } catch (e) {
          console.warn('[GCC] Could not fetch entity names:', e);
        }
      }

      // Transform to TokenEfficiencyMetrics
      const efficiencyMetrics: TokenEfficiencyMetrics[] = records.map((record: any) => {
        const entityId = record['dt.entity.service'];
        const serviceName = entityNamesMap.get(entityId) || entityId || 'Unknown';
        const model = record['gen_ai.request.model'] || 'Unknown';
        const provider = record['gen_ai.provider.name'] || 'Unknown';
        
        const avgInput = Number(record.avg_input_tokens) || 0;
        const avgOutput = Number(record.avg_output_tokens) || 0;
        const tokenRatio = avgInput > 0 ? avgOutput / avgInput : 0;
        const outputVariance = Number(record.output_variance) || 0;
        const lowOutputRate = Number(record.low_output_rate) || 0;
        
        // Estimate cost (using rough public pricing)
        const totalInput = Number(record.total_input_tokens) || 0;
        const totalOutput = Number(record.total_output_tokens) || 0;
        const estimatedCost = estimateTokenCost(provider, model, totalInput, totalOutput);
        const requestCount = Number(record.request_count) || 1;
        
        return {
          serviceId: entityId || serviceName,
          serviceName,
          model,
          provider,
          requestCount,
          avgInputTokens: avgInput,
          avgOutputTokens: avgOutput,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          tokenRatio,
          outputVariance,
          outputStdDev: Math.sqrt(outputVariance),
          lowOutputRate,
          estimatedCost,
          costPerRequest: requestCount > 0 ? estimatedCost / requestCount : 0,
          avgLatency: Number(record.avg_latency) || 0,
          p95Latency: Number(record.p95_latency) || 0,
          // Flags based on observable metrics only
          inefficient: tokenRatio < 0.5 && avgInput > 100, // High input, low output
          inconsistent: outputVariance > 10000 || lowOutputRate > 20, // High variance
          expensive: avgInput > 500 && avgOutput < 50, // Expensive prompts with little return
        };
      });

      setMetrics(efficiencyMetrics);

      // Generate model comparisons
      const modelMap = new Map<string, {
        model: string;
        provider: string;
        services: Set<string>;
        totalRequests: number;
        totalTokenRatio: number;
        totalOutputTokens: number;
        totalLatency: number;
        totalErrors: number;
        count: number;
        totalCost: number;
      }>();

      efficiencyMetrics.forEach(m => {
        const key = `${m.provider}:${m.model}`;
        if (!modelMap.has(key)) {
          modelMap.set(key, {
            model: m.model,
            provider: m.provider,
            services: new Set(),
            totalRequests: 0,
            totalTokenRatio: 0,
            totalOutputTokens: 0,
            totalLatency: 0,
            totalErrors: 0,
            count: 0,
            totalCost: 0
          });
        }
        const entry = modelMap.get(key)!;
        entry.services.add(m.serviceName);
        entry.totalRequests += m.requestCount;
        entry.totalTokenRatio += m.tokenRatio;
        entry.totalOutputTokens += m.avgOutputTokens;
        entry.totalLatency += m.avgLatency;
        entry.count++;
        entry.totalCost += m.estimatedCost;
      });

      const comparisons: ModelComparison[] = Array.from(modelMap.values()).map(entry => {
        const avgTokenRatio = entry.count > 0 ? entry.totalTokenRatio / entry.count : 0;
        const avgLatency = entry.count > 0 ? entry.totalLatency / entry.count : 0;
        const avgOutputTokens = entry.count > 0 ? entry.totalOutputTokens / entry.count : 0;
        const costPer1K = entry.totalRequests > 0 ? (entry.totalCost / entry.totalRequests) * 1000 : 0;
        
        // Efficiency score: balance of token ratio, latency, and cost
        // Higher token ratio = better, lower latency = better, lower cost = better
        const efficiencyScore = Math.round(
          (Math.min(avgTokenRatio, 3) / 3 * 40) + // Token ratio up to 40 points
          (Math.max(0, 100 - avgLatency / 50) * 0.3) + // Latency up to 30 points
          (Math.max(0, 100 - costPer1K / 10) * 0.3) // Cost up to 30 points
        );

        return {
          model: entry.model,
          provider: entry.provider,
          serviceCount: entry.services.size,
          totalRequests: entry.totalRequests,
          avgTokenRatio,
          avgOutputTokens,
          avgLatency,
          errorRate: 0, // TODO: track from metrics
          estimatedCostPer1K: costPer1K,
          efficiencyScore: Math.max(0, Math.min(100, efficiencyScore))
        };
      }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);

      setModelComparisons(comparisons);

    } catch (err) {
      console.error('[GCC] Response analytics failed:', err);
      setError(err instanceof Error ? err : new Error('Analysis failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Summary statistics
  const summary = useMemo((): ResponseAnalyticsSummary | null => {
    if (metrics.length === 0) return null;

    const totalRequests = metrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.totalInputTokens + m.totalOutputTokens, 0);
    const avgTokenRatio = metrics.reduce((sum, m) => sum + m.tokenRatio, 0) / metrics.length;
    
    const inefficientServices = metrics.filter(m => m.inefficient);
    const inconsistentServices = metrics.filter(m => m.inconsistent);

    return {
      totalRequests,
      totalTokens,
      avgTokenRatio,
      inefficientServices: inefficientServices.length,
      inconsistentServices: inconsistentServices.length,
      topInefficient: inefficientServices.sort((a, b) => a.tokenRatio - b.tokenRatio).slice(0, 5),
      topInconsistent: inconsistentServices.sort((a, b) => b.outputVariance - a.outputVariance).slice(0, 5),
      modelRankings: modelComparisons.slice(0, 10)
    };
  }, [metrics, modelComparisons]);

  return {
    metrics,
    modelComparisons,
    loading,
    error,
    summary,
    analyzeResponses
  };
}

// ============================================
// Cost Estimation Helper (based on public pricing)
// ============================================

function estimateTokenCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const providerLower = provider.toLowerCase();
  const modelLower = model.toLowerCase();
  
  // Pricing per 1M tokens (approximate public pricing as of 2024)
  let inputPricePer1M = 0.50;
  let outputPricePer1M = 1.50;
  
  if (providerLower.includes('openai')) {
    if (modelLower.includes('gpt-4o')) {
      inputPricePer1M = 2.50;
      outputPricePer1M = 10.00;
    } else if (modelLower.includes('gpt-4-turbo') || modelLower.includes('gpt-4')) {
      inputPricePer1M = 10.00;
      outputPricePer1M = 30.00;
    } else if (modelLower.includes('gpt-3.5')) {
      inputPricePer1M = 0.50;
      outputPricePer1M = 1.50;
    }
  } else if (providerLower.includes('anthropic')) {
    if (modelLower.includes('opus')) {
      inputPricePer1M = 15.00;
      outputPricePer1M = 75.00;
    } else if (modelLower.includes('sonnet')) {
      inputPricePer1M = 3.00;
      outputPricePer1M = 15.00;
    } else if (modelLower.includes('haiku')) {
      inputPricePer1M = 0.25;
      outputPricePer1M = 1.25;
    }
  } else if (providerLower.includes('google') || providerLower.includes('gemini')) {
    if (modelLower.includes('pro')) {
      inputPricePer1M = 1.25;
      outputPricePer1M = 5.00;
    } else {
      inputPricePer1M = 0.35;
      outputPricePer1M = 1.05;
    }
  }
  
  const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
  
  return inputCost + outputCost;
}
