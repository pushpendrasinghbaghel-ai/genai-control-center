// GenAI Control Center — Infrastructure Hook
// Surfaces deployment events, service config snapshots, and model version history.
// Provider availability → /providers page. Service workloads → /services page.
// Davis problems → /problems page.

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { Timeframe } from '@dynatrace/strato-components/core';
import {
  INFRA_DEPLOYMENT_EVENTS_QUERY,
  INFRA_SERVICE_CONFIG_QUERY,
  INFRA_MODEL_HISTORY_QUERY,
  GPU_UTILIZATION_QUERY,
  K8S_AI_EVENTS_QUERY,
  PROCESS_RESTARTS_QUERY,
  RATE_LIMIT_ERRORS_QUERY,
  buildTimeRangeClauseFromTimeframe,
} from '../queries/dql-queries';
import type { DeploymentEvent, ServiceConfig, ModelHistoryEntry } from '../types';

// ============================================
// Types for new data
// ============================================

export interface K8sEvent {
  timestamp: string;
  eventKind: string;
  eventType: string;
  entityName: string;
  content: string;
}

export interface ProcessRestart {
  processGroup: string;
  host: string;
  restarts: number;
}

export interface RateLimitError {
  service: string;
  model: string;
  errorCount: number;
  lastOccurrence: string;
}

// ============================================
// Return Shape
// ============================================

export interface UseInfrastructureReturn {
  deployments: DeploymentEvent[];
  serviceConfigs: ServiceConfig[];
  modelHistory: ModelHistoryEntry[];
  k8sEvents: K8sEvent[];
  processRestarts: ProcessRestart[];
  rateLimitErrors: RateLimitError[];
  loading: boolean;
  error: Error | null;
  refetch: (timeframe?: Timeframe | null) => Promise<void>;
}

// ============================================
// Helper
// ============================================

async function runQuery(query: string): Promise<unknown[]> {
  try {
    const resp = await queryExecutionClient.queryExecute({
      body: {
        query,
        requestTimeoutMilliseconds: 60000,
        fetchTimeoutSeconds: 60,
      },
    });
    return resp.result?.records ?? [];
  } catch (e) {
    console.warn('[GCC:Infrastructure] Query failed:', e);
    return [];
  }
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

// ============================================
// Hook
// ============================================

export function useInfrastructure(): UseInfrastructureReturn {
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [serviceConfigs, setServiceConfigs] = useState<ServiceConfig[]>([]);
  const [modelHistory, setModelHistory] = useState<ModelHistoryEntry[]>([]);
  const [k8sEvents, setK8sEvents] = useState<K8sEvent[]>([]);
  const [processRestarts, setProcessRestarts] = useState<ProcessRestart[]>([]);
  const [rateLimitErrors, setRateLimitErrors] = useState<RateLimitError[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (timeframe: Timeframe | null = null) => {
    setLoading(true);
    setError(null);
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    const filters = { timeframe };
    try {
      const [deployRows, configRows, historyRows, k8sRows, restartRows, rateLimitRows] = await Promise.all([
        runQuery(INFRA_DEPLOYMENT_EVENTS_QUERY(timeClause)),
        runQuery(INFRA_SERVICE_CONFIG_QUERY(timeClause)),
        runQuery(INFRA_MODEL_HISTORY_QUERY()),
        runQuery(K8S_AI_EVENTS_QUERY(filters)),
        runQuery(PROCESS_RESTARTS_QUERY(filters)),
        runQuery(RATE_LIMIT_ERRORS_QUERY(filters)),
      ]);

      setDeployments(
        deployRows.map((r: any) => ({
          eventId: str(r['event_id']),
          title: str(r['title']),
          entity: str(r['entity']),
          timestamp: str(r['timestamp']),
          version: str(r['version']),
          artifact: str(r['artifact']),
        }))
      );

      setServiceConfigs(
        configRows.map((r: any) => ({
          serviceName: str(r['service_name']),
          model: str(r['model']),
          provider: str(r['provider']),
          modelVersions: num(r['model_versions']),
          requestCount: num(r['request_count']),
          lastSeen: str(r['last_seen']),
        }))
      );

      setModelHistory(
        historyRows.map((r: any) => ({
          serviceName: str(r['service_name']),
          model: str(r['model']),
          provider: str(r['provider']),
          requestCount: num(r['request_count']),
          firstSeen: str(r['first_seen']),
          lastSeen: str(r['last_seen']),
        }))
      );

      setK8sEvents(
        k8sRows.map((r: any) => ({
          timestamp: str(r['timestamp']),
          eventKind: str(r['event.kind'] ?? r['eventKind']),
          eventType: str(r['event.type'] ?? r['eventType']),
          entityName: str(r['dt.entity.host'] ?? r['entityName'] ?? ''),
          content: str(r['content'] ?? r['event.description'] ?? ''),
        }))
      );

      setProcessRestarts(
        restartRows.map((r: any) => ({
          processGroup: str(r['dt.entity.process_group'] ?? r['processGroup']),
          host: str(r['dt.entity.host'] ?? r['host']),
          restarts: num(r['restarts']),
        }))
      );

      setRateLimitErrors(
        rateLimitRows.map((r: any) => ({
          service: str(r['dt.entity.service'] ?? r['service']),
          model: str(r['gen_ai.request.model'] ?? r['model']),
          errorCount: num(r['error_count']),
          lastOccurrence: str(r['last_occurrence']),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return { deployments, serviceConfigs, modelHistory, k8sEvents, processRestarts, rateLimitErrors, loading, error, refetch };
}
