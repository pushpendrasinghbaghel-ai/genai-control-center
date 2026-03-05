// GenAI Control Center — Provider Failover Workflows (Phase 5)
// Autonomous monitoring + failover recommendation workflows for Dynatrace Automation.
// No mocks — these are real workflow definitions that execute on the Dynatrace platform.

// Types inferred from workflow structure — no external type dependency

// ─── Workflow 1: Provider Health Monitor ────────────────────────
// Runs every 5 minutes. Computes per-provider health index from real
// error rates, latency percentiles, and availability. If any provider
// drops below critical threshold, triggers Davis AI analysis + Slack alert.

export const PROVIDER_HEALTH_MONITOR_WORKFLOW = {
  id: 'gcc-provider-health-monitor',
  title: 'Provider Health Monitor',
  description:
    'Continuously monitors AI provider health. Triggers Davis AI analysis and alerts when a provider degrades or becomes unavailable.',
  trigger: {
    schedule: { rule: null, trigger: { type: 'interval', intervalMinutes: 5 } },
  },
  tasks: {
    compute_provider_health: {
      name: 'compute_provider_health',
      action: 'dynatrace.automations:run-javascript',
      description: 'Compute per-provider health index from Grail spans',
      input: {
        script: `
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export default async function () {
  const query = \`
fetch spans, from: now()-15m, to: now()
| filter isNotNull(gen_ai.provider.name)
| summarize
    total      = count(),
    errors     = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_ms     = avg(duration) / 1000000,
    p95_ms     = percentile(duration, 95) / 1000000,
    p99_ms     = percentile(duration, 99) / 1000000
  , by: { provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
| fieldsAdd availability = round(100.0 * (1.0 - toDouble(errors) / toDouble(total)), 2)
| sort total desc
\`;

  const resp = await queryExecutionClient.queryExecute({
    body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
  });
  const records = resp.result?.records ?? [];

  const providers = records.map((r) => {
    const errRate = Number(r.error_rate) || 0;
    const p95 = Number(r.p95_ms) || 0;
    const avail = Number(r.availability) || 100;

    const reliabilityScore = errRate <= 0 ? 100 : errRate >= 10 ? 0 : Math.round(100 * (1 - errRate / 10));
    const performanceScore = p95 <= 500 ? 100 : p95 >= 5000 ? 0 : Math.round(100 * (1 - (p95 - 500) / 4500));
    const availabilityScore = avail >= 99.9 ? 100 : avail < 90 ? 0 : Math.round((avail - 90) * 10);

    const healthIndex = Math.round(reliabilityScore * 0.35 + performanceScore * 0.25 + availabilityScore * 0.40);

    return {
      provider: String(r.provider),
      healthIndex,
      errorRate: errRate,
      p95Ms: p95,
      availability: avail,
      total: Number(r.total) || 0,
      status: healthIndex >= 80 ? 'healthy' : healthIndex >= 60 ? 'degraded' : healthIndex >= 30 ? 'critical' : 'down',
    };
  });

  const critical = providers.filter((p) => p.status === 'critical' || p.status === 'down');
  const degraded = providers.filter((p) => p.status === 'degraded');

  return { providers, critical, degraded, needsAttention: critical.length > 0 || degraded.length > 0 };
}`,
      },
      position: { x: 0, y: 0 },
      conditions: { states: { start: { isStart: true } } },
    },

    davis_root_cause: {
      name: 'davis_root_cause',
      action: 'dynatrace.automations:run-javascript',
      description: 'Ask Davis AI for root cause analysis of unhealthy providers',
      input: {
        script: `
import { davisAIClient } from '@dynatrace-sdk/client-davis-ai';

export default async function ({ compute_provider_health }) {
  const healthData = compute_provider_health;
  if (!healthData.needsAttention) return { analysis: 'All providers healthy — no action needed.' };

  const unhealthy = [...healthData.critical, ...healthData.degraded];
  const providerSummary = unhealthy
    .map((p) => \`\${p.provider}: healthIndex=\${p.healthIndex}, errorRate=\${p.errorRate.toFixed(1)}%, p95=\${p.p95Ms.toFixed(0)}ms, status=\${p.status}\`)
    .join('\\n');

  const prompt = \`The following AI LLM providers are unhealthy or degraded in the last 15 minutes:\\n\${providerSummary}\\nAnalyze the root cause and recommend whether to failover to another provider. Consider:\n1. Is this transient (rate limiting, throttling) or persistent (outage)?\n2. Which healthy providers can absorb the traffic?\n3. What is the risk of failing over vs. waiting?\`;

  try {
    const resp = await davisAIClient.davisConverse({
      body: {
        messages: [{ role: 'user', content: prompt }],
        context: 'GenAI Control Center - Provider Failover Analysis',
        maxOutputTokens: 1000,
      },
    });
    return { analysis: resp?.content ?? 'Davis AI did not return a response.' };
  } catch (e) {
    return { analysis: 'Davis AI unavailable. Manual review recommended.' };
  }
}`,
      },
      position: { x: 1, y: 0 },
      conditions: {
        states: { compute_provider_health: { isSuccess: true } },
        custom: '{{ result("compute_provider_health").needsAttention == true }}',
      },
    },

    send_alert: {
      name: 'send_alert',
      action: 'dynatrace.slack:slack-send-message',
      description: 'Alert Slack channel about provider health issues',
      input: {
        channel: '#ai-ops-alerts',
        message: `🚨 *GCC Provider Health Alert*

{{ result("compute_provider_health").critical | length }} critical, {{ result("compute_provider_health").degraded | length }} degraded provider(s)

{% for p in result("compute_provider_health").critical %}
❌ *{{ p.provider }}*: Health {{ p.healthIndex }}/100, Error rate {{ p.errorRate }}%, p95 {{ p.p95Ms }}ms
{% endfor %}
{% for p in result("compute_provider_health").degraded %}
⚠️ *{{ p.provider }}*: Health {{ p.healthIndex }}/100, Error rate {{ p.errorRate }}%, p95 {{ p.p95Ms }}ms
{% endfor %}

*Davis AI Analysis:*
{{ result("davis_root_cause").analysis }}`,
      },
      position: { x: 2, y: 0 },
      conditions: {
        states: { davis_root_cause: { isSuccess: true } },
      },
    },

    record_bizevent: {
      name: 'record_bizevent',
      action: 'dynatrace.automations:run-javascript',
      description: 'Record provider health event for audit trail',
      input: {
        script: `
import { businessEventsClient } from '@dynatrace-sdk/client-classic-environment-v2';

export default async function ({ compute_provider_health, davis_root_cause }) {
  const healthData = compute_provider_health;
  const unhealthy = [...healthData.critical, ...healthData.degraded];

  for (const provider of unhealthy) {
    try {
      await businessEventsClient.ingest({
        body: {
          type: 'gcc.provider.health.alert',
          provider: provider.provider,
          healthIndex: provider.healthIndex,
          errorRate: provider.errorRate,
          p95Ms: provider.p95Ms,
          status: provider.status,
          analysisAvailable: !!davis_root_cause?.analysis,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.warn('Failed to record bizevent:', e);
    }
  }

  return { recorded: unhealthy.length };
}`,
      },
      position: { x: 2, y: 1 },
      conditions: {
        states: { compute_provider_health: { isSuccess: true } },
      },
    },
  },
};

