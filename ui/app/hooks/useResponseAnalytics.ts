// Response Analytics Hook
// Real metrics for ML Engineers: Token efficiency, output consistency, model comparison
// NO fake hallucination detection - only observable metrics from OpenTelemetry spans

import { useState, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

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
        const estimatedCost = estimateCost(provider, totalInput, totalOutput, model);
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
          errorCount: Number(record.error_count) || 0,
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
        entry.totalErrors += (m as any).errorCount || 0;
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
          errorRate: entry.totalRequests > 0 ? (entry.totalErrors / entry.totalRequests) * 100 : 0,
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

// Cost estimation now uses centralized estimateCost from ../utils/helpers

// ============================================
// Response Quality Trends Hook
// Tracks quality signals over time: empty responses, truncated, errors, latency anomalies
// ============================================

export interface QualityTrendDataPoint {
  timestamp: Date;
  totalRequests: number;
  emptyResponseCount: number;
  truncatedCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  emptyRate: number;
  errorRate: number;
}

export interface QualityAnomaly {
  type: 'empty_spike' | 'error_spike' | 'latency_spike' | 'truncation_spike';
  timestamp: Date;
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

export interface QualitySummary {
  overallHealthScore: number;  // 0-100
  totalRequests: number;
  emptyResponseRate: number;
  truncatedRate: number;
  errorRate: number;
  avgLatencyMs: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  recentAnomalies: QualityAnomaly[];
}

export function useResponseQualityTrends() {
  const [trendData, setTrendData] = useState<QualityTrendDataPoint[]>([]);
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyzeQualityTrends = useCallback(async (timeframe: string = '24h') => {
    setLoading(true);
    setError(null);

    try {
      // Determine bucket size based on timeframe
      let bucketSize = '1h';
      if (timeframe === '1h') bucketSize = '5m';
      else if (timeframe === '6h') bucketSize = '15m';
      else if (timeframe === '12h') bucketSize = '30m';
      else if (timeframe === '7d') bucketSize = '6h';
      else if (timeframe === '30d') bucketSize = '1d';

      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | summarize {
                request_count = count(),
                empty_response_count = countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 5),
                truncated_count = countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0 AND coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 20),
                error_count = countIf(otel.status_code == "ERROR" OR isNotNull(error.type)),
                avg_latency = avg(duration) / 1000000,
                p95_latency = percentile(duration / 1000000, 95)
              }, by: { time_bucket = bin(timestamp, ${bucketSize}) }
            | sort time_bucket asc
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      
      // Transform to trend data
      const trends: QualityTrendDataPoint[] = records.map((r: any) => {
        const total = Number(r.request_count) || 1;
        const emptyCount = Number(r.empty_response_count) || 0;
        const truncatedCount = Number(r.truncated_count) || 0;
        const errorCount = Number(r.error_count) || 0;
        
        return {
          timestamp: new Date(r.time_bucket || r['bin(timestamp)'] || Date.now()),
          totalRequests: total,
          emptyResponseCount: emptyCount,
          truncatedCount: truncatedCount,
          errorCount: errorCount,
          avgLatencyMs: Number(r.avg_latency) || 0,
          p95LatencyMs: Number(r.p95_latency) || 0,
          emptyRate: (emptyCount / total) * 100,
          errorRate: (errorCount / total) * 100
        };
      });

      setTrendData(trends);

      // Calculate summary and detect anomalies
      if (trends.length > 0) {
        const totalRequests = trends.reduce((sum, t) => sum + t.totalRequests, 0);
        const totalEmpty = trends.reduce((sum, t) => sum + t.emptyResponseCount, 0);
        const totalTruncated = trends.reduce((sum, t) => sum + t.truncatedCount, 0);
        const totalErrors = trends.reduce((sum, t) => sum + t.errorCount, 0);
        const avgLatency = trends.reduce((sum, t) => sum + t.avgLatencyMs * t.totalRequests, 0) / totalRequests;

        // Calculate trend direction (compare first half vs second half)
        const midpoint = Math.floor(trends.length / 2);
        const firstHalf = trends.slice(0, midpoint);
        const secondHalf = trends.slice(midpoint);
        
        const firstHalfErrorRate = firstHalf.length > 0 
          ? firstHalf.reduce((sum, t) => sum + t.errorRate, 0) / firstHalf.length 
          : 0;
        const secondHalfErrorRate = secondHalf.length > 0 
          ? secondHalf.reduce((sum, t) => sum + t.errorRate, 0) / secondHalf.length 
          : 0;

        let trendDirection: 'improving' | 'stable' | 'degrading' = 'stable';
        if (secondHalfErrorRate > firstHalfErrorRate * 1.2) trendDirection = 'degrading';
        else if (secondHalfErrorRate < firstHalfErrorRate * 0.8) trendDirection = 'improving';

        // Detect anomalies
        const anomalies: QualityAnomaly[] = [];
        const avgEmptyRate = (totalEmpty / totalRequests) * 100;
        const avgErrorRate = (totalErrors / totalRequests) * 100;
        const avgLatencyOverall = avgLatency;

        trends.forEach((t, idx) => {
          // Empty response spike
          if (t.emptyRate > avgEmptyRate * 2 && t.emptyRate > 5) {
            anomalies.push({
              type: 'empty_spike',
              timestamp: t.timestamp,
              severity: t.emptyRate > 20 ? 'critical' : 'warning',
              message: `Empty response rate spiked to ${t.emptyRate.toFixed(1)}%`,
              value: t.emptyRate,
              threshold: avgEmptyRate * 2
            });
          }
          
          // Error spike
          if (t.errorRate > avgErrorRate * 2 && t.errorRate > 5) {
            anomalies.push({
              type: 'error_spike',
              timestamp: t.timestamp,
              severity: t.errorRate > 20 ? 'critical' : 'warning',
              message: `Error rate spiked to ${t.errorRate.toFixed(1)}%`,
              value: t.errorRate,
              threshold: avgErrorRate * 2
            });
          }

          // Latency spike
          if (t.avgLatencyMs > avgLatencyOverall * 2 && t.avgLatencyMs > 5000) {
            anomalies.push({
              type: 'latency_spike',
              timestamp: t.timestamp,
              severity: t.avgLatencyMs > 10000 ? 'critical' : 'warning',
              message: `Latency spiked to ${(t.avgLatencyMs / 1000).toFixed(1)}s`,
              value: t.avgLatencyMs,
              threshold: avgLatencyOverall * 2
            });
          }
        });

        // Calculate health score (0-100)
        const emptyPenalty = Math.min((totalEmpty / totalRequests) * 100 * 2, 30);
        const errorPenalty = Math.min((totalErrors / totalRequests) * 100 * 3, 40);
        const latencyPenalty = avgLatency > 5000 ? Math.min((avgLatency - 5000) / 100, 30) : 0;
        const healthScore = Math.max(0, 100 - emptyPenalty - errorPenalty - latencyPenalty);

        setSummary({
          overallHealthScore: Math.round(healthScore),
          totalRequests,
          emptyResponseRate: (totalEmpty / totalRequests) * 100,
          truncatedRate: (totalTruncated / totalRequests) * 100,
          errorRate: (totalErrors / totalRequests) * 100,
          avgLatencyMs: avgLatency,
          trendDirection,
          recentAnomalies: anomalies.slice(-5)  // Last 5 anomalies
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to analyze quality trends'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { trendData, summary, loading, error, analyzeQualityTrends };
}

// ============================================
// Streaming vs Batch Analysis Hook
// ============================================

export interface StreamingBatchEntry {
  mode: 'Streaming' | 'Batch';
  provider: string;
  model: string;
  requestCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  errorRate: number;
}

export interface StreamingBatchSummary {
  streamingCount: number;
  batchCount: number;
  streamingPct: number;
  streamingAvgLatency: number;
  batchAvgLatency: number;
  streamingTokens: number;
  batchTokens: number;
}

export function useStreamingAnalysis() {
  const [entries, setEntries] = useState<StreamingBatchEntry[]>([]);
  const [summary, setSummary] = useState<StreamingBatchSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async (timeframe: string = '24h') => {
    setLoading(true);
    try {
      const [detailRes, summaryRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}, to: now()
              | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
              | fieldsAdd is_streaming = if(llm.is_streaming == "true", then: "Streaming", else: "Batch")
              | summarize
                  request_count = count(),
                  avg_latency_ms = avg(toDouble(duration)) / 1000000,
                  p50_latency_ms = percentile(toDouble(duration), 50) / 1000000,
                  p95_latency_ms = percentile(toDouble(duration), 95) / 1000000,
                  avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
                  avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
                  error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
                  by: { is_streaming, gen_ai.provider.name, gen_ai.request.model }
              | fieldsAdd error_rate = if(request_count > 0, then: toDouble(error_count) / toDouble(request_count) * 100, else: 0.0)
              | sort request_count desc
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}, to: now()
              | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
              | fieldsAdd is_streaming = if(llm.is_streaming == "true", then: "Streaming", else: "Batch")
              | summarize
                  total = count(),
                  avg_latency_ms = avg(toDouble(duration)) / 1000000,
                  total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
                  by: { is_streaming }
              | sort total desc
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        })
      ]);

      const detailRecords = detailRes.result?.records || [];
      const parsed: StreamingBatchEntry[] = detailRecords.map((r: any) => ({
        mode: r.is_streaming === 'Streaming' ? 'Streaming' : 'Batch',
        provider: r['gen_ai.provider.name'] || 'unknown',
        model: r['gen_ai.request.model'] || 'unknown',
        requestCount: Number(r.request_count) || 0,
        avgLatencyMs: Number(r.avg_latency_ms) || 0,
        p50LatencyMs: Number(r.p50_latency_ms) || 0,
        p95LatencyMs: Number(r.p95_latency_ms) || 0,
        avgInputTokens: Number(r.avg_input_tokens) || 0,
        avgOutputTokens: Number(r.avg_output_tokens) || 0,
        errorRate: Number(r.error_rate) || 0,
      }));
      setEntries(parsed);

      const summaryRecords = summaryRes.result?.records || [];
      const streaming = summaryRecords.find((r: any) => r.is_streaming === 'Streaming');
      const batch = summaryRecords.find((r: any) => r.is_streaming === 'Batch');
      const sCount = Number(streaming?.total) || 0;
      const bCount = Number(batch?.total) || 0;
      const total = sCount + bCount;
      setSummary({
        streamingCount: sCount,
        batchCount: bCount,
        streamingPct: total > 0 ? (sCount / total) * 100 : 0,
        streamingAvgLatency: Number(streaming?.avg_latency_ms) || 0,
        batchAvgLatency: Number(batch?.avg_latency_ms) || 0,
        streamingTokens: Number(streaming?.total_tokens) || 0,
        batchTokens: Number(batch?.total_tokens) || 0,
      });
    } catch (err) {
      console.error('[GCC] Streaming analysis failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, summary, loading, analyze };
}

// ============================================
// Prompt Audit Trail Hook
// ============================================

export interface AuditTrailEntry {
  timestamp: string;
  traceId: string;
  spanId: string;
  provider: string;
  model: string;
  serviceName: string;
  promptPreview: string;
  completionPreview: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  finishReason: string;
}

export interface AuditTrailSummary {
  totalEvents: number;
  uniqueProviders: number;
  uniqueModels: number;
  uniqueServices: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

export function usePromptAuditTrail() {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [summary, setSummary] = useState<AuditTrailSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAuditTrail = useCallback(async (timeframe: string = '24h') => {
    setLoading(true);
    try {
      const result = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.request.model)
            | filter isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.completion.0.content)
            | fields
                timestamp,
                trace_id = trace.id,
                span_id = span.id,
                provider = gen_ai.system,
                model = gen_ai.request.model,
                service_name = dt.entity.service,
                prompt = gen_ai.prompt.0.content,
                completion = gen_ai.completion.0.content,
                input_tokens = gen_ai.usage.input_tokens,
                output_tokens = gen_ai.usage.output_tokens,
                latency_ns = duration,
                finish_reason = gen_ai.response.finish_reason
            | sort timestamp desc
            | limit 200
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = result.result?.records || [];
      const parsed: AuditTrailEntry[] = records.map((r: any) => ({
        timestamp: r.timestamp || '',
        traceId: r.trace_id || '',
        spanId: r.span_id || '',
        provider: r.provider || 'unknown',
        model: r.model || 'unknown',
        serviceName: r.service_name || 'unknown',
        promptPreview: r.prompt ? String(r.prompt).substring(0, 500) : '',
        completionPreview: r.completion ? String(r.completion).substring(0, 500) : '',
        inputTokens: Number(r.input_tokens) || 0,
        outputTokens: Number(r.output_tokens) || 0,
        latencyMs: Number(r.latency_ns) / 1_000_000 || 0,
        finishReason: r.finish_reason || '',
      }));
      setEntries(parsed);

      // Compute summary from the data
      const providers = new Set(parsed.map(e => e.provider));
      const models = new Set(parsed.map(e => e.model));
      const services = new Set(parsed.map(e => e.serviceName));
      const totalIn = parsed.reduce((s, e) => s + e.inputTokens, 0);
      const totalOut = parsed.reduce((s, e) => s + e.outputTokens, 0);
      setSummary({
        totalEvents: parsed.length,
        uniqueProviders: providers.size,
        uniqueModels: models.size,
        uniqueServices: services.size,
        avgInputTokens: parsed.length > 0 ? Math.round(totalIn / parsed.length) : 0,
        avgOutputTokens: parsed.length > 0 ? Math.round(totalOut / parsed.length) : 0,
      });
    } catch (err) {
      console.error('[GCC] Audit trail fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, summary, loading, fetchAuditTrail };
}
