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
  /** Raw arrays from collectDistinct — all providers/models observed for this service */
  providers?: string[];
  models?: string[];
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
  serviceName?: string;
  traceStart?: string;
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

// ============================================
// Phase 5.4 — Vector DB Extended Observability Types
// ============================================

/** Per-operation latency split: query vs upsert vs delete */
export interface VectorIndexPerformance {
  opType: string;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  callCount: number;
  errorCount: number;
  errorRate: number;
}

/** Hourly ingestion throughput timeseries */
export interface VectorIngestionPoint {
  timestamp: number;
  upserts: number;
  avgUpsertLatencyMs: number;
  errors: number;
}

/** Query volume and latency by namespace / index */
export interface VectorResultSetSize {
  namespace: string;
  indexName: string;
  queryCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

/** Namespace / index metadata with latency and error attribution */
export interface SourceDocumentMetadata {
  namespace: string;
  indexName: string;
  dbSystem: string;
  queryCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

/** Hourly prompt/completion token trend — tokenization drift */
export interface TokenizationDriftPoint {
  timestamp: number;
  avgPromptTokens: number;
  p95PromptTokens: number;
  avgCompletionTokens: number;
  totalTokens: number;
}

/** Per-hour retrieval anomaly indicator */
export interface RetrievalAnomalyPoint {
  timestamp: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  queryCount: number;
  errorCount: number;
  anomalyRatio: number;
  isAnomalous: boolean;
}

/** Retrieve success/failure rate + latency by namespace */
export interface ContextRetrievalEffectiveness {
  namespace: string;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

// ============================================
// Phase 6 — Infrastructure Types
// ============================================

export interface InfraProvider {
  provider: string;
  total: number;
  errors: number;
  availabilityPct: number;
  avgLatencyMs: number;
}

export interface InfraServiceWorkload {
  serviceName: string;
  spanCount: number;
  errorCount: number;
  errorRate: number;
  modelCount: number;
  avgLatencyMs: number;
  provider: string;
  lastSeen: string;
}

export interface DavisProblem {
  problemId: string;
  title: string;
  severity: string;
  status: string;
  startTime: string;
  durationMin: number;
  affectedEntities: string;
}

export interface DeploymentEvent {
  eventId: string;
  title: string;
  entity: string;
  timestamp: string;
  version: string;
  artifact: string;
}

/** Current model + provider a service is configured to call */
export interface ServiceConfig {
  serviceName: string;
  model: string;
  provider: string;
  modelVersions: number;
  requestCount: number;
  lastSeen: string;
}

/** Historical record: when a service used a specific model/provider combination */
export interface ModelHistoryEntry {
  serviceName: string;
  model: string;
  provider: string;
  requestCount: number;
  firstSeen: string;
  lastSeen: string;
}

// ============================================
// Phase 7 — Cross-Provider Deep Observability Types
// Only types for data confirmed to exist in Grail
// ============================================

/** Prompt caching summary */
export interface PromptCacheSummary {
  cachedTokens: number;
  writeTokens: number;
  estimatedSavingsUsd: number;
}

/** Prompt cache hit rate */
export interface PromptCacheHitRate {
  hits: number;
  total: number;
  cacheHitPct: number;
}

/** Prompt cache time saved */
export interface PromptCacheTimeSaved {
  cachedDurationMs: number;
  normalDurationMs: number;
  timeSavedMs: number;
}

/** OTel metric-based token consumption */
export interface OtelTokenConsumption {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/** Top expensive/slowest prompt entry */
export interface TopPromptEntry {
  prompt: string;
  response: string;
  traceId: string;
  provider: string;
  model: string;
  totalTokens: number;
  durationMs: number;
}

/** Service health split */
export interface ServiceHealthSplit {
  status: string;
  requests: number;
}

/** Cross-provider summary row */
export interface CrossProviderSummaryRow {
  provider: string;
  requests: number;
  totalInput: number;
  totalOutput: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errors: number;
  errorRate: number;
}

// ============================================
// Phase 9 — External Integrations Types
// ============================================

/** Slack integration configuration and status */
export interface SlackIntegrationConfig {
  webhookUrl: string;
  channel: string;
  enabled: boolean;
  notifyOn: SlackNotifyTrigger[];
  lastNotificationTime?: string;
  totalNotificationsSent: number;
}

export type SlackNotifyTrigger =
  | 'error_spike'
  | 'latency_breach'
  | 'cost_threshold'
  | 'model_drift'
  | 'provider_down'
  | 'security_incident'
  | 'anomaly_detected';

export interface SlackNotification {
  id: string;
  channel: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  trigger: SlackNotifyTrigger;
  delivered: boolean;
  metadata?: Record<string, unknown>;
}

export interface SlackChannelStatus {
  channel: string;
  connected: boolean;
  lastMessage?: string;
  messagesLast24h: number;
  errorCount: number;
}

/** PagerDuty integration configuration and status */
export interface PagerDutyIntegrationConfig {
  serviceKey: string;
  apiToken: string;
  enabled: boolean;
  escalationPolicy: string;
  autoResolve: boolean;
  triggerOn: PagerDutyTrigger[];
  totalIncidentsCreated: number;
}

export type PagerDutyTrigger =
  | 'critical_error_rate'
  | 'provider_outage'
  | 'budget_exceeded'
  | 'security_breach'
  | 'sla_violation'
  | 'model_hallucination';

export interface PagerDutyIncident {
  id: string;
  incidentKey: string;
  title: string;
  description: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  status: 'triggered' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  service: string;
  trigger: PagerDutyTrigger;
  deduplicationKey: string;
}

export interface PagerDutyServiceStatus {
  serviceName: string;
  status: 'active' | 'warning' | 'critical' | 'disabled';
  openIncidents: number;
  acknowledgedIncidents: number;
  resolvedLast24h: number;
  mttrMinutes: number;
}

/** Prometheus MCP Server integration types */
export interface PrometheusMCPConfig {
  endpoint: string;
  enabled: boolean;
  scrapeInterval: number;
  metricsPrefix: string;
  lastScrapeTime?: string;
  exportedMetrics: number;
}

export interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface PrometheusScrapeStatus {
  endpoint: string;
  healthy: boolean;
  lastScrapeMs: number;
  sampleCount: number;
  errorCount: number;
  uptime: string;
}

export interface PrometheusGenAIMetrics {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  activeModels: number;
  providers: string[];
  costUsd: number;
}

/** Dynatrace Agentic Workflow types */
export interface AgenticWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  type: AgenticWorkflowType;
  triggers: AgenticWorkflowTrigger[];
  actions: AgenticWorkflowAction[];
  enabled: boolean;
  lastExecuted?: string;
  executionCount: number;
  successRate: number;
  avgExecutionTimeMs: number;
  owner: string;
}

export type AgenticWorkflowType =
  | 'remediation'
  | 'notification'
  | 'scaling'
  | 'failover'
  | 'cost_control'
  | 'security_response'
  | 'data_pipeline'
  | 'observability';

export interface AgenticWorkflowTrigger {
  type: 'problem' | 'threshold' | 'schedule' | 'manual' | 'event' | 'webhook';
  condition: string;
  parameters: Record<string, unknown>;
}

export interface AgenticWorkflowAction {
  id: string;
  type: 'dql_query' | 'slack_notify' | 'pagerduty_incident' | 'http_request'
       | 'workflow_trigger' | 'davis_analyze' | 'prometheus_push' | 'auto_remediate';
  name: string;
  parameters: Record<string, unknown>;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  timeout?: number;
}

export interface AgenticWorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  durationMs?: number;
  triggeredBy: string;
  actionsCompleted: number;
  totalActions: number;
  result?: string;
  error?: string;
  logs: AgenticWorkflowLog[];
}

export interface AgenticWorkflowLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  action: string;
  message: string;
  durationMs?: number;
}

/** Agentic Workflow — simplified config for UI hook */
export interface AgenticWorkflowConfig {
  enabled: boolean;
  autoRemediate: boolean;
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
}

/** Agentic Workflow — template with trigger and actions */
export interface AgenticWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  actions: AgenticWorkflowAction[];
  triggerCondition: string;
  enabled: boolean;
}

