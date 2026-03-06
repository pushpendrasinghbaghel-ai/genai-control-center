/**
 * Grafana MCP Integration — MCP Server Tools for Grafana dashboard & alerting
 *
 * Exposes Grafana capabilities as MCP tools:
 * - grafana_query_datasource: Query a Grafana datasource (Prometheus, Loki, etc.)
 * - grafana_list_dashboards: List Grafana dashboards
 * - grafana_get_dashboard: Retrieve a specific Grafana dashboard by UID
 * - grafana_create_annotation: Create an annotation on a Grafana dashboard
 * - grafana_list_alerts: List active Grafana alerting rules
 * - grafana_push_genai_snapshot: Push a GenAI snapshot panel to Grafana
 *
 * Uses the Grafana HTTP API with API key authentication.
 * Falls back to Dynatrace data when Grafana is unavailable.
 */

import { executeDql, fmt } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

export interface GrafanaToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface GrafanaToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<GrafanaToolResult>;
}

// ─── Grafana API Caller ───────────────────────────────

async function callGrafanaAPI(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  grafanaUrl?: string,
  apiKey?: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const baseUrl = (grafanaUrl || process.env.GRAFANA_URL || "").replace(/\/+$/, "");
  const token = apiKey || process.env.GRAFANA_API_KEY || "";

  if (!baseUrl || !token) {
    return { ok: false, error: "GRAFANA_URL and GRAFANA_API_KEY environment variables are required" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 300)}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────

/**
 * grafana_query_datasource — Query a Grafana datasource
 */
const grafanaQueryDatasource: GrafanaToolDef = {
  name: "grafana_query_datasource",
  description:
    "Query a Grafana datasource (Prometheus, Loki, etc.) for GenAI metrics. Supports PromQL, LogQL, or other query languages depending on datasource.",
  execute: async (params) => {
    const start = Date.now();
    const datasourceId = params.datasource_id || params.datasourceId || "1";
    const query = params.query || 'rate(genai_requests_total[5m])';
    const from = params.from || "now-1h";
    const to = params.to || "now";

    const grafanaResult = await callGrafanaAPI(
      "/api/ds/query",
      "POST",
      {
        queries: [
          {
            refId: "A",
            datasource: { uid: datasourceId },
            expr: query,
            range: true,
            intervalMs: 60000,
            maxDataPoints: 500,
          },
        ],
        from,
        to,
      },
      params.grafana_url,
      params.api_key
    );

    if (grafanaResult.ok) {
      const frames = grafanaResult.data?.results?.A?.frames || [];
      return {
        success: true,
        toolName: "grafana_query_datasource",
        summary: `Query returned ${frames.length} data frame(s)`,
        data: {
          datasourceId,
          query,
          frames,
          source: "grafana",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    // Fallback to Dynatrace
    const dql = `fetch spans, from:now()-1h
| filter isNotNull(gen_ai.provider.name)
| makeTimeseries requests = count(), interval:5m, by: { gen_ai.provider.name }`;

    const records = await executeDql(dql);

    return {
      success: true,
      toolName: "grafana_query_datasource",
      summary: `${records.length} timeseries from Dynatrace (Grafana unavailable)`,
      data: { timeseries: records, source: "dynatrace", note: grafanaResult.error },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * grafana_list_dashboards — List Grafana dashboards
 */
const grafanaListDashboards: GrafanaToolDef = {
  name: "grafana_list_dashboards",
  description:
    "List all Grafana dashboards, optionally filtered by query or tag. Useful for discovering GenAI-related dashboards.",
  execute: async (params) => {
    const start = Date.now();
    const searchQuery = params.query || params.search || "";
    const tag = params.tag || "";

    let path = "/api/search?type=dash-db";
    if (searchQuery) path += `&query=${encodeURIComponent(searchQuery)}`;
    if (tag) path += `&tag=${encodeURIComponent(tag)}`;

    const result = await callGrafanaAPI(path, "GET", undefined, params.grafana_url, params.api_key);

    if (result.ok) {
      const dashboards = (result.data || []).map((d: any) => ({
        uid: d.uid,
        title: d.title,
        url: d.url,
        tags: d.tags,
        type: d.type,
        folderTitle: d.folderTitle,
      }));

      return {
        success: true,
        toolName: "grafana_list_dashboards",
        summary: `Found ${dashboards.length} dashboard(s)${searchQuery ? ` matching "${searchQuery}"` : ""}`,
        data: { dashboards, source: "grafana" },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "grafana_list_dashboards",
      summary: `Failed to list dashboards: ${result.error}`,
      data: { error: result.error },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * grafana_get_dashboard — Retrieve a specific Grafana dashboard by UID
 */
const grafanaGetDashboard: GrafanaToolDef = {
  name: "grafana_get_dashboard",
  description:
    "Retrieve a specific Grafana dashboard by UID. Returns the full dashboard model including panels, variables, and annotations.",
  execute: async (params) => {
    const start = Date.now();
    const uid = params.uid || params.dashboard_uid || "";

    if (!uid) {
      return {
        success: false,
        toolName: "grafana_get_dashboard",
        summary: "Missing uid parameter",
        data: { error: "Dashboard UID is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const result = await callGrafanaAPI(
      `/api/dashboards/uid/${encodeURIComponent(uid)}`,
      "GET",
      undefined,
      params.grafana_url,
      params.api_key
    );

    if (result.ok) {
      const dashboard = result.data?.dashboard || {};
      const panels = (dashboard.panels || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        datasource: p.datasource,
      }));

      return {
        success: true,
        toolName: "grafana_get_dashboard",
        summary: `Dashboard "${dashboard.title || uid}" with ${panels.length} panels`,
        data: {
          uid,
          title: dashboard.title,
          panels,
          tags: dashboard.tags,
          version: dashboard.version,
          source: "grafana",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "grafana_get_dashboard",
      summary: `Failed to get dashboard: ${result.error}`,
      data: { error: result.error, uid },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * grafana_create_annotation — Create an annotation on a Grafana dashboard
 */
const grafanaCreateAnnotation: GrafanaToolDef = {
  name: "grafana_create_annotation",
  description:
    "Create an annotation on a Grafana dashboard. Useful for marking GenAI events like deployments, incidents, or configuration changes.",
  execute: async (params) => {
    const start = Date.now();
    const text = params.text || params.message || "GenAI Control Center Event";
    const tags = (params.tags || "genai,gcc").split(",").map((t) => t.trim());
    const dashboardUid = params.dashboard_uid || "";
    const panelId = params.panel_id ? parseInt(params.panel_id) : undefined;
    const time = params.time ? parseInt(params.time) : Date.now();
    const timeEnd = params.time_end ? parseInt(params.time_end) : undefined;

    const body: Record<string, unknown> = {
      text,
      tags,
      time,
    };
    if (dashboardUid) body.dashboardUID = dashboardUid;
    if (panelId) body.panelId = panelId;
    if (timeEnd) body.timeEnd = timeEnd;

    const result = await callGrafanaAPI(
      "/api/annotations",
      "POST",
      body,
      params.grafana_url,
      params.api_key
    );

    return {
      success: result.ok,
      toolName: "grafana_create_annotation",
      summary: result.ok
        ? `Annotation created: "${text}" [${tags.join(", ")}]`
        : `Failed: ${result.error}`,
      data: {
        text,
        tags,
        dashboardUid,
        created: result.ok,
        annotationId: result.data?.id,
        error: result.error,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * grafana_list_alerts — List active Grafana alerting rules
 */
const grafanaListAlerts: GrafanaToolDef = {
  name: "grafana_list_alerts",
  description:
    "List active Grafana alerting rules and their current state. Shows firing, pending, and inactive alerts for GenAI monitoring.",
  execute: async (params) => {
    const start = Date.now();
    const state = params.state || ""; // firing, pending, inactive

    let path = "/api/v1/provisioning/alert-rules";
    const result = await callGrafanaAPI(path, "GET", undefined, params.grafana_url, params.api_key);

    if (result.ok) {
      let alerts = (result.data || []).map((a: any) => ({
        uid: a.uid,
        title: a.title,
        condition: a.condition,
        folderUID: a.folderUID,
        ruleGroup: a.ruleGroup,
        noDataState: a.noDataState,
        execErrState: a.execErrState,
        labels: a.labels,
        annotations: a.annotations,
      }));

      return {
        success: true,
        toolName: "grafana_list_alerts",
        summary: `${alerts.length} alerting rule(s) found`,
        data: { alerts, source: "grafana" },
        executionTimeMs: Date.now() - start,
      };
    }

    // Fallback: Dynatrace-based alerting equivalent
    const dql = `fetch spans, from:now()-15m
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    total = count()
  }, by: { gen_ai.provider.name }
| filter error_rate > 5 OR avg_latency_ms > 3000`;

    const records = await executeDql(dql);
    const alerts = records.map((r: any) => ({
      provider: r["gen_ai.provider.name"],
      errorRate: Number(r.error_rate || 0),
      avgLatencyMs: Number(r.avg_latency_ms || 0),
      requests: Number(r.total || 0),
      state: Number(r.error_rate || 0) > 10 ? "firing" : "pending",
    }));

    return {
      success: true,
      toolName: "grafana_list_alerts",
      summary: `${alerts.length} alert condition(s) from Dynatrace`,
      data: { alerts, source: "dynatrace", note: result.error },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * grafana_push_genai_snapshot — Push GenAI data as a Grafana snapshot
 */
const grafanaPushSnapshot: GrafanaToolDef = {
  name: "grafana_push_genai_snapshot",
  description:
    "Generate a GenAI dashboard snapshot from Dynatrace data and push it to Grafana. Creates a shareable point-in-time view of GenAI health.",
  execute: async (params) => {
    const start = Date.now();
    const snapshotName = params.name || `GenAI Snapshot ${new Date().toISOString().slice(0, 16)}`;
    const timeframe = params.timeframe || "1h";
    const expires = parseInt(params.expires_seconds || "86400"); // 24h default

    // Gather metrics from Dynatrace
    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    total_errors = countIf(span.status_code == "error"),
    error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    providers = countDistinct(gen_ai.provider.name),
    models = countDistinct(gen_ai.request.model)
  }`;

    const records = await executeDql(dql);
    const r = records[0] || {};

    const snapshotDashboard = {
      dashboard: {
        title: snapshotName,
        time: { from: `now-${timeframe}`, to: "now" },
        panels: [
          {
            id: 1, type: "stat", title: "Total Requests",
            fieldConfig: { defaults: { thresholds: { steps: [{ value: 0, color: "green" }] } } },
            targets: [{ refId: "A" }],
            snapshotData: [{ fields: [{ name: "value", values: [Number(r.total_requests || 0)] }] }],
          },
          {
            id: 2, type: "gauge", title: "Error Rate %",
            fieldConfig: { defaults: { max: 100, thresholds: { steps: [{ value: 0, color: "green" }, { value: 5, color: "yellow" }, { value: 10, color: "red" }] } } },
            targets: [{ refId: "A" }],
            snapshotData: [{ fields: [{ name: "value", values: [Number(r.error_rate || 0)] }] }],
          },
          {
            id: 3, type: "stat", title: "Avg Latency (ms)",
            targets: [{ refId: "A" }],
            snapshotData: [{ fields: [{ name: "value", values: [Number(r.avg_latency_ms || 0)] }] }],
          },
          {
            id: 4, type: "stat", title: "Total Tokens",
            targets: [{ refId: "A" }],
            snapshotData: [{ fields: [{ name: "value", values: [Number(r.total_tokens || 0)] }] }],
          },
        ],
      },
      expires,
      name: snapshotName,
    };

    const result = await callGrafanaAPI(
      "/api/snapshots",
      "POST",
      snapshotDashboard,
      params.grafana_url,
      params.api_key
    );

    return {
      success: result.ok || true,
      toolName: "grafana_push_genai_snapshot",
      summary: result.ok
        ? `Snapshot "${snapshotName}" created: ${result.data?.url || "available"}`
        : `Snapshot data gathered (push ${result.error ? "failed" : "skipped"})`,
      data: {
        snapshot: {
          name: snapshotName,
          url: result.data?.url,
          key: result.data?.key,
          deleteKey: result.data?.deleteKey,
          expires,
        },
        metrics: {
          totalRequests: Number(r.total_requests || 0),
          errorRate: Number(r.error_rate || 0),
          avgLatencyMs: Number(r.avg_latency_ms || 0),
          totalTokens: Number(r.total_tokens || 0),
          providers: Number(r.providers || 0),
          models: Number(r.models || 0),
        },
        pushed: result.ok,
        error: result.error,
      },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all Grafana MCP tools ─────────────────────

export const GRAFANA_MCP_TOOLS: GrafanaToolDef[] = [
  grafanaQueryDatasource,
  grafanaListDashboards,
  grafanaGetDashboard,
  grafanaCreateAnnotation,
  grafanaListAlerts,
  grafanaPushSnapshot,
];
