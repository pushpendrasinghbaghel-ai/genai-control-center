/**
 * ReAct Orchestrator — Plans and executes agentic tool chains
 *
 * Dynatrace Intelligence orchestration for GenAI observability:
 * 1. Uses hybrid AI tool selector (semantic + Dynatrace Intelligence)
 * 2. Executes selected tool(s) in parallel via Promise.allSettled
 * 3. Returns structured MessageBlock[] for native Strato rendering
 * 4. Graceful degradation — one tool failure doesn't abort the response
 */

import { TOOL_REGISTRY } from "./tools";
import { selectToolWithAI } from "./aiToolSelector";
import type {
  ToolExecutionContext,
  ToolResult,
  MessageBlock,
  FollowUpChip,
  ConversationContext,
} from "./types";

// ============================================
// Orchestration Result
// ============================================

export interface OrchestrationResult {
  /** Combined markdown response (deterministic, not hallucinated) */
  markdown: string;
  /** All message blocks from all tools */
  blocks: MessageBlock[];
  /** Tools that were executed */
  toolsUsed: string[];
  /** Combined DQL queries (for transparency drawer) */
  dql: string;
  /** Total execution time */
  executionTimeMs: number;
  /** Whether the orchestrator handled the question */
  handled: boolean;
  /** Whether Dynatrace Intelligence was used for tool selection */
  aiSelected: boolean;
  /** Selection reasoning */
  selectionReasoning?: string;
  /** Selection method */
  selectionMethod?: "semantic" | "ai" | "keyword";
  /** Full selection path (for debugging) */
  selectionPath?: string;
  /** Confidence score */
  selectionConfidence?: number;
  /** Follow-up suggestion chips */
  followUps?: FollowUpChip[];
}

// ============================================
// Security: Timeframe Validation
// ============================================

/** Whitelist pattern for safe DQL timeframes (e.g., '2h', '30m', '7d') */
const SAFE_TIMEFRAME_RE = /^\d{1,4}[mhd]$/;
const DEFAULT_TIMEFRAME = "2h";

/**
 * Sanitize a timeframe string to prevent DQL injection.
 * Only allows patterns like '30m', '2h', '7d'. Anything else falls back to default.
 */
function sanitizeTimeframe(tf: string): string {
  const trimmed = tf.trim();
  if (SAFE_TIMEFRAME_RE.test(trimmed)) return trimmed;
  console.warn(`[Orchestrator] Invalid timeframe "${trimmed}" rejected, using default "${DEFAULT_TIMEFRAME}"`);
  return DEFAULT_TIMEFRAME;
}

// ============================================
// Multi-Turn Context (Scratchpad)
// ============================================

/** Max summaries to carry from prior turns */
const MAX_PRIOR_SUMMARIES = 5;

/**
 * Build a lightweight conversation context from prior orchestration results.
 * This is cheap to construct and gives tools enough context for pronoun resolution
 * and follow-up questions without sending raw data.
 */
function buildConversationContext(
  priorResults: OrchestrationResult[],
  conversationHistory: Array<{ role: string; content: string }>
): ConversationContext {
  const previousTools: ConversationContext["previousTools"] = [];
  const providers = new Set<string>();
  const models = new Set<string>();
  const services = new Set<string>();

  // Extract entities and summaries from prior orchestration results
  for (const result of priorResults.slice(-MAX_PRIOR_SUMMARIES)) {
    for (const toolName of result.toolsUsed) {
      const summary = result.markdown?.slice(0, 200) || "";
      previousTools.push({ tool: toolName, summary });
    }
    // Scan blocks for entity names
    for (const block of result.blocks) {
      if (block.type === "table") {
        for (const row of block.rows) {
          for (const cell of row) {
            if (typeof cell === "string") {
              // Known provider names
              if (/\b(openai|anthropic|google|azure|bedrock|cohere|langchain|mistral)\b/i.test(cell)) {
                providers.add(cell.toLowerCase().trim());
              }
            }
          }
        }
      }
    }
    // Extract entities from DQL result patterns in markdown
    const dql = result.dql || "";
    const providerMatches = dql.match(/gen_ai\.provider\.name/g);
    if (providerMatches) {
      // Provider was queried — entities are present in blocks
    }
  }

  // Also extract entities mentioned in conversation history
  for (const msg of conversationHistory.slice(-6)) {
    const text = msg.content.toLowerCase();
    for (const p of ["openai", "anthropic", "google", "azure", "bedrock", "cohere", "langchain", "mistral"]) {
      if (text.includes(p)) providers.add(p);
    }
    const modelMatch = text.match(/\b(gpt-4[o]?(?:-mini|-turbo)?|gpt-3\.5-turbo|claude-3[.\-]?\w*|gemini-\w+|llama[\s-]?\d+)\b/i);
    if (modelMatch) models.add(modelMatch[1].toLowerCase());
  }

  return {
    previousTools: previousTools.slice(-MAX_PRIOR_SUMMARIES),
    entities: {
      providers: providers.size > 0 ? Array.from(providers) : undefined,
      models: models.size > 0 ? Array.from(models) : undefined,
      services: services.size > 0 ? Array.from(services) : undefined,
    },
    turnCount: conversationHistory.filter(m => m.role === "user").length,
  };
}

