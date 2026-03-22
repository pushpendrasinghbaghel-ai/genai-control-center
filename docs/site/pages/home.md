---
layout: default
title: Home Dashboard
parent: Observe
---

# Home Dashboard

**Route**: `/`  
**Persona**: All — Executive overview for quick status assessment

## Use Cases

- **Morning standup**: Glance at overall AI service health, error rates, and cost trends
- **Executive reporting**: Share high-level KPIs with stakeholders
- **Triage entry point**: Identify which domain needs attention and navigate to specialized pages

## Features

### KPI Cards
Real-time summary cards showing:
- Total AI services discovered
- Active providers and models
- Overall request volume
- Error rate across all services
- Total token consumption
- Estimated daily cost

### Trend Charts
8 time-series charts (2×2 grid) showing 24h trends for:
- Request volume by provider
- Latency percentiles (P50, P95, P99)
- Token usage (input vs output)
- Error rate by model
- Cost by provider
- Output token variance

### Quick Navigation
One-click access to all specialized pages organized by the Observe → Analyze → Govern → Act pattern.

## Data Sources

All data comes from real DQL queries against Grail:
- `fetch spans | filter isNotNull(gen_ai.request.model)` — Service discovery
- Time-series aggregations with `makeTimeseries` — Trend charts
- `summarize count(), avg(), percentile()` — KPI calculations
