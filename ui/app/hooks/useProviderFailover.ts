// GenAI Control Center — Provider Failover Intelligence (Phase 5)
// Computes Provider Health Index from real error rates, latency degradation,
// availability brownouts. Surfaces failover events and readiness scores.
// All data from gen_ai.* spans via Grail — zero mocks.

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ─── DQL Queries ────────────────────────────────────────────────

/** Per-provider health snapshot: request volume, error rate, latency percentiles, availability */
const PROVIDER_HEALTH_QUERY = (mins = 60): string => `
fetch spans, from: now()-${mins}m, to: now()
| filter isNotNull(gen_ai.provider.name)
| summarize
    total      = count(),
    errors     = countIf(span.status_code == "error"),
    avg_ms     = avg(duration) / 1000000,
    p50_ms     = percentile(duration, 50) / 1000000,
    p95_ms     = percentile(duration, 95) / 1000000,
    p99_ms     = percentile(duration, 99) / 1000000,
    last_seen  = max(timestamp)
  , by: { provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
| fieldsAdd availability = round(100.0 * (1.0 - toDouble(errors) / toDouble(total)), decimals: 2)
| sort total desc
`.trim();

/** Time-bucketed error rate per provider — for trend detection */
const PROVIDER_ERROR_TREND_QUERY = (mins = 360): string => `
fetch spans, from: now()-${mins}m, to: now()
| filter isNotNull(gen_ai.provider.name)
| makeTimeseries
    total_count  = count(),
    error_count  = countIf(span.status_code == "error"),
    by: { provider = gen_ai.provider.name },
    interval: 10m
`.trim();

/** Provider latency trend — detect degradation windows */
const PROVIDER_LATENCY_TREND_QUERY = (mins = 360): string => `
fetch spans, from: now()-${mins}m, to: now()
| filter isNotNull(gen_ai.provider.name)
| makeTimeseries
    avg_latency_ns = avg(duration),
    p95_latency_ns = percentile(duration, 95),
    by: { provider = gen_ai.provider.name },
    interval: 10m
`.trim();

/** Recent error bursts: top error messages per provider in last hour */
const PROVIDER_ERROR_DETAILS_QUERY = (mins = 60): string => `
fetch spans, from: now()-${mins}m, to: now()
| filter isNotNull(gen_ai.provider.name) AND span.status_code == "error"
| summarize
    count = count(),
    last_seen = max(timestamp)
  , by: { provider = gen_ai.provider.name, error_msg = coalesce(span.status_message, "unknown") }
| sort count desc
| limit 50
`.trim();

/** Cross-provider model availability — which models are responding per provider */
const PROVIDER_MODEL_STATUS_QUERY = (mins = 30): string => `
fetch spans, from: now()-${mins}m, to: now()
| filter isNotNull(gen_ai.provider.name) AND isNotNull(gen_ai.request.model)
| summarize
    requests = count(),
    errors   = countIf(span.status_code == "error"),
    avg_ms   = avg(duration) / 1000000,
    last_seen = max(timestamp)
  , by: { provider = gen_ai.provider.name, model = gen_ai.request.model }
| fieldsAdd error_rate = if(requests > 0, 100.0 * toDouble(errors) / toDouble(requests), else: 0.0)
| sort provider asc, requests desc
`.trim();

// ─── Types ──────────────────────────────────────────────────────

export type ProviderStatus = 'healthy' | 'degraded' | 'critical' | 'down' | 'unknown';

export interface ProviderHealth {
  provider: string;
  status: ProviderStatus;
  healthIndex: number; // 0–100
  totalRequests: number;
  errorRate: number;
  availability: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  lastSeen: string;
  // Sub-scores
  reliabilityScore: number; // from error rate
  performanceScore: number; // from latency
  availabilityScore: number; // from uptime
  freshnessScore: number; // from last-seen recency
}

export interface ProviderErrorBurst {
  provider: string;
  errorMsg: string;
  count: number;
  lastSeen: string;
}

