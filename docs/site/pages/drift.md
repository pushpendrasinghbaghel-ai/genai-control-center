---
layout: default
title: Model Drift Detection
parent: Analyze
---

# Model Drift Detection

**Route**: `/drift`  
**Persona**: ML Engineer, SRE

## Use Cases

- **Behavior change detection**: Detect when a model's performance deviates from its baseline
- **Version regression**: Catch degradation after provider model updates
- **Proactive alerting**: Identify drift before it impacts users

## Features

### Drift Overview
- Per-model drift scores (0-100 scale)
- Color-coded severity: Green (<30), Yellow (30-60), Red (>60)
- Trend sparklines showing drift over time

### 6 Drift Metrics
Each model is evaluated across:
1. **Latency drift** — Response time changes (40% weight)
2. **Output token drift** — Output length changes (30% weight)
3. **Input token drift** — Input pattern changes (30% weight)
4. **Error rate drift** — Reliability changes
5. **Token ratio drift** — Efficiency changes
6. **Cost drift** — Cost-per-request changes

### Baseline Comparison
- Automatic baseline calculation from historical data
- Relative change (%) from baseline for each metric
- Stacked bar visualization of drift components

### Drift Trend Charts
Real DQL-powered trend data showing:
- Per-timepoint drift scores computed from actual baseline metrics
- Historical baseline vs current values
- Per-model grouping with model filtering

### Detail Modal
Click any model to see:
- Full drift score breakdown by metric
- Trend charts with actual baseline vs current values
- Metric-specific drift progression over time

## Data Sources

- `fetch spans | makeTimeseries` — Hourly metric aggregation
- Drift scores computed from actual DQL data, not simulated
- Baseline derived from first 25% of the time range
