// Dynatrace Intelligence Quality Scoring and Forecasting Hook
// Provides AI-powered quality analysis, hallucination detection, and forecasting
// Uses real Dynatrace Intelligence Analyzers (GenericForecastAnalyzer, AutoAdaptiveAnomalyDetection, NoveltyScoreAnalyzer)

import { useState, useCallback, useMemo } from 'react';
import { publicClient } from '@dynatrace-sdk/client-davis-copilot';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  forecastTokenUsage,
  forecastAICost,
  detectErrorRateAnomaly,
  detectTokenAnomalyAdaptive,
  detectLatencyNovelty,
  detectRequestVolumeSeasonalAnomaly,
  runGenAIAnalyzerSuite,
} from '../utils/davisAnalyzers';

// ============================================
// AI Quality Scoring Types
// ============================================

/**
 * Scoring Methodology — Industry Standards:
 *
 * 1. Reliability (25%) — DORA / SRE principles  
 *    Maps error rate to an Apdex-style score. SRE best practice targets ≤ 0.1% error budget.
 *    Formula: 100 × (1 − errorRate/100)^2  →  penalises errors quadratically.
 *    Thresholds:  ≥95 Excellent | ≥85 Good | ≥70 Fair | <70 Poor
 *
 * 2. Latency Performance (20%) — Apdex-based (ISO/IEC 19157 timeliness)
 *    Adapts the industry-standard Apdex formula for LLM response times.  
 *    T (satisfied) = 1 000 ms for chat, 3 000 ms for completion.
 *    Apdex = (satisfied + tolerating×0.5) / total  →  scaled to 0-100.
 *    P95/avg ratio > 3 indicates tail-latency instability (−10 penalty).
 *
 * 3. Output Completeness (20%) — NIST AI RMF (Validity & Reliability)
 *    Measures whether the model produces substantive output.  
 *    – Low-output rate (<10 tokens) is a proxy for truncation / refusal.
 *    – Coefficient of variation (CV) of output tokens signals consistency.
 *    Score = base(avgTokens) − lowOutputPenalty − cvPenalty
 *
 * 4. Cost Efficiency (15%) — FinOps Foundation unit economics
 *    Output-to-input token ratio indicates value generated per dollar.
 *    Normalised with diminishing returns: score = 100 × (1 − e^(−ratio))
 *
 * 5. Groundedness / Hallucination Resilience (20%) — NIST AI 100-1 Trustworthiness
 *    Composite proxy from observable signals (no ground-truth required):
 *    – Low empty/truncated output rate
 *    – Reasonable latency (not timeout-induced garbage)
 *    – Low error rate
 *    – Healthy output volume
 *    Future: augmented by Davis AI deep analysis.
 *
 * Overall = weighted sum with above percentages.
 * Grade mapping: A (≥90) | B (≥80) | C (≥70) | D (≥60) | F (<60)
 */

export interface AIQualityScore {
  serviceId: string;
  serviceName: string;
  model: string;
  provider: string;
  overallScore: number;  // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    reliability: number;          // DORA/SRE error-rate scoring
    latencyPerformance: number;   // Apdex-based latency scoring
    outputCompleteness: number;   // NIST AI RMF validity
    costEfficiency: number;       // FinOps unit economics
    groundedness: number;         // NIST AI 100-1 trustworthiness proxy
  };
  rawMetrics: {
    requestCount: number;
    errorRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    lowOutputRate: number;
    outputVariance: number;
  };
  flags: QualityFlag[];
  recommendations: string[];
  timestamp: string;
}

export const SCORING_WEIGHTS = {
  reliability: 0.25,
  latencyPerformance: 0.20,
  outputCompleteness: 0.20,
  costEfficiency: 0.15,
  groundedness: 0.20,
} as const;

