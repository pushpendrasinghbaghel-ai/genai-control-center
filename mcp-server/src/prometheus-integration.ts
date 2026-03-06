/**
 * Prometheus MCP Integration — MCP Server Tools for Prometheus metric export
 *
 * Exposes Prometheus capabilities as MCP tools:
 * - prometheus_export_metrics: Generate OpenMetrics-formatted GenAI metrics from Dynatrace
 * - prometheus_push_metrics: Push metrics to a Prometheus Pushgateway
 * - prometheus_list_genai_metrics: List all GenAI metric names + current values
 * - prometheus_query_range: Query Dynatrace timeseries data in Prometheus-compatible format
 *
 * Metrics are gathered from Dynatrace Grail via DQL, converted to OpenMetrics format,
 * and can be pushed to a Pushgateway or served as a scrape endpoint payload.
 */

import { executeDql, fmt } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

export interface PrometheusToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface PrometheusToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<PrometheusToolResult>;
}

// ─── OpenMetrics Format Builder ───────────────────────

function buildOpenMetricsLine(
  name: string,
  type: "counter" | "gauge" | "histogram" | "summary",
  help: string,
  value: number,
  labels: Record<string, string> = {},
  timestamp?: number
): string {
  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);

  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const labelPart = labelStr ? `{${labelStr}}` : "";
  const tsPart = timestamp ? ` ${timestamp}` : "";
  lines.push(`${name}${labelPart} ${value}${tsPart}`);

  return lines.join("\n");
}

// ─── Push to Pushgateway ──────────────────────────────

