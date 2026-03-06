/**
 * AWS Billing & Cost Management Integration Hook
 *
 * Uses DQL queries to surface GenAI cost data from Dynatrace Grail,
 * correlated with AWS Cost Explorer patterns. Provides budget tracking,
 * cost forecasting, per-service breakdowns, and anomaly detection.
 *
 * Architecture:
 * - DQL queries pull cost-proxy data from gen_ai.* spans (token-based cost estimation)
 * - Automation SDK workflows can push cost events to AWS Cost Explorer
 * - All data flows through Dynatrace — no direct AWS credentials needed in UI
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type {
  AWSBillingConfig,
  AWSCostBreakdown,
  AWSBudgetStatus,
  AWSCostAnomaly,
} from '../types';

// ============================================
// DQL Queries — GenAI cost estimation via tokens
// ============================================

const GENAI_COST_BY_PROVIDER_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | fieldsAdd input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
               output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
  | summarize {
      total_requests = count(),
      total_input_tokens = sum(input_tokens),
      total_output_tokens = sum(output_tokens),
      total_tokens = sum(input_tokens + output_tokens),
      avg_input_tokens = avg(input_tokens),
      avg_output_tokens = avg(output_tokens),
      models = collectDistinct(gen_ai.request.model)
    }, by: { gen_ai.provider.name }
  | sort total_tokens desc
`;

const GENAI_COST_BY_MODEL_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | fieldsAdd input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
               output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
  | summarize {
      requests = count(),
      input_tok = sum(input_tokens),
      output_tok = sum(output_tokens),
      total_tok = sum(input_tokens + output_tokens)
    }, by: { gen_ai.provider.name, gen_ai.request.model }
  | sort total_tok desc
  | limit 30
`;

const GENAI_COST_TIMESERIES_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name)
  | fieldsAdd tokens = coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)
  | makeTimeseries {
      requests = count(),
      total_tokens = sum(tokens)
    }, interval: 1h
  | limit 200
`;

const GENAI_COST_ANOMALY_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name)
  | fieldsAdd tokens = coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)
  | summarize {
      requests = count(),
      total_tokens = sum(tokens),
      avg_tokens_per_req = avg(tokens),
      max_tokens = max(tokens),
      min_tokens = min(tokens)
    }, by: { gen_ai.provider.name }
  | fieldsAdd token_spread = toDouble(max_tokens - min_tokens),
             baseline = 500.0,
             deviation = toDouble(avg_tokens_per_req) - 500.0
  | fieldsAdd z_score = deviation / if(token_spread > 0, then:token_spread / 4.0, else:1.0)
  | filter abs(z_score) > 1.5
  | sort abs(z_score) desc
`;

// ============================================
// Token → USD pricing estimates
// ============================================

const TOKEN_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-4': { inputPer1k: 0.03, outputPer1k: 0.06 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  'claude-3-opus': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'claude-3-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'claude-3.5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'gemini-pro': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005 },
  'command-r': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  'command-r-plus': { inputPer1k: 0.003, outputPer1k: 0.015 },
  default: { inputPer1k: 0.002, outputPer1k: 0.006 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(TOKEN_PRICING).find(k => model.toLowerCase().includes(k)) || 'default';
  const pricing = TOKEN_PRICING[key];
  return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
}

// ============================================
// Hook state types
// ============================================

interface AWSBillingState {
  config: AWSBillingConfig;
  costBreakdown: AWSCostBreakdown[];
  budgetStatus: AWSBudgetStatus | null;
  anomalies: AWSCostAnomaly[];
  totalCostUsd: number;
  projectedMonthlyUsd: number;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================
// Hook
// ============================================

export function useAWSBilling(timeframe = '24h') {
  const [state, setState] = useState<AWSBillingState>({
    config: {
      accessKeyId: '',
      region: 'us-east-1',
      enabled: true,
      monthlyBudget: 10000,
      warningThresholdPct: 70,
      criticalThresholdPct: 90,
    },
    costBreakdown: [],
    budgetStatus: null,
    anomalies: [],
    totalCostUsd: 0,
    projectedMonthlyUsd: 0,
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchCostData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const [providerRes, modelRes, anomalyRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: GENAI_COST_BY_PROVIDER_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_COST_BY_MODEL_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_COST_ANOMALY_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      if (!mountedRef.current) return;

      // Build cost breakdown by model
      const breakdown: AWSCostBreakdown[] = (modelRes.result?.records || []).map((r: any) => {
        const provider = String(r['gen_ai.provider.name'] || 'unknown');
        const model = String(r['gen_ai.request.model'] || 'unknown');
        const inputTok = Number(r['input_tok'] || 0);
        const outputTok = Number(r['output_tok'] || 0);
        const costUsd = estimateCostUsd(model, inputTok, outputTok);
        return {
          service: `${provider}/${model}`,
          costUsd,
          isGenAI: true,
          period: timeframe,
        };
      });

      // Total cost
      const totalCostUsd = breakdown.reduce((sum, b) => sum + b.costUsd, 0);

      // Project monthly cost
      const hoursInTimeframe = parseTimeframeHours(timeframe);
      const hoursInMonth = 730;
      const projectedMonthlyUsd = hoursInTimeframe > 0
        ? (totalCostUsd / hoursInTimeframe) * hoursInMonth
        : totalCostUsd * 30;

      // Budget status
      const config = state.config;
      const utilizationPct = config.monthlyBudget > 0
        ? Math.round((projectedMonthlyUsd / config.monthlyBudget) * 100)
        : 0;
      const budgetStatus: AWSBudgetStatus = {
        status: utilizationPct >= 100 ? 'exceeded'
          : utilizationPct >= config.criticalThresholdPct ? 'critical'
          : utilizationPct >= config.warningThresholdPct ? 'warning'
          : 'ok',
        currentSpend: totalCostUsd,
        monthlyBudget: config.monthlyBudget,
        utilizationPct,
        projectedMonthEnd: projectedMonthlyUsd,
        dailyRate: totalCostUsd / Math.max(hoursInTimeframe / 24, 1),
        alerts: [],
      };
      if (budgetStatus.status === 'critical' || budgetStatus.status === 'exceeded') {
        budgetStatus.alerts.push(`Projected spend $${projectedMonthlyUsd.toFixed(2)} exceeds budget $${config.monthlyBudget}`);
      }

      // Anomalies
      const anomalies: AWSCostAnomaly[] = (anomalyRes.result?.records || []).map((r: any) => ({
        provider: String(r['gen_ai.provider.name'] || 'unknown'),
        metric: 'tokens_per_request',
        latestValue: Number(r['avg_tokens_per_req'] || 0),
        mean: 500,
        zScore: Number(r['z_score'] || 0),
        direction: Number(r['z_score'] || 0) > 0 ? 'spike' as const : 'drop' as const,
        severity: Math.abs(Number(r['z_score'] || 0)) > 3 ? 'critical' as const : 'warning' as const,
        estimatedCostImpactUsd: Math.abs(Number(r['z_score'] || 0)) * totalCostUsd * 0.05,
      }));

      setState(s => ({
        ...s,
        costBreakdown: breakdown,
        budgetStatus,
        anomalies,
        totalCostUsd,
        projectedMonthlyUsd,
        loading: false,
        lastRefresh: new Date(),
      }));
    } catch (err) {
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch cost data',
        }));
      }
    }
  }, [timeframe, state.config]);

  const updateConfig = useCallback((updates: Partial<AWSBillingConfig>) => {
    setState(s => ({ ...s, config: { ...s.config, ...updates } }));
  }, []);

  useEffect(() => { fetchCostData(); }, [fetchCostData]);

  return {
    ...state,
    refresh: fetchCostData,
    updateConfig,
  };
}

// ============================================
// Helpers
// ============================================

function parseTimeframeHours(tf: string): number {
  const m = tf.match(/^(\d+)(m|h|d)$/);
  if (!m) return 24;
  const val = parseInt(m[1], 10);
  switch (m[2]) {
    case 'm': return val / 60;
    case 'h': return val;
    case 'd': return val * 24;
    default: return 24;
  }
}

export default useAWSBilling;
