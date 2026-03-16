/**
 * AI-Based Tool Selector — Hybrid Dynatrace Intelligence + semantic scoring
 *
 * Strategy (3 modes, configurable):
 * - hybrid (default): Dynatrace Intelligence first, semantic scoring fallback
 * - ai-only: Use Dynatrace Intelligence only (recommenderConversation)
 * - heuristic-only: Use semantic scoring + keyword fallback (no API calls)
 *
 * AI-first ensures the best possible tool routing via Dynatrace Intelligence,
 * with instant semantic scoring as a reliable fallback.
 */

import { publicClient } from "@dynatrace-sdk/client-davis-copilot";
import { TOOL_REGISTRY } from "./tools";
import type { AgentTool } from "./types";

// ============================================
// Tool catalog prompt (built once, cached)
// ============================================

let _catalogPrompt: { key: string; value: string } | null = null;

function buildToolCatalog(tools: AgentTool[]): string {
  const key = tools.map(t => t.name).join("|");
  if (_catalogPrompt && _catalogPrompt.key === key) return _catalogPrompt.value;
  const lines: string[] = [];
  for (const tool of tools) {
    const examples = tool.examples?.length
      ? ` | e.g. "${tool.examples.slice(0, 2).join('", "')}"`
      : "";
    lines.push(`- ${tool.name} (tier ${tool.tier}): ${tool.description}${examples}`);
  }
  const value = lines.join("\n");
  _catalogPrompt = { key, value };
  return value;
}

// ============================================
// AI Selection Result
// ============================================

export interface AISelectionResult {
  tools: Array<{
    tool: AgentTool;
    params: Record<string, string | number | boolean>;
    reasoning: string;
  }>;
  reasoning: string;
  usedAI: boolean;
  method: "semantic" | "ai" | "keyword";
  selectionPath: string;
  confidenceScore: number;
}

export type SelectionMode = "ai-only" | "heuristic-only" | "hybrid";

function getSelectionMode(): SelectionMode {
  if (typeof window === "undefined") return "hybrid";
  try {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("toolSelectionMode");
    if (urlMode === "ai-only" || urlMode === "heuristic-only" || urlMode === "hybrid") return urlMode;
    const stored = window.localStorage.getItem("gcc-tool-selection-mode");
    if (stored === "ai-only" || stored === "heuristic-only" || stored === "hybrid") return stored;
  } catch { /* ignore */ }
  return "hybrid";
}

// ============================================
// Semantic Scoring (fast, no API call)
// ============================================

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "up",
  "down", "and", "but", "or", "nor", "not", "so", "yet", "both",
  "either", "neither", "each", "every", "all", "any", "few", "more",
  "most", "other", "some", "such", "no", "only", "own", "same", "than",
  "too", "very", "just", "about", "if", "then", "because", "while",
  "where", "when", "how", "what", "which", "who", "whom", "this", "that",
  "these", "those", "i", "me", "my", "we", "our", "you", "your",
  "he", "him", "she", "her", "it", "its", "they", "them", "their",
  "show", "tell", "get", "give", "please", "want", "need", "like",
]);

function stem(word: string): string {
  if (word.endsWith("tion") || word.endsWith("sion")) return word;
  if (word.endsWith("ness") || word.endsWith("ment")) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ied")) return word.slice(0, -3) + "y";
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const result = new Set<string>();
  for (const w of words) {
    result.add(w);
    const stemmed = stem(w);
    if (stemmed !== w) result.add(stemmed);
  }
  return Array.from(result);
}

/**
 * Intent signal map — maps question keywords to tool names with boost values.
 * Adapted for GenAI observability domain.
 */
