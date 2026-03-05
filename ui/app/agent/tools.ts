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
  try {
    const response = await queryExecutionClient.queryExecute({
      body: {
        query,
        requestTimeoutMilliseconds: 60000,
        fetchTimeoutSeconds: 60,
      },
    });
    return response.result?.records || [];
  } catch (err) {
    console.warn("[Tools] DQL query failed (gracefully returning []):", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Alias for executeDql — both are now safe (return [] on failure) */
const safeDql = executeDql;

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
      safeDql(errorDql),
      safeDql(detailDql),
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
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize requests = count(), avg_latency = avg(duration), error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0, tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { dt.entity.service }
| sort requests desc`),
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)) AND (span.status_code == "error" OR isNotNull(error.type))
| summarize error_count = count(), by: { gen_ai.provider.name }`),
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
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
// TIER 1 — OBSERVE (Inventory & Discovery)
// ============================================

const inventoryOverview: AgentTool = {
  name: "inventory_overview",
  label: "Inventory Overview",
  description: "Show a high-level inventory of all GenAI assets — total services, providers, models, agents, and request volumes",
  triggers: ["inventory", "how many", "count", "total", "assets", "what do i have", "landscape", "footprint", "discovery"],
  examples: ["How many agents do I have?", "What's my GenAI inventory?", "How many models am I using?", "Show me my AI landscape"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    services = countDistinct(dt.entity.service),
    providers = countDistinct(gen_ai.provider.name),
    models = countDistinct(gen_ai.request.model),
    span_types = countDistinct(span.name),
    agent_tasks = countIf(span.name == "agent.task"),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    provider_list = collectDistinct(gen_ai.provider.name),
    model_list = collectDistinct(gen_ai.request.model),
    service_list = collectDistinct(dt.entity.service),
    span_name_list = collectDistinct(span.name)
  }`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];
    const r = records[0] || {};

    const totalReqs = Number(r.total_requests || 0);
    const services = Number(r.services || 0);
    const providers = Number(r.providers || 0);
    const models = Number(r.models || 0);
    const agentTasks = Number(r.agent_tasks || 0);
    const totalTokens = Number(r.total_tokens || 0);
    const errorCount = Number(r.error_count || 0);
    const errorRate = totalReqs > 0 ? (errorCount / totalReqs * 100) : 0;
    const providerList: string[] = r.provider_list || [];
    const modelList: string[] = r.model_list || [];
    const serviceList: string[] = r.service_list || [];
    const spanNameList: string[] = r.span_name_list || [];

    if (totalReqs === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No GenAI Data", message: "No gen_ai spans found in the selected timeframe. Ensure services are instrumented with OpenTelemetry gen_ai.* attributes." });
      return { success: true, toolName: "inventory_overview", summary: "No GenAI data found.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    // KPI hero row
    blocks.push({
      type: "metric",
      metrics: [
        { label: "AI Services", value: services, severity: "healthy" },
        { label: "Providers", value: providers, severity: "healthy" },
        { label: "Models", value: models, severity: "healthy" },
        { label: "Agent Tasks", value: fmt(agentTasks), severity: agentTasks > 0 ? "healthy" : "warning" },
        { label: "Total Requests", value: fmt(totalReqs) },
        { label: "Error Rate", value: `${errorRate.toFixed(1)}%`, severity: errorRate > 5 ? "critical" : errorRate > 1 ? "warning" : "healthy" },
        { label: "Total Tokens", value: fmt(totalTokens) },
      ],
    });

    // Breakdown text
    const providerSummary = providerList.length > 0 ? providerList.join(", ") : "None detected";
    const modelSummary = modelList.length > 6 ? `${modelList.slice(0, 6).join(", ")} and ${modelList.length - 6} more` : modelList.join(", ");
    const spanSummary = spanNameList.join(", ");

    blocks.push({
      type: "text",
      content: `### GenAI Landscape Summary\n\n` +
        `**Services:** ${serviceList.join(", ")}\n\n` +
        `**Providers:** ${providerSummary}\n\n` +
        `**Models (${models}):** ${modelSummary}\n\n` +
        `**Span Types:** ${spanSummary}\n\n` +
        (agentTasks > 0
          ? `**Agents:** Detected **${fmt(agentTasks)} agent task executions** via Langchain agent.task spans.\n\n`
          : `**Agents:** No agent.task spans detected in this timeframe.\n\n`) +
        `*Timeframe: last ${ctx.timeframe}*`,
    });

    // Pie chart of requests by provider
    const providerDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize requests = count(), by: { gen_ai.provider.name }
| sort requests desc`;
    const providerRecords = await executeDql(providerDql);
    if (providerRecords.length > 0) {
      blocks.push({
        type: "chart",
        chartType: "pie",
        title: "Request Distribution by Provider",
        data: providerRecords.map((pr: any) => ({
          label: pr["gen_ai.provider.name"] || "Unknown",
          value: Number(pr.requests || 0),
        })),
        unit: "requests",
      });
    }

    return {
      success: true,
      toolName: "inventory_overview",
      summary: `GenAI Inventory: ${services} services, ${providers} providers, ${models} models, ${fmt(agentTasks)} agent tasks, ${fmt(totalReqs)} total requests in the last ${ctx.timeframe}.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Agent details", query: "Tell me more about my AI agents" },
        { label: "Model details", query: "List all models with usage stats" },
        { label: "Provider comparison", query: "Compare all my AI providers" },
        { label: "Service health", query: "How healthy are my AI services?" },
      ],
    };
  },
};