/** Integration health overview */
export interface IntegrationHealthSummary {
  slack: {
    connected: boolean;
    channels: number;
    messagesLast24h: number;
    errors: number;
  };
  pagerDuty: {
    connected: boolean;
    services: number;
    openIncidents: number;
    mttrMinutes: number;
  };
  prometheus: {
    connected: boolean;
    metricsExported: number;
    lastScrapeMs: number;
    healthy: boolean;
  };
  agenticWorkflows: {
    total: number;
    enabled: number;
    executionsLast24h: number;
    successRate: number;
  };
  awsBilling: {
    connected: boolean;
    monthlySpend: number;
    budgetUtilizationPct: number;
    anomalyCount: number;
  };
  awsCloudWatch: {
    connected: boolean;
    activeAlarms: number;
    metricsPublished: number;
    logGroupsMonitored: number;
  };
  grafana: {
    connected: boolean;
    dashboards: number;
    alertRules: number;
    annotations: number;
  };
  github: {
    connected: boolean;
    openIssues: number;
    openPRs: number;
    recentDeployments: number;
  };
}

// ============================================
// Phase 10 — AWS Billing & Cost Management Types
// ============================================

export interface AWSBillingConfig {
  accessKeyId: string;
  region: string;
  enabled: boolean;
  monthlyBudget: number;
  warningThresholdPct: number;
  criticalThresholdPct: number;
}