export interface ProviderModelHealth {
  provider: string;
  model: string;
  requests: number;
  errorRate: number;
  avgLatencyMs: number;
  lastSeen: string;
  status: ProviderStatus;
}

export interface FailoverEvent {
  timestamp: number;
  fromProvider: string;
  toProvider: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  autoResolved: boolean;
}

export interface ProviderTrendPoint {
  timestamp: number;
  errorRate: number;
  latencyMs: number;
}

export interface UseProviderFailoverReturn {
  providers: ProviderHealth[];
  errorBursts: ProviderErrorBurst[];
  modelHealth: ProviderModelHealth[];
  failoverEvents: FailoverEvent[];
  trendData: Record<string, ProviderTrendPoint[]>;
  overallReadiness: number; // 0–100 overall failover readiness
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ─── Safe DQL runner ────────────────────────────────────────────

async function safeDql(query: string): Promise<any[]> {
  try {
    const resp = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60_000, fetchTimeoutSeconds: 60 },
    });
    return (resp.result?.records as any[]) ?? [];
  } catch (e) {
    console.warn('[GCC:ProviderFailover] DQL failed:', e);
    return [];
  }
}

// ─── Scoring Functions ──────────────────────────────────────────

function computeReliabilityScore(errorRate: number): number {
  // 0% error → 100, 5% → 50, 10%+ → 0
  if (errorRate <= 0) return 100;
  if (errorRate >= 10) return 0;
  return Math.round(100 * (1 - errorRate / 10));
}

function computePerformanceScore(p95Ms: number): number {
  // <500ms → 100, 2000ms → 50, >5000ms → 0
  if (p95Ms <= 500) return 100;
  if (p95Ms >= 5000) return 0;
  return Math.round(100 * (1 - (p95Ms - 500) / 4500));
}

function computeAvailabilityScore(availability: number): number {
  // 99.9% → 100, 99% → 90, 95% → 50, <90% → 0
  if (availability >= 99.9) return 100;
  if (availability < 90) return 0;
  return Math.round((availability - 90) * 10);
}

function computeFreshnessScore(lastSeenIso: string): number {
  // Seen in last 5 min → 100, last 30 min → 50, >1h ago → 0
  const diff = Date.now() - new Date(lastSeenIso).getTime();
  const mins = diff / 60_000;
  if (mins <= 5) return 100;
  if (mins >= 60) return 0;
  return Math.round(100 * (1 - (mins - 5) / 55));
}

function deriveStatus(healthIndex: number): ProviderStatus {
  if (healthIndex >= 80) return 'healthy';
  if (healthIndex >= 60) return 'degraded';
  if (healthIndex >= 30) return 'critical';
  return 'down';
}

function deriveModelStatus(errorRate: number, lastSeenIso: string): ProviderStatus {
  const age = (Date.now() - new Date(lastSeenIso).getTime()) / 60_000;
  if (age > 30) return 'unknown';
  if (errorRate > 20) return 'critical';
  if (errorRate > 5) return 'degraded';
  return 'healthy';
}

// ─── Failover event detection ───────────────────────────────────

/** Detects implicit failover events by analysing provider health transitions */
function detectFailoverEvents(providers: ProviderHealth[]): FailoverEvent[] {
  const events: FailoverEvent[] = [];
  const unhealthy = providers.filter(
    (p) => p.status === 'critical' || p.status === 'down',
  );
  const healthy = providers.filter((p) => p.status === 'healthy');

  for (const bad of unhealthy) {
    if (healthy.length > 0) {
      const best = healthy.reduce((a, b) =>
        a.healthIndex > b.healthIndex ? a : b,
      );
      events.push({
        timestamp: Date.now(),
        fromProvider: bad.provider,
        toProvider: best.provider,
        reason:
          bad.status === 'down'
            ? `${bad.provider} is down (${bad.errorRate.toFixed(1)}% errors). Recommend failing over to ${best.provider}.`
            : `${bad.provider} critical (error rate ${bad.errorRate.toFixed(1)}%, p95 ${bad.p95LatencyMs.toFixed(0)}ms). ${best.provider} has ${best.healthIndex} health index.`,
        severity: bad.status === 'down' ? 'critical' : 'warning',
        autoResolved: false,
      });
    }
  }

  // Warn about degraded providers
  const degraded = providers.filter((p) => p.status === 'degraded');
  for (const d of degraded) {
    events.push({
      timestamp: Date.now(),
      fromProvider: d.provider,
      toProvider: d.provider,
      reason: `${d.provider} is degraded — error rate ${d.errorRate.toFixed(1)}%, p95 latency ${d.p95LatencyMs.toFixed(0)}ms. Monitor closely.`,
      severity: 'info',
      autoResolved: false,
    });
  }

  return events;
}

