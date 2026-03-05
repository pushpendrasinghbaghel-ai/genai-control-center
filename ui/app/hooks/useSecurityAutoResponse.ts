// GenAI Control Center — Security Auto-Response Hook
// Phase 2: Streaming prompt analysis, Davis severity scoring, incident auto-response

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'pii_leak' | 'prompt_injection' | 'jailbreak' | 'hallucination' | 'data_exfiltration' | 'policy_violation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  serviceName: string;
  traceId: string;
  prompt: string;
  response: string;
  model: string;
  provider: string;
  detectionMethod: string;
  status: 'new' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';
}

export interface SecurityIncident {
  id: string;
  eventIds: string[];
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'mitigated' | 'closed';
  createdAt: number;
  updatedAt: number;
  serviceName: string;
  affectedTraces: number;
  autoResponseActions: AutoResponseAction[];
  auditTrail: AuditEntry[];
}

export interface AutoResponseAction {
  id: string;
  type: 'alert' | 'circuit_breaker' | 'rate_limit' | 'quarantine' | 'forensic_capture';
  status: 'pending' | 'executed' | 'failed' | 'rolled_back';
  timestamp: number;
  details: string;
}

export interface AuditEntry {
  timestamp: number;
  action: string;
  actor: 'system' | 'user' | 'workflow';
  details: string;
}

export interface SecuritySummary {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  openIncidents: number;
  mitigatedIncidents: number;
  autoResponsesTriggered: number;
  piiLeakCount: number;
  injectionCount: number;
  avgResponseTimeMs: number;
  affectedServices: number;
}

export interface PromptRiskScore {
  serviceName: string;
  totalPrompts: number;
  riskyPrompts: number;
  riskRate: number;
  topRiskType: string;
  avgRiskScore: number;
}

// ============================================
// Detection Patterns
// ============================================

const PII_PATTERNS = [
  'ssn', 'social security', 'credit card', 'passport', 'driver.?license',
  '\\b\\d{3}-\\d{2}-\\d{4}\\b',  // SSN format
  '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b', // CC format
  'date of birth', 'bank account', 'routing number',
];

const INJECTION_PATTERNS = [
  'ignore previous instructions', 'ignore all prior', 'disregard above',
  'system prompt', 'you are now', 'act as', 'pretend to be',
  'jailbreak', 'DAN mode', 'bypass safety', 'override restrictions',
  'reveal your instructions', 'show me your prompt',
];

// ============================================
// DQL Queries
// ============================================

/** Recent prompts with potential security issues */
const SECURITY_EVENTS_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter isNotNull(gen_ai.prompt.0.content)
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fieldsAdd prompt_text = toString(gen_ai.prompt.0.content)
| fieldsAdd response_text = coalesce(toString(gen_ai.response.0.content), toString(gen_ai.completion.0.content), "")
| filter prompt_text != ""
| fields service_name, provider, model, prompt_text, response_text, trace_id, start_time, duration
| sort start_time desc
| limit 500
`;

/** Security event summary by service */
const SECURITY_SUMMARY_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd has_prompt = isNotNull(gen_ai.prompt.0.content)
| summarize
    total_requests = count(),
    requests_with_prompts = countIf(has_prompt),
    error_count = countIf(span.status_code == "error"),
    avg_duration_ms = avg(duration / 1000000),
    by: { service_name, provider }
| sort total_requests desc
`;

