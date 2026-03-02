/**
 * Agentic Tool Registry — GenAI Observability Tools
 * 
 * 15 tools organized in 3 tiers:
 * - Tier 1 (Observe): Read-only data retrieval
 * - Tier 2 (Analyze): Dynatrace Intelligence-powered analysis
 * - Tier 3 (Act): Recommendations with follow-up actions
 * 
 * Each tool executes real DQL queries against Grail and returns
 * structured MessageBlock[] for native Strato rendering.
 */

import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import {
  forecastTokenUsage,
  forecastAICost,
  detectErrorRateAnomaly,
  detectLatencyNovelty,
  runGenAIAnalyzerSuite,
} from "../utils/davisAnalyzers";
import { estimateCost } from "../utils/helpers";
import type {
  AgentTool,
  ToolExecutionContext,
  ToolResult,
  MessageBlock,
  FollowUpChip,
} from "./types";

// ============================================
// Helper: Execute DQL and return records
// ============================================

async function executeDql(query: string): Promise<any[]> {
  const response = await queryExecutionClient.queryExecute({
    body: {
      query,
      requestTimeoutMilliseconds: 60000,
      fetchTimeoutSeconds: 60,
    },
  });
  return response.result?.records || [];
}

/** Format number with locale and optional decimals */
function fmt(n: number, decimals = 0): string {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: decimals }) : "—";
}

/** Format latency from nanoseconds to ms */
function nsToMs(ns: number): string {
  return fmt(ns / 1_000_000, 0);
}

// ============================================
// TIER 1 — OBSERVE (Read-Only)
// ============================================

const serviceHealth: AgentTool = {
  name: "service_health",
  label: "Service Health",
  description: "Show health overview of all GenAI services — request count, error rate, latency, tokens",
  triggers: ["health", "services", "overview", "status", "how", "doing", "summary", "all services"],
  examples: ["How are my AI services doing?", "Show service health", "Overview of all GenAI services"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd service = dt.entity.service
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model)
  }, by: { service }
| sort requests desc
| limit 20`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No gen_ai spans found. Ensure services are instrumented with OpenTelemetry gen_ai.* attributes." });
      return { success: true, toolName: "service_health", summary: "No GenAI services found.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    // KPI metrics
    const totalRequests = records.reduce((s, r) => s + Number(r.requests || 0), 0);
    const avgError = records.reduce((s, r) => s + Number(r.error_rate || 0), 0) / records.length;
    const avgLatency = records.reduce((s, r) => s + Number(r.avg_latency || 0), 0) / records.length;
    const totalTokens = records.reduce((s, r) => s + Number(r.tokens || 0), 0);
    const criticalCount = records.filter(r => Number(r.error_rate || 0) > 5).length;

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Services", value: records.length, severity: "healthy" },
        { label: "Total Requests", value: fmt(totalRequests) },
        { label: "Avg Error Rate", value: `${avgError.toFixed(1)}%`, severity: avgError > 5 ? "critical" : avgError > 1 ? "warning" : "healthy" },
        { label: "Avg Latency", value: `${nsToMs(avgLatency)}ms`, severity: avgLatency > 3e9 ? "warning" : "healthy" },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Critical", value: criticalCount, severity: criticalCount > 0 ? "critical" : "healthy" },
      ],
    });

    // Table
    blocks.push({
      type: "table",
      headers: ["Service", "Requests", "Error Rate", "Latency", "Tokens", "Providers", "Models"],
      rows: records.map((r: any) => [
        String(r.service || "—"),
        fmt(Number(r.requests || 0)),
        `${Number(r.error_rate || 0).toFixed(1)}%`,
        `${nsToMs(Number(r.avg_latency || 0))}ms`,
        fmt(Number(r.tokens || 0)),
        (r.providers || []).join(", ") || "—",
        (r.models || []).join(", ") || "—",
      ]),
      caption: `${records.length} GenAI services discovered`,
    });

    const followUps: FollowUpChip[] = [
      { label: "Forecast tokens", query: "Forecast my token usage for the next 24 hours" },
      { label: "Detect anomalies", query: "Are there any anomalies in my AI services?" },
      { label: "Cost breakdown", query: "Show me cost breakdown by provider" },
    ];
    if (criticalCount > 0) {
      followUps.unshift({ label: "Investigate errors", query: "Which services have the highest error rates?" });
    }

    return {
      success: true,
      toolName: "service_health",
      summary: `Found ${records.length} GenAI services: ${fmt(totalRequests)} requests, ${avgError.toFixed(1)}% avg error rate, ${fmt(totalTokens)} tokens consumed.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps,
    };
  },
};

