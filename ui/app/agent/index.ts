/**
 * Agent Module — Barrel Export
 *
 * Dynatrace Intelligence agentic system for GenAI observability.
 */

// Types
export type {
  AgentTool,
  ToolParameter,
  ToolExecutionContext,
  ToolResult,
  MessageBlock,
  TextBlock,
  TableBlock,
  MetricBlock,
  AlertBlock,
  AnalyzerBlock,
  ChartBlock,
  FollowUpChip,
  ChatMessage,
  ConversationContext,
  OrchestratorPlan,
  OrchestratorStep,
} from "./types";

// Tool Registry
export { TOOL_REGISTRY } from "./tools";

// AI Tool Selector
export { selectToolWithAI } from "./aiToolSelector";
export type { AISelectionResult, SelectionMode } from "./aiToolSelector";

// Orchestrator
export { orchestrate, listAvailableTools, getQuickInvestigations } from "./orchestrator";
export type { OrchestrationResult } from "./orchestrator";
