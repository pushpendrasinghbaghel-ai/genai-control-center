---
layout: default
title: MLOps
parent: Observe
---

# MLOps

**Route**: `/mlops`  
**Persona**: ML Engineer, Platform Engineer

## Use Cases

- **Model lifecycle management**: Track model versions, deployments, and performance over time
- **AI SLO monitoring**: Define and track service level objectives for AI services
- **Cost attribution**: Break down AI costs by team, project, or business unit
- **Model comparison**: Side-by-side performance comparison of models

## Features

### Model Registry
- All discovered models with version information
- Deployment status and health indicators
- Request volume and error rate per model

### AI SLOs
- Configurable SLO targets (latency, error rate, throughput)
- Burn rate indicators
- Compliance tracking over time

### Cost Attribution
- Cost breakdown by team/service tag
- Model-level cost tracking
- Trend visualization for budget forecasting

### Model Comparison
- Side-by-side latency, throughput, and quality metrics
- Token efficiency comparison
- Cost-per-request analysis

## Data Sources

- `fetch spans | summarize by: { gen_ai.request.model }` — Model inventory
- `makeTimeseries` aggregations for trend data
