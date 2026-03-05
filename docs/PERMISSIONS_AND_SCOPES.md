# GenAI Control Center — Permissions & Scopes Reference

> **Last Updated**: Auto-generated during evolution implementation  
> **App ID**: `com.dynatrace.genai.controlcenter`

---

## Current Scopes (app.config.json)

These scopes are already configured and active:

| Scope | Purpose | Used By |
|---|---|---|
| `storage:logs:read` | Read logs for AI service analysis | dql-queries.ts |
| `storage:buckets:read` | Read data buckets | dql-queries.ts |
| `storage:spans:read` | Read gen_ai spans for service discovery | All hooks |
| `storage:metrics:read` | Read metrics for SegmentSelector | FilterBar |
| `storage:events:read` | Read events and Davis problems | useWorkflows.ts |
| `storage:filter-segments:read` | Read filter segments | FilterBar |
| `storage:filter-segments:write` | Write filter segments | FilterBar |
| `storage:entities:read` | Read entities for filtering | useDQLQueries.ts |
| `automation:workflows:read` | Read workflow definitions | useWorkflows.ts |
| `automation:workflows:run` | Execute remediation workflows | Operations page |
| `automation:workflows:write` | Create/update workflows | agentic-templates.ts |
| `davis-copilot:nl2dql:execute` | NL to DQL conversion | useDavisAI.ts |
| `davis-copilot:dql2nl:execute` | DQL to NL explanation | useDavisAI.ts |
| `davis-copilot:conversations:execute` | Dynatrace Assist conversations | Intelligence page |
| `davis:analyzers:execute` | Execute Davis analyzers (Forecast, Anomaly, Novelty) | useModelDrift.ts |
| `davis:analyzers:read` | List available Davis analyzers | davisAnalyzers.ts |

---

## New Scopes Required for Evolution

### Phase 1: Autonomous Cost Guardrails

| Scope | Purpose | Why Needed |
|---|---|---|
| `storage:bizevents:read` | Read business events for cost tracking | Cost velocity events stored as bizevents |
| `storage:bizevents:write` | Write guardrail events as business events | Record guardrail actions in Grail |
| `settings:objects:read` | Read anomaly detection settings | Cost velocity baseline thresholds |
| `settings:objects:write` | Write anomaly detection settings | Configure cost velocity thresholds |

### Phase 2: Security Incident Auto-Response

| Scope | Purpose | Why Needed |
|---|---|---|
| `environment-api:problems:read` | Read Davis problems | Correlate security events with problems |
| `environment-api:problems:write` | Create Dynatrace problems | Auto-create problems for security incidents |
| `storage:bizevents:write` | Write security audit events | Compliance audit trail in Grail |
| `app-engine:apps:run` | Run AppEngine functions | Trigger circuit-breaker actions |

### Phase 3: Self-Healing RAG Pipelines

| Scope | Purpose | Why Needed |
|---|---|---|
| `automation:workflows:write` | Create healing workflows | Deploy RAG remediation workflows |
| `automation:workflows:run` | Execute healing workflows | Run auto-remediation actions |
| (No new scopes - uses existing spans + workflows) | | |

### Phase 4: Agent Orchestration Advisor

| Scope | Purpose | Why Needed |
|---|---|---|
| (No new scopes - uses existing spans + Davis Intelligence) | | |

### Phase 5: Cross-Provider Failover

| Scope | Purpose | Why Needed |
|---|---|---|
| `settings:objects:read` | Read provider failover rules | Load failover configuration |
| `settings:objects:write` | Write provider failover rules | Save failover rules |
| `automation:workflows:write` | Create failover workflows | Deploy failover automation |
| `automation:workflows:run` | Execute failover workflows | Trigger failover actions |

---

## Recommended Final Scope List

After all phases are implemented, `app.config.json` should contain:

