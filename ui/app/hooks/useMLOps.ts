// GenAI Control Center — MLOps Hook
// Surfaces Model Registry, SLO Compliance, Model Comparison, Cost Attribution.
// All data from real DQL queries against gen_ai.* spans — no mock data.

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import {
  MLOPS_MODEL_REGISTRY_QUERY,
  MLOPS_SLO_COMPLIANCE_QUERY,
  MLOPS_SLO_TREND_QUERY,
  MLOPS_MODEL_COMPARISON_QUERY,
  MLOPS_COST_BY_SERVICE_QUERY,
  MLOPS_COST_BY_MODEL_QUERY,
  MLOPS_MODEL_USAGE_TREND_QUERY,
  type QueryFilters,
} from '../queries/dql-queries';
import type {
  MLOpsModelEntry,
  MLOpsSLOEntry,
  MLOpsSLOTrendPoint,
  MLOpsModelComparison,
  MLOpsCostEntry,
  MLOpsSLOConfig,
} from '../types';

// ────── Constants ──────────────────────────────────────────
const SLO_STORAGE_KEY = 'gcc_mlops_slo_config';

const DEFAULT_SLO_CONFIG: MLOpsSLOConfig = {
  latencyThresholdMs: 3000,
  errorBudgetPct: 1.0,
};

// ────── Helpers ────────────────────────────────────────────

async function runQuery(query: string): Promise<unknown[]> {
  try {
    const resp = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60_000, fetchTimeoutSeconds: 60 },
    });
    return resp.result?.records ?? [];
  } catch (e) {
    console.warn('[GCC:MLOps] Query failed:', e);
    return [];
  }
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
};
const bool = (v: unknown): boolean => v === true || v === 'true';
const arr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  return [];
};

