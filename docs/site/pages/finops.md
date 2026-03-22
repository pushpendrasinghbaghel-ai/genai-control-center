---
layout: default
title: FinOps
parent: Govern
---

# FinOps — AI Cost Management

**Route**: `/finops`  
**Persona**: FinOps Analyst, Platform Engineer

## Use Cases

- **Budget tracking**: Monitor daily/weekly/monthly AI spend against budgets
- **Cost forecasting**: Predict future costs based on current trends
- **Provider optimization**: Compare cost-per-request across providers
- **Chargeback**: Attribute AI costs to teams and business units

## Features

### Hero Budget Card
- Daily budget utilization (%)
- Current spend vs budget with progress bar
- Burn rate indicator (on track / overspend risk)

### Cost Forecasting
Davis AI-powered forecasts for:
- 7-day projection
- 14-day projection
- 30-day projection
- Confidence intervals with upper/lower bounds

### Cost by Provider
- Stacked bar chart showing spend per provider
- Trend over time
- Provider switching recommendations

### Token Economics
- Embedding vs completion cost split
- Input vs output token cost comparison
- Cost-per-1K-tokens by model

### Chargeback
- Cost attribution by `dt.entity.service` tags
- Team-level cost rollups
- Exportable cost reports

### Cost Guardrails
- Configurable daily budget thresholds
- Warning (80%) and critical (95%) alerts
- Velocity monitoring (spend acceleration detection)
- Auto-throttle and model-switch options (configurable)

## Data Sources

- `fetch spans | summarize sum(gen_ai.usage.input_tokens * rate)` — Cost calculation
- Rate card configuration stored in Dynatrace Document Service
- Davis forecast analyzer for projections
