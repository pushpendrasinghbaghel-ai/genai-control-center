/**
 * Agentic Tool Registry â€” GenAI Observability Tools
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

/** Alias for executeDql â€” both are now safe (return [] on failure) */
const safeDql = executeDql;

/** Format number with locale and optional decimals */
function fmt(n: number, decimals = 0): string {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: decimals }) : "â€”";
}

/** Format latency from nanoseconds to ms */
function nsToMs(ns: number): string {
  return fmt(ns / 1_000_000, 0);
}

// ============================================
// TIER 1 â€” OBSERVE (Read-Only)
// ============================================

const serviceHealth: AgentTool = {
  name: "service_health",
  label: "Service Health",
  description: "Show health overview of all GenAI services â€” request count, error rate, latency, tokens",
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
        String(r.service || "â€”"),
        fmt(Number(r.requests || 0)),
        `${Number(r.error_rate || 0).toFixed(1)}%`,
        `${nsToMs(Number(r.avg_latency || 0))}ms`,
        fmt(Number(r.tokens || 0)),
        (r.providers || []).join(", ") || "â€”",
        (r.models || []).join(", ") || "â€”",
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
          (r.models || []).join(", ") || "â€”",
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
          r["gen_ai.request.model"] || "â€”",
          r["gen_ai.provider.name"] || "â€”",
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
  description: "Show top errors across GenAI services â€” error types, affected services, rate limit (429) detection",
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
      return { success: true, toolName: "top_errors", summary: "No errors found â€” all clear!", blocks, dql, executionTimeMs: Date.now() - start };
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
        String(r["dt.entity.service"] || "â€”"),
        fmt(Number(r.error_count || 0)),
        (r.error_types || []).join(", ") || "â€”",
        (r.providers || []).join(", ") || "â€”",
        (r.models || []).join(", ") || "â€”",
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
  description: "Show AI spending breakdown by provider and model â€” estimated costs, token consumption, optimization opportunities",
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
  description: "Analyze latency across AI services â€” identify slow models, P50/P99 percentiles, SLA violations",
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
        r["gen_ai.request.model"] || "â€”",
        r["gen_ai.provider.name"] || "â€”",
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
  description: "Show token consumption by service and model â€” input vs output tokens, efficiency metrics",
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
    const ratio = totalOutput > 0 ? (totalInput / totalOutput).toFixed(1) : "â€”";

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
          String(r["dt.entity.service"] || "â€”"),
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
// TIER 2 â€” ANALYZE (Dynatrace Intelligence)
// ============================================

const forecastTool: AgentTool = {
  name: "forecast",
  label: "Forecast",
  description: "Forecast token usage or AI costs using Dynatrace Intelligence GenericForecastAnalyzer â€” predict trends for next 24 hours",
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
  description: "Run Dynatrace Intelligence anomaly detection on GenAI metrics â€” auto-adaptive, seasonal baseline, and novelty scoring",
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
          : "No anomalies detected â€” all GenAI metrics are within normal range.",
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
  description: "Deep-dive into error patterns â€” correlate with deployments, rate limits, provider outages. Uses Dynatrace Intelligence for root cause analysis",
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
| summarize error_count = count(), by: { bin(start_time, 1h), gen_ai.provider.name }`;

    // Get recent errors with details
    const detailDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR isNotNull(error.type)
| fields start_time, dt.entity.service, gen_ai.provider.name, gen_ai.request.model, error.type, span.status_code, duration
| sort start_time desc
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
        r.start_time ? new Date(r.start_time).toLocaleString() : "â€”",
        String(r["dt.entity.service"] || "â€”"),
        r["gen_ai.provider.name"] || "â€”",
        r["gen_ai.request.model"] || "â€”",
        r["error.type"] || r["span.status_code"] || "â€”",
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
// TIER 3 â€” ACT (Recommendations)
// ============================================

const costOptimization: AgentTool = {
  name: "cost_optimization",
  label: "Cost Optimization",
  description: "AI-powered cost optimization recommendations â€” identify prompt bloat, suggest cheaper models, detect waste",
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
        recommendations.push(`**${model}** (${provider}): ${lowOutput.toFixed(0)}% of responses have minimal output â€” potential wasted calls.`);
      }
      if (errorRate > 10) {
        recommendations.push(`**${model}** (${provider}): ${errorRate.toFixed(1)}% error rate â€” failed requests waste tokens.`);
      }

      // Suggest cheaper alternatives
      const m = model.toLowerCase();
      if (m.includes("gpt-4") && !m.includes("mini")) {
        recommendations.push(`**${model}**: Consider gpt-4o-mini for non-critical tasks â€” up to 90% cost reduction.`);
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
        r["gen_ai.request.model"] || "â€”",
        r["gen_ai.provider.name"] || "â€”",
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
  description: "Generate an executive-level summary of GenAI operations â€” health, cost, performance, and key recommendations",
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
      content: `*Report generated at ${new Date().toLocaleString()} â€” timeframe: last ${ctx.timeframe}*`,
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
// TIER 1 â€” OBSERVE (Inventory & Discovery)
// ============================================

const inventoryOverview: AgentTool = {
  name: "inventory_overview",
  label: "Inventory Overview",
  description: "Show a high-level inventory of all GenAI assets â€” total services, providers, models, agents, and request volumes",
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
  description: "Show AI agent activity â€” agent task executions, frameworks (Langchain, etc.), tool usage, and agent performance",
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
| summarize executions = count(), by: { bin(start_time, 1h) }
| sort start_time asc`;

    // Query 3: Models used by agents
    const agentModelsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter gen_ai.provider.name == "Langchain"
| summarize requests = count(), avg_latency = avg(duration), tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)), by: { gen_ai.request.model }
| sort requests desc
| limit 10`;

    // Execute queries with graceful fallback â€” trend query can fail on some Grail versions
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
        r["span.name"] || "â€”",
        fmt(Number(r.executions || 0)),
        `${nsToMs(Number(r.avg_duration || 0))}ms`,
        `${nsToMs(Number(r.p95_duration || 0))}ms`,
        fmt(Number(r.error_count || 0)),
        (r.services || []).join(", ") || "â€”",
        (r.models || []).filter(Boolean).join(", ") || "â€”",
      ]),
      caption: "Agent span activity breakdown",
    });

    // Models used by agents
    if (modelRecords.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Model", "Requests", "Avg Latency", "Tokens"],
        rows: modelRecords.map((r: any) => [
          r["gen_ai.request.model"] || "â€”",
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
          timestamp: r.start_time ? new Date(r.start_time).toISOString() : undefined,
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
          r["gen_ai.request.model"] || "â€”",
          r["gen_ai.provider.name"] || "â€”",
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
          spanTypes || "â€”",
        ];
      }),
      caption: `${records.length} AI providers discovered`,
    });

    // Pie chart â€” token distribution
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
  description: "Show GenAI usage trends over time â€” request volume, token consumption, error rates, and latency trends",
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
  }, by: { bin(start_time, ${bucket}) }
| sort start_time asc`;

    // Also get per-provider trends
    const providerTrendDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize requests = count(), by: { gen_ai.provider.name, bin(start_time, ${bucket}) }
