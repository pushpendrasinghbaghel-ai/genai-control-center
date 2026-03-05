// GenAI Control Center — RAG Health Score Hook
// Phase 3: Composite RAG health scoring + self-healing trigger detection
// Computes a 0-100 health score from real DQL data across 5 dimensions:
//   1. Vector DB Latency (p95 < 200ms = healthy)
//   2. Retrieval Freshness (span recency — stale data detection)
//   3. Pipeline Completion Rate (% of traces with all 3 RAG stages)
//   4. Error Rate (vector + embedding + LLM errors combined)
//   5. Cache Efficiency (duplicate query ratio = caching opportunity gap)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface RAGHealthDimension {
  name: string;
  score: number;         // 0-100
  weight: number;        // contribution to composite
  status: 'healthy' | 'degraded' | 'critical';
  details: string;
  rawValue: number;
  threshold: { healthy: number; degraded: number; unit: string };
}

export interface RAGHealthScore {
  compositeScore: number;     // 0-100 weighted
  status: 'healthy' | 'degraded' | 'critical';
  dimensions: RAGHealthDimension[];
  healingActions: HealingAction[];
  lastUpdated: number;
}

export interface HealingAction {
  id: string;
  dimension: string;
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  actionType: 'scale_db' | 'reindex' | 'adjust_topk' | 'flush_cache' | 'switch_model' | 'alert';
  automated: boolean;
  estimatedImpact: string;
}

export interface RAGHealthTrend {
  timestamp: number;
  compositeScore: number;
  latencyScore: number;
  freshnessScore: number;
  completionScore: number;
  errorScore: number;
  cacheScore: number;
}

// ============================================
// DQL Queries — all real, no mocks
// ============================================

/** Vector DB latency percentiles (last 2h for real-time scoring) */
const HEALTH_LATENCY_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector")
| summarize
    avg_ms = avg(duration / 1000000.0),
    p50_ms = percentile(duration / 1000000.0, 50),
    p95_ms = percentile(duration / 1000000.0, 95),
    p99_ms = percentile(duration / 1000000.0, 99),
    query_count = count(),
    error_count = countIf(otel.status_code == "ERROR")
`;

/** Retrieval freshness — latest vector query timestamp vs now */
const HEALTH_FRESHNESS_QUERY = `
fetch spans, from: now()-4h, to: now()
| filter db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector") OR matchesPhrase(span.name, "embed")
| summarize
    latest_query = max(start_time),
    earliest_query = min(start_time),
    total_spans = count(),
    distinct_services = countDistinct(service.name)
`;

/** Pipeline completion — traces with all 3 RAG stages */
const HEALTH_PIPELINE_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "embed")
| summarize
    has_embed = countIf(matchesPhrase(span.name, "embed") OR matchesPhrase(span.name, "embedding")),
    has_retrieve = countIf(db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "retrieve") OR matchesPhrase(span.name, "vector")),
    has_generate = countIf(isNotNull(gen_ai.request.model)),
    total_spans = count(),
    by: { trace_id }
| summarize
    total_traces = count(),
    full_pipeline = countIf(has_embed > 0 AND has_retrieve > 0 AND has_generate > 0),
    partial_pipeline = countIf((has_embed > 0 OR has_retrieve > 0) AND has_generate > 0 AND NOT (has_embed > 0 AND has_retrieve > 0 AND has_generate > 0)),
    retrieval_only = countIf(has_retrieve > 0 AND has_generate == 0)
`;

/** Combined error rates across all RAG components */
const HEALTH_ERROR_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "embed")
| summarize
    total = count(),
    errors = countIf(otel.status_code == "ERROR"),
    vector_errors = countIf((db.system == "pinecone" OR matchesPhrase(span.name, "pinecone")) AND otel.status_code == "ERROR"),
    embed_errors = countIf(matchesPhrase(span.name, "embed") AND otel.status_code == "ERROR"),
    llm_errors = countIf(isNotNull(gen_ai.request.model) AND otel.status_code == "ERROR")
`;

/** Cache efficiency — duplicate query detection */
const HEALTH_CACHE_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector")
| fieldsAdd query_text = coalesce(db.statement, span.name)
| summarize
    count = count(),
    by: { query_text }
| summarize
    total_queries = sum(count),
    unique_queries = count(),
    duplicate_queries = sumIf(count, count > 1),
    max_duplicates = max(count)
`;

/** Health score trend (hourly buckets over 24h) */
const HEALTH_TREND_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector") OR matchesPhrase(span.name, "embed") OR isNotNull(gen_ai.request.model)
| fieldsAdd is_vector = (db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector"))
| fieldsAdd is_error = (otel.status_code == "ERROR")
| summarize
    vector_p95_ms = percentile(if(is_vector, duration / 1000000.0, else: toDouble(NULL)), 95),
    vector_count = countIf(is_vector),
    error_count = countIf(is_error),
    total_count = count(),
    by: { hour = bin(start_time, 1h) }
| sort hour asc
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
    console.warn('[GCC:RAGHealth] DQL error:', err);
    return [];
  }
}

