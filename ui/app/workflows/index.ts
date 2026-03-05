// Agentic Workflow Templates - Index
// Export workflow definitions for use in GCC

export { 
  FINOPS_DIGEST_WORKFLOW,
  TOKEN_BUDGET_ALERT_WORKFLOW,
  ERROR_RATE_MONITOR_WORKFLOW,
  deployWorkflow,
  getWorkflowDeployUrl
} from './agentic-templates';

export {
  COST_VELOCITY_GUARDRAIL_WORKFLOW,
  BUDGET_EXHAUSTION_WORKFLOW,
  COST_MODEL_SWITCH_WORKFLOW
} from './cost-guardrail-workflow';

export {
  SECURITY_INCIDENT_WORKFLOW,
  PII_CIRCUIT_BREAKER_WORKFLOW
} from './security-incident-workflow';

export {
  RAG_HEALTH_MONITOR_WORKFLOW,
  RAG_REINDEX_WORKFLOW
} from './rag-healing-workflow';

export {
  PROVIDER_HEALTH_MONITOR_WORKFLOW,
  PROVIDER_FAILOVER_RECOMMENDATION_WORKFLOW,
  PROVIDER_FAILOVER_TEMPLATES
} from './provider-failover-workflow';
