/**
 * GCC MCP Tool Definitions
 *
 * All 30 GenAI Control Center tools exposed as MCP-compatible functions.
 * Each tool executes DQL queries against Dynatrace and returns structured results.
 */

import { executeDql, fmt, nsToMs } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface ToolDef {
  name: string;
  description: string;
  execute: (timeframe: string) => Promise<ToolResult>;
}

// ─── Helper: estimate cost ────────────────────────────────
function estimateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates: Record<string, { input: number; output: number }> = {
    openai: { input: 0.03, output: 0.06 },
    azure: { input: 0.03, output: 0.06 },
    anthropic: { input: 0.015, output: 0.075 },
    google: { input: 0.00025, output: 0.0005 },
    bedrock: { input: 0.008, output: 0.024 },
    cohere: { input: 0.004, output: 0.004 },
  };
  const r = rates[(provider || "").toLowerCase()] || { input: 0.01, output: 0.03 };
  return (inputTokens / 1000) * r.input + (outputTokens / 1000) * r.output;
}

// ═════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═════════════════════════════════════════════════════════════

const serviceHealth: ToolDef = {
  name: "service_health",
  description: "Show health overview of all GenAI services — request count, error rate, latency, tokens",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd service = dt.entity.service
| summarize {
    requests = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model)
  }, by: { service }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "service_health", summary: `${records.length} AI services found`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const providerComparison: ToolDef = {
  name: "provider_comparison",
  description: "Compare AI providers by latency, error rate, cost, and throughput",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name)
| summarize {
    requests = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    models = collectDistinct(gen_ai.request.model),
    services = collectDistinct(dt.entity.service)
  }, by: { gen_ai.provider.name }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "provider_comparison", summary: `${records.length} providers compared`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const modelComparison: ToolDef = {
  name: "model_comparison",
  description: "Compare AI models by performance, cost, and usage",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    p95_latency = percentile(duration, 95),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    services = collectDistinct(dt.entity.service)
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "model_comparison", summary: `${records.length} models compared`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const topErrors: ToolDef = {
  name: "top_errors",
  description: "Show top GenAI errors grouped by type, provider, and model",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model))
| filter span.status_code == "error" OR isNotNull(error.type)
| summarize {
    count = count(),
    services = collectDistinct(dt.entity.service),
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model)
  }, by: { error.type }
| sort count desc
| limit 20`;
    const records = await executeDql(dql);
    return { success: true, toolName: "top_errors", summary: `${records.length} error types found`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const costBreakdown: ToolDef = {
  name: "cost_breakdown",
  description: "Show AI cost breakdown by provider, model, and service with estimated spend",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort input_tokens + output_tokens desc`;
    const records = await executeDql(dql);
    const data = records.map((r: any) => ({
      ...r,
      estimated_cost: estimateCost(r["gen_ai.provider.name"], Number(r.input_tokens || 0), Number(r.output_tokens || 0)),
    }));
    const totalCost = data.reduce((s: number, r: any) => s + r.estimated_cost, 0);
    return { success: true, toolName: "cost_breakdown", summary: `Estimated total cost: $${totalCost.toFixed(2)}`, data, dql, executionTimeMs: Date.now() - start };
  },
};