// ─── Trend extraction utilities ─────────────────────────────────

function extractTrendMap(
  errorRecs: any[],
  latencyRecs: any[],
): Record<string, ProviderTrendPoint[]> {
  const map: Record<string, ProviderTrendPoint[]> = {};

  // Error trend records come as timeseries — each record has a provider key + arrays
  for (const rec of errorRecs) {
    const provider = rec['provider'] as string;
    if (!provider) continue;
    const timestamps: string[] = rec['timeframe'] ?? [];
    const totals: number[] = rec['total_count'] ?? [];
    const errors: number[] = rec['error_count'] ?? [];

    if (!map[provider]) map[provider] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts =
        typeof timestamps[i] === 'string'
          ? new Date(timestamps[i]).getTime()
          : Number(timestamps[i]);
      const total = Number(totals[i]) || 0;
      const err = Number(errors[i]) || 0;
      const existing = map[provider].find((p) => p.timestamp === ts);
      const rate = total > 0 ? (err / total) * 100 : 0;
      if (existing) {
        existing.errorRate = rate;
      } else {
        map[provider].push({ timestamp: ts, errorRate: rate, latencyMs: 0 });
      }
    }
  }

  // Overlay latency trend
  for (const rec of latencyRecs) {
    const provider = rec['provider'] as string;
    if (!provider) continue;
    const timestamps: string[] = rec['timeframe'] ?? [];
    const latVals: number[] = rec['avg_latency_ns'] ?? [];

    if (!map[provider]) map[provider] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts =
        typeof timestamps[i] === 'string'
          ? new Date(timestamps[i]).getTime()
          : Number(timestamps[i]);
      const lat = (Number(latVals[i]) || 0) / 1000000; // ns → ms
      const existing = map[provider].find((p) => p.timestamp === ts);
      if (existing) {
        existing.latencyMs = lat;
      } else {
        map[provider].push({ timestamp: ts, errorRate: 0, latencyMs: lat });
      }
    }
  }

  // Sort each array
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.timestamp - b.timestamp);
  }

  return map;
}

// ─── Readiness calculator ───────────────────────────────────────

/** Overall failover readiness: 100 = all providers healthy & redundant, 0 = single point of failure + degraded */
function computeOverallReadiness(providers: ProviderHealth[]): number {
  if (providers.length === 0) return 0;

  // Dimension 1: Multi-provider redundancy (0-25)
  const healthyCount = providers.filter((p) => p.status === 'healthy').length;
  const redundancy = Math.min(25, (healthyCount / Math.max(providers.length, 1)) * 25);

  // Dimension 2: No single-provider concentration (0-25)
  const totalReqs = providers.reduce((s, p) => s + p.totalRequests, 0);
  const maxShare = totalReqs > 0
    ? Math.max(...providers.map((p) => p.totalRequests / totalReqs))
    : 1;
  // If the biggest provider has <50% traffic, perfect diversification
  const diversification = maxShare <= 0.5 ? 25 : Math.round(25 * (1 - (maxShare - 0.5) * 2));

  // Dimension 3: Average health index (0-25)
  const avgHealth = providers.reduce((s, p) => s + p.healthIndex, 0) / providers.length;
  const avgDim = Math.round((avgHealth / 100) * 25);

  // Dimension 4: No critical/down providers (0-25)
  const criticalRatio =
    providers.filter((p) => p.status === 'critical' || p.status === 'down').length / providers.length;
  const stability = Math.round(25 * (1 - criticalRatio));

  return Math.min(100, Math.max(0, redundancy + Math.max(0, diversification) + avgDim + stability));
}

