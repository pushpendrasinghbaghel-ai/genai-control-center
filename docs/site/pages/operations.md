---
layout: default
title: Operations
parent: Act
---

# Operations

**Route**: `/operations`  
**Persona**: SRE, Platform Engineer

## Use Cases

- **Incident response**: View and manage Davis-detected problems affecting AI services
- **Remediation automation**: One-click workflow execution for common fixes
- **Runbook management**: Access and trigger pre-built remediation workflows

## Features

### GenAI Problems Table
Live Davis problems filtered to AI-related services:
- Problem ID (linked to Dynatrace problem view)
- Title and severity
- Affected entities
- Root cause entity
- Duration and status (Active/Closed)

### Remediation Workflows
Pre-built automation workflows:
- Model failover (switch to backup provider)
- Rate limit adjustment
- Cache invalidation
- Alert escalation (Slack, PagerDuty)
- Custom runbook execution

### Workflow History
Track executed remediations:
- Execution status and duration
- Trigger source (manual / auto)
- Impact assessment

## Data Sources

- `fetch events | filter event.kind == "DAVIS_PROBLEM"` — Live problems
- `automation:workflows` SDK — Workflow management
- Intent links to native Dynatrace problem view
