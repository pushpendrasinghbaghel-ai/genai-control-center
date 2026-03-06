#!/usr/bin/env node
/**
 * GenAI Control Center — MCP Server
 *
 * Exposes all 30 GCC tools as Model Context Protocol tools.
 * Runs as a stdio-based MCP server for use with Claude Desktop,
 * VS Code Copilot, or any MCP-compatible client.
 *
 * Environment variables:
 *   DT_ENVIRONMENT_URL — Dynatrace environment URL (e.g. https://{id}.apps.dynatrace.com)
 *   DT_API_TOKEN       — Dynatrace API token with read scopes
 *
 * Usage:
 *   DT_ENVIRONMENT_URL=https://xxx.apps.dynatrace.com DT_API_TOKEN=dt0c01.xxx node dist/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TOOL_REGISTRY } from "./tools.js";
import { SLACK_MCP_TOOLS } from "./slack-integration.js";
import { PAGERDUTY_MCP_TOOLS } from "./pagerduty-integration.js";
import { PROMETHEUS_MCP_TOOLS } from "./prometheus-integration.js";
import { AWS_BILLING_MCP_TOOLS } from "./aws-billing-integration.js";
import { AWS_CLOUDWATCH_MCP_TOOLS } from "./aws-cloudwatch-integration.js";
import { GRAFANA_MCP_TOOLS } from "./grafana-integration.js";
import { GITHUB_MCP_TOOLS } from "./github-integration.js";
import { WORKFLOW_MCP_TOOLS } from "./agentic-workflows.js";

// ── Create MCP Server ──────────────────────────────────────

const server = new McpServer({
  name: "gcc-genai-control-center",
  version: "1.0.0",
});

// ── Register all tools ─────────────────────────────────────

for (const tool of TOOL_REGISTRY) {
  server.tool(
    tool.name,
    tool.description,
    {
      timeframe: z
        .string()
        .default("24h")
        .describe(
          "Time window for the query (e.g. 1h, 6h, 24h, 7d, 30d). Defaults to 24h."
        ),
    },
    async ({ timeframe }) => {
      try {
        const result = await tool.execute(timeframe);

        // Format data as readable text + JSON
        const lines: string[] = [];
        lines.push(`## ${tool.name}`);
        lines.push("");
        lines.push(`**Summary:** ${result.summary}`);
        lines.push(`**Execution Time:** ${result.executionTimeMs}ms`);
        if (result.dql) {
          lines.push("");
          lines.push("**DQL Query:**");
          lines.push("```dql");
          lines.push(result.dql);
          lines.push("```");
        }
        lines.push("");
        lines.push("**Data:**");
        lines.push("```json");
        lines.push(JSON.stringify(result.data, null, 2));
        lines.push("```");

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing ${tool.name}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// ── Also expose a "list_tools" resource for discovery ──────

// ── Register Integration MCP Tools ─────────────────────

// Slack tools — require webhookUrl, channel, message, etc.
const slackSchema = {
  webhookUrl: z.string().optional().describe("Slack incoming webhook URL"),
  webhook_url: z.string().optional().describe("Slack incoming webhook URL (alias)"),
  channel: z.string().default("#genai-alerts").describe("Slack channel"),
  message: z.string().optional().describe("Message text"),
  severity: z.enum(["info", "warning", "critical"]).default("warning").describe("Alert severity"),
  title: z.string().optional().describe("Alert title"),
  timeframe: z.string().default("24h").describe("Time window (e.g. 1h, 24h, 7d)"),
  error_threshold: z.string().default("5").describe("Error rate threshold percentage"),
  latency_threshold_ms: z.string().default("3000").describe("Latency threshold in ms"),
  username: z.string().optional().describe("Slack username"),
};

for (const tool of SLACK_MCP_TOOLS) {
  server.tool(tool.name, tool.description, slackSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// PagerDuty tools
const pagerdutySchema = {
  routing_key: z.string().optional().describe("PagerDuty Events API v2 routing/integration key"),
  routingKey: z.string().optional().describe("PagerDuty routing key (alias)"),
  title: z.string().optional().describe("Incident title"),
  description: z.string().optional().describe("Incident description"),
  severity: z.enum(["critical", "error", "warning", "info"]).default("error").describe("Severity"),
  dedup_key: z.string().optional().describe("Deduplication key for incident"),
  dedupKey: z.string().optional().describe("Deduplication key (alias)"),
  source: z.string().default("genai-control-center").describe("Source"),
  component: z.string().default("genai").describe("Component"),
  group: z.string().default("ai-services").describe("Group"),
  timeframe: z.string().default("24h").describe("Time window"),
  critical_error_threshold: z.string().default("10").describe("Critical error rate threshold"),
  outage_threshold: z.string().default("95").describe("Outage success rate threshold"),
  sla_latency_ms: z.string().default("5000").describe("SLA latency threshold in ms"),
};

for (const tool of PAGERDUTY_MCP_TOOLS) {
  server.tool(tool.name, tool.description, pagerdutySchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// Prometheus tools
const prometheusSchema = {
  timeframe: z.string().default("1h").describe("Time window"),
  prefix: z.string().default("genai").describe("Metric name prefix"),
  gateway_url: z.string().optional().describe("Prometheus Pushgateway URL"),
  gatewayUrl: z.string().optional().describe("Pushgateway URL (alias)"),
  job: z.string().default("genai_control_center").describe("Pushgateway job name"),
  metric: z.string().default("requests").describe("Metric name (requests, errors, latency, tokens)"),
  step: z.string().default("1h").describe("Timeseries step interval"),
};

for (const tool of PROMETHEUS_MCP_TOOLS) {
  server.tool(tool.name, tool.description, prometheusSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// AWS Billing tools
const awsBillingSchema = {
  timeframe: z.string().default("30d").describe("Time window (7d, 30d, 90d)"),
  monthly_budget: z.string().default("10000").describe("Monthly budget in USD"),
  budget: z.string().optional().describe("Budget (alias)"),
  warning_pct: z.string().default("80").describe("Warning threshold percentage"),
  critical_pct: z.string().default("95").describe("Critical threshold percentage"),
  forecast_days: z.string().default("30").describe("Number of days to forecast"),
  anomaly_threshold: z.string().default("2.0").describe("Anomaly detection threshold (std deviations)"),
};

for (const tool of AWS_BILLING_MCP_TOOLS) {
  server.tool(tool.name, tool.description, awsBillingSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// AWS CloudWatch tools
const cloudwatchSchema = {
  timeframe: z.string().default("1h").describe("Time window"),
  namespace: z.string().default("AWS/Bedrock").describe("CloudWatch metric namespace"),
  metric_name: z.string().default("Invocations").describe("Metric name"),
  period: z.string().default("300").describe("Period in seconds"),
  state_filter: z.string().optional().describe("Alarm state filter (ALARM, OK, INSUFFICIENT_DATA)"),
  log_group: z.string().optional().describe("CloudWatch Logs group name"),
  query: z.string().optional().describe("Log Insights / datasource query"),
  dashboard_name: z.string().default("GenAI-ControlCenter").describe("Dashboard name"),
};

for (const tool of AWS_CLOUDWATCH_MCP_TOOLS) {
  server.tool(tool.name, tool.description, cloudwatchSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// Grafana tools
const grafanaSchema = {
  grafana_url: z.string().optional().describe("Grafana instance URL"),
  api_key: z.string().optional().describe("Grafana API key"),
  datasource_id: z.string().optional().describe("Datasource UID"),
  datasourceId: z.string().optional().describe("Datasource UID (alias)"),
  query: z.string().optional().describe("PromQL/LogQL query"),
  search: z.string().optional().describe("Dashboard search query"),
  tag: z.string().optional().describe("Dashboard tag filter"),
  uid: z.string().optional().describe("Dashboard UID"),
  dashboard_uid: z.string().optional().describe("Dashboard UID (alias)"),
  text: z.string().optional().describe("Annotation text"),
  message: z.string().optional().describe("Annotation message (alias)"),
  tags: z.string().default("genai,gcc").describe("Comma-separated tags"),
  panel_id: z.string().optional().describe("Panel ID"),
  state: z.string().optional().describe("Alert state filter"),
  name: z.string().optional().describe("Snapshot name"),
  timeframe: z.string().default("1h").describe("Time window"),
  expires_seconds: z.string().default("86400").describe("Snapshot expiry in seconds"),
  from: z.string().default("now-1h").describe("Query range start"),
  to: z.string().default("now").describe("Query range end"),
};

for (const tool of GRAFANA_MCP_TOOLS) {
  server.tool(tool.name, tool.description, grafanaSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// GitHub tools
const githubSchema = {
  owner: z.string().optional().describe("GitHub repository owner/org"),
  org: z.string().optional().describe("GitHub org (alias)"),
  repo: z.string().optional().describe("GitHub repository name"),
  repository: z.string().optional().describe("Repository name (alias)"),
  token: z.string().optional().describe("GitHub personal access token"),
  state: z.string().default("open").describe("Issue/PR state (open, closed, all)"),
  labels: z.string().optional().describe("Comma-separated labels filter"),
  per_page: z.string().default("30").describe("Results per page"),
  title: z.string().optional().describe("Issue title"),
  body: z.string().optional().describe("Issue body"),
  description: z.string().optional().describe("Issue description (alias)"),
  assignees: z.string().optional().describe("Comma-separated assignees"),
  environment: z.string().optional().describe("Deployment environment filter"),
  timeframe: z.string().default("15m").describe("Time window for alert conditions"),
  error_threshold: z.string().default("5").describe("Error rate threshold"),
  latency_threshold_ms: z.string().default("3000").describe("Latency threshold in ms"),
};

for (const tool of GITHUB_MCP_TOOLS) {
  server.tool(tool.name, tool.description, githubSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// Agentic Workflow tools
const workflowSchema = {
  workflow_id: z.string().optional().describe("Workflow ID"),
  workflowId: z.string().optional().describe("Workflow ID (alias)"),
  id: z.string().optional().describe("Workflow/execution ID"),
  execution_id: z.string().optional().describe("Execution ID"),
  executionId: z.string().optional().describe("Execution ID (alias)"),
  template: z.string().optional().describe("Workflow template name"),
  template_name: z.string().optional().describe("Template name (alias)"),
  title: z.string().optional().describe("Custom workflow title"),
  timeframe: z.string().default("24h").describe("Time window"),
  input: z.string().optional().describe("JSON input params for execution"),
  type: z.string().default("error_spike").describe("Remediation type"),
  slack_webhook: z.string().optional().describe("Slack webhook URL for notifications"),
  pagerduty_routing_key: z.string().optional().describe("PagerDuty routing key"),
};

for (const tool of WORKFLOW_MCP_TOOLS) {
  server.tool(tool.name, tool.description, workflowSchema, async (params) => {
    try {
      const strParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) strParams[k] = String(v);
      }
      const result = await tool.execute(strParams);
      return {
        content: [{ type: "text" as const, text: formatIntegrationResult(tool.name, result) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

// ── Helper: format integration tool results ────────────

function formatIntegrationResult(toolName: string, result: any): string {
  const lines: string[] = [];
  lines.push(`## ${toolName}`);
  lines.push("");
  lines.push(`**Summary:** ${result.summary}`);
  lines.push(`**Success:** ${result.success}`);
  lines.push(`**Execution Time:** ${result.executionTimeMs}ms`);
  if (result.dql) {
    lines.push("");
    lines.push("**DQL Query:**");
    lines.push("```dql");
    lines.push(result.dql);
    lines.push("```");
  }
  lines.push("");
  lines.push("**Data:**");
  lines.push("```json");
  lines.push(JSON.stringify(result.data, null, 2));
  lines.push("```");
  return lines.join("\n");
}

// ── Count all registered tools ─────────────────────────

const INTEGRATION_TOOL_COUNT =
  SLACK_MCP_TOOLS.length +
  PAGERDUTY_MCP_TOOLS.length +
  PROMETHEUS_MCP_TOOLS.length +
  AWS_BILLING_MCP_TOOLS.length +
  AWS_CLOUDWATCH_MCP_TOOLS.length +
  GRAFANA_MCP_TOOLS.length +
  GITHUB_MCP_TOOLS.length +
  WORKFLOW_MCP_TOOLS.length;

const TOTAL_TOOLS = TOOL_REGISTRY.length + INTEGRATION_TOOL_COUNT;

// ── Also expose a "list_tools" resource for discovery ──────

server.resource("tool-catalog", "gcc://tools/catalog", async (uri) => {
  const coreCatalog = TOOL_REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
    category: "core",
  }));

  const integrationCatalog = [
    ...SLACK_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "slack" })),
    ...PAGERDUTY_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "pagerduty" })),
    ...PROMETHEUS_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "prometheus" })),
    ...AWS_BILLING_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "aws_billing" })),
    ...AWS_CLOUDWATCH_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "aws_cloudwatch" })),
    ...GRAFANA_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "grafana" })),
    ...GITHUB_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "github" })),
    ...WORKFLOW_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, category: "workflows" })),
  ];

  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ core: coreCatalog, integrations: integrationCatalog, totalTools: TOTAL_TOOLS }, null, 2),
      },
    ],
  };
});

// ── Start the server ───────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[GCC MCP Server] Started with ${TOTAL_TOOLS} tools (${TOOL_REGISTRY.length} core + ${INTEGRATION_TOOL_COUNT} integrations). Waiting for connections...`
  );
}

main().catch((err) => {
  console.error("[GCC MCP Server] Fatal error:", err);
  process.exit(1);
});
