---
layout: default
title: Provider Failover
parent: Act
---

# Provider Status & Failover

**Route**: `/provider-status`  
**Persona**: SRE, Platform Engineer

## Use Cases

- **Failover readiness**: Assess readiness to switch between AI providers
- **Provider health index**: Composite health scoring per provider
- **Outage planning**: Pre-plan failover strategies before incidents occur

## Features

### Provider Health Index
Composite score (0-100) per provider based on:
- Error rate
- Latency percentiles
- Request volume stability
- Response quality indicators

### Failover Readiness
- Alternative provider mapping
- Model equivalency matrix (e.g., GPT-4o ↔ Claude 3.5 Sonnet)
- Estimated impact of switching
- One-click failover workflow

### Provider Comparison
Side-by-side provider metrics:
- Latency comparison
- Cost comparison
- Quality comparison
- Availability history

## Data Sources

- `fetch spans | summarize by: { gen_ai.system }` — Provider metrics
- Historical availability calculations
- Failover config stored in Dynatrace Document Service
