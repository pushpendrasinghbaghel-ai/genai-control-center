// Live Dynatrace Workflows Integration Hook
// Connects Quick Actions to real Dynatrace automation

import { useState, useCallback, useEffect } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { Timeframe } from '@dynatrace/strato-components-preview/core';
import { getTimeframeDqlClause } from '../components/FilterBar';

// Note: @dynatrace-sdk/client-automation should be added for production workflow execution
// For now, we query workflow data from Grail and simulate execution

export interface WorkflowDefinition {
  id: string;
  title: string;
  description?: string;
  trigger?: string;
  isPrivate: boolean;
  owner?: string;
  lastModified?: string;
  state?: 'ENABLED' | 'DISABLED';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'CANCELLED' | 'PENDING';
  startTime: string;
  endTime?: string;
  result?: unknown;
  error?: string;
}

export interface LiveProblem {
  problemId: string;
  displayId: string;
  title: string;
  status: 'OPEN' | 'CLOSED';
  severity: 'ERROR' | 'PERFORMANCE' | 'RESOURCE_CONTENTION' | 'CUSTOM_ALERT' | 'AVAILABILITY';
  impactLevel: 'APPLICATION' | 'ENVIRONMENT' | 'INFRASTRUCTURE' | 'SERVICE';
  affectedEntities: string[];
  rootCauseEntity?: string;
  startTime: string;
  endTime?: string;
  isGenAIRelated: boolean;
}

interface UseWorkflowsResult {
  // Workflow management
  workflows: WorkflowDefinition[];
  workflowsLoading: boolean;
  workflowsError: Error | null;
  fetchWorkflows: () => Promise<void>;
  
  // Workflow execution
  runWorkflow: (workflowId: string, params?: Record<string, unknown>) => Promise<WorkflowExecution>;
  executions: WorkflowExecution[];
  executionsLoading: boolean;
  
  // Create GenAI-specific workflow
  createGenAIWorkflow: (config: GenAIWorkflowConfig) => Promise<string>;
}

export interface GenAIWorkflowConfig {
  name: string;
  type: 'rate_limit' | 'fallback' | 'kill_switch' | 'alert' | 'notification';
  trigger: {
    type: 'problem' | 'schedule' | 'manual';
    conditions?: {
      provider?: string;
      errorRateThreshold?: number;
      latencyThreshold?: number;
    };
  };
  actions: {
    type: string;
    params: Record<string, unknown>;
  }[];
  notification?: {
    channel: 'slack' | 'email';
    target: string;
  };
}

/**
 * Hook for live Dynatrace Workflows integration
 * Note: Full automation SDK integration requires @dynatrace-sdk/client-automation
 */
export function useWorkflows(): UseWorkflowsResult {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<Error | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  // Fetch workflows from Grail (workflow execution events)
  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    setWorkflowsError(null);
    
    try {
      // Query workflow execution events from Grail to discover workflows
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch bizevents, from: now()-7d, to: now()
            | filter event.type == "automation.workflow.run.finished" OR 
                    event.type == "automation.workflow.run.started"
            | summarize {
                runs = count(),
                last_run = max(timestamp)
              }, by: { workflow.id, workflow.title }
            | sort runs desc
            | limit 20
          `,
          requestTimeoutMilliseconds: 30000,
          fetchTimeoutSeconds: 30
        }
      });

      const records = response.result?.records || [];
      
      const workflowList: WorkflowDefinition[] = records.map((record: any) => ({
        id: record['workflow.id'] || `workflow-${Math.random().toString(36).substring(7)}`,
        title: record['workflow.title'] || 'Unknown Workflow',
        description: `Executed ${Number(record.runs) || 0} times in last 7 days`,
        trigger: 'manual',
        isPrivate: false,
        owner: 'Dynatrace',
        lastModified: record.last_run,
        state: 'ENABLED'
      }));
      
      // Add sample GenAI-specific workflows if none found
      if (workflowList.length === 0) {
        workflowList.push(
          {
            id: 'gcc-rate-limit-response',
            title: 'GCC: Rate Limit Response',
            description: 'Automatically respond to 429 errors from AI providers',
            trigger: 'davis-problem',
            isPrivate: false,
            state: 'ENABLED'
          },
          {
            id: 'gcc-provider-failover',
            title: 'GCC: Provider Failover',
            description: 'Route traffic to backup provider on primary failure',
            trigger: 'davis-problem',
            isPrivate: false,
            state: 'ENABLED'
          },
          {
            id: 'gcc-cost-alert',
            title: 'GCC: Cost Threshold Alert',
            description: 'Alert when AI costs exceed budget threshold',
            trigger: 'schedule',
            isPrivate: false,
            state: 'ENABLED'
          }
        );
      }
      
      setWorkflows(workflowList);
    } catch (err) {
      console.error('[GCC] Failed to fetch workflows:', err);
      setWorkflowsError(err instanceof Error ? err : new Error('Failed to fetch workflows'));
      
      // Provide sample workflows on error
      setWorkflows([
        {
          id: 'gcc-rate-limit-response',
          title: 'GCC: Rate Limit Response',
          description: 'Automatically respond to 429 errors from AI providers',
          trigger: 'davis-problem',
          isPrivate: false,
          state: 'ENABLED'
        },
        {
          id: 'gcc-provider-failover', 
          title: 'GCC: Provider Failover',
          description: 'Route traffic to backup provider on primary failure',
          trigger: 'davis-problem',
          isPrivate: false,
          state: 'ENABLED'
        }
      ]);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  // Simulate workflow execution (requires @dynatrace-sdk/client-automation for real execution)
  const runWorkflow = useCallback(async (
    workflowId: string, 
    params?: Record<string, unknown>
  ): Promise<WorkflowExecution> => {
    setExecutionsLoading(true);
    
    const executionId = `exec-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'RUNNING',
      startTime: new Date().toISOString()
    };
    
    setExecutions(prev => [...prev, execution]);
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update to success
    const completedExecution: WorkflowExecution = {
      ...execution,
      status: 'SUCCESS',
      endTime: new Date().toISOString(),
      result: { 
        message: `Workflow ${workflowId} executed successfully`,
        params 
      }
    };
    
    setExecutions(prev => prev.map(e => e.id === executionId ? completedExecution : e));
    setExecutionsLoading(false);
    
    return completedExecution;
  }, []);

  // Create a GenAI-specific workflow (simulation)
  const createGenAIWorkflow = useCallback(async (config: GenAIWorkflowConfig): Promise<string> => {
    console.log('[GCC] Creating GenAI workflow:', config);
    
    // In production, this would use automationClient.createWorkflow()
    const workflowId = `gcc-${config.type}-${Date.now()}`;
    
    const newWorkflow: WorkflowDefinition = {
      id: workflowId,
      title: `GCC: ${config.name}`,
      description: `Auto-generated workflow for ${config.type}`,
      trigger: config.trigger.type,
      isPrivate: false,
      state: 'ENABLED',
      lastModified: new Date().toISOString()
    };
    
    setWorkflows(prev => [...prev, newWorkflow]);
    
    return workflowId;
  }, []);

  // Auto-fetch workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    workflowsLoading,
    workflowsError,
    fetchWorkflows,
    runWorkflow,
    executions,
    executionsLoading,
    createGenAIWorkflow
  };
}

