---
layout: default
title: Policies & Compliance
parent: Govern
---

# Policies & Compliance (Governance)

**Route**: `/governance`  
**Persona**: Security Officer, Platform Engineer

## Use Cases

- **Policy enforcement**: Monitor compliance with AI governance policies
- **Data residency**: Track which providers process data in which regions
- **Rate limiting**: Detect services exceeding defined request thresholds
- **Risk assessment**: Provider-level risk scoring and compliance status

## Features

### Policy Dashboard
Active governance policies with real-time status:
- **Data Residency**: Derived from actual provider data with specific provider counts
- **Rate Limiting**: Threshold monitoring per service
- **Model Approval**: Ensure only approved models are in use

### Provider Risk Matrix
- Per-provider compliance scoring
- Regional data processing indicators
- Challenge awareness for enterprise governance

### Compliance Trends
- Policy compliance over time
- Violation trends and patterns
- Remediation tracking

## Data Sources

- `fetch spans | summarize by: { gen_ai.system }` — Provider analysis
- Provider profile configuration for compliance baseline
- Real-time span data for policy evaluation