// ─── Hook ───────────────────────────────────────────────────────

export function useProviderFailover(): UseProviderFailoverReturn {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [errorBursts, setErrorBursts] = useState<ProviderErrorBurst[]>([]);
  const [modelHealth, setModelHealth] = useState<ProviderModelHealth[]>([]);
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([]);
  const [trendData, setTrendData] = useState<Record<string, ProviderTrendPoint[]>>({});
  const [overallReadiness, setOverallReadiness] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthRecs, errorTrendRecs, latTrendRecs, errorDetailRecs, modelRecs] =
        await Promise.all([
          safeDql(PROVIDER_HEALTH_QUERY(60)),
          safeDql(PROVIDER_ERROR_TREND_QUERY(360)),
          safeDql(PROVIDER_LATENCY_TREND_QUERY(360)),
          safeDql(PROVIDER_ERROR_DETAILS_QUERY(60)),
          safeDql(PROVIDER_MODEL_STATUS_QUERY(30)),
        ]);

      if (!mounted.current) return;

      // ── Build provider health objects ──
      const providerList: ProviderHealth[] = healthRecs.map((r: any) => {
        const errRate = Number(r.error_rate) || 0;
        const avail = Number(r.availability) || 100;
        const p95 = Number(r.p95_ms) || 0;
        const lastSeen = String(r.last_seen || new Date().toISOString());

        const reliabilityScore = computeReliabilityScore(errRate);
        const performanceScore = computePerformanceScore(p95);
        const availabilityScore = computeAvailabilityScore(avail);
        const freshnessScore = computeFreshnessScore(lastSeen);

        // Weighted composite: reliability 35%, performance 25%, availability 25%, freshness 15%
        const healthIndex = Math.round(
          reliabilityScore * 0.35 +
          performanceScore * 0.25 +
          availabilityScore * 0.25 +
          freshnessScore * 0.15,
        );

        return {
          provider: String(r.provider || 'unknown'),
          status: deriveStatus(healthIndex),
          healthIndex,
          totalRequests: Number(r.total) || 0,
          errorRate: errRate,
          availability: avail,
          avgLatencyMs: Number(r.avg_ms) || 0,
          p95LatencyMs: p95,
          p99LatencyMs: Number(r.p99_ms) || 0,
          lastSeen,
          reliabilityScore,
          performanceScore,
          availabilityScore,
          freshnessScore,
        };
      });

      // ── Error bursts ──
      const bursts: ProviderErrorBurst[] = errorDetailRecs.map((r: any) => ({
        provider: String(r.provider || 'unknown'),
        errorMsg: String(r.error_msg || ''),
        count: Number(r.count) || 0,
        lastSeen: String(r.last_seen || ''),
      }));

      // ── Model health ──
      const models: ProviderModelHealth[] = modelRecs.map((r: any) => ({
        provider: String(r.provider || ''),
        model: String(r.model || ''),
        requests: Number(r.requests) || 0,
        errorRate: Number(r.error_rate) || 0,
        avgLatencyMs: Number(r.avg_ms) || 0,
        lastSeen: String(r.last_seen || ''),
        status: deriveModelStatus(Number(r.error_rate) || 0, String(r.last_seen || '')),
      }));

      // ── Trends ──
      const trends = extractTrendMap(errorTrendRecs, latTrendRecs);

      // ── Failover events ──
      const events = detectFailoverEvents(providerList);

      // ── Readiness ──
      const readiness = computeOverallReadiness(providerList);

      setProviders(providerList);
      setErrorBursts(bursts);
      setModelHealth(models);
      setFailoverEvents(events);
      setTrendData(trends);
      setOverallReadiness(readiness);
    } catch (e: any) {
      if (mounted.current) setError(e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return {
    providers,
    errorBursts,
    modelHealth,
    failoverEvents,
    trendData,
    overallReadiness,
    loading,
    error,
    refetch,
  };
}
