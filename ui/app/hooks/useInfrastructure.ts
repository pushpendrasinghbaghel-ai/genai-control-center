// GenAI Control Center — Infrastructure Hook
// Surfaces deployment events, service config snapshots, and model version history.
// Provider availability → /providers page. Service workloads → /services page.
// Davis problems → /problems page.

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';
import {
  INFRA_DEPLOYMENT_EVENTS_QUERY,
  INFRA_SERVICE_CONFIG_QUERY,
  INFRA_MODEL_HISTORY_QUERY,
  buildTimeRangeClauseFromTimeframe,
} from '../queries/dql-queries';
import type { DeploymentEvent, ServiceConfig, ModelHistoryEntry } from '../types';

// ============================================
// Return Shape
// ============================================

export interface UseInfrastructureReturn {
  deployments: DeploymentEvent[];
  serviceConfigs: ServiceConfig[];
  modelHistory: ModelHistoryEntry[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (timeframe: Timeframe | null = null) => {
    setLoading(true);
    setError(null);
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    try {
      const [deployRows, configRows, historyRows] = await Promise.all([
        runQuery(INFRA_DEPLOYMENT_EVENTS_QUERY(timeClause)),
        runQuery(INFRA_SERVICE_CONFIG_QUERY(timeClause)),
        runQuery(INFRA_MODEL_HISTORY_QUERY()),
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return { deployments, serviceConfigs, modelHistory, loading, error, refetch };
}
