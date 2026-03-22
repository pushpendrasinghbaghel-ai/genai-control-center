---
layout: default
title: Agent Tools
parent: Observe
---

# Agent Tools

**Route**: `/agents`  
**Persona**: ML Engineer, Platform Engineer

## Use Cases

- **Agent observability**: Monitor AI agent workflows including tool calls, retries, and handoffs
- **Tool reliability**: Identify which tools fail most often and impact agent performance
- **Loop detection**: Detect agents stuck in retry loops consuming excessive resources

## Features

### Agent Summary KPIs
- Total agent sessions
- Active agents
- Tool call count
- Average tools per session
- Retry rate with threshold indicators

### Active Agents Table
Interactive table showing per-agent metrics:
- Agent name and session count
- LLM calls vs tool calls (with split bar visualization)
- Average duration
- Error rate
- Last active timestamp

### Tool Call Analysis
- Tool frequency ranking
- Tool reliability scores
- Error patterns by tool type

### Retry & Loop Detection
- Retry rate thresholds: Green (<5%), Yellow (5-15%), Red (>15%)
- Loop detection for agents calling the same tool repeatedly
- Cost impact of excessive retries

## Data Sources

- `fetch spans | filter span.kind == "CLIENT" AND isNotNull(gen_ai.request.model)` — Agent spans
- Tool call spans with `gen_ai.tool.name` attribute