// ============================================
// Per-Tool Timeout
// ============================================

/** Maximum time (ms) a single tool is allowed to run before being cut off.
 *  Must exceed the DQL polling budget (10 polls × 3s = 30s) plus network overhead. */
const PER_TOOL_TIMEOUT_MS = 45_000;

/**
 * Race a tool execution against a timeout.
 * Returns partial result on timeout instead of failing.
 */
function executeWithTimeout(
  toolName: string,
  promise: Promise<ToolResult>,
  timeoutMs = PER_TOOL_TIMEOUT_MS
): Promise<ToolResult> {
  return Promise.race([
    promise,
    new Promise<ToolResult>((resolve) =>
      setTimeout(() => {
        console.warn(`[Orchestrator] Tool "${toolName}" timed out after ${timeoutMs}ms`);
        resolve({
          success: false,
          toolName,
          summary: `${toolName} timed out after ${(timeoutMs / 1000).toFixed(0)}s.`,
          blocks: [{
            type: "alert" as const,
            severity: "warning" as const,
            title: "Tool Timed Out",
            message: `The ${toolName} tool exceeded the ${(timeoutMs / 1000).toFixed(0)}s time limit. Try narrowing the timeframe or simplifying the query.`,
          }],
          executionTimeMs: timeoutMs,
        });
      }, timeoutMs)
    ),
  ]);
}

// ============================================
// Parameter Extraction
// ============================================

/**
 * Extract structured parameters from natural-language question.
 * GenAI-domain-specific extraction (providers, models, timeframes).
 */
function extractParams(question: string): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  const q = question.toLowerCase();

  // Provider hints
  if (/\bopenai\b/i.test(question)) params.provider = "openai";
  else if (/\banthropic\b/i.test(question)) params.provider = "anthropic";
  else if (/\bgoogle\b|\bgemini\b|\bvertex/i.test(question)) params.provider = "google";
  else if (/\bazure\b/i.test(question)) params.provider = "azure";
  else if (/\bbedrock\b|\bamazon\b|\baws\b/i.test(question)) params.provider = "bedrock";
  else if (/\bcohere\b/i.test(question)) params.provider = "cohere";

  // Model hints
  const modelMatch = question.match(/\b(gpt-4[o]?(?:-mini|-turbo)?|gpt-3\.5-turbo|claude-3[.\-]?\w*|gemini-\w+|llama[\s-]?\d+)/i);
  if (modelMatch) params.model = modelMatch[1].toLowerCase();

  // Top / limit
  const limitMatch = question.match(/(?:top|limit|first|show)\s+(\d+)/i)
    || question.match(/(\d+)\s+(?:slowest|worst|most|providers|models|services|errors)/i);
  if (limitMatch) params.limit = parseInt(limitMatch[1], 10);

  // Time window hints
  const timeHourMatch = q.match(/last\s+(\d+)\s+hour/);
  const timeMinMatch  = q.match(/last\s+(\d+)\s+min/);
  const timeDayMatch  = q.match(/last\s+(\d+)\s+day/);
  if (/\blast\s+hour\b|\bpast\s+hour\b/.test(q)) params.timeHint = "1h";
  else if (timeHourMatch) params.timeHint = `${timeHourMatch[1]}h`;
  else if (timeMinMatch) params.timeHint = `${timeMinMatch[1]}m`;
  else if (/\btoday\b|\blast\s+24/.test(q)) params.timeHint = "24h";
  else if (/\bthis\s+week\b|\blast\s+week\b|\blast\s+7\s+day/.test(q)) params.timeHint = "7d";
  else if (timeDayMatch) params.timeHint = `${timeDayMatch[1]}d`;
  else if (/\blast\s+month\b|\blast\s+30\s+day/.test(q)) params.timeHint = "30d";

  return params;
}