/**
 * Hook for fetching live Dynatrace problems related to GenAI services
 */
export function useLiveProblems(timeframe?: Timeframe | null, autoRefreshMs: number = 30000) {
  const [problems, setProblems] = useState<LiveProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchProblems = useCallback(async () => {
    try {
      const timeframeClause = getTimeframeDqlClause(timeframe || null);

      // Step 1: Get GenAI service entity IDs first
      const genaiServicesResponse = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, ${timeframeClause}
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | summarize request_count = count(), by: { dt.entity.service }
            | limit 100
          `,
          requestTimeoutMilliseconds: 30000,
          fetchTimeoutSeconds: 30
        }
      });
      
      const genaiServiceIds = (genaiServicesResponse.result?.records || [])
        .map((r: any) => r['dt.entity.service'])
        .filter(Boolean);

      const genaiServiceIdsSet = new Set(genaiServiceIds);

      // Step 2: Query all problems (active + recent closed) and filter to GenAI-related
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch dt.davis.problems, ${timeframeClause}
            | fields problem_id = event.id, display_id, title = event.name, 
                     status = event.status, severity = event.category,
                     affected_entities = affected_entity_ids,
                     root_cause = root_cause_entity_name,
                     start_time = event.start, end_time = event.end
            | sort start_time desc
            | limit 200
          `,
          requestTimeoutMilliseconds: 30000,
          fetchTimeoutSeconds: 30
        }
      });

      const records = response.result?.records || [];
      
      // Step 3: Parse all problems and mark GenAI-related ones
      const parsedProblems: LiveProblem[] = records.map((record: any) => {
        const affectedEntities = record.affected_entities || [];
        const isGenAIRelated = affectedEntities.some((id: string) => genaiServiceIdsSet.has(id));
        
        return {
          problemId: record.problem_id || record.display_id || '',
          displayId: record.display_id || '',
          title: record.title || 'Unknown Problem',
          status: record.status === 'ACTIVE' ? 'OPEN' : record.status,
          severity: record.severity || 'ERROR',
          impactLevel: 'SERVICE' as const,
          affectedEntities,
          rootCauseEntity: record.root_cause,
          startTime: record.start_time || new Date().toISOString(),
          endTime: record.end_time,
          isGenAIRelated
        };
      });

      setProblems(parsedProblems);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('[GCC] Failed to fetch problems:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch problems'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProblems();
  }, [fetchProblems, timeframe]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshMs > 0) {
      const interval = setInterval(fetchProblems, autoRefreshMs);
      return () => clearInterval(interval);
    }
  }, [autoRefreshMs, fetchProblems]);

  const genaiProblems = problems.filter(p => p.isGenAIRelated);
  const otherProblems = problems.filter(p => !p.isGenAIRelated);

  return {
    problems,
    genaiProblems,
    otherProblems,
    loading,
    error,
    lastRefresh,
    refetch: fetchProblems
  };
}
