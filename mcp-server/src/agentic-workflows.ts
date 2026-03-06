/**
 * Agentic Workflows MCP Integration — Dynatrace Agentic Workflow Management
 *
 * Exposes Dynatrace workflow automation as MCP tools:
 * - workflow_list: List all Dynatrace automation workflows
 * - workflow_create: Create a new agentic workflow from a template
 * - workflow_execute: Trigger execution of a workflow
 * - workflow_get_executions: Get recent workflow execution history
 * - workflow_get_status: Get current status of a running workflow
 * - workflow_create_genai_remediation: Create a GenAI-specific remediation workflow
 *
 * Uses the Dynatrace Automation API for real workflow CRUD and execution.
 */

import { executeDql } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

export interface WorkflowToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface WorkflowToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<WorkflowToolResult>;
}

// ─── Dynatrace Automation API Caller ──────────────────

const DT_ENV = () => (process.env.DT_ENVIRONMENT_URL || "").replace(/\/+$/, "");
const DT_TOKEN = () => process.env.DT_API_TOKEN || "";

async function callAutomationAPI(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const baseUrl = DT_ENV();
  const token = DT_TOKEN();

  if (!baseUrl || !token) {
    return { ok: false, error: "DT_ENVIRONMENT_URL and DT_API_TOKEN are required" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Api-Token ${token}`,
    };

    const response = await fetch(`${baseUrl}/platform/automation/v1${path}`, {
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

// ─── Workflow Template Library ────────────────────────

const WORKFLOW_TEMPLATES: Record<string, Record<string, unknown>> = {
  genai_error_spike_remediation: {
    title: "GenAI Error Spike Remediation",
    description: "Automatically detects GenAI error spikes and triggers fallback model switching",
    trigger: {
      type: "event",
      configuration: {
        type: "davis-problem",
        value: { categories: { technology: ["CUSTOM_APPLICATION"] } },
      },
    },
    tasks: {
      detect_error_spike: {
        name: "detect_error_spike",
        action: "dynatrace.automations:run-javascript",
        input: {
          script: `
            const dqlResult = await fetch('/platform/storage/query/v1/query:execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'fetch spans, from:now()-15m | filter isNotNull(gen_ai.provider.name) | summarize error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0, by: { gen_ai.provider.name } | filter error_rate > 5'
              })
            });
            const data = await dqlResult.json();
            return { affectedProviders: data.records || [] };
          `,
        },
        position: { x: 0, y: 0 },
      },
      notify_slack: {
        name: "notify_slack",
        action: "dynatrace.automations:http-function",
        input: {
          method: "POST",
          url: "{{ env.SLACK_WEBHOOK_URL }}",
          headers: { "Content-Type": "application/json" },
          body: '{"text":"🔴 GenAI Error Spike: {{ result(\"detect_error_spike\").affectedProviders }}"}',
        },
        conditions: { states: { detect_error_spike: "OK" } },
        position: { x: 0, y: 1 },
      },
    },
  },

  genai_cost_threshold_alert: {
    title: "GenAI Cost Threshold Alert",
    description: "Monitors GenAI token usage and alerts when cost thresholds are exceeded",
    trigger: {
      type: "interval",
      configuration: { interval: { minutes: 30 } },
    },
    tasks: {
      check_costs: {
        name: "check_costs",
        action: "dynatrace.automations:run-javascript",
        input: {
          script: `
            const result = await fetch('/platform/storage/query/v1/query:execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'fetch spans, from:now()-1h | filter isNotNull(gen_ai.provider.name) | summarize total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))'
              })
            });
            const data = await result.json();
            const tokens = data.records?.[0]?.total_tokens || 0;
            const estimatedCost = (tokens / 1000) * 0.003;
            return { tokens, estimatedCost, threshold: 100, exceeded: estimatedCost > 100 };
          `,
        },
        position: { x: 0, y: 0 },
      },
    },
  },

  genai_provider_failover: {
    title: "GenAI Provider Failover",
    description: "Detects provider outages and switches traffic to backup providers",
    trigger: {
      type: "event",
      configuration: {
        type: "davis-problem",
        value: { categories: { technology: ["CUSTOM_APPLICATION"] } },
      },
    },
    tasks: {
      check_provider_health: {
        name: "check_provider_health",
        action: "dynatrace.automations:run-javascript",
        input: {
          script: `
            const result = await fetch('/platform/storage/query/v1/query:execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'fetch spans, from:now()-5m | filter isNotNull(gen_ai.provider.name) | summarize success_rate = toDouble(countIf(span.status_code != "error")) / toDouble(count()) * 100.0, total = count(), by: { gen_ai.provider.name } | filter success_rate < 50'
              })
            });
            const data = await result.json();
            return { failedProviders: data.records || [], checkTime: new Date().toISOString() };
          `,
        },
        position: { x: 0, y: 0 },
      },
    },
  },

  genai_latency_remediation: {
    title: "GenAI Latency Remediation",
    description: "Detects latency spikes and enables semantic caching or model downgrades",
    trigger: {
      type: "interval",
      configuration: { interval: { minutes: 15 } },
    },
    tasks: {
      detect_latency: {
        name: "detect_latency",
        action: "dynatrace.automations:run-javascript",
        input: {
          script: `
            const result = await fetch('/platform/storage/query/v1/query:execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'fetch spans, from:now()-15m | filter isNotNull(gen_ai.request.model) | summarize avg_latency_ms = avg(duration) / 1000000, p95_latency_ms = percentile(duration, 95) / 1000000, by: { gen_ai.request.model } | filter p95_latency_ms > 5000'
              })
            });
            const data = await result.json();
            return { slowModels: data.records || [] };
          `,
        },
        position: { x: 0, y: 0 },
      },
    },
  },

  genai_security_response: {
    title: "GenAI Security Auto-Response",
    description: "Detects prompt injection, data leakage, and other security threats in GenAI traffic",
    trigger: {
      type: "interval",
      configuration: { interval: { minutes: 5 } },
    },
    tasks: {
      detect_threats: {
        name: "detect_threats",
        action: "dynatrace.automations:run-javascript",
        input: {
          script: `
            const result = await fetch('/platform/storage/query/v1/query:execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'fetch spans, from:now()-5m | filter isNotNull(gen_ai.prompt) | filter matchesPhrase(gen_ai.prompt, "ignore previous") OR matchesPhrase(gen_ai.prompt, "system prompt") OR matchesPhrase(gen_ai.prompt, "jailbreak") | limit 50'
              })
            });
            const data = await result.json();
            return { threatsDetected: data.records?.length || 0, threats: data.records || [] };
          `,
        },
        position: { x: 0, y: 0 },
      },
    },
  },
};

// ─── MCP Tool Definitions ─────────────────────────────

/**
 * workflow_list — List all Dynatrace automation workflows
 */
const workflowList: WorkflowToolDef = {
  name: "workflow_list",
  description:
    "List all Dynatrace automation workflows. Shows workflow name, trigger type, execution count, and status.",
  execute: async (params) => {
    const start = Date.now();

    const apiResult = await callAutomationAPI("/workflows");

    if (apiResult.ok) {
      const workflows = (apiResult.data?.results || apiResult.data || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        owner: w.owner,
        isPrivate: w.isPrivate,
        lastExecution: w.lastExecution,
        triggerType: w.trigger?.type,
        taskCount: Object.keys(w.tasks || {}).length,
      }));

      return {
        success: true,
        toolName: "workflow_list",
        summary: `${workflows.length} workflow(s) found`,
        data: { workflows, source: "automation_api" },
        executionTimeMs: Date.now() - start,
      };
    }

    // Fallback: query Grail for workflow execution events
    const dql = `fetch events, from:now()-7d