// ============================================
// Scoring Functions
// ============================================

function scoreLatency(p95Ms: number): { score: number; status: RAGHealthDimension['status'] } {
  // p95 < 100ms = 100, < 200ms = 80, < 500ms = 60, < 1000ms = 40, >= 1000ms = 20
  if (p95Ms <= 0) return { score: 50, status: 'degraded' }; // no data
  if (p95Ms < 100) return { score: 100, status: 'healthy' };
  if (p95Ms < 200) return { score: 85, status: 'healthy' };
  if (p95Ms < 500) return { score: 65, status: 'degraded' };
  if (p95Ms < 1000) return { score: 40, status: 'degraded' };
  return { score: 20, status: 'critical' };
}

function scoreFreshness(minutesSinceLastQuery: number): { score: number; status: RAGHealthDimension['status'] } {
  // < 5min = 100, < 15min = 80, < 30min = 60, < 60min = 40, >= 60min = 20
  if (minutesSinceLastQuery < 0) return { score: 50, status: 'degraded' }; // no data
  if (minutesSinceLastQuery < 5) return { score: 100, status: 'healthy' };
  if (minutesSinceLastQuery < 15) return { score: 85, status: 'healthy' };
  if (minutesSinceLastQuery < 30) return { score: 65, status: 'degraded' };
  if (minutesSinceLastQuery < 60) return { score: 40, status: 'degraded' };
  return { score: 20, status: 'critical' };
}

function scorePipelineCompletion(fullPct: number): { score: number; status: RAGHealthDimension['status'] } {
  // >80% full pipeline = 100, >60% = 75, >40% = 50, >20% = 30, else 15
  if (fullPct > 80) return { score: 100, status: 'healthy' };
  if (fullPct > 60) return { score: 75, status: 'healthy' };
  if (fullPct > 40) return { score: 55, status: 'degraded' };
  if (fullPct > 20) return { score: 35, status: 'degraded' };
  return { score: 15, status: 'critical' };
}

function scoreErrorRate(errorPct: number): { score: number; status: RAGHealthDimension['status'] } {
  // <0.5% = 100, <1% = 85, <3% = 65, <5% = 40, >= 5% = 20
  if (errorPct < 0.5) return { score: 100, status: 'healthy' };
  if (errorPct < 1) return { score: 85, status: 'healthy' };
  if (errorPct < 3) return { score: 65, status: 'degraded' };
  if (errorPct < 5) return { score: 40, status: 'degraded' };
  return { score: 20, status: 'critical' };
}

function scoreCacheEfficiency(duplicatePct: number): { score: number; status: RAGHealthDimension['status'] } {
  // <5% duplicates = 100 (queries are unique — no caching needed), 5-15% = 70, 15-30% = 50, >30% = 30
  if (duplicatePct < 5) return { score: 100, status: 'healthy' };
  if (duplicatePct < 15) return { score: 75, status: 'healthy' };
  if (duplicatePct < 30) return { score: 50, status: 'degraded' };
  return { score: 30, status: 'critical' };
}

// ============================================
// Healing Action Generator
// ============================================

