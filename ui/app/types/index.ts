// GenAI Control Center - Type Definitions

// ============================================
// Service Entity Types
// ============================================

/** Service entity option for dropdowns (contains both ID and display name) */
export interface ServiceEntityOption {
  entityId: string;
  entityName: string;
}

// ============================================
// AI Service Discovery Types
// ============================================

export interface AIService {
  serviceName: string;
  modelName: string;
  provider: string;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
  requestCount: number;
  estimatedCost: number;
  lastSeen: string;
  healthStatus: HealthStatus;
  /** Dynatrace entity ID for deep linking to Services app */
  entityId?: string;
  /** GenAI Quality Metrics */
  slowRequestRate?: number;  // % of requests > 3 seconds (GenAI: <5% good, 5-10% warning, >10% critical)
  lowOutputRate?: number;    // % of responses with < 10 output tokens
  avgOutputTokens?: number;  // Average output tokens per request
}

export interface AIServiceMetrics {
  tokens: number;
  latency: number;
  errorRate: number;
  cost: number;
}

// ============================================
// Health Status Types
// ============================================

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface HealthMetrics {
  overallHealth: HealthStatus;
  totalServices: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  totalTokensToday: number;
  totalCostToday: number;
  totalRequests: number;
  avgLatency: number;
  avgErrorRate: number;
  /** GenAI Quality Metrics */
  avgSlowRequestRate: number;
  avgLowOutputRate: number;
}

// ============================================
// AI Architect / Pattern Detection Types
// ============================================

export type RecommendationType = 
  | 'batch_size' 
  | 'model_quantization' 
  | 'semantic_cache' 
  | 'provider_switch' 
  | 'prompt_optimization'
  | 'rate_limit_adjustment'
  | 'fallback_model'
  | 'cost_optimization'
  | 'performance'
  | 'reliability'
  | 'security'
  | 'best_practice';

export interface ArchitectRecommendation {
  id: string;
  type: RecommendationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedService: string;
  estimatedSavings?: string;
  estimatedImprovement?: string;
  estimatedImpact?: string;
  actionable: boolean;
  workflowId?: string;
}

export interface PatternAnalysis {
  pattern: string;
  indicator: string;
  gpuUtilization?: number;
  tokenThroughput?: number;
  responseTime?: number;
  recommendation: ArchitectRecommendation;
}

// ============================================
// Davis AI Assistant Types
// ============================================

export interface DavisQuery {
  id: string;
  query: string;
  context: string;
  timestamp: Date;
  serviceName?: string;
}

export interface DavisResponse {
  id: string;
  queryId: string;
  response: string;
  insights: string[];
  suggestedActions: string[];
  timestamp: Date;
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'davis';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  metadata?: {
    dqlQuery?: string;
    serviceName?: string;
  };
}

// ============================================
// Remediation / Workflow Types
// ============================================

export type RemediationActionType = 
  | 'kill_switch'
  | 'fallback_trigger'
  | 'rate_limit'
  | 'cache_enable'
  | 'provider_switch'
  | 'alert_suppress';

export interface RemediationAction {
  id: string;
  name: string;
  type: RemediationActionType;
  description: string;
  icon: string;
  isDestructive: boolean;
  requiresConfirmation: boolean;
  workflowId: string;
  parameters: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: string;
  error?: string;
}

// ============================================
// Provider Comparison Types
// ============================================

export interface ProviderStats {
  provider: string;
  models: string[];
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
  totalTokens: number;
  estimatedCost: number;
  successRate: number;
}

export interface ModelComparison {
  modelName: string;
  provider: string;
  avgLatency: number;
  avgTokensPerRequest: number;
  errorRate: number;
  costPerToken: number;
  performanceScore: number;
}

// ============================================
// DQL Query Result Types
// ============================================

export interface DQLRecord {
  [key: string]: unknown;
}

export interface DQLResult {
  records: DQLRecord[];
  metadata?: {
    executionTime: number;
    recordCount: number;
  };
}

// ============================================
// Navigation & UI Types
// ============================================

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
}

export interface AlertInfo {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  dismissed: boolean;
}

// ============================================
// RAG / Vector DB Types (Phase 5 — Viatris Gap)
// ============================================

export interface VectorDBLatency {
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  queryCount: number;
  errorCount: number;
  errorRate: number;
}

export interface EmbeddingProvider {
  provider: string;
  model: string;
  callCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

export interface RAGPipelineStep {
  stepType: 'embed' | 'retrieve' | 'generate';
  avgDurationMs: number;
  p95DurationMs: number;
  callCount: number;
  errorRate: number;
}

export interface RAGPipelineTrace {
  traceId: string;
  totalDurationMs: number;
  spanCount: number;
  hasEmbed: boolean;
  hasRetrieve: boolean;
  hasGenerate: boolean;
  isFullPipeline: boolean;
}

export interface VectorDBCacheCandidate {
  queryPreview: string;
  count: number;
  avgLatencyMs: number;
  savingsPotentialMs: number;
}

export interface VectorDBSummary {
  totalPineconeQueries: number;
  totalEmbeddings: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  fullPipelineTraces: number;
  cacheablePct: number;
}

// ============================================
// TTFT Types (Phase 5.2)
// ============================================

export interface TTFTByModel {
  model: string;
  provider: string;
  avgTtftMs: number;
  p50TtftMs: number;
  p95TtftMs: number;
  requestCount: number;
}

export interface TTFTSummary {
  avgTtftMs: number;
  p95TtftMs: number;
  count: number;
}

// ============================================
// Agent Retry Monitoring Types (Phase 5.3)
// ============================================

export interface AgentRetryTrace {
  traceId: string;
  taskCount: number;
  uniqueAgents: number;
  retryCount: number;
  totalDurationMs: number;
  agentsList: string[];
}

export interface AgentRetrySummary {
  totalTraces: number;
  tracesWithRetries: number;
  retryRate: number;
  totalExtraTasks: number;
}

export interface ChainPerformanceStep {
  stepLabel: string;
  avgDurationMs: number;
  p95DurationMs: number;
  callCount: number;
  errorRate: number;
}