// ============================================
// Main Orchestrate Function
// ============================================

/**
 * Main entry point — receives a user question, selects tools,
 * executes them in parallel, and returns structured results.
 */
export async function orchestrate(
  question: string,
  timeframe: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  signal?: AbortSignal,
  priorResults: OrchestrationResult[] = []
): Promise<OrchestrationResult> {
  const startTime = Date.now();

  // Build multi-turn context from prior results
  const conversationContext = buildConversationContext(priorResults, conversationHistory);

  // --- AI-based tool selection ---
  const aiSelection = await selectToolWithAI(question, conversationHistory);

  // No tools selected — fall back to general_qa catch-all
  if (aiSelection.tools.length === 0) {
    const generalTool = TOOL_REGISTRY.find(t => t.name === "general_qa");
    if (generalTool) {
      const extractedParams = extractParams(question);
      const resolvedTimeframe = sanitizeTimeframe(typeof extractedParams.timeHint === "string" ? extractedParams.timeHint : timeframe);
      const ctx: ToolExecutionContext = { question, timeframe: resolvedTimeframe, params: extractedParams, signal, conversationContext };
      try {
        const result = await executeWithTimeout(generalTool.name, generalTool.execute(ctx));
        return {
          markdown: renderBlocksAsMarkdown(result),
          blocks: result.blocks,
          toolsUsed: ["general_qa"],
          dql: result.dql || "",
          executionTimeMs: Date.now() - startTime,
          handled: true,
          aiSelected: false,
          selectionReasoning: "No specific tool matched — used General Q&A catch-all",
          selectionMethod: "keyword" as const,
          selectionPath: `${aiSelection.selectionPath} -> fallback(general_qa)`,
          selectionConfidence: 50,
          followUps: result.followUps,
        };
      } catch (err) {
        console.error("[Orchestrator] General Q&A fallback failed:", err);
      }
    }
    return {
      markdown: "",
      blocks: [],
      toolsUsed: [],
      dql: "",
      executionTimeMs: Date.now() - startTime,
      handled: false,
      aiSelected: aiSelection.usedAI,
      selectionReasoning: aiSelection.reasoning,
      selectionMethod: aiSelection.method,
      selectionPath: aiSelection.selectionPath,
      selectionConfidence: aiSelection.confidenceScore,
    };
  }

  // --- Execute selected tool(s) in parallel ---
  const allBlocks: MessageBlock[] = [];
  const allToolNames: string[] = [];
  const allDql: string[] = [];
  const allResults: ToolResult[] = [];
  let allFollowUps: FollowUpChip[] = [];

  const extractedParams = extractParams(question);

  // Use resolved timeframe from params if available
  const resolvedTimeframe = sanitizeTimeframe(
    typeof extractedParams.timeHint === "string"
      ? extractedParams.timeHint
      : timeframe
  );

  const executionPromises = aiSelection.tools.map(({ tool, params }) => {
    const ctx: ToolExecutionContext = {
      question,
      timeframe: resolvedTimeframe,
      params: { ...extractedParams, ...params },
      signal,
      conversationContext,
    };
    console.log(
      `[Orchestrator] Executing: ${tool.name} (method: ${aiSelection.method}, path: ${aiSelection.selectionPath})`
    );
    return executeWithTimeout(tool.name, tool.execute(ctx)).then(result => ({ tool, result }));
  });

  const settled = await Promise.allSettled(executionPromises);

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      const { tool, result } = outcome.value;
      allResults.push(result);
      allBlocks.push(...result.blocks);
      allToolNames.push(tool.name);
      if (result.dql) allDql.push(result.dql);
      if (result.followUps) allFollowUps.push(...result.followUps);
    } else {
      // Graceful degradation — log but don't crash
      const reason = outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
      console.error("[Orchestrator] Tool execution failed:", reason);
      allBlocks.push({
        type: "alert",
        severity: "warning",
        title: "Analysis Incomplete",
        message: `One tool encountered an error: ${reason}. Partial results are shown below.`,
      });
    }
  }

  // Deduplicate follow-up chips
  const seenFollowUps = new Set<string>();
  allFollowUps = allFollowUps.filter(f => {
    if (seenFollowUps.has(f.label)) return false;
    seenFollowUps.add(f.label);
    return true;
  });

  // --- Format combined markdown (deterministic, no hallucination) ---
  const combinedResult: ToolResult = allResults.length === 1
    ? allResults[0]
    : {
        success: allResults.every(r => r.success),
        toolName: allToolNames.join(" + "),
        summary: allResults.map(r => r.summary).filter(Boolean).join("\n\n"),
        blocks: allBlocks,
        dql: allDql.join("\n---\n"),
        executionTimeMs: Date.now() - startTime,
      };

  const markdown = renderBlocksAsMarkdown(combinedResult);

  return {
    markdown,
    blocks: allBlocks,
    toolsUsed: allToolNames,
    dql: allDql.join("\n"),
    executionTimeMs: Date.now() - startTime,
    handled: true,
    aiSelected: aiSelection.usedAI,
    selectionReasoning: aiSelection.reasoning,
    selectionMethod: aiSelection.method,
    selectionPath: aiSelection.selectionPath,
    selectionConfidence: aiSelection.confidenceScore,
    followUps: allFollowUps,
  };
}

