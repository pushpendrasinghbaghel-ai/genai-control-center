/**
 * Slack Integration Hook — Real Dynatrace Workflow-based Slack notifications
 *
 * Uses Dynatrace Automation SDK to create and execute workflows that send
 * Slack notifications for GenAI observability events. No mocks — all data
 * flows through real DQL queries and Dynatrace workflow executions.
 *
 * Architecture:
 * 1. DQL queries discover existing Slack notification workflow executions
 * 2. Automation SDK creates/runs workflows with Slack action steps
 * 3. Webhook-based delivery via Dynatrace workflow HTTP actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { workflowsClient, executionsClient } from '@dynatrace-sdk/client-automation';
import type {
  SlackIntegrationConfig,
  SlackNotification,
  SlackChannelStatus,
  SlackNotifyTrigger,
} from '../types';

// ============================================
// DQL Queries for Slack integration data
// ============================================

const SLACK_WORKFLOW_EXECUTIONS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | filter matchesPhrase(event.category, "slack") OR matchesPhrase(dt.automation.action_type, "slack")
  | summarize {
      total = count(),
      successful = countIf(event.status == "SUCCESS"),
      failed = countIf(event.status == "ERROR"),
      channels = collectDistinct(dt.automation.slack_channel)
    }
`;

const SLACK_NOTIFICATION_HISTORY_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | filter matchesPhrase(event.category, "slack") OR matchesPhrase(dt.automation.action_type, "slack")
  | fieldsAdd channel = coalesce(dt.automation.slack_channel, "#genai-alerts"),
               severity = coalesce(dt.automation.severity, "info"),
               trigger = coalesce(dt.automation.trigger_type, "manual"),
               message = coalesce(dt.automation.message, event.name)
  | sort timestamp desc
  | limit 50
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
      high_latency_count = countIf(duration > 5000000000),
      total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
    }, by: { gen_ai.provider.name }
`;

// ============================================
// Slack Workflow Template
// ============================================

function buildSlackWorkflowPayload(config: {
  title: string;
  channel: string;
  webhookUrl: string;
  triggerType: string;
  conditions?: Record<string, unknown>;
}) {
  return {
    title: config.title,
    description: `GCC Slack notification: ${config.triggerType}`,
    trigger: {
      schedule: {
        trigger: {
          type: 'interval' as const,
          intervalMinutes: 5,
        },
        filterParameters: {
          type: 'custom' as const,
          ...(config.conditions || {}),
        },
      },
    },
    tasks: {
      check_condition: {
        name: 'check_condition',
        action: 'dynatrace.automations:run-javascript' as const,
        description: 'Evaluate GenAI alert condition via DQL',
        input: {
          script: `
import { execution } from '@dynatrace-sdk/automation-utils';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export default async function() {
  const result = await queryExecutionClient.queryExecute({
    body: {
      query: \`fetch spans, from:now()-5m
        | filter isNotNull(gen_ai.provider.name)
        | summarize error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0,
                    avg_latency_ms = avg(duration) / 1000000\`,
      requestTimeoutMilliseconds: 30000,
    }
  });
  const records = result.result?.records || [];
  return { shouldAlert: records.length > 0, data: records };
}`,
        },
        position: { x: 0, y: 1 },
      },
      send_slack: {
        name: 'send_slack',
        action: 'dynatrace.automations:http-function' as const,
        description: 'Send Slack notification via webhook',
        conditions: {
          states: { check_condition: 'OK' },
        },
        input: {
          method: 'POST',
          url: config.webhookUrl,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: config.channel,
            username: 'GenAI Control Center',
            icon_emoji: ':robot_face:',
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: `🚨 GenAI Alert: ${config.triggerType}` },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '{{result("check_condition").data | json}}',
                },
              },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `Triggered by: *${config.triggerType}* | Source: GenAI Control Center` },
                ],
              },
            ],
          }),
        },
        position: { x: 0, y: 2 },
      },
    },
  };
}

// ============================================
// Hook
// ============================================

interface UseSlackIntegrationResult {
  config: SlackIntegrationConfig | null;
  notifications: SlackNotification[];
  channelStatus: SlackChannelStatus[];
  alertConditions: Array<{
    provider: string;
    errorRate: number;
    avgLatencyMs: number;
    totalRequests: number;
    shouldAlert: boolean;
  }>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchStatus: () => Promise<void>;
  sendTestNotification: (channel: string, webhookUrl: string) => Promise<boolean>;
  createSlackWorkflow: (
    name: string,
    channel: string,
    webhookUrl: string,
    trigger: SlackNotifyTrigger
  ) => Promise<string | null>;
  sendAlertNotification: (
    webhookUrl: string,
    channel: string,
    message: string,
    severity: 'info' | 'warning' | 'critical'
  ) => Promise<boolean>;
}

export function useSlackIntegration(timeframe = '24h'): UseSlackIntegrationResult {
  const [config, setConfig] = useState<SlackIntegrationConfig | null>(null);
  const [notifications, setNotifications] = useState<SlackNotification[]>([]);
  const [channelStatus, setChannelStatus] = useState<SlackChannelStatus[]>([]);
  const [alertConditions, setAlertConditions] = useState<Array<{
    provider: string;
    errorRate: number;
    avgLatencyMs: number;
    totalRequests: number;
    shouldAlert: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Parallel DQL queries for Slack integration data
      const [execRes, historyRes, conditionsRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: {
            query: SLACK_WORKFLOW_EXECUTIONS_QUERY(timeframe),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60,
          },
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: SLACK_NOTIFICATION_HISTORY_QUERY(timeframe),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60,
          },
        }),
        queryExecutionClient.queryExecute({
          body: {
            query: GENAI_ALERT_CONDITIONS_QUERY(timeframe),
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60,
          },
        }),
      ]);

      // Parse execution summary
      const execRec = (execRes.result?.records || [])[0];
      if (execRec) {
        const channels = (execRec['channels'] as string[]) || [];
        setConfig({
          webhookUrl: '', // configured per-channel
          channel: channels[0] || '#genai-alerts',
          enabled: Number(execRec['total'] || 0) > 0,
          notifyOn: ['error_spike', 'latency_breach', 'provider_down'],
          totalNotificationsSent: Number(execRec['total'] || 0),
        });

        setChannelStatus(
          channels.map((ch) => ({
            channel: ch,
            connected: true,
            messagesLast24h: Math.ceil(Number(execRec['successful'] || 0) / Math.max(channels.length, 1)),
            errorCount: Math.ceil(Number(execRec['failed'] || 0) / Math.max(channels.length, 1)),
          }))
        );
      } else {
        setConfig({
          webhookUrl: '',
          channel: '#genai-alerts',
          enabled: false,
          notifyOn: [],
          totalNotificationsSent: 0,
        });
        setChannelStatus([]);
      }

      // Parse notification history
      const notifs: SlackNotification[] = (historyRes.result?.records || []).map(
        (r: any, i: number) => ({
          id: `slack-${i}-${String(r['timestamp'] || Date.now())}`,
          channel: String(r['channel'] || '#genai-alerts'),
          message: String(r['message'] || 'GenAI alert'),
          severity: String(r['severity'] || 'info') as 'info' | 'warning' | 'critical',
          timestamp: String(r['timestamp'] || new Date().toISOString()),
          trigger: String(r['trigger'] || 'manual') as SlackNotifyTrigger,
          delivered: String(r['event.status'] || 'SUCCESS') === 'SUCCESS',
        })
      );
      setNotifications(notifs);

      // Parse alert conditions
      const conditions = (conditionsRes.result?.records || []).map((r: any) => {
        const errorRate = Number(r['error_rate'] || 0);
        const avgLatencyMs = Number(r['avg_latency_ms'] || 0);
        return {
          provider: String(r['gen_ai.provider.name'] || 'unknown'),
          errorRate,
          avgLatencyMs,
          totalRequests: Number(r['total_requests'] || 0),
          shouldAlert: errorRate > 5 || avgLatencyMs > 3000,
        };
      });
      setAlertConditions(conditions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Slack integration data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchStatus();
    return () => abortRef.current?.abort();
  }, [fetchStatus]);

  // Send a test Slack notification via Dynatrace workflow HTTP action
  const sendTestNotification = useCallback(
    async (channel: string, webhookUrl: string): Promise<boolean> => {
      try {
        // Create and immediately execute a one-shot workflow
        const workflow = await workflowsClient.createWorkflow({
          body: {
            title: `GCC Slack Test - ${new Date().toISOString()}`,
            description: 'One-shot test notification from GenAI Control Center',
            tasks: {
              send_test: {
                name: 'send_test',
                action: 'dynatrace.automations:http-function',
                description: 'Send test Slack message',
                input: {
                  method: 'POST',
                  url: webhookUrl,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    channel,
                    username: 'GenAI Control Center',
                    icon_emoji: ':white_check_mark:',
                    text: `✅ *GenAI Control Center* — Slack integration test successful!\nTimestamp: ${new Date().toISOString()}\nChannel: ${channel}`,
                  }),
                },
                position: { x: 0, y: 1 },
              },
            },
          } as any,
        });

        // Execute the workflow
        await workflowsClient.runWorkflow({
          id: workflow.id!,
          body: {},
        });

        return true;
      } catch (err) {
        console.error('[SlackIntegration] Test notification failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to send test notification');
        return false;
      }
    },
    []
  );

  // Create a persistent Slack notification workflow
  const createSlackWorkflow = useCallback(
    async (
      name: string,
      channel: string,
      webhookUrl: string,
      trigger: SlackNotifyTrigger
    ): Promise<string | null> => {
      try {
        const payload = buildSlackWorkflowPayload({
          title: `GCC: ${name}`,
          channel,
          webhookUrl,
          triggerType: trigger,
        });

        const workflow = await workflowsClient.createWorkflow({
          body: payload as any,
        });

        await fetchStatus(); // Refresh
        return workflow.id || null;
      } catch (err) {
        console.error('[SlackIntegration] Workflow creation failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to create Slack workflow');
        return null;
      }
    },
    [fetchStatus]
  );

  // Send an immediate alert notification via a transient workflow
  const sendAlertNotification = useCallback(
    async (
      webhookUrl: string,
      channel: string,
      message: string,
      severity: 'info' | 'warning' | 'critical'
    ): Promise<boolean> => {
      const severityEmoji = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : 'ℹ️';
      try {
        const workflow = await workflowsClient.createWorkflow({
          body: {
            title: `GCC Alert: ${severity} - ${new Date().toISOString()}`,
            description: `GenAI Control Center ${severity} alert`,
            tasks: {
              send_alert: {
                name: 'send_alert',
                action: 'dynatrace.automations:http-function',
                description: `Send ${severity} Slack alert`,
                input: {
                  method: 'POST',
                  url: webhookUrl,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    channel,
                    username: 'GenAI Control Center',
                    icon_emoji: ':robot_face:',
                    blocks: [
                      {
                        type: 'header',
                        text: { type: 'plain_text', text: `${severityEmoji} GenAI Alert [${severity.toUpperCase()}]` },
                      },
                      {
                        type: 'section',
                        text: { type: 'mrkdwn', text: message },
                      },
                      {
                        type: 'context',
                        elements: [
                          {
                            type: 'mrkdwn',
                            text: `Source: GenAI Control Center | ${new Date().toISOString()}`,
                          },
                        ],
                      },
                    ],
                  }),
                },
                position: { x: 0, y: 1 },
              },
            },
          } as any,
        });

        await workflowsClient.runWorkflow({ id: workflow.id!, body: {} });
        return true;
      } catch (err) {
        console.error('[SlackIntegration] Alert send failed:', err);
        return false;
      }
    },
    []
  );

  return {
    config,
    notifications,
    channelStatus,
    alertConditions,
    loading,
    error,
    fetchStatus,
    sendTestNotification,
    createSlackWorkflow,
    sendAlertNotification,
  };
}
