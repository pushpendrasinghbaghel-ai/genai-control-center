// Custom hooks for DQL queries in GenAI Control Center

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { AIService } from '../types';
import { 
  AI_SERVICES_DISCOVERY_QUERY,
  PROVIDER_COMPARISON_QUERY,
  MODEL_COMPARISON_QUERY,
  HIGH_LATENCY_QUERY,
  SERVICE_DETAIL_QUERY,
  DISTINCT_SERVICES_QUERY,
  DISTINCT_ALL_SERVICES_QUERY,
  DISTINCT_PROVIDERS_QUERY,
  DISTINCT_MODELS_QUERY,
  QueryFilters
} from '../queries/dql-queries';
import { estimateCost, calculateHealthStatus } from '../utils';

export type { QueryFilters } from '../queries/dql-queries';

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Generic DQL query hook with dynamic query support
 */
export function useDQLQuery<T>(
  query: string,
  transform?: (records: unknown[]) => T
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing DQL query:', query);
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
      
      const records = response.result?.records || [];
      console.log('[GCC] Query returned', records.length, 'records');
      const transformedData = transform ? transform(records) : (records as T);
      setData(transformedData);
    } catch (err) {
      console.error('[GCC] Query failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setLoading(false);
    }
  }, [query, transform]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch: executeQuery };
}

/**
 * Hook for AI Services Discovery (Pillar A) - with filter support
 */
export function useAIServicesDiscovery(filters?: QueryFilters): UseQueryResult<AIService[]> {
  const query = useMemo(() => AI_SERVICES_DISCOVERY_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): AIService[] => {
    return records.map((record: any) => {
      const latencyMs = Number(record.latency || 0) / 1_000_000; // Convert ns to ms
      const errorRate = Number(record.error_rate || 0);
      const tokens = Number(record.tokens || 0);
      const promptTokens = Number(record.prompt_tokens || tokens * 0.3);
      const completionTokens = Number(record.completion_tokens || tokens * 0.7);
      
      return {
        serviceName: record['service.name'] || 'Unknown',
        modelName: record['gen_ai.model_name'] || 'Unknown',
        provider: record['gen_ai.system'] || 'Unknown',
        totalTokens: tokens,
        avgLatency: latencyMs,
        errorRate: errorRate,
        requestCount: Number(record.request_count || 0),
        estimatedCost: estimateCost(
          record['gen_ai.system'] || 'default',
          promptTokens,
          completionTokens
        ),
        lastSeen: new Date().toISOString(),
        healthStatus: calculateHealthStatus(errorRate, latencyMs),
        entityId: record.entity_id || undefined
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Provider Comparison (Unified Governance) - with filter support
 */
export function useProviderComparison(filters?: QueryFilters) {
  const query = useMemo(() => PROVIDER_COMPARISON_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      provider: record['gen_ai.system'] || 'Unknown',
      models: record.models || [],
      totalRequests: record.total_requests || 0,
      avgLatency: (record.avg_latency || 0) / 1_000_000,
      errorRate: record.error_rate || 0,
      totalTokens: record.total_tokens || 0,
      successRate: record.success_rate || 0,
      estimatedCost: estimateCost(
        record['gen_ai.system'] || 'default',
        record.total_tokens * 0.3,
        record.total_tokens * 0.7
      )
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Model Comparison - with filter support
 */
export function useModelComparison(filters?: QueryFilters) {
  const query = useMemo(() => MODEL_COMPARISON_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      modelName: record['gen_ai.model_name'] || 'Unknown',
      provider: record['gen_ai.system'] || 'Unknown',
      avgLatency: (record.avg_latency || 0) / 1_000_000,
      avgTokensPerRequest: record.avg_tokens || 0,
      errorRate: record.error_rate || 0,
      requestCount: record.request_count || 0
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for High Latency Services - with filter support
 */
export function useHighLatencyServices(filters?: QueryFilters) {
  const query = useMemo(() => HIGH_LATENCY_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      serviceName: record['service.name'] || 'Unknown',
      modelName: record['gen_ai.model_name'] || 'Unknown',
      slowRequests: record.slow_requests || 0,
      avgDuration: (record.avg_duration || 0) / 1_000_000,
      maxDuration: (record.max_duration || 0) / 1_000_000
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Service Detail - with filter support
 */
export function useServiceDetail(serviceName: string, filters?: QueryFilters) {
  const query = useMemo(() => SERVICE_DETAIL_QUERY(serviceName, filters), [serviceName, filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      modelName: record['gen_ai.model_name'] || 'Unknown',
      tokens: record.tokens || 0,
      promptTokens: record.prompt_tokens || 0,
      completionTokens: record.completion_tokens || 0,
      avgLatency: (record.latency || 0) / 1_000_000,
      p50Latency: (record.p50_latency || 0) / 1_000_000,
      p95Latency: (record.p95_latency || 0) / 1_000_000,
      p99Latency: (record.p99_latency || 0) / 1_000_000,
      errorRate: record.error_rate || 0,
      requestCount: record.request_count || 0
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook to get distinct service names for filter dropdown
 * First tries GenAI services, then falls back to all services
 */
export function useDistinctServices(filters?: QueryFilters) {
  const [data, setData] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const genAiQuery = useMemo(() => DISTINCT_SERVICES_QUERY(filters), [filters]);
  const allServicesQuery = useMemo(() => DISTINCT_ALL_SERVICES_QUERY(filters), [filters]);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First try GenAI services
      console.log('[GCC] Fetching GenAI services with query:', genAiQuery);
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: genAiQuery,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
      
      let records = response.result?.records || [];
      console.log('[GCC] GenAI services query returned', records.length, 'records:', records);
      
      // If no GenAI services found, try all services as fallback
      if (records.length === 0) {
        console.log('[GCC] No GenAI services, falling back to all services with query:', allServicesQuery);
        const fallbackResponse = await queryExecutionClient.queryExecute({
          body: {
            query: allServicesQuery,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        });
        records = fallbackResponse.result?.records || [];
        console.log('[GCC] All services query returned', records.length, 'records:', records);
      }
      
      const services = records.map((record: any) => record['service.name']).filter(Boolean);
      console.log('[GCC] Parsed service names:', services);
      setData(services);
    } catch (err) {
      console.error('[GCC] Distinct services query failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setLoading(false);
    }
  }, [genAiQuery, allServicesQuery]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch: executeQuery };
}

/**
 * Hook to get distinct providers for filter dropdown
 */
export function useDistinctProviders(filters?: QueryFilters) {
  const query = useMemo(() => DISTINCT_PROVIDERS_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): string[] => {
    return records.map((record: any) => record['gen_ai.system']).filter(Boolean);
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook to get distinct models for filter dropdown
 */
export function useDistinctModels(filters?: QueryFilters) {
  const query = useMemo(() => DISTINCT_MODELS_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): string[] => {
    return records.map((record: any) => record['gen_ai.model_name']).filter(Boolean);
  }, []);

  return useDQLQuery(query, transform);
}
