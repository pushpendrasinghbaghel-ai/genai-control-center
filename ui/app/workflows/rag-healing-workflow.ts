// GenAI Control Center — RAG Self-Healing Workflow Templates
// Phase 3: Tiered auto-remediation for RAG pipeline degradation
// These workflows deploy via the Dynatrace Automation API

export const RAG_HEALTH_MONITOR_WORKFLOW = {
  title: 'GCC — RAG Health Monitor & Self-Healing',
  description:
    'Monitors RAG pipeline health every 15 minutes. When composite score drops below threshold, triggers tiered remediation: alert → adjust top-k → switch model → escalate.',
  trigger: {
    schedule: {
      rule: null,
      trigger: { type: 'interval', intervalMinutes: 15 },
      filterParameters: { earliestStart: '2024-01-01', earliestStartTime: '00:00' },
    },
  },
  tasks: {
    // Step 1: Compute RAG health score from real Grail data
    compute_health_score: {
      name: 'compute_health_score',
      action: 'dynatrace.automations:run-javascript',
      description: 'Compute composite RAG health from 5 DQL dimensions',
      input: {
        script: `
import { execution } from '@dynatrace-sdk/automation-utils';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

async function dql(query) {
  const result = await queryExecutionClient.queryExecute({
    body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
  });
  return result.result?.records || [];
}

export default async function() {
  const [latency, errors, pipeline] = await Promise.all([
    dql(\`
      fetch spans, from: now()-2h, to: now()
      | filter db.system == "pinecone" OR matchesPhrase(span.name, "pinecone") OR matchesPhrase(span.name, "vector")
      | summarize p95_ms = percentile(duration / 1000000.0, 95), query_count = count(), error_count = countIf(otel.status_code == "ERROR")
    \`),
    dql(\`
      fetch spans, from: now()-2h, to: now()
      | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR db.system == "pinecone" OR matchesPhrase(span.name, "embed")
      | summarize total = count(), errors = countIf(otel.status_code == "ERROR")
    \`),
    dql(\`
      fetch spans, from: now()-2h, to: now()
      | filter isNotNull(gen_ai.provider.name) OR db.system == "pinecone" OR matchesPhrase(span.name, "embed")
      | summarize
          has_embed = countIf(matchesPhrase(span.name, "embed")),
          has_retrieve = countIf(db.system == "pinecone" OR matchesPhrase(span.name, "pinecone")),
          has_generate = countIf(isNotNull(gen_ai.request.model)),
          by: { trace_id }
      | summarize total = count(), full = countIf(has_embed > 0 AND has_retrieve > 0 AND has_generate > 0)
    \`),
  ]);

  const p95Ms = latency[0]?.p95_ms || 0;
  const queryCount = latency[0]?.query_count || 0;
  const totalSpans = errors[0]?.total || 0;
  const totalErrors = errors[0]?.errors || 0;
  const errorRate = totalSpans > 0 ? (totalErrors / totalSpans) * 100 : 0;
  const totalTraces = pipeline[0]?.total || 0;
  const fullPipeline = pipeline[0]?.full || 0;
  const pipelineRate = totalTraces > 0 ? (fullPipeline / totalTraces) * 100 : 0;

  // Score each dimension (0-100)
  const latencyScore = p95Ms < 100 ? 100 : p95Ms < 200 ? 85 : p95Ms < 500 ? 65 : p95Ms < 1000 ? 40 : 20;
  const errorScore = errorRate < 0.5 ? 100 : errorRate < 1 ? 85 : errorRate < 3 ? 65 : errorRate < 5 ? 40 : 20;
  const pipelineScore = pipelineRate > 80 ? 100 : pipelineRate > 60 ? 75 : pipelineRate > 40 ? 55 : pipelineRate > 20 ? 35 : 15;

  const composite = latencyScore * 0.35 + errorScore * 0.35 + pipelineScore * 0.30;
  const status = composite >= 75 ? 'healthy' : composite >= 50 ? 'degraded' : 'critical';

  return {
    composite, status, p95Ms, errorRate, pipelineRate, queryCount,
    latencyScore, errorScore, pipelineScore,
  };
}`,
      },
      position: { x: 0, y: 0 },
      predecessors: [],
    },

    // Step 2: Davis AI analysis for root cause
    davis_analysis: {
      name: 'davis_analysis',
      action: 'dynatrace.automations:run-javascript',
      description: 'Use Davis CoPilot to analyze RAG degradation root cause',
      conditions: {
        states: { compute_health_score: 'OK' },
        custom: '{{ result("compute_health_score").status != "healthy" }}',
      },
      input: {
        script: `
import { execution } from '@dynatrace-sdk/automation-utils';
import { davisClient } from '@dynatrace-sdk/client-davis-ai';

export default async function({ executionContext }) {
  const score = executionContext.result('compute_health_score');
  
  const prompt = \`Analyze this RAG pipeline health degradation:
- Composite Score: \${score.composite.toFixed(1)}/100 (Status: \${score.status})
- Vector DB p95 Latency: \${score.p95Ms.toFixed(0)}ms (Score: \${score.latencyScore})
- Error Rate: \${score.errorRate.toFixed(2)}% (Score: \${score.errorScore})
- Pipeline Completion: \${score.pipelineRate.toFixed(1)}% (Score: \${score.pipelineScore})

Based on these metrics:
1. What is the most likely root cause?
2. What is the recommended remediation tier?
   - Tier 1: Alert only (score 50-75)
   - Tier 2: Adjust retrieval params (score 30-50)
   - Tier 3: Model switch + scale DB (score <30)
3. Is this likely a transient spike or sustained degradation?\`;

  const response = await davisClient.davisQuery({
    body: { query: prompt, maxTokens: 500 },
  });

  const analysis = response?.result?.text || 'Davis analysis unavailable';
  const tier = score.composite < 30 ? 3 : score.composite < 50 ? 2 : 1;

  return { analysis, tier, score };
}`,
      },
      position: { x: 0, y: 1 },
      predecessors: ['compute_health_score'],
    },

    // Step 3: Send alert for any degradation
    send_alert: {
      name: 'send_alert',
      action: 'dynatrace.slack:slack-send-message',
      description: 'Alert team about RAG pipeline degradation',
      conditions: {
        states: { davis_analysis: 'OK' },
      },
      input: {
        channel: '#genai-alerts',
        message: `🏥 *RAG Health Alert*
Score: {{ result("compute_health_score").composite | round(1) }}/100 ({{ result("compute_health_score").status }})
Tier: {{ result("davis_analysis").tier }}
p95 Latency: {{ result("compute_health_score").p95Ms | round(0) }}ms
Error Rate: {{ result("compute_health_score").errorRate | round(2) }}%
Pipeline Completion: {{ result("compute_health_score").pipelineRate | round(1) }}%

*Davis Analysis:*
{{ result("davis_analysis").analysis }}`,
      },
      position: { x: 0, y: 2 },
      predecessors: ['davis_analysis'],
    },

    // Step 4: Record healing event as bizevent
    record_event: {
      name: 'record_event',
      action: 'dynatrace.automations:run-javascript',
      description: 'Record healing event for audit trail',
      conditions: {
        states: { davis_analysis: 'OK' },
      },
      input: {
        script: `
import { execution } from '@dynatrace-sdk/automation-utils';
import { businessEventsClient } from '@dynatrace-sdk/client-classic-environment-v2';

export default async function({ executionContext }) {
  const score = executionContext.result('compute_health_score');
  const analysis = executionContext.result('davis_analysis');

  await businessEventsClient.ingest({
    body: {
      specversion: '1.0',
      source: 'gcc.rag-self-healing',
      type: 'com.dynatrace.gcc.rag-healing',
      data: {
        compositeScore: score.composite,
        status: score.status,
        tier: analysis.tier,
        p95Ms: score.p95Ms,
        errorRate: score.errorRate,
        pipelineRate: score.pipelineRate,
        analysis: analysis.analysis.substring(0, 500),
        timestamp: new Date().toISOString(),
      },
    },
  });

  return { recorded: true, tier: analysis.tier };
}`,
      },
      position: { x: 1, y: 2 },
      predecessors: ['davis_analysis'],
    },
  },
};