const providerComparison: AgentTool = {
  name: "provider_comparison",
  label: "Provider Comparison",
  description: "Compare AI providers (OpenAI, Anthropic, Google, etc.) on latency, cost, error rate, and token usage",
  triggers: ["compare", "provider", "providers", "versus", "vs", "openai", "anthropic", "google", "azure", "bedrock", "which provider", "best provider"],
  examples: ["Compare all providers", "Which provider has the lowest latency?", "OpenAI vs Anthropic"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    models = collectDistinct(gen_ai.request.model)
  }, by: { gen_ai.provider.name }
| sort requests desc`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Providers", message: "No AI provider data found." });
      return { success: true, toolName: "provider_comparison", summary: "No provider data found.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    blocks.push({
      type: "table",
      headers: ["Provider", "Requests", "Avg Latency", "Error Rate", "Tokens", "Est. Cost", "Models"],
      rows: records.map((r: any) => {
        const provider = r["gen_ai.provider.name"] || "Unknown";
        const inputTok = Number(r.input_tokens || 0);
        const outputTok = Number(r.output_tokens || 0);
        const cost = estimateCost(provider, inputTok, outputTok);
        return [
          provider,
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          fmt(Number(r.total_tokens || 0)),
          `$${cost.toFixed(2)}`,
          (r.models || []).join(", ") || "—",
        ];
      }),
      caption: `${records.length} AI providers compared`,
    });

    // Bar chart for visual comparison
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Requests by Provider",
      data: records.map((r: any) => ({
        label: r["gen_ai.provider.name"] || "Unknown",
        value: Number(r.requests || 0),
      })),
      unit: "requests",
    });

    return {
      success: true,
      toolName: "provider_comparison",
      summary: `Compared ${records.length} providers.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Forecast cost", query: "Forecast my AI costs for the next week" },
        { label: "Model comparison", query: "Compare models within each provider" },
      ],
    };
  },
};

const modelComparison: AgentTool = {
  name: "model_comparison",
  label: "Model Comparison",
  description: "Compare LLM models (gpt-4o, claude-3, gemini, etc.) on performance and cost",
  triggers: ["model", "models", "gpt", "claude", "gemini", "llama", "compare models", "which model", "best model"],
  examples: ["Compare all models", "Which model is fastest?", "gpt-4o vs claude-3.5"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    avg_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc
| limit 15`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Models", message: "No model data found." });
      return { success: true, toolName: "model_comparison", summary: "No model data.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "Avg Latency", "Error Rate", "Avg Tokens/Req", "Est. Cost"],
      rows: records.map((r: any) => {
        const cost = estimateCost(r["gen_ai.provider.name"] || "", Number(r.input_tokens || 0), Number(r.output_tokens || 0));
        return [
          r["gen_ai.request.model"] || "—",
          r["gen_ai.provider.name"] || "—",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          fmt(Number(r.avg_tokens || 0)),
          `$${cost.toFixed(2)}`,
        ];
      }),
    });

    return {
      success: true,
      toolName: "model_comparison",
      summary: `Compared ${records.length} models.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Provider comparison", query: "Compare providers" },
        { label: "Forecast tokens", query: "Forecast token consumption" },
      ],
    };
  },
};

