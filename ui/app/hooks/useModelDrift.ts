// GenAI Control Center - Model Drift Detection Hook
// Track AI model behavior changes, semantic drift, and version updates

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { buildTimeRangeClauseFromTimeframe } from '../queries/dql-queries';

// ============================================
// Types
// ============================================

export interface ModelVersion {
  model: string;
  responseModel: string;  // gen_ai.response.model - actual version used
  provider: string;
  operationType: 'chat' | 'embeddings' | 'completion' | 'unknown';  // Derived from span.name
  firstSeen: string;
  lastSeen: string;
  requestCount: number;
  avgLatency: number;
  avgOutputTokens: number;
  avgInputTokens: number;  // Added for input token drift
  errorRate: number;
}

export interface DriftMetric {
  model: string;
  provider: string;
  metricName: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  driftScore: number;  // 0-100, higher = more drift
  severity: 'normal' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
}

export interface ModelDriftSummary {
  model: string;
  provider: string;
  operationType: 'chat' | 'embeddings' | 'completion' | 'unknown';
  overallDriftScore: number;  // 0-100 aggregate
  severity: 'normal' | 'warning' | 'critical';
  versionChanges: number;
  metrics: DriftMetric[];
  anomalies: DriftAnomaly[];
  baselinePeriod: string;
  currentPeriod: string;
}

export interface DriftAnomaly {
  id: string;
  model: string;
  provider: string;
  type: 'latency_spike' | 'quality_drop' | 'version_change' | 'behavior_shift' | 'error_increase' | 'token_anomaly' | 'input_token_spike' | 'efficiency_drop';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
}

export interface DriftTrendPoint {
  timestamp: string;
  model: string;
  driftScore: number;
  latencyDrift: number;
  qualityDrift: number;
  tokenDrift: number;
}

export interface ModelBaseline {
  model: string;
  provider: string;
  capturedAt: string;
  period: string;
  metrics: {
    avgLatency: number;
    avgOutputTokens: number;
    avgInputTokens: number;
    errorRate: number;
    outputTokenVariance: number;
    latencyP50: number;
    latencyP95: number;
    requestCount: number;
    tokenEfficiency: number;  // output/input ratio
  };
}

// ============================================
// DQL Queries for Model Drift Detection
// ============================================

// Helper to derive operation type from span.name and model name
const deriveOperationType = (spanName: string | null, modelName?: string | null): 'chat' | 'embeddings' | 'completion' | 'unknown' => {
  const lowerSpan = (spanName || '').toLowerCase();
  const lowerModel = (modelName || '').toLowerCase();
  
  // First, check span.name (most reliable)
  if (lowerSpan.includes('embed')) return 'embeddings';
  if (lowerSpan.includes('chat')) return 'chat';
  if (lowerSpan.includes('complet') || lowerSpan.includes('generate')) return 'completion';
  
  // Fallback: Check model name patterns for generic providers (Bedrock, etc.)
  // Embedding models
  if (lowerModel.includes('embed') || 
      lowerModel.includes('titan-embed') ||
      lowerModel.includes('textembedding') ||
      lowerModel.includes('ada-002') ||
      lowerModel.includes('cohere-embed')) {
    return 'embeddings';
  }
  
  // Chat/Conversation models
  if (lowerModel.includes('claude') ||
      lowerModel.includes('gpt-') ||
      lowerModel.includes('llama') ||
      lowerModel.includes('mistral') ||
      lowerModel.includes('gemini') ||
      lowerModel.includes('command') ||  // Cohere Command
      lowerModel.includes('chat') ||
      lowerModel.includes('turbo')) {
    return 'chat';
  }
  
  // Completion models (legacy)
  if (lowerModel.includes('davinci') ||
      lowerModel.includes('babbage') ||
      lowerModel.includes('curie') ||
      lowerModel.includes('text-')) {
    return 'completion';
  }
  
  return 'unknown';
};