function loadSloConfig(): MLOpsSLOConfig {
  try {
    const raw = localStorage.getItem(SLO_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MLOpsSLOConfig;
  } catch { /* ignore */ }
  return { ...DEFAULT_SLO_CONFIG };
}

function saveSloConfig(cfg: MLOpsSLOConfig): void {
  try {
    localStorage.setItem(SLO_STORAGE_KEY, JSON.stringify(cfg));
  } catch { /* ignore */ }
}

// ────── Return Shape ───────────────────────────────────────

export interface UseMLOpsReturn {
  // Data
  registry: MLOpsModelEntry[];
  sloEntries: MLOpsSLOEntry[];
  sloTrend: MLOpsSLOTrendPoint[];
  comparison: MLOpsModelComparison[];
  costByService: MLOpsCostEntry[];
  costByModel: MLOpsCostEntry[];
  usageTrend: Array<{ model: string; timeBucket: string; requests: number; totalTokens: number }>;

  // SLO config
  sloConfig: MLOpsSLOConfig;
  setSloConfig: (cfg: MLOpsSLOConfig) => void;

  // State
  loading: boolean;
  error: Error | null;
  lastRefresh: Date | null;

  // Actions
  refetch: (timeframe?: Timeframe | null) => Promise<void>;

  // Computed summaries (direct counts from data, no arbitrary scores)
  totalModels: number;
  totalProviders: number;
  totalRequests: number;
  sloViolationCount: number;
}

// ────── Hook ───────────────────────────────────────────────

export function useMLOps(): UseMLOpsReturn {
  const [registry, setRegistry] = useState<MLOpsModelEntry[]>([]);
  const [sloEntries, setSloEntries] = useState<MLOpsSLOEntry[]>([]);
  const [sloTrend, setSloTrend] = useState<MLOpsSLOTrendPoint[]>([]);
  const [comparison, setComparison] = useState<MLOpsModelComparison[]>([]);
  const [costByService, setCostByService] = useState<MLOpsCostEntry[]>([]);
  const [costByModel, setCostByModel] = useState<MLOpsCostEntry[]>([]);
  const [usageTrend, setUsageTrend] = useState<Array<{ model: string; timeBucket: string; requests: number; totalTokens: number }>>([]);
  const [sloConfig, _setSloConfig] = useState<MLOpsSLOConfig>(loadSloConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const setSloConfig = useCallback((cfg: MLOpsSLOConfig) => {
    _setSloConfig(cfg);
    saveSloConfig(cfg);
  }, []);

  const refetch = useCallback(async (timeframe: Timeframe | null = null) => {
    setLoading(true);
    setError(null);

    const filters: QueryFilters = { timeframe };
    const cfg = loadSloConfig();

    try {
      const [regRows, sloRows, trendRows, cmpRows, costSvcRows, costModelRows, usageRows] =
        await Promise.all([
          runQuery(MLOPS_MODEL_REGISTRY_QUERY(filters)),
          runQuery(MLOPS_SLO_COMPLIANCE_QUERY(filters, cfg.latencyThresholdMs, cfg.errorBudgetPct)),
          runQuery(MLOPS_SLO_TREND_QUERY(filters, cfg.latencyThresholdMs)),
          runQuery(MLOPS_MODEL_COMPARISON_QUERY(filters)),
          runQuery(MLOPS_COST_BY_SERVICE_QUERY(filters)),
          runQuery(MLOPS_COST_BY_MODEL_QUERY(filters)),
          runQuery(MLOPS_MODEL_USAGE_TREND_QUERY(filters)),
        ]);

      // Parse registry
      setRegistry(
        regRows.map((r: any) => ({
          model: str(r['model']),
          provider: str(r['provider']),
          requests: num(r['requests']),
          avgLatencyMs: num(r['avg_latency_ms']),
          p95LatencyMs: num(r['p95_latency_ms']),
          p99LatencyMs: num(r['p99_latency_ms']),
          avgInputTokens: num(r['avg_input_tokens']),
          avgOutputTokens: num(r['avg_output_tokens']),
          totalInputTokens: num(r['total_input_tokens']),
          totalOutputTokens: num(r['total_output_tokens']),
          errorCount: num(r['error_count']),
          errorRate: num(r['error_rate']),
          services: arr(r['services']),
          firstSeen: str(r['first_seen']),
          lastSeen: str(r['last_seen']),
        }))
      );

      // Parse SLO compliance
      setSloEntries(
        sloRows.map((r: any) => ({
          model: str(r['model']),
          provider: str(r['provider']),
          serviceName: str(r['service_name']),
          totalRequests: num(r['total_requests']),
          fastRequests: num(r['fast_requests']),
          errorCount: num(r['error_count']),
          avgLatencyMs: num(r['avg_latency_ms']),
          p95LatencyMs: num(r['p95_latency_ms']),
          p99LatencyMs: num(r['p99_latency_ms']),
          latencyCompliance: num(r['latency_compliance']),
          errorRate: num(r['error_rate']),
          errorBudgetRemaining: num(r['error_budget_remaining']),
          meetsLatencySlo: bool(r['meets_latency_slo']),
          meetsErrorSlo: bool(r['meets_error_slo']),
        }))
      );

      // Parse trend
      setSloTrend(
        trendRows.map((r: any) => ({
          timeBucket: str(r['time_bucket']),
          total: num(r['total']),
          fast: num(r['fast']),
          errors: num(r['errors']),
          latencyCompliance: num(r['latency_compliance']),
          errorRate: num(r['error_rate']),
        }))
      );

      // Parse comparison
      setComparison(
        cmpRows.map((r: any) => ({
          model: str(r['model']),
          provider: str(r['provider']),
          requests: num(r['requests']),
          avgLatencyMs: num(r['avg_latency_ms']),
          p50LatencyMs: num(r['p50_latency_ms']),
          p95LatencyMs: num(r['p95_latency_ms']),
          p99LatencyMs: num(r['p99_latency_ms']),
          avgInput: num(r['avg_input']),
          avgOutput: num(r['avg_output']),
          totalInput: num(r['total_input']),
          totalOutput: num(r['total_output']),
          errorCount: num(r['error_count']),
          errorRate: num(r['error_rate']),
          tokenEfficiency: num(r['token_efficiency']),
        }))
      );

      // Parse cost by service
      setCostByService(
        costSvcRows.map((r: any) => ({
          serviceName: str(r['service_name']),
          requests: num(r['requests']),
          totalInput: num(r['total_input']),
          totalOutput: num(r['total_output']),
          totalTokens: num(r['total_tokens']),
          errorRate: num(r['error_rate']),
          modelsUsed: arr(r['models_used']),
          providersUsed: arr(r['providers_used']),
        }))
      );

      // Parse cost by model
      setCostByModel(
        costModelRows.map((r: any) => ({
          model: str(r['model']),
          provider: str(r['provider']),
          requests: num(r['requests']),
          totalInput: num(r['total_input']),
          totalOutput: num(r['total_output']),
          totalTokens: num(r['total_input']) + num(r['total_output']),
          errorRate: 0,
          servicesCount: num(r['services_count']),
        }))
      );

      // Parse usage trend
      setUsageTrend(
        usageRows.map((r: any) => ({
          model: str(r['model']),
          timeBucket: str(r['time_bucket']),
          requests: num(r['requests']),
          totalTokens: num(r['total_tokens']),
        }))
      );

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Computed (direct counts, no arbitrary weighting)
  const totalModels = new Set(registry.map((r) => r.model)).size;
  const totalProviders = new Set(registry.map((r) => r.provider)).size;
  const totalRequests = registry.reduce((s, r) => s + r.requests, 0);
  const sloViolationCount = sloEntries.filter((e) => !e.meetsLatencySlo || !e.meetsErrorSlo).length;

  return {
    registry,
    sloEntries,
    sloTrend,
    comparison,
    costByService,
    costByModel,
    usageTrend,
    sloConfig,
    setSloConfig,
    loading,
    error,
    lastRefresh,
    refetch,
    totalModels,
    totalProviders,
    totalRequests,
    sloViolationCount,
  };
}
