---
layout: default
title: Intelligence
parent: Analyze
---

# Dynatrace Intelligence

**Route**: `/intelligence`  
**Persona**: All — Natural language AI-powered investigation

## Use Cases

- **Ad-hoc investigation**: Ask questions in natural language and get DQL-powered answers
- **Deep-dive analysis**: Run multi-step investigations with conversational context
- **Expert guidance**: Get recommendations based on real observability data
- **Learning tool**: Understand DQL and Dynatrace concepts through examples

## Features

### 33+ AI-Powered Tools
Organized in 4 tiers:

#### Observe (23 tools)
- Service health analysis
- Provider performance comparison
- Token usage analysis
- Error pattern detection
- Latency analysis (P50/P95/P99)
- Cost breakdown by provider/model
- Agent workflow analysis
- RAG pipeline health
- Embedding performance
- And more...

#### Analyze (9 tools)
- Davis anomaly detection
- Forecast analysis (7/14/30 day)
- Drift detection
- Quality scoring
- Capacity planning

#### Act (1 tool)
- Workflow creation and execution

#### General (1 tool)
- Help and documentation

### Hybrid AI Selection
Tools are selected using:
1. **Dynatrace Intelligence NL2DQL** — Converts natural language to proper DQL queries
2. **Semantic scoring** — Matches user intent to the most relevant tool

### Rich Response Rendering
Responses rendered as Strato design blocks:
- Metric cards with trend indicators
- Data tables with sorting and filtering
- Time-series charts
- Alert/warning panels
- Davis analyzer results
- Formatted text with recommendations

### Conversation Features
- 14 suggested prompts for quick start
- 5 welcome tiles showcasing key capabilities
- 3-tier help guide (beginner → intermediate → advanced)
- Conversation history within session

## Example Prompts

- "Show me the top 5 most expensive AI models"
- "Which services have the highest error rate?"
- "Compare latency between OpenAI and Anthropic"
- "Forecast my AI costs for the next 30 days"
- "Detect anomalies in token usage patterns"