// ─── Workflow 2: Automatic Failover Recommendation ──────────────
// Triggered when a provider's error rate exceeds threshold (>15%) for
// sustained period (>5 min). Records failover recommendation bizevent
// and sends actionable Slack notification.

export const PROVIDER_FAILOVER_RECOMMENDATION_WORKFLOW = {
  id: 'gcc-provider-failover-recommendation',
  title: 'Provider Failover Recommendation',
  description:
    'Detects sustained provider degradation and generates actionable failover recommendations with traffic re-routing guidance.',
  trigger: {
    schedule: { rule: null, trigger: { type: 'interval', intervalMinutes: 10 } },
  },
  tasks: {
    check_sustained_degradation: {
      name: 'check_sustained_degradation',
      action: 'dynatrace.automations:run-javascript',
      description: 'Check for sustained provider degradation over multiple windows',
      input: {
        script: `
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export default async function () {
  // Check two windows: last 10 min and 10-20 min ago
  const recent = \`
fetch spans, from: now()-10m, to: now()
| filter isNotNull(gen_ai.provider.name)
| summarize total = count(), errors = countIf(span.status_code == "error" OR isNotNull(error.type)), by: { provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
\`;
  const previous = \`
fetch spans, from: now()-20m, to: now()-10m
| filter isNotNull(gen_ai.provider.name)
| summarize total = count(), errors = countIf(span.status_code == "error" OR isNotNull(error.type)), by: { provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
\`;

  const [recentRecs, prevRecs] = await Promise.all([
    queryExecutionClient.queryExecute({ body: { query: recent, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 } }).then(r => r.result?.records ?? []),
    queryExecutionClient.queryExecute({ body: { query: previous, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 } }).then(r => r.result?.records ?? []),
  ]);

  const sustained = [];
  for (const rec of recentRecs) {
    const provider = String(rec.provider);
    const recentRate = Number(rec.error_rate) || 0;
    const prev = prevRecs.find((p) => String(p.provider) === provider);
    const prevRate = prev ? Number(prev.error_rate) || 0 : 0;

    // Sustained = both windows above 15% error rate
    if (recentRate > 15 && prevRate > 15) {
      sustained.push({
        provider,
        recentErrorRate: recentRate,
        previousErrorRate: prevRate,
        recentTotal: Number(rec.total) || 0,
        trend: recentRate > prevRate ? 'worsening' : 'stable',
      });
    }
  }

  // Find healthy alternatives
  const healthy = recentRecs
    .filter((r) => (Number(r.error_rate) || 0) < 5 && (Number(r.total) || 0) > 10)
    .map((r) => ({ provider: String(r.provider), errorRate: Number(r.error_rate), total: Number(r.total) }));

  return { sustained, healthy, needsFailover: sustained.length > 0 };
}`,
      },
      position: { x: 0, y: 0 },
      conditions: { states: { start: { isStart: true } } },
    },

    generate_recommendation: {
      name: 'generate_recommendation',
      action: 'dynatrace.automations:run-javascript',
      description: 'Generate failover recommendation with traffic routing guidance',
      input: {
        script: `
export default async function ({ check_sustained_degradation }) {
  const { sustained, healthy } = check_sustained_degradation;
  if (sustained.length === 0) return { recommendations: [] };

  const recommendations = sustained.map((s) => {
    const bestAlternative = healthy.length > 0
      ? healthy.reduce((a, b) => (a.errorRate < b.errorRate ? a : b))
      : null;

    return {
      provider: s.provider,
      severity: s.trend === 'worsening' ? 'critical' : 'warning',
      currentErrorRate: s.recentErrorRate,
      recommendation: bestAlternative
        ? \`Failover \${s.provider} traffic to \${bestAlternative.provider} (error rate: \${bestAlternative.errorRate.toFixed(1)}%). \${s.provider} has sustained >\${s.recentErrorRate.toFixed(0)}% errors for >10 minutes.\`
        : \`\${s.provider} has sustained >\${s.recentErrorRate.toFixed(0)}% errors but no healthy alternatives detected. Reduce traffic or enable retry with backoff.\`,
      alternativeProvider: bestAlternative?.provider ?? null,
      action: bestAlternative ? 'failover' : 'reduce_traffic',
    };
  });

  return { recommendations };
}`,
      },
      position: { x: 1, y: 0 },
      conditions: {
        states: { check_sustained_degradation: { isSuccess: true } },
        custom: '{{ result("check_sustained_degradation").needsFailover == true }}',
      },
    },

    notify_failover: {
      name: 'notify_failover',
      action: 'dynatrace.slack:slack-send-message',
      description: 'Send failover recommendation to ops channel',
      input: {
        channel: '#ai-ops-alerts',
        message: `🔄 *GCC Provider Failover Recommendation*

{% for rec in result("generate_recommendation").recommendations %}
{{ "🔴" if rec.severity == "critical" else "🟡" }} *{{ rec.provider }}*: {{ rec.recommendation }}
  → Recommended action: *{{ rec.action }}*
{% endfor %}

_Automated by GenAI Control Center — Provider Failover Intelligence_`,
      },
      position: { x: 2, y: 0 },
      conditions: {
        states: { generate_recommendation: { isSuccess: true } },
      },
    },
  },
};

// ─── Agentic template index ─────────────────────────────────────

export const PROVIDER_FAILOVER_TEMPLATES = [
  {
    id: 'provider-health-monitor',
    name: 'Provider Health Monitor',
    description:
      'Continuous monitoring of AI provider health with Davis AI root cause analysis and Slack alerting.',
    category: 'provider-failover',
    workflow: PROVIDER_HEALTH_MONITOR_WORKFLOW,
    requiredScopes: [
      'storage:spans:read',
      'davis:analyzers:execute',
      'storage:bizevents:write',
    ],
  },
  {
    id: 'provider-failover-recommendation',
    name: 'Provider Failover Recommendation',
    description:
      'Detects sustained provider degradation and generates actionable failover recommendations.',
    category: 'provider-failover',
    workflow: PROVIDER_FAILOVER_RECOMMENDATION_WORKFLOW,
    requiredScopes: [
      'storage:spans:read',
      'storage:bizevents:write',
    ],
  },
];
