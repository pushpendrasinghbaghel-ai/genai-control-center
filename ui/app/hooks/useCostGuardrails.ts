// GenAI Control Center — Cost Guardrails Hook
// Phase 1: Autonomous GenAI Cost Guardrails
// Computes cost velocity (cost-per-minute), budget burn rate, guardrail events

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface CostVelocityPoint {
  timestamp: number;
  costPerMinute: number;
  tokenVelocity: number;
  requestVelocity: number;
  provider: string;
}

export interface CostVelocitySummary {
  currentCostPerMinute: number;
  avgCostPerMinute: number;
  maxCostPerMinute: number;
  baselineCostPerMinute: number;
  velocityRatio: number;         // current / baseline — >2x = warning, >5x = critical
  status: 'normal' | 'elevated' | 'warning' | 'critical';
  trendDirection: 'stable' | 'rising' | 'falling' | 'spike';
  byProvider: ProviderCostVelocity[];
}

export interface ProviderCostVelocity {
  provider: string;
  costPerMinute: number;
  tokenVelocity: number;
  requestVelocity: number;
  status: 'normal' | 'elevated' | 'warning' | 'critical';
}

export interface BudgetBurnRate {
  dailyBudget: number;
  currentSpend: number;
  burnRatePerHour: number;
  budgetUsedPct: number;
  projectedDailySpend: number;
  budgetEtaHours: number | null;  // null if under budget
  status: 'under' | 'approaching' | 'exceeded';
}

export interface GuardrailEvent {
  id: string;
  timestamp: number;
  type: 'throttle' | 'model_switch' | 'alert' | 'budget_pause';
  trigger: string;
  action: string;
  provider: string;
  costSaved: number;
  status: 'executed' | 'pending' | 'failed';
}

export interface CostGuardrailConfig {
  dailyBudget: number;
  warningThresholdPct: number;    // default 80
  criticalThresholdPct: number;   // default 95
  velocityWarningMultiple: number; // default 2x baseline
  velocityCriticalMultiple: number; // default 5x baseline
  autoThrottle: boolean;
  autoModelSwitch: boolean;
  notifySlack: boolean;
  notifyEmail: boolean;
}

