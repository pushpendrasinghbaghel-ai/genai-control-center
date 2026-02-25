// GenAI Control Center — RAG / Vector DB Hook (Phase 5)
// Surfaces Pinecone vector store metrics + embedding pipeline observability
// Data: ~115K Pinecone spans/week + ~113K embedding spans/week in Grail

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  VECTOR_DB_LATENCY_QUERY,
  VECTOR_DB_VOLUME_QUERY,
  VECTOR_DB_HEALTH_QUERY,
  VECTOR_DB_CACHE_CANDIDATES_QUERY,
  EMBEDDING_VOLUME_QUERY,
  EMBEDDING_TREND_QUERY,
  RAG_PIPELINE_QUERY,
  RAG_PIPELINE_SUMMARY_QUERY,
  TTFT_BY_MODEL_QUERY,
  TTFT_SUMMARY_QUERY,
  CHAIN_PERFORMANCE_QUERY,
} from '../queries/dql-queries';
import type { QueryFilters } from './useDQLQueries';
import type {
  VectorDBLatency,
  EmbeddingProvider,
  RAGPipelineStep,
  RAGPipelineTrace,
  VectorDBCacheCandidate,
  VectorDBSummary,
  TTFTByModel,
  TTFTSummary,
  ChainPerformanceStep,
} from '../types';

// ============================================
// Hook Return Shape
// ============================================

export interface UseVectorDBReturn {
  // Vector DB
  latency: VectorDBLatency | null;
  volumeTimeseries: Array<{ timestamp: number; queries: number }>;
  healthTimeseries: Array<{ timestamp: number; total: number; errors: number }>;
  cacheCandidates: VectorDBCacheCandidate[];
  summary: VectorDBSummary | null;

  // Embeddings
  embeddingProviders: EmbeddingProvider[];
  embeddingTimeseries: Array<{ timestamp: number; embeddings: number }>;

  // RAG Pipeline
  pipelineSteps: RAGPipelineStep[];
  pipelineTraces: RAGPipelineTrace[];

  // TTFT
  ttftByModel: TTFTByModel[];
  ttftSummary: TTFTSummary | null;

  // Chain
  chainSteps: ChainPerformanceStep[];

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
    console.warn('[GCC:VectorDB] Query failed:', e);
    return [];
  }
}

// ============================================
// Main Hook
// ============================================

