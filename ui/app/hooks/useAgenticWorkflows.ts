/**
 * Agentic Workflows Integration Hook
 *
 * Uses Dynatrace Automation SDK to manage agentic workflows — creation,
 * execution, status tracking, and templated GenAI remediation workflows.
 * All operations use real Dynatrace APIs through the Automation SDK.
 *
 * Architecture:
 * - Automation SDK for CRUD on workflows and executions
 * - DQL queries for execution history, success rates, performance metrics
 * - Pre-built workflow templates for common GenAI remediation scenarios
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { workflowsClient, executionsClient } from '@dynatrace-sdk/client-automation';
import type {
  AgenticWorkflowConfig,
  AgenticWorkflowTemplate,
  AgenticWorkflowExecution,
} from '../types';

// ============================================
// Real Workflow Types (from Dynatrace Automation API)
// ============================================

export interface RealWorkflow {
  id: string;
  title: string;
  description?: string;
  owner: string;
  state: 'ENABLED' | 'DISABLED';
  lastExecution?: {
    id: string;
    state: string;
    startTime: string;
    endTime?: string;
  };
  trigger?: {
    eventTrigger?: { isActive: boolean; triggerConfiguration?: { type: string } };
    schedule?: { isActive: boolean };
  };
  tasks?: Record<string, { name: string; action: string }>;
  modificationDate?: string;
  creationDate?: string;
}

export interface RealExecution {
  id: string;
  workflowId: string;
  title: string;
  state: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'CANCELLED' | 'WAITING';
  startTime: string;
  endTime?: string;
  trigger: string;
  user?: string;
}

// ============================================
// DQL Queries
// ============================================

const WORKFLOW_EXECUTIONS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | summarize {
      total = count(),
      successful = countIf(event.status == "SUCCESS"),
      failed = countIf(event.status == "ERROR"),
      running = countIf(event.status == "RUNNING"),
      avg_duration_ms = avg(toDouble(coalesce(duration, 0))) / 1000000,
      distinct_workflows = countDistinct(dt.automation.workflow_id)
    }
`;

const WORKFLOW_EXECUTION_HISTORY_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | fieldsAdd workflow_id = coalesce(dt.automation.workflow_id, ""),
               workflow_name = coalesce(event.name, "Unknown Workflow"),
               status = coalesce(event.status, "UNKNOWN"),
               triggered = coalesce(dt.automation.trigger_type, "manual"),
               duration_ms = toDouble(coalesce(duration, 0)) / 1000000
  | sort timestamp desc
  | limit 50
`;

const WORKFLOW_SUCCESS_BY_TYPE_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | summarize {
      total = count(),
      success = countIf(event.status == "SUCCESS"),
      failed = countIf(event.status == "ERROR"),
      success_rate = toDouble(countIf(event.status == "SUCCESS")) / toDouble(count()) * 100.0,
      avg_duration_ms = avg(toDouble(coalesce(duration, 0))) / 1000000
    }, by: { event.name }
  | sort total desc
  | limit 20
`;

const GENAI_REMEDIATION_CANDIDATES_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      total_requests = count(),
      error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
      error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
      avg_latency_ms = avg(duration) / 1000000,
      p99_latency_ms = percentile(duration, 99) / 1000000,
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
    }, by: { gen_ai.provider.name, gen_ai.request.model }
  | filter error_rate > 5 OR p99_latency_ms > 5000
  | sort error_rate desc
  | limit 15
`;

// ============================================
// Workflow Templates
// ============================================

const WORKFLOW_TEMPLATES: AgenticWorkflowTemplate[] = [
  {
    id: 'genai_error_spike_remediation',
    name: 'GenAI Error Spike Remediation',
    description: 'Auto-detect error rate spikes across AI providers and trigger escalation + failover',
    category: 'remediation',
    actions: [
      { id: 'detect', type: 'dql_query', name: 'Detect Error Spike', parameters: { query: 'error_rate > threshold' } },
      { id: 'analyze', type: 'davis_analyze', name: 'Root Cause Analysis', parameters: { analyzer: 'error_analysis' } },
      { id: 'notify', type: 'slack_notify', name: 'Notify Team', parameters: { channel: '#genai-alerts' } },
      { id: 'incident', type: 'pagerduty_incident', name: 'Create Incident', parameters: { severity: 'critical' } },
    ],
    triggerCondition: 'error_rate > 10%',
    enabled: true,
  },
  {
    id: 'genai_cost_threshold_alert',
    name: 'GenAI Cost Threshold Alert',
    description: 'Monitor token-based cost and alert when budget thresholds are approaching',
    category: 'cost',
    actions: [
      { id: 'check', type: 'dql_query', name: 'Check Cost Metrics', parameters: { query: 'token_cost_check' } },
      { id: 'forecast', type: 'dql_query', name: 'Cost Forecast', parameters: { query: 'cost_projection' } },
      { id: 'notify', type: 'slack_notify', name: 'Cost Alert', parameters: { channel: '#genai-finops' } },
    ],
    triggerCondition: 'projected_monthly_cost > budget * 0.8',
    enabled: true,
  },
  {
    id: 'genai_provider_failover',
    name: 'GenAI Provider Failover',
    description: 'Detect provider outage and recommend or execute failover to backup provider',
    category: 'remediation',
    actions: [
      { id: 'detect', type: 'dql_query', name: 'Detect Outage', parameters: { query: 'provider_health_check' } },
      { id: 'analyze', type: 'davis_analyze', name: 'Impact Analysis', parameters: { analyzer: 'availability_analysis' } },
      { id: 'failover', type: 'workflow_trigger', name: 'Execute Failover', parameters: { workflow: 'failover_config' } },
      { id: 'notify', type: 'slack_notify', name: 'Failover Notification', parameters: { channel: '#genai-ops' } },
    ],
    triggerCondition: 'provider_error_rate > 50% OR provider_response_time > 30s',
    enabled: true,
  },
  {
    id: 'genai_latency_remediation',
    name: 'GenAI Latency Remediation',
    description: 'Auto-detect latency degradation and identify root cause in model or infrastructure',
    category: 'performance',
    actions: [
      { id: 'detect', type: 'dql_query', name: 'Detect Latency Spike', parameters: { query: 'p99_latency_check' } },
      { id: 'correlate', type: 'davis_analyze', name: 'Correlate with Infrastructure', parameters: { analyzer: 'slowness_analysis' } },
      { id: 'metrics', type: 'prometheus_push', name: 'Push Latency Metrics', parameters: { job: 'genai_latency' } },
      { id: 'notify', type: 'slack_notify', name: 'Latency Alert', parameters: { channel: '#genai-performance' } },
    ],
    triggerCondition: 'p99_latency > 10s',
    enabled: true,
  },
  {
    id: 'genai_security_response',
    name: 'GenAI Security Response',
    description: 'Detect prompt injection, data leakage, or auth failures and auto-respond',
    category: 'security',
    actions: [
      { id: 'detect', type: 'dql_query', name: 'Security Scan', parameters: { query: 'security_event_check' } },
      { id: 'analyze', type: 'davis_analyze', name: 'Threat Analysis', parameters: { analyzer: 'security_analysis' } },
      { id: 'incident', type: 'pagerduty_incident', name: 'Security Incident', parameters: { severity: 'critical' } },
      { id: 'notify', type: 'slack_notify', name: 'Security Alert', parameters: { channel: '#genai-security' } },
    ],
    triggerCondition: 'security_event_detected',
    enabled: true,
  },
];

// ============================================
// Hook State
// ============================================

interface AgenticWorkflowsState {
  templates: AgenticWorkflowTemplate[];
  executions: AgenticWorkflowExecution[];
  // Real workflows from Dynatrace Automation API
  realWorkflows: RealWorkflow[];
  realExecutions: RealExecution[];
  stats: {
    totalExecutions: number;
    successful: number;
    failed: number;
    running: number;
    avgDurationMs: number;
    distinctWorkflows: number;
    successRate: number;
  };
  workflowPerformance: Array<{
    name: string;
    total: number;
    successRate: number;
    avgDurationMs: number;
  }>;
  remediationCandidates: Array<{
    provider: string;
    model: string;
    errorRate: number;
    p99LatencyMs: number;
    totalRequests: number;
    suggestedWorkflow: string;
  }>;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================
// Hook
// ============================================

export function useAgenticWorkflows(timeframe = '24h') {
  const [state, setState] = useState<AgenticWorkflowsState>({
    templates: WORKFLOW_TEMPLATES,
    executions: [],
    realWorkflows: [],
    realExecutions: [],
    stats: { totalExecutions: 0, successful: 0, failed: 0, running: 0, avgDurationMs: 0, distinctWorkflows: 0, successRate: 0 },
    workflowPerformance: [],
    remediationCandidates: [],
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Fetch real workflows from Dynatrace Automation API
  const fetchRealWorkflows = useCallback(async (): Promise<{ workflows: RealWorkflow[]; executions: RealExecution[] }> => {
    try {
      // Fetch all workflows
      const workflowsResponse = await workflowsClient.getWorkflows({});
      const workflows: RealWorkflow[] = (workflowsResponse.results || []).map((w: any) => ({
        id: w.id || '',
        title: w.title || 'Untitled Workflow',
        description: w.description || '',
        owner: w.owner || 'unknown',
        state: w.state || 'DISABLED',
        lastExecution: w.lastExecution ? {
          id: w.lastExecution.id || '',
          state: w.lastExecution.state || 'UNKNOWN',
          startTime: w.lastExecution.startTime || '',
          endTime: w.lastExecution.endTime,
        } : undefined,
        trigger: w.trigger,
        tasks: w.tasks,
        modificationDate: w.modificationDate,
        creationDate: w.creationDate,
      }));

      // Fetch recent executions
      const executionsResponse = await executionsClient.getExecutions({});
      const executions: RealExecution[] = (executionsResponse.results || []).map((e: any) => ({
        id: e.id || '',
        workflowId: e.workflowId || '',
        title: e.title || 'Unknown Execution',
        state: e.state || 'RUNNING',
        startTime: e.startTime || new Date().toISOString(),
        endTime: e.endTime,
        trigger: e.trigger?.type || 'manual',
        user: e.user,
      }));

      return { workflows, executions };
    } catch (err) {
      console.error('[GCC] Failed to fetch real workflows:', err);
      return { workflows: [], executions: [] };
    }
  }, []);

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // Fetch real workflows in parallel with DQL queries
      const [realData, statsRes, historyRes, perfRes, candRes] = await Promise.all([
        fetchRealWorkflows(),
        queryExecutionClient.queryExecute({
          body: { query: WORKFLOW_EXECUTIONS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: WORKFLOW_EXECUTION_HISTORY_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: WORKFLOW_SUCCESS_BY_TYPE_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_REMEDIATION_CANDIDATES_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      if (!mountedRef.current) return;

      // Stats
      const statsRow = (statsRes.result?.records || [])[0];
      const totalExec = Number(statsRow?.['total'] || 0);
      const successful = Number(statsRow?.['successful'] || 0);
      const stats = {
        totalExecutions: totalExec,
        successful,
        failed: Number(statsRow?.['failed'] || 0),
        running: Number(statsRow?.['running'] || 0),
        avgDurationMs: Number(statsRow?.['avg_duration_ms'] || 0),
        distinctWorkflows: Number(statsRow?.['distinct_workflows'] || 0),
        successRate: totalExec > 0 ? Math.round((successful / totalExec) * 100) : 0,
      };

      // Execution history
      const executions: AgenticWorkflowExecution[] = (historyRes.result?.records || []).map((r: any) => ({
        id: String(r['timestamp'] || Date.now()),
        workflowId: String(r['workflow_id'] || ''),
        workflowName: String(r['workflow_name'] || 'Unknown'),
        status: mapStatus(String(r['status'] || 'UNKNOWN')),
        startTime: String(r['timestamp'] || new Date().toISOString()),
        durationMs: Number(r['duration_ms'] || 0),
        triggeredBy: String(r['triggered'] || 'manual'),
        actionsCompleted: 0,
        totalActions: 0,
        logs: [],
      }));

      // Workflow performance
      const workflowPerformance = (perfRes.result?.records || []).map((r: any) => ({
        name: String(r['event.name'] || 'Unknown'),
        total: Number(r['total'] || 0),
        successRate: Number(r['success_rate'] || 0),
        avgDurationMs: Number(r['avg_duration_ms'] || 0),
      }));

      // Remediation candidates
      const remediationCandidates = (candRes.result?.records || []).map((r: any) => {
        const errorRate = Number(r['error_rate'] || 0);
        const p99 = Number(r['p99_latency_ms'] || 0);
        let suggestedWorkflow = 'genai_error_spike_remediation';
        if (p99 > 5000 && errorRate < 5) suggestedWorkflow = 'genai_latency_remediation';
        if (errorRate > 50) suggestedWorkflow = 'genai_provider_failover';

        return {
          provider: String(r['gen_ai.provider.name'] || 'unknown'),
          model: String(r['gen_ai.request.model'] || 'unknown'),
          errorRate,
          p99LatencyMs: p99,
          totalRequests: Number(r['total_requests'] || 0),
          suggestedWorkflow,
        };
      });

      setState(s => ({
        ...s,
        stats,
        executions,
        workflowPerformance,
        remediationCandidates,
        realWorkflows: realData.workflows,
        realExecutions: realData.executions,
        loading: false,
        lastRefresh: new Date(),
      }));
    } catch (err) {
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch workflow data',
        }));
      }
    }
  }, [timeframe, fetchRealWorkflows]);

  // Execute a workflow via Automation SDK
  const executeWorkflow = useCallback(async (workflowId: string) => {
    try {
      const result = await workflowsClient.runWorkflow({ id: workflowId, body: {} });
      await fetchData(); // Refresh after execution
      return result;
    } catch (err) {
      console.error('Failed to execute workflow:', err);
      throw err;
    }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
    executeWorkflow,
  };
}

// ============================================
// Helpers
// ============================================

function mapStatus(s: string): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' {
  switch (s.toUpperCase()) {
    case 'SUCCESS': case 'COMPLETED': return 'completed';
    case 'ERROR': case 'FAILED': return 'failed';
    case 'RUNNING': return 'running';
    case 'CANCELLED': return 'cancelled';
    default: return 'pending';
  }
}

export default useAgenticWorkflows;