// ============================================
// Deterministic Markdown Renderer
// ============================================

/**
 * Renders message blocks as markdown (fallback only).
 * The UI renders table, metric, alert, chart blocks natively via Strato.
 * This markdown is only for text blocks and non-native types.
 */
function renderBlocksAsMarkdown(result: ToolResult): string {
  let md = `${result.summary}\n\n`;

  for (const block of result.blocks) {
    switch (block.type) {
      case "text":
        md += `${block.content}\n\n`;
        break;

      // These are rendered natively by Strato in the UI — skip to avoid duplication
      case "metric":
      case "table":
      case "chart":
        break;

      case "alert":
        md += `**${block.severity === "critical" ? "🔴" : block.severity === "warning" ? "🟡" : "ℹ️"} ${block.title}**: ${block.message}\n\n`;
        break;

      case "analyzer": {
        if (block.forecast) {
          md += `**Forecast:** Trend ${block.forecast.trend}, Quality: ${block.forecast.forecastQuality}\n`;
          if (block.forecast.budgetBreachDay) {
            md += `⚠️ Budget breach projected in ~${block.forecast.budgetBreachDay} days\n`;
          }
        }
        if (block.anomaly) {
          md += block.anomaly.hasAnomaly
            ? `🔴 Anomaly detected (severity: ${block.anomaly.severity})\n`
            : `✅ No anomalies detected\n`;
        }
        if (block.novelty) {
          md += block.novelty.noveltyScore > 0.5
            ? `⚠️ Unusual pattern: ${block.novelty.noveltyType} (score: ${block.novelty.noveltyScore.toFixed(2)})\n`
            : `✅ No unusual patterns\n`;
        }
        md += "\n";
        break;
      }
    }
  }

  return md.trim();
}

// ============================================
// Public Helpers
// ============================================

/**
 * List all available tools with their descriptions (for help / discovery)
 */
export function listAvailableTools(): string {
  let help = "**Dynatrace Intelligence — Available Capabilities**\n\n";
  const tiers = [
    { tier: 1 as const, label: "Observe & Discover" },
    { tier: 2 as const, label: "Analyze" },
    { tier: 3 as const, label: "Act" },
  ];
  for (const { tier, label } of tiers) {
    const tools = TOOL_REGISTRY.filter(t => t.tier === tier);
    if (tools.length === 0) continue;
    help += `**${label}**\n`;
    tools.forEach(t => {
      help += `  • **${t.label}** — ${t.description}\n`;
    });
    help += "\n";
  }
  return help;
}

/**
 * Get quick investigation suggestions for the welcome screen
 */
export function getQuickInvestigations(): FollowUpChip[] {
  return [
    { label: "AI Inventory", query: "How many services, providers, models, and agents do I have?" },
    { label: "Agent Activity", query: "Tell me about my AI agents and their activity" },
    { label: "Service Health", query: "How are my AI services doing?" },
    { label: "Compare Providers", query: "Compare all my AI providers" },
    { label: "Cost Analysis", query: "Show me the cost breakdown by provider" },
    { label: "Usage Trends", query: "Show me GenAI usage trends over time" },
    { label: "Detect Anomalies", query: "Are there any anomalies in my AI services?" },
    { label: "Forecast Tokens", query: "Forecast my token usage for the next 24 hours" },
    { label: "Top Errors", query: "What are the top errors across my AI services?" },
    { label: "Executive Summary", query: "Give me a full executive summary" },
    { label: "Model Catalog", query: "List all models with usage stats" },
    { label: "Optimize Costs", query: "How can I reduce my AI costs?" },
  ];
}