const INTENT_MAP: Array<{ signals: string[]; toolNames: string[]; boost: number }> = [
  { signals: ["health", "status", "overview", "doing", "state", "services", "how"],
    toolNames: ["service_health", "executive_summary"], boost: 2 },
  { signals: ["predict", "forecast", "future", "tomorrow", "next", "will", "going", "trend", "projection"],
    toolNames: ["forecast"], boost: 3 },
  { signals: ["anomaly", "spike", "unusual", "abnormal", "weird", "strange", "unexpected", "deviat"],
    toolNames: ["detect_anomalies"], boost: 3 },
  { signals: ["error", "errors", "failing", "failures", "429", "rate limit", "broken"],
    toolNames: ["top_errors", "error_investigation"], boost: 2 },
  { signals: ["investigate", "root cause", "why", "diagnose", "troubleshoot", "debug", "what happened"],
    toolNames: ["error_investigation"], boost: 3 },
  { signals: ["cost", "costs", "spending", "money", "expensive", "budget", "finops", "price"],
    toolNames: ["cost_breakdown", "cost_optimization"], boost: 3 },
  { signals: ["optimize", "reduce", "save", "cheaper", "efficient", "waste", "bloat"],
    toolNames: ["cost_optimization"], boost: 3 },
  { signals: ["compare", "provider", "providers", "versus", "vs", "openai", "anthropic", "google", "azure"],
    toolNames: ["provider_comparison"], boost: 2 },
  { signals: ["model", "models", "gpt", "claude", "gemini", "llama", "which model"],
    toolNames: ["model_comparison"], boost: 2 },
  { signals: ["latency", "slow", "speed", "fast", "response time", "performance", "p99", "sla", "timeout"],
    toolNames: ["latency_analysis"], boost: 3 },
  { signals: ["token", "tokens", "usage", "consumption", "input", "output", "prompt tokens"],
    toolNames: ["token_usage"], boost: 2 },
  { signals: ["executive", "summary", "report", "brief", "overall", "everything", "full"],
    toolNames: ["executive_summary"], boost: 2 },
  // New intent signals for inventory & discovery tools
  { signals: ["inventory", "how many", "count", "total", "assets", "landscape", "footprint", "discovery", "deployed"],
    toolNames: ["inventory_overview"], boost: 3 },
  { signals: ["agent", "agents", "agentic", "langchain", "langgraph", "agent task", "chain", "rag", "orchestrat"],
    toolNames: ["agent_overview"], boost: 3 },
  { signals: ["list models", "what models", "model list", "model catalog", "model inventory", "all models", "llms", "deployed models"],
    toolNames: ["model_inventory"], boost: 3 },
  { signals: ["list providers", "what providers", "provider list", "provider inventory", "all providers", "vendors", "which vendor"],
    toolNames: ["provider_inventory"], boost: 3 },
  { signals: ["trend", "trends", "over time", "timeline", "history", "growing", "increasing", "decreasing", "pattern", "volume", "traffic", "throughput"],
    toolNames: ["usage_trends"], boost: 3 },
  { signals: ["tell me", "describe", "explain", "info", "about", "detail", "details", "general"],
    toolNames: ["general_qa"], boost: 1 },
  { signals: ["embedding", "embeddings", "embed", "vector", "vectorize", "text-embedding", "ada", "embedding model"],
    toolNames: ["embedding_analytics"], boost: 3 },
  { signals: ["rag", "retrieval augmented", "retrieval-augmented", "pipeline", "embed and generate", "rag pipeline", "retrieval"],
    toolNames: ["rag_pipeline"], boost: 3 },
];

function scoreTool(questionTokens: string[], question: string, tool: AgentTool): number {
  let score = 0;
  const lowerQ = question.toLowerCase();

  // 1. Trigger phrase matching (multi-word phrases score higher)
  for (const trigger of tool.triggers) {
    if (trigger.includes(" ")) {
      // Multi-word trigger
      if (lowerQ.includes(trigger)) score += 5;
    } else {
      if (questionTokens.includes(trigger)) score += 2;
      if (questionTokens.includes(stem(trigger))) score += 1;
    }
  }

  // 2. Description token overlap
  const descTokens = tokenize(tool.description);
  const overlap = questionTokens.filter(t => descTokens.includes(t)).length;
  score += overlap * 0.5;

  // 3. Tool name partial match
  const nameTokens = tool.name.split("_");
  for (const nt of nameTokens) {
    if (questionTokens.includes(nt)) score += 1;
  }

  // 4. Intent signal boosting
  for (const intent of INTENT_MAP) {
    const hasSignal = intent.signals.some(s => {
      if (s.includes(" ")) return lowerQ.includes(s);
      return questionTokens.includes(s) || questionTokens.includes(stem(s));
    });
    if (hasSignal && intent.toolNames.includes(tool.name)) {
      score += intent.boost;
    }
  }

  return score;
}