export interface AWSCostBreakdown {
  service: string;
  costUsd: number;
  isGenAI: boolean;
  period: string;
}

export interface AWSBudgetStatus {
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  currentSpend: number;
  monthlyBudget: number;
  utilizationPct: number;
  projectedMonthEnd: number;
  dailyRate: number;
  alerts: string[];
}

export interface AWSCostAnomaly {
  provider: string;
  metric: string;
  latestValue: number;
  mean: number;
  zScore: number;
  direction: 'spike' | 'drop';
  severity: 'warning' | 'critical';
  estimatedCostImpactUsd: number;
}

// ============================================
// Phase 10 — AWS CloudWatch Types
// ============================================

export interface AWSCloudWatchConfig {
  region: string;
  enabled: boolean;
  namespace: string;
  metricsPublished: number;
}

export interface CloudWatchAlarm {
  title: string;
  severity: string;
  status: string;
  affectedEntity: string;
  startTime: string;
  source: string;
}

export interface CloudWatchMetricData {
  name: string;
  value: number;
  unit: string;
  namespace: string;
}

export interface CloudWatchDashboardWidget {
  title: string;
  value: number | string;
  type: string;
}

// ============================================
// Phase 10 — Grafana Integration Types
// ============================================

export interface GrafanaConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
  defaultDatasource: string;
}

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
  tags: string[];
  folderTitle: string;
}

export interface GrafanaAlert {
  uid: string;
  title: string;
  state: 'firing' | 'pending' | 'inactive';
  condition: string;
  labels: Record<string, string>;
}

export interface GrafanaAnnotation {
  id: number;
  text: string;
  tags: string[];
  dashboardUid: string;
  time: number;
}

export interface GrafanaSnapshot {
  name: string;
  url: string;
  key: string;
  expires: number;
  metrics: {
    totalRequests: number;
    errorRate: number;
    avgLatencyMs: number;
    totalTokens: number;
  };
}

// ============================================
// Phase 10 — GitHub Integration Types
// ============================================

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  enabled: boolean;
  autoCreateIssues: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  branch: string;
  base: string;
  draft: boolean;
  createdAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
}

export interface GitHubDeployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  creator: string;
  createdAt: string;
  description: string;
}

export interface GitHubRepoInfo {
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  topics: string[];
  url: string;
}
