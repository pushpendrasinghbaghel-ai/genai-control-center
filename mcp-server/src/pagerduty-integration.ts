/**
 * PagerDuty MCP Integration — MCP Server Tools for PagerDuty incident management
 *
 * Exposes PagerDuty capabilities as MCP tools:
 * - pagerduty_trigger_incident: Create a new PagerDuty incident via Events API v2
 * - pagerduty_acknowledge_incident: Acknowledge an existing incident
 * - pagerduty_resolve_incident: Resolve an existing incident
 * - pagerduty_list_incidents: Query Dynatrace for PagerDuty incident history
 * - pagerduty_check_conditions: Evaluate GenAI metrics for PagerDuty alerting thresholds
 *
 * All PagerDuty communication happens via real HTTP calls to the Events API v2.
 * Incident history is tracked via Dynatrace workflow execution events in Grail.
 */

import { executeDql } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";

export interface PagerDutyToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface PagerDutyToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<PagerDutyToolResult>;
}

// ─── PagerDuty Events API v2 Sender ──────────────────

async function sendPagerDutyEvent(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  dedupKey?: string;
  status?: string;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch(PAGERDUTY_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    const data = (await response.json()) as {
      status: string;
      message: string;
      dedup_key: string;
    };
    return {
      ok: true,
      dedupKey: data.dedup_key,
      status: data.status,
      message: data.message,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────

/**
 * pagerduty_trigger_incident — Create a new PagerDuty incident via Events API v2
 */
const pagerdutyTriggerIncident: PagerDutyToolDef = {
  name: "pagerduty_trigger_incident",
  description:
    "Trigger a new PagerDuty incident via Events API v2. Requires routing_key, title, and severity.",
  execute: async (params) => {
    const start = Date.now();
    const routingKey = params.routing_key || params.routingKey || "";
    const title = params.title || "GenAI Control Center Alert";
    const severity = (params.severity || "error") as "critical" | "error" | "warning" | "info";
    const description = params.description || params.message || "";
    const source = params.source || "genai-control-center";
    const component = params.component || "genai";
    const group = params.group || "ai-services";
    const dedupKey = params.dedup_key || params.dedupKey || `gcc-${Date.now()}`;

    if (!routingKey) {
      return {
        success: false,
        toolName: "pagerduty_trigger_incident",
        summary: "Missing routing_key parameter",
        data: { error: "routing_key (PagerDuty integration key) is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const payload = {
      routing_key: routingKey,
      event_action: "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: title,
        source,
        severity,
        component,
        group,
        class: "genai",
        custom_details: {
          description,
          triggered_by: "GenAI Control Center MCP Server",
          timestamp: new Date().toISOString(),
          environment: process.env.DT_ENVIRONMENT_URL || "unknown",
        },
      },
      links: [
        {
          href: `${process.env.DT_ENVIRONMENT_URL || "https://demo.apps.dynatrace.com"}/ui/apps/genai-control-center`,
          text: "GenAI Control Center",
        },
      ],
    };

    const result = await sendPagerDutyEvent(payload);

    return {
      success: result.ok,
      toolName: "pagerduty_trigger_incident",
      summary: result.ok
        ? `Incident triggered: "${title}" (dedup: ${result.dedupKey})`
        : `Failed to trigger: ${result.error}`,
      data: {
        title,
        severity,
        dedupKey: result.dedupKey || dedupKey,
        status: result.status,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * pagerduty_acknowledge_incident — Acknowledge an existing PagerDuty incident
 */
const pagerdutyAcknowledgeIncident: PagerDutyToolDef = {
  name: "pagerduty_acknowledge_incident",
  description:
    "Acknowledge an existing PagerDuty incident. Requires routing_key and dedup_key of the incident.",
  execute: async (params) => {
    const start = Date.now();
    const routingKey = params.routing_key || params.routingKey || "";
    const dedupKey = params.dedup_key || params.dedupKey || "";

    if (!routingKey || !dedupKey) {
      return {
        success: false,
        toolName: "pagerduty_acknowledge_incident",
        summary: "Missing routing_key or dedup_key",
        data: { error: "Both routing_key and dedup_key are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const payload = {
      routing_key: routingKey,
      event_action: "acknowledge",
      dedup_key: dedupKey,
    };

    const result = await sendPagerDutyEvent(payload);

    return {
      success: result.ok,
      toolName: "pagerduty_acknowledge_incident",
      summary: result.ok
        ? `Incident acknowledged (dedup: ${dedupKey})`
        : `Failed: ${result.error}`,
      data: {
        dedupKey,
        acknowledged: result.ok,
        status: result.status,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * pagerduty_resolve_incident — Resolve an existing PagerDuty incident
 */
const pagerdutyResolveIncident: PagerDutyToolDef = {
  name: "pagerduty_resolve_incident",
  description:
    "Resolve an existing PagerDuty incident. Requires routing_key and dedup_key of the incident.",
  execute: async (params) => {
    const start = Date.now();
    const routingKey = params.routing_key || params.routingKey || "";
    const dedupKey = params.dedup_key || params.dedupKey || "";

    if (!routingKey || !dedupKey) {
      return {
        success: false,
        toolName: "pagerduty_resolve_incident",
        summary: "Missing routing_key or dedup_key",
        data: { error: "Both routing_key and dedup_key are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const payload = {
      routing_key: routingKey,
      event_action: "resolve",
      dedup_key: dedupKey,
    };

    const result = await sendPagerDutyEvent(payload);

    return {
      success: result.ok,
      toolName: "pagerduty_resolve_incident",
      summary: result.ok
        ? `Incident resolved (dedup: ${dedupKey})`
        : `Failed: ${result.error}`,
      data: {
        dedupKey,
        resolved: result.ok,
        status: result.status,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * pagerduty_list_incidents — Query Grail for PagerDuty incident events
 */
const pagerdutyListIncidents: PagerDutyToolDef = {
  name: "pagerduty_list_incidents",
  description:
    "List recent PagerDuty incidents created from Dynatrace workflows. Queries Grail for workflow execution events tagged as PagerDuty.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "24h";

    const dql = `fetch events, from:now()-${timeframe}
| filter event.type == "WORKFLOW_EXECUTION"
| filter matchesPhrase(event.category, "pagerduty") OR matchesPhrase(dt.automation.action_type, "pagerduty") OR matchesPhrase(event.name, "PagerDuty")
| fieldsAdd severity = coalesce(dt.automation.severity, "error"),
             status = coalesce(event.status, "UNKNOWN"),
             title = coalesce(dt.automation.incident_title, event.name),
             dedup_key = coalesce(dt.automation.dedup_key, "unknown"),
             service = coalesce(dt.automation.pd_service, "default")
| sort timestamp desc
| limit 50`;

    const records = await executeDql(dql);

    return {
      success: true,
      toolName: "pagerduty_list_incidents",
      summary: `${records.length} PagerDuty incidents found in last ${timeframe}`,
      data: records,
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * pagerduty_check_conditions — Evaluate GenAI metrics for PagerDuty incident thresholds
 */
const pagerdutyCheckConditions: PagerDutyToolDef = {
  name: "pagerduty_check_conditions",
  description:
    "Evaluate current GenAI metrics to determine which conditions would trigger PagerDuty incidents. Checks for critical error rates, provider outages, and SLA violations.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "15m";
    const criticalErrorThreshold = parseFloat(params.critical_error_threshold || "10");
    const outageThreshold = parseFloat(params.outage_threshold || "95");
    const slaLatencyMs = parseFloat(params.sla_latency_ms || "5000");

    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    success_rate = toDouble(countIf(span.status_code != "error" AND NOT isNotNull(error.type))) / toDouble(count()) * 100.0
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort error_rate desc`;

    const records = await executeDql(dql);

    const incidents = records
      .map((r: any) => {
        const provider = r["gen_ai.provider.name"] || "unknown";
        const model = r["gen_ai.request.model"] || "unknown";
        const errorRate = Number(r.error_rate || 0);
        const avgLatency = Number(r.avg_latency_ms || 0);
        const p99Latency = Number(r.p99_latency_ms || 0);
        const successRate = Number(r.success_rate || 100);
        const triggers: string[] = [];
        let severity: "critical" | "error" | "warning" | "info" = "info";

        if (errorRate > criticalErrorThreshold) {
          triggers.push(`critical_error_rate=${errorRate.toFixed(1)}%`);
          severity = "critical";
        }
        if (successRate < (100 - outageThreshold)) {
          triggers.push(`provider_outage: success=${successRate.toFixed(1)}%`);
          severity = "critical";
        }
        if (p99Latency > slaLatencyMs) {
          triggers.push(`sla_violation: p99=${p99Latency.toFixed(0)}ms > ${slaLatencyMs}ms`);
          if (severity !== "critical") severity = "error";
        }

        return {
          provider,
          model,
          errorRate,
          avgLatencyMs: avgLatency,
          p99LatencyMs: p99Latency,
          successRate,
          shouldPage: triggers.length > 0,
          suggestedSeverity: severity,
          triggers,
        };
      })
      .filter((a: any) => a.shouldPage);

    return {
      success: true,
      toolName: "pagerduty_check_conditions",
      summary: `${incidents.length} PagerDuty-worthy condition(s) found (error>${criticalErrorThreshold}%, p99>${slaLatencyMs}ms)`,
      data: {
        incidents,
        thresholds: { criticalErrorThreshold, outageThreshold, slaLatencyMs },
        totalEvaluated: records.length,
      },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all PagerDuty MCP tools ──────────────────

export const PAGERDUTY_MCP_TOOLS: PagerDutyToolDef[] = [
  pagerdutyTriggerIncident,
  pagerdutyAcknowledgeIncident,
  pagerdutyResolveIncident,
  pagerdutyListIncidents,
  pagerdutyCheckConditions,
];
