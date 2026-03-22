---
layout: default
title: Infrastructure
parent: Observe
---

# Infrastructure

**Route**: `/infrastructure`  
**Persona**: SRE, Platform Engineer

## Use Cases

- **Provider availability**: Monitor the health of AI provider connections
- **Service configuration**: Snapshot of service configs, model versions, and deployment state
- **Model version history**: Track which model versions are in use and when they changed

## Features

### Provider Health
- Per-provider availability percentage
- Latency trends
- Error rate by provider
- Geographic distribution (when available)

### Service Configuration Snapshot
- Current model versions in use per service
- Rate limits and quotas
- Configuration change detection

### Model Version History
- Version timeline per model
- Performance comparison across versions
- Automatic drift detection on version changes

### Davis Problems
- Infrastructure-related Davis problems
- AI service impact assessment
- Correlation with provider outages

## Data Sources

- `fetch spans | summarize by: { gen_ai.system }` — Provider aggregation
- `fetch events | filter event.kind == "DAVIS_PROBLEM"` — Infrastructure problems
- Deployment and version tracking from span attributes
