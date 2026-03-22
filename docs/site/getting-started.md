---
layout: default
title: Getting Started
---

# Getting Started with GenAI Control Center

## Prerequisites

- **Dynatrace Environment** with AppEngine enabled
- **Node.js** 18+ and npm
- **OpenTelemetry Instrumentation** on your AI services using gen_ai.* semantic conventions

## Required OpenTelemetry Attributes

GCC auto-discovers AI services by querying spans with these attributes:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `gen_ai.request.model` | Model name | `gpt-4o`, `claude-3-opus` |
| `gen_ai.provider.name` / `gen_ai.system` | Provider | `openai`, `anthropic`, `azure` |
| `gen_ai.usage.input_tokens` | Input token count | `150` |
| `gen_ai.usage.output_tokens` | Output token count | `500` |
| `gen_ai.response.finish_reason` | Completion reason | `stop`, `length` |
| `gen_ai.prompt.0.content` | Prompt text (for governance) | User prompt text |
| `gen_ai.completion.0.content` | Completion text (for audit) | Model response text |
| `llm.is_streaming` | Streaming mode flag | `true`, `false` |

## Installation

```bash
# Clone the repository
git clone https://github.com/pushpendrasinghbaghel-ai/genai-control-center.git
cd genai-control-center

# Install dependencies
npm install

# Configure your Dynatrace environment
# Edit app.config.json and set your environmentUrl
```

## Configuration

### app.config.json

```json
{
  "environmentUrl": "https://your-environment.apps.dynatrace.com/",
  "app": {
    "name": "GenAI Control Center",
    "id": "com.dynatrace.genai.controlcenter"
  }
}
```

### Required Scopes

GCC requires these permissions in your Dynatrace environment:

| Scope | Purpose |
|-------|---------|
| `storage:spans:read` | Read gen_ai.* spans |
| `storage:metrics:read` | Read performance metrics |
| `storage:events:read` | Read Davis problems |
| `storage:logs:read` | Read service logs |
| `storage:bizevents:read` | Read business events for audit trail |
| `storage:entities:read` | Read entity data |
| `automation:workflows:*` | Remediation workflows |
| `davis-copilot:*` | Davis AI features |
| `document:documents:*` | Configuration storage |

## Development

```bash
# Start development server (hot reload)
npm start

# Build for production
npm run build

# Deploy to Dynatrace
npm run deploy

# Lint code
npm run lint
```

## Navigation

GCC organizes 20+ pages into four pillars:

| Pillar | Pages | Focus |
|--------|-------|-------|
| **Observe** | Home, Services, Topology, Agents, RAG, MLOps, Quality, Conversations, DevEx, Infrastructure | Monitoring & discovery |
| **Analyze** | Analytics, Drift, Intelligence | Deep-dive investigation |
| **Govern** | FinOps, Prompt Governance, Policies | Compliance & cost |
| **Act** | Operations, Security, Failover, Integrations | Remediation & automation |

## FilterBar

All pages share a global FilterBar with:

- **Timeframe**: `15m`, `1h`, `3h`, `6h`, `12h`, `24h`, `2d`, `7d`, `30d`
- **Service Filter**: Filter by AI service name
- **Provider Filter**: Filter by AI provider (OpenAI, Anthropic, Azure, etc.)
- **Model Filter**: Filter by specific model (gpt-4o, claude-3-opus, etc.)

Filters are synchronized across all pages via React Context.