const agentOverview: AgentTool = {
  name: "agent_overview",
  label: "Agent Overview",
  description: "Show AI agent activity — agent task executions, frameworks (Langchain, etc.), tool usage, and agent performance",
  triggers: ["agent", "agents", "agentic", "langchain", "agent task", "tool usage", "chain", "rag", "orchestration", "workflow"],
  examples: ["How many agents do I have?", "Tell me about my AI agents", "Show agent activity", "What Langchain agents are running?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Query 1: Agent task overview
    const agentDql = `fetch spans, from:now()-${ctx.timeframe}
| filter span.name == "agent.task" OR gen_ai.provider.name == "Langchain"
| summarize {
    executions = count(),
    avg_duration = avg(duration),
    p95_duration = percentile(duration, 95),
    max_duration = max(duration),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    services = collectDistinct(dt.entity.service),
    models = collectDistinct(gen_ai.request.model)
  }, by: { span.name }
| sort executions desc`;

    // Query 2: Agent activity timeseries (for chart)
    const trendDql = `fetch spans, from:now()-${ctx.timeframe}
| filter span.name == "agent.task" OR gen_ai.provider.name == "Langchain"
| summarize executions = count(), by: { bin(timestamp, 1h) }
| sort timestamp asc`;

    // Query 3: Models used by agents
    const agentModelsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter gen_ai.provider.name == "Langchain"
| summarize requests = count(), avg_latency = avg(duration), tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { gen_ai.request.model }
| sort requests desc
| limit 10`;

    // Execute queries with graceful fallback — trend query can fail on some Grail versions
    const [agentResult, trendResult, modelResult] = await Promise.allSettled([
      executeDql(agentDql),
      executeDql(trendDql),
      executeDql(agentModelsDql),
    ]);

    const agentRecords = agentResult.status === "fulfilled" ? agentResult.value : [];
    const trendRecords = trendResult.status === "fulfilled" ? trendResult.value : [];
    const modelRecords = modelResult.status === "fulfilled" ? modelResult.value : [];

    const blocks: MessageBlock[] = [];

    if (agentRecords.length === 0 && modelRecords.length === 0) {
      blocks.push({
        type: "alert",
        severity: "info",
        title: "No Agent Activity",
        message: "No agent.task spans or Langchain provider data found. Agents may not be instrumented, or no agent activity occurred in this timeframe.",
      });
      blocks.push({
        type: "text",
        content: "**Tip:** To see agent data, ensure your Langchain / LangGraph agents are instrumented with OpenTelemetry gen_ai semantic conventions. The `agent.task` span name is used to track agentic executions.",
      });
      return { success: true, toolName: "agent_overview", summary: "No agent activity found.", blocks, dql: agentDql, executionTimeMs: Date.now() - start };
    }

    // KPIs
    const totalExecutions = agentRecords.reduce((s, r) => s + Number(r.executions || 0), 0);
    const totalErrors = agentRecords.reduce((s, r) => s + Number(r.error_count || 0), 0);
    const errorRate = totalExecutions > 0 ? (totalErrors / totalExecutions * 100) : 0;
    const avgDuration = agentRecords.length > 0
      ? agentRecords.reduce((s, r) => s + Number(r.avg_duration || 0), 0) / agentRecords.length : 0;

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Agent Executions", value: fmt(totalExecutions), severity: "healthy" },
        { label: "Span Types", value: agentRecords.length },
        { label: "Avg Duration", value: `${nsToMs(avgDuration)}ms` },
        { label: "Error Rate", value: `${errorRate.toFixed(1)}%`, severity: errorRate > 5 ? "critical" : errorRate > 1 ? "warning" : "healthy" },
        { label: "Models Used", value: modelRecords.length },
      ],
    });

    // Agent span breakdown table
    blocks.push({
      type: "table",
      headers: ["Span Type", "Executions", "Avg Duration", "P95 Duration", "Errors", "Services", "Models"],
      rows: agentRecords.map((r: any) => [
        r["span.name"] || "—",
        fmt(Number(r.executions || 0)),
        `${nsToMs(Number(r.avg_duration || 0))}ms`,
        `${nsToMs(Number(r.p95_duration || 0))}ms`,
        fmt(Number(r.error_count || 0)),
        (r.services || []).join(", ") || "—",
        (r.models || []).filter(Boolean).join(", ") || "—",
      ]),
      caption: "Agent span activity breakdown",
    });

    // Models used by agents
    if (modelRecords.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Model", "Requests", "Avg Latency", "Tokens"],
        rows: modelRecords.map((r: any) => [
          r["gen_ai.request.model"] || "—",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          fmt(Number(r.tokens || 0)),
        ]),
        caption: "Models used by Langchain agents",
      });
    }

    // Trend chart
    if (trendRecords.length > 1) {
      blocks.push({
        type: "chart",
        chartType: "timeseries",
        title: "Agent Activity Over Time",
        data: trendRecords.map((r: any) => ({
          label: "Agent Executions",
          value: Number(r.executions || 0),
          timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : undefined,
        })),
        unit: "executions",
      });
    }

    return {
      success: true,
      toolName: "agent_overview",
      summary: `Agent Activity: ${fmt(totalExecutions)} executions across ${agentRecords.length} span types, ${modelRecords.length} models, ${errorRate.toFixed(1)}% error rate.`,
      blocks,
      dql: agentDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Agent errors", query: "What errors are my agents encountering?" },
        { label: "Model comparison", query: "Compare the models my agents are using" },
        { label: "Full inventory", query: "Show my complete GenAI inventory" },
      ],
    };
  },
};

const modelInventory: AgentTool = {
  name: "model_inventory",
  label: "Model Inventory",
  description: "List all LLM models in use with request counts, providers, token usage, latency, and error rates",
  triggers: ["list models", "what models", "which models", "model list", "model inventory", "all models", "models in use", "model catalog"],
  examples: ["What models am I using?", "List all my models", "Which LLMs are deployed?", "Show model catalog"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    services = collectDistinct(dt.entity.service)
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Models Found", message: "No model data found in the selected timeframe." });
      return { success: true, toolName: "model_inventory", summary: "No models found.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    const totalModels = records.length;
    const totalRequests = records.reduce((s, r) => s + Number(r.requests || 0), 0);
    const totalTokens = records.reduce((s, r) => s + Number(r.total_tokens || 0), 0);

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Unique Models", value: totalModels, severity: "healthy" },
        { label: "Total Requests", value: fmt(totalRequests) },
        { label: "Total Tokens", value: fmt(totalTokens) },
      ],
    });

    // Full model table
    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "% of Total", "Avg Latency", "P95 Latency", "Tokens", "Error Rate", "Services"],
      rows: records.map((r: any) => {
        const reqs = Number(r.requests || 0);
        const pct = totalRequests > 0 ? (reqs / totalRequests * 100) : 0;
        return [
          r["gen_ai.request.model"] || "—",
          r["gen_ai.provider.name"] || "—",
          fmt(reqs),
          `${pct.toFixed(1)}%`,
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${nsToMs(Number(r.p95_latency || 0))}ms`,
          fmt(Number(r.total_tokens || 0)),
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          String((r.services || []).length),
        ];
      }),
      caption: `${totalModels} models discovered across all providers`,
    });

    // Bar chart of requests by model (top 10)
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Requests by Model",
      data: records.slice(0, 10).map((r: any) => ({
        label: r["gen_ai.request.model"] || "Unknown",
        value: Number(r.requests || 0),
      })),
      unit: "requests",
    });

    return {
      success: true,
      toolName: "model_inventory",
      summary: `Found ${totalModels} models: ${fmt(totalRequests)} total requests, ${fmt(totalTokens)} tokens consumed.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Compare models", query: "Compare model performance" },
        { label: "Model costs", query: "Show cost breakdown by model" },
        { label: "Optimize models", query: "How can I optimize my model usage?" },
      ],
    };
  },
};

const providerInventory: AgentTool = {
  name: "provider_inventory",
  label: "Provider Inventory",
  description: "List all AI providers in use with service counts, model counts, request volumes, and health status",
  triggers: ["list providers", "what providers", "which providers", "provider list", "provider inventory", "all providers", "vendors"],
  examples: ["What providers am I using?", "List all my AI providers", "Which AI vendors do I have?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    models = collectDistinct(gen_ai.request.model),
    services = collectDistinct(dt.entity.service),
    span_types = collectDistinct(span.name)
  }, by: { gen_ai.provider.name }
| sort requests desc`;

    const records = await executeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Providers", message: "No provider data found." });
      return { success: true, toolName: "provider_inventory", summary: "No providers found.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Providers", value: records.length, severity: "healthy" },
        { label: "Total Requests", value: fmt(records.reduce((s, r) => s + Number(r.requests || 0), 0)) },
        { label: "Total Tokens", value: fmt(records.reduce((s, r) => s + Number(r.total_tokens || 0), 0)) },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Provider", "Requests", "Models", "Services", "Avg Latency", "Error Rate", "Tokens", "Est. Cost", "Capabilities"],
      rows: records.map((r: any) => {
        const provider = r["gen_ai.provider.name"] || "Unknown";
        const modelCount = (r.models || []).length;
        const serviceCount = (r.services || []).length;
        const cost = estimateCost(provider, Number(r.input_tokens || 0), Number(r.output_tokens || 0));
        const spanTypes = (r.span_types || []).join(", ");
        return [
          provider,
          fmt(Number(r.requests || 0)),
          String(modelCount),
          String(serviceCount),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          fmt(Number(r.total_tokens || 0)),
          `$${cost.toFixed(2)}`,
          spanTypes || "—",
        ];
      }),
      caption: `${records.length} AI providers discovered`,
    });

    // Pie chart — token distribution
    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Token Usage by Provider",
      data: records.map((r: any) => ({
        label: r["gen_ai.provider.name"] || "Unknown",
        value: Number(r.total_tokens || 0),
      })),
      unit: "tokens",
    });

    return {
      success: true,
      toolName: "provider_inventory",
      summary: `Found ${records.length} providers: ${records.map((r: any) => r["gen_ai.provider.name"]).filter(Boolean).join(", ")}.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Compare providers", query: "Compare provider performance" },
        { label: "Provider costs", query: "Show cost breakdown by provider" },
        { label: "Full inventory", query: "Show my complete GenAI inventory" },
      ],
    };
  },
};

const usageTrends: AgentTool = {
  name: "usage_trends",
  label: "Usage Trends",
  description: "Show GenAI usage trends over time — request volume, token consumption, error rates, and latency trends",
  triggers: ["trend", "trends", "over time", "timeline", "history", "growing", "increasing", "decreasing", "pattern", "volume", "traffic", "throughput"],
  examples: ["What are the usage trends?", "Show me traffic patterns", "How has usage changed?", "Is my AI usage growing?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Determine bucketization based on timeframe
    const tf = ctx.timeframe;
    const bucket = tf.includes("30m") || tf.includes("1h") ? "5m"
      : tf.includes("2h") || tf.includes("6h") ? "15m"
      : tf.includes("12h") || tf.includes("24h") || tf.includes("1d") ? "1h"
      : "4h";

    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    providers = countDistinct(gen_ai.provider.name)
  }, by: { bin(timestamp, ${bucket}) }
| sort timestamp asc`;

    // Also get per-provider trends
    const providerTrendDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize requests = count(), by: { gen_ai.provider.name, bin(timestamp, ${bucket}) }
| sort timestamp asc`;

    const [records, providerTrendRecords] = await Promise.all([
      safeDql(dql),
      safeDql(providerTrendDql),
    ]);

    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Trend Data", message: "No data to show trends for the selected timeframe." });
      return { success: true, toolName: "usage_trends", summary: "No trend data available.", blocks, dql, executionTimeMs: Date.now() - start };
    }

    // Compute overall trend direction
    const firstHalf = records.slice(0, Math.floor(records.length / 2));
    const secondHalf = records.slice(Math.floor(records.length / 2));
    const firstAvg = firstHalf.reduce((s, r) => s + Number(r.requests || 0), 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((s, r) => s + Number(r.requests || 0), 0) / (secondHalf.length || 1);
    const trendDirection = secondAvg > firstAvg * 1.1 ? "up" : secondAvg < firstAvg * 0.9 ? "down" : "stable";
    const changePct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg * 100) : 0;

    const totalReqs = records.reduce((s, r) => s + Number(r.requests || 0), 0);
    const totalTokens = records.reduce((s, r) => s + Number(r.tokens || 0), 0);
    const totalErrors = records.reduce((s, r) => s + Number(r.errors || 0), 0);
    const peakRequests = Math.max(...records.map((r: any) => Number(r.requests || 0)));

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Total Requests", value: fmt(totalReqs) },
        { label: "Trend", value: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`, trend: trendDirection as "up" | "down" | "stable" },
        { label: "Peak Requests", value: `${fmt(peakRequests)}/${bucket}` },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Total Errors", value: fmt(totalErrors), severity: totalErrors > 0 ? "warning" : "healthy" },
        { label: "Data Points", value: records.length },
      ],
    });

    // Request volume timeseries
    blocks.push({
      type: "chart",
      chartType: "timeseries",
      title: "Request Volume Over Time",
      data: records.map((r: any) => ({
        label: "Requests",
        value: Number(r.requests || 0),
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : undefined,
      })),
      unit: "requests",
      dql,
    });

    // Token consumption timeseries
    blocks.push({
      type: "chart",
      chartType: "timeseries",
      title: "Token Consumption Over Time",
      data: records.map((r: any) => ({
        label: "Tokens",
        value: Number(r.tokens || 0),
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : undefined,
      })),
      unit: "tokens",
    });

    // Insight text
    const trendText = trendDirection === "up" ? "📈 **Increasing** usage trend detected"
      : trendDirection === "down" ? "📉 **Decreasing** usage trend detected"
      : "➡️ **Stable** usage pattern";

    blocks.push({
      type: "text",
      content: `${trendText} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% change, comparing first vs second half of the window). ` +
        `Peak activity: **${fmt(peakRequests)} requests** per ${bucket} bucket.`,
    });

    return {
      success: true,
      toolName: "usage_trends",
      summary: `Usage Trends: ${trendText.replace(/[📈📉➡️*]/g, '').trim()}, ${fmt(totalReqs)} total requests, peak ${fmt(peakRequests)}/${bucket}.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Forecast", query: "Forecast my usage for the next 24 hours" },
        { label: "Anomalies", query: "Are there any anomalies in the trends?" },
        { label: "Cost trends", query: "Show cost breakdown over time" },
      ],
    };
  },
};

const generalQA: AgentTool = {
  name: "general_qa",
  label: "General Q&A",
  description: "Answer general questions about GenAI operations when no specific tool matches — runs a broad data scan and produces a helpful summary",
  triggers: ["what", "tell me", "explain", "describe", "info", "information", "about", "detail", "details", "help", "question"],
  examples: ["Tell me about my GenAI setup", "What can you tell me about my AI operations?", "Give me some details"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Run a comprehensive scan
    const [inventoryRecords, topModelsRecords, errorRecords] = await Promise.all([
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    services = countDistinct(dt.entity.service),
    providers = countDistinct(gen_ai.provider.name),
    models = countDistinct(gen_ai.request.model),
    agent_tasks = countIf(span.name == "agent.task"),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_latency = avg(duration),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    provider_list = collectDistinct(gen_ai.provider.name)
  }`),
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.request.model)
| summarize requests = count(), by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc
| limit 5`),
      safeDql(`fetch spans, from:now()-${ctx.timeframe}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)) AND (span.status_code == "error" OR isNotNull(error.type))