// ============================================
// Pricing Model (matches tools.ts)
// ============================================

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'command-r': { input: 0.5, output: 1.5 },
  'command-r-plus': { input: 3.0, output: 15.0 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || '';
  const rate = PRICING[key] || { input: 2.0, output: 6.0 };
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

// ============================================
// DQL Queries
// ============================================

/** 5-minute window cost velocity over the last 2 hours */
const COST_VELOCITY_QUERY = `
fetch spans, from: now()-2h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { provider, model, time_bucket = bin(start_time, 5m) }
| sort time_bucket asc
`;

/** 24-hour baseline for comparison */
const COST_BASELINE_QUERY = `
fetch spans, from: now()-24h, to: now()-2h
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    duration_minutes = (toDouble(end(timeframe())) - toDouble(start(timeframe()))) / 60000000000,
    by: { provider, model }
`;

/** Today's spend for budget tracking */
const DAILY_SPEND_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { provider, model }
`;

/** Hourly spend for burn rate calculation */
const HOURLY_SPEND_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { time_bucket = bin(start_time, 1h), model }
| sort time_bucket asc
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
    console.warn('[GCC:CostGuardrails] DQL error:', err);
    return [];
  }
}

// ============================================
// Hook: useCostVelocity
// ============================================

export function useCostVelocity() {
  const [data, setData] = useState<CostVelocitySummary | null>(null);
  const [timeseries, setTimeseries] = useState<CostVelocityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [velocityRecords, baselineRecords] = await Promise.all([
        safeDql(COST_VELOCITY_QUERY),
        safeDql(COST_BASELINE_QUERY),
      ]);

      // --- Compute baseline cost-per-minute ---
      let baselineTotalCost = 0;
      let baselineDurationMin = 0;
      baselineRecords.forEach((r: any) => {
        const model = String(r.model || 'unknown');
        const inputTok = Number(r.total_input) || 0;
        const outputTok = Number(r.total_output) || 0;
        baselineTotalCost += estimateCost(model, inputTok, outputTok);
        baselineDurationMin = Math.max(baselineDurationMin, Number(r.duration_minutes) || 1320); // 22h default
      });
      const baselineCPM = baselineDurationMin > 0 ? baselineTotalCost / baselineDurationMin : 0;

      // --- Compute velocity per 5-minute bucket ---
      const bucketMap = new Map<number, { cost: number; tokens: number; requests: number; provider: string }>();
      velocityRecords.forEach((r: any) => {
        const ts = new Date(r.time_bucket).getTime();
        const model = String(r.model || 'unknown');
        const provider = String(r.provider || 'Unknown');
        const inputTok = Number(r.total_input) || 0;
        const outputTok = Number(r.total_output) || 0;
        const cost = estimateCost(model, inputTok, outputTok);

        const existing = bucketMap.get(ts) || { cost: 0, tokens: 0, requests: 0, provider };
        existing.cost += cost;
        existing.tokens += inputTok + outputTok;
        existing.requests += Number(r.request_count) || 0;
        bucketMap.set(ts, existing);
      });

      const points: CostVelocityPoint[] = [];
      bucketMap.forEach((v, ts) => {
        points.push({
          timestamp: ts,
          costPerMinute: v.cost / 5,      // cost per minute (5-min bucket)
          tokenVelocity: v.tokens / 5,
          requestVelocity: v.requests / 5,
          provider: v.provider,
        });
      });
      points.sort((a, b) => a.timestamp - b.timestamp);

      // --- Provider-level velocity ---
      const providerMap = new Map<string, { cost: number; tokens: number; requests: number; minutes: number }>();
      velocityRecords.forEach((r: any) => {
        const provider = String(r.provider || 'Unknown');
        const model = String(r.model || 'unknown');
        const cost = estimateCost(model, Number(r.total_input) || 0, Number(r.total_output) || 0);
        const existing = providerMap.get(provider) || { cost: 0, tokens: 0, requests: 0, minutes: 120 };
        existing.cost += cost;
        existing.tokens += (Number(r.total_input) || 0) + (Number(r.total_output) || 0);
        existing.requests += Number(r.request_count) || 0;
        providerMap.set(provider, existing);
      });

      const byProvider: ProviderCostVelocity[] = [];
      providerMap.forEach((v, provider) => {
        const cpm = v.cost / v.minutes;
        const ratio = baselineCPM > 0 ? cpm / baselineCPM : 0;
        byProvider.push({
          provider,
          costPerMinute: cpm,
          tokenVelocity: v.tokens / v.minutes,
          requestVelocity: v.requests / v.minutes,
          status: ratio > 5 ? 'critical' : ratio > 2 ? 'warning' : ratio > 1.5 ? 'elevated' : 'normal',
        });
      });

      // --- Summary ---
      const currentCPM = points.length > 0 ? points[points.length - 1].costPerMinute : 0;
      const avgCPM = points.length > 0 ? points.reduce((s, p) => s + p.costPerMinute, 0) / points.length : 0;
      const maxCPM = points.length > 0 ? Math.max(...points.map(p => p.costPerMinute)) : 0;
      const ratio = baselineCPM > 0 ? currentCPM / baselineCPM : 0;

      // Trend detection
      let trendDirection: CostVelocitySummary['trendDirection'] = 'stable';
      if (points.length >= 4) {
        const recent = points.slice(-4).map(p => p.costPerMinute);
        const earlier = points.slice(-8, -4).map(p => p.costPerMinute);
        const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
        const earlierAvg = earlier.length > 0 ? earlier.reduce((s, v) => s + v, 0) / earlier.length : recentAvg;
        
        if (recentAvg > earlierAvg * 3) trendDirection = 'spike';
        else if (recentAvg > earlierAvg * 1.2) trendDirection = 'rising';
        else if (recentAvg < earlierAvg * 0.8) trendDirection = 'falling';
      }

      const summary: CostVelocitySummary = {
        currentCostPerMinute: currentCPM,
        avgCostPerMinute: avgCPM,
        maxCostPerMinute: maxCPM,
        baselineCostPerMinute: baselineCPM,
        velocityRatio: ratio,
        status: ratio > 5 ? 'critical' : ratio > 2 ? 'warning' : ratio > 1.5 ? 'elevated' : 'normal',
        trendDirection,
        byProvider,
      };

      setData(summary);
      setTimeseries(points);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, timeseries, loading, error, refetch };
}

// ============================================
// Hook: useBudgetBurnRate
// ============================================

export function useBudgetBurnRate(dailyBudget: number = 1000) {
  const [data, setData] = useState<BudgetBurnRate | null>(null);
  const [hourlySpend, setHourlySpend] = useState<{ hour: number; cost: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dailyRecords, hourlyRecords] = await Promise.all([
        safeDql(DAILY_SPEND_QUERY),
        safeDql(HOURLY_SPEND_QUERY),
      ]);

      // Total daily spend
      let totalSpend = 0;
      dailyRecords.forEach((r: any) => {
        const model = String(r.model || 'unknown');
        totalSpend += estimateCost(model, Number(r.total_input) || 0, Number(r.total_output) || 0);
      });

      // Hourly breakdown for burn rate
      const hourlyMap = new Map<number, number>();
      hourlyRecords.forEach((r: any) => {
        const ts = new Date(r.time_bucket).getTime();
        const model = String(r.model || 'unknown');
        const cost = estimateCost(model, Number(r.total_input) || 0, Number(r.total_output) || 0);
        hourlyMap.set(ts, (hourlyMap.get(ts) || 0) + cost);
      });

      const hourlyPoints = Array.from(hourlyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, cost]) => ({ hour, cost }));

      // Burn rate from last 6 hours
      const recentHours = hourlyPoints.slice(-6);
      const burnRatePerHour = recentHours.length > 0
        ? recentHours.reduce((s, h) => s + h.cost, 0) / recentHours.length
        : 0;

      const budgetUsedPct = dailyBudget > 0 ? (totalSpend / dailyBudget) * 100 : 0;
      const projectedDailySpend = burnRatePerHour * 24;
      
      // Hours until budget exhausted (from now)
      const remaining = dailyBudget - totalSpend;
      const budgetEtaHours = remaining > 0 && burnRatePerHour > 0
        ? remaining / burnRatePerHour
        : null;

      const burnRate: BudgetBurnRate = {
        dailyBudget,
        currentSpend: totalSpend,
        burnRatePerHour,
        budgetUsedPct,
        projectedDailySpend,
        budgetEtaHours,
        status: budgetUsedPct >= 95 ? 'exceeded'
              : budgetUsedPct >= 80 ? 'approaching'
              : 'under',
      };

      setData(burnRate);
      setHourlySpend(hourlyPoints);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [dailyBudget]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, hourlySpend, loading, error, refetch };
}

// ============================================
// Hook: useGuardrailEvents (simulated for now, 
// will be backed by bizevents once scopes are granted)
// ============================================

export function useGuardrailEvents() {
  const [events, setEvents] = useState<GuardrailEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const addEvent = useCallback((event: Omit<GuardrailEvent, 'id' | 'timestamp'>) => {
    const newEvent: GuardrailEvent = {
      ...event,
      id: `ge-${Date.now()}`,
      timestamp: Date.now(),
    };
    setEvents(prev => [newEvent, ...prev]);
    console.log('[GCC:CostGuardrails] Guardrail event:', newEvent);
    return newEvent;
  }, []);

  return { events, loading, addEvent };
}

// ============================================
// Default guardrail configuration
// ============================================

export const DEFAULT_GUARDRAIL_CONFIG: CostGuardrailConfig = {
  dailyBudget: 1000,
  warningThresholdPct: 80,
  criticalThresholdPct: 95,
  velocityWarningMultiple: 2,
  velocityCriticalMultiple: 5,
  autoThrottle: false,
  autoModelSwitch: false,
  notifySlack: true,
  notifyEmail: true,
};
