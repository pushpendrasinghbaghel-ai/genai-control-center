/**
 * Grafana Integration Hook
 *
 * Uses DQL queries to surface GenAI observability data in Grafana-compatible
 * formats — dashboards, alerts, annotations, and snapshot summaries.
 * All data flows through Dynatrace Grail; no direct Grafana API calls from UI.
 *
 * Architecture:
 * - DQL queries provide the data that MCP server pushes to Grafana
 * - This hook surfaces the current state: dashboards synced, alerts, annotations
 * - Automation workflows handle the actual Grafana API push via HTTP actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type {
  GrafanaConfig,
  GrafanaDashboard,
  GrafanaAlert,
  GrafanaAnnotation,
  GrafanaSnapshot,
} from '../types';

// ============================================
// DQL Queries — Grafana sync state
// ============================================

const GRAFANA_SYNC_EVENTS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | filter matchesPhrase(event.category, "grafana") OR matchesPhrase(dt.automation.action_type, "grafana")
  | summarize {
      total_syncs = count(),
      successful = countIf(event.status == "SUCCESS"),
      failed = countIf(event.status == "ERROR"),
      dashboards_synced = countDistinct(dt.automation.grafana_dashboard),
      last_sync = max(timestamp)
    }
`;

const GENAI_ALERT_CONDITIONS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      total_requests = count(),
      error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
      error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
      avg_latency_ms = avg(duration) / 1000000,
      p95_latency_ms = percentile(duration, 95) / 1000000,
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
    }, by: { gen_ai.provider.name }
  | sort error_rate desc
`;

const GENAI_SNAPSHOT_SUMMARY_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
  | summarize {
      total_requests = count(),
      total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
      error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0,
      avg_latency_ms = avg(duration) / 1000000,
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
      providers = countDistinct(gen_ai.provider.name),
      models = countDistinct(gen_ai.request.model)
    }
`;

const GENAI_ANNOTATION_EVENTS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "CUSTOM_ANNOTATION" OR event.type == "CUSTOM_DEPLOYMENT"
         OR (event.type == "DAVIS_PROBLEM" AND matchesPhrase(affected_entity_types, "SERVICE"))
  | fieldsAdd text = coalesce(event.name, "GenAI event"),
               tags_str = coalesce(event.category, "genai"),
               dashboard_uid = "genai-overview"
  | sort timestamp desc
  | limit 30
`;

// ============================================
// Hook State
// ============================================

interface GrafanaState {
  config: GrafanaConfig;
  dashboards: GrafanaDashboard[];
  alerts: GrafanaAlert[];
  annotations: GrafanaAnnotation[];
  snapshot: GrafanaSnapshot | null;
  syncStatus: { totalSyncs: number; successful: number; failed: number; lastSync: string | null };
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================
// Hook
// ============================================

export function useGrafanaIntegration(timeframe = '24h') {
  const [state, setState] = useState<GrafanaState>({
    config: {
      url: '',
      apiKey: '',
      enabled: true,
      defaultDatasource: 'Dynatrace',
    },
    dashboards: [],
    alerts: [],
    annotations: [],
    snapshot: null,
    syncStatus: { totalSyncs: 0, successful: 0, failed: 0, lastSync: null },
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const [syncRes, alertRes, snapRes, annotRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: GRAFANA_SYNC_EVENTS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_ALERT_CONDITIONS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_SNAPSHOT_SUMMARY_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_ANNOTATION_EVENTS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      if (!mountedRef.current) return;

      // Sync status
      const syncRow = (syncRes.result?.records || [])[0];
      const syncStatus = syncRow ? {
        totalSyncs: Number(syncRow['total_syncs'] || 0),
        successful: Number(syncRow['successful'] || 0),
        failed: Number(syncRow['failed'] || 0),
        lastSync: syncRow['last_sync'] ? String(syncRow['last_sync']) : null,
      } : { totalSyncs: 0, successful: 0, failed: 0, lastSync: null };

      // Build virtual dashboards list (what Grafana would have)
      const dashboards: GrafanaDashboard[] = [
        { uid: 'genai-overview', title: 'GenAI Overview', url: '/d/genai-overview', tags: ['genai', 'ai', 'overview'], folderTitle: 'GenAI Control Center' },
        { uid: 'genai-providers', title: 'Provider Performance', url: '/d/genai-providers', tags: ['genai', 'providers'], folderTitle: 'GenAI Control Center' },
        { uid: 'genai-cost', title: 'Token Cost Tracking', url: '/d/genai-cost', tags: ['genai', 'cost', 'finops'], folderTitle: 'GenAI Control Center' },
        { uid: 'genai-errors', title: 'Error Analysis', url: '/d/genai-errors', tags: ['genai', 'errors'], folderTitle: 'GenAI Control Center' },
        { uid: 'genai-latency', title: 'Latency Distribution', url: '/d/genai-latency', tags: ['genai', 'latency'], folderTitle: 'GenAI Control Center' },
      ];

      // Build alerts from DQL data
      const alerts: GrafanaAlert[] = (alertRes.result?.records || []).map((r: any, idx: number) => {
        const provider = String(r['gen_ai.provider.name'] || 'unknown');
        const errorRate = Number(r['error_rate'] || 0);
        const p95 = Number(r['p95_latency_ms'] || 0);
        const isError = errorRate > 5;
        const isLatency = p95 > 5000;

        return {
          uid: `genai-alert-${idx}`,
          title: isError
            ? `${provider} error rate ${errorRate.toFixed(1)}%`
            : isLatency
            ? `${provider} P95 latency ${Math.round(p95)}ms`
            : `${provider} healthy`,
          state: isError ? 'firing' as const
            : isLatency ? 'pending' as const
            : 'inactive' as const,
          condition: isError ? `error_rate > 5%` : isLatency ? `p95_latency > 5000ms` : 'all_clear',
          labels: { provider, severity: isError ? 'critical' : isLatency ? 'warning' : 'info' },
        };
      });

      // Snapshot from summary
      const snapRow = (snapRes.result?.records || [])[0];
      const snapshot: GrafanaSnapshot | null = snapRow ? {
        name: `GenAI Snapshot — ${new Date().toISOString().split('T')[0]}`,
        url: `/api/snapshots/genai-${Date.now()}`,
        key: `snap-${Date.now()}`,
        expires: Date.now() + 86400000,
        metrics: {
          totalRequests: Number(snapRow['total_requests'] || 0),
          errorRate: Number(snapRow['error_rate'] || 0),
          avgLatencyMs: Number(snapRow['avg_latency_ms'] || 0),
          totalTokens: Number(snapRow['total_tokens'] || 0),
        },
      } : null;

      // Annotations
      const annotations: GrafanaAnnotation[] = (annotRes.result?.records || []).map((r: any, idx: number) => ({
        id: idx + 1,
        text: String(r['text'] || r['event.name'] || 'GenAI event'),
        tags: [String(r['tags_str'] || 'genai')],
        dashboardUid: String(r['dashboard_uid'] || 'genai-overview'),
        time: r['timestamp'] ? new Date(String(r['timestamp'])).getTime() : Date.now(),
      }));

      setState(s => ({
        ...s,
        dashboards,
        alerts,
        annotations,
        snapshot,
        syncStatus,
        loading: false,
        lastRefresh: new Date(),
      }));
    } catch (err) {
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch Grafana data',
        }));
      }
    }
  }, [timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
    firingAlertCount: state.alerts.filter(a => a.state === 'firing').length,
    pendingAlertCount: state.alerts.filter(a => a.state === 'pending').length,
  };
}

export default useGrafanaIntegration;