const topErrors: AgentTool = {
  name: "top_errors",
  label: "Error Investigation",
  description: "Show top errors across GenAI services — error types, affected services, rate limit (429) detection",
  triggers: ["error", "errors", "failing", "failures", "429", "rate limit", "broken", "problem", "issues"],
  examples: ["What errors are happening?", "Show rate limit errors", "Which services are failing?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR isNotNull(error.type)
| summarize {
    error_count = count(),
    last_seen = max(timestamp),
    error_types = collectDistinct(error.type),
    models = collectDistinct(gen_ai.request.model),
    providers = collectDistinct(gen_ai.provider.name)
  }, by: { dt.entity.service }
| sort error_count desc
| limit 15`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];
    const totalErrors = records.reduce((s, r) => s + Number(r.error_count || 0), 0);

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "success", title: "No Errors", message: "No GenAI errors found in the selected timeframe." });
      return { success: true, toolName: "top_errors", summary: "No errors found — all clear!", blocks, dql, executionTimeMs: Date.now() - start };
    }

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Services with Errors", value: records.length, severity: records.length > 3 ? "critical" : "warning" },
        { label: "Total Errors", value: fmt(totalErrors), severity: totalErrors > 100 ? "critical" : "warning" },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Service", "Error Count", "Error Types", "Providers", "Models"],
      rows: records.map((r: any) => [
        String(r["dt.entity.service"] || "—"),
        fmt(Number(r.error_count || 0)),
        (r.error_types || []).join(", ") || "—",
        (r.providers || []).join(", ") || "—",
        (r.models || []).join(", ") || "—",
      ]),
    });

    return {
      success: true,
      toolName: "top_errors",
      summary: `${records.length} services with errors (${fmt(totalErrors)} total).`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Detect anomalies", query: "Are error rates anomalous?" },
        { label: "Service health", query: "Show overall service health" },
      ],
    };
  },
};

const costBreakdown: AgentTool = {
  name: "cost_breakdown",
  label: "Cost Breakdown",
  description: "Show AI spending breakdown by provider and model — estimated costs, token consumption, optimization opportunities",
  triggers: ["cost", "costs", "spending", "money", "expensive", "budget", "finops", "price", "billing", "how much"],
  examples: ["How much am I spending on AI?", "Cost breakdown by provider", "Which models are most expensive?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort total_tokens desc`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No token usage data found." });
      return { success: true, toolName: "cost_breakdown", summary: "No cost data.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    let totalCost = 0;
    let totalTokens = 0;
    const rows: string[][] = records.map((r: any) => {
      const provider = r["gen_ai.provider.name"] || "Unknown";
      const model = r["gen_ai.request.model"] || "Unknown";
      const inputTok = Number(r.input_tokens || 0);
      const outputTok = Number(r.output_tokens || 0);
      const tokens = Number(r.total_tokens || 0);
      const cost = estimateCost(provider, inputTok, outputTok);
      totalCost += cost;
      totalTokens += tokens;
      return [provider, model, fmt(Number(r.requests || 0)), fmt(inputTok), fmt(outputTok), fmt(tokens), `$${cost.toFixed(2)}`];
    });

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Total Estimated Cost", value: `$${totalCost.toFixed(2)}`, severity: totalCost > 100 ? "warning" : "healthy" },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Models in Use", value: records.length },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Provider", "Model", "Requests", "Input Tokens", "Output Tokens", "Total Tokens", "Est. Cost"],
      rows,
    });

    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Cost Distribution by Provider",
      data: records.reduce((acc: any[], r: any) => {
        const provider = r["gen_ai.provider.name"] || "Unknown";
        const cost = estimateCost(provider, Number(r.input_tokens || 0), Number(r.output_tokens || 0));
        const existing = acc.find(a => a.label === provider);
        if (existing) { existing.value += cost; } else { acc.push({ label: provider, value: cost }); }
        return acc;
      }, []),
      unit: "$",
    });

    return {
      success: true,
      toolName: "cost_breakdown",
      summary: `Estimated total cost: $${totalCost.toFixed(2)} across ${records.length} model configurations, ${fmt(totalTokens)} tokens.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Forecast cost", query: "Forecast my AI costs" },
        { label: "Cost optimization", query: "How can I reduce AI costs?" },
      ],
    };
  },
};

const latencyAnalysis: AgentTool = {
  name: "latency_analysis",
  label: "Latency Analysis",
  description: "Analyze latency across AI services — identify slow models, P50/P99 percentiles, SLA violations",
  triggers: ["latency", "slow", "speed", "fast", "response time", "performance", "p99", "p50", "sla", "timeout"],
  examples: ["Which services are slow?", "Show latency by model", "Are any services above SLA?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    p50_latency = percentile(duration, 50),
    p99_latency = percentile(duration, 99),
    max_latency = max(duration),
    slow_pct = toDouble(countIf(toLong(duration) > 3000000000)) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort avg_latency desc
| limit 15`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No latency data found." });
      return { success: true, toolName: "latency_analysis", summary: "No latency data.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    const slowModels = records.filter(r => Number(r.slow_pct || 0) > 10);
    blocks.push({
      type: "metric",
      metrics: [
        { label: "Models Analyzed", value: records.length },
        { label: "Slow Models (>10% slow)", value: slowModels.length, severity: slowModels.length > 0 ? "warning" : "healthy" },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "Avg", "P50", "P99", "Max", "Slow %"],
      rows: records.map((r: any) => [
        r["gen_ai.request.model"] || "—",
        r["gen_ai.provider.name"] || "—",
        fmt(Number(r.requests || 0)),
        `${nsToMs(Number(r.avg_latency || 0))}ms`,
        `${nsToMs(Number(r.p50_latency || 0))}ms`,
        `${nsToMs(Number(r.p99_latency || 0))}ms`,
        `${nsToMs(Number(r.max_latency || 0))}ms`,
        `${Number(r.slow_pct || 0).toFixed(1)}%`,
      ]),
    });

    return {
      success: true,
      toolName: "latency_analysis",
      summary: `Analyzed latency for ${records.length} models. ${slowModels.length} models have >10% slow requests.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Detect anomalies", query: "Are there latency anomalies?" },
        { label: "Forecast trend", query: "Forecast latency trends" },
      ],
    };
  },
};

const tokenUsage: AgentTool = {
  name: "token_usage",
  label: "Token Usage",
  description: "Show token consumption by service and model — input vs output tokens, efficiency metrics",
  triggers: ["token", "tokens", "usage", "consumption", "input tokens", "output tokens", "prompt tokens", "completion tokens"],
  examples: ["Show token usage", "Which service uses the most tokens?", "Token breakdown by model"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_output = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { dt.entity.service }
| sort input_tokens + output_tokens desc
| limit 15`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    const totalInput = records.reduce((s, r) => s + Number(r.input_tokens || 0), 0);
    const totalOutput = records.reduce((s, r) => s + Number(r.output_tokens || 0), 0);
    const ratio = totalOutput > 0 ? (totalInput / totalOutput).toFixed(1) : "—";

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Total Input Tokens", value: fmt(totalInput) },
        { label: "Total Output Tokens", value: fmt(totalOutput) },
        { label: "Input:Output Ratio", value: `${ratio}:1` },
      ],
    });

    if (records.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Service", "Requests", "Input Tokens", "Output Tokens", "Avg Input/Req", "Avg Output/Req"],
        rows: records.map((r: any) => [
          String(r["dt.entity.service"] || "—"),
          fmt(Number(r.requests || 0)),
          fmt(Number(r.input_tokens || 0)),
          fmt(Number(r.output_tokens || 0)),
          fmt(Number(r.avg_input || 0)),
          fmt(Number(r.avg_output || 0)),
        ]),
      });
    }

    return {
      success: true,
      toolName: "token_usage",
      summary: `Token usage: ${fmt(totalInput)} input + ${fmt(totalOutput)} output tokens (ratio ${ratio}:1).`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Forecast tokens", query: "Forecast token consumption" },
        { label: "Cost breakdown", query: "Show cost breakdown" },
      ],
    };
  },
};