async function pushToPushgateway(
  gatewayUrl: string,
  job: string,
  metricsPayload: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${gatewayUrl.replace(/\/+$/, "")}/metrics/job/${encodeURIComponent(job)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      body: metricsPayload,
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────

/**
 * prometheus_export_metrics — Generate OpenMetrics text from Dynatrace GenAI spans
 */
const prometheusExportMetrics: PrometheusToolDef = {
  name: "prometheus_export_metrics",
  description:
    "Export GenAI metrics from Dynatrace in OpenMetrics/Prometheus text format. Returns metrics for requests, errors, latency, tokens, and cost by provider and model.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "1h";
    const prefix = params.prefix || "genai";

    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency_ms = avg(duration) / 1000000,
    p50_latency_ms = percentile(duration, 50) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0))
  }, by: { gen_ai.provider.name, gen_ai.request.model }`;

    const records = await executeDql(dql);
    const now = Date.now();
    const metricsLines: string[] = [];

    for (const r of records) {
      const provider = String(r["gen_ai.provider.name"] || "unknown");
      const model = String(r["gen_ai.request.model"] || "unknown");
      const labels = { provider, model };

      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_requests_total`, "counter", "Total GenAI requests", Number(r.total_requests || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_errors_total`, "counter", "Total GenAI errors", Number(r.total_errors || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_latency_avg_ms`, "gauge", "Average latency in milliseconds", Number(r.avg_latency_ms || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_latency_p50_ms`, "gauge", "P50 latency in milliseconds", Number(r.p50_latency_ms || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_latency_p95_ms`, "gauge", "P95 latency in milliseconds", Number(r.p95_latency_ms || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_latency_p99_ms`, "gauge", "P99 latency in milliseconds", Number(r.p99_latency_ms || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_input_tokens_total`, "counter", "Total input tokens", Number(r.total_input_tokens || 0), labels, now)
      );
      metricsLines.push(
        buildOpenMetricsLine(`${prefix}_output_tokens_total`, "counter", "Total output tokens", Number(r.total_output_tokens || 0), labels, now)
      );
    }

    metricsLines.push("# EOF");
    const payload = metricsLines.join("\n\n");

    return {
      success: true,
      toolName: "prometheus_export_metrics",
      summary: `Exported ${records.length} provider/model combinations as ${metricsLines.length - 1} metric series`,
      data: {
        openMetricsPayload: payload,
        providerCount: records.length,
        metricCount: metricsLines.length - 1,
        timeframe,
      },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * prometheus_push_metrics — Push GenAI metrics to a Prometheus Pushgateway
 */
const prometheusPushMetrics: PrometheusToolDef = {
  name: "prometheus_push_metrics",
  description:
    "Gather GenAI metrics from Dynatrace and push them to a Prometheus Pushgateway. Requires gateway_url.",
  execute: async (params) => {
    const start = Date.now();
    const gatewayUrl = params.gateway_url || params.gatewayUrl || "";
    const job = params.job || "genai_control_center";
    const timeframe = params.timeframe || "1h";
    const prefix = params.prefix || "genai";

    if (!gatewayUrl) {
      return {
        success: false,
        toolName: "prometheus_push_metrics",
        summary: "Missing gateway_url parameter",
        data: { error: "gateway_url (Prometheus Pushgateway URL) is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    // First export metrics
    const exportResult = await prometheusExportMetrics.execute({ timeframe, prefix });
    if (!exportResult.success) {
      return { ...exportResult, toolName: "prometheus_push_metrics" };
    }

    const metricsPayload = exportResult.data.openMetricsPayload as string;
    const pushResult = await pushToPushgateway(gatewayUrl, job, metricsPayload);

    return {
      success: pushResult.ok,
      toolName: "prometheus_push_metrics",
      summary: pushResult.ok
        ? `Pushed ${exportResult.data.metricCount} metrics to ${gatewayUrl} (job: ${job})`
        : `Failed to push: ${pushResult.error}`,
      data: {
        gatewayUrl,
        job,
        metricCount: exportResult.data.metricCount,
        pushed: pushResult.ok,
        error: pushResult.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * prometheus_list_genai_metrics — List all available GenAI metrics with current values
 */
const prometheusListMetrics: PrometheusToolDef = {
  name: "prometheus_list_genai_metrics",
  description:
    "List all GenAI metric names and their current aggregate values. Useful for discovering what metrics are available for export to Prometheus.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "1h";

    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate_pct = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p50_latency_ms = percentile(duration, 50) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0)),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    unique_providers = countDistinct(gen_ai.provider.name),
    unique_models = countDistinct(gen_ai.request.model),
    unique_services = countDistinct(dt.entity.service)
  }`;

    const records = await executeDql(dql);
    const r = records[0] || {};

    const metrics = [
      { name: "genai_requests_total", type: "counter", value: Number(r.total_requests || 0), help: "Total GenAI LLM requests" },
      { name: "genai_errors_total", type: "counter", value: Number(r.total_errors || 0), help: "Total GenAI errors" },
      { name: "genai_error_rate_percent", type: "gauge", value: Number(r.error_rate_pct || 0), help: "GenAI error rate percentage" },
      { name: "genai_latency_avg_ms", type: "gauge", value: Number(r.avg_latency_ms || 0), help: "Average request latency in ms" },
      { name: "genai_latency_p50_ms", type: "gauge", value: Number(r.p50_latency_ms || 0), help: "P50 request latency in ms" },
      { name: "genai_latency_p95_ms", type: "gauge", value: Number(r.p95_latency_ms || 0), help: "P95 request latency in ms" },
      { name: "genai_latency_p99_ms", type: "gauge", value: Number(r.p99_latency_ms || 0), help: "P99 request latency in ms" },
      { name: "genai_input_tokens_total", type: "counter", value: Number(r.total_input_tokens || 0), help: "Total input/prompt tokens" },
      { name: "genai_output_tokens_total", type: "counter", value: Number(r.total_output_tokens || 0), help: "Total output/completion tokens" },
      { name: "genai_tokens_total", type: "counter", value: Number(r.total_tokens || 0), help: "Total tokens (input + output)" },
      { name: "genai_providers_active", type: "gauge", value: Number(r.unique_providers || 0), help: "Active AI provider count" },
      { name: "genai_models_active", type: "gauge", value: Number(r.unique_models || 0), help: "Active model count" },
      { name: "genai_services_active", type: "gauge", value: Number(r.unique_services || 0), help: "Active service count" },
    ];

    return {
      success: true,
      toolName: "prometheus_list_genai_metrics",
      summary: `${metrics.length} GenAI metrics available (${fmt(Number(r.total_requests || 0))} requests in ${timeframe})`,
      data: { metrics, timeframe },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * prometheus_query_range — Get timeseries data in Prometheus-compatible format
 */
const prometheusQueryRange: PrometheusToolDef = {
  name: "prometheus_query_range",
  description:
    "Query GenAI timeseries data from Dynatrace, formatted for Prometheus range query compatibility. Returns data points suitable for graphing.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "24h";
    const metricName = params.metric || "requests";
    const step = params.step || "1h";

    const metricField =
      metricName === "errors"
        ? "countIf(span.status_code == \"error\" OR isNotNull(error.type))"
        : metricName === "latency"
          ? "avg(duration) / 1000000"
          : metricName === "tokens"
            ? "sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))"
            : "count()";

    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| makeTimeseries value = ${metricField}, interval:${step}, by: { gen_ai.provider.name }`;

    const records = await executeDql(dql);

    // Transform to Prometheus range_query response format
    const result = {
      status: "success",
      data: {
        resultType: "matrix",
        result: records.map((r: any) => ({
          metric: {
            __name__: `genai_${metricName}`,
            provider: r["gen_ai.provider.name"] || "unknown",
          },
          values: Array.isArray(r.value)
            ? r.value.map((v: any, i: number) => [
                Math.floor(Date.now() / 1000) - (r.value.length - i) * 3600,
                String(v),
              ])
            : [[Math.floor(Date.now() / 1000), String(r.value || 0)]],
        })),
      },
    };

    return {
      success: true,
      toolName: "prometheus_query_range",
      summary: `Time series for genai_${metricName} (${timeframe}, step=${step}): ${records.length} series`,
      data: result,
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all Prometheus MCP tools ──────────────────

export const PROMETHEUS_MCP_TOOLS: PrometheusToolDef[] = [
  prometheusExportMetrics,
  prometheusPushMetrics,
  prometheusListMetrics,
  prometheusQueryRange,
];