| summarize error_count = count(), by: { gen_ai.provider.name }
| sort error_count desc
| limit 5`),
    ]);

    const blocks: MessageBlock[] = [];
    const inv = inventoryRecords[0] || {};

    const totalReqs = Number(inv.total_requests || 0);
    const services = Number(inv.services || 0);
    const providers = Number(inv.providers || 0);
    const models = Number(inv.models || 0);
    const agentTasks = Number(inv.agent_tasks || 0);
    const totalTokens = Number(inv.total_tokens || 0);
    const avgLatency = Number(inv.avg_latency || 0);
    const errorRate = Number(inv.error_rate || 0);
    const providerList: string[] = inv.provider_list || [];

    if (totalReqs === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No GenAI Data", message: "No gen_ai spans found. Ensure your services are instrumented with OpenTelemetry gen_ai.* attributes." });
      return { success: true, toolName: "general_qa", summary: "No GenAI data found.", blocks, executionTimeMs: Date.now() - start };
    }

    // Hero KPIs
    blocks.push({
      type: "metric",
      metrics: [
        { label: "Services", value: services, severity: "healthy" },
        { label: "Providers", value: providers, severity: "healthy" },
        { label: "Models", value: models, severity: "healthy" },
        { label: "Agents", value: fmt(agentTasks), severity: agentTasks > 0 ? "healthy" : "warning" },
        { label: "Requests", value: fmt(totalReqs) },
        { label: "Error Rate", value: `${errorRate.toFixed(1)}%`, severity: errorRate > 5 ? "critical" : errorRate > 1 ? "warning" : "healthy" },
      ],
    });

    // Natural language summary
    let nlSummary = `### Your GenAI Environment at a Glance\n\n`;
    nlSummary += `You have **${services} AI service(s)** running across **${providers} provider(s)** (${providerList.join(", ")}), using **${models} different model(s)**.\n\n`;
    nlSummary += `In the last **${ctx.timeframe}**, there were **${fmt(totalReqs)} total requests** consuming **${fmt(totalTokens)} tokens** with an average latency of **${nsToMs(avgLatency)}ms**.\n\n`;

    if (agentTasks > 0) {
      nlSummary += `🤖 **Agent Activity:** ${fmt(agentTasks)} agent task executions detected (Langchain framework).\n\n`;
    }

    if (errorRate > 5) {
      nlSummary += `🔴 **Attention:** Error rate is at **${errorRate.toFixed(1)}%** — consider investigating failing services.\n\n`;
    } else if (errorRate > 1) {
      nlSummary += `🟡 Error rate is **${errorRate.toFixed(1)}%** — within tolerable range but worth monitoring.\n\n`;
    } else {
      nlSummary += `✅ Error rate is a healthy **${errorRate.toFixed(1)}%**.\n\n`;
    }

    // Top models
    if (topModelsRecords.length > 0) {
      nlSummary += `**Top Models by Usage:**\n`;
      topModelsRecords.forEach((r: any, i: number) => {
        nlSummary += `${i + 1}. **${r["gen_ai.request.model"] || "Unknown"}** (${r["gen_ai.provider.name"] || "—"}) — ${fmt(Number(r.requests || 0))} requests\n`;
      });
      nlSummary += `\n`;
    }

    // Error breakdown
    if (errorRecords.length > 0) {
      nlSummary += `**Errors by Provider:**\n`;
      errorRecords.forEach((r: any) => {
        nlSummary += `- ${r["gen_ai.provider.name"] || "Unknown"}: ${fmt(Number(r.error_count || 0))} errors\n`;
      });
    }

    blocks.push({ type: "text", content: nlSummary });

    return {
      success: true,
      toolName: "general_qa",
      summary: `GenAI Overview: ${services} services, ${providers} providers, ${models} models, ${fmt(totalReqs)} requests, ${errorRate.toFixed(1)}% error rate.`,
      blocks,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Deep dive health", query: "How healthy are my AI services?" },
        { label: "Cost analysis", query: "How much is my AI usage costing?" },
        { label: "Agent details", query: "Tell me about my AI agents" },
        { label: "Anomaly detection", query: "Are there any anomalies?" },
        { label: "Model details", query: "List all models with usage stats" },
        { label: "Forecast", query: "Forecast my AI usage trends" },
      ],
    };
  },
};

