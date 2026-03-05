# GCC MCP Server — GenAI Control Center

MCP (Model Context Protocol) server that exposes all 30 GenAI Control Center tools for use with Claude Desktop, VS Code Copilot, or any MCP-compatible client.

## Tools Available (30)

| # | Tool | Description |
|---|------|-------------|
| 1 | `service_health` | Health overview of all GenAI services |
| 2 | `provider_comparison` | Compare AI providers by latency, error rate, cost |
| 3 | `model_comparison` | Compare AI models by performance and usage |
| 4 | `top_errors` | Top GenAI errors grouped by type/provider/model |
| 5 | `cost_breakdown` | AI cost breakdown with estimated spend |
| 6 | `latency_analysis` | Latency percentiles by model and provider |
| 7 | `token_usage` | Token usage breakdown — input vs output |
| 8 | `inventory_overview` | Complete inventory of AI services/models/providers |
| 9 | `agent_overview` | Agentic AI activity — LangChain, tool calls |
| 10 | `model_inventory` | All AI models in use with stats |
| 11 | `provider_inventory` | All AI providers with connections |
| 12 | `usage_trends` | Usage trends over time |
| 13 | `embedding_analytics` | Embedding model analysis |
| 14 | `rag_pipeline` | RAG pipeline — embedding vs generation split |
| 15 | `ai_topology` | AI service topology map |
| 16 | `prompt_governance` | PII detection, injection risk analysis |
| 17 | `model_drift` | Model behavior changes & version mismatches |
| 18 | `infrastructure` | Deployments, configs, model history |
| 19 | `ai_quality` | Per-service AI quality scoring |
| 20 | `conversation_intelligence` | Session-level conversation analysis |
| 21 | `developer_experience` | Instrumentation coverage & shadow AI |
| 22 | `governance` | Compliance audit trail |
| 23 | `response_analytics` | Token efficiency & output variance |
| 24 | `live_problems` | Davis problems & workflow executions |
| 25 | `ai_architect` | Architecture recommendations & anti-patterns |
| 26 | `error_investigation` | Error trends & root cause analysis |
| 27 | `executive_summary` | Executive summary of all GenAI ops |
| 28 | `cost_optimization` | Cost optimization recommendations |

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure environment

Set the required environment variables:

```bash
export DT_ENVIRONMENT_URL="https://{your-id}.apps.dynatrace.com"
export DT_API_TOKEN="dt0c01.xxxxxxxx"
```

The API token needs these scopes:
- `storage:events:read`
- `storage:spans:read`
- `storage:bizevents:read`
- `storage:metrics:read`

### 4. Run

```bash
npm start
```

## Client Configuration

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gcc-genai-control-center": {
      "command": "node",
      "args": ["<path-to>/mcp-server/dist/index.js"],
      "env": {
        "DT_ENVIRONMENT_URL": "https://{id}.apps.dynatrace.com",
        "DT_API_TOKEN": "dt0c01.xxxxxxxx"
      }
    }
  }
}
```

### VS Code (Copilot MCP)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "gcc-genai-control-center": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "DT_ENVIRONMENT_URL": "https://{id}.apps.dynatrace.com",
        "DT_API_TOKEN": "dt0c01.xxxxxxxx"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gcc-genai-control-center": {
      "command": "node",
      "args": ["<path-to>/mcp-server/dist/index.js"],
      "env": {
        "DT_ENVIRONMENT_URL": "https://{id}.apps.dynatrace.com",
        "DT_API_TOKEN": "dt0c01.xxxxxxxx"
      }
    }
  }
}
```

## Development

```bash
# Run directly with tsx (no build needed)
npm run dev

# Build and run
npm run build && npm start
```

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts        # MCP server entry point (stdio transport)
│   ├── tools.ts        # 30 tool definitions with DQL queries
│   └── dql-client.ts   # Dynatrace REST API DQL execution
├── package.json
├── tsconfig.json
└── README.md
```

All tools accept a `timeframe` parameter (default: `24h`) and return structured JSON data from Dynatrace Grail via DQL queries.