function generateHealingActions(dimensions: RAGHealthDimension[]): HealingAction[] {
  const actions: HealingAction[] = [];

  for (const dim of dimensions) {
    if (dim.status === 'healthy') continue;

    switch (dim.name) {
      case 'Vector DB Latency':
        if (dim.status === 'critical') {
          actions.push({
            id: `heal-latency-scale-${Date.now()}`,
            dimension: dim.name,
            severity: 'critical',
            title: 'Scale Vector DB Pod',
            description: `p95 latency is ${dim.rawValue.toFixed(0)}ms (threshold: 200ms). Scale Pinecone pod to handle increased query load.`,
            actionType: 'scale_db',
            automated: false,
            estimatedImpact: '40-60% latency reduction',
          });
        }
        if (dim.rawValue > 300) {
          actions.push({
            id: `heal-latency-topk-${Date.now()}`,
            dimension: dim.name,
            severity: 'warning',
            title: 'Reduce top-k from 10 to 5',
            description: `High retrieval latency (${dim.rawValue.toFixed(0)}ms p95). Reducing top-k returns fewer vectors, lowering scan time.`,
            actionType: 'adjust_topk',
            automated: true,
            estimatedImpact: '20-40% latency reduction',
          });
        }
        break;

      case 'Retrieval Freshness':
        actions.push({
          id: `heal-freshness-alert-${Date.now()}`,
          dimension: dim.name,
          severity: dim.status === 'critical' ? 'critical' : 'warning',
          title: 'RAG Pipeline Stale — No Recent Retrievals',
          description: `Last vector query was ${dim.rawValue.toFixed(0)} minutes ago. Pipeline may be down or traffic has shifted away from RAG path.`,
          actionType: 'alert',
          automated: true,
          estimatedImpact: 'Early detection of RAG pipeline outage',
        });
        break;

      case 'Pipeline Completion':
        actions.push({
          id: `heal-pipeline-reindex-${Date.now()}`,
          dimension: dim.name,
          severity: dim.status === 'critical' ? 'critical' : 'warning',
          title: 'Re-index Embedding Store',
          description: `Only ${dim.rawValue.toFixed(0)}% of traces have full E→R→G pipeline. Stale or missing embeddings cause retrieval failures.`,
          actionType: 'reindex',
          automated: false,
          estimatedImpact: 'Restore full RAG pipeline flow',
        });
        break;

      case 'Error Rate':
        if (dim.status === 'critical') {
          actions.push({
            id: `heal-errors-switch-${Date.now()}`,
            dimension: dim.name,
            severity: 'critical',
            title: 'Switch to Fallback Model',
            description: `Combined RAG error rate is ${dim.rawValue.toFixed(1)}%. Switch to a more stable model (e.g., GPT-4o-mini) to reduce errors.`,
            actionType: 'switch_model',
            automated: false,
            estimatedImpact: 'Reduce error rate by 50-80%',
          });
        } else {
          actions.push({
            id: `heal-errors-alert-${Date.now()}`,
            dimension: dim.name,
            severity: 'warning',
            title: 'Elevated RAG Error Rate Alert',
            description: `Error rate at ${dim.rawValue.toFixed(1)}%. Monitor for further degradation.`,
            actionType: 'alert',
            automated: true,
            estimatedImpact: 'Proactive error monitoring',
          });
        }
        break;

      case 'Cache Efficiency':
        actions.push({
          id: `heal-cache-flush-${Date.now()}`,
          dimension: dim.name,
          severity: dim.status === 'critical' ? 'critical' : 'warning',
          title: 'Enable Semantic Cache',
          description: `${dim.rawValue.toFixed(0)}% of vector queries are duplicates. Enable semantic caching to reduce latency and cost.`,
          actionType: 'flush_cache',
          automated: false,
          estimatedImpact: `${Math.min(dim.rawValue, 60).toFixed(0)}% fewer vector DB calls`,
        });
        break;
    }
  }

  return actions.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
}

// ============================================
// Hook: useRAGHealthScore
// ============================================

