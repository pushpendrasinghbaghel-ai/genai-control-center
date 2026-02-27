// GenAI Control Center — Cross-Provider Deep Observability Hook (Phase 7)
// Surfaces real Grail data: prompt caching, OTel token metrics, cross-provider comparison
// Only features backed by confirmed live data are included

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  PROMPT_CACHE_SUMMARY_QUERY,
  PROMPT_CACHE_HIT_RATE_QUERY,
  PROMPT_CACHE_TREND_QUERY,
  PROMPT_CACHE_TIME_SAVED_QUERY,
  OTEL_TOKEN_CONSUMPTION_QUERY,
  TOP_EXPENSIVE_PROMPTS_QUERY,
  TOP_SLOWEST_PROMPTS_QUERY,
  SERVICE_HEALTH_PIE_QUERY,
  CROSS_PROVIDER_SUMMARY_QUERY,
} from '../queries/dql-queries';
import type { QueryFilters } from './useDQLQueries';
import type {
  PromptCacheSummary,
  PromptCacheHitRate,
  PromptCacheTimeSaved,
  OtelTokenConsumption,
  TopPromptEntry,
  ServiceHealthSplit,
  CrossProviderSummaryRow,
} from '../types';

// ============================================
// Hook Return Shape
// ============================================

export interface UseProviderDeepDiveReturn {
  // Prompt Caching (confirmed: gen_ai.prompt.caching metric + gen_ai.prompt_caching span attribute)
  cacheSummary: PromptCacheSummary | null;
  cacheHitRate: PromptCacheHitRate | null;
  cacheTrend: Array<{ timestamp: number; cacheRead: number }>;
  cacheTimeSaved: PromptCacheTimeSaved | null;

  // OTel Token Metrics (confirmed: gen_ai.client.token.usage metric with input/output split)
  otelTokens: OtelTokenConsumption | null;

  // Top Prompts (confirmed: gen_ai.usage.input_tokens + output_tokens span attributes)
  topExpensivePrompts: TopPromptEntry[];
  topSlowestPrompts: TopPromptEntry[];

