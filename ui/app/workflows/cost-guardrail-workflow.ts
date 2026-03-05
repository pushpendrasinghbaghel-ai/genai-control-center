// GenAI Control Center — Cost Guardrail Agentic Workflow
// Phase 1: Autonomous cost enforcement via Dynatrace AutomationEngine
// Triggered by Davis anomaly on cost_velocity metric or scheduled hourly check

/**
 * Cost Velocity Anomaly Response Workflow
 * 
 * Trigger: Davis anomaly detection on GenAI cost velocity
 * Flow:
 *   1. Query current cost velocity vs baseline
 *   2. Use Dynatrace Intelligence to reason about the anomaly
 *   3. Determine action: legitimate spike vs runaway
 *   4. Execute guardrail: alert / throttle / model-switch
 *   5. Record guardrail event in Grail
 */
export const COST_VELOCITY_GUARDRAIL_WORKFLOW = {
  title: "GCC: Cost Velocity Guardrail",
  description: "Agentic workflow that detects GenAI cost velocity anomalies and enforces budget guardrails. Uses Dynatrace Intelligence for root cause reasoning before taking action.",
  trigger: {
    schedule: {
      rule: "*/15 * * * *", // Every 15 minutes
      timezone: "UTC",
      isActive: true,
    },
  },
  schemaVersion: 3,
  tasks: {
    query_current_velocity: {
      name: "query_current_velocity",
      description: "Query current cost velocity (last 30 min) and baseline (last 24h)",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `fetch spans, from: now()-30m, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { provider, model }`,
      },
      position: { x: 0, y: 1 },
    },

    query_baseline: {
      name: "query_baseline",
      description: "Query 24h baseline for cost velocity comparison",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `fetch spans, from: now()-24h, to: now()-30m
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { provider, model }`,
      },
      position: { x: 1, y: 1 },
    },

    compute_velocity_ratio: {
      name: "compute_velocity_ratio",
      description: "Calculate cost velocity ratio (current vs baseline)",
      action: "dynatrace.automations:run-javascript",
      input: {
        script: `
const current = {{ result("query_current_velocity") }};
const baseline = {{ result("query_baseline") }};

// Simple cost estimation (per 1M tokens)
const PRICING = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
  'gemini-pro': { input: 0.5, output: 1.5 },
};

function estimateCost(model, inputTok, outputTok) {
  const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || '';
  const rate = PRICING[key] || { input: 2, output: 6 };
  return (inputTok * rate.input + outputTok * rate.output) / 1000000;
}

// Current cost (last 30 min)
let currentCost = 0;
let currentRequests = 0;
(current || []).forEach(r => {
  currentCost += estimateCost(r.model || 'unknown', r.total_input || 0, r.total_output || 0);
  currentRequests += r.request_count || 0;
});
const currentCPM = currentCost / 30; // per minute

// Baseline cost (last ~23.5h)
let baselineCost = 0;
let baselineRequests = 0;
(baseline || []).forEach(r => {
  baselineCost += estimateCost(r.model || 'unknown', r.total_input || 0, r.total_output || 0);
  baselineRequests += r.request_count || 0;
});
const baselineCPM = baselineCost / (23.5 * 60); // per minute over 23.5 hours

const velocityRatio = baselineCPM > 0 ? currentCPM / baselineCPM : 0;
const isAnomaly = velocityRatio > 2;
const isCritical = velocityRatio > 5;

return {
  currentCostPerMinute: currentCPM.toFixed(4),
  baselineCostPerMinute: baselineCPM.toFixed(4),
  velocityRatio: velocityRatio.toFixed(2),
  currentCost30min: currentCost.toFixed(2),
  currentRequests,
  isAnomaly,
  isCritical,
  severity: isCritical ? 'CRITICAL' : isAnomaly ? 'WARNING' : 'NORMAL'
};`,
      },
      position: { x: 0, y: 2 },
      predecessors: ["query_current_velocity", "query_baseline"],
    },

    reason_with_intelligence: {
      name: "reason_with_intelligence",
      description: "Use Dynatrace Intelligence to analyze whether this is a legitimate traffic spike or a runaway agent",
      action: "dynatrace.automations:dynatrace-intelligence",
      input: {
        prompt: `You are a GenAI FinOps analyst in the GenAI Control Center.

A cost velocity anomaly has been detected:
- Current cost/minute: \${{ result("compute_velocity_ratio").currentCostPerMinute }}
- Baseline cost/minute: \${{ result("compute_velocity_ratio").baselineCostPerMinute }}
- Velocity ratio: {{ result("compute_velocity_ratio").velocityRatio }}x baseline
- Severity: {{ result("compute_velocity_ratio").severity }}
- Requests in last 30 min: {{ result("compute_velocity_ratio").currentRequests }}

Analyze this anomaly and determine:
1. Is this likely a legitimate traffic spike (scheduled batch, marketing event) or a runaway agent/misconfigured service?
2. What is the estimated additional cost if this continues for 1 hour?
3. Recommended action: ALERT_ONLY, THROTTLE, or MODEL_SWITCH
4. Confidence level: HIGH, MEDIUM, or LOW

Respond in JSON format:
{
  "analysis": "...",
  "likely_cause": "legitimate_spike | runaway_agent | misconfigured_service | unknown",
  "estimated_hourly_cost": "...",
  "recommended_action": "ALERT_ONLY | THROTTLE | MODEL_SWITCH",
  "confidence": "HIGH | MEDIUM | LOW"
}`,
      },
      position: { x: 0, y: 3 },
      predecessors: ["compute_velocity_ratio"],
      conditions: {
        custom: "{{ result('compute_velocity_ratio').isAnomaly == true }}",
      },
    },

    send_alert: {
      name: "send_alert",
      description: "Send Slack alert about cost velocity anomaly",
      action: "dynatrace.automations:send-slack-message",
      input: {
        channel: "{{$.trigger.slackChannel || '#genai-alerts'}}",
        message: `🚨 *GenAI Cost Velocity Alert — {{ result("compute_velocity_ratio").severity }}*

Cost velocity is *{{ result("compute_velocity_ratio").velocityRatio }}x* above baseline.

📊 *Metrics*
• Current: \${{ result("compute_velocity_ratio").currentCostPerMinute }}/min
• Baseline: \${{ result("compute_velocity_ratio").baselineCostPerMinute }}/min
• Last 30 min spend: \${{ result("compute_velocity_ratio").currentCost30min }}
• Requests (30 min): {{ result("compute_velocity_ratio").currentRequests }}

🤖 *Dynatrace Intelligence Analysis*
{{ result("reason_with_intelligence") }}

_Sent by GenAI Control Center — Cost Guardrails_`,
      },
      position: { x: 0, y: 4 },
      predecessors: ["reason_with_intelligence"],
    },

    record_guardrail_event: {
      name: "record_guardrail_event",
      description: "Record the guardrail event as a business event in Grail",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `// Record guardrail event — visibility in FinOps dashboard
// In production, use bizevents ingest API instead
fetch spans, from: now()-1m, to: now() | limit 0`,
      },
      position: { x: 0, y: 5 },
      predecessors: ["send_alert"],
    },
  },
  ownerType: "USER",
  isPrivate: false,
};