| sort start_time asc`;

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
        timestamp: r.start_time ? new Date(r.start_time).toISOString() : undefined,
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
        timestamp: r.start_time ? new Date(r.start_time).toISOString() : undefined,
      })),
      unit: "tokens",
    });

    // Insight text
    const trendText = trendDirection === "up" ? "ðŸ“ˆ **Increasing** usage trend detected"
      : trendDirection === "down" ? "ðŸ“‰ **Decreasing** usage trend detected"
      : "âž¡ï¸ **Stable** usage pattern";

    blocks.push({
      type: "text",
      content: `${trendText} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% change, comparing first vs second half of the window). ` +
        `Peak activity: **${fmt(peakRequests)} requests** per ${bucket} bucket.`,
    });

    return {
      success: true,
      toolName: "usage_trends",
      summary: `Usage Trends: ${trendText.replace(/[ðŸ“ˆðŸ“‰âž¡ï¸*]/g, '').trim()}, ${fmt(totalReqs)} total requests, peak ${fmt(peakRequests)}/${bucket}.`,
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
  description: "Answer general questions about GenAI operations when no specific tool matches â€” runs a broad data scan and produces a helpful summary",
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
      nlSummary += `ðŸ¤– **Agent Activity:** ${fmt(agentTasks)} agent task executions detected (Langchain framework).\n\n`;
    }

    if (errorRate > 5) {
      nlSummary += `ðŸ”´ **Attention:** Error rate is at **${errorRate.toFixed(1)}%** â€” consider investigating failing services.\n\n`;
    } else if (errorRate > 1) {
      nlSummary += `ðŸŸ¡ Error rate is **${errorRate.toFixed(1)}%** â€” within tolerable range but worth monitoring.\n\n`;
    } else {
      nlSummary += `âœ… Error rate is a healthy **${errorRate.toFixed(1)}%**.\n\n`;
    }

    // Top models
    if (topModelsRecords.length > 0) {
      nlSummary += `**Top Models by Usage:**\n`;
      topModelsRecords.forEach((r: any, i: number) => {
        nlSummary += `${i + 1}. **${r["gen_ai.request.model"] || "Unknown"}** (${r["gen_ai.provider.name"] || "â€”"}) â€” ${fmt(Number(r.requests || 0))} requests\n`;
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
// TIER 1 â€” OBSERVE (Embedding & RAG)
// ============================================

const embeddingAnalytics: AgentTool = {
  name: "embedding_analytics",
  label: "Embedding Analytics",
  description: "Analyze embedding operations â€” models, providers, throughput, latency, token usage, and error rates for vector embedding calls",
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
| summarize requests = count(), tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)), by: { bin(start_time, 1h) }
| sort start_time asc`;

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
        (errorCount > 0 ? `\n\nâš ï¸ **${fmt(errorCount)} failed embedding requests** detected (${errorRate.toFixed(1)}% error rate).` : ''),
    });

    // Per-model breakdown table
    if (modelRecords.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Model", "Provider", "Requests", "Avg Latency", "P95 Latency", "Tokens", "Avg Tokens/Req", "Error Rate"],
        rows: modelRecords.map((r: any) => [
          r["gen_ai.request.model"] || "Unknown",
          r["gen_ai.provider.name"] || "â€”",
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

    // Bar chart â€” requests by model
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
          timestamp: r.start_time ? new Date(r.start_time).toISOString() : undefined,
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
  description: "Analyze RAG (Retrieval-Augmented Generation) pipeline performance â€” embedding calls vs LLM generation calls, end-to-end latency, token efficiency",
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

    // Query 4: Hourly comparison â€” embedding vs generation
    const timelineDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd operation_type = if(contains(span.name, "embed"), "embedding", else: "generation")
| summarize requests = count(), by: { operation_type, bin(start_time, 1h) }
| sort start_time asc`;

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
          r.operation_type === "embedding" ? "ðŸ”¢ Embedding" : "ðŸ’¬ Generation",
          fmt(reqs),
          `${pct.toFixed(1)}%`,
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          `${nsToMs(Number(r.p95_latency || 0))}ms`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          fmt(Number(r.total_input_tokens || 0)),
          fmt(Number(r.total_output_tokens || 0)),
          (r.providers || []).join(", ") || "â€”",
        ];
      }),
      caption: "RAG Pipeline â€” Embedding vs Generation comparison",
    });

    // Insight text
    let insight = `### RAG Pipeline Analysis\n\n`;
    insight += `Your RAG pipeline made **${fmt(embedReqs)} embedding calls** and **${fmt(genReqs)} generation calls** (ratio: **${genReqs > 0 ? (embedReqs / genReqs).toFixed(1) : "N/A"}:1**).\n\n`;
    insight += `**Estimated end-to-end latency:** ${nsToMs(embedLatency)}ms (embed) + ${nsToMs(genLatency)}ms (generate) = **~${nsToMs(embedLatency + genLatency)}ms total**.\n\n`;

    if (embedRatio > 70) {
      insight += `âš ï¸ High embedding-to-generation ratio (${embedRatio.toFixed(0)}% are embeddings). Consider caching frequently embedded content or batching embedding requests.\n\n`;
    }
    if (embedErrorRate > 5) {
      insight += `ðŸ”´ Embedding error rate is **${embedErrorRate.toFixed(1)}%** â€” investigate failing embedding calls.\n\n`;
    }
    if (genErrorRate > 5) {
      insight += `ðŸ”´ Generation error rate is **${genErrorRate.toFixed(1)}%** â€” investigate failing LLM calls.\n\n`;
    }
    if (embedLatency > 1e9) {
      insight += `âš¡ Embedding latency (${nsToMs(embedLatency)}ms) is above 1 second â€” consider smaller embedding models or provider optimization.\n\n`;
    }

    blocks.push({ type: "text", content: insight });

    // Embedding models table
    if (embedModels.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Embedding Model", "Provider", "Requests", "Avg Latency", "Tokens"],
        rows: embedModels.map((r: any) => [
          r["gen_ai.request.model"] || "Unknown",
          r["gen_ai.provider.name"] || "â€”",
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
          r["gen_ai.provider.name"] || "â€”",
          fmt(Number(r.requests || 0)),
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          fmt(Number(r.input_tokens || 0)),
          fmt(Number(r.output_tokens || 0)),
        ]),
        caption: "Generation models in use",
      });
    }

    // Pie chart â€” embed vs generation
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
// TIER 1 â€” OBSERVE (Topology & Architecture)
// ============================================

const aiTopology: AgentTool = {
  name: "ai_topology",
  label: "AI Topology",
  description: "Show AI service topology â€” services, providers, models, and their relationships",
  triggers: ["topology", "architecture", "map", "services graph", "dependencies", "ai landscape", "what services", "ai topology"],
  examples: ["Show my AI topology", "What AI services are connected?", "Map my AI architecture"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    const servicesDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model)
  }, by: { service = dt.entity.service }
| sort request_count desc
| limit 50`;

    const providerModelDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    services = collectDistinct(dt.entity.service),
    span_types = collectDistinct(span.name)
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort request_count desc
| limit 50`;

    const [services, providerModels] = await Promise.all([
      safeDql(servicesDql),
      safeDql(providerModelDql),
    ]);

    const blocks: MessageBlock[] = [];

    if (services.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No AI Services", message: "No GenAI spans found. Ensure your AI services are instrumented with OpenTelemetry gen_ai.* attributes." });
      return { success: true, toolName: "ai_topology", summary: "No AI services discovered.", blocks, executionTimeMs: Date.now() - start };
    }

    const totalServices = services.length;
    const totalProviders = new Set(providerModels.map((r: any) => r["gen_ai.provider.name"]).filter(Boolean)).size;
    const totalModels = new Set(providerModels.map((r: any) => r["gen_ai.request.model"]).filter(Boolean)).size;

    blocks.push({
      type: "metric",
      metrics: [
        { label: "AI Services", value: totalServices },
        { label: "Providers", value: totalProviders },
        { label: "Models", value: totalModels },
        { label: "Total Connections", value: providerModels.length },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Service", "Requests", "Error Rate", "Avg Latency", "Tokens", "Providers", "Models"],
      rows: services.map((r: any) => {
        const reqs = Number(r.request_count || 0);
        const errs = Number(r.error_count || 0);
        return [
          String(r.service || "â€”"),
          fmt(reqs),
          `${reqs > 0 ? (errs / reqs * 100).toFixed(1) : "0"}%`,
          `${nsToMs(Number(r.avg_latency || 0))}ms`,
          fmt(Number(r.total_tokens || 0)),
          Array.isArray(r.providers) ? r.providers.filter(Boolean).join(", ") : "â€”",
          Array.isArray(r.models) ? r.models.filter(Boolean).join(", ") : "â€”",
        ];
      }),
      caption: "AI Service Topology",
    });

    blocks.push({
      type: "table",
      headers: ["Provider", "Model", "Requests", "Used By Services", "Span Types"],
      rows: providerModels.map((r: any) => [
        r["gen_ai.provider.name"] || "â€”",
        r["gen_ai.request.model"] || "â€”",
        fmt(Number(r.request_count || 0)),
        Array.isArray(r.services) ? r.services.filter(Boolean).join(", ") : "â€”",
        Array.isArray(r.span_types) ? r.span_types.filter(Boolean).join(", ") : "â€”",
      ]),
      caption: "Provider â†” Model Connections",
    });

    // Pie chart of requests by provider
    const providerMap: Record<string, number> = {};
    providerModels.forEach((r: any) => {
      const p = r["gen_ai.provider.name"] || "Unknown";
      providerMap[p] = (providerMap[p] || 0) + Number(r.request_count || 0);
    });
    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Requests by Provider",
      data: Object.entries(providerMap).map(([label, value]) => ({ label, value })),
      unit: "requests",
    });

    return {
      success: true,
      toolName: "ai_topology",
      summary: `AI Topology: ${totalServices} services, ${totalProviders} providers, ${totalModels} models discovered.`,
      blocks,
      dql: servicesDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Service health", query: "Show health of all AI services" },
        { label: "Provider comparison", query: "Compare my AI providers" },
        { label: "Model inventory", query: "List all models in use" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Prompt Governance)
// ============================================

const promptGovernance: AgentTool = {
  name: "prompt_governance",
  label: "Prompt Governance",
  description: "Analyze prompts for PII exposure, injection risks, and governance compliance",
  triggers: ["prompt", "governance", "pii", "injection", "security", "sensitive", "compliance", "prompt analysis", "prompt risk"],
  examples: ["Analyze my prompts for PII", "Show prompt governance report", "Any prompt injection risks?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    const promptDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd prompt_text = coalesce(gen_ai.prompt.0.content, gen_ai.prompt.1.content, "")
| filter prompt_text != ""
| fields
    service = dt.entity.service,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    prompt_text,
    input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
    has_error = span.status_code == "error"
| sort input_tokens desc
| limit 100`;

    const records = await safeDql(promptDql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Prompt Data", message: "No prompt content found. Ensure gen_ai.prompt attributes are captured in your spans." });
      return { success: true, toolName: "prompt_governance", summary: "No prompt data available.", blocks, executionTimeMs: Date.now() - start };
    }

    // Analyze prompts for PII patterns
    const piiPatterns = [
      { name: "Email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i },
      { name: "Phone", regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
      { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
      { name: "Credit Card", regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ },
      { name: "IP Address", regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
      { name: "API Key", regex: /\b(sk-|api[_-]key|bearer|token)[a-zA-Z0-9_-]{10,}\b/i },
    ];

    const injectionPatterns = [
      { name: "Ignore Instructions", regex: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts)/i },
      { name: "System Override", regex: /(system\s+prompt|you\s+are\s+now|act\s+as|pretend\s+to\s+be)/i },
      { name: "Data Extraction", regex: /(reveal|show|display|output)\s+(your|the)\s+(system|hidden|secret|initial)\s+(prompt|instructions|configuration)/i },
      { name: "Delimiter Attack", regex: /(<\|endoftext\|>|<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\])/i },
    ];

    let piiCount = 0;
    let injectionCount = 0;
    const piiFindings: Array<{ type: string; service: string; model: string }> = [];
    const injectionFindings: Array<{ type: string; service: string; model: string }> = [];

    records.forEach((r: any) => {
      const text = String(r.prompt_text || "");
      piiPatterns.forEach(p => {
        if (p.regex.test(text)) {
          piiCount++;
          piiFindings.push({ type: p.name, service: String(r.service || "â€”"), model: r.model || "â€”" });
        }
      });
      injectionPatterns.forEach(p => {
        if (p.regex.test(text)) {
          injectionCount++;
          injectionFindings.push({ type: p.name, service: String(r.service || "â€”"), model: r.model || "â€”" });
        }
      });
    });

    const riskLevel = piiCount + injectionCount > 5 ? "critical" : piiCount + injectionCount > 0 ? "warning" : "healthy";

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Prompts Analyzed", value: records.length },
        { label: "PII Detections", value: piiCount, severity: piiCount > 0 ? "critical" : "healthy" },
        { label: "Injection Risks", value: injectionCount, severity: injectionCount > 0 ? "critical" : "healthy" },
        { label: "Risk Level", value: riskLevel === "healthy" ? "Low" : riskLevel === "warning" ? "Medium" : "High", severity: riskLevel },
      ],
    });

    if (piiFindings.length > 0) {
      blocks.push({ type: "alert", severity: "critical", title: "PII Detected in Prompts", message: `Found ${piiCount} PII pattern(s) across ${records.length} prompts. Types: ${[...new Set(piiFindings.map(f => f.type))].join(", ")}` });
      blocks.push({
        type: "table",
        headers: ["PII Type", "Service", "Model"],
        rows: piiFindings.slice(0, 20).map(f => [f.type, f.service, f.model]),
        caption: "PII Detections (top 20)",
      });
    }

    if (injectionFindings.length > 0) {
      blocks.push({ type: "alert", severity: "warning", title: "Prompt Injection Risks", message: `Found ${injectionCount} potential injection pattern(s). Types: ${[...new Set(injectionFindings.map(f => f.type))].join(", ")}` });
      blocks.push({
        type: "table",
        headers: ["Injection Type", "Service", "Model"],
        rows: injectionFindings.slice(0, 20).map(f => [f.type, f.service, f.model]),
        caption: "Injection Risk Detections (top 20)",
      });
    }

    if (piiCount === 0 && injectionCount === 0) {
      blocks.push({ type: "alert", severity: "success", title: "Clean Prompts", message: "No PII or injection patterns detected across all analyzed prompts." });
    }

    // Token distribution by model
    const modelTokens: Record<string, number> = {};
    records.forEach((r: any) => {
      const m = r.model || "Unknown";
      modelTokens[m] = (modelTokens[m] || 0) + Number(r.input_tokens || 0);
    });
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Input Tokens by Model",
      data: Object.entries(modelTokens)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([label, value]) => ({ label, value })),
      unit: "tokens",
    });

    return {
      success: true,
      toolName: "prompt_governance",
      summary: `Prompt Governance: ${records.length} prompts analyzed, ${piiCount} PII detections, ${injectionCount} injection risks.`,
      blocks,
      dql: promptDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Governance audit", query: "Show compliance audit trail" },
        { label: "Error details", query: "Investigate AI errors" },
        { label: "Security overview", query: "Show AI security posture" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Model Drift Detection)
// ============================================

const modelDrift: AgentTool = {
  name: "model_drift",
  label: "Model Drift",
  description: "Detect model behavior changes, version mismatches, and performance drift over time",
  triggers: ["drift", "model drift", "behavior change", "version mismatch", "model changed", "performance shift", "regression", "model version"],
  examples: ["Detect model drift", "Has my model behavior changed?", "Any model version mismatches?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Model versions & performance
    const versionsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
| summarize {
    request_count = count(),
    first_seen = min(start_time),
    last_seen = max(start_time),
    avg_latency = avg(duration) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name, span.name }
| filter isNotNull(gen_ai.request.model)
| sort last_seen desc`;

    // Version change detection
    const versionChangeDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.response.model) AND gen_ai.response.model != gen_ai.request.model
| summarize {
    occurrences = count(),
    first_seen = min(start_time),
    last_seen = max(start_time)
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
| sort last_seen desc`;

    // Performance trend over time
    const trendDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
| summarize {
    avg_latency = avg(duration) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    request_count = count()
  }, by: { gen_ai.request.model, gen_ai.provider.name, bin(start_time, 1h) }
| sort start_time asc`;

    const [versions, versionChanges, trends] = await Promise.all([
      safeDql(versionsDql),
      safeDql(versionChangeDql),
      safeDql(trendDql),
    ]);

    const blocks: MessageBlock[] = [];

    if (versions.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Model Data", message: "No model version data found in GenAI spans." });
      return { success: true, toolName: "model_drift", summary: "No model data available.", blocks, executionTimeMs: Date.now() - start };
    }

    // Version mismatch alerts
    if (versionChanges.length > 0) {
      blocks.push({ type: "alert", severity: "warning", title: "Model Version Mismatches", message: `${versionChanges.length} model(s) returned a different version than requested.` });
      blocks.push({
        type: "table",
        headers: ["Requested Model", "Actual Model", "Provider", "Occurrences", "Last Seen"],
        rows: versionChanges.map((r: any) => [
          r["gen_ai.request.model"] || "â€”",
          r["gen_ai.response.model"] || "â€”",
          r["gen_ai.provider.name"] || "â€”",
          fmt(Number(r.occurrences || 0)),
          r.last_seen ? new Date(r.last_seen).toLocaleString() : "â€”",
        ]),
        caption: "Models returning different versions than requested",
      });
    } else {
      blocks.push({ type: "alert", severity: "success", title: "No Version Mismatches", message: "All models returning expected versions." });
    }

    // Model performance summary
    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "Avg Latency", "Avg Output Tokens", "Error Rate"],
      rows: versions.slice(0, 20).map((r: any) => [
        r["gen_ai.request.model"] || "â€”",
        r["gen_ai.provider.name"] || "â€”",
        fmt(Number(r.request_count || 0)),
        `${Number(r.avg_latency || 0).toFixed(0)}ms`,
        fmt(Number(r.avg_output_tokens || 0), 0),
        `${Number(r.error_rate || 0).toFixed(1)}%`,
      ]),
      caption: "Model Performance Summary",
    });

    // Latency trend chart (aggregate)
    if (trends.length > 1) {
      // Group by timestamp, average latency across models
      const tsMap: Record<string, { latency: number[]; count: number }> = {};
      trends.forEach((r: any) => {
        const ts = r.start_time ? new Date(r.start_time).toISOString() : "";
        if (!ts) return;
        if (!tsMap[ts]) tsMap[ts] = { latency: [], count: 0 };
        tsMap[ts].latency.push(Number(r.avg_latency || 0));
        tsMap[ts].count += Number(r.request_count || 0);
      });
      const chartData = Object.entries(tsMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ts, d]) => ({
          label: "Avg Latency",
          value: d.latency.reduce((a, b) => a + b, 0) / d.latency.length,
          timestamp: ts,
        }));
      if (chartData.length > 1) {
        blocks.push({
          type: "chart",
          chartType: "timeseries",
          title: "Model Latency Trend",
          data: chartData,
          unit: "ms",
        });
      }
    }

    return {
      success: true,
      toolName: "model_drift",
      summary: `Model Drift: ${versions.length} model variants tracked, ${versionChanges.length} version mismatches detected.`,
      blocks,
      dql: versionsDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Model comparison", query: "Compare my models" },
        { label: "Error investigation", query: "Investigate model errors" },
        { label: "Provider comparison", query: "Compare AI providers" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Infrastructure)
// ============================================

const infrastructure: AgentTool = {
  name: "infrastructure",
  label: "Infrastructure",
  description: "Show AI infrastructure â€” deployments, service configurations, and model history",
  triggers: ["infrastructure", "deploy", "deployment", "config", "configuration", "infra", "ai infra", "service config"],
  examples: ["Show AI infrastructure", "Recent deployments?", "What's my AI config?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Deployment events
    const deployDql = `fetch events, from:now()-${ctx.timeframe}
| filter event.kind == "DEPLOYMENT_EVENT"
| fields
    event_id = id,
    title = event.name,
    entity = dt.entity.name,
    timestamp = timestamp,
    version = dt.event.deployment.version,
    artifact = dt.event.deployment.artifact_version
| sort timestamp desc
| limit 30`;

    // Service config â€” models & providers per service
    const configDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.provider.name)
| summarize
    model = takeFirst(gen_ai.request.model),
    provider = takeFirst(gen_ai.provider.name),
    model_versions = countDistinct(gen_ai.request.model),
    request_count = count(),
    last_seen = max(start_time),
    by: { service_name = service.name }
| sort last_seen desc
| limit 40`;

    // Version mismatch check
    const mismatchDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.request.model) AND isNotNull(gen_ai.response.model)
| filter gen_ai.request.model != gen_ai.response.model
| summarize
    mismatch_count = count(),
    first_seen = min(start_time),
    last_seen = max(start_time)
  , by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
| sort last_seen desc
| limit 20`;

    const [deploys, configs, mismatches] = await Promise.all([
      safeDql(deployDql),
      safeDql(configDql),
      safeDql(mismatchDql),
    ]);

    const blocks: MessageBlock[] = [];

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Deployments", value: deploys.length },
        { label: "AI Services", value: configs.length },
        { label: "Version Mismatches", value: mismatches.length, severity: mismatches.length > 0 ? "warning" : "healthy" },
      ],
    });

    if (deploys.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Deployment", "Entity", "Version", "Artifact", "Time"],
        rows: deploys.map((r: any) => [
          r.title || "â€”",
          r.entity || "â€”",
          r.version || "â€”",
          r.artifact || "â€”",
          r.timestamp ? new Date(r.timestamp).toLocaleString() : "â€”",
        ]),
        caption: "Recent Deployments",
      });
    } else {
      blocks.push({ type: "alert", severity: "info", title: "No Deployments", message: "No deployment events found in the selected timeframe." });
    }

    if (configs.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Service", "Model", "Provider", "Model Versions", "Requests", "Last Seen"],
        rows: configs.map((r: any) => [
          r.service_name || "â€”",
          r.model || "â€”",
          r.provider || "â€”",
          fmt(Number(r.model_versions || 0)),
          fmt(Number(r.request_count || 0)),
          r.last_seen ? new Date(r.last_seen).toLocaleString() : "â€”",
        ]),
        caption: "AI Service Configuration",
      });
    }

    if (mismatches.length > 0) {
      blocks.push({ type: "alert", severity: "warning", title: "Version Mismatches Detected", message: `${mismatches.length} model(s) returning different versions than requested.` });
    }

    return {
      success: true,
      toolName: "infrastructure",
      summary: `Infrastructure: ${deploys.length} deployments, ${configs.length} AI services configured, ${mismatches.length} version mismatches.`,
      blocks,
      dql: deployDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Model drift", query: "Detect model drift" },
        { label: "Service health", query: "Show AI service health" },
        { label: "Topology", query: "Show AI topology" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (AI Quality)
// ============================================

const aiQuality: AgentTool = {
  name: "ai_quality",
  label: "AI Quality Score",
  description: "Calculate per-service AI quality scores based on latency, error rate, token efficiency, and output variance",
  triggers: ["quality", "quality score", "ai quality", "service score", "scoring", "quality dashboard", "grade", "rating"],
  examples: ["Show AI quality scores", "Rate my AI services", "Which service has the best quality?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
    avg_latency = avg(duration) / 1000000,
    p95_latency = percentile(duration / 1000000, 95),
    error_rate = countIf(span.status_code == "error" OR isNotNull(error.type)) / count() * 100,
    low_output_rate = countIf(coalesce(gen_ai.usage.output_tokens, 0) < 10 AND coalesce(gen_ai.usage.output_tokens, 0) > 0) / countIf(coalesce(gen_ai.usage.output_tokens, 0) > 0) * 100
  }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
| sort request_count desc
| limit 50`;

    const records = await safeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No AI quality data available." });
      return { success: true, toolName: "ai_quality", summary: "No AI quality data.", blocks, executionTimeMs: Date.now() - start };
    }

    // Calculate quality scores
    const scored = records.map((r: any) => {
      const errorRate = Number(r.error_rate || 0);
      const avgLatency = Number(r.avg_latency || 0);
      const p95Latency = Number(r.p95_latency || 0);
      const lowOutputRate = Number(r.low_output_rate || 0);

      // Score components (0-100 each)
      const reliabilityScore = Math.max(0, 100 - errorRate * 10);
      const latencyScore = avgLatency < 500 ? 100 : avgLatency < 2000 ? 80 : avgLatency < 5000 ? 50 : 20;
      const consistencyScore = p95Latency > 0 && avgLatency > 0 ? Math.max(0, 100 - (p95Latency / avgLatency - 1) * 50) : 80;
      const outputQualityScore = Math.max(0, 100 - lowOutputRate * 2);

      const overall = Math.round(reliabilityScore * 0.35 + latencyScore * 0.25 + consistencyScore * 0.2 + outputQualityScore * 0.2);

      return {
        ...r,
        reliabilityScore: Math.round(reliabilityScore),
        latencyScore: Math.round(latencyScore),
        consistencyScore: Math.round(consistencyScore),
        outputQualityScore: Math.round(outputQualityScore),
        overallScore: overall,
        grade: overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F",
      };
    });

    scored.sort((a: any, b: any) => b.overallScore - a.overallScore);

    const avgScore = Math.round(scored.reduce((s: number, r: any) => s + r.overallScore, 0) / scored.length);

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Services Scored", value: scored.length },
        { label: "Avg Quality Score", value: `${avgScore}/100`, severity: avgScore >= 75 ? "healthy" : avgScore >= 50 ? "warning" : "critical" },
        { label: "Top Grade", value: scored[0]?.grade || "â€”" },
        { label: "Lowest Grade", value: scored[scored.length - 1]?.grade || "â€”", severity: scored[scored.length - 1]?.overallScore < 50 ? "critical" : "warning" },
      ],
    });

    blocks.push({
      type: "table",
      headers: ["Service", "Model", "Grade", "Overall", "Reliability", "Latency", "Consistency", "Output Quality", "Requests"],
      rows: scored.map((r: any) => [
        String(r["dt.entity.service"] || "â€”"),
        r["gen_ai.request.model"] || "â€”",
        r.grade,
        `${r.overallScore}/100`,
        `${r.reliabilityScore}`,
        `${r.latencyScore}`,
        `${r.consistencyScore}`,
        `${r.outputQualityScore}`,
        fmt(Number(r.request_count || 0)),
      ]),
      caption: "AI Quality Scorecard",
    });

    // Bar chart of scores
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Quality Scores by Service",
      data: scored.slice(0, 10).map((r: any) => ({
        label: `${r["gen_ai.request.model"] || String(r["dt.entity.service"] || "â€”")} (${r.grade})`,
        value: r.overallScore,
      })),
      unit: "score",
    });

    return {
      success: true,
      toolName: "ai_quality",
      summary: `AI Quality: ${scored.length} services scored, avg ${avgScore}/100. Top: ${scored[0]?.["gen_ai.request.model"] || "â€”"} (${scored[0]?.grade}), Bottom: ${scored[scored.length - 1]?.["gen_ai.request.model"] || "â€”"} (${scored[scored.length - 1]?.grade}).`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Low scorers", query: "Why is my lowest scoring AI service performing poorly?" },
        { label: "Error investigation", query: "Investigate AI errors" },
        { label: "Latency analysis", query: "Analyze AI latency" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Conversation Intelligence)
// ============================================

const conversationIntelligence: AgentTool = {
  name: "conversation_intelligence",
  label: "Conversation Intelligence",
  description: "Analyze AI conversation sessions â€” multi-turn patterns, session lengths, and conversation health",
  triggers: ["conversation", "session", "multi-turn", "chat session", "conversation intelligence", "dialog", "interactions", "conversation health"],
  examples: ["Analyze AI conversations", "Show conversation sessions", "How are my AI chat sessions performing?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Conversation stats
    const statsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter isNotNull(gen_ai.conversation.id) OR isNotNull(trace.id)
| fieldsAdd session_id = coalesce(gen_ai.conversation.id, trace.id)
| summarize {
    turn_count = count(),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_latency_ms = sum(duration) / 1000000,
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    first_turn = min(start_time),
    last_turn = max(start_time),
    models_used = collectDistinct(gen_ai.request.model),
    providers_used = collectDistinct(gen_ai.provider.name)
  }, by: { session_id }
| sort last_turn desc
| limit 100`;

    // Long conversations (5+ turns)
    const longConvDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter isNotNull(gen_ai.conversation.id) OR isNotNull(trace.id)
| fieldsAdd session_id = coalesce(gen_ai.conversation.id, trace.id)
| summarize turn_count = count(), by: { session_id }
| filter turn_count >= 5
| sort turn_count desc
| limit 20`;

    const [sessions, longConvs] = await Promise.all([
      safeDql(statsDql),
      safeDql(longConvDql),
    ]);

    const blocks: MessageBlock[] = [];

    if (sessions.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Conversations", message: "No conversation/session data found. Ensure gen_ai.conversation.id or trace.id is present in spans." });
      return { success: true, toolName: "conversation_intelligence", summary: "No conversation data.", blocks, executionTimeMs: Date.now() - start };
    }

    const totalSessions = sessions.length;
    const totalTurns = sessions.reduce((s: number, r: any) => s + Number(r.turn_count || 0), 0);
    const avgTurns = totalTurns / totalSessions;
    const totalErrors = sessions.reduce((s: number, r: any) => s + Number(r.error_count || 0), 0);
    const avgLatency = sessions.reduce((s: number, r: any) => s + Number(r.total_latency_ms || 0), 0) / totalSessions;

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Sessions", value: totalSessions },
        { label: "Total Turns", value: fmt(totalTurns) },
        { label: "Avg Turns/Session", value: avgTurns.toFixed(1) },
        { label: "Long Conversations (5+)", value: longConvs.length },
        { label: "Errors", value: totalErrors, severity: totalErrors > 0 ? "warning" : "healthy" },
        { label: "Avg Session Latency", value: `${avgLatency.toFixed(0)}ms` },
      ],
    });

    // Session details table
    blocks.push({
      type: "table",
      headers: ["Session", "Turns", "Input Tokens", "Output Tokens", "Latency", "Errors", "Models"],
      rows: sessions.slice(0, 20).map((r: any) => [
        String(r.session_id || "â€”").slice(0, 16) + "â€¦",
        fmt(Number(r.turn_count || 0)),
        fmt(Number(r.total_input_tokens || 0)),
        fmt(Number(r.total_output_tokens || 0)),
        `${Number(r.total_latency_ms || 0).toFixed(0)}ms`,
        fmt(Number(r.error_count || 0)),
        Array.isArray(r.models_used) ? r.models_used.filter(Boolean).join(", ") : "â€”",
      ]),
      caption: "Recent Conversation Sessions",
    });

    // Distribution chart â€” turns per session
    const turnBuckets: Record<string, number> = { "1 turn": 0, "2-3 turns": 0, "4-5 turns": 0, "6-10 turns": 0, "10+ turns": 0 };
    sessions.forEach((r: any) => {
      const t = Number(r.turn_count || 0);
      if (t <= 1) turnBuckets["1 turn"]++;
      else if (t <= 3) turnBuckets["2-3 turns"]++;
      else if (t <= 5) turnBuckets["4-5 turns"]++;
      else if (t <= 10) turnBuckets["6-10 turns"]++;
      else turnBuckets["10+ turns"]++;
    });

    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Conversation Length Distribution",
      data: Object.entries(turnBuckets).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value })),
      unit: "sessions",
    });

    return {
      success: true,
      toolName: "conversation_intelligence",
      summary: `Conversations: ${totalSessions} sessions, avg ${avgTurns.toFixed(1)} turns, ${longConvs.length} long conversations (5+ turns), ${totalErrors} errors.`,
      blocks,
      dql: statsDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Quality scores", query: "Show AI quality scores" },
        { label: "Response analytics", query: "Analyze response quality" },
        { label: "Error investigation", query: "Investigate conversation errors" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Developer Experience)
// ============================================

const developerExperience: AgentTool = {
  name: "developer_experience",
  label: "Developer Experience",
  description: "Show instrumentation coverage, integration health, and shadow AI detection for developers",
  triggers: ["developer", "instrumentation", "coverage", "integration", "shadow ai", "dev experience", "sdk", "opentelemetry", "otel"],
  examples: ["Show instrumentation coverage", "Any shadow AI?", "How well instrumented are my AI services?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Instrumentation coverage
    const coverageDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_spans = count(),
    has_model = countIf(isNotNull(gen_ai.request.model) AND gen_ai.request.model != ""),
    has_provider = countIf(isNotNull(gen_ai.provider.name) AND gen_ai.provider.name != ""),
    has_input_tokens = countIf(isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)),
    has_output_tokens = countIf(isNotNull(gen_ai.usage.output_tokens) OR isNotNull(gen_ai.usage.completion_tokens)),
    has_prompt = countIf(isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.prompt.1.content)),
    has_completion = countIf(isNotNull(gen_ai.completion.0.content)),
    has_conversation_id = countIf(isNotNull(gen_ai.conversation.id)),
    has_error_type = countIf(isNotNull(error.type)),
    has_cost = countIf(isNotNull(gen_ai.usage.cost))
  }, by: { service = dt.entity.service }
| sort total_spans desc`;

    // Integration report per provider/SDK
    const integrationDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    model_coverage = countIf(isNotNull(gen_ai.request.model)) / count() * 100,
    token_coverage = countIf(isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)) / count() * 100,
    prompt_coverage = countIf(isNotNull(gen_ai.prompt.0.content)) / count() * 100,
    error_rate = countIf(span.status_code == "error") / count() * 100,
    services = collectDistinct(dt.entity.service)
  }, by: { gen_ai.provider.name }
| sort request_count desc`;

    const [coverage, integrations] = await Promise.all([
      safeDql(coverageDql),
      safeDql(integrationDql),
    ]);

    const blocks: MessageBlock[] = [];

    if (coverage.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No GenAI spans found." });
      return { success: true, toolName: "developer_experience", summary: "No AI instrumentation data.", blocks, executionTimeMs: Date.now() - start };
    }

    // Overall coverage metrics
    const totalSpans = coverage.reduce((s: number, r: any) => s + Number(r.total_spans || 0), 0);
    const totalWithModel = coverage.reduce((s: number, r: any) => s + Number(r.has_model || 0), 0);
    const totalWithTokens = coverage.reduce((s: number, r: any) => s + Number(r.has_input_tokens || 0), 0);
    const totalWithPrompt = coverage.reduce((s: number, r: any) => s + Number(r.has_prompt || 0), 0);
    const totalWithConvId = coverage.reduce((s: number, r: any) => s + Number(r.has_conversation_id || 0), 0);

    const modelCovPct = totalSpans > 0 ? (totalWithModel / totalSpans * 100).toFixed(0) : "0";
    const tokenCovPct = totalSpans > 0 ? (totalWithTokens / totalSpans * 100).toFixed(0) : "0";
    const promptCovPct = totalSpans > 0 ? (totalWithPrompt / totalSpans * 100).toFixed(0) : "0";
    const convCovPct = totalSpans > 0 ? (totalWithConvId / totalSpans * 100).toFixed(0) : "0";

    blocks.push({
      type: "metric",
      metrics: [
        { label: "AI Services", value: coverage.length },
        { label: "Total Spans", value: fmt(totalSpans) },
        { label: "Model Coverage", value: `${modelCovPct}%`, severity: Number(modelCovPct) >= 90 ? "healthy" : "warning" },
        { label: "Token Coverage", value: `${tokenCovPct}%`, severity: Number(tokenCovPct) >= 80 ? "healthy" : "warning" },
        { label: "Prompt Capture", value: `${promptCovPct}%` },
        { label: "Conversation ID", value: `${convCovPct}%` },
      ],
    });

    // Per-service coverage table
    blocks.push({
      type: "table",
      headers: ["Service", "Spans", "Model %", "Tokens %", "Prompt %", "Conv ID %", "Cost %"],
      rows: coverage.map((r: any) => {
        const t = Number(r.total_spans || 1);
        return [
          String(r.service || "â€”"),
          fmt(t),
          `${(Number(r.has_model || 0) / t * 100).toFixed(0)}%`,
          `${(Number(r.has_input_tokens || 0) / t * 100).toFixed(0)}%`,
          `${(Number(r.has_prompt || 0) / t * 100).toFixed(0)}%`,
          `${(Number(r.has_conversation_id || 0) / t * 100).toFixed(0)}%`,
          `${(Number(r.has_cost || 0) / t * 100).toFixed(0)}%`,
        ];
      }),
      caption: "Instrumentation Coverage by Service",
    });

    // Integration health per provider
    if (integrations.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Provider", "Requests", "Model %", "Token %", "Prompt %", "Error Rate", "Services"],
        rows: integrations.map((r: any) => [
          r["gen_ai.provider.name"] || "â€”",
          fmt(Number(r.request_count || 0)),
          `${Number(r.model_coverage || 0).toFixed(0)}%`,
          `${Number(r.token_coverage || 0).toFixed(0)}%`,
          `${Number(r.prompt_coverage || 0).toFixed(0)}%`,
          `${Number(r.error_rate || 0).toFixed(1)}%`,
          Array.isArray(r.services) ? r.services.filter(Boolean).length.toString() : "â€”",
        ]),
        caption: "Integration Health by Provider",
      });
    }

    // Coverage bar chart
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Attribute Coverage Breakdown",
      data: [
        { label: "Model Name", value: Number(modelCovPct) },
        { label: "Token Usage", value: Number(tokenCovPct) },
        { label: "Prompt Content", value: Number(promptCovPct) },
        { label: "Conversation ID", value: Number(convCovPct) },
      ],
      unit: "%",
    });

    return {
      success: true,
      toolName: "developer_experience",
      summary: `Developer Experience: ${coverage.length} services, Model coverage ${modelCovPct}%, Token coverage ${tokenCovPct}%, Prompt capture ${promptCovPct}%.`,
      blocks,
      dql: coverageDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Quality scores", query: "Show AI quality scores" },
        { label: "Topology", query: "Show AI topology" },
        { label: "Governance", query: "Show compliance audit" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Governance & Compliance)
// ============================================

const governance: AgentTool = {
  name: "governance",
  label: "Governance & Compliance",
  description: "Show AI compliance audit trail â€” recent invocations, policy adherence, and usage auditing",
  triggers: ["governance", "compliance", "audit", "audit trail", "policy", "regulation", "gdpr", "responsible ai", "guardrails"],
  examples: ["Show compliance audit trail", "AI governance report", "Who's using AI and how?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Audit trail â€” recent AI invocations
    const auditDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fields
    timestamp = start_time,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
    output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0),
    latency_ns = duration,
    has_error = (span.status_code == "error" OR isNotNull(error.type)),
    trace_id = trace.id,
    service = dt.entity.service
| sort timestamp desc
| limit 100`;

    // Usage by service (for policy adherence)
    const usageDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model),
    has_pii_flag = countIf(isNotNull(gen_ai.prompt.pii_detected))
  }, by: { service = dt.entity.service }