export function useVectorDB(filters?: QueryFilters): UseVectorDBReturn {
  const [latency, setLatency] = useState<VectorDBLatency | null>(null);
  const [volumeTimeseries, setVolumeTimeseries] = useState<Array<{ timestamp: number; queries: number }>>([]);
  const [healthTimeseries, setHealthTimeseries] = useState<Array<{ timestamp: number; total: number; errors: number }>>([]);
  const [cacheCandidates, setCacheCandidates] = useState<VectorDBCacheCandidate[]>([]);
  const [summary, setSummary] = useState<VectorDBSummary | null>(null);
  const [embeddingProviders, setEmbeddingProviders] = useState<EmbeddingProvider[]>([]);
  const [embeddingTimeseries, setEmbeddingTimeseries] = useState<Array<{ timestamp: number; embeddings: number }>>([]);
  const [pipelineSteps, setPipelineSteps] = useState<RAGPipelineStep[]>([]);
  const [pipelineTraces, setPipelineTraces] = useState<RAGPipelineTrace[]>([]);
  const [ttftByModel, setTtftByModel] = useState<TTFTByModel[]>([]);
  const [ttftSummary, setTtftSummary] = useState<TTFTSummary | null>(null);
  const [chainSteps, setChainSteps] = useState<ChainPerformanceStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[GCC:VectorDB] Fetching all RAG metrics…');

      // Run all queries in parallel for speed
      const [
        latencyRecs,
        volumeRecs,
        healthRecs,
        cacheRecs,
        embeddingRecs,
        embeddingTrendRecs,
        pipelineSummaryRecs,
        pipelineTraceRecs,
        ttftModelRecs,
        ttftSummaryRecs,
        chainRecs,
      ] = await Promise.all([
        runQuery(VECTOR_DB_LATENCY_QUERY(filters)),
        runQuery(VECTOR_DB_VOLUME_QUERY(filters)),
        runQuery(VECTOR_DB_HEALTH_QUERY(filters)),
        runQuery(VECTOR_DB_CACHE_CANDIDATES_QUERY(filters)),
        runQuery(EMBEDDING_VOLUME_QUERY(filters)),
        runQuery(EMBEDDING_TREND_QUERY(filters)),
        runQuery(RAG_PIPELINE_SUMMARY_QUERY(filters)),
        runQuery(RAG_PIPELINE_QUERY(filters)),
        runQuery(TTFT_BY_MODEL_QUERY(filters)),
        runQuery(TTFT_SUMMARY_QUERY(filters)),
        runQuery(CHAIN_PERFORMANCE_QUERY(filters)),
      ]);

      // ---- Vector DB Latency ----
      if (latencyRecs.length > 0) {
        const r = latencyRecs[0] as any;
        setLatency({
          avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
          p50Ms: Number(r['p50_ms'] ?? 0),
          p95Ms: Number(r['p95_ms'] ?? 0),
          p99Ms: Number(r['p99_ms'] ?? 0),
          queryCount: Number(r['query_count'] ?? 0),
          errorCount: Number(r['error_count'] ?? 0),
          errorRate: Number(r['error_rate'] ?? 0),
        });
      }

      // ---- Volume Timeseries ----
      // makeTimeseries: record.timeframe = whole range {start, end}, record.interval = nanoseconds per bucket
      // Metric arrays are index-aligned; compute per-bucket start as rangeStart + i * intervalMs
      const vol: Array<{ timestamp: number; queries: number }> = [];
      (volumeRecs as any[]).forEach((r) => {
        const tf = r['timeframe'] as any;
        const rangeStart = new Date(tf?.start ?? 0).getTime();
        const intervalMs = Number(r['interval'] ?? 0) / 1_000_000; // ns → ms
        const queriesArr: any[] = Array.isArray(r['queries']) ? r['queries'] : [];
        queriesArr.forEach((val: any, i: number) => {
          const ts = rangeStart + i * intervalMs;
          if (ts > 0) vol.push({ timestamp: ts, queries: Number(val ?? 0) });
        });
      });
      setVolumeTimeseries(vol);

      // ---- Health Timeseries ----
      // makeTimeseries: record.timeframe = whole range {start, end}, record.interval = nanoseconds per bucket
      const health: Array<{ timestamp: number; total: number; errors: number }> = [];
      (healthRecs as any[]).forEach((r) => {
        const tf = r['timeframe'] as any;
        const rangeStart = new Date(tf?.start ?? 0).getTime();
        const intervalMs = Number(r['interval'] ?? 0) / 1_000_000; // ns → ms
        const totalArr: any[] = Array.isArray(r['total']) ? r['total'] : [];
        const errorsArr: any[] = Array.isArray(r['errors']) ? r['errors'] : [];
        totalArr.forEach((val: any, i: number) => {
          const ts = rangeStart + i * intervalMs;
          if (ts > 0) health.push({ timestamp: ts, total: Number(val ?? 0), errors: Number(errorsArr[i] ?? 0) });
        });
      });
      setHealthTimeseries(health);

      // ---- Cache Candidates ----
      const cache: VectorDBCacheCandidate[] = (cacheRecs as any[]).map((r) => {
        const avgMs = Number(r['avg_latency_ms'] ?? 0);
        const count = Number(r['count'] ?? 0);
        return {
          queryPreview: String(r['query_preview'] ?? ''),
          count,
          avgLatencyMs: avgMs,
          savingsPotentialMs: avgMs * (count - 1), // each duplicate hit costs this
        };
      });
      setCacheCandidates(cache);

      // ---- Embedding Providers ----
      const embedProviders: EmbeddingProvider[] = (embeddingRecs as any[]).map((r) => ({
        provider: String(r['provider'] ?? 'unknown'),
        model: String(r['model'] ?? 'unknown'),
        callCount: Number(r['call_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setEmbeddingProviders(embedProviders);

      // ---- Embedding Trend ----
      // makeTimeseries: record.timeframe = whole range {start, end}, record.interval = nanoseconds per bucket
      const embedTrend: Array<{ timestamp: number; embeddings: number }> = [];
      (embeddingTrendRecs as any[]).forEach((r) => {
        const tf = r['timeframe'] as any;
        const rangeStart = new Date(tf?.start ?? 0).getTime();
        const intervalMs = Number(r['interval'] ?? 0) / 1_000_000; // ns → ms
        const embeddingsArr: any[] = Array.isArray(r['embeddings']) ? r['embeddings'] : [];
        embeddingsArr.forEach((val: any, i: number) => {
          const ts = rangeStart + i * intervalMs;
          if (ts > 0) embedTrend.push({ timestamp: ts, embeddings: Number(val ?? 0) });
        });
      });
      setEmbeddingTimeseries(embedTrend);

      // ---- RAG Pipeline Steps ----
      const stepMap: Record<string, 'embed' | 'retrieve' | 'generate'> = {
        embed: 'embed',
        retrieve: 'retrieve',
        generate: 'generate',
      };
      const steps: RAGPipelineStep[] = (pipelineSummaryRecs as any[]).map((r) => ({
        stepType: stepMap[String(r['step_type'])] ?? 'generate',
        avgDurationMs: Number(r['avg_latency_ms'] ?? 0),
        p95DurationMs: Number(r['p95_latency_ms'] ?? 0),
        callCount: Number(r['call_count'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setPipelineSteps(steps);

      // ---- RAG Pipeline Traces ----
      const traces: RAGPipelineTrace[] = (pipelineTraceRecs as any[]).map((r) => {
        const hasEmbed = Boolean(r['has_embed']);
        const hasRetrieve = Boolean(r['has_retrieve']);
        const hasGenerate = Boolean(r['has_generate']);
        return {
          traceId: String(r['trace.id'] ?? r['sample_trace_id'] ?? ''),
          totalDurationMs: Number(r['total_duration_ms'] ?? 0),
          spanCount: Number(r['span_count'] ?? 0),
          hasEmbed,
          hasRetrieve,
          hasGenerate,
          isFullPipeline: hasEmbed && hasRetrieve && hasGenerate,
          serviceName: r['service_name'] ? String(r['service_name']) : undefined,
          traceStart: r['trace_start'] ? String(r['trace_start']) : undefined,
        };
      });
      setPipelineTraces(traces);

      // ---- TTFT by Model ----
      const ttftModels: TTFTByModel[] = (ttftModelRecs as any[]).map((r) => ({
        model: String(r['model'] ?? 'unknown'),
        provider: String(r['provider'] ?? 'unknown'),
        avgTtftMs: Number(r['avg_ttft_ms'] ?? 0),
        p50TtftMs: Number(r['p50_ttft_ms'] ?? 0),
        p95TtftMs: Number(r['p95_ttft_ms'] ?? 0),
        requestCount: Number(r['request_count'] ?? 0),
      }));
      setTtftByModel(ttftModels);

      // ---- TTFT Summary ----
      if (ttftSummaryRecs.length > 0) {
        const r = ttftSummaryRecs[0] as any;
        setTtftSummary({
          avgTtftMs: Number(r['avg_ttft_ms'] ?? 0),
          p95TtftMs: Number(r['p95_ttft_ms'] ?? 0),
          count: Number(r['count'] ?? 0),
        });
      }

      // ---- Chain Performance ----
      const chain: ChainPerformanceStep[] = (chainRecs as any[]).map((r) => ({
        stepLabel: String(r['step_label'] ?? ''),
        avgDurationMs: Number(r['avg_duration_ms'] ?? 0),
        p95DurationMs: Number(r['p95_duration_ms'] ?? 0),
        callCount: Number(r['call_count'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setChainSteps(chain);

      // ---- Summary Card ----
      const totalPinecone = latencyRecs.length > 0 ? Number((latencyRecs[0] as any)['query_count'] ?? 0) : 0;
      const totalEmbeddings = embedProviders.reduce((s, p) => s + p.callCount, 0);
      const fullPipelineCount = traces.filter((t) => t.isFullPipeline).length;
      const topCacheCount = cache.slice(0, 5).reduce((s, c) => s + c.count, 0);
      const cacheablePct = cache.length > 0 && totalPinecone > 0
        ? (topCacheCount / totalPinecone) * 100
        : 0;

      setSummary({
        totalPineconeQueries: totalPinecone,
        totalEmbeddings,
        avgLatencyMs: latencyRecs.length > 0 ? Number((latencyRecs[0] as any)['avg_latency_ms'] ?? 0) : 0,
        p95LatencyMs: latencyRecs.length > 0 ? Number((latencyRecs[0] as any)['p95_ms'] ?? 0) : 0,
        errorRate: latencyRecs.length > 0 ? Number((latencyRecs[0] as any)['error_rate'] ?? 0) : 0,
        fullPipelineTraces: fullPipelineCount,
        cacheablePct,
      });

      console.log('[GCC:VectorDB] Done. Pinecone queries:', totalPinecone, '| Embeddings:', totalEmbeddings);
    } catch (err) {
      console.error('[GCC:VectorDB] Error:', err);
      setError(err instanceof Error ? err : new Error('VectorDB data fetch failed'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return {
    latency,
    volumeTimeseries,
    healthTimeseries,
    cacheCandidates,
    summary,
    embeddingProviders,
    embeddingTimeseries,
    pipelineSteps,
    pipelineTraces,
    ttftByModel,
    ttftSummary,
    chainSteps,
    loading,
    error,
    refetch,
  };
}
