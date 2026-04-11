/**
 * Agentic Intelligence System — Type Definitions
 * 
 * Defines the contract for GenAI observability tools that can be
 * invoked by the orchestrator from the Dynatrace Intelligence chat.
 * 
 * Terminology aligned with Dynatrace Perform 2026:
 * - "Dynatrace Intelligence" (not "Davis AI")
 * - "Agentic" tool tiers: Observe → Analyze → Act → Automate
 */

import type { ForecastResult, AnomalyResult, NoveltyResult } from "../utils/davisAnalyzers";

// ============================================
// Tool Registry Types
// ============================================

/** Every tool must define its metadata and execution contract */
export interface AgentTool {
  /** Unique tool identifier (e.g., "provider_health") */
  name: string;
  /** Human-readable label shown in UI */
  label: string;
  /** Short description for the orchestrator */
  description: string;
  /** Keywords / intents that trigger this tool */
  triggers: string[];
  /** Example user queries that should route to this tool */
  examples?: string[];
  /** Parameter schema */
  parameters: ToolParameter[];
  /** Tier: 1 = Observe, 2 = Analyze, 3 = Act, 4 = Automate */
  tier: 1 | 2 | 3 | 4;
  /** The execute function */
  execute: (ctx: ToolExecutionContext) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

/** Context passed to every tool execution */
export interface ToolExecutionContext {
  /** The user's natural language question */
  question: string;
  /** Resolved timeframe */
  timeframe: string;
  /** Additional parameters extracted from the question */
  params: Record<string, string | number | boolean>;
  /** Abort signal for cancelling in-flight requests */
  signal?: AbortSignal;
  /** Summary of previous tool results for multi-turn context */
  conversationContext?: ConversationContext;
}

/** Lightweight scratchpad from prior turns — no raw data, just key facts */
export interface ConversationContext {
  /** Last tools that ran (and their summaries) */
  previousTools: Array<{ tool: string; summary: string }>;
  /** Entities mentioned/discovered in prior turns */
  entities: {
    providers?: string[];
    models?: string[];
    services?: string[];
  };
  /** Turn count in this session */
  turnCount: number;
}

// ============================================
// Tool Result Types
// ============================================

export interface ToolResult {
  success: boolean;
  /** Tool that produced this result */
  toolName: string;
  /** Human-readable summary */
  summary: string;
  /** Structured data blocks for rich rendering */
  blocks: MessageBlock[];
  /** Raw DQL used (for transparency) */
  dql?: string;
  /** Execution time in ms */
  executionTimeMs?: number;
  /** Error details */
  error?: string;
  /** Follow-up suggestions */
  followUps?: FollowUpChip[];
}

/** Follow-up action chips shown after a tool response */
export interface FollowUpChip {
  label: string;
  query: string;
}

// ============================================
// Message Block Types (Rich Rendering)
// ============================================

/** Rich message blocks for structured chat responses */
export type MessageBlock =
  | TextBlock
  | TableBlock
  | MetricBlock
  | AlertBlock
  | AnalyzerBlock
  | ChartBlock;

export interface TextBlock {
  type: "text";
  content: string; // Markdown
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface MetricBlock {
  type: "metric";
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: "up" | "down" | "stable";
    severity?: "healthy" | "warning" | "critical";
  }>;
}

export interface AlertBlock {
  type: "alert";
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  message: string;
}

export interface AnalyzerBlock {
  type: "analyzer";
  analyzerName: string;
  forecast?: ForecastResult;
  anomaly?: AnomalyResult;
  novelty?: NoveltyResult;
}

export interface ChartBlock {
  type: "chart";
  chartType: "timeseries" | "bar" | "pie";
  title: string;
  data: Array<{ label: string; value: number; timestamp?: string }>;
  unit?: string;
  dql?: string;
}

// ============================================
// Orchestrator Types
// ============================================

export interface OrchestratorPlan {
  steps: OrchestratorStep[];
  reasoning: string;
}

export interface OrchestratorStep {
  tool: AgentTool;
  params: Record<string, string | number | boolean>;
  dependsOn?: string;
}

// ============================================
// Chat Message Types (UI)
// ============================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Structured blocks for rich rendering (assistant only) */
  blocks?: MessageBlock[];
  /** Tools that produced this response */
  toolsUsed?: string[];
  /** Follow-up suggestion chips */
  followUps?: FollowUpChip[];
  /** Whether this message is still loading */
  isLoading?: boolean;
  /** Selection method used */
  selectionMethod?: "semantic" | "ai" | "keyword";
  /** AI reasoning for tool selection */
  selectionReasoning?: string;
}
