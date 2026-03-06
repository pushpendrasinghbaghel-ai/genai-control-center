/**
 * Prometheus MCP Server Integration Hook — Real metric export + query
 *
 * Bridges Dynatrace GenAI observability data to Prometheus via:
 * 1. DQL queries to gather GenAI metrics from Grail
 * 2. Dynatrace Automation workflows to push metrics to Prometheus Pushgateway
 * 3. MCP server-compatible metric export in OpenMetrics format
 *
 * Architecture:
 * - Read path: DQL → GenAI metrics → Prometheus-formatted output
 * - Write path: Workflow HTTP action → Prometheus Pushgateway
 * - Scrape compatibility: Exposes /metrics endpoint data via workflow
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { workflowsClient, executionsClient } from '@dynatrace-sdk/client-automation';
import type {
  PrometheusMCPConfig,
  PrometheusMetric,
  PrometheusScrapeStatus,
  PrometheusGenAIMetrics,
} from '../types';

// ============================================
// DQL Queries for Prometheus metric generation
// ============================================

const GENAI_PROMETHEUS_METRICS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      total_requests = count(),
      total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
      error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
      avg_latency_ns = avg(duration),
      p50_latency_ns = percentile(duration, 50),
      p95_latency_ns = percentile(duration, 95),
      p99_latency_ns = percentile(duration, 99),
      total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
      total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
                        + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
      models = collectDistinct(gen_ai.request.model),
      active_services = countDistinct(dt.entity.service)
    }, by: { gen_ai.provider.name }
`;

const GENAI_PER_MODEL_METRICS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      requests = count(),
      errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
      avg_duration_ns = avg(duration),
      p95_duration_ns = percentile(duration, 95),
      input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
      output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
    }, by: { gen_ai.provider.name, gen_ai.request.model }
  | sort requests desc
  | limit 50
`;

const GENAI_TIMESERIES_METRICS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name)
  | makeTimeseries {
      requests = count(),
      errors = countIf(span.status_code == "error"),
      avg_latency_ms = avg(duration) / 1000000,
      tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
    }, interval: 5m
  | limit 100
`;

// ============================================
// Prometheus OpenMetrics Format Builder
// ============================================

function buildOpenMetricsOutput(
  prefix: string,
  providerMetrics: Array<{
    provider: string;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    activeServices: number;
  }>,
  modelMetrics: Array<{
    provider: string;
    model: string;
    requests: number;
    errors: number;
    avgDurationMs: number;
    p95DurationMs: number;
    inputTokens: number;
    outputTokens: number;
  }>
): string {
  const lines: string[] = [];
  const ts = Date.now();

  // Provider-level metrics
  lines.push(`# HELP ${prefix}_requests_total Total GenAI requests by provider`);
  lines.push(`# TYPE ${prefix}_requests_total counter`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_requests_total{provider="${p.provider}"} ${p.totalRequests} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_errors_total Total GenAI errors by provider`);
  lines.push(`# TYPE ${prefix}_errors_total counter`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_errors_total{provider="${p.provider}"} ${p.totalErrors} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_error_rate GenAI error rate percentage by provider`);
  lines.push(`# TYPE ${prefix}_error_rate gauge`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_error_rate{provider="${p.provider}"} ${p.errorRate.toFixed(2)} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_latency_milliseconds GenAI latency by provider and quantile`);
  lines.push(`# TYPE ${prefix}_latency_milliseconds summary`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_latency_milliseconds{provider="${p.provider}",quantile="0.5"} ${p.p50LatencyMs.toFixed(1)} ${ts}`);
    lines.push(`${prefix}_latency_milliseconds{provider="${p.provider}",quantile="0.95"} ${p.p95LatencyMs.toFixed(1)} ${ts}`);
    lines.push(`${prefix}_latency_milliseconds{provider="${p.provider}",quantile="0.99"} ${p.p99LatencyMs.toFixed(1)} ${ts}`);
    lines.push(`${prefix}_latency_milliseconds_avg{provider="${p.provider}"} ${p.avgLatencyMs.toFixed(1)} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_tokens_total Total tokens consumed by provider`);
  lines.push(`# TYPE ${prefix}_tokens_total counter`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_tokens_total{provider="${p.provider}",type="input"} ${p.totalInputTokens} ${ts}`);
    lines.push(`${prefix}_tokens_total{provider="${p.provider}",type="output"} ${p.totalOutputTokens} ${ts}`);
    lines.push(`${prefix}_tokens_total{provider="${p.provider}",type="total"} ${p.totalTokens} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_active_services Number of active GenAI services by provider`);
  lines.push(`# TYPE ${prefix}_active_services gauge`);
  for (const p of providerMetrics) {
    lines.push(`${prefix}_active_services{provider="${p.provider}"} ${p.activeServices} ${ts}`);
  }

  // Model-level metrics
  lines.push(`# HELP ${prefix}_model_requests_total Requests by model and provider`);
  lines.push(`# TYPE ${prefix}_model_requests_total counter`);
  for (const m of modelMetrics) {
    lines.push(`${prefix}_model_requests_total{provider="${m.provider}",model="${m.model}"} ${m.requests} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_model_errors_total Errors by model and provider`);
  lines.push(`# TYPE ${prefix}_model_errors_total counter`);
  for (const m of modelMetrics) {
    lines.push(`${prefix}_model_errors_total{provider="${m.provider}",model="${m.model}"} ${m.errors} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_model_latency_avg_milliseconds Average latency by model`);
  lines.push(`# TYPE ${prefix}_model_latency_avg_milliseconds gauge`);
  for (const m of modelMetrics) {
    lines.push(`${prefix}_model_latency_avg_milliseconds{provider="${m.provider}",model="${m.model}"} ${m.avgDurationMs.toFixed(1)} ${ts}`);
  }

  lines.push(`# HELP ${prefix}_model_tokens_total Tokens by model, provider, type`);
  lines.push(`# TYPE ${prefix}_model_tokens_total counter`);
  for (const m of modelMetrics) {
    lines.push(`${prefix}_model_tokens_total{provider="${m.provider}",model="${m.model}",type="input"} ${m.inputTokens} ${ts}`);
    lines.push(`${prefix}_model_tokens_total{provider="${m.provider}",model="${m.model}",type="output"} ${m.outputTokens} ${ts}`);
  }

  lines.push('# EOF');
  return lines.join('\n');
}

// ============================================
// Hook
// ============================================

interface UsePrometheusMCPResult {
  config: PrometheusMCPConfig | null;
  metrics: PrometheusMetric[];
  scrapeStatus: PrometheusScrapeStatus | null;
  genaiMetrics: PrometheusGenAIMetrics | null;
  openMetricsOutput: string;
  perModelMetrics: Array<{
    provider: string;
    model: string;
    requests: number;
    errors: number;
    avgDurationMs: number;
    p95DurationMs: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchMetrics: () => Promise<void>;
  pushToPrometheus: (pushgatewayUrl: string, jobName?: string) => Promise<boolean>;
  createScrapeWorkflow: (
    pushgatewayUrl: string,
    intervalMinutes: number,
    jobName?: string
  ) => Promise<string | null>;
  getOpenMetricsPayload: () => string;
}

export function usePrometheusMCP(timeframe = '24h'): UsePrometheusMCPResult {
  const [config, setConfig] = useState<PrometheusMCPConfig | null>(null);
  const [metrics, setMetrics] = useState<PrometheusMetric[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<PrometheusScrapeStatus | null>(null);
  const [genaiMetrics, setGenaiMetrics] = useState<PrometheusGenAIMetrics | null>(null);
  const [openMetricsOutput, setOpenMetricsOutput] = useState('');
  const [perModelMetrics, setPerModelMetrics] = useState<Array<{
    provider: string;
    model: string;
    requests: number;
    errors: number;
    avgDurationMs: number;
    p95DurationMs: number;
    inputTokens: number;
    outputTokens: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerMetricsRef = useRef<Array<{
    provider: string;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    activeServices: number;
  }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const [providerRes, modelRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: GENAI_PROMETHEUS_METRICS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_PER_MODEL_METRICS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      // Parse provider-level metrics
      const provMetrics = (providerRes.result?.records || []).map((r: any) => ({
        provider: String(r['gen_ai.provider.name'] || 'unknown'),
        totalRequests: Number(r['total_requests'] || 0),
        totalErrors: Number(r['total_errors'] || 0),
        errorRate: Number(r['error_rate'] || 0),
        avgLatencyMs: Number(r['avg_latency_ns'] || 0) / 1_000_000,
        p50LatencyMs: Number(r['p50_latency_ns'] || 0) / 1_000_000,
        p95LatencyMs: Number(r['p95_latency_ns'] || 0) / 1_000_000,
        p99LatencyMs: Number(r['p99_latency_ns'] || 0) / 1_000_000,
        totalInputTokens: Number(r['total_input_tokens'] || 0),
        totalOutputTokens: Number(r['total_output_tokens'] || 0),
        totalTokens: Number(r['total_tokens'] || 0),
        activeServices: Number(r['active_services'] || 0),
      }));
      providerMetricsRef.current = provMetrics;

      // Parse model-level metrics
      const modMetrics = (modelRes.result?.records || []).map((r: any) => ({
        provider: String(r['gen_ai.provider.name'] || 'unknown'),
        model: String(r['gen_ai.request.model'] || 'unknown'),
        requests: Number(r['requests'] || 0),
        errors: Number(r['errors'] || 0),
        avgDurationMs: Number(r['avg_duration_ns'] || 0) / 1_000_000,
        p95DurationMs: Number(r['p95_duration_ns'] || 0) / 1_000_000,
        inputTokens: Number(r['input_tokens'] || 0),
        outputTokens: Number(r['output_tokens'] || 0),
      }));
      setPerModelMetrics(modMetrics);

      // Build Prometheus metrics array
      const promMetrics: PrometheusMetric[] = [];
      for (const p of provMetrics) {
        promMetrics.push(
          { name: 'genai_requests_total', type: 'counter', help: 'Total GenAI requests', value: p.totalRequests, labels: { provider: p.provider }, timestamp: Date.now() },
          { name: 'genai_errors_total', type: 'counter', help: 'Total GenAI errors', value: p.totalErrors, labels: { provider: p.provider }, timestamp: Date.now() },
          { name: 'genai_error_rate', type: 'gauge', help: 'GenAI error rate', value: p.errorRate, labels: { provider: p.provider }, timestamp: Date.now() },
          { name: 'genai_latency_avg_ms', type: 'gauge', help: 'Avg latency in ms', value: p.avgLatencyMs, labels: { provider: p.provider }, timestamp: Date.now() },
          { name: 'genai_tokens_total', type: 'counter', help: 'Total tokens', value: p.totalTokens, labels: { provider: p.provider }, timestamp: Date.now() },
        );
      }
      setMetrics(promMetrics);

      // Build aggregated GenAI metrics summary
      const totalRequests = provMetrics.reduce((s, p) => s + p.totalRequests, 0);
      const totalTokens = provMetrics.reduce((s, p) => s + p.totalTokens, 0);
      const avgLatencyMs = provMetrics.length > 0
        ? provMetrics.reduce((s, p) => s + p.avgLatencyMs, 0) / provMetrics.length
        : 0;
      const overallErrorRate = totalRequests > 0
        ? (provMetrics.reduce((s, p) => s + p.totalErrors, 0) / totalRequests) * 100
        : 0;

      setGenaiMetrics({
        totalRequests,
        totalTokens,
        avgLatencyMs,
        errorRate: overallErrorRate,
        activeModels: modMetrics.length,
        providers: provMetrics.map((p) => p.provider),
        costUsd: 0, // calculated separately
      });

      // Build OpenMetrics text output
      const metricsText = buildOpenMetricsOutput('genai', provMetrics, modMetrics);
      setOpenMetricsOutput(metricsText);

      // Set scrape status
      setScrapeStatus({
        endpoint: '/metrics',
        healthy: true,
        lastScrapeMs: Date.now(),
        sampleCount: promMetrics.length,
        errorCount: 0,
        uptime: timeframe,
      });

      // Set config
      setConfig({
        endpoint: '/metrics',
        enabled: provMetrics.length > 0,
        scrapeInterval: 30,
        metricsPrefix: 'genai',
        lastScrapeTime: new Date().toISOString(),
        exportedMetrics: promMetrics.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Prometheus metrics');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchMetrics();
    return () => abortRef.current?.abort();
  }, [fetchMetrics]);

  // Push metrics to Prometheus Pushgateway via Dynatrace workflow
  const pushToPrometheus = useCallback(
    async (pushgatewayUrl: string, jobName = 'genai_control_center'): Promise<boolean> => {
      try {
        const metricsPayload = openMetricsOutput || buildOpenMetricsOutput(
          'genai', providerMetricsRef.current, perModelMetrics
        );

        const workflow = await workflowsClient.createWorkflow({
          body: {
            title: `GCC Prometheus Push - ${new Date().toISOString()}`,
            description: 'Push GenAI metrics to Prometheus Pushgateway',
            tasks: {
              push_metrics: {
                name: 'push_metrics',
                action: 'dynatrace.automations:http-function',
                description: 'Push metrics to Pushgateway',
                input: {
                  method: 'POST',
                  url: `${pushgatewayUrl}/metrics/job/${jobName}`,
                  headers: { 'Content-Type': 'text/plain; version=0.0.4' },
                  body: metricsPayload,
                },
                position: { x: 0, y: 1 },
              },
            },
          } as any,
        });

        await workflowsClient.runWorkflow({ id: workflow.id!, body: {} });
        return true;
      } catch (err) {
        console.error('[PrometheusMCP] Push failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to push metrics');
        return false;
      }
    },
    [openMetricsOutput, perModelMetrics]
  );

  // Create a periodic scrape/push workflow
  const createScrapeWorkflow = useCallback(
    async (
      pushgatewayUrl: string,
      intervalMinutes: number,
      jobName = 'genai_control_center'
    ): Promise<string | null> => {
      try {
        const workflow = await workflowsClient.createWorkflow({
          body: {
            title: `GCC Prometheus Exporter (every ${intervalMinutes}m)`,
            description: `Periodic GenAI metrics export to Prometheus Pushgateway`,
            trigger: {
              schedule: {
                trigger: { type: 'interval' as const, intervalMinutes },
                filterParameters: { type: 'custom' as const },
              },
            },
            tasks: {
              gather_metrics: {
                name: 'gather_metrics',
                action: 'dynatrace.automations:run-javascript',
                description: 'Gather GenAI metrics via DQL',
                input: {
                  script: `
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
export default async function() {
  const providerRes = await queryExecutionClient.queryExecute({
    body: {
      query: \`fetch spans, from:now()-${intervalMinutes}m
        | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
        | summarize {
            requests = count(),
            errors = countIf(span.status_code == "error"),
            avg_latency_ms = avg(duration) / 1000000,
            tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
          }, by: { gen_ai.provider.name }\`,
      requestTimeoutMilliseconds: 30000,
    }
  });
  const records = providerRes.result?.records || [];
  const ts = Date.now();
  let output = '# HELP genai_requests_total Total GenAI requests\\n# TYPE genai_requests_total counter\\n';
  for (const r of records) {
    const p = r['gen_ai.provider.name'] || 'unknown';
    output += \`genai_requests_total{provider="\${p}"} \${r.requests || 0} \${ts}\\n\`;
    output += \`genai_errors_total{provider="\${p}"} \${r.errors || 0} \${ts}\\n\`;
    output += \`genai_latency_avg_ms{provider="\${p}"} \${(r.avg_latency_ms || 0).toFixed(1)} \${ts}\\n\`;
    output += \`genai_tokens_total{provider="\${p}"} \${r.tokens || 0} \${ts}\\n\`;
  }
  return { metricsPayload: output };
}`,
                },
                position: { x: 0, y: 1 },
              },
              push_to_prometheus: {
                name: 'push_to_prometheus',
                action: 'dynatrace.automations:http-function',
                description: 'Push metrics to Prometheus Pushgateway',
                conditions: { states: { gather_metrics: 'OK' } },
                input: {
                  method: 'POST',
                  url: `${pushgatewayUrl}/metrics/job/${jobName}`,
                  headers: { 'Content-Type': 'text/plain; version=0.0.4' },
                  body: '{{result("gather_metrics").metricsPayload}}',
                },
                position: { x: 0, y: 2 },
              },
            },
          } as any,
        });

        await fetchMetrics();
        return workflow.id || null;
      } catch (err) {
        console.error('[PrometheusMCP] Workflow creation failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to create Prometheus scrape workflow');
        return null;
      }
    },
    [fetchMetrics]
  );

  const getOpenMetricsPayload = useCallback(() => {
    return openMetricsOutput || buildOpenMetricsOutput(
      'genai', providerMetricsRef.current, perModelMetrics
    );
  }, [openMetricsOutput, perModelMetrics]);

  return {
    config,
    metrics,
    scrapeStatus,
    genaiMetrics,
    openMetricsOutput,
    perModelMetrics,
    loading,
    error,
    fetchMetrics,
    pushToPrometheus,
    createScrapeWorkflow,
    getOpenMetricsPayload,
  };
}
