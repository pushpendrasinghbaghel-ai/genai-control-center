/**
 * Slack MCP Integration — MCP Server Tool for Slack notifications
 *
 * Exposes Slack capabilities as MCP tools:
 * - slack_send_message: Send a message to a Slack channel via webhook
 * - slack_send_alert: Send a GenAI alert with structured blocks
 * - slack_list_notifications: Query Dynatrace for recent Slack notification history
 * - slack_check_conditions: Evaluate GenAI alert conditions that would trigger Slack
 *
 * All Slack communication happens via real webhook HTTP calls.
 * Notification history is tracked via Dynatrace workflow execution events in Grail.
 */

import { executeDql } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

export interface SlackMCPConfig {
  webhookUrl: string;
  defaultChannel: string;
}

export interface SlackSendResult {
  success: boolean;
  channel: string;
  message: string;
  timestamp: string;
  error?: string;
}

export interface SlackAlertPayload {
  webhookUrl: string;
  channel: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  sourceUrl?: string;
}

// ─── Slack Webhook Sender ─────────────────────────────

async function sendSlackWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────

export interface SlackToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface SlackToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<SlackToolResult>;
}

/**
 * slack_send_message — Send a plain text or block-kit message to Slack
 */
const slackSendMessage: SlackToolDef = {
  name: "slack_send_message",
  description:
    "Send a message to a Slack channel via incoming webhook. Requires webhookUrl and message text.",
  execute: async (params) => {
    const start = Date.now();
    const webhookUrl = params.webhookUrl || params.webhook_url || "";
    const channel = params.channel || "#genai-alerts";
    const message = params.message || "GenAI Control Center notification";
    const username = params.username || "GenAI Control Center";

    if (!webhookUrl) {
      return {
        success: false,
        toolName: "slack_send_message",
        summary: "Missing webhookUrl parameter",
        data: { error: "webhookUrl is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const payload = {
      channel,
      username,
      icon_emoji: ":robot_face:",
      text: message,
    };

    const result = await sendSlackWebhook(webhookUrl, payload);

    return {
      success: result.ok,
      toolName: "slack_send_message",
      summary: result.ok
        ? `Message sent to ${channel}`
        : `Failed to send: ${result.error}`,
      data: {
        channel,
        message,
        delivered: result.ok,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * slack_send_alert — Send a structured GenAI alert to Slack with severity, blocks, and context
 */
const slackSendAlert: SlackToolDef = {
  name: "slack_send_alert",
  description:
    "Send a structured GenAI alert to Slack with severity level, title, message, and optional fields. Uses Slack Block Kit for rich formatting.",
  execute: async (params) => {
    const start = Date.now();
    const webhookUrl = params.webhookUrl || params.webhook_url || "";
    const channel = params.channel || "#genai-alerts";
    const severity = (params.severity || "warning") as "info" | "warning" | "critical";
    const title = params.title || "GenAI Alert";
    const message = params.message || "";

    if (!webhookUrl) {
      return {
        success: false,
        toolName: "slack_send_alert",
        summary: "Missing webhookUrl parameter",
        data: { error: "webhookUrl is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const severityEmoji =
      severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "ℹ️";
    const severityColor =
      severity === "critical" ? "#FF0000" : severity === "warning" ? "#FFB020" : "#2196F3";

    const payload = {
      channel,
      username: "GenAI Control Center",
      icon_emoji: ":robot_face:",
      attachments: [
        {
          color: severityColor,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `${severityEmoji} ${title}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: message,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Severity:* ${severity.toUpperCase()} | *Source:* GenAI Control Center | *Time:* ${new Date().toISOString()}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await sendSlackWebhook(webhookUrl, payload);

    return {
      success: result.ok,
      toolName: "slack_send_alert",
      summary: result.ok
        ? `${severity} alert "${title}" sent to ${channel}`
        : `Failed: ${result.error}`,
      data: {
        channel,
        severity,
        title,
        message,
        delivered: result.ok,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * slack_list_notifications — Query Grail for recent Slack notification workflow executions
 */
const slackListNotifications: SlackToolDef = {
  name: "slack_list_notifications",
  description:
    "List recent Slack notifications sent via Dynatrace workflows. Queries Grail for workflow execution events tagged as Slack.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "24h";

    const dql = `fetch events, from:now()-${timeframe}
| filter event.type == "WORKFLOW_EXECUTION"
| filter matchesPhrase(event.category, "slack") OR matchesPhrase(dt.automation.action_type, "slack") OR matchesPhrase(event.name, "Slack")
| fieldsAdd channel = coalesce(dt.automation.slack_channel, "#genai-alerts"),
             severity = coalesce(dt.automation.severity, "info"),
             status = coalesce(event.status, "UNKNOWN"),
             message = coalesce(dt.automation.message, event.name)
| sort timestamp desc
| limit 50`;

    const records = await executeDql(dql);

    return {
      success: true,
      toolName: "slack_list_notifications",
      summary: `${records.length} Slack notifications found in last ${timeframe}`,
      data: records,
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * slack_check_alert_conditions — Evaluate GenAI metrics to determine which alerts should fire
 */
const slackCheckAlertConditions: SlackToolDef = {
  name: "slack_check_alert_conditions",
  description:
    "Evaluate current GenAI metrics against alert thresholds. Returns providers/models that would trigger Slack alerts based on error rate, latency, and token anomalies.",
  execute: async (params) => {
    const start = Date.now();
    const timeframe = params.timeframe || "15m";
    const errorThreshold = parseFloat(params.error_threshold || "5");
    const latencyThreshold = parseFloat(params.latency_threshold_ms || "3000");

    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| sort error_rate desc`;

    const records = await executeDql(dql);

    const alerts = records
      .map((r: any) => {
        const provider = r["gen_ai.provider.name"] || "unknown";
        const model = r["gen_ai.request.model"] || "unknown";
        const errorRate = Number(r.error_rate || 0);
        const avgLatency = Number(r.avg_latency_ms || 0);
        const triggers: string[] = [];

        if (errorRate > errorThreshold) triggers.push(`error_rate=${errorRate.toFixed(1)}%`);
        if (avgLatency > latencyThreshold) triggers.push(`latency=${avgLatency.toFixed(0)}ms`);

        return {
          provider,
          model,
          errorRate,
          avgLatencyMs: avgLatency,
          totalRequests: Number(r.total_requests || 0),
          shouldAlert: triggers.length > 0,
          triggers,
        };
      })
      .filter((a: any) => a.shouldAlert);

    return {
      success: true,
      toolName: "slack_check_alert_conditions",
      summary: `${alerts.length} alert condition(s) triggered (error>${errorThreshold}%, latency>${latencyThreshold}ms)`,
      data: { alerts, thresholds: { errorThreshold, latencyThreshold }, totalEvaluated: records.length },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * slack_send_genai_report — Query GenAI data and send a summary report to Slack
 */
const slackSendGenAIReport: SlackToolDef = {
  name: "slack_send_genai_report",
  description:
    "Generate a GenAI summary report from DQL and send it to Slack. Combines data gathering with notification in one step.",
  execute: async (params) => {
    const start = Date.now();
    const webhookUrl = params.webhookUrl || params.webhook_url || "";
    const channel = params.channel || "#genai-alerts";
    const timeframe = params.timeframe || "24h";

    if (!webhookUrl) {
      return {
        success: false,
        toolName: "slack_send_genai_report",
        summary: "Missing webhookUrl parameter",
        data: { error: "webhookUrl is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    // Gather GenAI data
    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    total_errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency_ms = avg(duration) / 1000000,
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
    unique_providers = countDistinct(gen_ai.provider.name),
    unique_models = countDistinct(gen_ai.request.model),
    unique_services = countDistinct(dt.entity.service)
  }`;

    const records = await executeDql(dql);
    const r = records[0] || {};
    const totalRequests = Number(r.total_requests || 0);
    const totalErrors = Number(r.total_errors || 0);
    const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : "0.0";
    const avgLatency = Number(r.avg_latency_ms || 0).toFixed(0);
    const totalTokens = Number(r.total_tokens || 0);

    const reportText = [
      `*GenAI Control Center — ${timeframe} Report*`,
      ``,
      `• *Requests:* ${totalRequests.toLocaleString()}`,
      `• *Error Rate:* ${errorRate}% (${totalErrors} errors)`,
      `• *Avg Latency:* ${avgLatency}ms`,
      `• *Tokens:* ${totalTokens.toLocaleString()}`,
      `• *Services:* ${r.unique_services || 0} | *Providers:* ${r.unique_providers || 0} | *Models:* ${r.unique_models || 0}`,
    ].join("\n");

    const severity =
      Number(errorRate) > 10 ? "critical" : Number(errorRate) > 5 ? "warning" : "info";
    const severityEmoji =
      severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "✅";

    const payload = {
      channel,
      username: "GenAI Control Center",
      icon_emoji: ":bar_chart:",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${severityEmoji} GenAI Report (${timeframe})` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: reportText },
        },
        { type: "divider" },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Generated at ${new Date().toISOString()} by GenAI Control Center MCP Server`,
            },
          ],
        },
      ],
    };

    const slackResult = await sendSlackWebhook(webhookUrl, payload);

    return {
      success: slackResult.ok,
      toolName: "slack_send_genai_report",
      summary: slackResult.ok
        ? `Report sent to ${channel}: ${totalRequests} requests, ${errorRate}% errors`
        : `Failed: ${slackResult.error}`,
      data: {
        report: { totalRequests, totalErrors, errorRate, avgLatency, totalTokens },
        slack: { channel, delivered: slackResult.ok, error: slackResult.error },
      },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all Slack MCP tools ───────────────────────

export const SLACK_MCP_TOOLS: SlackToolDef[] = [
  slackSendMessage,
  slackSendAlert,
  slackListNotifications,
  slackCheckAlertConditions,
  slackSendGenAIReport,
];