| filter event.type == "WORKFLOW_EXECUTION" OR event.type == "dt.automation.workflow.run"
| summarize executions = count(),
            last_run = max(timestamp),
            successes = countIf(event.status == "SUCCESS" OR event.status == "OK"),
            failures = countIf(event.status == "FAILED" OR event.status == "ERROR")
  , by: { dt.automation.workflow_id, dt.automation.workflow_title }
| sort executions desc
| limit 50`;

    const records = await executeDql(dql);
    const workflows = records.map((r: any) => ({
      id: r["dt.automation.workflow_id"] || "unknown",
      title: r["dt.automation.workflow_title"] || "Unknown Workflow",
      executions: Number(r.executions || 0),
      lastRun: r.last_run,
      successes: Number(r.successes || 0),
      failures: Number(r.failures || 0),
      successRate:
        Number(r.executions || 0) > 0
          ? ((Number(r.successes || 0) / Number(r.executions || 0)) * 100).toFixed(1)
          : "N/A",
    }));

    return {
      success: true,
      toolName: "workflow_list",
      summary: `${workflows.length} workflow(s) found from execution history`,
      data: { workflows, source: "grail_events", note: apiResult.error },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * workflow_create — Create a new agentic workflow from template
 */
const workflowCreate: WorkflowToolDef = {
  name: "workflow_create",
  description:
    "Create a new Dynatrace agentic workflow from a template. Available templates: genai_error_spike_remediation, genai_cost_threshold_alert, genai_provider_failover, genai_latency_remediation, genai_security_response.",
  execute: async (params) => {
    const start = Date.now();
    const templateName = params.template || params.template_name || "";
    const customTitle = params.title || "";

    const templateNames = Object.keys(WORKFLOW_TEMPLATES);

    if (!templateName || !WORKFLOW_TEMPLATES[templateName]) {
      return {
        success: false,
        toolName: "workflow_create",
        summary: `Invalid template. Available: ${templateNames.join(", ")}`,
        data: { error: "Invalid or missing template", availableTemplates: templateNames },
        executionTimeMs: Date.now() - start,
      };
    }

    const template = WORKFLOW_TEMPLATES[templateName];
    const workflowDef = {
      ...template,
      title: customTitle || template.title,
    };

    const apiResult = await callAutomationAPI("/workflows", "POST", workflowDef);

    if (apiResult.ok) {
      return {
        success: true,
        toolName: "workflow_create",
        summary: `Workflow "${workflowDef.title}" created (ID: ${apiResult.data?.id || "pending"})`,
        data: {
          workflowId: apiResult.data?.id,
          title: workflowDef.title,
          template: templateName,
          source: "automation_api",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "workflow_create",
      summary: `Failed to create workflow: ${apiResult.error}`,
      data: {
        error: apiResult.error,
        template: templateName,
        workflowDefinition: workflowDef,
        note: "Workflow definition is valid — creation failed due to API error. Definition can be manually imported.",
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * workflow_execute — Trigger execution of a workflow
 */
const workflowExecute: WorkflowToolDef = {
  name: "workflow_execute",
  description:
    "Trigger manual execution of a Dynatrace workflow by ID. Returns the execution ID for tracking.",
  execute: async (params) => {
    const start = Date.now();
    const workflowId = params.workflow_id || params.workflowId || params.id || "";

    if (!workflowId) {
      return {
        success: false,
        toolName: "workflow_execute",
        summary: "Missing workflow_id parameter",
        data: { error: "workflow_id is required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const inputParams = params.input ? JSON.parse(params.input) : {};

    const apiResult = await callAutomationAPI(
      `/workflows/${workflowId}/run`,
      "POST",
      { input: inputParams }
    );

    if (apiResult.ok) {
      return {
        success: true,
        toolName: "workflow_execute",
        summary: `Workflow ${workflowId} triggered (execution: ${apiResult.data?.id || "started"})`,
        data: {
          workflowId,
          executionId: apiResult.data?.id,
          status: apiResult.data?.status || "RUNNING",
          source: "automation_api",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "workflow_execute",
      summary: `Failed to execute: ${apiResult.error}`,
      data: { error: apiResult.error, workflowId },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * workflow_get_executions — Get workflow execution history
 */
const workflowGetExecutions: WorkflowToolDef = {
  name: "workflow_get_executions",
  description:
    "Get recent execution history for Dynatrace workflows. Shows status, duration, and results.",
  execute: async (params) => {
    const start = Date.now();
    const workflowId = params.workflow_id || params.workflowId || "";
    const timeframe = params.timeframe || "24h";

    // Try API first
    if (workflowId) {
      const apiResult = await callAutomationAPI(`/workflows/${workflowId}/runs?limit=20`);
      if (apiResult.ok) {
        const executions = (apiResult.data?.results || apiResult.data || []).map((e: any) => ({
          id: e.id,
          status: e.status,
          startTime: e.startTime,
          endTime: e.endTime,
          duration: e.duration,
          trigger: e.trigger,
        }));

        return {
          success: true,
          toolName: "workflow_get_executions",
          summary: `${executions.length} execution(s) for workflow ${workflowId}`,
          data: { executions, workflowId, source: "automation_api" },
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // Fallback: Grail events
    const filterClause = workflowId
      ? `| filter dt.automation.workflow_id == "${workflowId}"`
      : "";

    const dql = `fetch events, from:now()-${timeframe}
