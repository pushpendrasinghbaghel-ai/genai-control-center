// GenAI Control Center — Infrastructure Hook (Phase 6)
// Surfaces provider availability, AI service workloads, Davis problems, and deployment events.

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  INFRA_PROVIDER_AVAILABILITY_QUERY,
  INFRA_SERVICE_WORKLOAD_QUERY,
  INFRA_DAVIS_PROBLEMS_QUERY,
  INFRA_DEPLOYMENT_EVENTS_QUERY,
} from '../queries/dql-queries';
import type {
  InfraProvider,
  InfraServiceWorkload,
  DavisProblem,
  DeploymentEvent,
} from '../types';

// ============================================
// Return Shape
// ============================================

export interface UseInfrastructureReturn {
  providers: InfraProvider[];
  workloads: InfraServiceWorkload[];
  problems: DavisProblem[];
  deployments: DeploymentEvent[];
  loading: boolean;
  error: Error | null;
  refetch: (timeRange?: string) => Promise<void>;
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
  const [providers, setProviders] = useState<InfraProvider[]>([]);
  const [workloads, setWorkloads] = useState<InfraServiceWorkload[]>([]);
  const [problems, setProblems] = useState<DavisProblem[]>([]);
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (timeRange = '24h') => {
    setLoading(true);
    setError(null);
    try {
      const [provRows, workRows, probRows, deployRows] = await Promise.all([
        runQuery(INFRA_PROVIDER_AVAILABILITY_QUERY(timeRange)),
        runQuery(INFRA_SERVICE_WORKLOAD_QUERY(timeRange)),
        runQuery(INFRA_DAVIS_PROBLEMS_QUERY(timeRange)),
        runQuery(INFRA_DEPLOYMENT_EVENTS_QUERY(timeRange)),
      ]);

      setProviders(
        provRows.map((r: any) => ({
          provider: str(r['provider']),
          total: num(r['total']),
          errors: num(r['errors']),
          availabilityPct: num(r['availability_pct']),
          avgLatencyMs: num(r['avg_latency_ms']),
        }))
      );

      setWorkloads(
        workRows.map((r: any) => ({
          serviceName: str(r['service_name']),
          spanCount: num(r['span_count']),
          errorCount: num(r['error_count']),
          errorRate: num(r['error_rate']),
          modelCount: num(r['model_count']),
          avgLatencyMs: num(r['avg_latency_ms']),
          provider: str(r['provider']),
          lastSeen: str(r['last_seen']),
        }))
      );

      setProblems(
        probRows.map((r: any) => ({
          problemId: str(r['problem_id']),
          title: str(r['title']),
          severity: str(r['severity']),
          status: str(r['status']),
          startTime: str(r['start_time']),
          durationMin: num(r['duration_min']),
          affectedEntities: str(r['affected_entities']),
        }))
      );

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
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return { providers, workloads, problems, deployments, loading, error, refetch };
}