// ============================================
// TIER 1 — OBSERVE (Embedding & RAG)
// ============================================

const embeddingAnalytics: AgentTool = {
  name: "embedding_analytics",
  label: "Embedding Analytics",
  description: "Analyze embedding operations — models, providers, throughput, latency, token usage, and error rates for vector embedding calls",
  triggers: ["embedding", "embeddings", "embed", "vector", "vectorize", "text-embedding", "ada", "embedding model", "embedding latency", "embedding cost"],
  examples: ["How are my embeddings performing?", "Show embedding usage", "Which embedding models am I using?", "Embedding latency breakdown"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Query 1: Per-model embedding breakdown
    const modelDql = `fetch spans, from:now()-${ctx.timeframe}
| filter contains(span.name, "embed")
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    services = collectDistinct(dt.entity.service)
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc`;

    // Query 2: Overall embedding KPIs
    const overviewDql = `fetch spans, from:now()-${ctx.timeframe}
| filter contains(span.name, "embed")
| summarize {
    total_requests = count(),
    providers = countDistinct(gen_ai.provider.name),
    models = countDistinct(gen_ai.request.model),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    provider_list = collectDistinct(gen_ai.provider.name),
    span_types = collectDistinct(span.name)
  }`;

    // Query 3: Embedding throughput over time
    const trendDql = `fetch spans, from:now()-${ctx.timeframe}
| filter contains(span.name, "embed")
| summarize requests = count(), tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)), by: { bin(timestamp, 1h) }
| sort timestamp asc`;

    const [modelRecords, overviewRecords, trendRecords] = await Promise.all([
      safeDql(modelDql),
      safeDql(overviewDql),
      safeDql(trendDql),
    ]);

    const blocks: MessageBlock[] = [];
    const ov = overviewRecords[0] || {};

    const totalReqs = Number(ov.total_requests || 0);
    const providers = Number(ov.providers || 0);
    const models = Number(ov.models || 0);
    const totalTokens = Number(ov.total_tokens || 0);
    const avgLatency = Number(ov.avg_latency || 0);
    const p95Latency = Number(ov.p95_latency || 0);
    const errorCount = Number(ov.error_count || 0);
    const errorRate = totalReqs > 0 ? (errorCount / totalReqs * 100) : 0;
    const providerList: string[] = ov.provider_list || [];
    const spanTypes: string[] = ov.span_types || [];

    if (totalReqs === 0) {
      blocks.push({
        type: "alert",
        severity: "info",
        title: "No Embedding Data",
        message: "No embedding spans found. Embedding calls must include 'embed' in the span.name (e.g., openai.embeddings, ollama.embeddings).",
      });
      return { success: true, toolName: "embedding_analytics", summary: "No embedding data found.", blocks, dql: modelDql, executionTimeMs: Date.now() - start };
    }

    // KPI hero row
    blocks.push({
      type: "metric",
      metrics: [
        { label: "Embedding Requests", value: fmt(totalReqs), severity: "healthy" },
        { label: "Providers", value: providers },
        { label: "Models", value: models },
        { label: "Avg Latency", value: `${nsToMs(avgLatency)}ms`, severity: avgLatency > 1e9 ? "warning" : "healthy" },
        { label: "P95 Latency", value: `${nsToMs(p95Latency)}ms`, severity: p95Latency > 2e9 ? "warning" : "healthy" },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Error Rate", value: `${errorRate.toFixed(1)}%`, severity: errorRate > 5 ? "critical" : errorRate > 1 ? "warning" : "healthy" },
      ],
    });

    // Summary text
    blocks.push({
      type: "text",
      content: `### Embedding Operations Summary\n\n` +
        `**Providers:** ${providerList.join(", ")}\n\n` +
        `**Span Types:** ${spanTypes.join(", ")}\n\n` +
        `Processed **${fmt(totalReqs)} embedding requests** consuming **${fmt(totalTokens)} input tokens** over the last **${ctx.timeframe}**. ` +
        `Average latency is **${nsToMs(avgLatency)}ms** (P95: **${nsToMs(p95Latency)}ms**).` +
        (errorCount > 0 ? `\n\n⚠️ **${fmt(errorCount)} failed embedding requests** detected (${errorRate.toFixed(1)}% error rate).` : ''),
    });

    // Per-model breakdown table
    if (modelRecords.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Model", "Provider", "Requests", "Avg Latency", "P95 Latency", "Tokens", "Avg Tokens/Req", "Error Rate"],
        rows: modelRecords.map((r: any) => [
          r["gen_ai.request.model"] || "Unknown",
          r["gen_ai.provider.name"] || "—",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${nsToMs(Number(r.p95_latency || 0))}ms`,
          fmt(Number(r.total_tokens || 0)),
          fmt(Number(r.avg_tokens || 0), 1),
          `${Number(r.error_rate || 0).toFixed(1)}%`,
        ]),
        caption: `${modelRecords.length} embedding model configurations`,
      });
    }

    // Bar chart — requests by model
    if (modelRecords.length > 1) {
      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Embedding Requests by Model",
        data: modelRecords.filter((r: any) => r["gen_ai.request.model"]).slice(0, 10).map((r: any) => ({
          label: r["gen_ai.request.model"] || "Unknown",
          value: Number(r.requests || 0),
        })),
        unit: "requests",
      });
    }

    // Trend chart
    if (trendRecords.length > 1) {
      blocks.push({
        type: "chart",
        chartType: "timeseries",
        title: "Embedding Throughput Over Time",
        data: trendRecords.map((r: any) => ({
          label: "Embedding Requests",
          value: Number(r.requests || 0),
          timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : undefined,
        })),
        unit: "requests/hr",
      });
    }

    return {
      success: true,
      toolName: "embedding_analytics",
      summary: `Embedding Analytics: ${fmt(totalReqs)} requests across ${models} models (${providerList.join(", ")}), avg latency ${nsToMs(avgLatency)}ms, ${errorRate.toFixed(1)}% error rate.`,
      blocks,
      dql: modelDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "RAG pipeline", query: "Show my RAG pipeline performance" },
        { label: "Compare embedding models", query: "Compare my embedding models by latency and cost" },
        { label: "Embedding errors", query: "What errors are happening in my embedding calls?" },
        { label: "Full inventory", query: "Show my complete GenAI inventory" },
      ],
    };
  },
};

const ragPipeline: AgentTool = {
  name: "rag_pipeline",
  label: "RAG Pipeline",
  description: "Analyze RAG (Retrieval-Augmented Generation) pipeline performance — embedding calls vs LLM generation calls, end-to-end latency, token efficiency",
  triggers: ["rag", "retrieval augmented", "retrieval-augmented", "pipeline", "embed and generate", "rag pipeline", "rag performance", "rag latency", "retrieval"],
  examples: ["How is my RAG pipeline performing?", "Show RAG metrics", "Analyze my retrieval-augmented generation pipeline", "RAG latency breakdown"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Query 1: Embedding vs Generation split
    const splitDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd operation_type = if(contains(span.name, "embed"), "embedding", else: "generation")
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    models = countDistinct(gen_ai.request.model),
    providers = collectDistinct(gen_ai.provider.name)
  }, by: { operation_type }`;

    // Query 2: Embedding models breakdown
    const embedModelsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter contains(span.name, "embed")
| summarize requests = count(), avg_latency = avg(duration), tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)), by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc
| limit 10`;

    // Query 3: Generation models breakdown
    const genModelsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)) AND NOT contains(span.name, "embed")
| summarize requests = count(), avg_latency = avg(duration), input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)), output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc
| limit 10`;

    // Query 4: Hourly comparison — embedding vs generation
    const timelineDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd operation_type = if(contains(span.name, "embed"), "embedding", else: "generation")
| summarize requests = count(), by: { operation_type, bin(timestamp, 1h) }
| sort timestamp asc`;

    const [splitRecords, embedModels, genModels, timelineRecords] = await Promise.all([
      safeDql(splitDql),
      safeDql(embedModelsDql),
      safeDql(genModelsDql),
      safeDql(timelineDql),
    ]);

    const blocks: MessageBlock[] = [];

    const embRow = splitRecords.find((r: any) => r.operation_type === "embedding") || {};
    const genRow = splitRecords.find((r: any) => r.operation_type === "generation") || {};

    const embedReqs = Number(embRow.requests || 0);
    const genReqs = Number(genRow.requests || 0);
    const totalReqs = embedReqs + genReqs;

    if (totalReqs === 0) {
      blocks.push({
        type: "alert",
        severity: "info",
        title: "No RAG Data",
        message: "No GenAI spans found. Ensure embedding and generation calls are instrumented.",
      });
      return { success: true, toolName: "rag_pipeline", summary: "No RAG pipeline data found.", blocks, dql: splitDql, executionTimeMs: Date.now() - start };
    }

    const embedLatency = Number(embRow.avg_latency || 0);
    const genLatency = Number(genRow.avg_latency || 0);
    const embedErrorRate = Number(embRow.error_rate || 0);
    const genErrorRate = Number(genRow.error_rate || 0);
    const embedTokens = Number(embRow.total_input_tokens || 0);
    const genInputTokens = Number(genRow.total_input_tokens || 0);
    const genOutputTokens = Number(genRow.total_output_tokens || 0);
    const embedRatio = totalReqs > 0 ? (embedReqs / totalReqs * 100) : 0;

    // Hero KPIs
    blocks.push({
      type: "metric",
      metrics: [
        { label: "Total Requests", value: fmt(totalReqs) },
        { label: "Embedding Calls", value: fmt(embedReqs) },
        { label: "Generation Calls", value: fmt(genReqs) },
        { label: "Embed:Gen Ratio", value: genReqs > 0 ? `${(embedReqs / genReqs).toFixed(1)}:1` : "N/A" },
        { label: "Embed Latency", value: `${nsToMs(embedLatency)}ms` },
        { label: "Gen Latency", value: `${nsToMs(genLatency)}ms` },
        { label: "Est. E2E Latency", value: `${nsToMs(embedLatency + genLatency)}ms` },
      ],
    });

    // Pipeline stage comparison table
    blocks.push({
      type: "table",
      headers: ["Pipeline Stage", "Requests", "% of Total", "Avg Latency", "P95 Latency", "Error Rate", "Input Tokens", "Output Tokens", "Providers"],
      rows: splitRecords.map((r: any) => {
        const reqs = Number(r.requests || 0);
        const pct = totalReqs > 0 ? (reqs / totalReqs * 100) : 0;
        return [
          r.operation_type === "embedding" ? "🔢 Embedding" : "💬 Generation",
          fmt(reqs),
          `${pct.toFixed(1)}%`,
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${nsToMs(Number(r.p95_latency || 0))}ms`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          fmt(Number(r.total_input_tokens || 0)),
          fmt(Number(r.total_output_tokens || 0)),
          (r.providers || []).join(", ") || "—",
        ];
      }),
      caption: "RAG Pipeline — Embedding vs Generation comparison",
    });

    // Insight text
    let insight = `### RAG Pipeline Analysis\n\n`;
    insight += `Your RAG pipeline made **${fmt(embedReqs)} embedding calls** and **${fmt(genReqs)} generation calls** (ratio: **${genReqs > 0 ? (embedReqs / genReqs).toFixed(1) : "N/A"}:1**).\n\n`;
    insight += `**Estimated end-to-end latency:** ${nsToMs(embedLatency)}ms (embed) + ${nsToMs(genLatency)}ms (generate) = **~${nsToMs(embedLatency + genLatency)}ms total**.\n\n`;

    if (embedRatio > 70) {
      insight += `⚠️ High embedding-to-generation ratio (${embedRatio.toFixed(0)}% are embeddings). Consider caching frequently embedded content or batching embedding requests.\n\n`;
    }
    if (embedErrorRate > 5) {
      insight += `🔴 Embedding error rate is **${embedErrorRate.toFixed(1)}%** — investigate failing embedding calls.\n\n`;
    }
    if (genErrorRate > 5) {
      insight += `🔴 Generation error rate is **${genErrorRate.toFixed(1)}%** — investigate failing LLM calls.\n\n`;
    }
    if (embedLatency > 1e9) {
      insight += `⚡ Embedding latency (${nsToMs(embedLatency)}ms) is above 1 second — consider smaller embedding models or provider optimization.\n\n`;
    }

    blocks.push({ type: "text", content: insight });

    // Embedding models table
    if (embedModels.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Embedding Model", "Provider", "Requests", "Avg Latency", "Tokens"],
        rows: embedModels.map((r: any) => [
          r["gen_ai.request.model"] || "Unknown",
          r["gen_ai.provider.name"] || "—",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          fmt(Number(r.tokens || 0)),
        ]),
        caption: "Embedding models in use",
      });
    }

    // Generation models table
    if (genModels.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Generation Model", "Provider", "Requests", "Avg Latency", "Input Tokens", "Output Tokens"],
        rows: genModels.map((r: any) => [
          r["gen_ai.request.model"] || "Unknown",
          r["gen_ai.provider.name"] || "—",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          fmt(Number(r.input_tokens || 0)),
          fmt(Number(r.output_tokens || 0)),
        ]),
        caption: "Generation models in use",
      });
    }

    // Pie chart — embed vs generation
    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Request Distribution: Embedding vs Generation",
      data: [
        { label: "Embedding", value: embedReqs },
        { label: "Generation", value: genReqs },
      ],
      unit: "requests",
    });

    return {
      success: true,
      toolName: "rag_pipeline",
      summary: `RAG Pipeline: ${fmt(embedReqs)} embedding + ${fmt(genReqs)} generation calls, ~${nsToMs(embedLatency + genLatency)}ms estimated E2E latency.`,
      blocks,
      dql: splitDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Embedding details", query: "Deep dive into my embedding models" },
        { label: "Generation models", query: "Compare my generation models" },
        { label: "Optimize RAG", query: "How can I optimize my RAG pipeline?" },
        { label: "Cost breakdown", query: "Show cost for embeddings vs generation" },
      ],
    };
  },
};

// ============================================
// TOOL REGISTRY
// ============================================

export const TOOL_REGISTRY: AgentTool[] = [
  // Tier 1 — Observe (Core)
  serviceHealth,
  providerComparison,
  modelComparison,
  topErrors,
  costBreakdown,
  latencyAnalysis,
  tokenUsage,
  // Tier 1 — Observe (Inventory & Discovery)
  inventoryOverview,
  agentOverview,
  modelInventory,
  providerInventory,
  usageTrends,
  // Tier 1 — Observe (Embedding & RAG)
  embeddingAnalytics,
  ragPipeline,
  // Tier 1 — General Catch-all
  generalQA,
  // Tier 2 — Analyze (Dynatrace Intelligence)
  forecastTool,
  detectAnomalies,
  errorInvestigation,
  executiveSummary,
  // Tier 3 — Act
  costOptimization,
];