// ============================================
// TIER 2 — ANALYZE (Dynatrace Intelligence)
// ============================================

const forecastTool: AgentTool = {
  name: "forecast",
  label: "Forecast",
  description: "Forecast token usage or AI costs using Dynatrace Intelligence GenericForecastAnalyzer — predict trends for next 24 hours",
  triggers: ["forecast", "predict", "projection", "future", "tomorrow", "next week", "trend", "will", "going to"],
  examples: ["Forecast my token usage", "Predict AI costs for next week", "Will my costs increase?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];
    const q = ctx.question.toLowerCase();
    const isCost = q.includes("cost") || q.includes("spend") || q.includes("money") || q.includes("budget");

    try {
      const result = isCost ? await forecastAICost(0) : await forecastTokenUsage();

      blocks.push({
        type: "analyzer",
        analyzerName: "GenericForecastAnalyzer",
        forecast: result,
      });

      if (result.success) {
        blocks.push({
          type: "metric",
          metrics: [
            { label: "Current Value", value: fmt(result.currentValue, 2) },
            { label: "Trend", value: result.trend, trend: result.trend === "increasing" ? "up" : result.trend === "decreasing" ? "down" : "stable" },
            { label: "Forecast Quality", value: result.forecastQuality, severity: result.forecastQuality === "good" ? "healthy" : "warning" },
          ],
        });

        if (result.forecastPoints.length > 0) {
          blocks.push({
            type: "chart",
            chartType: "timeseries",
            title: isCost ? "Cost Forecast (24h)" : "Token Usage Forecast (24h)",
            data: result.forecastPoints.map(p => ({
              label: new Date(p.timestamp).toLocaleTimeString(),
              value: p.value,
              timestamp: p.timestamp,
            })),
            unit: isCost ? "$" : "tokens",
          });
        }

        if (result.budgetBreachDay) {
          blocks.push({
            type: "alert",
            severity: "warning",
            title: "Budget Alert",
            message: `At current rate, budget threshold will be breached in ~${result.budgetBreachDay} days.`,
          });
        }
      } else {
        blocks.push({
          type: "alert",
          severity: "warning",
          title: "Forecast Unavailable",
          message: result.error || "Insufficient data for forecasting. Need at least 24 hours of data.",
        });
      }
    } catch (err) {
      blocks.push({
        type: "alert",
        severity: "warning",
        title: "Forecast Error",
        message: `Dynatrace Intelligence forecast failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }

    return {
      success: true,
      toolName: "forecast",
      summary: isCost ? "AI cost forecast analysis complete." : "Token usage forecast analysis complete.",
      blocks,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Cost breakdown", query: "Show current cost breakdown" },
        { label: "Detect anomalies", query: "Are there any anomalies?" },
      ],
    };
  },
};

const detectAnomalies: AgentTool = {
  name: "detect_anomalies",
  label: "Anomaly Detection",
  description: "Run Dynatrace Intelligence anomaly detection on GenAI metrics — auto-adaptive, seasonal baseline, and novelty scoring",
  triggers: ["anomaly", "anomalies", "spike", "unusual", "abnormal", "weird", "strange", "deviat", "unexpected", "change point"],
  examples: ["Are there anomalies in my AI services?", "Detect unusual patterns", "Has anything changed recently?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    try {
      const suite = await runGenAIAnalyzerSuite();

      // Token forecast
      if (suite.tokenForecast) {
        blocks.push({ type: "analyzer", analyzerName: "TokenForecast", forecast: suite.tokenForecast });
      }

      // Error rate anomaly
      if (suite.errorAnomaly) {
        blocks.push({ type: "analyzer", analyzerName: "ErrorRateAnomaly", anomaly: suite.errorAnomaly });
        if (suite.errorAnomaly.hasAnomaly) {
          blocks.push({
            type: "alert",
            severity: "critical",
            title: "Error Rate Anomaly Detected",
            message: suite.errorAnomaly.description,
          });
        }
      }

      // Latency novelty
      if (suite.latencyNovelty) {
        blocks.push({ type: "analyzer", analyzerName: "LatencyNovelty", novelty: suite.latencyNovelty });
        if (suite.latencyNovelty.noveltyScore > 0.5) {
          blocks.push({
            type: "alert",
            severity: "warning",
            title: "Latency Change Points Detected",
            message: suite.latencyNovelty.description,
          });
        }
      }

      // Summary
      const issues: string[] = [];
      if (suite.errorAnomaly?.hasAnomaly) issues.push("error rate anomaly");
      if (suite.latencyNovelty?.noveltyScore > 0.5) issues.push("latency change points");
      if (suite.tokenForecast?.trend === "increasing") issues.push("increasing token trend");

      if (issues.length === 0) {
        blocks.push({ type: "alert", severity: "success", title: "All Clear", message: "No anomalies detected across GenAI metrics." });
      }

      blocks.push({
        type: "metric",
        metrics: [
          { label: "Analyzers Run", value: Object.keys(suite).filter(k => suite[k as keyof typeof suite]).length },
          { label: "Issues Found", value: issues.length, severity: issues.length > 0 ? "warning" : "healthy" },
        ],
      });

      return {
        success: true,
        toolName: "detect_anomalies",
        summary: issues.length > 0
          ? `Detected ${issues.length} issue(s): ${issues.join(", ")}.`
          : "No anomalies detected — all GenAI metrics are within normal range.",
        blocks,
        executionTimeMs: Date.now() - start,
        followUps: issues.length > 0
          ? [{ label: "Service health", query: "Show service health" }, { label: "Error details", query: "Show error details" }]
          : [{ label: "Forecast", query: "Forecast token usage" }],
      };
    } catch (err) {
      blocks.push({
        type: "alert",
        severity: "warning",
        title: "Analyzer Error",
        message: `Dynatrace Intelligence analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      return { success: false, toolName: "detect_anomalies", summary: "Analysis failed.", blocks, executionTimeMs: Date.now() - start };
    }
  },
};

const errorInvestigation: AgentTool = {
  name: "error_investigation",
  label: "Error Root Cause",
  description: "Deep-dive into error patterns — correlate with deployments, rate limits, provider outages. Uses Dynatrace Intelligence for root cause analysis",
  triggers: ["investigate", "root cause", "why", "diagnose", "troubleshoot", "debug", "what happened", "why failing"],
  examples: ["Why is my OpenAI service failing?", "Investigate the error spike", "Root cause analysis"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    // Get error trends
    const errorDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR isNotNull(error.type)
| summarize error_count = count(), by: { bin(timestamp, 1h), gen_ai.provider.name }`;

    // Get recent errors with details
    const detailDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR isNotNull(error.type)
| fields timestamp, dt.entity.service, gen_ai.provider.name, gen_ai.request.model, error.type, span.status_code, duration
| sort timestamp desc
| limit 20`;

    const [trendRecords, detailRecords] = await Promise.all([
      executeDql(errorDql),
      executeDql(detailDql),
    ]);

    if (detailRecords.length === 0) {
      blocks.push({ type: "alert", severity: "success", title: "No Errors", message: "No errors found to investigate." });
      return { success: true, toolName: "error_investigation", summary: "No errors found.", blocks, executionTimeMs: Date.now() - start };
    }

    // Error trend chart
    if (trendRecords.length > 0) {
      const providerErrors = new Map<string, number>();
      trendRecords.forEach((r: any) => {
        const p = r["gen_ai.provider.name"] || "Unknown";
        providerErrors.set(p, (providerErrors.get(p) || 0) + Number(r.error_count || 0));
      });
      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Errors by Provider",
        data: Array.from(providerErrors.entries()).map(([label, value]) => ({ label, value })),
        unit: "errors",
      });
    }

    // Recent error details
    blocks.push({
      type: "table",
      headers: ["Time", "Service", "Provider", "Model", "Error Type", "Latency"],
      rows: detailRecords.slice(0, 10).map((r: any) => [
        r.timestamp ? new Date(r.timestamp).toLocaleString() : "—",
        String(r["dt.entity.service"] || "—"),
        r["gen_ai.provider.name"] || "—",
        r["gen_ai.request.model"] || "—",
        r["error.type"] || r["span.status_code"] || "—",
        `${nsToMs(Number(r.duration || 0))}ms`,
      ]),
      caption: "Recent errors (latest 10)",
    });

    // Run anomaly detection on error rate
    try {
      const anomaly = await detectErrorRateAnomaly();
      if (anomaly.hasAnomaly) {
        blocks.push({
          type: "alert",
          severity: "critical",
          title: "Anomalous Error Rate",
          message: anomaly.description,
        });
      }
      blocks.push({ type: "analyzer", analyzerName: "ErrorRateAnomaly", anomaly });
    } catch {
      // Analyzer optional
    }

    return {
      success: true,
      toolName: "error_investigation",
      summary: `Found ${detailRecords.length} recent errors. Investigation complete.`,
      blocks,
      dql: detailDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Service health", query: "Show service health" },
        { label: "Provider comparison", query: "Compare provider reliability" },
      ],
    };
  },
};