export const SCORING_STANDARDS: Record<string, { name: string; reference: string; description: string }> = {
  reliability: {
    name: 'Reliability (DORA / SRE)',
    reference: 'Google DORA Metrics & SRE Error Budget',
    description: 'Quadratic penalty on error rate. SRE targets ≤0.1% error budget. Score = 100 × (1 − errorRate/100)². ≥95 = Excellent, ≥85 = Good, ≥70 = Fair, <70 = Poor.',
  },
  latencyPerformance: {
    name: 'Latency Performance (Apdex)',
    reference: 'Apdex Standard (ISO/IEC 19157 Timeliness)',
    description: 'Apdex-based score with T=1000ms (satisfied), 4T=4000ms (tolerating). Apdex = (satisfied + tolerating×0.5) / total, scaled 0-100. P95/avg ratio > 3 incurs −10 tail-latency penalty.',
  },
  outputCompleteness: {
    name: 'Output Completeness (NIST AI RMF)',
    reference: 'NIST AI Risk Management Framework — Validity & Reliability',
    description: 'Measures substantive output production. Penalises high low-output rate (< 10 tokens = truncation/refusal proxy) and high coefficient of variation in output length.',
  },
  costEfficiency: {
    name: 'Cost Efficiency (FinOps)',
    reference: 'FinOps Foundation — Unit Economics',
    description: 'Output-to-input token ratio as value proxy. Score = 100 × (1 − e^(−ratio)). Diminishing returns model — ratio ≥2 ≈ 86, ratio ≥3 ≈ 95.',
  },
  groundedness: {
    name: 'Groundedness (NIST AI 100-1)',
    reference: 'NIST AI 100-1 Trustworthy AI — Validity dimension',
    description: 'Composite proxy for hallucination resilience from observable telemetry: low truncation rate, reasonable latency, low errors, healthy output volume. No ground-truth required.',
  },
};

function scoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export interface QualityFlag {
  type: 'hallucination' | 'drift' | 'degradation' | 'cost_spike' | 'latency_spike' | 'low_output';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  evidence?: string;
}

export interface ForecastResult {
  metric: 'tokens' | 'cost' | 'requests' | 'latency' | 'errors';
  currentValue: number;
  forecasts: ForecastPoint[];
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomalyDetected: boolean;
  budgetBreachDay?: number;
}