/** Prompt governance alerts from existing governance scoring */
const GOVERNANCE_ALERTS_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR (duration / 1000000) > 30000
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd model = coalesce(gen_ai.request.model, "unknown")
| fields service_name, provider, model, trace_id, span.status_code, span.status_message, duration, start_time
| sort start_time desc
| limit 100
`;

// ============================================
// Safe DQL executor
// ============================================

async function safeDql(query: string): Promise<any[]> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
    });
    return response.result?.records || [];
  } catch (err) {
    console.warn('[GCC:SecurityAutoResponse] DQL error:', err);
    return [];
  }
}

// ============================================
// Client-side prompt risk analysis
// ============================================

function analyzePromptRisk(prompt: string): { type: SecurityEvent['type']; severity: SecurityEvent['severity']; method: string } | null {
  const lower = prompt.toLowerCase();

  // Check for PII
  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lower)) {
      return { type: 'pii_leak', severity: 'high', method: `PII pattern match: ${pattern}` };
    }
  }

  // Check for injection
  for (const pattern of INJECTION_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lower)) {
      const isCritical = ['jailbreak', 'DAN mode', 'bypass safety', 'override restrictions'].some(p => lower.includes(p.toLowerCase()));
      return { type: 'prompt_injection', severity: isCritical ? 'critical' : 'high', method: `Injection pattern: ${pattern}` };
    }
  }

  return null;
}

// ============================================
// Hook: useSecurityAutoResponse
// ============================================

export function useSecurityAutoResponse() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [riskScores, setRiskScores] = useState<PromptRiskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [promptRecords, summaryRecords, alertRecords] = await Promise.all([
        safeDql(SECURITY_EVENTS_QUERY),
        safeDql(SECURITY_SUMMARY_QUERY),
        safeDql(GOVERNANCE_ALERTS_QUERY),
      ]);

      // --- Analyze prompts for security risks ---
      const secEvents: SecurityEvent[] = [];
      const serviceRiskMap = new Map<string, { total: number; risky: number; topType: string; riskSum: number }>();

      promptRecords.forEach((r: any, idx: number) => {
        const prompt = String(r.prompt_text || '');
        const service = String(r.service_name || 'Unknown');
        const risk = analyzePromptRisk(prompt);

        // Track per-service risk
        const svcRisk = serviceRiskMap.get(service) || { total: 0, risky: 0, topType: '', riskSum: 0 };
        svcRisk.total++;

        if (risk) {
          svcRisk.risky++;
          svcRisk.topType = risk.type;
          svcRisk.riskSum += risk.severity === 'critical' ? 1 : risk.severity === 'high' ? 0.75 : risk.severity === 'medium' ? 0.5 : 0.25;

          secEvents.push({
            id: `se-${idx}-${Date.now()}`,
            timestamp: new Date(r.start_time).getTime(),
            type: risk.type,
            severity: risk.severity,
            serviceName: service,
            traceId: String(r.trace_id || ''),
            prompt: prompt.substring(0, 200),
            response: String(r.response_text || '').substring(0, 200),
            model: String(r.model || 'unknown'),
            provider: String(r.provider || 'Unknown'),
            detectionMethod: risk.method,
            status: 'new',
          });
        }
        serviceRiskMap.set(service, svcRisk);
      });

      // Add error-based alerts as security events
      alertRecords.forEach((r: any, idx: number) => {
        if (r['span.status_code'] === 'error') {
          secEvents.push({
            id: `ae-${idx}-${Date.now()}`,
            timestamp: new Date(r.start_time).getTime(),
            type: 'policy_violation',
            severity: 'medium',
            serviceName: String(r.service_name || 'Unknown'),
            traceId: String(r.trace_id || ''),
            prompt: '',
            response: String(r['span.status_message'] || 'Error encountered'),
            model: String(r.model || 'unknown'),
            provider: String(r.provider || 'Unknown'),
            detectionMethod: 'Error status detection',
            status: 'new',
          });
        }
      });

      // --- Build risk scores ---
      const newRiskScores: PromptRiskScore[] = [];
      serviceRiskMap.forEach((v, svc) => {
        newRiskScores.push({
          serviceName: svc,
          totalPrompts: v.total,
          riskyPrompts: v.risky,
          riskRate: v.total > 0 ? (v.risky / v.total) * 100 : 0,
          topRiskType: v.topType || 'none',
          avgRiskScore: v.total > 0 ? v.riskSum / v.total : 0,
        });
      });

      // --- Build incidents from clustered events ---
      const incidentMap = new Map<string, SecurityEvent[]>();
      secEvents.forEach(e => {
        const key = `${e.serviceName}-${e.type}`;
        const group = incidentMap.get(key) || [];
        group.push(e);
        incidentMap.set(key, group);
      });

      const newIncidents: SecurityIncident[] = [];
      incidentMap.forEach((evts, key) => {
        if (evts.length === 0) return;
        const worstSeverity = evts.some(e => e.severity === 'critical') ? 'critical'
          : evts.some(e => e.severity === 'high') ? 'high'
          : evts.some(e => e.severity === 'medium') ? 'medium' : 'low';

        newIncidents.push({
          id: `inc-${key}-${Date.now()}`,
          eventIds: evts.map(e => e.id),
          title: `${evts[0].type.replace(/_/g, ' ')} detected on ${evts[0].serviceName}`,
          severity: worstSeverity,
          status: worstSeverity === 'critical' ? 'investigating' : 'open',
          createdAt: Math.min(...evts.map(e => e.timestamp)),
          updatedAt: Date.now(),
          serviceName: evts[0].serviceName,
          affectedTraces: new Set(evts.map(e => e.traceId)).size,
          autoResponseActions: worstSeverity === 'critical' ? [{
            id: `ar-${Date.now()}`,
            type: 'alert',
            status: 'executed',
            timestamp: Date.now(),
            details: `Auto-alert triggered for ${evts.length} ${evts[0].type} events`,
          }] : [],
          auditTrail: [{
            timestamp: Date.now(),
            action: 'Incident created by auto-detection',
            actor: 'system',
            details: `${evts.length} security events clustered into incident`,
          }],
        });
      });

      // --- Build summary ---
      const newSummary: SecuritySummary = {
        totalEvents: secEvents.length,
        criticalEvents: secEvents.filter(e => e.severity === 'critical').length,
        highEvents: secEvents.filter(e => e.severity === 'high').length,
        mediumEvents: secEvents.filter(e => e.severity === 'medium').length,
        lowEvents: secEvents.filter(e => e.severity === 'low').length,
        openIncidents: newIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
        mitigatedIncidents: newIncidents.filter(i => i.status === 'mitigated').length,
        autoResponsesTriggered: newIncidents.reduce((s, i) => s + i.autoResponseActions.length, 0),
        piiLeakCount: secEvents.filter(e => e.type === 'pii_leak').length,
        injectionCount: secEvents.filter(e => e.type === 'prompt_injection').length,
        avgResponseTimeMs: 0,
        affectedServices: new Set(secEvents.map(e => e.serviceName)).size,
      };

      setEvents(secEvents.sort((a, b) => b.timestamp - a.timestamp));
      setIncidents(newIncidents.sort((a, b) => {
        const sev = { critical: 0, high: 1, medium: 2, low: 3 };
        return sev[a.severity] - sev[b.severity];
      }));
      setSummary(newSummary);
      setRiskScores(newRiskScores.sort((a, b) => b.riskRate - a.riskRate));
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-response action: Mark event as mitigated
  const mitigateEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'mitigated' as const } : e));
  }, []);

  // Auto-response action: Mark incident status
  const updateIncidentStatus = useCallback((incidentId: string, status: SecurityIncident['status']) => {
    setIncidents(prev => prev.map(i => i.id === incidentId ? {
      ...i,
      status,
      updatedAt: Date.now(),
      auditTrail: [...i.auditTrail, {
        timestamp: Date.now(),
        action: `Status changed to ${status}`,
        actor: 'user' as const,
        details: `Manual status update`,
      }],
    } : i));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return {
    events,
    incidents,
    summary,
    riskScores,
    loading,
    error,
    refetch,
    mitigateEvent,
    updateIncidentStatus,
  };
}