// ============================================
// TIER 3 — ACT (Recommendations)
// ============================================

const costOptimization: AgentTool = {
  name: "cost_optimization",
  label: "Cost Optimization",
  description: "AI-powered cost optimization recommendations — identify prompt bloat, suggest cheaper models, detect waste",
  triggers: ["optimize", "optimization", "reduce cost", "save money", "cheaper", "efficient", "waste", "prompt bloat"],
  examples: ["How can I reduce AI costs?", "Optimization recommendations", "Find cost waste"],
  parameters: [],
  tier: 3,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_input = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_output = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_input = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    low_output_pct = toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0 AND coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 10)) / toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0)) * 100.0,
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort total_input desc`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];
    const recommendations: string[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No usage data for optimization analysis." });
      return { success: true, toolName: "cost_optimization", summary: "No data for optimization.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    // Analyze each model for optimization opportunities
    records.forEach((r: any) => {
      const model = r["gen_ai.request.model"] || "Unknown";
      const provider = r["gen_ai.provider.name"] || "Unknown";
      const avgInput = Number(r.avg_input || 0);
      const lowOutput = Number(r.low_output_pct || 0);
      const errorRate = Number(r.error_rate || 0);

      if (avgInput > 2000) {
        recommendations.push(`**${model}** (${provider}): High avg input tokens (${fmt(avgInput)}). Consider prompt compression or caching.`);
      }
      if (lowOutput > 20) {
        recommendations.push(`**${model}** (${provider}): ${lowOutput.toFixed(0)}% of responses have minimal output — potential wasted calls.`);
      }
      if (errorRate > 10) {
        recommendations.push(`**${model}** (${provider}): ${errorRate.toFixed(1)}% error rate — failed requests waste tokens.`);
      }

      // Suggest cheaper alternatives
      const m = model.toLowerCase();
      if (m.includes("gpt-4") && !m.includes("mini")) {
        recommendations.push(`**${model}**: Consider gpt-4o-mini for non-critical tasks — up to 90% cost reduction.`);
      }
      if (m.includes("claude-3-opus")) {
        recommendations.push(`**${model}**: Consider claude-3-haiku or claude-3.5-sonnet for routine tasks.`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push("No major optimization opportunities detected. Your AI usage appears efficient.");
    }

    blocks.push({
      type: "text",
      content: "### Optimization Recommendations\n\n" + recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    });

    // Show current usage table
    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "Avg Input Tokens", "Avg Output Tokens", "Low Output %", "Error Rate"],
      rows: records.map((r: any) => [
        r["gen_ai.request.model"] || "—",
        r["gen_ai.provider.name"] || "—",
        fmt(Number(r.requests || 0)),
        fmt(Number(r.avg_input || 0)),
        fmt(Number(r.avg_output || 0)),
        `${Number(r.low_output_pct || 0).toFixed(1)}%`,
        `${Number(r.error_rate || 0).toFixed(1)}%`,
      ]),
    });

    return {
      success: true,
      toolName: "cost_optimization",
      summary: `Generated ${recommendations.length} optimization recommendation(s).`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Cost breakdown", query: "Show cost breakdown" },
        { label: "Forecast cost", query: "Forecast AI costs" },
      ],
    };
  },
};

const executiveSummary: AgentTool = {
  name: "executive_summary",
  label: "Executive Summary",
  description: "Generate an executive-level summary of GenAI operations — health, cost, performance, and key recommendations",
  triggers: ["executive", "summary", "report", "brief", "tldr", "overall", "everything", "full report"],
  examples: ["Give me an executive summary", "Summarize everything", "What should I know?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Run multiple queries in parallel
    const [healthRecords, errorRecords, costRecords] = await Promise.all([
      executeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize requests = count(), avg_latency = avg(duration), error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0, tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { dt.entity.service }
| sort requests desc`),
      executeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)) AND (span.status_code == "error" OR isNotNull(error.type))