| sort request_count desc
| limit 30`;

    const [audit, usage] = await Promise.all([
      safeDql(auditDql),
      safeDql(usageDql),
    ]);

    const blocks: MessageBlock[] = [];

    const totalInvocations = audit.length;
    const totalErrors = audit.filter((r: any) => r.has_error === true || r.has_error === "true").length;
    const uniqueServices = usage.length;
    const totalTokens = usage.reduce((s: number, r: any) => s + Number(r.total_tokens || 0), 0);

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Recent Invocations", value: totalInvocations },
        { label: "Services Using AI", value: uniqueServices },
        { label: "Total Tokens", value: fmt(totalTokens) },
        { label: "Error Invocations", value: totalErrors, severity: totalErrors > 0 ? "warning" : "healthy" },
      ],
    });

    // Audit trail table
    if (audit.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Time", "Service", "Provider", "Model", "In Tokens", "Out Tokens", "Error?"],
        rows: audit.slice(0, 25).map((r: any) => [
          r.timestamp ? new Date(r.timestamp).toLocaleString() : "â€”",
          String(r.service || "â€”"),
          r.provider || "â€”",
          r.model || "â€”",
          fmt(Number(r.input_tokens || 0)),
          fmt(Number(r.output_tokens || 0)),
          (r.has_error === true || r.has_error === "true") ? "âš ï¸ Yes" : "âœ“ No",
        ]),
        caption: "AI Invocation Audit Trail (latest 25)",
      });
    }

    // Per-service usage breakdown
    if (usage.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Service", "Requests", "Errors", "Tokens", "Providers", "Models"],
        rows: usage.map((r: any) => [
          String(r.service || "â€”"),
          fmt(Number(r.request_count || 0)),
          fmt(Number(r.error_count || 0)),
          fmt(Number(r.total_tokens || 0)),
          Array.isArray(r.providers) ? r.providers.filter(Boolean).join(", ") : "â€”",
          Array.isArray(r.models) ? r.models.filter(Boolean).join(", ") : "â€”",
        ]),
        caption: "AI Usage by Service (Compliance View)",
      });
    }

    // Token distribution chart
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Token Usage by Service",
      data: usage.slice(0, 10).map((r: any) => ({
        label: String(r.service || "Unknown"),
        value: Number(r.total_tokens || 0),
      })),
      unit: "tokens",
    });

    return {
      success: true,
      toolName: "governance",
      summary: `Governance: ${totalInvocations} recent invocations across ${uniqueServices} services, ${totalErrors} errors, ${fmt(totalTokens)} total tokens.`,
      blocks,
      dql: auditDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Prompt security", query: "Analyze prompts for PII and injection" },
        { label: "Quality scores", query: "Show AI quality scores" },
        { label: "Cost breakdown", query: "Show AI cost breakdown" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (Response Analytics)
// ============================================

const responseAnalytics: AgentTool = {
  name: "response_analytics",
  label: "Response Analytics",
  description: "Analyze AI response quality â€” token efficiency, output variance, latency distribution, and quality trends",
  triggers: ["response", "response analytics", "response quality", "output quality", "token efficiency", "token ratio", "output variance"],
  examples: ["Analyze response quality", "Show token efficiency", "Are my AI outputs consistent?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    const dql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0)),
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
    output_variance = variance(coalesce(gen_ai.usage.output_tokens, 0)),
    avg_latency = avg(duration) / 1000000,
    p95_latency = percentile(duration / 1000000, 95),
    low_output_count = countIf(coalesce(gen_ai.usage.output_tokens, 0) < 10 AND coalesce(gen_ai.usage.output_tokens, 0) >= 0),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
  }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
| fieldsAdd output_std_dev = sqrt(output_variance)
| fieldsAdd token_ratio = if(avg_input_tokens > 0, then: avg_output_tokens / avg_input_tokens, else: 0)
| fieldsAdd low_output_rate = if(request_count > 0, then: low_output_count / request_count * 100, else: 0)
| fieldsAdd error_rate = if(request_count > 0, then: error_count / request_count * 100, else: 0)
| sort request_count desc
| limit 100`;

    const records = await safeDql(dql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No response analytics data available." });
      return { success: true, toolName: "response_analytics", summary: "No response data.", blocks, executionTimeMs: Date.now() - start };
    }

    const totalReqs = records.reduce((s: number, r: any) => s + Number(r.request_count || 0), 0);
    const avgTokenRatio = records.reduce((s: number, r: any) => s + Number(r.token_ratio || 0), 0) / records.length;
    const avgLowOutput = records.reduce((s: number, r: any) => s + Number(r.low_output_rate || 0), 0) / records.length;
    const avgErrorRate = records.reduce((s: number, r: any) => s + Number(r.error_rate || 0), 0) / records.length;

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Models/Services", value: records.length },
        { label: "Total Requests", value: fmt(totalReqs) },
        { label: "Avg Token Ratio", value: avgTokenRatio.toFixed(2), severity: avgTokenRatio > 0.5 ? "healthy" : "warning" },
        { label: "Low Output Rate", value: `${avgLowOutput.toFixed(1)}%`, severity: avgLowOutput < 5 ? "healthy" : "warning" },
        { label: "Avg Error Rate", value: `${avgErrorRate.toFixed(1)}%`, severity: avgErrorRate < 2 ? "healthy" : avgErrorRate < 10 ? "warning" : "critical" },
      ],
    });

    // Detailed response analytics table
    blocks.push({
      type: "table",
      headers: ["Model", "Provider", "Requests", "Avg In Tokens", "Avg Out Tokens", "Token Ratio", "Std Dev", "Low Output %", "Avg Latency", "P95 Latency"],
      rows: records.slice(0, 20).map((r: any) => [
        r["gen_ai.request.model"] || "â€”",
        r["gen_ai.provider.name"] || "â€”",
        fmt(Number(r.request_count || 0)),
        fmt(Number(r.avg_input_tokens || 0), 0),
        fmt(Number(r.avg_output_tokens || 0), 0),
        Number(r.token_ratio || 0).toFixed(2),
        fmt(Number(r.output_std_dev || 0), 0),
        `${Number(r.low_output_rate || 0).toFixed(1)}%`,
        `${Number(r.avg_latency || 0).toFixed(0)}ms`,
        `${Number(r.p95_latency || 0).toFixed(0)}ms`,
      ]),
      caption: "Response Quality by Model",
    });

    // Token ratio bar chart
    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "Token Ratio by Model (Output/Input)",
      data: records.slice(0, 10).map((r: any) => ({
        label: r["gen_ai.request.model"] || String(r["dt.entity.service"] || "â€”"),
        value: Number(r.token_ratio || 0),
      })),
      unit: "ratio",
    });

    return {
      success: true,
      toolName: "response_analytics",
      summary: `Response Analytics: ${records.length} model/service combos, avg token ratio ${avgTokenRatio.toFixed(2)}, ${avgLowOutput.toFixed(1)}% low output rate.`,
      blocks,
      dql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Quality scores", query: "Show AI quality scores" },
        { label: "Cost optimization", query: "How can I reduce AI costs?" },
        { label: "Model comparison", query: "Compare my models" },
      ],
    };
  },
};