/**
 * Budget Exhaustion Prevention Workflow
 * 
 * Trigger: Scheduled hourly
 * Flow:
 *   1. Calculate current daily spend and burn rate
 *   2. Project budget exhaustion ETA
 *   3. If <4 hours to exhaustion, alert
 *   4. If <1 hour, recommend throttling
 */
export const BUDGET_EXHAUSTION_WORKFLOW = {
  title: "GCC: Budget Exhaustion Prevention",
  description: "Monitors daily GenAI budget burn rate and alerts when approaching exhaustion. Can trigger automatic throttling.",
  trigger: {
    schedule: {
      rule: "0 * * * *", // Every hour
      timezone: "UTC",
      isActive: true,
    },
  },
  schemaVersion: 3,
  tasks: {
    query_daily_spend: {
      name: "query_daily_spend",
      description: "Query today's total GenAI spend",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { model }`,
      },
      position: { x: 0, y: 1 },
    },

    query_hourly_trend: {
      name: "query_hourly_trend",
      description: "Query hourly spend trend for burn rate",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `fetch spans, from: now()-6h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { hour = bin(start_time, 1h), model }
| sort hour asc`,
      },
      position: { x: 1, y: 1 },
    },

    evaluate_budget: {
      name: "evaluate_budget",
      description: "Calculate burn rate and budget ETA",
      action: "dynatrace.automations:run-javascript",
      input: {
        script: `
const BUDGET = 1000; // Daily budget in USD — configurable via trigger params
const daily = {{ result("query_daily_spend") }};
const hourly = {{ result("query_hourly_trend") }};

const PRICING = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
};

function estimateCost(model, inputTok, outputTok) {
  const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || '';
  const rate = PRICING[key] || { input: 2, output: 6 };
  return (inputTok * rate.input + outputTok * rate.output) / 1000000;
}

let totalSpend = 0;
(daily || []).forEach(r => {
  totalSpend += estimateCost(r.model || 'unknown', r.total_input || 0, r.total_output || 0);
});

// Hourly burn rate from last 6 hours
const hourlyBuckets = new Map();
(hourly || []).forEach(r => {
  const hour = r.hour;
  const cost = estimateCost(r.model || 'unknown', r.total_input || 0, r.total_output || 0);
  hourlyBuckets.set(hour, (hourlyBuckets.get(hour) || 0) + cost);
});
const hourlyValues = Array.from(hourlyBuckets.values());
const avgBurnRate = hourlyValues.length > 0 
  ? hourlyValues.reduce((s, v) => s + v, 0) / hourlyValues.length 
  : 0;

const remaining = BUDGET - totalSpend;
const hoursToExhaustion = remaining > 0 && avgBurnRate > 0 ? remaining / avgBurnRate : null;
const budgetUsedPct = (totalSpend / BUDGET) * 100;
const projectedDailySpend = avgBurnRate * 24;

return {
  budget: BUDGET,
  totalSpend: totalSpend.toFixed(2),
  budgetUsedPct: budgetUsedPct.toFixed(1),
  burnRatePerHour: avgBurnRate.toFixed(2),
  projectedDailySpend: projectedDailySpend.toFixed(2),
  hoursToExhaustion: hoursToExhaustion ? hoursToExhaustion.toFixed(1) : 'N/A',
  remaining: remaining.toFixed(2),
  shouldAlert: budgetUsedPct >= 80,
  shouldThrottle: hoursToExhaustion !== null && hoursToExhaustion < 1,
  severity: budgetUsedPct >= 95 ? 'CRITICAL' : budgetUsedPct >= 80 ? 'WARNING' : 'NORMAL'
};`,
      },
      position: { x: 0, y: 2 },
      predecessors: ["query_daily_spend", "query_hourly_trend"],
    },

    send_budget_alert: {
      name: "send_budget_alert",
      description: "Alert on budget approaching exhaustion",
      action: "dynatrace.automations:send-slack-message",
      input: {
        channel: "{{$.trigger.slackChannel || '#genai-finops'}}",
        message: `💰 *GenAI Budget Alert — {{ result("evaluate_budget").severity }}*

Budget usage is at *{{ result("evaluate_budget").budgetUsedPct }}%* (\${{ result("evaluate_budget").totalSpend }} / \${{ result("evaluate_budget").budget }}).

📊 *Burn Rate*
• Hourly: \${{ result("evaluate_budget").burnRatePerHour }}
• Projected daily: \${{ result("evaluate_budget").projectedDailySpend }}
• Remaining: \${{ result("evaluate_budget").remaining }}
• Hours to exhaustion: {{ result("evaluate_budget").hoursToExhaustion }}

{{ result("evaluate_budget").shouldThrottle ? "⚠️ *RECOMMENDATION: Throttle non-critical GenAI workloads immediately.*" : "📋 Review high-volume consumers to optimize spend." }}

_GenAI Control Center — Budget Guardian_`,
      },
      position: { x: 0, y: 3 },
      predecessors: ["evaluate_budget"],
      conditions: {
        custom: "{{ result('evaluate_budget').shouldAlert == true }}",
      },
    },
  },
  ownerType: "USER",
  isPrivate: false,
};

/**
 * Provider Cost Anomaly → Model Switch Workflow
 * 
 * When a specific provider's cost spikes, automatically switch
 * to a cheaper alternative model.
 */
export const COST_MODEL_SWITCH_WORKFLOW = {
  title: "GCC: Cost-Triggered Model Switch",
  description: "When a provider's cost velocity exceeds threshold, recommend or execute a switch to a cheaper model.",
  trigger: {
    schedule: {
      rule: "*/30 * * * *", // Every 30 minutes
      timezone: "UTC",
      isActive: true,
    },
  },
  schemaVersion: 3,
  tasks: {
    identify_expensive_services: {
      name: "identify_expensive_services",
      description: "Find services with highest cost velocity",
      action: "dynatrace.automations:execute-dql-query",
      input: {
        query: `fetch spans, from: now()-1h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0))
| fieldsAdd output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| summarize
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    request_count = count(),
    by: { service_name, provider, model }
| sort total_input + total_output desc
| limit 10`,
      },
      position: { x: 0, y: 1 },
    },

    recommend_switches: {
      name: "recommend_switches",
      description: "Use Dynatrace Intelligence to recommend model switches",
      action: "dynatrace.automations:dynatrace-intelligence",
      input: {
        prompt: `You are a GenAI cost optimization advisor.

Here are the top 10 most expensive GenAI service-model combinations in the last hour:
{{ result("identify_expensive_services") }}

For each service, recommend:
1. Whether a cheaper model could handle the workload (e.g., gpt-4 → gpt-4o-mini for simple tasks)
2. Estimated cost savings per day if switched
3. Risk level of the switch (LOW/MEDIUM/HIGH)

Only recommend switches where you're confident the cheaper model can handle the workload.
Format as a table.`,
      },
      position: { x: 0, y: 2 },
      predecessors: ["identify_expensive_services"],
    },
  },
  ownerType: "USER",
  isPrivate: false,
};