| summarize error_count = count(), by: { gen_ai.provider.name }`),
      executeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)), output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { gen_ai.provider.name }`),
    ]);

    const blocks: MessageBlock[] = [];

    const totalServices = healthRecords.length;
    const totalRequests = healthRecords.reduce((s, r) => s + Number(r.requests || 0), 0);
    const totalTokens = healthRecords.reduce((s, r) => s + Number(r.tokens || 0), 0);
    const avgError = healthRecords.length > 0
      ? healthRecords.reduce((s, r) => s + Number(r.error_rate || 0), 0) / healthRecords.length
      : 0;
    const avgLatency = healthRecords.length > 0
      ? healthRecords.reduce((s, r) => s + Number(r.avg_latency || 0), 0) / healthRecords.length
      : 0;
    const criticalServices = healthRecords.filter(r => Number(r.error_rate || 0) > 5).length;

    let totalCost = 0;
    costRecords.forEach((r: any) => {
      totalCost += estimateCost(r["gen_ai.provider.name"] || "", Number(r.input_tokens || 0), Number(r.output_tokens || 0));
    });
    const totalErrors = errorRecords.reduce((s, r) => s + Number(r.error_count || 0), 0);

    // KPI Dashboard
    blocks.push({
      type: "metric",
      metrics: [
        { label: "AI Services", value: totalServices, severity: "healthy" },
        { label: "Total Requests", value: fmt(totalRequests) },
        { label: "Error Rate", value: `${avgError.toFixed(1)}%`, severity: avgError > 5 ? "critical" : avgError > 1 ? "warning" : "healthy" },
        { label: "Avg Latency", value: `${nsToMs(avgLatency)}ms`, severity: avgLatency > 3e9 ? "warning" : "healthy" },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Est. Cost", value: `$${totalCost.toFixed(2)}` },
      ],
    });

    // Status alerts
    if (criticalServices > 0) {
      blocks.push({
        type: "alert",
        severity: "critical",
        title: `${criticalServices} Service(s) in Critical State`,
        message: `${criticalServices} of ${totalServices} services have error rates above 5%.`,
      });
    }

    if (totalErrors > 0) {
      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Errors by Provider",
        data: errorRecords.map((r: any) => ({
          label: r["gen_ai.provider.name"] || "Unknown",
          value: Number(r.error_count || 0),
        })),
        unit: "errors",
      });
    }

    // Timestamp
    blocks.push({
      type: "text",
      content: `*Report generated at ${new Date().toLocaleString()} — timeframe: last ${ctx.timeframe}*`,
    });

    return {
      success: true,
      toolName: "executive_summary",
      summary: `Executive Summary: ${totalServices} services, ${fmt(totalRequests)} requests, ${avgError.toFixed(1)}% error rate, $${totalCost.toFixed(2)} estimated cost.`,
      blocks,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Deep-dive errors", query: "Investigate errors" },
        { label: "Optimize costs", query: "How can I reduce costs?" },
        { label: "Forecast", query: "Forecast trends" },
      ],
    };
  },
};

// ============================================
// TOOL REGISTRY
// ============================================

export const TOOL_REGISTRY: AgentTool[] = [
  // Tier 1 — Observe
  serviceHealth,
  providerComparison,
  modelComparison,
  topErrors,
  costBreakdown,
  latencyAnalysis,
  tokenUsage,
  // Tier 2 — Analyze (Dynatrace Intelligence)
  forecastTool,
  detectAnomalies,
  errorInvestigation,
  executiveSummary,
  // Tier 3 — Act
  costOptimization,
];
