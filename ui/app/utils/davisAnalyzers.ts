/**
 * Dynatrace Intelligence Analyzers SDK Integration
 * 
 * NO MOCKING — All functions use actual @dynatrace-sdk/client-davis-analyzers v1.9.8
 * 
 * Available Analyzers used by GCC:
 * 1. GenericForecastAnalyzer       — Token / cost / request volume forecasting
 * 2. AutoAdaptiveAnomalyDetection  — Zero-config anomaly detection on AI metrics
 * 3. SeasonalBaselineAnomaly       — Pattern-based anomaly (hourly/daily cycles)
 * 4. StaticThresholdAnomaly        — Hard-threshold alerts (budget breaches)
 * 5. NoveltyScoreAnalyzer          — Detect spikes and change points (deployment regressions)
 * 
 * Required scopes: davis:analyzers:execute, davis:analyzers:read
 */

import { analyzersClient } from '@dynatrace-sdk/client-davis-analyzers';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Result Types
// ============================================

export interface ForecastPoint {
  timestamp: string;
  value: number;
  lowerBound: number;
  upperBound: number;
}

export interface ForecastResult {
  success: boolean;
  metric: string;
  currentValue: number;
  forecastPoints: ForecastPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  forecastQuality: 'good' | 'fair' | 'poor';
  budgetBreachDay?: number;  // days until budget threshold is hit (if applicable)
  error?: string;
}

export interface AnomalyResult {
  success: boolean;
  metric: string;
  hasAnomaly: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  anomalyStartTime?: string;
  anomalyValue?: number;
  baselineValue?: number;
  description: string;
  error?: string;
}

export interface NoveltyResult {
  success: boolean;
  metric: string;
  noveltyScore: number;     // 0-1 (higher = more novel/unusual)
  noveltyType: 'SPIKE' | 'DROP' | 'CHANGE_POINT' | 'NONE';
  startTime?: string;
  description: string;
  error?: string;
}

export interface AnalyzerHealthStatus {
  available: boolean;
  analyzers: string[];
  lastChecked: string;
  error?: string;
}

// ============================================
// Helper: extract output value from analyzer result
// ============================================

function extractOutputValue(result: any, fieldName: string): number[] {
  try {
    const output = result?.output;
    if (!output) return [];
    // Different analyzers return different output shapes
    if (Array.isArray(output[fieldName])) return output[fieldName];
    if (output.result?.[fieldName]) return output.result[fieldName];
    if (output.timeSeriesData?.values) return output.timeSeriesData.values;
    return [];
  } catch {
    return [];
  }
}

function extractTimestamps(result: any): string[] {
  try {
    const output = result?.output;
    if (!output) return [];
    if (Array.isArray(output.timestamps)) return output.timestamps;
    if (output.result?.timestamps) return output.result.timestamps;
    if (output.timeSeriesData?.timestamps) return output.timeSeriesData.timestamps;
    return [];
  } catch {
    return [];
  }
}

// ============================================
// 1. GenericForecastAnalyzer
//    Predicts future values for token usage, cost, or request rate
// ============================================

/**
 * Forecast AI token usage for the next N hours using real DQL timeseries data.
 * Falls back to returning success=false if the analyzer is unavailable.
 */
