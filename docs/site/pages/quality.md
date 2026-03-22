---
layout: default
title: AI Quality
parent: Observe
---

# AI Quality Dashboard

**Route**: `/quality`  
**Persona**: ML Engineer, SRE

## Use Cases

- **Hallucination scoring**: Track response quality indicators across models
- **Quality dimensions**: Multi-dimensional quality assessment
- **Model comparison**: Compare quality metrics across providers and models

## Features

### Quality Score
Composite quality score based on:
- Output consistency (variance analysis)
- Completion rate (finish_reason distribution)
- Error rate correlation
- Token efficiency ratio

### Quality Trends
Time-series visualization of quality metrics over configurable time ranges.

### Model Quality Ranking
Per-model quality scores with drill-down to individual metrics.

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.response.finish_reason)` — Quality signals
- Output token variance analysis for consistency scoring