const latencyAnalysis: ToolDef = {
  name: "latency_analysis",
  description: "Analyze GenAI latency — avg, P50, P95, P99 by model and provider",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    p50_latency = percentile(duration, 50),
    p95_latency = percentile(duration, 95),
    p99_latency = percentile(duration, 99),
    max_latency = max(duration)
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort avg_latency desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "latency_analysis", summary: `Latency analyzed for ${records.length} model/provider combos`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const tokenUsage: ToolDef = {
  name: "token_usage",
  description: "Show token usage breakdown — input vs output, by model and provider",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_input = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_output = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { gen_ai.request.model, gen_ai.provider.name }
| sort input_tokens + output_tokens desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "token_usage", summary: `Token usage for ${records.length} model/provider combos`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const inventoryOverview: ToolDef = {
  name: "inventory_overview",
  description: "Show a complete inventory of all AI services, models, and providers",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    last_seen = max(start_time),
    first_seen = min(start_time),
    error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0
  }, by: { dt.entity.service, gen_ai.provider.name, gen_ai.request.model, span.name }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "inventory_overview", summary: `${records.length} service/model/provider combos inventoried`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const agentOverview: ToolDef = {
  name: "agent_overview",
  description: "Show agentic AI activity — multi-step agents, LangChain, tool calls",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter span.name == "agent.task" OR gen_ai.provider.name == "Langchain"
| summarize {
    executions = count(),
    avg_duration = avg(duration),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    services = collectDistinct(dt.entity.service),
    models = collectDistinct(gen_ai.request.model)
  }, by: { span.name }
| sort executions desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "agent_overview", summary: `${records.length} agent span types found`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const modelInventory: ToolDef = {
  name: "model_inventory",
  description: "List all AI models in use with their providers and usage stats",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    providers = collectDistinct(gen_ai.provider.name),
    services = collectDistinct(dt.entity.service),
    first_seen = min(start_time),
    last_seen = max(start_time)
  }, by: { gen_ai.request.model }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "model_inventory", summary: `${records.length} models in use`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const providerInventory: ToolDef = {
  name: "provider_inventory",
  description: "List all AI providers with their models and service connections",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name)
| summarize {
    requests = count(),
    models = collectDistinct(gen_ai.request.model),
    services = collectDistinct(dt.entity.service),
    first_seen = min(start_time),
    last_seen = max(start_time)
  }, by: { gen_ai.provider.name }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "provider_inventory", summary: `${records.length} providers in use`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const usageTrends: ToolDef = {
  name: "usage_trends",
  description: "Show GenAI usage trends over time — requests, tokens, errors",
  execute: async (tf) => {
    const start = Date.now();
    const bucket = tf === "1h" ? "5m" : tf === "6h" ? "15m" : tf === "24h" ? "1h" : "4h";
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration),
    providers = countDistinct(gen_ai.provider.name)
  }, by: { bin(start_time, ${bucket}) }
| sort start_time asc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "usage_trends", summary: `${records.length} time buckets of usage data`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const embeddingAnalytics: ToolDef = {
  name: "embedding_analytics",
  description: "Analyze embedding model usage — throughput, latency, token consumption",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter contains(span.name, "embed")
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    providers = collectDistinct(gen_ai.provider.name)
  }, by: { gen_ai.request.model }
| sort requests desc`;
    const records = await executeDql(dql);
    return { success: true, toolName: "embedding_analytics", summary: `${records.length} embedding models analyzed`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const ragPipeline: ToolDef = {
  name: "rag_pipeline",
  description: "Analyze RAG pipeline — embedding vs generation split, E2E latency",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd operation_type = if(contains(span.name, "embed"), "embedding", else: "generation")
| summarize {
    requests = count(),
    avg_latency = avg(duration),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { operation_type }`;
    const records = await executeDql(dql);
    return { success: true, toolName: "rag_pipeline", summary: `RAG pipeline: ${records.length} operation types`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const aiTopology: ToolDef = {
  name: "ai_topology",
  description: "Show AI service topology — services, providers, models, and their relationships",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
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
    const records = await executeDql(dql);
    return { success: true, toolName: "ai_topology", summary: `${records.length} AI services in topology`, data: records, dql, executionTimeMs: Date.now() - start };
  },
};

const promptGovernance: ToolDef = {
  name: "prompt_governance",
  description: "Analyze prompts for PII exposure, injection risks, and governance compliance",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
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
    const records = await executeDql(dql);

    // PII detection
    const piiPatterns = [
      { name: "Email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i },
      { name: "Phone", regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
      { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
      { name: "Credit Card", regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ },
      { name: "API Key", regex: /\b(sk-|api[_-]key|bearer|token)[a-zA-Z0-9_-]{10,}\b/i },
    ];
    const injectionPatterns = [
      { name: "Ignore Instructions", regex: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts)/i },
      { name: "System Override", regex: /(system\s+prompt|you\s+are\s+now|act\s+as|pretend\s+to\s+be)/i },
      { name: "Delimiter Attack", regex: /(<\|endoftext\|>|<\|im_start\|>|\[INST\])/i },
    ];

    let piiCount = 0, injectionCount = 0;
    records.forEach((r: any) => {
      const text = String(r.prompt_text || "");
      piiPatterns.forEach(p => { if (p.regex.test(text)) piiCount++; });
      injectionPatterns.forEach(p => { if (p.regex.test(text)) injectionCount++; });
    });

    return {
      success: true, toolName: "prompt_governance",
      summary: `${records.length} prompts analyzed, ${piiCount} PII detections, ${injectionCount} injection risks`,
      data: { prompts_analyzed: records.length, pii_detections: piiCount, injection_risks: injectionCount, records: records.map((r: any) => ({ ...r, prompt_text: String(r.prompt_text || "").slice(0, 100) + "…" })) },
      dql, executionTimeMs: Date.now() - start,
    };
  },
};

const modelDriftTool: ToolDef = {
  name: "model_drift",
  description: "Detect model behavior changes, version mismatches, and performance drift",
  execute: async (tf) => {
    const start = Date.now();
    const versionsDql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != ""
| summarize {
    request_count = count(),
    first_seen = min(start_time),
    last_seen = max(start_time),
    avg_latency = avg(duration) / 1000000,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
| sort last_seen desc`;

    const changeDql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.response.model) AND gen_ai.response.model != gen_ai.request.model
| summarize occurrences = count(), last_seen = max(start_time)
  , by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
| sort last_seen desc`;

    const [versions, changes] = await Promise.all([executeDql(versionsDql), executeDql(changeDql)]);
    return {
      success: true, toolName: "model_drift",
      summary: `${versions.length} model variants, ${changes.length} version mismatches`,
      data: { versions, version_mismatches: changes },
      dql: versionsDql, executionTimeMs: Date.now() - start,
    };
  },
};

const infrastructureTool: ToolDef = {
  name: "infrastructure",
  description: "Show AI infrastructure — deployments, service configurations, model history",
  execute: async (tf) => {
    const start = Date.now();
    const deployDql = `fetch events, from:now()-${tf}
| filter event.kind == "DEPLOYMENT_EVENT"
| fields event_id = id, title = event.name, entity = dt.entity.name, timestamp = timestamp, version = dt.event.deployment.version
| sort timestamp desc
| limit 30`;

    const configDql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.provider.name)
| summarize model = takeFirst(gen_ai.request.model), provider = takeFirst(gen_ai.provider.name), model_versions = countDistinct(gen_ai.request.model), request_count = count(), last_seen = max(start_time), by: { service_name = service.name }
| sort last_seen desc
| limit 40`;

    const [deploys, configs] = await Promise.all([executeDql(deployDql), executeDql(configDql)]);
    return {
      success: true, toolName: "infrastructure",
      summary: `${deploys.length} deployments, ${configs.length} AI services configured`,
      data: { deployments: deploys, service_configs: configs },
      dql: deployDql, executionTimeMs: Date.now() - start,
    };
  },
};

const aiQuality: ToolDef = {
  name: "ai_quality",
  description: "Calculate per-service AI quality scores based on latency, error rate, token efficiency",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    avg_latency = avg(duration) / 1000000,
    p95_latency = percentile(duration / 1000000, 95),
    error_rate = countIf(span.status_code == "error" OR isNotNull(error.type)) / count() * 100,
    low_output_rate = countIf(coalesce(gen_ai.usage.output_tokens, 0) < 10 AND coalesce(gen_ai.usage.output_tokens, 0) > 0) / countIf(coalesce(gen_ai.usage.output_tokens, 0) > 0) * 100
  }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
| sort request_count desc
| limit 50`;
    const records = await executeDql(dql);

    const scored = records.map((r: any) => {
      const errorRate = Number(r.error_rate || 0);
      const avgLatency = Number(r.avg_latency || 0);
      const p95 = Number(r.p95_latency || 0);
      const lowOut = Number(r.low_output_rate || 0);
      const reliability = Math.max(0, 100 - errorRate * 10);
      const latency = avgLatency < 500 ? 100 : avgLatency < 2000 ? 80 : avgLatency < 5000 ? 50 : 20;
      const consistency = p95 > 0 && avgLatency > 0 ? Math.max(0, 100 - (p95 / avgLatency - 1) * 50) : 80;
      const outputQuality = Math.max(0, 100 - lowOut * 2);
      const overall = Math.round(reliability * 0.35 + latency * 0.25 + consistency * 0.2 + outputQuality * 0.2);
      const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
      return { ...r, overall_score: overall, grade };
    });

    return {
      success: true, toolName: "ai_quality",
      summary: `${scored.length} services scored, avg ${Math.round(scored.reduce((s: number, r: any) => s + r.overall_score, 0) / (scored.length || 1))}/100`,
      data: scored, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const conversationIntelligence: ToolDef = {
  name: "conversation_intelligence",
  description: "Analyze AI conversation sessions — multi-turn patterns, session lengths, conversation health",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter isNotNull(gen_ai.conversation.id) OR isNotNull(trace.id)
| fieldsAdd session_id = coalesce(gen_ai.conversation.id, trace.id)
| summarize {
    turn_count = count(),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_latency_ms = sum(duration) / 1000000,
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    models_used = collectDistinct(gen_ai.request.model)
  }, by: { session_id }
| sort total_latency_ms desc
| limit 100`;
    const records = await executeDql(dql);
    const totalTurns = records.reduce((s: number, r: any) => s + Number(r.turn_count || 0), 0);
    return {
      success: true, toolName: "conversation_intelligence",
      summary: `${records.length} sessions, ${totalTurns} total turns, avg ${(totalTurns / (records.length || 1)).toFixed(1)} turns/session`,
      data: records, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const developerExperience: ToolDef = {
  name: "developer_experience",
  description: "Show instrumentation coverage, integration health, shadow AI detection",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_spans = count(),
    has_model = countIf(isNotNull(gen_ai.request.model) AND gen_ai.request.model != ""),
    has_provider = countIf(isNotNull(gen_ai.provider.name) AND gen_ai.provider.name != ""),
    has_input_tokens = countIf(isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)),
    has_output_tokens = countIf(isNotNull(gen_ai.usage.output_tokens) OR isNotNull(gen_ai.usage.completion_tokens)),
    has_prompt = countIf(isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.prompt.1.content)),
    has_conversation_id = countIf(isNotNull(gen_ai.conversation.id))
  }, by: { service = dt.entity.service }
| sort total_spans desc`;
    const records = await executeDql(dql);
    return {
      success: true, toolName: "developer_experience",
      summary: `${records.length} services — instrumentation coverage report`,
      data: records, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const governance: ToolDef = {
  name: "governance",
  description: "Show AI compliance audit trail — recent invocations, policy adherence, usage auditing",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fields
    timestamp = start_time,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
    output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0),
    has_error = (span.status_code == "error" OR isNotNull(error.type)),
    trace_id = trace.id,
    service = dt.entity.service
| sort timestamp desc
| limit 100`;
    const records = await executeDql(dql);
    return {
      success: true, toolName: "governance",
      summary: `Audit trail: ${records.length} recent AI invocations`,
      data: records, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const responseAnalytics: ToolDef = {
  name: "response_analytics",
  description: "Analyze AI response quality — token efficiency, output variance, latency distribution",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
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
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
  }, by: { dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
| fieldsAdd output_std_dev = sqrt(output_variance)
| fieldsAdd token_ratio = if(avg_input_tokens > 0, then: avg_output_tokens / avg_input_tokens, else: 0)
| sort request_count desc
| limit 100`;
    const records = await executeDql(dql);
    return {
      success: true, toolName: "response_analytics",
      summary: `Response analytics for ${records.length} model/service combos`,
      data: records, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const liveProblems: ToolDef = {
  name: "live_problems",
  description: "Show Davis-detected problems affecting AI services and recent workflow executions",
  execute: async (tf) => {
    const start = Date.now();
    const problemsDql = `fetch dt.davis.problems, from:now()-${tf}
| fields problem_id = event.id, display_id, title = event.name,
         status = event.status, severity = event.category,
         root_cause = root_cause_entity_name,
         start_time = event.start, end_time = event.end
| sort start_time desc
| limit 200`;
    const workflowsDql = `fetch bizevents, from: now()-7d, to: now()
| filter event.type == "automation.workflow.run.finished" OR event.type == "automation.workflow.run.started"
| summarize runs = count(), last_run = max(timestamp), by: { workflow.id, workflow.title }
| sort runs desc
| limit 20`;
    const [problems, workflows] = await Promise.all([executeDql(problemsDql), executeDql(workflowsDql)]);
    return {
      success: true, toolName: "live_problems",
      summary: `${problems.length} problems, ${workflows.length} workflows`,
      data: { problems, workflows },
      dql: problemsDql, executionTimeMs: Date.now() - start,
    };
  },
};

const aiArchitect: ToolDef = {
  name: "ai_architect",
  description: "Get architecture recommendations — detect anti-patterns, provider concentration, optimization opportunities",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    request_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration) / 1000000,
    p95_latency = percentile(duration / 1000000, 95),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    models = collectDistinct(gen_ai.request.model)
  }, by: { service = dt.entity.service, gen_ai.provider.name }
| sort request_count desc
| limit 100`;
    const records = await executeDql(dql);

    const recommendations: string[] = [];
    const providerMap: Record<string, number> = {};
    records.forEach((r: any) => {
      const p = r["gen_ai.provider.name"] || "Unknown";
      providerMap[p] = (providerMap[p] || 0) + Number(r.request_count || 0);
    });
    const providers = Object.entries(providerMap).sort(([, a], [, b]) => b - a);
    const total = providers.reduce((s, [, v]) => s + v, 0);
    if (providers.length === 1) recommendations.push(`Single provider risk: all ${total} requests go to ${providers[0][0]}`);
    else if (providers.length > 1 && providers[0][1] / total > 0.85) recommendations.push(`Provider concentration: ${providers[0][0]} handles ${(providers[0][1] / total * 100).toFixed(0)}% of traffic`);
    const highErr = records.filter((r: any) => Number(r.request_count || 0) > 10 && Number(r.error_count || 0) / Number(r.request_count) > 0.1);
    if (highErr.length > 0) recommendations.push(`${highErr.length} service(s) with >10% error rate`);

    return {
      success: true, toolName: "ai_architect",
      summary: `Architecture: ${providers.length} providers, ${recommendations.length} recommendations`,
      data: { architecture: records, recommendations },
      dql, executionTimeMs: Date.now() - start,
    };
  },
};

const errorInvestigation: ToolDef = {
  name: "error_investigation",
  description: "Investigate GenAI errors — trends, root cause, recent error details",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model))
| filter span.status_code == "error" OR isNotNull(error.type)
| fields start_time, dt.entity.service, gen_ai.provider.name, gen_ai.request.model, error.type, span.status_code, duration
| sort start_time desc
| limit 50`;
    const records = await executeDql(dql);
    return {
      success: true, toolName: "error_investigation",
      summary: `${records.length} recent errors found`,
      data: records, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const executiveSummary: ToolDef = {
  name: "executive_summary",
  description: "Generate an executive summary of all GenAI operations",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency = avg(duration) / 1000000,
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0)),
    unique_services = countDistinct(dt.entity.service),
    unique_providers = countDistinct(gen_ai.provider.name),
    unique_models = countDistinct(gen_ai.request.model)
  }`;
    const records = await executeDql(dql);
    const r = records[0] || {};
    return {
      success: true, toolName: "executive_summary",
      summary: `Executive Summary: ${fmt(Number(r.total_requests || 0))} requests, ${Number(r.unique_services || 0)} services, ${Number(r.unique_providers || 0)} providers, ${Number(r.unique_models || 0)} models, ${((Number(r.total_errors || 0) / (Number(r.total_requests || 1))) * 100).toFixed(1)}% error rate`,
      data: r, dql, executionTimeMs: Date.now() - start,
    };
  },
};

const costOptimization: ToolDef = {
  name: "cost_optimization",
  description: "Get AI cost optimization recommendations — identify waste, suggest cheaper alternatives",
  execute: async (tf) => {
    const start = Date.now();
    const dql = `fetch spans, from:now()-${tf}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_output = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort input_tokens + output_tokens desc`;
    const records = await executeDql(dql);
    const data = records.map((r: any) => {
      const cost = estimateCost(r["gen_ai.provider.name"], Number(r.input_tokens || 0), Number(r.output_tokens || 0));
      const wastedCost = estimateCost(r["gen_ai.provider.name"], 0, 0) * Number(r.error_count || 0);
      return { ...r, estimated_cost: cost, wasted_on_errors: wastedCost };
    });
    const totalCost = data.reduce((s: number, r: any) => s + r.estimated_cost, 0);
    return {
      success: true, toolName: "cost_optimization",
      summary: `Total estimated cost: $${totalCost.toFixed(2)} — ${records.length} model/provider combos analyzed`,
      data, dql, executionTimeMs: Date.now() - start,
    };
  },
};

// ═════════════════════════════════════════════════════════════
// TOOL REGISTRY
// ═════════════════════════════════════════════════════════════

export const TOOL_REGISTRY: ToolDef[] = [
  serviceHealth,
  providerComparison,
  modelComparison,
  topErrors,
  costBreakdown,
  latencyAnalysis,
  tokenUsage,
  inventoryOverview,
  agentOverview,
  modelInventory,
  providerInventory,
  usageTrends,
  embeddingAnalytics,
  ragPipeline,
  aiTopology,
  promptGovernance,
  modelDriftTool,
  infrastructureTool,
  aiQuality,
  conversationIntelligence,
  developerExperience,
  governance,
  responseAnalytics,
  liveProblems,
  aiArchitect,
  errorInvestigation,
  executiveSummary,
  costOptimization,
];