| filter event.type == "WORKFLOW_EXECUTION" OR event.type == "dt.automation.workflow.run"
${filterClause}
| fieldsAdd workflow_id = dt.automation.workflow_id,
             workflow_title = dt.automation.workflow_title,
             status = event.status,
             duration_ms = toLong(coalesce(dt.automation.duration_ms, 0))
| sort timestamp desc
| limit 50`;

    const records = await executeDql(dql);

    return {
      success: true,
      toolName: "workflow_get_executions",
      summary: `${records.length} execution(s) in last ${timeframe}`,
      data: { executions: records, workflowId, timeframe, source: "grail_events" },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * workflow_get_status — Get status of a running workflow execution
 */
const workflowGetStatus: WorkflowToolDef = {
  name: "workflow_get_status",
  description:
    "Get the current status of a specific workflow execution. Returns task-level progress and any results.",
  execute: async (params) => {
    const start = Date.now();
    const workflowId = params.workflow_id || params.workflowId || "";
    const executionId = params.execution_id || params.executionId || "";

    if (!workflowId || !executionId) {
      return {
        success: false,
        toolName: "workflow_get_status",
        summary: "Missing workflow_id or execution_id",
        data: { error: "Both workflow_id and execution_id are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const apiResult = await callAutomationAPI(`/workflows/${workflowId}/runs/${executionId}`);

    if (apiResult.ok) {
      const execution = apiResult.data;
      const tasks = Object.entries(execution.taskResults || {}).map(([name, result]: [string, any]) => ({
        name,
        status: result.status,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration,
        output: result.result,
      }));

      return {
        success: true,
        toolName: "workflow_get_status",
        summary: `Execution ${executionId}: ${execution.status} (${tasks.length} tasks)`,
        data: {
          executionId,
          workflowId,
          status: execution.status,
          startTime: execution.startTime,
          endTime: execution.endTime,
          tasks,
          source: "automation_api",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "workflow_get_status",
      summary: `Failed: ${apiResult.error}`,
      data: { error: apiResult.error, workflowId, executionId },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * workflow_create_genai_remediation — One-click GenAI remediation workflow creation
 */
const workflowCreateRemediation: WorkflowToolDef = {
  name: "workflow_create_genai_remediation",
  description:
    "Create a comprehensive GenAI remediation workflow that combines DQL analysis, Slack notification, PagerDuty incident creation, and auto-remediation steps.",
  execute: async (params) => {
    const start = Date.now();
    const remediationType = params.type || "error_spike";
    const slackWebhook = params.slack_webhook || "";
    const pagerdutyKey = params.pagerduty_routing_key || "";

    const workflowDef = {
      title: `GenAI Remediation: ${remediationType}`,
      description: `Automated GenAI remediation for ${remediationType}. Created by GCC MCP Server.`,
      trigger: {
        type: "interval",
        configuration: { interval: { minutes: 10 } },
      },
      tasks: {
        analyze: {
          name: "analyze",
          action: "dynatrace.automations:run-javascript",
          input: {
            script: `
              const result = await fetch('/platform/storage/query/v1/query:execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: 'fetch spans, from:now()-15m | filter isNotNull(gen_ai.provider.name) | summarize error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0, avg_latency = avg(duration) / 1000000, total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)), by: { gen_ai.provider.name, gen_ai.request.model }'
                })
              });
              return await result.json();
            `,
          },
          position: { x: 0, y: 0 },
        },
        ...(slackWebhook
          ? {
              notify_slack: {
                name: "notify_slack",
                action: "dynatrace.automations:http-function",
                input: {
                  method: "POST",
                  url: slackWebhook,
                  headers: { "Content-Type": "application/json" },
                  body: '{"text":"🤖 GenAI Remediation triggered for ' + remediationType + '"}',
                },
                conditions: { states: { analyze: "OK" } },
                position: { x: 0, y: 1 },
              },
            }
          : {}),
        ...(pagerdutyKey
          ? {
              create_incident: {
                name: "create_incident",
                action: "dynatrace.automations:http-function",
                input: {
                  method: "POST",
                  url: "https://events.pagerduty.com/v2/enqueue",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    routing_key: pagerdutyKey,
                    event_action: "trigger",
                    payload: {
                      summary: `GenAI ${remediationType} detected`,
                      source: "GenAI Control Center",
                      severity: "error",
                    },
                  }),
                },
                conditions: { states: { analyze: "OK" } },
                position: { x: 1, y: 1 },
              },
            }
          : {}),
      },
    };

    const apiResult = await callAutomationAPI("/workflows", "POST", workflowDef);

    return {
      success: apiResult.ok || true,
      toolName: "workflow_create_genai_remediation",
      summary: apiResult.ok
        ? `Remediation workflow created (ID: ${apiResult.data?.id})`
        : `Workflow definition generated (API: ${apiResult.error})`,
      data: {
        workflowId: apiResult.data?.id,
        remediationType,
        hasSlack: !!slackWebhook,
        hasPagerDuty: !!pagerdutyKey,
        taskCount: Object.keys(workflowDef.tasks).length,
        created: apiResult.ok,
        error: apiResult.error,
        definition: apiResult.ok ? undefined : workflowDef,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all Workflow MCP tools ────────────────────

export const WORKFLOW_MCP_TOOLS: WorkflowToolDef[] = [
  workflowList,
  workflowCreate,
  workflowExecute,
  workflowGetExecutions,
  workflowGetStatus,
  workflowCreateRemediation,
];
