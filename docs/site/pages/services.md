---
layout: default
title: AI Services
parent: Observe
---

# AI Services (Health Dashboard)

**Route**: `/services`  
**Persona**: SRE, Platform Engineer

## Use Cases

- **Service discovery**: Automatically find all AI-instrumented services without manual configuration
- **Health monitoring**: Track error rates, latency, and throughput per service
- **Capacity planning**: Understand which services consume the most tokens

## Features

### Auto-Discovery
Queries all `gen_ai.*` spans to build a live inventory of:
- Service names
- Providers (OpenAI, Anthropic, Azure, Google, AWS Bedrock)
- Models in use
- Request volumes and error rates

### Service Health Table
Interactive DataTable with sortable columns:
- Service name (linked to Dynatrace entity)
- Provider and model
- Request count
- Average latency (ms)
- P95 latency
- Error rate (%)
- Total tokens consumed
- Estimated cost

### Service Detail View
Click any service to see:
- Latency and throughput time-series
- Token distribution breakdown
- Error analysis by type
- Model comparison within the service

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.request.model)` — Core discovery
- `summarize by: { dt.entity.service, gen_ai.provider.name, gen_ai.request.model }` — Aggregation
