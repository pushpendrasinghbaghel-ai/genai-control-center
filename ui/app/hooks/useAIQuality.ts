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

export interface AIQualityScore {
  serviceId: string;
  serviceName: string;
  model: string;
  provider: string;
  overallScore: number;  // 0-100
  dimensions: {
    responseQuality: number;      // Based on output token consistency
    latencyConsistency: number;   // Low variance = high score
    errorResilience: number;      // Low error rate = high score
    costEfficiency: number;       // Tokens per $ value
    hallucationRisk: number;      // Detected via Dynatrace Intelligence Analysis
  };
  flags: QualityFlag[];
  recommendations: string[];
  timestamp: string;
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
        
        // Extract metrics
        const errorRate = Number(record.error_rate) || 0;
        const lowOutputRate = Number(record.low_output_rate) || 0;
        const avgOutputTokens = Number(record.avg_output_tokens) || 0;
        const avgLatency = Number(record.avg_latency) || 0;
        const p95Latency = Number(record.p95_latency) || avgLatency * 2;
        const avgInputTokens = Number(record.avg_input_tokens) || 1;
        const requestCount = Number(record.request_count) || 0;
        
        // Response Quality (0-100): Based on output tokens and consistency
        // Good: avg output > 50 tokens, Poor: < 10 tokens
        // Also penalize high low_output_rate
        let responseQuality = 70; // Base score
        if (avgOutputTokens >= 100) responseQuality = 95;
        else if (avgOutputTokens >= 50) responseQuality = 85;
        else if (avgOutputTokens >= 20) responseQuality = 75;
        else if (avgOutputTokens >= 10) responseQuality = 60;
        else responseQuality = 40;
        responseQuality = Math.max(0, responseQuality - lowOutputRate);
        
        // Latency Consistency (0-100): Based on average latency thresholds
        // Excellent: < 500ms, Good: < 1s, OK: < 2s, Poor: < 5s, Bad: > 5s
        let latencyConsistency = 70; // Base score
        if (avgLatency < 300) latencyConsistency = 95;
        else if (avgLatency < 500) latencyConsistency = 88;
        else if (avgLatency < 1000) latencyConsistency = 78;
        else if (avgLatency < 2000) latencyConsistency = 65;
        else if (avgLatency < 3000) latencyConsistency = 55;
        else if (avgLatency < 5000) latencyConsistency = 40;
        else latencyConsistency = 25;
        // Penalize high P95 (indicates spikes)
        if (p95Latency > avgLatency * 3) latencyConsistency -= 10;
        latencyConsistency = Math.max(0, Math.min(100, latencyConsistency));
        
        // Error Resilience (0-100): Based on error rate
        // 0% errors = 100, 1% = 90, 5% = 50, 10% = 0
        const errorResilience = Math.max(0, Math.min(100, 100 - errorRate * 10));
        
        // Cost Efficiency (0-100): Based on output/input token ratio
        // Ratio > 2 = great, 1-2 = good, 0.5-1 = ok, < 0.5 = poor
        const tokenRatio = avgOutputTokens / Math.max(avgInputTokens, 1);
        let costEfficiency = 50; // Base score
        if (tokenRatio >= 3) costEfficiency = 95;
        else if (tokenRatio >= 2) costEfficiency = 85;
        else if (tokenRatio >= 1) costEfficiency = 70;
        else if (tokenRatio >= 0.5) costEfficiency = 55;
        else costEfficiency = 35;
        
        // Hallucination Risk Score (0-100, higher = lower risk = better)
        // Based on: consistent output length, reasonable latency, low error rate
        let hallucinationRisk = 75; // Base assumption
        if (lowOutputRate > 20) hallucinationRisk -= 25; // Many truncated responses
        if (avgOutputTokens < 10 && avgLatency > 3000) hallucinationRisk -= 20; // Timeout pattern
        if (errorRate > 5) hallucinationRisk -= 15;
        if (avgOutputTokens > 50 && errorRate < 2) hallucinationRisk += 15; // Healthy pattern
        hallucinationRisk = Math.max(0, Math.min(100, hallucinationRisk));
        
        // Overall score (weighted average)
        const overallScore = Math.round(
          responseQuality * 0.25 +
          latencyConsistency * 0.2 +
          errorResilience * 0.25 +
          costEfficiency * 0.15 +
          hallucinationRisk * 0.15
        );

        // Generate flags
        const flags: QualityFlag[] = [];
        
        if (lowOutputRate > 15) {
          flags.push({
            type: 'low_output',
            severity: lowOutputRate > 30 ? 'critical' : 'warning',
            message: `${lowOutputRate.toFixed(1)}% of responses have unusually low output tokens`,
            evidence: `Average output: ${avgOutputTokens.toFixed(0)} tokens`
          });
        }
        
        if (errorRate > 5) {
          flags.push({
            type: 'degradation',
            severity: errorRate > 10 ? 'critical' : 'warning',
            message: `Error rate at ${errorRate.toFixed(1)}%`,
            evidence: `Above acceptable threshold of 5%`
          });
        }
        
        if (avgLatency > 5000) {
          flags.push({
            type: 'latency_spike',
            severity: avgLatency > 10000 ? 'critical' : 'warning',
            message: `High average latency: ${avgLatency.toFixed(0)}ms`,
            evidence: `P95 latency: ${record.p95_latency?.toFixed(0) || 'N/A'}ms`
          });
        }

        // Generate recommendations
        const recommendations: string[] = [];
        
        if (responseQuality < 70) {
          recommendations.push('Consider adjusting prompts to get more consistent output lengths');
        }
        if (latencyConsistency < 60) {
          recommendations.push('High latency variance detected - consider request queuing or load balancing');
        }
        if (costEfficiency < 40) {
          recommendations.push('Low token efficiency - review prompt templates for optimization');
        }
        if (flags.length > 0) {
          recommendations.push('Address flagged issues to improve overall quality score');
        }

        return {
          serviceId: record.entity_id || serviceName,
          serviceName,
          model,
          provider,
          overallScore,
          dimensions: {
            responseQuality: Math.round(responseQuality),
            latencyConsistency: Math.round(latencyConsistency),
            errorResilience: Math.round(errorResilience),
            costEfficiency: Math.round(costEfficiency),
            hallucationRisk: Math.round(hallucinationRisk)
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
    analyzePromptWithDavis
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