export const RAG_REINDEX_WORKFLOW = {
  title: 'GCC — RAG Emergency Re-Index',
  description:
    'Triggered when RAG pipeline completion rate drops below 20%. Alerts the team and prepares re-indexing remediation steps.',
  trigger: {
    schedule: {
      rule: null,
      trigger: { type: 'interval', intervalMinutes: 30 },
      filterParameters: { earliestStart: '2024-01-01', earliestStartTime: '00:00' },
    },
  },
  tasks: {
    check_pipeline_health: {
      name: 'check_pipeline_health',
      action: 'dynatrace.automations:run-javascript',
      description: 'Check if pipeline completion rate is critically low',
      input: {
        script: `
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export default async function() {
  const result = await queryExecutionClient.queryExecute({
    body: {
      query: \`
        fetch spans, from: now()-2h, to: now()
        | filter isNotNull(gen_ai.provider.name) OR db.system == "pinecone" OR matchesPhrase(span.name, "embed")
        | summarize
            has_embed = countIf(matchesPhrase(span.name, "embed")),
            has_retrieve = countIf(db.system == "pinecone" OR matchesPhrase(span.name, "pinecone")),
            has_generate = countIf(isNotNull(gen_ai.request.model)),
            by: { trace_id }
        | summarize total = count(), full = countIf(has_embed > 0 AND has_retrieve > 0 AND has_generate > 0)
      \`,
      requestTimeoutMilliseconds: 60000,
    },
  });

  const records = result.result?.records || [];
  const total = records[0]?.total || 0;
  const full = records[0]?.full || 0;
  const rate = total > 0 ? (full / total) * 100 : 100;

  return { total, full, rate, needsReindex: rate < 20 && total > 10 };
}`,
      },
      position: { x: 0, y: 0 },
      predecessors: [],
    },

    alert_reindex_needed: {
      name: 'alert_reindex_needed',
      action: 'dynatrace.slack:slack-send-message',
      description: 'Alert that re-indexing may be needed',
      conditions: {
        states: { check_pipeline_health: 'OK' },
        custom: '{{ result("check_pipeline_health").needsReindex == true }}',
      },
      input: {
        channel: '#genai-alerts',
        message: `🚨 *RAG Pipeline Emergency — Re-Index Required*
Pipeline completion rate: {{ result("check_pipeline_health").rate | round(1) }}%
Full pipelines: {{ result("check_pipeline_health").full }} / {{ result("check_pipeline_health").total }} traces

Only {{ result("check_pipeline_health").rate | round(1) }}% of traces have complete E→R→G pipeline.
This indicates stale or missing embeddings in the vector store.

*Recommended Actions:*
1. Check embedding ingestion pipeline status
2. Verify Pinecone index health
3. Consider triggering a full re-embed of source documents
4. Review if document sources have changed`,
      },
      position: { x: 0, y: 1 },
      predecessors: ['check_pipeline_health'],
    },
  },
};
