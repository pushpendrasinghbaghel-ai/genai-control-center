/**
 * AWS CloudWatch Integration Hook
 *
 * Uses DQL queries to surface GenAI operational metrics from Dynatrace Grail,
 * mapped to CloudWatch-style alarms, dashboards, and log-insights patterns.
 * All data flows through Dynatrace — no direct AWS credentials needed in UI.
 *
 * Architecture:
 * - DQL queries discover GenAI metric patterns and alarm conditions
 * - Dynatrace problems map to CloudWatch alarm equivalents
 * - Log query results are surfaced from Dynatrace log storage
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type {
  AWSCloudWatchConfig,
  CloudWatchAlarm,
  CloudWatchMetricData,
  CloudWatchDashboardWidget,
} from '../types';

// ============================================
// DQL Queries — Alarm-style metric conditions
// ============================================

const GENAI_ALARM_CONDITIONS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      total_requests = count(),
      error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
      error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
      avg_latency_ms = avg(duration) / 1000000,
      p99_latency_ms = percentile(duration, 99) / 1000000,
      max_latency_ms = max(duration) / 1000000,
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
    }, by: { gen_ai.provider.name }
  | sort error_rate desc
`;

const GENAI_DAVIS_PROBLEMS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "DAVIS_PROBLEM"
  | fieldsAdd title = event.name,
               severity = coalesce(event.status, "OPEN"),
               affected = coalesce(affected_entity_ids, ""),
               root_cause = coalesce(root_cause_entity_id, "")
  | sort timestamp desc
  | limit 20
`;

const GENAI_OPERATIONAL_METRICS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name)
  | summarize {
      total_calls = count(),
      unique_models = countDistinct(gen_ai.request.model),
      unique_providers = countDistinct(gen_ai.provider.name),
      error_rate_pct = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0,
      avg_latency_ms = avg(duration) / 1000000,
      p50_latency_ms = percentile(duration, 50) / 1000000,
      p95_latency_ms = percentile(duration, 95) / 1000000,
      p99_latency_ms = percentile(duration, 99) / 1000000,
      total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
      total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0))
    }
`;

const GENAI_LOG_ERRORS_QUERY = (timeframe: string) => `
  fetch logs, from:now()-${timeframe}
  | filter matchesPhrase(content, "gen_ai") OR matchesPhrase(content, "openai")
         OR matchesPhrase(content, "anthropic") OR matchesPhrase(content, "llm")
  | filter loglevel == "ERROR" OR loglevel == "WARN"
  | sort timestamp desc
  | limit 30
  | fieldsAdd message = content, level = loglevel, source = log.source
`;

// ============================================
// Hook state
// ============================================

interface AWSCloudWatchState {
  config: AWSCloudWatchConfig;
  alarms: CloudWatchAlarm[];
  metrics: CloudWatchMetricData[];
  dashboardWidgets: CloudWatchDashboardWidget[];
  logErrors: Array<{ timestamp: string; level: string; message: string; source: string }>;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================
// Alarm thresholds
// ============================================

const ALARM_THRESHOLDS = {
  errorRateCritical: 10,
  errorRateWarning: 5,
  latencyP99Critical: 10000,
  latencyP99Warning: 5000,
  tokenBurstThreshold: 100000,
};

// ============================================
// Hook
// ============================================

export function useAWSCloudWatch(timeframe = '24h') {
  const [state, setState] = useState<AWSCloudWatchState>({
    config: {
      region: 'us-east-1',
      enabled: true,
      namespace: 'GenAI/Custom',
      metricsPublished: 0,
    },
    alarms: [],
    metrics: [],
    dashboardWidgets: [],
    logErrors: [],
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const [alarmRes, opsRes, problemRes, logRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: GENAI_ALARM_CONDITIONS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_OPERATIONAL_METRICS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_DAVIS_PROBLEMS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_LOG_ERRORS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      if (!mountedRef.current) return;

      // Build alarms from metric thresholds + Davis problems
      const alarms: CloudWatchAlarm[] = [];

      // Metric-based alarms
      for (const r of (alarmRes.result?.records || [])) {
        if (!r) continue;
        const provider = String((r as any)['gen_ai.provider.name'] || 'unknown');
        const errorRate = Number((r as any)['error_rate'] || 0);
        const p99 = Number((r as any)['p99_latency_ms'] || 0);
        const totalTokens = Number((r as any)['total_tokens'] || 0);

        if (errorRate >= ALARM_THRESHOLDS.errorRateCritical) {
          alarms.push({
            title: `${provider} Error Rate CRITICAL: ${errorRate.toFixed(1)}%`,
            severity: 'CRITICAL',
            status: 'ALARM',
            affectedEntity: provider,
            startTime: new Date().toISOString(),
            source: 'GenAI/ErrorRate',
          });
        } else if (errorRate >= ALARM_THRESHOLDS.errorRateWarning) {
          alarms.push({
            title: `${provider} Error Rate WARNING: ${errorRate.toFixed(1)}%`,
            severity: 'HIGH',
            status: 'ALARM',
            affectedEntity: provider,
            startTime: new Date().toISOString(),
            source: 'GenAI/ErrorRate',
          });
        }

        if (p99 >= ALARM_THRESHOLDS.latencyP99Critical) {
          alarms.push({
            title: `${provider} P99 Latency CRITICAL: ${Math.round(p99)}ms`,
            severity: 'CRITICAL',
            status: 'ALARM',
            affectedEntity: provider,
            startTime: new Date().toISOString(),
            source: 'GenAI/Latency',
          });
        } else if (p99 >= ALARM_THRESHOLDS.latencyP99Warning) {
          alarms.push({
            title: `${provider} P99 Latency WARNING: ${Math.round(p99)}ms`,
            severity: 'HIGH',
            status: 'ALARM',
            affectedEntity: provider,
            startTime: new Date().toISOString(),
            source: 'GenAI/Latency',
          });
        }

        if (totalTokens >= ALARM_THRESHOLDS.tokenBurstThreshold) {
          alarms.push({
            title: `${provider} Token Burst: ${(totalTokens / 1000).toFixed(0)}K tokens`,
            severity: 'MEDIUM',
            status: 'ALARM',
            affectedEntity: provider,
            startTime: new Date().toISOString(),
            source: 'GenAI/TokenUsage',
          });
        }
      }

      // Davis problem alarms
      for (const r of (problemRes.result?.records || [])) {
        if (!r) continue;
        alarms.push({
          title: String((r as any)['title'] || 'Davis Problem'),
          severity: String((r as any)['severity'] || 'OPEN') === 'OPEN' ? 'HIGH' : 'MEDIUM',
          status: String((r as any)['severity'] || 'ALARM'),
          affectedEntity: String((r as any)['affected'] || 'unknown'),
          startTime: String((r as any)['timestamp'] || new Date().toISOString()),
          source: 'Davis/AI',
        });
      }

      // Operational metrics → dashboard widgets
      const opsRow = (opsRes.result?.records || [])[0];
      const dashboardWidgets: CloudWatchDashboardWidget[] = [];
      const metrics: CloudWatchMetricData[] = [];

      if (opsRow) {
        const row = opsRow as any;
        const totalCalls = Number(row['total_calls'] || 0);
        const errorPct = Number(row['error_rate_pct'] || 0);
        const avgLatency = Number(row['avg_latency_ms'] || 0);
        const p95 = Number(row['p95_latency_ms'] || 0);
        const p99 = Number(row['p99_latency_ms'] || 0);
        const uniqueModels = Number(row['unique_models'] || 0);
        const uniqueProviders = Number(row['unique_providers'] || 0);
        const inputTokens = Number(row['total_input_tokens'] || 0);
        const outputTokens = Number(row['total_output_tokens'] || 0);

        dashboardWidgets.push(
          { title: 'Total AI Calls', value: totalCalls, type: 'number' },
          { title: 'Error Rate', value: `${errorPct.toFixed(1)}%`, type: 'gauge' },
          { title: 'Avg Latency', value: `${Math.round(avgLatency)}ms`, type: 'number' },
          { title: 'P95 Latency', value: `${Math.round(p95)}ms`, type: 'number' },
          { title: 'P99 Latency', value: `${Math.round(p99)}ms`, type: 'number' },
          { title: 'Models Active', value: uniqueModels, type: 'number' },
          { title: 'Providers', value: uniqueProviders, type: 'number' },
          { title: 'Total Tokens', value: `${((inputTokens + outputTokens) / 1000).toFixed(0)}K`, type: 'number' },
        );

        metrics.push(
          { name: 'GenAI/TotalRequests', value: totalCalls, unit: 'Count', namespace: 'GenAI/Custom' },
          { name: 'GenAI/ErrorRate', value: errorPct, unit: 'Percent', namespace: 'GenAI/Custom' },
          { name: 'GenAI/AvgLatency', value: avgLatency, unit: 'Milliseconds', namespace: 'GenAI/Custom' },
          { name: 'GenAI/P95Latency', value: p95, unit: 'Milliseconds', namespace: 'GenAI/Custom' },
          { name: 'GenAI/P99Latency', value: p99, unit: 'Milliseconds', namespace: 'GenAI/Custom' },
          { name: 'GenAI/InputTokens', value: inputTokens, unit: 'Count', namespace: 'GenAI/Custom' },
          { name: 'GenAI/OutputTokens', value: outputTokens, unit: 'Count', namespace: 'GenAI/Custom' },
        );
      }

      // Log errors
      const logErrors = (logRes.result?.records || []).filter(Boolean).map((r: any) => ({
        timestamp: String(r['timestamp'] || ''),
        level: String(r['level'] || r['loglevel'] || 'ERROR'),
        message: String(r['message'] || r['content'] || ''),
        source: String(r['source'] || r['log.source'] || 'unknown'),
      }));

      setState(s => ({
        ...s,
        alarms,
        metrics,
        dashboardWidgets,
        logErrors,
        config: { ...s.config, metricsPublished: metrics.length },
        loading: false,
        lastRefresh: new Date(),
      }));
    } catch (err) {
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch CloudWatch data',
        }));
      }
    }
  }, [timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
    activeAlarmCount: state.alarms.filter(a => a.status === 'ALARM').length,
    criticalAlarmCount: state.alarms.filter(a => a.severity === 'CRITICAL').length,
  };
}

export default useAWSCloudWatch;