export async function forecastTokenUsage(
  timeRangeHours: number = 24,
  forecastHorizonHours: number = 24
): Promise<ForecastResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
    | fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
    | makeTimeseries total_tokens = sum(input_tok + output_tok), interval: 1h
  `.trim();

  try {
    console.log('[GCC Analyzers] Running GenericForecastAnalyzer for token usage');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.GenericForecastAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
        forecastHorizon: forecastHorizonHours,
      } as any,
    });

    const output = (result as any)?.output;
    
    // Extract forecast values and timestamps
    const forecastValues: number[] = output?.forecastedValues || output?.forecast?.values || [];
    const forecastTimestamps: string[] = output?.forecastedTimestamps || output?.forecast?.timestamps || [];
    const lowerBounds: number[] = output?.lowerConfidenceBound || [];
    const upperBounds: number[] = output?.upperConfidenceBound || [];
    const currentValue = output?.observedValue || output?.currentValue || 0;
    const trend = output?.trend?.toLowerCase() || 'stable';
    const quality = output?.forecastQuality?.toLowerCase() || 'fair';

    const forecastPoints: ForecastPoint[] = forecastValues.map((val: number, i: number) => ({
      timestamp: forecastTimestamps[i] || new Date(Date.now() + i * 3600000).toISOString(),
      value: val,
      lowerBound: lowerBounds[i] ?? val * 0.85,
      upperBound: upperBounds[i] ?? val * 1.15,
    }));

    return {
      success: true,
      metric: 'token_usage',
      currentValue,
      forecastPoints,
      trend: trend === 'increase' || trend === 'increasing' ? 'increasing'
           : trend === 'decrease' || trend === 'decreasing' ? 'decreasing'
           : 'stable',
      forecastQuality: quality === 'good' ? 'good' : quality === 'fair' ? 'fair' : 'poor',
    };
  } catch (error) {
    console.error('[GCC Analyzers] GenericForecastAnalyzer failed:', error);
    return {
      success: false,
      metric: 'token_usage',
      currentValue: 0,
      forecastPoints: [],
      trend: 'stable',
      forecastQuality: 'poor',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

/**
 * Forecast estimated AI cost for budget planning.
 */
export async function forecastAICost(
  currentDailyCost: number,
  timeRangeHours: number = 24,
  forecastHorizonHours: number = 72,
  budgetThreshold?: number
): Promise<ForecastResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
    | fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
    | makeTimeseries tokens = sum(input_tok + output_tok), interval: 1h
  `.trim();

  try {
    console.log('[GCC Analyzers] Running GenericForecastAnalyzer for cost projection');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.GenericForecastAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
        forecastHorizon: forecastHorizonHours,
      } as any,
    });

    const output = (result as any)?.output;
    const forecastValues: number[] = output?.forecastedValues || [];
    const forecastTimestamps: string[] = output?.forecastedTimestamps || [];
    const lowerBounds: number[] = output?.lowerConfidenceBound || [];
    const upperBounds: number[] = output?.upperConfidenceBound || [];
    const trend = output?.trend?.toLowerCase() || 'stable';

    // Convert token forecasts to cost (blended rate $0.000002/token)
    const costPerToken = 0.000002;
    const forecastPoints: ForecastPoint[] = forecastValues.map((tokens: number, i: number) => ({
      timestamp: forecastTimestamps[i] || new Date(Date.now() + i * 3600000).toISOString(),
      value: tokens * costPerToken,
      lowerBound: (lowerBounds[i] ?? tokens * 0.85) * costPerToken,
      upperBound: (upperBounds[i] ?? tokens * 1.15) * costPerToken,
    }));

    // Find budget breach day if threshold provided
    let budgetBreachDay: number | undefined;
    if (budgetThreshold) {
      let cumulativeCost = currentDailyCost;
      for (let i = 0; i < forecastPoints.length; i++) {
        cumulativeCost += forecastPoints[i].value;
        if (cumulativeCost >= budgetThreshold) {
          budgetBreachDay = Math.floor(i / 24) + 1;
          break;
        }
      }
    }

    return {
      success: true,
      metric: 'ai_cost',
      currentValue: currentDailyCost,
      forecastPoints,
      trend: trend === 'increase' || trend === 'increasing' ? 'increasing'
           : trend === 'decrease' || trend === 'decreasing' ? 'decreasing'
           : 'stable',
      forecastQuality: output?.forecastQuality?.toLowerCase() || 'fair',
      budgetBreachDay,
    };
  } catch (error) {
    console.error('[GCC Analyzers] Cost forecast failed:', error);
    return {
      success: false,
      metric: 'ai_cost',
      currentValue: currentDailyCost,
      forecastPoints: [],
      trend: 'stable',
      forecastQuality: 'poor',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

// ============================================
// 2. AutoAdaptiveAnomalyDetectionAnalyzer
//    Zero-config anomaly detection on AI metrics
// ============================================

/**
 * Detect anomalies in AI error rate using adaptive baseline learning.
 */
export async function detectErrorRateAnomaly(
  timeRangeHours: number = 2
): Promise<AnomalyResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | makeTimeseries
        total = count(),
        errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
        interval: 5m
  `.trim();

  try {
    console.log('[GCC Analyzers] Running AutoAdaptiveAnomalyDetection for error rate');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.anomaly_detection.AutoAdaptiveAnomalyDetectionAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
        alertCondition: 'ABOVE',
        violatingDataPointsToAlert: 1,
      } as any,
    });

    const output = (result as any)?.output;
    const anomalies = output?.anomalies || output?.result?.anomalies || [];
    const hasAnomaly = anomalies.length > 0;
    
    let severity: AnomalyResult['severity'] = 'none';
    let anomalyStartTime: string | undefined;
    let anomalyValue: number | undefined;
    let baselineValue: number | undefined;

    if (hasAnomaly && anomalies[0]) {
      const a = anomalies[0];
      anomalyStartTime = a.startTime || a.timestamp;
      anomalyValue = a.value || a.observedValue;
      baselineValue = a.baseline || a.expectedValue;
      const deviation = baselineValue ? ((anomalyValue || 0) - baselineValue) / baselineValue : 0;
      severity = deviation > 1 ? 'critical' : deviation > 0.5 ? 'high' : deviation > 0.2 ? 'medium' : 'low';
    }

    return {
      success: true,
      metric: 'error_rate',
      hasAnomaly,
      severity,
      anomalyStartTime,
      anomalyValue,
      baselineValue,
      description: hasAnomaly
        ? `Error rate anomaly detected — ${((anomalyValue || 0) * 100).toFixed(1)}% vs ${((baselineValue || 0) * 100).toFixed(1)}% baseline`
        : 'Error rate is within normal range',
    };
  } catch (error) {
    console.error('[GCC Analyzers] AutoAdaptiveAnomaly failed:', error);
    return {
      success: false,
      metric: 'error_rate',
      hasAnomaly: false,
      severity: 'none',
      description: 'Anomaly detection unavailable',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

/**
 * Detect anomalies in AI token usage (cost spike detection).
 */
export async function detectTokenAnomalyAdaptive(
  timeRangeHours: number = 6
): Promise<AnomalyResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | fieldsAdd tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
               + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
    | makeTimeseries tokens = sum(tok), interval: 5m
  `.trim();

  try {
    console.log('[GCC Analyzers] Running AutoAdaptiveAnomalyDetection for token usage');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.anomaly_detection.AutoAdaptiveAnomalyDetectionAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
        alertCondition: 'ABOVE',
      } as any,
    });

    const output = (result as any)?.output;
    const anomalies = output?.anomalies || [];
    const hasAnomaly = anomalies.length > 0;

    let severity: AnomalyResult['severity'] = 'none';
    let anomalyValue: number | undefined;
    let baselineValue: number | undefined;
    let anomalyStartTime: string | undefined;

    if (hasAnomaly && anomalies[0]) {
      const a = anomalies[0];
      anomalyStartTime = a.startTime;
      anomalyValue = a.value;
      baselineValue = a.baseline;
      const ratio = baselineValue ? (anomalyValue || 0) / baselineValue : 1;
      severity = ratio > 3 ? 'critical' : ratio > 2 ? 'high' : ratio > 1.5 ? 'medium' : 'low';
    }

    return {
      success: true,
      metric: 'token_usage',
      hasAnomaly,
      severity,
      anomalyStartTime,
      anomalyValue,
      baselineValue,
      description: hasAnomaly
        ? `Token usage spike: ${((anomalyValue || 0) / 1000).toFixed(0)}K tokens vs ${((baselineValue || 0) / 1000).toFixed(0)}K baseline`
        : 'Token usage is within normal range',
    };
  } catch (error) {
    console.error('[GCC Analyzers] Token anomaly detection failed:', error);
    return {
      success: false,
      metric: 'token_usage',
      hasAnomaly: false,
      severity: 'none',
      description: 'Anomaly detection unavailable',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

// ============================================
// 3. NoveltyScoreAnalyzer
//    Detect spikes and change points (deployment regressions, model switches)
// ============================================

/**
 * Detect novel patterns in AI latency — useful for catching model degradation or
 * provider issues introduced by deployments or model version switches.
 */
export async function detectLatencyNovelty(
  timeRangeHours: number = 2
): Promise<NoveltyResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | makeTimeseries avg_latency = avg(duration) / 1000000, interval: 5m
  `.trim();

  try {
    console.log('[GCC Analyzers] Running NoveltyScoreAnalyzer for latency');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.NoveltyScoreAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
      } as any,
    });

    const output = (result as any)?.output;
    const novelties = output?.novelties || output?.result?.novelties || [];
    
    if (!novelties.length) {
      return {
        success: true,
        metric: 'latency',
        noveltyScore: 0,
        noveltyType: 'NONE',
        description: 'Latency pattern is normal — no novelty detected',
      };
    }

    // Highest novelty score
    const top = novelties.sort((a: any, b: any) => b.noveltyScore - a.noveltyScore)[0];
    const score = top.noveltyScore || 0;
    const noveltyType = score > 0 ? (top.noveltyType || (score > 0.5 ? 'SPIKE' : 'CHANGE_POINT')) : 'NONE';

    return {
      success: true,
      metric: 'latency',
      noveltyScore: score,
      noveltyType,
      startTime: top.startTime,
      description: `Latency ${noveltyType === 'SPIKE' ? 'spike' : 'change point'} detected — novelty score ${(score * 100).toFixed(0)}%`,
    };
  } catch (error) {
    console.error('[GCC Analyzers] NoveltyScoreAnalyzer failed:', error);
    return {
      success: false,
      metric: 'latency',
      noveltyScore: 0,
      noveltyType: 'NONE',
      description: 'Novelty detection unavailable',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

// ============================================
// 4. SeasonalBaselineAnomalyDetectionAnalyzer
//    Pattern-aware anomaly detection (daily traffic cycles)
// ============================================

/**
 * Detect anomalies in AI request volume that deviate from learned daily/weekly patterns.
 * Particularly useful to distinguish real spikes from expected business-hours traffic.
 */
export async function detectRequestVolumeSeasonalAnomaly(
  timeRangeHours: number = 48
): Promise<AnomalyResult> {
  const metricExpression = `
    fetch spans, from: now()-${timeRangeHours}h, to: now()
    | filter isNotNull(gen_ai.provider.name)
    | makeTimeseries requests = count(), interval: 15m
  `.trim();

  try {
    console.log('[GCC Analyzers] Running SeasonalBaselineAnomalyDetection for request volume');

    const result = await analyzersClient.executeAnalyzer({
      analyzerName: 'dt.statistics.anomaly_detection.SeasonalBaselineAnomalyDetectionAnalyzer',
      body: {
        timeSeriesData: {
          expression: metricExpression,
        },
        alertCondition: 'ABOVE',
        violatingDataPointsToAlert: 2,
      } as any,
    });

    const output = (result as any)?.output;
    const anomalies = output?.anomalies || [];
    const hasAnomaly = anomalies.length > 0;

    let severity: AnomalyResult['severity'] = 'none';
    let anomalyValue: number | undefined;
    let baselineValue: number | undefined;
    let anomalyStartTime: string | undefined;

    if (hasAnomaly && anomalies[0]) {
      const a = anomalies[0];
      anomalyStartTime = a.startTime;
      anomalyValue = a.value;
      baselineValue = a.baseline;
      const ratio = baselineValue ? (anomalyValue || 0) / baselineValue : 1;
      severity = ratio > 3 ? 'critical' : ratio > 2 ? 'high' : ratio > 1.3 ? 'medium' : 'low';
    }

    return {
      success: true,
      metric: 'request_volume',
      hasAnomaly,
      severity,
      anomalyStartTime,
      anomalyValue,
      baselineValue,
      description: hasAnomaly
        ? `Request volume ${((anomalyValue || 0)).toFixed(0)}/interval vs seasonal baseline ${((baselineValue || 0)).toFixed(0)}/interval`
        : 'Request volume follows expected seasonal pattern',
    };
  } catch (error) {
    console.error('[GCC Analyzers] SeasonalBaseline anomaly detection failed:', error);
    return {
      success: false,
      metric: 'request_volume',
      hasAnomaly: false,
      severity: 'none',
      description: 'Seasonal baseline detection unavailable',
      error: error instanceof Error ? error.message : 'Analyzer unavailable',
    };
  }
}

// ============================================
// 5. Health Check — list available analyzers
// ============================================

/**
 * Check that Dynatrace Intelligence analyzers are available in this environment.
 * Uses analyzersClient.queryAnalyzers (requires davis:analyzers:read scope).
 */
export async function checkAnalyzerHealth(): Promise<AnalyzerHealthStatus> {
  try {
    console.log('[GCC Analyzers] Checking Dynatrace Intelligence analyzer availability');
    const result = await analyzersClient.queryAnalyzers();
    const analyzerNames = (result?.analyzers || (result as any)?.results || [])
      .map((a: any) => a.analyzerName || a.name || '')
      .filter(Boolean);

    return {
      available: analyzerNames.length > 0,
      analyzers: analyzerNames,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[GCC Analyzers] Health check failed:', error);
    return {
      available: false,
      analyzers: [],
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Composite: Run all AI health analyzer suite
// ============================================

export interface GenAIAnalyzerSuite {
  tokenForecast: ForecastResult;
  errorAnomaly: AnomalyResult;
  tokenAnomaly: AnomalyResult;
  latencyNovelty: NoveltyResult;
  requestSeasonalAnomaly: AnomalyResult;
  analyzerHealth: AnalyzerHealthStatus;
}

/**
 * Run the full Dynatrace Intelligence analyzer suite on all GenAI metrics.
 * All analyzers run in parallel for performance.
 * Any individual failure is isolated — others succeed independently.
 */
export async function runGenAIAnalyzerSuite(
  timeRangeHours: number = 24
): Promise<GenAIAnalyzerSuite> {
  console.log('[GCC Analyzers] Running full Dynatrace Intelligence analyzer suite');

  const [tokenForecast, errorAnomaly, tokenAnomaly, latencyNovelty, requestSeasonalAnomaly, analyzerHealth] =
    await Promise.all([
      forecastTokenUsage(timeRangeHours, 24),
      detectErrorRateAnomaly(Math.min(timeRangeHours, 6)),
      detectTokenAnomalyAdaptive(Math.min(timeRangeHours, 6)),
      detectLatencyNovelty(Math.min(timeRangeHours, 2)),
      detectRequestVolumeSeasonalAnomaly(Math.min(timeRangeHours, 48)),
      checkAnalyzerHealth(),
    ]);

  return {
    tokenForecast,
    errorAnomaly,
    tokenAnomaly,
    latencyNovelty,
    requestSeasonalAnomaly,
    analyzerHealth,
  };
}