```json
{
  "scopes": [
    { "name": "storage:logs:read", "comment": "Read logs for AI service analysis" },
    { "name": "storage:buckets:read", "comment": "Read data buckets" },
    { "name": "storage:spans:read", "comment": "Read gen_ai spans for service discovery" },
    { "name": "storage:metrics:read", "comment": "Read metrics for SegmentSelector" },
    { "name": "storage:events:read", "comment": "Read events and Davis problems" },
    { "name": "storage:bizevents:read", "comment": "Read business events for cost guardrails and audit trails" },
    { "name": "storage:bizevents:write", "comment": "Write guardrail events and security audit records to Grail" },
    { "name": "storage:filter-segments:read", "comment": "Read filter segments for SegmentSelector" },
    { "name": "storage:filter-segments:write", "comment": "Write filter segments for SegmentSelector" },
    { "name": "storage:entities:read", "comment": "Read entities for filtering and topology" },
    { "name": "automation:workflows:read", "comment": "Read workflow definitions" },
    { "name": "automation:workflows:run", "comment": "Execute remediation, guardrail, and failover workflows" },
    { "name": "automation:workflows:write", "comment": "Create/update agentic workflows for all phases" },
    { "name": "davis-copilot:nl2dql:execute", "comment": "NL-to-DQL conversion via Dynatrace Intelligence" },
    { "name": "davis-copilot:dql2nl:execute", "comment": "DQL-to-NL explanation" },
    { "name": "davis-copilot:conversations:execute", "comment": "Dynatrace Assist multi-step reasoning conversations" },
    { "name": "davis:analyzers:execute", "comment": "Execute Davis analyzers: Forecast, Anomaly, Novelty for all phases" },
    { "name": "davis:analyzers:read", "comment": "List and inspect available Davis analyzers" },
    { "name": "settings:objects:read", "comment": "Read anomaly thresholds and failover rules" },
    { "name": "settings:objects:write", "comment": "Configure anomaly thresholds and failover rules" },
    { "name": "environment-api:problems:read", "comment": "Read Davis problems for security correlation" },
    { "name": "environment-api:problems:write", "comment": "Create problems for critical security incidents" },
    { "name": "app-engine:apps:run", "comment": "Execute AppEngine functions for circuit-breaker actions" }
  ]
}
```

---

## API Token Permissions (for MCP Server)

The standalone MCP server (`mcp-server/`) requires a Dynatrace API token with these scopes:

| Token Scope | API Name | Purpose |
|---|---|---|
| `storage:spans:read` | Grail DQL | Query gen_ai.* spans |
| `storage:logs:read` | Grail DQL | Query application logs |
| `storage:events:read` | Grail DQL | Query Davis problems/events |
| `storage:bizevents:read` | Grail DQL | Query business events |
| `storage:entities:read` | Grail DQL | Query entity data |
| `storage:metrics:read` | Grail DQL | Query metrics |
| `storage:buckets:read` | Grail DQL | Access data buckets |
| `davis:analyzers:execute` | Davis AI | Run analyzers |
| `davis:analyzers:read` | Davis AI | List analyzers |

### Token Creation

```
Dynatrace UI → Settings → Access Tokens → Generate new token
Name: "GCC MCP Server"
Scopes: (select all from table above)
```

### Environment Variables

```bash
# For MCP Server
DYNATRACE_URL=https://<your-env>.apps.dynatrace.com
DYNATRACE_API_TOKEN=dt0c01.XXXXXXXX.YYYYYYYY
```

---

## Network & Connectivity Requirements

| Endpoint | Protocol | Purpose |
|---|---|---|
| `https://<env>.apps.dynatrace.com` | HTTPS | Dynatrace platform API |
| `https://<env>.apps.dynatrace.com/platform/classic/api/v2/dql/query:execute` | HTTPS | DQL query execution |
| `https://<env>.apps.dynatrace.com/platform/classic/api/v2/davis/` | HTTPS | Davis AI analyzers |
| `https://<env>.apps.dynatrace.com/api/v2/problems` | HTTPS | Problem management |
| `https://<env>.apps.dynatrace.com/api/v2/settings/objects` | HTTPS | Settings/config management |
| Slack API | HTTPS | Alert notifications (optional) |
| ServiceNow API | HTTPS | Incident creation (optional) |

---

## Security Considerations

1. **Principle of Least Privilege**: Only add new scopes when the corresponding phase is implemented
2. **Token Rotation**: MCP server API tokens should be rotated every 90 days
3. **Audit Logging**: All workflow executions are logged in Grail
4. **Circuit-Breaker Safety**: Security auto-response circuit-breakers require `requiresConfirmation: true` by default
5. **Rollback**: All failover workflows include automatic rollback conditions