  // Cross-Provider (confirmed: gen_ai.provider.name span attribute)
  serviceHealth: ServiceHealthSplit[];
  crossProviderSummary: CrossProviderSummaryRow[];

  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// Helper
// ============================================

async function runQuery(query: string): Promise<unknown[]> {
  try {
    const resp = await queryExecutionClient.queryExecute({
      body: {
        query,
        requestTimeoutMilliseconds: 60000,
        fetchTimeoutSeconds: 60,
      },
    });
    return resp.result?.records ?? [];
  } catch (e) {
    console.warn('[GCC:DeepDive] Query failed:', e);
    return [];
  }
}

/** Extract timeseries buckets from DQL makeTimeseries / timeseries record */
function extractTimeseries(
  recs: any[],
  fieldNames: string[],
): Array<Record<string, number>> {
  const result: Array<Record<string, number>> = [];
  recs.forEach((r) => {
    const tf = r['timeframe'] as any;
    const rangeStart = new Date(tf?.start ?? 0).getTime();
    const intervalMs = Number(r['interval'] ?? 0) / 1_000_000; // ns → ms
    // Use first field to determine length
    const firstArr: any[] = Array.isArray(r[fieldNames[0]]) ? r[fieldNames[0]] : [];
    firstArr.forEach((_: any, i: number) => {
      const ts = rangeStart + i * intervalMs;
      if (ts > 0) {
        const point: Record<string, number> = { timestamp: ts };
        fieldNames.forEach((f) => {
          const arr: any[] = Array.isArray(r[f]) ? r[f] : [];
          point[f] = Number(arr[i] ?? 0);
        });
        result.push(point);
      }
    });
  });
  return result;
}

// ============================================
// Main Hook
// ============================================

export function useProviderDeepDive(filters?: QueryFilters): UseProviderDeepDiveReturn {
  const [cacheSummary, setCacheSummary] = useState<PromptCacheSummary | null>(null);
  const [cacheHitRate, setCacheHitRate] = useState<PromptCacheHitRate | null>(null);
  const [cacheTrend, setCacheTrend] = useState<Array<{ timestamp: number; cacheRead: number }>>([]);
  const [cacheTimeSaved, setCacheTimeSaved] = useState<PromptCacheTimeSaved | null>(null);
  const [otelTokens, setOtelTokens] = useState<OtelTokenConsumption | null>(null);
  const [topExpensivePrompts, setTopExpensivePrompts] = useState<TopPromptEntry[]>([]);
  const [topSlowestPrompts, setTopSlowestPrompts] = useState<TopPromptEntry[]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthSplit[]>([]);
  const [crossProviderSummary, setCrossProviderSummary] = useState<CrossProviderSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[GCC:DeepDive] Fetching cross-provider deep observability data…');

      const [
        cacheSumRecs,
        cacheHitRecs,
        cacheTrendRecs,
        cacheTimeSavedRecs,
        otelTokenRecs,
        expensiveRecs,
        slowestRecs,
        healthRecs,
        crossProvRecs,
      ] = await Promise.all([
        runQuery(PROMPT_CACHE_SUMMARY_QUERY(filters)),
        runQuery(PROMPT_CACHE_HIT_RATE_QUERY(filters)),
        runQuery(PROMPT_CACHE_TREND_QUERY(filters)),
        runQuery(PROMPT_CACHE_TIME_SAVED_QUERY(filters)),
        runQuery(OTEL_TOKEN_CONSUMPTION_QUERY(filters)),
        runQuery(TOP_EXPENSIVE_PROMPTS_QUERY(filters)),
        runQuery(TOP_SLOWEST_PROMPTS_QUERY(filters)),
        runQuery(SERVICE_HEALTH_PIE_QUERY(filters)),
        runQuery(CROSS_PROVIDER_SUMMARY_QUERY(filters)),
      ]);

      // ---- Prompt Cache Summary ----
      if (cacheSumRecs.length > 0) {
        const r = cacheSumRecs[0] as any;
        setCacheSummary({
          cachedTokens: Number(r['cached_tokens'] ?? 0),
          writeTokens: Number(r['write_tokens'] ?? 0),
          estimatedSavingsUsd: Number(r['estimated_savings_usd'] ?? 0),
        });
      }

      // ---- Cache Hit Rate ----
      if (cacheHitRecs.length > 0) {
        const r = cacheHitRecs[0] as any;
        setCacheHitRate({
          hits: Number(r['hits'] ?? 0),
          total: Number(r['total'] ?? 0),
          cacheHitPct: Number(r['cache_hit_pct'] ?? 0),
        });
      }

      // ---- Cache Trend ----
      const cTrend = extractTimeseries(cacheTrendRecs as any[], ['cache_read']);
      setCacheTrend(cTrend.map((p) => ({
        timestamp: p.timestamp,
        cacheRead: p.cache_read ?? 0,
      })));

      // ---- Cache Time Saved ----
      if (cacheTimeSavedRecs.length > 0) {
        const r = cacheTimeSavedRecs[0] as any;
        setCacheTimeSaved({
          cachedDurationMs: Number(r['cached_duration_ns'] ?? 0) / 1000000,
          normalDurationMs: Number(r['normal_duration_ns'] ?? 0) / 1000000,
          timeSavedMs: Number(r['time_saved_ms'] ?? 0),
        });
      }

      // ---- OTel Tokens ----
      if (otelTokenRecs.length > 0) {
        const r = otelTokenRecs[0] as any;
        setOtelTokens({
          totalInputTokens: Number(r['total_input_tokens'] ?? 0),
          totalOutputTokens: Number(r['total_output_tokens'] ?? 0),
          totalTokens: Number(r['total_tokens'] ?? 0),
          estimatedCostUsd: Number(r['estimated_cost_usd'] ?? 0),
        });
      }

      // ---- Top Prompts ----
      const mapPrompt = (r: any): TopPromptEntry => ({
        prompt: String(r['prompt'] ?? ''),
        response: String(r['response'] ?? ''),
        traceId: String(r['trace_id'] ?? ''),
        provider: String(r['provider'] ?? ''),
        model: String(r['model'] ?? ''),
        totalTokens: Number(r['total_tokens'] ?? r['tokens'] ?? 0),
        durationMs: Number(r['duration_ms'] ?? r['response_time_ms'] ?? 0),
      });
      setTopExpensivePrompts((expensiveRecs as any[]).map(mapPrompt));
      setTopSlowestPrompts((slowestRecs as any[]).map(mapPrompt));

      // ---- Service Health ----
      setServiceHealth((healthRecs as any[]).map((r) => ({
        status: String(r['status'] ?? ''),
        requests: Number(r['requests'] ?? 0),
      })));

      // ---- Cross-Provider Summary ----
      setCrossProviderSummary((crossProvRecs as any[]).map((r) => ({
        provider: String(r['gen_ai.provider.name'] ?? ''),
        requests: Number(r['requests'] ?? 0),
        totalInput: Number(r['total_input'] ?? 0),
        totalOutput: Number(r['total_output'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p99LatencyMs: Number(r['p99_latency_ms'] ?? 0),
        errors: Number(r['errors'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      })));

      console.log('[GCC:DeepDive] Done fetching cross-provider data.');
    } catch (err) {
      console.error('[GCC:DeepDive] Error:', err);
      setError(err instanceof Error ? err : new Error('DeepDive data fetch failed'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return {
    cacheSummary,
    cacheHitRate,
    cacheTrend,
    cacheTimeSaved,
    otelTokens,
    topExpensivePrompts,
    topSlowestPrompts,
    serviceHealth,
    crossProviderSummary,
    loading,
    error,
    refetch,
  };
}