/**
 * Semantic-based tool selection (no API call — instant)
 */
function semanticSelect(
  question: string,
  tools: AgentTool[]
): { tools: Array<{ tool: AgentTool; score: number }>; confidence: number } {
  const tokens = tokenize(question);
  const scored = tools.map(tool => ({ tool, score: scoreTool(tokens, question, tool) }));
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score || 0;
  if (topScore <= 0) {
    return { tools: [], confidence: 0 };
  }

  // Take the top tool, plus any close runner-ups (within 60% of top score)
  const threshold = topScore * 0.6;
  const selected = scored.filter(s => s.score >= threshold && s.score > 0).slice(0, 3);
  const confidence = Math.min(100, topScore * 10);

  return { tools: selected, confidence };
}

/**
 * Dynatrace Intelligence-based tool selection (uses recommenderConversation)
 */
async function davisSelect(
  question: string,
  tools: AgentTool[],
  timeoutMs = 10000
): Promise<{ tool: AgentTool; params: Record<string, string | number | boolean> }[] | null> {
  const catalog = buildToolCatalog(tools);

  const toolNameList = tools.map(t => t.name).join(", ");
  const instruction = `You are a tool router for a GenAI observability platform called GenAI Control Center.
The user asks questions about AI service health, costs, providers, models, errors, latency, tokens, forecasts, anomalies, and optimization.
Match the user's question to the best tool(s) from the list below.
Output ONLY a valid JSON object: { "tools": [{ "name": "<exact_tool_name>" }], "reasoning": "brief reason" }
Tool names MUST be one of: ${toolNameList}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[AI Selector] Calling Dynatrace Intelligence for: "${question}"`);
    const response = await publicClient.recommenderConversation({
      abortSignal: controller.signal,
      body: {
        text: `User question: "${question}"`,
        context: [
          { type: "supplementary", value: `Available tools:\n${catalog}` },
          { type: "instruction", value: instruction },
        ],
      },
    });

    clearTimeout(timer);

    // Extract response text from various possible response shapes
    let responseText = "";
    if (typeof response === "string") {
      responseText = response;
    } else if (Array.isArray(response)) {
      for (const event of response) {
        if (event && typeof event === "object") {
          const data = (event as Record<string, unknown>).data;
          if (data && typeof data === "object") {
            const d = data as Record<string, unknown>;
            if (typeof d.tokens === "string") {
              responseText += d.tokens;
            } else if (Array.isArray(d.tokens)) {
              responseText += d.tokens.join("");
            } else if (typeof d.answer === "string") {
              responseText = d.answer;
            } else if (typeof d.text === "string") {
              responseText = d.text;
            }
          }
          // Also check top-level text/answer
          const evt = event as Record<string, unknown>;
          if (!responseText && typeof evt.text === "string") {
            responseText = evt.text;
          }
          if (!responseText && typeof evt.answer === "string") {
            responseText = evt.answer;
          }
        }
      }
    } else if (response && typeof response === "object") {
      const r = response as unknown as Record<string, unknown>;
      responseText = (r.text as string) || (r.answer as string) || "";
      // Check nested content
      if (!responseText && r.data && typeof r.data === "object") {
        const d = r.data as Record<string, unknown>;
        responseText = (d.text as string) || (d.answer as string) || "";
      }
    }

    console.log(`[AI Selector] Raw response text: "${responseText.slice(0, 300)}"`);

    if (!responseText.trim()) {
      console.warn("[AI Selector] Empty response from Dynatrace Intelligence");
      return null;
    }

    // Parse JSON from response — try strict match first, then relaxed
    const jsonMatch = responseText.match(/\{[\s\S]*"tools"[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: try to find tool names mentioned directly in the response
      const mentionedTools = tools.filter(t =>
        responseText.toLowerCase().includes(t.name.toLowerCase())
      );
      if (mentionedTools.length > 0) {
        console.log(`[AI Selector] No JSON, but found tool names in text: ${mentionedTools.map(t => t.name).join(", ")}`);
        return mentionedTools.map(t => ({ tool: t, params: {} }));
      }
      console.warn(`[AI Selector] Could not parse tool selection from response`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const toolNames: string[] = (parsed.tools || []).map((t: any) => t.name);

    const resolved = toolNames
      .map(name => tools.find(t => t.name === name || t.name === name.toLowerCase().replace(/[\s-]/g, "_")))
      .filter(Boolean)
      .map(tool => ({ tool: tool!, params: {} }));

    console.log(`[AI Selector] Dynatrace Intelligence selected: ${resolved.map(r => r.tool.name).join(", ") || "(none)"}`);
    return resolved.length > 0 ? resolved : null;
  } catch (err) {
    clearTimeout(timer);
    console.warn("[AI Selector] Dynatrace Intelligence failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Main entry point — select the best tool(s) for a question
 */
export async function selectToolWithAI(
  question: string,
  _conversationHistory: Array<{ role: string; content: string }> = []
): Promise<AISelectionResult> {
  const mode = getSelectionMode();
  const tools = TOOL_REGISTRY;
  const pathSteps: string[] = [];

  const empty: AISelectionResult = {
    tools: [],
    reasoning: "No matching tool found.",
    usedAI: false,
    method: "keyword",
    selectionPath: `mode=${mode} -> no match`,
    confidenceScore: 0,
  };

  // --- Mode: heuristic-only ---
  if (mode === "heuristic-only") {
    pathSteps.push("semantic");
    const sem = semanticSelect(question, tools);
    if (sem.tools.length > 0) {
      return {
        tools: sem.tools.map(s => ({ tool: s.tool, params: {}, reasoning: `Semantic score: ${s.score}` })),
        reasoning: `Semantic selection (confidence ${sem.confidence}%)`,
        usedAI: false,
        method: "semantic",
        selectionPath: `mode=${mode} -> semantic(${sem.confidence}%)`,
        confidenceScore: sem.confidence,
      };
    }
    return { ...empty, selectionPath: `mode=${mode} -> semantic -> no match` };
  }

  // --- Mode: ai-only ---
  if (mode === "ai-only") {
    pathSteps.push("ai");
    const davisResult = await davisSelect(question, tools);
    if (davisResult && davisResult.length > 0) {
      return {
        tools: davisResult.map(r => ({ ...r, reasoning: "Selected by Dynatrace Intelligence" })),
        reasoning: "Dynatrace Intelligence tool routing",
        usedAI: true,
        method: "ai",
        selectionPath: `mode=${mode} -> ai`,
        confidenceScore: 90,
      };
    }
    return { ...empty, usedAI: true, selectionPath: `mode=${mode} -> ai -> no match` };
  }

  // --- Mode: hybrid (default) — AI first, semantic fallback ---
  // Step 1: Try Dynatrace Intelligence (best routing accuracy)
  pathSteps.push("ai");
  try {
    const davisResult = await davisSelect(question, tools);
    if (davisResult && davisResult.length > 0) {
      console.log(`[AI Selector] Hybrid: AI selected ${davisResult.map(r => r.tool.name).join(", ")}`);
      return {
        tools: davisResult.map(r => ({ ...r, reasoning: "Selected by Dynatrace Intelligence" })),
        reasoning: "Dynatrace Intelligence tool routing",
        usedAI: true,
        method: "ai",
        selectionPath: `mode=hybrid -> ai`,
        confidenceScore: 90,
      };
    }
    console.log("[AI Selector] Hybrid: AI returned no tools, falling back to semantic");
  } catch (err) {
    pathSteps.push("ai-error");
    console.warn("[AI Selector] Hybrid: AI error, falling back to semantic:", err instanceof Error ? err.message : err);
  }

  // Step 2: AI returned nothing or failed — fall back to semantic scoring (instant)
  pathSteps.push("semantic-fallback");
  const sem = semanticSelect(question, tools);

  if (sem.tools.length > 0) {
    return {
      tools: sem.tools.map(s => ({ tool: s.tool, params: {}, reasoning: `Semantic score: ${s.score}` })),
      reasoning: `Semantic fallback selection (${sem.confidence}%)`,
      usedAI: false,
      method: "semantic",
      selectionPath: `mode=hybrid -> ${pathSteps.join(" -> ")} -> semantic(${sem.confidence}%)`,
      confidenceScore: sem.confidence,
    };
  }

  return { ...empty, selectionPath: `mode=hybrid -> ${pathSteps.join(" -> ")} -> no match` };
}
