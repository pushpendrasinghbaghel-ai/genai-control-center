---
layout: default
title: Response Analytics
parent: Analyze
---

# Response Analytics

**Route**: `/analytics`  
**Persona**: ML Engineer, FinOps Analyst

## Use Cases

- **Token efficiency analysis**: Identify services with poor input-to-output token ratios
- **Output consistency**: Find models with high output variance indicating unpredictable behavior
- **Streaming vs Batch comparison**: Compare latency and throughput between streaming and batch requests
- **Quality trend tracking**: Monitor response quality metrics over time

## Features

### Tabs

#### Overview
- Token efficiency KPIs (avg input/output, ratio)
- Top models by request volume
- Cost-per-request ranking

#### Services
- Per-service breakdown of token usage
- Output variance scoring
- Low-output detection (responses with <10 tokens)

#### Inefficient
- Services with worst token ratios
- High-cost, low-output patterns
- Optimization recommendations

#### Quality
- Response quality trends over time
- Finish reason distribution
- Error correlation analysis

#### Streaming vs Batch *(NEW)*
Real-time comparison of streaming and batch AI requests:

**Summary KPIs**:
- Streaming request count and percentage
- Batch request count and percentage
- Average latency comparison (streaming vs batch)

**Per-Model Breakdown Table**:
- Mode (Streaming/Batch badge)
- Provider and model
- Request count
- Average latency & P95 latency
- Average output tokens
- Error rate

Uses the `llm.is_streaming` OpenTelemetry attribute to classify requests.

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.request.model)` — All gen_ai spans
- `llm.is_streaming` attribute for streaming classification
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` — Token metrics
