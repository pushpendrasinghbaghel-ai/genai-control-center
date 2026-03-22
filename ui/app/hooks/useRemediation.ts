// Remediation Hook for GenAI Control Center
// Action templates for one-click automation
// NOTE: Actual execution requires @dynatrace-sdk/client-automation

import { useState, useCallback } from 'react';
import type { RemediationAction, WorkflowExecution } from '../types';
import { generateId } from '../utils';

interface UseRemediationResult {
  executions: WorkflowExecution[];
  isExecuting: boolean;
  error: Error | null;
  executeRemediation: (action: RemediationAction, params?: Record<string, unknown>) => Promise<WorkflowExecution>;
  getExecutionStatus: (executionId: string) => WorkflowExecution | undefined;
}

/**
 * Pre-defined remediation action TEMPLATES (Pillar D)
 * These describe capabilities. Actual execution requires @dynatrace-sdk/client-automation.
 */
export const REMEDIATION_ACTIONS: RemediationAction[] = [
  {
    id: 'kill-switch',
    name: 'Kill Switch',
    type: 'kill_switch',
    description: 'Immediately disable API key for a rogue AI service to stop all requests',
    icon: 'power-off',
    isDestructive: true,
    requiresConfirmation: true,
    workflowId: 'gcc-kill-switch-workflow',
    parameters: {
      serviceName: '',
      apiKeyId: ''
    }
  },
  {
    id: 'fallback-trigger',
    name: 'Fallback Trigger',
    type: 'fallback_trigger',
    description: 'Switch traffic from primary LLM to fallback model when latency exceeds threshold',
    icon: 'switch',
    isDestructive: false,
    requiresConfirmation: true,
    workflowId: 'gcc-fallback-workflow',
    parameters: {
      primaryService: '',
      fallbackService: '',
      latencyThreshold: 5000
    }
  },
  {
    id: 'rate-limit-adjust',
    name: 'Adjust Rate Limits',
    type: 'rate_limit',
    description: 'Dynamically adjust rate limits for an AI service to prevent 429 errors',
    icon: 'speed',
    isDestructive: false,
    requiresConfirmation: false,
    workflowId: 'gcc-rate-limit-workflow',
    parameters: {
      serviceName: '',
      newLimit: 100,
      windowSeconds: 60
    }
  },
  {
    id: 'cache-enable',
    name: 'Enable Semantic Cache',
    type: 'cache_enable',
    description: 'Enable semantic caching for repetitive prompts to reduce costs and latency',
    icon: 'cache',
    isDestructive: false,
    requiresConfirmation: false,
    workflowId: 'gcc-cache-workflow',
    parameters: {
      serviceName: '',
      similarityThreshold: 0.95,
      cacheTTLSeconds: 3600
    }
  },
  {
    id: 'provider-switch',
    name: 'Switch Provider',
    type: 'provider_switch',
    description: 'Route traffic from one LLM provider to another (e.g., OpenAI → Anthropic)',
    icon: 'redirect',
    isDestructive: false,
    requiresConfirmation: true,
    workflowId: 'gcc-provider-switch-workflow',
    parameters: {
      fromProvider: '',
      toProvider: '',
      affectedServices: []
    }
  },
  {
    id: 'alert-suppress',
    name: 'Suppress Alerts',
    type: 'alert_suppress',
    description: 'Temporarily suppress alerts for a service during planned maintenance',
    icon: 'bell-off',
    isDestructive: false,
    requiresConfirmation: false,
    workflowId: 'gcc-alert-suppress-workflow',
    parameters: {
      serviceName: '',
      durationMinutes: 60,
      reason: ''
    }
  }
];

/**
 * Hook for remediation workflow execution (Pillar D)
 * Execution requires @dynatrace-sdk/client-automation to be configured.
 */
export function useRemediation(): UseRemediationResult {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeRemediation = useCallback(async (
    action: RemediationAction,
    _params?: Record<string, unknown>
  ): Promise<WorkflowExecution> => {
    const executionId = generateId();
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: action.workflowId,
      status: 'pending',
      startTime: new Date()
    };

    setExecutions(prev => [...prev, execution]);
    setIsExecuting(true);
    setError(null);

    try {
      const { workflowsClient } = await import('@dynatrace-sdk/client-automation');
      const response = await workflowsClient.runWorkflow({
        id: action.workflowId,
        body: { input: {}, params: { ...action.parameters, ..._params } }
      });

      const completedExecution: WorkflowExecution = {
        ...execution,
        status: 'running',
        endTime: new Date(),
      };

      setExecutions(prev =>
        prev.map(e => e.id === executionId ? completedExecution : e)
      );

      return completedExecution;

    } catch (err) {
      const failedExecution: WorkflowExecution = {
        ...execution,
        status: 'failed',
        endTime: new Date(),
        error: err instanceof Error ? err.message : 'Automation SDK not configured'
      };

      setExecutions(prev => 
        prev.map(e => e.id === executionId ? failedExecution : e)
      );

      setError(err instanceof Error ? err : new Error('Workflow execution failed'));
      return failedExecution;

    } finally {
      setIsExecuting(false);
    }
  }, []);

  const getExecutionStatus = useCallback((executionId: string) => {
    return executions.find(e => e.id === executionId);
  }, [executions]);

  return {
    executions,
    isExecuting,
    error,
    executeRemediation,
    getExecutionStatus
  };
}

/**
 * Hook for accessing remediation action templates
 */
export function useRemediationActions() {
  return {
    actions: REMEDIATION_ACTIONS,
    getAction: (id: string) => REMEDIATION_ACTIONS.find(a => a.id === id),
    getActionsByType: (type: string) => REMEDIATION_ACTIONS.filter(a => a.type === type)
  };
}