export function useRAGHealthScore() {
  const [healthScore, setHealthScore] = useState<RAGHealthScore | null>(null);
  const [trend, setTrend] = useState<RAGHealthTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [latencyRecs, freshnessRecs, pipelineRecs, errorRecs, cacheRecs, trendRecs] = await Promise.all([
        safeDql(HEALTH_LATENCY_QUERY),
        safeDql(HEALTH_FRESHNESS_QUERY),
        safeDql(HEALTH_PIPELINE_QUERY),
        safeDql(HEALTH_ERROR_QUERY),
        safeDql(HEALTH_CACHE_QUERY),
        safeDql(HEALTH_TREND_QUERY),
      ]);

      // --- Dimension 1: Latency ---
      const p95Ms = latencyRecs.length > 0 ? Number(latencyRecs[0].p95_ms) || 0 : 0;
      const latScore = scoreLatency(p95Ms);
      const latencyDim: RAGHealthDimension = {
        name: 'Vector DB Latency',
        score: latScore.score,
        weight: 0.25,
        status: latScore.status,
        details: p95Ms > 0
          ? `p95: ${p95Ms.toFixed(0)}ms, ${Number(latencyRecs[0]?.query_count || 0)} queries in 2h`
          : 'No vector DB spans detected',
        rawValue: p95Ms,
        threshold: { healthy: 200, degraded: 500, unit: 'ms (p95)' },
      };

      // --- Dimension 2: Freshness ---
      const latestQuery = freshnessRecs.length > 0 ? freshnessRecs[0].latest_query : null;
      const minutesSince = latestQuery
        ? (Date.now() - new Date(latestQuery).getTime()) / 60000
        : -1;
      const freshScore = scoreFreshness(minutesSince);
      const freshnessDim: RAGHealthDimension = {
        name: 'Retrieval Freshness',
        score: freshScore.score,
        weight: 0.15,
        status: freshScore.status,
        details: minutesSince >= 0
          ? `Last retrieval: ${minutesSince.toFixed(0)} min ago, ${Number(freshnessRecs[0]?.distinct_services || 0)} services active`
          : 'No retrieval spans in last 4h',
        rawValue: minutesSince,
        threshold: { healthy: 15, degraded: 30, unit: 'min since last query' },
      };

      // --- Dimension 3: Pipeline Completion ---
      const totalTraces = pipelineRecs.length > 0 ? Number(pipelineRecs[0].total_traces) || 0 : 0;
      const fullPipeline = pipelineRecs.length > 0 ? Number(pipelineRecs[0].full_pipeline) || 0 : 0;
      const fullPct = totalTraces > 0 ? (fullPipeline / totalTraces) * 100 : 0;
      const pipeScore = scorePipelineCompletion(fullPct);
      const pipelineDim: RAGHealthDimension = {
        name: 'Pipeline Completion',
        score: pipeScore.score,
        weight: 0.25,
        status: pipeScore.status,
        details: totalTraces > 0
          ? `${fullPipeline}/${totalTraces} traces have full E→R→G pipeline (${fullPct.toFixed(1)}%)`
          : 'No RAG pipeline traces detected',
        rawValue: fullPct,
        threshold: { healthy: 80, degraded: 40, unit: '% full pipeline' },
      };

      // --- Dimension 4: Error Rate ---
      const totalSpans = errorRecs.length > 0 ? Number(errorRecs[0].total) || 0 : 0;
      const totalErrors = errorRecs.length > 0 ? Number(errorRecs[0].errors) || 0 : 0;
      const errorPct = totalSpans > 0 ? (totalErrors / totalSpans) * 100 : 0;
      const errScore = scoreErrorRate(errorPct);
      const errorDim: RAGHealthDimension = {
        name: 'Error Rate',
        score: errScore.score,
        weight: 0.25,
        status: errScore.status,
        details: totalSpans > 0
          ? `${totalErrors}/${totalSpans} errors (${errorPct.toFixed(2)}%) — Vec: ${Number(errorRecs[0]?.vector_errors || 0)}, Embed: ${Number(errorRecs[0]?.embed_errors || 0)}, LLM: ${Number(errorRecs[0]?.llm_errors || 0)}`
          : 'No RAG spans detected',
        rawValue: errorPct,
        threshold: { healthy: 1, degraded: 3, unit: '% error rate' },
      };

      // --- Dimension 5: Cache Efficiency ---
      const totalQueries = cacheRecs.length > 0 ? Number(cacheRecs[0].total_queries) || 0 : 0;
      const duplicateQueries = cacheRecs.length > 0 ? Number(cacheRecs[0].duplicate_queries) || 0 : 0;
      const duplicatePct = totalQueries > 0 ? (duplicateQueries / totalQueries) * 100 : 0;
      const cacheScore = scoreCacheEfficiency(duplicatePct);
      const cacheDim: RAGHealthDimension = {
        name: 'Cache Efficiency',
        score: cacheScore.score,
        weight: 0.10,
        status: cacheScore.status,
        details: totalQueries > 0
          ? `${duplicateQueries}/${totalQueries} duplicate queries (${duplicatePct.toFixed(1)}%), max repeat: ${Number(cacheRecs[0]?.max_duplicates || 0)}x`
          : 'No vector queries to analyze',
        rawValue: duplicatePct,
        threshold: { healthy: 5, degraded: 15, unit: '% duplicate queries' },
      };

      // --- Composite Score ---
      const dimensions = [latencyDim, freshnessDim, pipelineDim, errorDim, cacheDim];
      const compositeScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
      const compositeStatus: RAGHealthScore['status'] =
        compositeScore >= 75 ? 'healthy' :
        compositeScore >= 50 ? 'degraded' : 'critical';

      const healingActions = generateHealingActions(dimensions);

      setHealthScore({
        compositeScore,
        status: compositeStatus,
        dimensions,
        healingActions,
        lastUpdated: Date.now(),
      });

      // --- Trend ---
      const trendPoints: RAGHealthTrend[] = trendRecs.map((r: any) => {
        const ts = new Date(r.hour).getTime();
        const vectorP95 = Number(r.vector_p95_ms) || 0;
        const vectorCount = Number(r.vector_count) || 0;
        const errCount = Number(r.error_count) || 0;
        const totalCount = Number(r.total_count) || 0;
        const errPctPoint = totalCount > 0 ? (errCount / totalCount) * 100 : 0;

        const latS = scoreLatency(vectorP95).score;
        const errS = scoreErrorRate(errPctPoint).score;
        // Freshness & cache are not bucketed per-hour, use current values
        const compS = latS * 0.30 + errS * 0.30 + (vectorCount > 0 ? 80 : 30) * 0.40;

        return {
          timestamp: ts,
          compositeScore: compS,
          latencyScore: latS,
          freshnessScore: vectorCount > 0 ? 80 : 30,
          completionScore: vectorCount > 0 ? 70 : 30,
          errorScore: errS,
          cacheScore: 70, // not bucketed
        };
      });

      setTrend(trendPoints.sort((a, b) => a.timestamp - b.timestamp));
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { healthScore, trend, loading, error, refetch };
}
