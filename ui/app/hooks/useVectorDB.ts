// GenAI Control Center — RAG / Vector DB Hook (Phase 5)
// Surfaces Pinecone vector store metrics + embedding pipeline observability
// Data: ~115K Pinecone spans/week + ~113K embedding spans/week in Grail

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { getEffectiveRate, calculateCostFromRate, loadRateCardConfig } from '../config/rate-card-config';
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
  VECTOR_INDEX_PERFORMANCE_QUERY,
  VECTOR_INGESTION_METRICS_QUERY,
  VECTOR_RESULT_SET_SIZES_QUERY,
  SOURCE_DOCUMENT_METADATA_QUERY,
  TOKENIZATION_DRIFT_QUERY,
  RETRIEVAL_ANOMALIES_QUERY,
  CONTEXT_RETRIEVAL_EFFECTIVENESS_QUERY,
  RAG_LATENCY_HEATMAP_QUERY,
  RAG_PIPELINE_FLOW_QUERY,
  RAG_TOKEN_TREEMAP_QUERY,
  RAG_MODEL_HONEYCOMB_QUERY,
  RAG_EVENT_STREAM_QUERY,
  RAG_COST_BY_MODEL_QUERY,
  RAG_LATENCY_HISTOGRAM_QUERY,
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
  VectorIndexPerformance,
  VectorIngestionPoint,
  VectorResultSetSize,
  SourceDocumentMetadata,
  TokenizationDriftPoint,
  RetrievalAnomalyPoint,
  ContextRetrievalEffectiveness,
  HeatmapCell,
  PipelineFlowStage,
  TokenTreemapEntry,
  ModelHoneycombTile,
  RAGStreamEvent,
  CostByModel,
  LatencyBucket,
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

  // Phase 5.4 — Extended Vector DB Observability
  indexPerformance: VectorIndexPerformance[];
  ingestionTimeseries: VectorIngestionPoint[];
  resultSetSizes: VectorResultSetSize[];
  sourceDocMetadata: SourceDocumentMetadata[];
  tokenizationDrift: TokenizationDriftPoint[];
  retrievalAnomalies: RetrievalAnomalyPoint[];
  contextEffectiveness: ContextRetrievalEffectiveness[];

  // Phase 5.5 — Advanced Visualizations
  heatmapCells: HeatmapCell[];
  pipelineFlowStages: PipelineFlowStage[];
  tokenTreemap: TokenTreemapEntry[];
  modelHoneycomb: ModelHoneycombTile[];
  eventStream: RAGStreamEvent[];

  // Phase 5.6 — Tier 1 Analytics
  costByModel: CostByModel[];
  latencyBuckets: LatencyBucket[];

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
  // Phase 5.4 extended state
  const [indexPerformance, setIndexPerformance] = useState<VectorIndexPerformance[]>([]);
  const [ingestionTimeseries, setIngestionTimeseries] = useState<VectorIngestionPoint[]>([]);
  const [resultSetSizes, setResultSetSizes] = useState<VectorResultSetSize[]>([]);
  const [sourceDocMetadata, setSourceDocMetadata] = useState<SourceDocumentMetadata[]>([]);
  const [tokenizationDrift, setTokenizationDrift] = useState<TokenizationDriftPoint[]>([]);
  const [retrievalAnomalies, setRetrievalAnomalies] = useState<RetrievalAnomalyPoint[]>([]);
  const [contextEffectiveness, setContextEffectiveness] = useState<ContextRetrievalEffectiveness[]>([]);
  // Phase 5.5 — Advanced Visualizations
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [pipelineFlowStages, setPipelineFlowStages] = useState<PipelineFlowStage[]>([]);
  const [tokenTreemap, setTokenTreemap] = useState<TokenTreemapEntry[]>([]);
  const [modelHoneycomb, setModelHoneycomb] = useState<ModelHoneycombTile[]>([]);
  const [eventStream, setEventStream] = useState<RAGStreamEvent[]>([]);
  // Phase 5.6 — Tier 1 Analytics
  const [costByModel, setCostByModel] = useState<CostByModel[]>([]);
  const [latencyBuckets, setLatencyBuckets] = useState<LatencyBucket[]>([]);
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
        indexPerfRecs,
        ingestionRecs,
        resultSetRecs,
        sourceDocRecs,
        tokenDriftRecs,
        anomalyRecs,
        contextEffRecs,
        heatmapRecs,
        pipelineFlowRecs,
        tokenTreemapRecs,
        modelHoneycombRecs,
        eventStreamRecs,
        costByModelRecs,
        latencyHistogramRecs,
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
        runQuery(VECTOR_INDEX_PERFORMANCE_QUERY(filters)),
        runQuery(VECTOR_INGESTION_METRICS_QUERY(filters)),
        runQuery(VECTOR_RESULT_SET_SIZES_QUERY(filters)),
        runQuery(SOURCE_DOCUMENT_METADATA_QUERY(filters)),
        runQuery(TOKENIZATION_DRIFT_QUERY(filters)),
        runQuery(RETRIEVAL_ANOMALIES_QUERY(filters)),
        runQuery(CONTEXT_RETRIEVAL_EFFECTIVENESS_QUERY(filters)),
        runQuery(RAG_LATENCY_HEATMAP_QUERY(filters)),
        runQuery(RAG_PIPELINE_FLOW_QUERY(filters)),
        runQuery(RAG_TOKEN_TREEMAP_QUERY(filters)),
        runQuery(RAG_MODEL_HONEYCOMB_QUERY(filters)),
        runQuery(RAG_EVENT_STREAM_QUERY(filters)),
        runQuery(RAG_COST_BY_MODEL_QUERY(filters)),
        runQuery(RAG_LATENCY_HISTOGRAM_QUERY(filters)),
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

      // ---- Index Performance ----
      const indexPerf: VectorIndexPerformance[] = (indexPerfRecs as any[]).map((r) => ({
        opType: String(r['op_type'] ?? 'query'),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p50LatencyMs: Number(r['p50_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        p99LatencyMs: Number(r['p99_latency_ms'] ?? 0),
        callCount: Number(r['call_count'] ?? 0),
        errorCount: Number(r['error_count'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setIndexPerformance(indexPerf);

      // ---- Ingestion Timeseries ----
      const ingestion: VectorIngestionPoint[] = [];
      (ingestionRecs as any[]).forEach((r) => {
        const tf = r['timeframe'] as any;
        const rangeStart = new Date(tf?.start ?? 0).getTime();
        const intervalMs = Number(r['interval'] ?? 0) / 1_000_000;
        const upsertsArr: any[] = Array.isArray(r['upserts']) ? r['upserts'] : [];
        const errArr: any[] = Array.isArray(r['errors']) ? r['errors'] : [];
        upsertsArr.forEach((val: any, i: number) => {
          const ts = rangeStart + i * intervalMs;
          if (ts > 0) ingestion.push({
            timestamp: ts,
            upserts: Number(val ?? 0),
            avgUpsertLatencyMs: 0,
            errors: Number(errArr[i] ?? 0),
          });
        });
      });
      setIngestionTimeseries(ingestion);

      // ---- Result Set Sizes ----
      const resultSets: VectorResultSetSize[] = (resultSetRecs as any[]).map((r) => ({
        namespace: String(r['namespace'] ?? 'default'),
        indexName: String(r['index_name'] ?? 'unknown'),
        queryCount: Number(r['query_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setResultSetSizes(resultSets);

      // ---- Source Document Metadata ----
      const srcDocs: SourceDocumentMetadata[] = (sourceDocRecs as any[]).map((r) => ({
        namespace: String(r['namespace'] ?? 'default'),
        indexName: String(r['index_name'] ?? 'unknown'),
        dbSystem: String(r['db_system'] ?? 'unknown'),
        queryCount: Number(r['query_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setSourceDocMetadata(srcDocs);

      // ---- Tokenization Drift ----
      const tokenDrift: TokenizationDriftPoint[] = [];
      (tokenDriftRecs as any[]).forEach((r) => {
        const tf = r['timeframe'] as any;
        const rangeStart = new Date(tf?.start ?? 0).getTime();
        const intervalMs = Number(r['interval'] ?? 0) / 1_000_000;
        const avgPArr: any[] = Array.isArray(r['avg_prompt_tokens']) ? r['avg_prompt_tokens'] : [];
        const p95PArr: any[] = Array.isArray(r['p95_prompt_tokens']) ? r['p95_prompt_tokens'] : [];
        const avgCArr: any[] = Array.isArray(r['avg_completion_tokens']) ? r['avg_completion_tokens'] : [];
        const totalArr2: any[] = Array.isArray(r['total_tokens']) ? r['total_tokens'] : [];
        avgPArr.forEach((val: any, i: number) => {
          const ts = rangeStart + i * intervalMs;
          if (ts > 0) tokenDrift.push({
            timestamp: ts,
            avgPromptTokens: Number(val ?? 0),
            p95PromptTokens: Number(p95PArr[i] ?? 0),
            avgCompletionTokens: Number(avgCArr[i] ?? 0),
            totalTokens: Number(totalArr2[i] ?? 0),
          });
        });
      });
      setTokenizationDrift(tokenDrift);

      // ---- Retrieval Anomalies ----
      const anomalies: RetrievalAnomalyPoint[] = (anomalyRecs as any[]).map((r) => ({
        timestamp: new Date(String(r['hour_bucket'] ?? 0)).getTime(),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        p99LatencyMs: Number(r['p99_latency_ms'] ?? 0),
        queryCount: Number(r['query_count'] ?? 0),
        errorCount: Number(r['error_count'] ?? 0),
        anomalyRatio: Number(r['anomaly_ratio'] ?? 0),
        isAnomalous: Boolean(r['is_anomalous']),
      }));
      setRetrievalAnomalies(anomalies);

      // ---- Context Retrieval Effectiveness ----
      const ctxEff: ContextRetrievalEffectiveness[] = (contextEffRecs as any[]).map((r) => ({
        namespace: String(r['namespace'] ?? 'default'),
        totalQueries: Number(r['total_queries'] ?? 0),
        successfulQueries: Number(r['successful_queries'] ?? 0),
        failedQueries: Number(r['failed_queries'] ?? 0),
        successRate: Number(r['success_rate'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
      }));
      setContextEffectiveness(ctxEff);

      // ---- Heatmap Cells ----
      const heatmap: HeatmapCell[] = (heatmapRecs as any[]).map((r) => ({
        hourOfDay: Number(r['hour_of_day'] ?? 0),
        dayOfWeek: Number(r['day_of_week'] ?? 0),
        totalCount: Number(r['total_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
      }));
      setHeatmapCells(heatmap);

      // ---- Pipeline Flow Stages ----
      const flowStages: PipelineFlowStage[] = (pipelineFlowRecs as any[]).map((r) => ({
        stage: String(r['stage'] ?? 'Generate') as PipelineFlowStage['stage'],
        totalCount: Number(r['total_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        errorCount: Number(r['error_count'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
      }));
      setPipelineFlowStages(flowStages);

      // ---- Token Treemap ----
      const treemap: TokenTreemapEntry[] = (tokenTreemapRecs as any[]).map((r) => ({
        provider: String(r['provider'] ?? 'unknown'),
        model: String(r['model'] ?? 'unknown'),
        tokenSum: Number(r['token_sum'] ?? 0),
        requestCount: Number(r['request_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
      }));
      setTokenTreemap(treemap);

      // ---- Model Honeycomb ----
      const honeycomb: ModelHoneycombTile[] = (modelHoneycombRecs as any[]).map((r) => ({
        model: String(r['model'] ?? 'unknown'),
        provider: String(r['provider'] ?? 'unknown'),
        requestCount: Number(r['request_count'] ?? 0),
        avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
        p95LatencyMs: Number(r['p95_latency_ms'] ?? 0),
        errorRate: Number(r['error_rate'] ?? 0),
        totalTokens: Number(r['total_tokens'] ?? 0),
      }));
      setModelHoneycomb(honeycomb);

      // ---- Event Stream ----
      const events: RAGStreamEvent[] = (eventStreamRecs as any[]).map((r) => ({
        timestamp: String(r['timestamp'] ?? ''),
        stage: String(r['stage'] ?? 'Generate') as RAGStreamEvent['stage'],
        model: String(r['model'] ?? 'unknown'),
        provider: String(r['provider'] ?? 'unknown'),
        latencyMs: Number(r['latency_ms'] ?? 0),
        isSlow: Boolean(r['is_slow']),
        hasError: Boolean(r['has_error']),
        inputTokens: Number(r['input_tokens'] ?? 0),
        outputTokens: Number(r['output_tokens'] ?? 0),
      }));
      setEventStream(events);

      // ---- Cost by Model ----
      const costModels: CostByModel[] = (costByModelRecs as any[]).map((r) => {
        const inputTok = Number(r['input_tokens'] ?? 0);
        const outputTok = Number(r['output_tokens'] ?? 0);
        const prov = String(r['provider'] ?? 'unknown');
        const mdl = String(r['model'] ?? 'unknown');
        const rate = getEffectiveRate(loadRateCardConfig(), prov, mdl);
        return {
          provider: prov,
          model: mdl,
          inputTokens: inputTok,
          outputTokens: outputTok,
          requestCount: Number(r['request_count'] ?? 0),
          avgLatencyMs: Number(r['avg_latency_ms'] ?? 0),
          estimatedCost: calculateCostFromRate(rate, inputTok, outputTok),
        };
      });
      costModels.sort((a, b) => b.estimatedCost - a.estimatedCost);
      setCostByModel(costModels);

      // ---- Latency Histogram ----
      const BUCKET_ORDER = ['0-50ms', '50-100ms', '100-250ms', '250-500ms', '500ms-1s', '1-2s', '2-5s', '5s+'];
      const bucketMap = new Map<string, number>();
      BUCKET_ORDER.forEach((b) => bucketMap.set(b, 0));
      (latencyHistogramRecs as any[]).forEach((r) => {
        const b = String(r['bucket'] ?? '');
        const c = Number(r['spanCount'] ?? 0);
        bucketMap.set(b, (bucketMap.get(b) ?? 0) + c);
      });
      const buckets: LatencyBucket[] = BUCKET_ORDER.map((b) => ({ bucket: b, spanCount: bucketMap.get(b) ?? 0 }));
      setLatencyBuckets(buckets);

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
    indexPerformance,
    ingestionTimeseries,
    resultSetSizes,
    sourceDocMetadata,
    tokenizationDrift,
    retrievalAnomalies,
    contextEffectiveness,
    heatmapCells,
    pipelineFlowStages,
    tokenTreemap,
    modelHoneycomb,
    eventStream,
    costByModel,
    latencyBuckets,
    loading,
    error,
    refetch,
  };
}
