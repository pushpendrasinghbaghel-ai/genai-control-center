---
layout: default
title: Prompt Governance
parent: Govern
---

# Prompt Governance

**Route**: `/prompt-governance`  
**Persona**: Security Officer, ML Engineer, Compliance

## Use Cases

- **PII detection**: Identify prompts containing personal identifiable information
- **Injection risk**: Detect prompt injection attacks ("ignore previous instructions")
- **Cost optimization**: Find expensive prompts and repetitive patterns for caching
- **Compliance audit**: Full prompt I/O audit trail with trace correlation
- **Davis AI scoring**: Semantic risk analysis beyond pattern matching

## Features

### Governance KPIs
Summary cards showing:
- Total prompts analyzed
- PII detections (regex: email, phone, SSN, credit card)
- Injection risk patterns
- Expensive prompts (>$0.10 estimated)
- Cache candidates (15+ identical prompts)
- Hallucination flags

### Issue Type Filters
One-click filtering by:
- All | PII | Injection | Expensive | Repetitive | Hallucination | Error

### Davis AI Scoring
- Batch semantic analysis of up to 50 prompts
- Nuanced risk detection beyond regex patterns
- Progress indicator during scoring
- Re-score capability for updated analysis

### Prompt Pattern Analysis
Top repeated patterns ranked by:
- Call count
- Token efficiency (output/total %)
- Average latency
- Estimated cache savings
- PII/Injection flags per pattern

### Prompt I/O Audit Trail *(NEW)*
Trace-correlated prompt inputs and completions for compliance:

**Summary KPIs**:
- Total traced events
- Unique providers and models
- Average input/output tokens

**Audit Entries**:
- Provider, model, and service identification
- Full prompt and completion text (first 500 chars)
- Token counts (input/output)
- Latency measurement
- Finish reason
- One-click trace navigation to Distributed Tracing

### Error Spans Section
- GenAI error span listing with error type, latency, trace ID
- Prompt content context for error spans
- Direct trace linking

## Detection Methods

| Method | Technique | Coverage |
|--------|-----------|----------|
| **PII** | Regex patterns | Email, phone, SSN, credit cards |
| **Injection** | Pattern matching | "ignore previous", "disregard", "you are now" |
| **Expensive** | Token cost calc | >$0.10 estimated cost based on rate cards |
| **Repetitive** | DQL aggregation | 15+ identical prompts |
| **Davis AI** | Semantic analysis | Nuanced risks beyond patterns |

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.prompt.0.content)` — Prompt content
- `gen_ai.completion.0.content` — Completion text for audit trail
- Pattern analysis runs client-side on fetched span data
- Davis CoPilot for semantic scoring