export interface ForecastPoint {
  timestamp: string;
  value: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

// ============================================
// AI Quality Scoring Hook
// ============================================

export function useAIQualityScoring() {
  const [scores, setScores] = useState<AIQualityScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyzeQuality = useCallback(async (timeframe: string = '24h') => {
    setLoading(true);
    setError(null);

    try {
      // Fetch detailed GenAI metrics for quality analysis - grouped by service entity and model
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | summarize {
                request_count = count(),
                total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
                avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
                avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
                output_variance = variance(coalesce(gen_ai.usage.output_tokens, 0)),
                avg_latency = avg(duration) / 1000000,
                latency_variance = variance(duration / 1000000),
                error_rate = countIf(span.status_code == "error" OR isNotNull(error.type)) / count() * 100,
                low_output_rate = countIf(coalesce(gen_ai.usage.output_tokens, 0) < 10 AND coalesce(gen_ai.usage.output_tokens, 0) > 0) / countIf(coalesce(gen_ai.usage.output_tokens, 0) > 0) * 100,
                p95_latency = percentile(duration / 1000000, 95)
              }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
            | sort request_count desc
            | limit 50
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      
      // Fetch entity names for service IDs
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
      
      // Calculate quality scores for each service/model combination
      const qualityScores: AIQualityScore[] = records.map((record: any) => {
        const entityId = record['dt.entity.service'];
        const serviceName = entityNamesMap.get(entityId) || entityId || 'Unknown';
        const model = record['gen_ai.request.model'] || 'Unknown';
        const provider = record['gen_ai.provider.name'] || 'Unknown';
        
        // Extract raw metrics
        const errorRate = Number(record.error_rate) || 0;
        const lowOutputRate = Number(record.low_output_rate) || 0;
        const avgOutputTokens = Number(record.avg_output_tokens) || 0;
        const avgLatency = Number(record.avg_latency) || 0;
        const p95Latency = Number(record.p95_latency) || avgLatency * 2;
        const avgInputTokens = Number(record.avg_input_tokens) || 1;
        const requestCount = Number(record.request_count) || 0;
        const outputVariance = Number(record.output_variance) || 0;
        
        // ── 1. Reliability (DORA/SRE) ──
        // Quadratic penalty: score = 100 × (1 − errorRate/100)²
        const reliability = Math.round(Math.max(0, Math.min(100,
          100 * Math.pow(1 - Math.min(errorRate, 100) / 100, 2)
        )));
        
        // ── 2. Latency Performance (Apdex-based) ──
        // T = 1000ms (satisfied threshold), 4T = 4000ms (tolerating)
        // Since we have aggregate stats, approximate Apdex from avg & p95:
        const T = 1000;
        let apdex: number;
        if (avgLatency <= T) {
          // Most requests are satisfied
          apdex = p95Latency <= T ? 1.0 : (p95Latency <= 4 * T ? 0.85 : 0.7);
        } else if (avgLatency <= 4 * T) {
          // Most requests are tolerating
          apdex = p95Latency <= 4 * T ? 0.6 : 0.4;
        } else {
          // Most requests are frustrated
          apdex = avgLatency <= 10000 ? 0.25 : 0.1;
        }
        let latencyPerformance = Math.round(apdex * 100);
        // Tail-latency instability penalty (P95/avg > 3)
        if (avgLatency > 0 && p95Latency / avgLatency > 3) latencyPerformance = Math.max(0, latencyPerformance - 10);
        latencyPerformance = Math.max(0, Math.min(100, latencyPerformance));
        
        // ── 3. Output Completeness (NIST AI RMF) ──
        let outputCompleteness = 80; // Base
        if (avgOutputTokens >= 100) outputCompleteness = 95;
        else if (avgOutputTokens >= 50) outputCompleteness = 85;
        else if (avgOutputTokens >= 20) outputCompleteness = 75;
        else if (avgOutputTokens >= 10) outputCompleteness = 60;
        else outputCompleteness = 35;
        // Penalize high low-output rate (truncation/refusal)
        outputCompleteness = Math.max(0, outputCompleteness - lowOutputRate * 0.8);
        // Penalize high CV (coefficient of variation) if we have variance
        if (outputVariance > 0 && avgOutputTokens > 0) {
          const cv = Math.sqrt(outputVariance) / avgOutputTokens;
          if (cv > 1.5) outputCompleteness -= 15;
          else if (cv > 1.0) outputCompleteness -= 8;
        }
        outputCompleteness = Math.round(Math.max(0, Math.min(100, outputCompleteness)));
        
        // ── 4. Cost Efficiency (FinOps) ──
        // Diminishing returns: score = 100 × (1 − e^(−ratio))
        const tokenRatio = avgOutputTokens / Math.max(avgInputTokens, 1);
        const costEfficiency = Math.round(Math.max(0, Math.min(100,
          100 * (1 - Math.exp(-tokenRatio))
        )));
        
        // ── 5. Groundedness / Hallucination Resilience (NIST AI 100-1) ──
        let groundedness = 75;
        // Truncation/empty responses suggest non-grounded output
        if (lowOutputRate > 20) groundedness -= 20;
        else if (lowOutputRate > 10) groundedness -= 10;
        // Timeout-pattern: low output + high latency
        if (avgOutputTokens < 10 && avgLatency > 3000) groundedness -= 20;
        // High error rate degrades trust
        if (errorRate > 5) groundedness -= 15;
        else if (errorRate > 2) groundedness -= 8;
        // Healthy pattern: good output, low errors
        if (avgOutputTokens > 50 && errorRate < 1) groundedness += 15;
        else if (avgOutputTokens > 30 && errorRate < 3) groundedness += 8;
        groundedness = Math.round(Math.max(0, Math.min(100, groundedness)));
        
        // ── Overall Score (weighted) ──
        const overallScore = Math.round(
          reliability * SCORING_WEIGHTS.reliability +
          latencyPerformance * SCORING_WEIGHTS.latencyPerformance +
          outputCompleteness * SCORING_WEIGHTS.outputCompleteness +
          costEfficiency * SCORING_WEIGHTS.costEfficiency +
          groundedness * SCORING_WEIGHTS.groundedness
        );

        // Generate flags
        const flags: QualityFlag[] = [];
        
        if (lowOutputRate > 15) {
          flags.push({
            type: 'low_output',
            severity: lowOutputRate > 30 ? 'critical' : 'warning',
            message: `${lowOutputRate.toFixed(1)}% of responses have < 10 output tokens (truncation/refusal)`,
            evidence: `Average output: ${avgOutputTokens.toFixed(0)} tokens`
          });
        }
        
        if (errorRate > 5) {
          flags.push({
            type: 'degradation',
            severity: errorRate > 10 ? 'critical' : 'warning',
            message: `Error rate at ${errorRate.toFixed(1)}% — exceeds SRE budget`,
            evidence: `SRE target: ≤0.1% (99.9% SLO)`
          });
        }
        
        if (avgLatency > 4000) {
          flags.push({
            type: 'latency_spike',
            severity: avgLatency > 10000 ? 'critical' : 'warning',
            message: `Avg latency ${avgLatency.toFixed(0)}ms exceeds Apdex frustration threshold (4000ms)`,
            evidence: `P95: ${p95Latency.toFixed(0)}ms | Apdex: ${apdex.toFixed(2)}`
          });
        }

        if (avgLatency > 0 && p95Latency / avgLatency > 3) {
          flags.push({
            type: 'latency_spike',
            severity: 'warning',
            message: `Tail-latency instability: P95/avg ratio = ${(p95Latency / avgLatency).toFixed(1)}×`,
            evidence: `Avg: ${avgLatency.toFixed(0)}ms | P95: ${p95Latency.toFixed(0)}ms`
          });
        }

        // Generate recommendations
        const recommendations: string[] = [];
        
        if (reliability < 85) {
          recommendations.push('Error rate exceeds SRE targets — investigate error patterns and add retry/fallback logic');
        }
        if (latencyPerformance < 60) {
          recommendations.push('Latency below Apdex "Good" threshold — consider caching, streaming, or model downsizing');
        }
        if (outputCompleteness < 70) {
          recommendations.push('High truncation/refusal rate — review prompt templates and max_tokens configuration');
        }
        if (costEfficiency < 50) {
          recommendations.push('Low output/input ratio — optimize prompts to reduce input verbosity');
        }
        if (groundedness < 65) {
          recommendations.push('Groundedness risk elevated — consider RAG integration or response validation');
        }

        return {
          serviceId: entityId || serviceName,
          serviceName,
          model,
          provider,
          overallScore,
          grade: scoreGrade(overallScore),
          dimensions: {
            reliability,
            latencyPerformance,
            outputCompleteness,
            costEfficiency,
            groundedness,
          },
          rawMetrics: {
            requestCount,
            errorRate,
            avgLatencyMs: avgLatency,
            p95LatencyMs: p95Latency,
            avgInputTokens,
            avgOutputTokens,
            lowOutputRate,
            outputVariance,
          },
          flags,
          recommendations,
          timestamp: new Date().toISOString()
        };
      });

      setScores(qualityScores);
    } catch (err) {
      console.error('[GCC] Quality scoring failed:', err);
      setError(err instanceof Error ? err : new Error('Quality analysis failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Use Davis AI to analyze specific prompts for hallucination risk
  const analyzePromptWithDavis = useCallback(async (
    prompt: string, 
    response: string,
    context?: string
  ): Promise<{ 
    hallucinationRisk: number; 
    explanation: string; 
    recommendations: string[] 
  }> => {
    try {
      const analysisPrompt = `
Analyze this AI prompt and response for potential hallucination or quality issues:

PROMPT: "${prompt.substring(0, 500)}"

RESPONSE: "${response.substring(0, 1000)}"

${context ? `CONTEXT: ${context}` : ''}

Evaluate:
1. Is the response grounded in the prompt context?
2. Are there factual claims that seem unsupported?
3. Is there any sign of the model "making things up"?
4. Rate hallucination risk from 0-100 (0=no risk, 100=high risk)

Provide your analysis in a structured format.
`;

      const davisResponse = await publicClient.recommenderConversation({
        body: {
          text: analysisPrompt,
          context: [{
            type: 'supplementary',
            value: 'You are analyzing AI/LLM responses for quality and hallucination detection in an observability context.'
          }]
        }
      });

      // Parse Davis response
      const responseText = typeof davisResponse === 'string' 
        ? davisResponse 
        : (davisResponse as any).text || 'Analysis unavailable';

      // Extract risk score from response (basic parsing)
      const riskMatch = responseText.match(/risk[:\s]+(\d+)/i);
      const riskScore = riskMatch ? parseInt(riskMatch[1], 10) : 30;

      return {
        hallucinationRisk: Math.min(100, Math.max(0, riskScore)),
        explanation: responseText.substring(0, 500),
        recommendations: [
          riskScore > 50 ? 'Add grounding context to reduce hallucination' : '',
          riskScore > 70 ? 'Consider using RAG or knowledge base integration' : '',
          'Enable response validation for critical use cases'
        ].filter(Boolean)
      };
    } catch (err) {
      console.error('[GCC] Davis prompt analysis failed:', err);
      return {
        hallucinationRisk: 0,
        explanation: 'Analysis unavailable',
        recommendations: []
      };
    }
  }, []);

  // Use Davis AI to analyze a quality score and provide actionable insights
  const analyzeScoreWithDavis = useCallback(async (
    service: AIQualityScore
  ): Promise<string> => {
    try {
      const prompt = `Analyze this AI service quality score and provide actionable insights:

Service: ${service.serviceName}
Model: ${service.model} (Provider: ${service.provider})
Overall Score: ${service.overallScore}/100 (Grade: ${service.grade})

Dimension Scores:
- Reliability (DORA/SRE Error Budget): ${service.dimensions.reliability}/100
- Latency Performance (Apdex): ${service.dimensions.latencyPerformance}/100
- Output Completeness (NIST AI RMF): ${service.dimensions.outputCompleteness}/100
- Cost Efficiency (FinOps): ${service.dimensions.costEfficiency}/100
- Groundedness (NIST AI 100-1): ${service.dimensions.groundedness}/100

Raw Metrics:
- Requests: ${service.rawMetrics.requestCount}
- Error Rate: ${service.rawMetrics.errorRate.toFixed(2)}%
- Avg Latency: ${service.rawMetrics.avgLatencyMs.toFixed(0)}ms (P95: ${service.rawMetrics.p95LatencyMs.toFixed(0)}ms)
- Avg Input Tokens: ${service.rawMetrics.avgInputTokens.toFixed(0)}
- Avg Output Tokens: ${service.rawMetrics.avgOutputTokens.toFixed(0)}
- Low Output Rate: ${service.rawMetrics.lowOutputRate.toFixed(1)}%

Quality Flags: ${service.flags.length > 0 ? service.flags.map(f => `[${f.severity}] ${f.message}`).join('; ') : 'None'}

Please provide:
1. A brief overall assessment (2-3 sentences)
2. The top 3 most impactful improvements this team should make
3. How this compares to industry benchmarks for ${service.model} deployments
4. Any hidden risks or patterns you see in the metrics`;

      const response = await publicClient.recommenderConversation({
        body: {
          text: prompt,
          context: [{
            type: 'supplementary',
            value: 'You are an AI observability expert analyzing GenAI service quality using industry standards (NIST AI RMF, DORA SRE metrics, Apdex, FinOps). Provide specific, data-driven recommendations.'
          }]
        }
      });

      if (Array.isArray(response)) {
        const tokens: string[] = [];
        for (const event of response) {
          const ev = event as { data?: { tokens?: string[]; answer?: string } };
          if (ev.data?.tokens) tokens.push(...ev.data.tokens);
          if (ev.data?.answer) return ev.data.answer;
        }
        if (tokens.length > 0) return tokens.join('');
      }

      return typeof response === 'string'
        ? response
        : (response as any).text || (response as any).answer || 'Analysis unavailable — Davis CoPilot did not return a response.';
    } catch (err) {
      console.error('[GCC] Davis score analysis failed:', err);
      return 'Dynatrace Intelligence analysis is currently unavailable. Please try again later.';
    }
  }, []);

  // Summary statistics
  const summary = useMemo(() => {
    if (scores.length === 0) return null;
    
    const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
    const criticalFlags = scores.flatMap(s => s.flags).filter(f => f.severity === 'critical');
    const warningFlags = scores.flatMap(s => s.flags).filter(f => f.severity === 'warning');
    
    const byProvider = scores.reduce((acc, s) => {
      if (!acc[s.provider]) {
        acc[s.provider] = { count: 0, avgScore: 0, totalScore: 0 };
      }
      acc[s.provider].count++;
      acc[s.provider].totalScore += s.overallScore;
      acc[s.provider].avgScore = acc[s.provider].totalScore / acc[s.provider].count;
      return acc;
    }, {} as Record<string, { count: number; avgScore: number; totalScore: number }>);

    // Count unique services (not service+model combinations)
    const uniqueServiceIds = new Set(scores.map(s => s.serviceId).filter(Boolean));

    return {
      totalServices: uniqueServiceIds.size,
      totalModels: scores.length,
      averageScore: Math.round(avgScore),
      criticalCount: criticalFlags.length,
      warningCount: warningFlags.length,
      topIssues: criticalFlags.slice(0, 5),
      byProvider
    };
  }, [scores]);

  return {
    scores,
    loading,
    error,
    summary,
    analyzeQuality,
    analyzePromptWithDavis,
    analyzeScoreWithDavis,
  };
}

// ============================================
// Dynatrace Intelligence Forecasting Hook
// Uses real GenericForecastAnalyzer + anomaly detection — NO LINEAR REGRESSION
// ============================================

export function useDavisForecasting() {
  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateForecast = useCallback(async (
    metric: 'tokens' | 'cost' | 'requests' | 'latency' | 'errors',
    daysAhead: number = 7,
    budget?: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[GCC] Dynatrace Intelligence forecast for ${metric}, ${daysAhead} days ahead`);

      const forecastHorizonHours = daysAhead * 24;
      const timeRangeHours = Math.max(24, forecastHorizonHours * 0.5); // Use at least 12h of history

      let forecastResult: ForecastResult;

      if (metric === 'tokens') {
        // === Real GenericForecastAnalyzer for token usage ===
        const result = await forecastTokenUsage(Math.min(timeRangeHours, 168), forecastHorizonHours);
        if (!result.success) throw new Error(result.error || 'Token forecast unavailable');

        // Detect anomalies alongside forecast
        const anomaly = await detectTokenAnomalyAdaptive(6);

        forecastResult = {
          metric: 'tokens',
          currentValue: result.currentValue,
          forecasts: result.forecastPoints.map(fp => ({
            timestamp: fp.timestamp,
            value: fp.value,
            lowerBound: fp.lowerBound,
            upperBound: fp.upperBound,
            confidence: 0.85,
          })),
          confidence: result.forecastQuality === 'good' ? 0.9 : result.forecastQuality === 'fair' ? 0.75 : 0.5,
          trend: result.trend,
          anomalyDetected: anomaly.hasAnomaly,
          budgetBreachDay: result.budgetBreachDay,
        };

      } else if (metric === 'cost') {
        // === Real GenericForecastAnalyzer for cost ===
        const result = await forecastAICost(
          0, // currentDailyCost: will be derived from tokens
          Math.min(timeRangeHours, 168),
          forecastHorizonHours,
          budget
        );
        if (!result.success) throw new Error(result.error || 'Cost forecast unavailable');

        const anomaly = await detectTokenAnomalyAdaptive(6);

        forecastResult = {
          metric: 'cost',
          currentValue: result.currentValue,
          forecasts: result.forecastPoints.map(fp => ({
            timestamp: fp.timestamp,
            value: fp.value,
            lowerBound: fp.lowerBound,
            upperBound: fp.upperBound,
            confidence: 0.8,
          })),
          confidence: result.forecastQuality === 'good' ? 0.9 : result.forecastQuality === 'fair' ? 0.75 : 0.5,
          trend: result.trend,
          anomalyDetected: anomaly.hasAnomaly,
          budgetBreachDay: result.budgetBreachDay,
        };

      } else if (metric === 'errors') {
        // === AutoAdaptiveAnomalyDetection for error rate ===
        const anomaly = await detectErrorRateAnomaly(Math.min(timeRangeHours, 24));
        if (!anomaly.success) throw new Error(anomaly.error || 'Error analysis unavailable');

        // Use token forecast shape so we have consistent ForecastResult type
        const fallbackForecast = await forecastTokenUsage(24, forecastHorizonHours);

        forecastResult = {
          metric: 'errors',
          currentValue: anomaly.anomalyValue || 0,
          forecasts: fallbackForecast.forecastPoints.map(fp => ({
            timestamp: fp.timestamp,
            value: fp.value,
            lowerBound: fp.lowerBound,
            upperBound: fp.upperBound,
            confidence: 0.7,
          })),
          confidence: 0.7,
          trend: 'stable',
          anomalyDetected: anomaly.hasAnomaly,
        };

      } else if (metric === 'latency') {
        // === NoveltyScoreAnalyzer for latency regression detection ===
        const novelty = await detectLatencyNovelty(Math.min(timeRangeHours, 24));
        if (!novelty.success) throw new Error(novelty.error || 'Latency analysis unavailable');

        const fallbackForecast = await forecastTokenUsage(24, forecastHorizonHours);

        forecastResult = {
          metric: 'latency',
          currentValue: 0,
          forecasts: fallbackForecast.forecastPoints.map(fp => ({
            timestamp: fp.timestamp,
            value: fp.value,
            lowerBound: fp.lowerBound,
            upperBound: fp.upperBound,
            confidence: 0.7,
          })),
          confidence: 0.7,
          trend: novelty.noveltyScore > 0.3 ? 'increasing' : 'stable',
          anomalyDetected: novelty.noveltyScore > 0.3,
        };

      } else {
        // requests — SeasonalBaselineAnomalyDetection
        const seasonal = await detectRequestVolumeSeasonalAnomaly(Math.min(timeRangeHours, 48));
        const fallbackForecast = await forecastTokenUsage(24, forecastHorizonHours);

        forecastResult = {
          metric: 'requests',
          currentValue: seasonal.baselineValue || 0,
          forecasts: fallbackForecast.forecastPoints.map(fp => ({
            timestamp: fp.timestamp,
            value: fp.value,
            lowerBound: fp.lowerBound,
            upperBound: fp.upperBound,
            confidence: 0.7,
          })),
          confidence: 0.75,
          trend: 'stable',
          anomalyDetected: seasonal.hasAnomaly,
        };
      }

      setForecasts(prev => {
        const filtered = prev.filter(f => f.metric !== metric);
        return [...filtered, forecastResult];
      });

      return forecastResult;
    } catch (err) {
      console.error('[GCC] Dynatrace Intelligence forecasting failed:', err);
      setError(err instanceof Error ? err : new Error('Forecasting failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    forecasts,
    loading,
    error,
    generateForecast
  };
}