// ============================================
// TIER 1 â€” OBSERVE (Live Problems)
// ============================================

const liveProblems: AgentTool = {
  name: "live_problems",
  label: "Live Problems & Alerts",
  description: "Show Davis-detected problems affecting AI services, plus recent workflow executions",
  triggers: ["problems", "alerts", "live problems", "davis problems", "incidents", "outage", "down", "workflow", "workflows", "operations"],
  examples: ["Any live problems?", "Show AI alerts", "What workflows ran recently?"],
  parameters: [],
  tier: 1,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // GenAI service discovery
    const servicesDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize request_count = count(), by: { dt.entity.service }
| limit 100`;

    // Davis problems
    const problemsDql = `fetch dt.davis.problems, from:now()-${ctx.timeframe}
| fields problem_id = event.id, display_id, title = event.name,
         status = event.status, severity = event.category,
         affected_entities = affected_entity_ids,
         root_cause = root_cause_entity_name,
         start_time = event.start, end_time = event.end
| sort start_time desc
| limit 200`;

    // Recent workflow executions
    const workflowsDql = `fetch bizevents, from: now()-7d, to: now()
| filter event.type == "automation.workflow.run.finished" OR
        event.type == "automation.workflow.run.started"
| summarize {
    runs = count(),
    last_run = max(timestamp)
  }, by: { workflow.id, workflow.title }
| sort runs desc
| limit 20`;

    const [services, problems, workflows] = await Promise.all([
      safeDql(servicesDql),
      safeDql(problemsDql),
      safeDql(workflowsDql),
    ]);

    const blocks: MessageBlock[] = [];

    // Filter problems to only those affecting AI services
    const aiServiceIds = new Set(services.map((r: any) => r["dt.entity.service"]).filter(Boolean));
    const aiProblems = problems.filter((r: any) => {
      const affected = r.affected_entities;
      if (Array.isArray(affected)) return affected.some((e: string) => aiServiceIds.has(e));
      return true; // If we can't filter, show it
    });

    const openProblems = aiProblems.filter((r: any) => r.status === "OPEN");

    blocks.push({
      type: "metric",
      metrics: [
        { label: "AI Services", value: services.length },
        { label: "Total Problems", value: aiProblems.length, severity: aiProblems.length > 0 ? "warning" : "healthy" },
        { label: "Open Problems", value: openProblems.length, severity: openProblems.length > 0 ? "critical" : "healthy" },
        { label: "Workflows", value: workflows.length },
      ],
    });

    if (openProblems.length > 0) {
      blocks.push({ type: "alert", severity: "critical", title: "Active Problems", message: `${openProblems.length} open problem(s) affecting AI services.` });
    }

    if (aiProblems.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Problem", "Status", "Severity", "Root Cause", "Start Time"],
        rows: aiProblems.slice(0, 20).map((r: any) => [
          r.title || r.display_id || "â€”",
          r.status || "â€”",
          r.severity || "â€”",
          r.root_cause || "â€”",
          r.start_time ? new Date(r.start_time).toLocaleString() : "â€”",
        ]),
        caption: "Recent Problems",
      });
    } else {
      blocks.push({ type: "alert", severity: "success", title: "No Problems", message: "No Davis-detected problems found for AI services." });
    }

    if (workflows.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Workflow", "Runs", "Last Run"],
        rows: workflows.map((r: any) => [
          r["workflow.title"] || r["workflow.id"] || "â€”",
          fmt(Number(r.runs || 0)),
          r.last_run ? new Date(r.last_run).toLocaleString() : "â€”",
        ]),
        caption: "Recent Workflow Executions",
      });
    }

    return {
      success: true,
      toolName: "live_problems",
      summary: `Live Status: ${aiProblems.length} problems (${openProblems.length} open), ${services.length} AI services, ${workflows.length} workflows.`,
      blocks,
      dql: problemsDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Error investigation", query: "Investigate AI errors in detail" },
        { label: "Service health", query: "Show AI service health" },
        { label: "Cost impact", query: "Show cost breakdown" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (AI Architect)
// ============================================

const aiArchitect: AgentTool = {
  name: "ai_architect",
  label: "AI Architect",
  description: "Get architecture recommendations â€” detect anti-patterns, provider concentration, and optimization opportunities",
  triggers: ["architect", "architecture", "recommendations", "anti-pattern", "optimize architecture", "best practices", "design review", "ai architect"],
  examples: ["Review my AI architecture", "Any anti-patterns?", "How can I improve my AI setup?"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();

    // Get comprehensive architecture data
    const archDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration) / 1000000,
    p95_latency = percentile(duration / 1000000, 95),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    models = collectDistinct(gen_ai.request.model),
    span_types = collectDistinct(span.name)
  }, by: { service = dt.entity.service, gen_ai.provider.name }
| sort request_count desc
| limit 100`;

    const records = await safeDql(archDql);
    const blocks: MessageBlock[] = [];

    if (records.length === 0) {
      blocks.push({ type: "alert", severity: "info", title: "No Data", message: "No AI architecture data available." });
      return { success: true, toolName: "ai_architect", summary: "No AI architecture data.", blocks, executionTimeMs: Date.now() - start };
    }

    const recommendations: Array<{ severity: "info" | "warning" | "critical"; title: string; message: string }> = [];

    // Anti-pattern 1: Single provider concentration
    const providerMap: Record<string, number> = {};
    records.forEach((r: any) => {
      const p = r["gen_ai.provider.name"] || "Unknown";
      providerMap[p] = (providerMap[p] || 0) + Number(r.request_count || 0);
    });
    const providers = Object.entries(providerMap).sort(([, a], [, b]) => b - a);
    const totalReqs = providers.reduce((s, [, v]) => s + v, 0);
    if (providers.length === 1) {
      recommendations.push({ severity: "warning", title: "Single Provider Risk", message: `All ${fmt(totalReqs)} requests go to ${providers[0][0]}. Consider multi-provider strategy for resilience.` });
    } else if (providers.length > 1 && providers[0][1] / totalReqs > 0.85) {
      recommendations.push({ severity: "warning", title: "Provider Concentration", message: `${providers[0][0]} handles ${(providers[0][1] / totalReqs * 100).toFixed(0)}% of traffic. Consider load balancing across providers.` });
    } else if (providers.length > 1) {
      recommendations.push({ severity: "info", title: "Multi-Provider âœ“", message: `Good: ${providers.length} providers in use with distributed traffic.` });
    }

    // Anti-pattern 2: High error rate services
    const highErrorServices = records.filter((r: any) => {
      const reqs = Number(r.request_count || 0);
      return reqs > 10 && Number(r.error_count || 0) / reqs > 0.1;
    });
    if (highErrorServices.length > 0) {
      recommendations.push({ severity: "critical", title: "High Error Services", message: `${highErrorServices.length} service(s) with >10% error rate. Investigate: ${highErrorServices.map((r: any) => String(r.service || "â€”")).join(", ")}` });
    }

    // Anti-pattern 3: High latency
    const highLatencyRecords = records.filter((r: any) => Number(r.avg_latency || 0) > 5000);
    if (highLatencyRecords.length > 0) {
      recommendations.push({ severity: "warning", title: "High Latency", message: `${highLatencyRecords.length} service/provider combo(s) averaging >5s latency. Consider caching or model switching.` });
    }

    // Anti-pattern 4: P95/Avg ratio (tail latency)
    const tailLatencyIssues = records.filter((r: any) => {
      const avg = Number(r.avg_latency || 0);
      const p95 = Number(r.p95_latency || 0);
      return avg > 0 && p95 / avg > 4;
    });
    if (tailLatencyIssues.length > 0) {
      recommendations.push({ severity: "warning", title: "Tail Latency Spikes", message: `${tailLatencyIssues.length} combo(s) with P95 latency >4x average. May indicate intermittent provider issues.` });
    }

    blocks.push({
      type: "metric",
      metrics: [
        { label: "Providers", value: providers.length },
        { label: "Services", value: new Set(records.map((r: any) => r.service)).size },
        { label: "Recommendations", value: recommendations.length },
        { label: "Critical Issues", value: recommendations.filter(r => r.severity === "critical").length, severity: recommendations.some(r => r.severity === "critical") ? "critical" : "healthy" },
      ],
    });

    // Recommendations as alerts
    recommendations.forEach(r => blocks.push({ type: "alert", severity: r.severity, title: r.title, message: r.message }));

    // Architecture overview table
    blocks.push({
      type: "table",
      headers: ["Service", "Provider", "Requests", "Error Rate", "Avg Latency", "P95 Latency", "Tokens", "Models"],
      rows: records.slice(0, 20).map((r: any) => {
        const reqs = Number(r.request_count || 0);
        return [
          String(r.service || "â€”"),
          r["gen_ai.provider.name"] || "â€”",
          fmt(reqs),
          `${reqs > 0 ? (Number(r.error_count || 0) / reqs * 100).toFixed(1) : "0"}%`,
          `${Number(r.avg_latency || 0).toFixed(0)}ms`,
          `${Number(r.p95_latency || 0).toFixed(0)}ms`,
          fmt(Number(r.total_tokens || 0)),
          Array.isArray(r.models) ? r.models.filter(Boolean).join(", ") : "â€”",
        ];
      }),
      caption: "Architecture Overview",
    });

    // Provider distribution pie chart
    blocks.push({
      type: "chart",
      chartType: "pie",
      title: "Traffic Distribution by Provider",
      data: providers.map(([label, value]) => ({ label, value })),
      unit: "requests",
    });

    return {
      success: true,
      toolName: "ai_architect",
      summary: `AI Architect: ${recommendations.length} recommendations (${recommendations.filter(r => r.severity === "critical").length} critical). ${providers.length} providers, ${new Set(records.map((r: any) => r.service)).size} services.`,
      blocks,
      dql: archDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Cost optimization", query: "How can I reduce AI costs?" },
        { label: "Provider comparison", query: "Compare my AI providers in detail" },
        { label: "Error investigation", query: "Investigate high error services" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (Security Posture)
// ============================================

const securityPosture: AgentTool = {
  name: "security_posture",
  label: "Security Posture Analysis",
  description: "Analyze AI security posture: PII detection events, prompt injection attempts, and incident response metrics",
  triggers: ["security", "pii", "prompt injection", "incidents", "audit trail", "compliance", "data leak", "sensitive data", "security posture"],
  examples: ["What's our AI security posture?", "Any PII leaks detected?", "Show security incidents"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    // Security events from gen_ai spans
    const secEventsDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name)
| filter span.status_code == "error"
| filter matchesPhrase(error.message, "pii") OR matchesPhrase(error.message, "injection") OR matchesPhrase(error.message, "blocked") OR matchesPhrase(error.message, "denied") OR matchesPhrase(error.message, "unauthorized")
| summarize count = count(), last_seen = max(start_time), by: { error_type = error.message, service = service.name, provider = gen_ai.provider.name }
| sort count desc
| limit 30`;

    // Overall error classification for security signals
    const secOverviewDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name)
| summarize
    total = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    by: { service = service.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
| sort error_rate desc
| limit 20`;

    const [secEvents, overview] = await Promise.all([
      safeDql(secEventsDql),
      safeDql(secOverviewDql),
    ]);

    const totalSecEvents = secEvents.reduce((s: number, r: any) => s + (Number(r.count) || 0), 0);
    const highRiskServices = overview.filter((r: any) => (Number(r.error_rate) || 0) > 10);

    blocks.push({
      type: "text",
      content: `**Security Overview**: ${totalSecEvents} security-related events detected across ${secEvents.length} patterns. ${highRiskServices.length} high-risk services (>10% error rate).`,
    });

    if (secEvents.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Error Pattern", "Service", "Provider", "Count", "Last Seen"],
        rows: secEvents.slice(0, 15).map((r: any) => [
          String(r.error_type || "â€”").slice(0, 60),
          r.service || "â€”",
          r.provider || "â€”",
          String(Number(r.count) || 0),
          r.last_seen ? new Date(String(r.last_seen)).toLocaleString() : "â€”",
        ]),
        caption: "Security Event Patterns",
      });
    }

    if (overview.length > 0) {
      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Service Error Rate (Security Signal)",
        data: overview.slice(0, 10).map((r: any) => ({
          label: String(r.service || "unknown"),
          value: Number(r.error_rate) || 0,
        })),
        unit: "%",
      });
    }

    return {
      success: true,
      toolName: "security_posture",
      summary: `Security Posture: ${totalSecEvents} security events, ${secEvents.length} patterns, ${highRiskServices.length} high-risk services.`,
      blocks,
      dql: secEventsDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Top errors", query: "What are the top AI errors?" },
        { label: "Governance", query: "Show governance compliance" },
        { label: "Provider health", query: "Show provider health status" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (RAG Health Score)
// ============================================

const ragHealthScore: AgentTool = {
  name: "rag_health_score",
  label: "RAG Health Score",
  description: "Compute composite RAG pipeline health from latency, freshness, completeness, error rates, and cache efficiency",
  triggers: ["rag health", "rag score", "rag pipeline health", "vector health", "embedding health", "retrieval health", "rag quality"],
  examples: ["What's the RAG health score?", "Is my RAG pipeline healthy?", "Check retrieval quality"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    // RAG latency
    const latDql = `fetch spans, from:now()-${ctx.timeframe}
| filter in(span.kind, array("INTERNAL","CLIENT")) AND (matchesPhrase(span.name, "retriev") OR matchesPhrase(span.name, "vector") OR matchesPhrase(span.name, "embed") OR matchesPhrase(span.name, "rag") OR matchesPhrase(span.name, "search") OR matchesPhrase(span.name, "pinecone"))
| summarize p50_ms = percentile(duration, 50) / 1000000, p95_ms = percentile(duration, 95) / 1000000, count = count()`;

    // RAG errors
    const errDql = `fetch spans, from:now()-${ctx.timeframe}
| filter in(span.kind, array("INTERNAL","CLIENT")) AND (matchesPhrase(span.name, "retriev") OR matchesPhrase(span.name, "vector") OR matchesPhrase(span.name, "embed") OR matchesPhrase(span.name, "rag") OR matchesPhrase(span.name, "pinecone"))
| summarize total = count(), errors = countIf(span.status_code == "error")
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)`;

    // Pipeline completeness
    const pipeDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name) OR matchesPhrase(span.name, "retriev") OR matchesPhrase(span.name, "embed")
| summarize total_traces = countDistinct(trace_id)
| lookup [
    fetch spans, from:now()-${ctx.timeframe}
    | filter matchesPhrase(span.name, "retriev") OR matchesPhrase(span.name, "vector") OR matchesPhrase(span.name, "embed")
    | summarize rag_traces = countDistinct(trace_id)
  ], sourceField:total_traces, lookupField:rag_traces, prefix:"lookup."`;

    const [latRecs, errRecs, pipeRecs] = await Promise.all([
      safeDql(latDql),
      safeDql(errDql),
      safeDql(pipeDql),
    ]);

    const p95 = latRecs[0] ? Number(latRecs[0].p95_ms) || 0 : 0;
    const spanCount = latRecs[0] ? Number(latRecs[0].count) || 0 : 0;
    const errorRate = errRecs[0] ? Number(errRecs[0].error_rate) || 0 : 0;

    // Score: latency (0-100), error rate (0-100)
    const latScore = p95 <= 200 ? 100 : p95 >= 2000 ? 0 : Math.round(100 * (1 - (p95 - 200) / 1800));
    const errScore = errorRate <= 0 ? 100 : errorRate >= 20 ? 0 : Math.round(100 * (1 - errorRate / 20));
    const composite = Math.round(latScore * 0.45 + errScore * 0.55);

    const healthLabel = composite >= 80 ? "Healthy" : composite >= 50 ? "Degraded" : "Critical";

    blocks.push({
      type: "text",
      content: `**RAG Health Score: ${composite}/100 (${healthLabel})**\n\n- Latency Score: ${latScore}/100 (p95: ${p95.toFixed(0)}ms)\n- Error Score: ${errScore}/100 (error rate: ${errorRate.toFixed(1)}%)\n- Total RAG spans: ${fmt(spanCount)}`,
    });

    blocks.push({
      type: "chart",
      chartType: "bar",
      title: "RAG Health Dimensions",
      data: [
        { label: "Latency", value: latScore },
        { label: "Error Rate", value: errScore },
        { label: "Composite", value: composite },
      ],
      unit: "score",
    });

    return {
      success: true,
      toolName: "rag_health_score",
      summary: `RAG Health: ${composite}/100 (${healthLabel}). p95 latency ${p95.toFixed(0)}ms, error rate ${errorRate.toFixed(1)}%.`,
      blocks,
      dql: latDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "RAG pipeline", query: "Show RAG pipeline details" },
        { label: "Embeddings", query: "Show embedding analytics" },
        { label: "Cost impact", query: "What's the RAG cost?" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (Agent Optimization)
// ============================================

const agentOptimization: AgentTool = {
  name: "agent_optimization",
  label: "Agent Anti-Pattern Detection",
  description: "Detect agent anti-patterns: excessive retries, tool loops, token waste, slow chains, and compute per-agent optimization scores",
  triggers: ["agent optimization", "anti-pattern", "agent health", "agent score", "retries", "tool loop", "token waste", "agent efficiency"],
  examples: ["Are there agent anti-patterns?", "Show agent optimization scores", "Detect tool loops"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    // Retry pattern detection
    const retryDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name)
| summarize call_count = count(), error_count = countIf(span.status_code == "error"), by: { trace_id, agent = service.name, tool = span.name }
| filter call_count > 3
| sort call_count desc
| limit 30`;

    // Token usage per agent
    const tokenDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name)
| fieldsAdd input_tokens = coalesce(asLong(gen_ai.usage.input_tokens), asLong(gen_ai.usage.prompt_tokens), 0)
| fieldsAdd output_tokens = coalesce(asLong(gen_ai.usage.output_tokens), asLong(gen_ai.usage.completion_tokens), 0)
| summarize
    total_input = sum(input_tokens),
    total_output = sum(output_tokens),
    calls = count(),
    avg_input = avg(input_tokens),
    by: { agent = service.name }
| fieldsAdd tokens_per_call = toDouble(total_input + total_output) / toDouble(calls)
| sort tokens_per_call desc
| limit 20`;

    const [retryRecs, tokenRecs] = await Promise.all([
      safeDql(retryDql),
      safeDql(tokenDql),
    ]);

    const retryPatterns = retryRecs.filter((r: any) => (Number(r.call_count) || 0) > 5);
    const highTokenAgents = tokenRecs.filter((r: any) => (Number(r.tokens_per_call) || 0) > 5000);

    blocks.push({
      type: "text",
      content: `**Agent Optimization Analysis**\n\n- ${retryPatterns.length} excessive retry patterns detected (>5 calls per tool/trace)\n- ${highTokenAgents.length} agents with high token consumption (>5K tokens/call)\n- ${tokenRecs.length} agents analyzed`,
    });

    if (retryPatterns.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Agent", "Tool", "Call Count", "Errors", "Trace ID"],
        rows: retryPatterns.slice(0, 10).map((r: any) => [
          r.agent || "â€”",
          r.tool || "â€”",
          String(Number(r.call_count) || 0),
          String(Number(r.error_count) || 0),
          String(r.trace_id || "â€”").slice(0, 16) + "â€¦",
        ]),
        caption: "Excessive Retry Patterns (Anti-Pattern)",
      });
    }

    if (tokenRecs.length > 0) {
      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Tokens per Call by Agent",
        data: tokenRecs.slice(0, 10).map((r: any) => ({
          label: String(r.agent || "unknown"),
          value: Number(r.tokens_per_call) || 0,
        })),
        unit: "tokens",
      });
    }

    return {
      success: true,
      toolName: "agent_optimization",
      summary: `Agent Optimization: ${retryPatterns.length} retry anti-patterns, ${highTokenAgents.length} high-token agents across ${tokenRecs.length} total.`,
      blocks,
      dql: retryDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Agent overview", query: "Show agent overview" },
        { label: "Cost impact", query: "What's the AI cost breakdown?" },
        { label: "Model drift", query: "Any model drift detected?" },
      ],
    };
  },
};

// ============================================
// TIER 2 â€” ANALYZE (Provider Failover)
// ============================================

const providerFailover: AgentTool = {
  name: "provider_failover",
  label: "Provider Failover Analysis",
  description: "Analyze provider health index, failover readiness, and detect sustained degradation across AI providers",
  triggers: ["provider failover", "provider health", "provider status", "failover", "provider down", "provider degraded", "provider availability", "failover readiness"],
  examples: ["Is any provider down?", "What's the failover readiness?", "Show provider health index"],
  parameters: [],
  tier: 2,
  execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
    const start = Date.now();
    const blocks: MessageBlock[] = [];

    const healthDql = `fetch spans, from:now()-${ctx.timeframe}
| filter isNotNull(gen_ai.provider.name)
| summarize
    total = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_ms = avg(duration) / 1000000,
    p95_ms = percentile(duration, 95) / 1000000,
    p99_ms = percentile(duration, 99) / 1000000
  , by: { provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
| fieldsAdd availability = round(100.0 * (1.0 - toDouble(errors) / toDouble(total)), 2)
| sort total desc`;

    const records = await safeDql(healthDql);

    // Compute health index per provider
    const providers = records.map((r: any) => {
      const errRate = Number(r.error_rate) || 0;
      const p95 = Number(r.p95_ms) || 0;
      const avail = Number(r.availability) || 100;

      const relScore = errRate <= 0 ? 100 : errRate >= 10 ? 0 : Math.round(100 * (1 - errRate / 10));
      const perfScore = p95 <= 500 ? 100 : p95 >= 5000 ? 0 : Math.round(100 * (1 - (p95 - 500) / 4500));
      const availScore = avail >= 99.9 ? 100 : avail < 90 ? 0 : Math.round((avail - 90) * 10);
      const healthIndex = Math.round(relScore * 0.35 + perfScore * 0.25 + availScore * 0.40);
      const status = healthIndex >= 80 ? "Healthy" : healthIndex >= 60 ? "Degraded" : healthIndex >= 30 ? "Critical" : "Down";

      return {
        provider: String(r.provider || "unknown"),
        healthIndex,
        status,
        total: Number(r.total) || 0,
        errRate,
        p95,
        avail,
      };
    });

    const unhealthy = providers.filter((p) => p.status === "Critical" || p.status === "Down");
    const healthyCount = providers.filter((p) => p.status === "Healthy").length;

    // Readiness: how many healthy alternatives exist
    const readiness = providers.length > 1 && healthyCount >= 2
      ? Math.round((healthyCount / providers.length) * 100)
      : providers.length === 1 ? 20 : 0;

    blocks.push({
      type: "text",
      content: `**Provider Failover Readiness: ${readiness}/100**\n\n${providers.length} providers monitored: ${healthyCount} healthy, ${unhealthy.length} critical/down.\n\n${unhealthy.length > 0 ? `âš ï¸ **Action needed**: ${unhealthy.map((p) => `${p.provider} (health ${p.healthIndex})`).join(", ")}` : "âœ… All providers healthy."}`,
    });

    if (providers.length > 0) {
      blocks.push({
        type: "table",
        headers: ["Provider", "Health", "Status", "Requests", "Error Rate", "p95 Latency", "Availability"],
        rows: providers.map((p) => [
          p.provider,
          `${p.healthIndex}/100`,
          p.status,
          fmt(p.total),
          `${p.errRate.toFixed(1)}%`,
          `${p.p95.toFixed(0)}ms`,
          `${p.avail.toFixed(1)}%`,
        ]),
        caption: "Provider Health Index",
      });

      blocks.push({
        type: "chart",
        chartType: "bar",
        title: "Provider Health Index",
        data: providers.map((p) => ({ label: p.provider, value: p.healthIndex })),
        unit: "score",
      });
    }

    return {
      success: true,
      toolName: "provider_failover",
      summary: `Provider Failover: readiness ${readiness}/100, ${providers.length} providers, ${unhealthy.length} unhealthy. ${unhealthy.length > 0 ? `Action needed for: ${unhealthy.map((p) => p.provider).join(", ")}` : "All healthy."}`,
      blocks,
      dql: healthDql,
      executionTimeMs: Date.now() - start,
      followUps: [
        { label: "Provider comparison", query: "Compare providers" },
        { label: "Error investigation", query: "Investigate top errors" },
        { label: "Infrastructure", query: "Show infrastructure health" },
      ],
    };
  },
};

// ============================================
// TOOL REGISTRY
// ============================================

export const TOOL_REGISTRY: AgentTool[] = [
  // Tier 1 â€” Observe (Core)
  serviceHealth,
  providerComparison,
  modelComparison,
  topErrors,
  costBreakdown,
  latencyAnalysis,
  tokenUsage,
  // Tier 1 â€” Observe (Inventory & Discovery)
  inventoryOverview,
  agentOverview,
  modelInventory,
  providerInventory,
  usageTrends,
  // Tier 1 â€” Observe (Embedding & RAG)
  embeddingAnalytics,
  ragPipeline,
  // Tier 1 â€” Observe (Topology & Architecture)
  aiTopology,
  infrastructure,
  // Tier 1 â€” Observe (Governance & Compliance)
  promptGovernance,
  governance,
  // Tier 1 â€” Observe (Conversations & Response)
  conversationIntelligence,
  responseAnalytics,
  developerExperience,
  // Tier 1 â€” Observe (Operations)
  liveProblems,
  // Tier 1 â€” General Catch-all
  generalQA,
  // Tier 2 â€” Analyze (Dynatrace Intelligence)
  forecastTool,
  detectAnomalies,
  errorInvestigation,
  executiveSummary,
  aiQuality,
  modelDrift,
  aiArchitect,
  // Tier 2 â€” Analyze (Phase 2-5 Evolution)
  securityPosture,
  ragHealthScore,
  agentOptimization,
  providerFailover,
  // Tier 3 â€” Act
  costOptimization,
];