const MODEL_VERSIONS_QUERY = (timeframe?: Timeframe | null) => {
  const timeClause = timeframe ? buildTimeRangeClauseFromTimeframe(timeframe) : 'from: now()-7d, to: now()';
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
| summarize {
    request_count = count(),
    first_seen = min(start_time),
    last_seen = max(start_time),
    avg_latency = avg(duration) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name, span.name }
| filter isNotNull(gen_ai.request.model)
| sort last_seen desc
`;
};

const MODEL_METRICS_BASELINE_QUERY = (baselineTimeframe: string, currentTimeframe: string) => `
fetch spans, from: ${baselineTimeframe}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
| fieldsAdd period = "baseline"
| append [
  fetch spans, from: ${currentTimeframe}
  | filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
  | fieldsAdd period = "current"
]
| summarize {
    request_count = count(),
    avg_latency = avg(duration) / 1000000,
    latency_p50 = percentile(duration, 50) / 1000000,
    latency_p95 = percentile(duration, 95) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_token_variance = stddev(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.provider.name, span.name, period }
| sort gen_ai.request.model, period
`;

const DRIFT_TREND_QUERY = (timeframe?: Timeframe | null) => {
  const timeClause = timeframe ? buildTimeRangeClauseFromTimeframe(timeframe) : 'from: now()-7d, to: now()';
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
| makeTimeseries {
    avg_latency = avg(duration) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    request_count = count()
  }, by: { gen_ai.request.model, gen_ai.provider.name }, interval: 1h
`;
};

const VERSION_CHANGE_DETECTION_QUERY = (timeframe?: Timeframe | null) => {
  const timeClause = timeframe ? buildTimeRangeClauseFromTimeframe(timeframe) : 'from: now()-7d, to: now()';
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.response.model) AND gen_ai.response.model != gen_ai.request.model
| summarize {
    occurrences = count(),
    first_seen = min(start_time),
    last_seen = max(start_time)
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
| sort last_seen desc
`;
};

// ============================================
// Drift Calculation Utilities
// ============================================

const calculateDriftScore = (baseline: number, current: number, threshold: number = 0.2): number => {
  if (baseline === 0) return current > 0 ? 100 : 0;
  const changePercent = Math.abs((current - baseline) / baseline);
  // Normalize to 0-100 scale where threshold = 50
  const score = Math.min(100, (changePercent / threshold) * 50);
  return Math.round(score);
};

const getDriftSeverity = (driftScore: number): 'normal' | 'warning' | 'critical' => {
  if (driftScore >= 70) return 'critical';
  if (driftScore >= 40) return 'warning';
  return 'normal';
};

const getTrend = (baseline: number, current: number, isLowerBetter: boolean = true): 'improving' | 'stable' | 'degrading' => {
  const changePercent = baseline > 0 ? (current - baseline) / baseline : 0;
  if (Math.abs(changePercent) < 0.05) return 'stable';
  
  if (isLowerBetter) {
    return changePercent < 0 ? 'improving' : 'degrading';
  } else {
    return changePercent > 0 ? 'improving' : 'degrading';
  }
};

// ============================================
// Main Hook
// ============================================

interface UseModelDriftResult {
  // Data
  versions: ModelVersion[];
  driftSummaries: ModelDriftSummary[];
  anomalies: DriftAnomaly[];
  trendData: DriftTrendPoint[];
  baselines: ModelBaseline[];
  
  // State
  loading: boolean;
  error: Error | null;
  lastRefresh: Date | null;
  
  // Actions
  refetch: () => Promise<void>;
  captureBaseline: (model: string) => void;
  clearBaseline: (model: string) => void;
  
  // Computed
  totalModels: number;      // Unique model names
  totalProviders: number;   // Unique provider names
  totalCombinations: number; // Model+Provider combinations (for table)
  modelsWithDrift: number;
  criticalDriftCount: number;
  avgDriftScore: number;
}

export function useModelDrift(timeframe?: Timeframe | null): UseModelDriftResult {
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [driftSummaries, setDriftSummaries] = useState<ModelDriftSummary[]>([]);
  const [anomalies, setAnomalies] = useState<DriftAnomaly[]>([]);
  const [trendData, setTrendData] = useState<DriftTrendPoint[]>([]);
  const [baselines, setBaselines] = useState<ModelBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Stored baselines in localStorage for persistence
  const storedBaselinesKey = 'gcc_model_baselines';

  const loadStoredBaselines = useCallback((): Map<string, ModelBaseline> => {
    try {
      const stored = localStorage.getItem(storedBaselinesKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ModelBaseline[];
        return new Map(parsed.map(b => [`${b.model}|||${b.provider}`, b]));
      }
    } catch (e) {
      console.warn('[ModelDrift] Failed to load stored baselines:', e);
    }
    return new Map();
  }, []);

  const saveBaselines = useCallback((baselinesMap: Map<string, ModelBaseline>) => {
    try {
      localStorage.setItem(storedBaselinesKey, JSON.stringify(Array.from(baselinesMap.values())));
    } catch (e) {
      console.warn('[ModelDrift] Failed to save baselines:', e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[ModelDrift] Fetching model drift data...');

      // Fetch model versions
      const versionsResponse = await queryExecutionClient.queryExecute({
        body: {
          query: MODEL_VERSIONS_QUERY(timeframe),
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const versionsRecords = versionsResponse.result?.records || [];
      const parsedVersions: ModelVersion[] = versionsRecords
        .filter((r: any) => {
          const model = r['gen_ai.request.model'];
          return model && model !== 'null' && model !== '' && model !== 'unknown';
        })
        .map((r: any) => ({
          model: r['gen_ai.request.model'],
          responseModel: r['gen_ai.response.model'] || r['gen_ai.request.model'],
          provider: r['gen_ai.provider.name'] || 'unknown',
          operationType: deriveOperationType(r['span.name'], r['gen_ai.request.model']),
          firstSeen: r.first_seen || new Date().toISOString(),
          lastSeen: r.last_seen || new Date().toISOString(),
          requestCount: Number(r.request_count) || 0,
          avgLatency: Number(r.avg_latency) || 0,
          avgOutputTokens: Number(r.avg_output_tokens) || 0,
          avgInputTokens: Number(r.avg_input_tokens) || 0,
          errorRate: Number(r.error_rate) || 0
        }));
      setVersions(parsedVersions);

      // Fetch baseline vs current metrics
      const baselineResponse = await queryExecutionClient.queryExecute({
        body: {
          query: MODEL_METRICS_BASELINE_QUERY('now()-14d, to: now()-7d', 'now()-7d, to: now()'),
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const metricsRecords = baselineResponse.result?.records || [];
      
      // Group by model and calculate drift
      const modelMetricsMap = new Map<string, { baseline?: any; current?: any }>();
      
      metricsRecords.forEach((r: any) => {
        const model = r['gen_ai.request.model'];
        // Skip null, empty, or "null" string models
        if (!model || model === 'null' || model === '') return;
        
        const key = `${model}|||${r['gen_ai.provider.name'] || 'unknown'}`;
        if (!modelMetricsMap.has(key)) {
          modelMetricsMap.set(key, {});
        }
        const entry = modelMetricsMap.get(key)!;
        if (r.period === 'baseline') {
          entry.baseline = r;
        } else {
          entry.current = r;
        }
      });

      // Load stored baselines and merge
      const storedBaselines = loadStoredBaselines();
      
      // Calculate drift summaries and detect anomalies
      const summaries: ModelDriftSummary[] = [];
      const detectedAnomalies: DriftAnomaly[] = [];
      const computedBaselines: ModelBaseline[] = [];

      modelMetricsMap.forEach((data, key) => {
        const [model, provider] = key.split('|||');
        const baseline = data.baseline;
        const current = data.current;

        if (!current) return;

        // Create or use stored baseline
        const storedBaseline = storedBaselines.get(key);
        const effectiveBaseline = storedBaseline?.metrics || (baseline ? {
          avgLatency: Number(baseline.avg_latency) || 0,
          avgOutputTokens: Number(baseline.avg_output_tokens) || 0,
          avgInputTokens: Number(baseline.avg_input_tokens) || 0,
          errorRate: Number(baseline.error_rate) || 0,
          outputTokenVariance: Number(baseline.output_token_variance) || 0,
          latencyP50: Number(baseline.latency_p50) || 0,
          latencyP95: Number(baseline.latency_p95) || 0,
          requestCount: Number(baseline.request_count) || 0
        } : null);

        if (!effectiveBaseline) return;

        const currentMetrics = {
          avgLatency: Number(current.avg_latency) || 0,
          avgOutputTokens: Number(current.avg_output_tokens) || 0,
          avgInputTokens: Number(current.avg_input_tokens) || 0,
          errorRate: Number(current.error_rate) || 0,
          outputTokenVariance: Number(current.output_token_variance) || 0,
          latencyP50: Number(current.latency_p50) || 0,
          latencyP95: Number(current.latency_p95) || 0,
          requestCount: Number(current.request_count) || 0
        };

        // Calculate drift metrics
        const driftMetrics: DriftMetric[] = [];

        // Latency drift
        const latencyDrift = calculateDriftScore(effectiveBaseline.avgLatency, currentMetrics.avgLatency, 0.3);
        driftMetrics.push({
          model,
          provider,
          metricName: 'Average Latency',
          baselineValue: effectiveBaseline.avgLatency,
          currentValue: currentMetrics.avgLatency,
          changePercent: effectiveBaseline.avgLatency > 0 
            ? ((currentMetrics.avgLatency - effectiveBaseline.avgLatency) / effectiveBaseline.avgLatency) * 100 
            : 0,
          driftScore: latencyDrift,
          severity: getDriftSeverity(latencyDrift),
          trend: getTrend(effectiveBaseline.avgLatency, currentMetrics.avgLatency, true)
        });

        // Output tokens drift (quality indicator)
        const outputDrift = calculateDriftScore(effectiveBaseline.avgOutputTokens, currentMetrics.avgOutputTokens, 0.25);
        driftMetrics.push({
          model,
          provider,
          metricName: 'Avg Output Tokens',
          baselineValue: effectiveBaseline.avgOutputTokens,
          currentValue: currentMetrics.avgOutputTokens,
          changePercent: effectiveBaseline.avgOutputTokens > 0 
            ? ((currentMetrics.avgOutputTokens - effectiveBaseline.avgOutputTokens) / effectiveBaseline.avgOutputTokens) * 100 
            : 0,
          driftScore: outputDrift,
          severity: getDriftSeverity(outputDrift),
          trend: getTrend(effectiveBaseline.avgOutputTokens, currentMetrics.avgOutputTokens, false)
        });

        // Error rate drift
        const errorDrift = calculateDriftScore(effectiveBaseline.errorRate, currentMetrics.errorRate, 0.5);
        driftMetrics.push({
          model,
          provider,
          metricName: 'Error Rate',
          baselineValue: effectiveBaseline.errorRate,
          currentValue: currentMetrics.errorRate,
          changePercent: effectiveBaseline.errorRate > 0 
            ? ((currentMetrics.errorRate - effectiveBaseline.errorRate) / effectiveBaseline.errorRate) * 100 
            : currentMetrics.errorRate > 0 ? 100 : 0,
          driftScore: errorDrift,
          severity: getDriftSeverity(errorDrift),
          trend: getTrend(effectiveBaseline.errorRate, currentMetrics.errorRate, true)
        });

        // P95 latency drift
        const p95Drift = calculateDriftScore(effectiveBaseline.latencyP95, currentMetrics.latencyP95, 0.4);
        driftMetrics.push({
          model,
          provider,
          metricName: 'P95 Latency',
          baselineValue: effectiveBaseline.latencyP95,
          currentValue: currentMetrics.latencyP95,
          changePercent: effectiveBaseline.latencyP95 > 0 
            ? ((currentMetrics.latencyP95 - effectiveBaseline.latencyP95) / effectiveBaseline.latencyP95) * 100 
            : 0,
          driftScore: p95Drift,
          severity: getDriftSeverity(p95Drift),
          trend: getTrend(effectiveBaseline.latencyP95, currentMetrics.latencyP95, true)
        });

        // Input tokens drift (cost indicator)
        const inputDrift = calculateDriftScore(effectiveBaseline.avgInputTokens, currentMetrics.avgInputTokens, 0.25);
        driftMetrics.push({
          model,
          provider,
          metricName: 'Avg Input Tokens',
          baselineValue: effectiveBaseline.avgInputTokens,
          currentValue: currentMetrics.avgInputTokens,
          changePercent: effectiveBaseline.avgInputTokens > 0 
            ? ((currentMetrics.avgInputTokens - effectiveBaseline.avgInputTokens) / effectiveBaseline.avgInputTokens) * 100 
            : 0,
          driftScore: inputDrift,
          severity: getDriftSeverity(inputDrift),
          trend: getTrend(effectiveBaseline.avgInputTokens, currentMetrics.avgInputTokens, true) // Higher input = more cost
        });

        // Token efficiency drift (output/input ratio - quality per cost)
        const baselineEfficiency = effectiveBaseline.avgInputTokens > 0 
          ? effectiveBaseline.avgOutputTokens / effectiveBaseline.avgInputTokens 
          : 0;
        const currentEfficiency = currentMetrics.avgInputTokens > 0 
          ? currentMetrics.avgOutputTokens / currentMetrics.avgInputTokens 
          : 0;
        const efficiencyDrift = calculateDriftScore(baselineEfficiency, currentEfficiency, 0.3);
        driftMetrics.push({
          model,
          provider,
          metricName: 'Token Efficiency',
          baselineValue: baselineEfficiency,
          currentValue: currentEfficiency,
          changePercent: baselineEfficiency > 0 
            ? ((currentEfficiency - baselineEfficiency) / baselineEfficiency) * 100 
            : 0,
          driftScore: efficiencyDrift,
          severity: getDriftSeverity(efficiencyDrift),
          trend: getTrend(baselineEfficiency, currentEfficiency, false) // Higher efficiency = better
        });

        // Calculate overall drift score (weighted average - 7 metrics)
        // Weights: latency 25%, output 15%, error 20%, P95 15%, input 10%, efficiency 15%
        const overallDriftScore = Math.round(
          (latencyDrift * 0.25 + outputDrift * 0.15 + errorDrift * 0.20 + p95Drift * 0.15 + inputDrift * 0.10 + efficiencyDrift * 0.15)
        );

        // Detect anomalies
        if (latencyDrift >= 70) {
          detectedAnomalies.push({
            id: `lat-${model}-${Date.now()}`,
            model,
            provider,
            type: 'latency_spike',
            severity: 'critical',
            title: `Latency Spike Detected`,
            description: `Average latency increased by ${driftMetrics[0].changePercent.toFixed(1)}% compared to baseline`,
            detectedAt: new Date().toISOString(),
            metric: 'avgLatency',
            baselineValue: effectiveBaseline.avgLatency,
            currentValue: currentMetrics.avgLatency,
            changePercent: driftMetrics[0].changePercent
          });
        }

        if (outputDrift >= 60 && driftMetrics[1].changePercent < -15) {
          detectedAnomalies.push({
            id: `qual-${model}-${Date.now()}`,
            model,
            provider,
            type: 'quality_drop',
            severity: driftMetrics[1].changePercent < -30 ? 'critical' : 'warning',
            title: `Response Quality Degradation`,
            description: `Average output tokens dropped by ${Math.abs(driftMetrics[1].changePercent).toFixed(1)}% - possible truncation or model changes`,
            detectedAt: new Date().toISOString(),
            metric: 'avgOutputTokens',
            baselineValue: effectiveBaseline.avgOutputTokens,
            currentValue: currentMetrics.avgOutputTokens,
            changePercent: driftMetrics[1].changePercent
          });
        }

        if (errorDrift >= 50 && currentMetrics.errorRate > 1) {
          detectedAnomalies.push({
            id: `err-${model}-${Date.now()}`,
            model,
            provider,
            type: 'error_increase',
            severity: currentMetrics.errorRate > 5 ? 'critical' : 'warning',
            title: `Error Rate Increase`,
            description: `Error rate is now ${currentMetrics.errorRate.toFixed(2)}% (was ${effectiveBaseline.errorRate.toFixed(2)}%)`,
            detectedAt: new Date().toISOString(),
            metric: 'errorRate',
            baselineValue: effectiveBaseline.errorRate,
            currentValue: currentMetrics.errorRate,
            changePercent: driftMetrics[2].changePercent
          });
        }

        // Input token spike detection (cost anomaly)
        if (inputDrift >= 60 && driftMetrics[4].changePercent > 30) {
          detectedAnomalies.push({
            id: `input-${model}-${Date.now()}`,
            model,
            provider,
            type: 'input_token_spike',
            severity: driftMetrics[4].changePercent > 50 ? 'critical' : 'warning',
            title: `Input Token Spike`,
            description: `Average input tokens increased by ${driftMetrics[4].changePercent.toFixed(1)}% - possible prompt bloat or context growth`,
            detectedAt: new Date().toISOString(),
            metric: 'avgInputTokens',
            baselineValue: effectiveBaseline.avgInputTokens,
            currentValue: currentMetrics.avgInputTokens,
            changePercent: driftMetrics[4].changePercent
          });
        }

        // Token efficiency drop detection (quality per cost)
        if (efficiencyDrift >= 50 && driftMetrics[5].changePercent < -20) {
          detectedAnomalies.push({
            id: `eff-${model}-${Date.now()}`,
            model,
            provider,
            type: 'efficiency_drop',
            severity: driftMetrics[5].changePercent < -40 ? 'critical' : 'warning',
            title: `Token Efficiency Drop`,
            description: `Output/input ratio dropped by ${Math.abs(driftMetrics[5].changePercent).toFixed(1)}% - getting less value per token`,
            detectedAt: new Date().toISOString(),
            metric: 'tokenEfficiency',
            baselineValue: baselineEfficiency,
            currentValue: currentEfficiency,
            changePercent: driftMetrics[5].changePercent
          });
        }

        // Store computed baseline if we don't have a stored one
        if (!storedBaseline && baseline) {
          computedBaselines.push({
            model,
            provider,
            capturedAt: new Date().toISOString(),
            period: 'auto-7d',
            metrics: {
              ...effectiveBaseline,
              tokenEfficiency: baselineEfficiency
            }
          });
        }

        // Check for version changes
        const versionChange = parsedVersions.find(
          v => v.model === model && v.provider === provider && v.responseModel !== v.model
        );
        
        // Get operation type from versions data
        const modelVersion = parsedVersions.find(v => v.model === model && v.provider === provider);
        const operationType = modelVersion?.operationType || 'unknown';
        
        summaries.push({
          model,
          provider,
          operationType,
          overallDriftScore,
          severity: getDriftSeverity(overallDriftScore),
          versionChanges: versionChange ? 1 : 0,
          metrics: driftMetrics,
          anomalies: detectedAnomalies.filter(a => a.model === model),
          baselinePeriod: storedBaseline ? storedBaseline.period : '7-14 days ago',
          currentPeriod: 'Last 7 days'
        });
      });

      setDriftSummaries(summaries.sort((a, b) => b.overallDriftScore - a.overallDriftScore));
      setAnomalies(detectedAnomalies);
      setBaselines(computedBaselines);

      // Fetch real trend data for drift timeseries charts
      try {
        const trendResponse = await queryExecutionClient.queryExecute({
          body: {
            query: DRIFT_TREND_QUERY(timeframe),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        });
        const trendRecords = trendResponse.result?.records || [];
        const parsedTrend: DriftTrendPoint[] = trendRecords
          .filter((r: any) => r['gen_ai.request.model'] && r['gen_ai.request.model'] !== 'null')
          .map((r: any) => {
            const model = r['gen_ai.request.model'] || 'unknown';
            const provider = r['gen_ai.provider.name'] || 'unknown';
            const summary = summaries.find(s => s.model === model && s.provider === provider);
            const baselineMetrics = summary?.metrics || [];
            // Compute per-timepoint drift using actual metric values vs baseline
            const avgLat = Number(r.avg_latency) || 0;
            const avgOut = Number(r.avg_output_tokens) || 0;
            const avgIn = Number(r.avg_input_tokens) || 0;
            const baselineLat = baselineMetrics.find(m => m.metricName === 'Average Latency')?.baselineValue || avgLat;
            const baselineOut = baselineMetrics.find(m => m.metricName === 'Avg Output Tokens')?.baselineValue || avgOut;
            const baselineIn = baselineMetrics.find(m => m.metricName === 'Avg Input Tokens')?.baselineValue || avgIn;
            const latDrift = calculateDriftScore(baselineLat, avgLat, 0.3);
            const outDrift = calculateDriftScore(baselineOut, avgOut, 0.25);
            const inDrift = calculateDriftScore(baselineIn, avgIn, 0.25);
            const driftScore = Math.round(latDrift * 0.4 + outDrift * 0.3 + inDrift * 0.3);
            return {
              timestamp: r.timeframe?.start || r.interval?.start || new Date().toISOString(),
              model,
              driftScore,
              latencyDrift: latDrift,
              qualityDrift: outDrift,
              tokenDrift: inDrift
            };
          });
        setTrendData(parsedTrend);
        console.log('[ModelDrift] Loaded', parsedTrend.length, 'trend data points');
      } catch (trendErr) {
        console.warn('[ModelDrift] Trend data fetch failed (non-critical):', trendErr);
      }

      setLastRefresh(new Date());
      console.log('[ModelDrift] Loaded', summaries.length, 'model summaries,', detectedAnomalies.length, 'anomalies');

    } catch (err) {
      console.error('[ModelDrift] Failed to fetch drift data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch drift data'));
    } finally {
      setLoading(false);
    }
  }, [timeframe, loadStoredBaselines]);

  // Capture baseline for a specific model
  const captureBaseline = useCallback((model: string) => {
    const summary = driftSummaries.find(s => s.model === model);
    if (!summary) return;

    const currentMetrics = summary.metrics.reduce((acc, m) => {
      acc[m.metricName] = m.currentValue;
      return acc;
    }, {} as Record<string, number>);

    const newBaseline: ModelBaseline = {
      model: summary.model,
      provider: summary.provider,
      capturedAt: new Date().toISOString(),
      period: 'manual',
      metrics: {
        avgLatency: currentMetrics['Average Latency'] || 0,
        avgOutputTokens: currentMetrics['Avg Output Tokens'] || 0,
        avgInputTokens: currentMetrics['Avg Input Tokens'] || 0,
        errorRate: currentMetrics['Error Rate'] || 0,
        outputTokenVariance: 0,
        latencyP50: 0,
        latencyP95: currentMetrics['P95 Latency'] || 0,
        requestCount: 0,
        tokenEfficiency: currentMetrics['Token Efficiency'] || 0
      }
    };

    const stored = loadStoredBaselines();
    stored.set(`${model}|||${summary.provider}`, newBaseline);
    saveBaselines(stored);
    
    // Refresh data to recalculate drift
    fetchData();
  }, [driftSummaries, loadStoredBaselines, saveBaselines, fetchData]);

  // Clear baseline for a specific model
  const clearBaseline = useCallback((model: string) => {
    const stored = loadStoredBaselines();
    // Find and remove the baseline for this model
    for (const [key] of stored) {
      if (key.startsWith(`${model}|||`)) {
        stored.delete(key);
      }
    }
    saveBaselines(stored);
    fetchData();
  }, [loadStoredBaselines, saveBaselines, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Computed values - unique models for summary, combinations for table
  const uniqueModels = useMemo(() => {
    const modelSet = new Set<string>();
    versions.forEach(v => modelSet.add(v.model));
    return modelSet.size;
  }, [versions]);
  
  const uniqueProviders = useMemo(() => {
    const providerSet = new Set<string>();
    versions.forEach(v => providerSet.add(v.provider));
    return providerSet.size;
  }, [versions]);
  
  const totalCombinations = driftSummaries.length; // model+provider combinations for table
  const modelsWithDrift = driftSummaries.filter(s => s.overallDriftScore >= 40).length;
  const criticalDriftCount = driftSummaries.filter(s => s.severity === 'critical').length;
  const avgDriftScore = driftSummaries.length > 0 
    ? Math.round(driftSummaries.reduce((sum, s) => sum + s.overallDriftScore, 0) / driftSummaries.length)
    : 0;

  return {
    versions,
    driftSummaries,
    anomalies,
    trendData,
    baselines,
    loading,
    error,
    lastRefresh,
    refetch: fetchData,
    captureBaseline,
    clearBaseline,
    totalModels: uniqueModels,
    totalProviders: uniqueProviders,
    totalCombinations,
    modelsWithDrift,
    criticalDriftCount,
    avgDriftScore
  };
}
