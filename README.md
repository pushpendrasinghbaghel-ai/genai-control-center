# GenAI Control Center (GCC) v3.0.0

<p align="center">
  <img src="https://img.shields.io/badge/Dynatrace-AppEngine-4CAF50?style=for-the-badge&logo=dynatrace" alt="Dynatrace AppEngine"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenAI-supported-10a37f?style=flat-square&logo=openai" alt="OpenAI"/>
  <img src="https://img.shields.io/badge/Anthropic-supported-CC785C?style=flat-square" alt="Anthropic"/>
  <img src="https://img.shields.io/badge/Azure_OpenAI-supported-0078D4?style=flat-square&logo=microsoftazure" alt="Azure"/>
  <img src="https://img.shields.io/badge/Google_Gemini-supported-4285F4?style=flat-square&logo=google" alt="Google"/>
  <img src="https://img.shields.io/badge/AWS_Bedrock-supported-FF9900?style=flat-square&logo=amazonaws" alt="AWS"/>
  <img src="https://img.shields.io/badge/Meta_Llama-supported-0668E1?style=flat-square&logo=meta" alt="Meta"/>
  <img src="https://img.shields.io/badge/Mistral-supported-F7D046?style=flat-square" alt="Mistral"/>
  <img src="https://img.shields.io/badge/Cohere-supported-39594D?style=flat-square" alt="Cohere"/>
</p>

## 🎯 Overview

**GenAI Control Center** is a Dynatrace AppEngine application that provides **enterprise AI observability and governance** for organizations running GenAI workloads. It auto-discovers AI services instrumented with OpenTelemetry GenAI semantic conventions and provides comprehensive management across cost, quality, security, and operations.

## 🏠 Application Structure

Navigation follows the **Observe → Analyze → Act** pattern, implemented in the app header:

| # | Nav Item | Route | Page Component | Purpose |
|---|----------|-------|----------------|---------|
| 1 | 🏠 **Home** | `/` | Home | Executive dashboard with key metrics, trends, and pillar navigation |
| 2 | �️ **Services** | `/services` | HealthDashboard | Auto-discovered AI services, quality metrics, deep linking |
| 3 | 💰 **FinOps** | `/finops` | FinOps | Real-time spend tracking, cost forecasting, budget monitoring, chargeback |
| 4 | 📊 **Analytics** | `/analytics` | ResponseAnalytics | Token efficiency, model ranking, output consistency for ML Engineers |
| 5 | 🔒 **Governance** | `/prompt-governance` | PromptGovernance | PII detection, injection risks, Davis AI scoring, cache candidates |
| 6 | 🔗 **Topology** | `/topology` | AITopology | Interactive Smartscape-style flow diagram, service→provider→model |
| 7 | 🤖 **Agents** | `/agents` | AgentTools | Tool usage tracking, agent flows, loop detection, efficiency metrics |
| 8 | 🔍 **RAG** | `/vector-db` | VectorDB | Pinecone query volume, embedding trends, RAG pipeline E2E, response latency by model |
| 9 | 🔬 **Drift** | `/drift` | ModelDrift | Drift scoring, version change alerts, baseline comparison, anomaly detection |
| 10 | 🧠 **Intelligence** | `/intelligence` | Intelligence | Davis CoPilot integration, natural language queries, DQL generation |
| 11 | 🔧 **MLOps** | `/mlops` | MLOps | Model registry, SLO tracking, model comparison, cost attribution |

### Overflow Menu ("More" dropdown)

| Section | Nav Item | Route | Page Component | Purpose |
|---------|----------|-------|----------------|---------|
| **Observe** | 📈 AI Quality | `/quality` | AIQualityDashboard | Industry-standard quality scoring, hallucination detection, Davis analysis |
| **Observe** | 💬 Conversations | `/conversation` | ConversationIntelligence | Session-level AI observability, conversation flows |
| **Observe** | 👨‍💻 Developer Experience | `/devex` | DeveloperExperience | Instrumentation coverage, shadow AI detection, code attribution |
| **Observe** | 🏗️ Infrastructure | `/infrastructure` | Infrastructure | Service config snapshot, model version history, deployment tracking |
| **Govern** | 📋 Policies & Compliance | `/governance` | Governance | Enterprise governance challenges overview |
| **Act** | ⚙️ Operations | `/operations` | Operations | Runbooks, agentic workflow templates, quick actions |
| **Act** | 🛡️ Security Audit | `/security` | SecurityAuditTrail | Prompt security, PII detection, incident response audit trail |
| **Act** | 🔄 Provider Failover | `/provider-status` | ProviderStatus | Provider health monitoring, failover readiness assessment |
| **Act** | 🔌 Integrations Hub | `/integrations` | Integrations | MCP server integrations: Slack, PagerDuty, Prometheus, GitHub, Grafana |
| **Advanced** | 🔐 Threat Intelligence | `/threat-intelligence` | ThreatIntelligence | Adversarial prompt attack detection, MITRE ATT&CK-style techniques |
| **Advanced** | 📝 Data Playground | `/data` | Data | DQL editor with preset GenAI queries, results table & chart |

### Additional Routes (not in nav bar)

| Route | Page Component | Purpose |
|-------|----------------|--------|
| `/ai-architect` | AIArchitect | Pattern detection and architecture recommendations |
| `/providers` | → redirect to `/provider-status` | Legacy route |
| `/problems` | → redirect to `/operations` | Legacy route |
| `/health` | → redirect to `/services` | Legacy route |
| `/davis` | → redirect to `/intelligence` | Legacy route |
| `/remediation` | → redirect to `/operations` | Legacy route |

## 👥 Target Personas

| Persona | Primary Use Case |
|---------|------------------|
| 💰 **FinOps** | Cost visibility, budget forecasting, token optimization, showback |
| 🛡️ **Security/Compliance** | AI governance, PII detection, prompt analysis, audit trails |
| 🔧 **SRE** | Incident response, health monitoring, root cause analysis |
| 🏗️ **Platform Engineer** | Architecture optimization, provider selection, capacity planning |
| 👨‍💻 **Developer** | Debugging, performance tuning, model selection |
| 🤖 **ML Engineer** | Token efficiency, model comparison, output consistency analysis |

## 🚀 Key Features

### 💰 FinOps - Cost Management
- **Real-time Spend Dashboard** - Track AI costs across all providers with hero card layout
- **Cost Forecasting** - 7/14/30-day projections with confidence levels
- **Budget Breach ETA** - Predict when you'll exceed budget
- **Provider Comparison** - Cost-per-token by provider and model
- **Service Cost Attribution** - Breakdown by business unit (chargeback)
- **Embedding vs Completion** - Token type split analysis
- **Token Efficiency Analysis** - Detect wasteful prompts (high input, low output)
- **Cost Trend Charts** - Timeseries visualization by provider

### 🤖 Agent Tools - AI Agent Monitoring
**Five-tab dashboard** for comprehensive agent observability:

#### Overview Tab
- **Active Agents Table** - Comprehensive agent metrics including:
  - Tool calls, avg tools per trace, avg duration
  - **Token Usage** - Input tokens, output tokens, total tokens per agent
  - **LLM Cost** - Estimated inference cost per agent
  - **LLM/Tool Split** - Visual breakdown of time spent on LLM inference vs tool execution
- **🔗 Tool Topology** - Interactive SVG visualization of tool relationships
- **Loop Detection** - Identify suspicious patterns (>10 calls to same tool)

#### Optimizer Tab (NEW)
- **Industry-Standard Scoring** - Composite optimization score (0-100) based on:
  - **Reliability Score (30%)** - Based on Google SRE error budgets (99.9%/99%/95%/90% SLO tiers)
  - **Efficiency Score (30%)** - Token utilization vs LLM context windows (4K/8K/16K/32K thresholds)
  - **Latency Score (25%)** - Apdex methodology adapted for AI (T=10s tolerable, T=40s frustrating)
  - **Retry Score (15%)** - AWS/GCP retry guidelines (max 3 retries recommended)
- **Anti-Pattern Detection** - Identifies common issues:
  - Excessive retries (>3 attempts per operation)
  - Token bloat (inefficient prompt/response ratios)
  - High latency outliers (P95 > 40s)
  - Error-prone agents (>5% error rate)
- **"How is this calculated?" Modal** - Full methodology explanation with industry citations

#### Flows Tab
- **Agent Handoffs** - Cross-agent communication patterns
- **Entity Mapping** - Service-to-agent relationships
- **Common Agent Tool Flows** - Frequent tool calling sequences
- **Agent-Tool Map** - Which agents use which tools

#### Reliability Tab
- **Tool Call Frequency** - Tool usage metrics with call counts, health status, error rates
- **Tool Reliability** - Per-agent tool usage patterns and reliability metrics
- **Agent → LLM Provider Map** - Provider distribution per agent
- **Retry Detection** - Identify retry patterns (calls/trace > 1)

#### Trends Tab
- **Tool Calls Over Time** - Timeseries of tool invocations
- **Agent Activity Over Time** - Agent execution trends

#### Common Features
- **View Sample Trace** - Direct deep-link to Distributed Traces for any agent or flow
- **Case-Normalized Names** - Agent names normalized to prevent duplicates from case differences

### 🔬 Model Drift Detection - AI Behavior Monitoring
Track AI model behavior changes, semantic drift, and version updates across your GenAI workloads.

#### Drift Score Calculation
The drift score (0-100) measures how much a model's behavior has deviated from its baseline:

```
driftScore = min(100, (|current - baseline| / baseline) / threshold × 50)
```

| Score Range | Severity | Meaning |
|-------------|----------|---------|
| 0-39 | 🟢 Normal | Model behaving within expected parameters |
| 40-69 | 🟡 Warning | Notable deviation, investigation recommended |
| 70-100 | 🔴 Critical | Significant drift, immediate attention required |

#### Metrics Tracked (Industry-Aligned)

| Metric | Threshold | Weight | Purpose |
|--------|-----------|--------|---------|
| **Average Latency** | 30% | 25% | Detect response time degradation |
| **Output Tokens** | 25% | 15% | Quality/completeness indicator |
| **Error Rate** | 50% | 20% | Reliability monitoring |
| **P95 Latency** | 40% | 15% | Tail latency spike detection |
| **Input Tokens** | 25% | 10% | Cost/prompt bloat indicator |
| **Token Efficiency** | 30% | 15% | Output/Input ratio (value per token) |

> 🎯 **OpenTelemetry Aligned**: Uses `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and derives operation type from `span.name` (chat, embeddings, completion)

#### Overall Drift Score Formula
```
overallDrift = (latencyDrift × 0.25) + (outputDrift × 0.15) + (errorDrift × 0.20) + 
               (p95Drift × 0.15) + (inputDrift × 0.10) + (efficiencyDrift × 0.15)
```

#### Anomaly Detection Rules

| Anomaly Type | Trigger Condition |
|--------------|-------------------|
| 🔴 **Latency Spike** | Drift score ≥ 70 |
| 🟡 **Quality Drop** | Drift ≥ 60 AND output tokens decreased >15% |
| 🔴 **Error Increase** | Drift ≥ 50 AND error rate >1% |
| 🟡 **Input Token Spike** | Drift ≥ 60 AND input tokens increased >30% |
| 🟡 **Efficiency Drop** | Drift ≥ 50 AND efficiency decreased >20% |
| ⚠️ **Version Change** | `gen_ai.response.model` ≠ `gen_ai.request.model` |

#### Operation Type Segmentation
- **Chat** - Conversational AI (detected via `span.name` containing "chat")
- **Embeddings** - Vector operations (detected via "embed" in span name)
- **Completion** - Text generation (detected via "complet" or "generate")
- **Unknown** - Other operations

#### Baseline Comparison Strategy
- **Auto-Baseline**: Compares last 7-14 days (baseline) vs last 7 days (current)
- **Manual Baseline**: User can capture baseline via "Set as Baseline" button, persisted in localStorage

### � RAG / Vector DB — Pipeline Observability
End-to-end visibility into Retrieval-Augmented Generation pipelines and vector store operations.

- **Query Volume Timeseries** — Hourly Pinecone / vector store query counts with `makeTimeseries` bucketing
- **Embedding Volume Timeseries** — Hourly embedding generation call counts per provider
- **Latency Percentiles** — avg / p50 / p95 / p99 for vector store retrieval operations
- **Embedding Providers** — Volume and latency breakdown by provider × model
- **RAG Chain Step Performance** — Avg latency per pipeline stage with progress bar visualization
- **Top Slowest RAG Pipeline Traces** — E2E trace table with direct Distributed Tracing deep-link (intent navigation)
- **Response Latency by Model** — TTFT proxy using span duration; rated Excellent / Good / Fair / Slow (thresholds: <2s / <5s / <10s)
- **Semantic Cache Opportunities** — Repeated Pinecone queries ranked by estimated savings potential
- **Broad OTel Coverage** — Catches Pinecone, ChromaDB, Qdrant, Weaviate, Milvus + OTel standard attributes
- **Default 24h + Auto-load** — Page loads data immediately on mount; `gen_ai.server.time_to_first_token` not required

| Metric | OTel Source |
|--------|-------------|
| Query volume | `db.system` = pinecone/chromadb/qdrant/weaviate/milvus |
| Embedding volume | `gen_ai.operation.name` = embeddings or span name contains "embed" |
| Retrieval latency | Span duration for vector DB calls |
| RAG chain steps | Span name patterns (retrieve, embed, generate, augment) |
| Response latency proxy | Span duration for chat/completion/invoke spans with `gen_ai.request.model` |

### �🛡️ Governance - Compliance & Risk
- **Prompt Governance** (Dedicated Page) - Detect security and optimization issues:
  - 🔐 **PII Detection** - SSN, emails, phone numbers, credit cards
  - ⚠️ **Prompt Injection** - Malicious pattern detection
  - 💰 **Expensive Prompts** - High-cost request identification
  - 🔄 **Cache Candidates** - Repetitive prompts (15+ times) for semantic caching
  - 🎭 **Hallucination Risk** - Factual queries without grounding
  - 🤖 **Davis AI Scoring** - Advanced semantic analysis for nuanced risk detection
- **Enterprise Challenges** - Track and mitigate:
  - Data Sovereignty & Cross-Border Transfers
  - Shadow AI Usage Detection
  - Model Drift & Version Control
  - Audit Trail Completeness
  - IP Contamination Risks
- **Provider Risk Scoring** - Certifications, data residency, compliance

### 📊 Response Analytics - ML Engineer Insights
- **Token Efficiency Metrics** - Output/input ratio analysis per service
- **Model Rankings** - Composite efficiency score based on ratio, latency, cost
- **Output Consistency** - Variance analysis, low-output detection
- **Inefficient Service Detection** - Identify services needing prompt optimization
- **Cost Attribution** - Real-time cost estimation per model and provider

### 🧠 Intelligence - Davis CoPilot AI
- **Natural Language Queries** - Ask questions in plain English
- **Auto DQL Generation** - Converts NL to Dynatrace Query Language
- **Query Explanation** - Understand generated queries
- **Collapsible Responses** - Clean output with expandable details

### 🔧 Operations - Automation & Remediation
- **Runbooks** - Pre-built automation scripts for common issues
- **Agentic Workflow Templates** - Davis Intelligence-powered workflow generation
- **Analytics** - Operational insights and trends
- **Quick Actions** - One-click remediation for:
  - 🔄 Restart overloaded services
  - 🧹 Clear stale caches
  - 📈 Scale up capacity
  - 🔔 Create alert for monitoring

### 🔧 MLOps - Model Lifecycle Management
**Four-tab dashboard** for ML operations and model governance:

#### Registry Tab
- **Model Registry** - All deployed models with version, provider, operation type, request volume, and status
- **Model Health Indicators** - Error rate and latency-based health status (Healthy / Warning / Critical)
- **Deep-link to Traces** - Click any model to view distributed traces

#### SLOs Tab
- **SLO Tracking** - Service-level objectives per model with target vs actual
- **Compliance Status** - Real-time SLO compliance with visual indicators
- **Burn Rate Tracking** - SLO budget consumption rate

#### Comparison Tab
- **Side-by-Side Model Comparison** - Compare models across latency, tokens, error rate, and efficiency
- **Radar Charts** - Visual comparison across 5 dimensions
- **Cost Efficiency Rankings** - Cost per 1K tokens across models

#### Cost Attribution Tab
- **Cost by Model** - Token-based cost calculation using configurable rate cards
- **Provider Cost Breakdown** - Spend aggregation by provider
- **Service Cost Attribution** - Cost allocation by consuming service

### 🏗️ Infrastructure - Platform Health
- **Service Configuration Snapshot** - Current deployment configs, runtime versions, and resource allocation
- **Model Version History** - Track model version changes over time with deployment timeline
- **Provider Availability** - Real-time provider status and health checks
- **Davis Problems** - Active AI-related problems from Davis AI

### 📈 AI Quality Dashboard - Quality Scoring
- **Industry-Standard Scoring** - Multi-dimensional quality assessment (0-100):
  - **Accuracy (25%)** - Error rate-based measurement
  - **Latency (25%)** - Response time performance (Apdex-style)
  - **Throughput (20%)** - Request volume and capacity utilization
  - **Token Efficiency (15%)** - Output/input token ratio optimization
  - **Reliability (15%)** - Uptime and consistency metrics
- **Per-Service Quality Cards** - Visual quality breakdown per AI service
- **Davis Intelligence Analysis** - One-click deep analysis with Davis CoPilot
- **"How is this scored?" Modal** - Full methodology transparency with industry citations
- **Paginated DataTable** - Sortable, searchable quality metrics table

### 💬 Conversation Intelligence - Session Analytics
- **Conversation Flow Tracking** - Session-level AI interaction patterns
- **Multi-turn Analysis** - Track conversation depth and context retention
- **User Satisfaction Signals** - Infer satisfaction from conversation patterns
- **Session Duration Metrics** - Time-based conversation analytics

### 👨‍💻 Developer Experience - Instrumentation Health
- **Instrumentation Coverage** - Percentage of services with proper GenAI instrumentation
- **Shadow AI Detection** - Identify uninstrumented AI usage
- **Code Attribution** - Map AI calls to source code and teams
- **SDK Version Tracking** - Monitor OTel SDK versions across services

### 🛡️ Security Audit Trail - Compliance & Incident Response
- **Prompt Security Analysis** - Real-time security scoring of AI interactions
- **PII Detection Audit** - Historical log of PII exposure events
- **Incident Response Timeline** - Security incident tracking and response workflow
- **Compliance Reporting** - Audit-ready reports for regulatory requirements

### 🔄 Provider Status & Failover - Resilience
- **Provider Health Dashboard** - Real-time status of all AI providers
- **Failover Readiness Assessment** - Score each provider's failover capability
- **Latency Comparison** - Cross-provider response time benchmarking
- **Redundancy Analysis** - Identify single points of failure in AI infrastructure

## 🌐 Provider Data Completeness

Validated via Dynatrace Grail MCP queries against live telemetry:

| Provider | Tokens | Latency | Errors | Temperature | Prompt Content | Metrics | Business Events |
|----------|--------|---------|--------|-------------|----------------|---------|-----------------|
| **OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ | ✅ via LangChain | ✅ 20 models | ✅ Auditing |
| **Azure OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ | ✅ via LangChain | ✅ (as "Azure") | ✅ Auditing |
| **Amazon Bedrock** | ✅ Full | ✅ Full | ✅ Full | ✅ | ⚠️ null on direct | ✅ 3 models | ✅ Auditing |
| **Google VertexAI** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ | ⚠️ LangChain only | ❌ None | ❌ None |
| **Ollama** | ✅ Full | ✅ Full | ✅ Full | ✅ | ✅ via LangChain | ✅ 2 models | ✅ Auditing |

> **Data Sources**: OpenTelemetry `gen_ai.*` spans, `gen_ai.client.token.usage` metrics, `gen_ai.auditing` business events

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ (22+ recommended)
- Dynatrace environment with Apps enabled
- AI services instrumented with OpenTelemetry GenAI spans

### Installation

```bash
# Clone the repository
git clone https://github.com/pushpendrasinghbaghel-ai/genai-control-center.git
cd genai-control-center/gcc

# Install dependencies
npm install

# Start development server
npm start
# or: npx dt-app dev --port 3001
```

### Deploy to Dynatrace

```bash
# Build and deploy
npm run deploy

# Uninstall from environment
npm run uninstall
```

### Required Scopes
The app requires these Dynatrace scopes (configured in `app.config.json`):

| Scope | Purpose |
|-------|---------|
| `storage:logs:read` | Read logs for AI service analysis |
| `storage:buckets:read` | Read data buckets |
| `storage:spans:read` | Read gen_ai spans for service discovery |
| `storage:metrics:read` | Read metrics for SegmentSelector |
| `storage:events:read` | Read events and Davis problems |
| `storage:filter-segments:read` | Read filter segments |
| `storage:filter-segments:write` | Write filter segments |
| `storage:entities:read` | Read entities for filtering |
| `automation:workflows:read` | Read workflow definitions |
| `automation:workflows:run` | Execute remediation workflows |
| `automation:workflows:write` | Create and update workflows |
| `davis-copilot:nl2dql:execute` | Convert natural language to DQL queries |
| `davis-copilot:dql2nl:execute` | Explain DQL queries in natural language |
| `storage:bizevents:read` | Read business events for prompt audit trail |
| `davis-copilot:conversations:execute` | Davis CoPilot conversational analysis |
| `davis:analyzers:execute` | Execute Davis Intelligence analyzers |
| `davis:analyzers:read` | List and inspect available analyzers |
| `document:documents:read` | Read GCC configuration documents |
| `document:documents:write` | Write GCC configuration documents |
| `document:documents:delete` | Delete GCC configuration documents |

## 📊 Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      GenAI Control Center v3.0.0                        │
├──────────────────────────────────────────────────────────────────────────┤
│  Observe             │  Analyze            │  Act                       │
│  ───────             │  ───────            │  ───                       │
│  Home                │  Analytics          │  Intelligence              │
│  FinOps              │  Governance         │  Operations                │
│  Services            │  Drift              │  Security Audit            │
│  Agents              │  AI Architect       │  Provider Failover         │
│  Topology            │  AI Quality         │  Integrations Hub          │
│  RAG / VectorDB      │  Conversations      │  Threat Intelligence       │
│  MLOps               │  Developer Exp      │  Data Playground           │
│  Infrastructure      │                     │                            │
├──────────────────────────────────────────────────────────────────────────┤
│                       Shared Components (14)                            │
│  Header │ Card │ FilterBar │ DavisResponse │ ErrorBoundary              │
│  LoadingSkeleton │ SampleDataBadge │ AskAIButton │ AskAISheet           │
│  OptimizationAdvisor │ RAGHealthPanel │ CostGuardrailPanel             │
│  RateCardSettings                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                       Context & Config                                  │
│  FilterContext (time range, provider, model, service filters)           │
│  ProviderProfiles (cost models, icons, capabilities)                    │
│  RateCardConfig (configurable token pricing)                            │
├──────────────────────────────────────────────────────────────────────────┤
│                        Custom Hooks (34)                                 │
│  useDQLQueries │ useDavisAI │ useAgentTools │ useModelDrift             │
│  useAIArchitect │ useResponseAnalytics │ useAIQuality │ useMLOps       │
│  useVectorDB │ useInfrastructure │ useProviderFailover                  │
│  useRemediation │ useWorkflows │ useCostGuardrails │ useAskAI           │
│  useAgentOptimization │ useFrameworkDetection │ useRAGHealthScore       │
│  useDavisForecast │ useProviderDeepDive │ useSecurityAutoResponse      │
│  useAWSBilling │ useAWSCloudWatch │ useSlackIntegration                 │
│  usePagerDutyIntegration │ useGitHubIntegration │ useGrafanaIntegration │
│  usePrometheusMCP │ useMCPGateway │ useRateCardStorage                  │
│  useAgenticWorkflows │ useAgenticDeepDive │ useAdversarialThreatDetect │
│  useResponseContent                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                      Dynatrace SDKs                                     │
│  @dynatrace-sdk/client-query │ client-davis-copilot                     │
│  @dynatrace-sdk/client-davis-analyzers │ client-automation              │
│  @dynatrace-sdk/navigation │ react-hooks │ app-environment              │
│  @dynatrace-sdk/user-preferences │ error-handlers                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gcc/
├── app.config.json               # App configuration, scopes & environment URL
├── package.json                  # Dependencies & scripts
├── eslint.config.mjs             # ESLint flat config with security plugins
├── tsconfig.eslint.json          # TypeScript config for linting
├── AGENTS.md                     # AI coding agent instructions
├── docs/
│   ├── ROADMAP.md                # Product roadmap (Phases 0-12, 2400+ lines)
│   ├── USER_GUIDE.md             # End-user documentation
│   ├── DEMO_SCRIPT.md            # Demo walkthrough script
│   ├── SE_DEMO_SCRIPT.md         # Sales Engineer demo guide
│   ├── DEMO_CHEATSHEET.md        # Quick demo reference card
│   ├── COMPETITIVE_ASSESSMENT.md # Competitive analysis vs 7 alternatives
│   ├── EVOLUTION_ROADMAP.md      # Product evolution path│   ├── FINOPS_ROADMAP.md         # FinOps feature roadmap│   ├── PERMISSIONS_AND_SCOPES.md # Required OAuth scopes reference
│   └── APAC_SE_TALK_TRACK.md    # Regional sales talk track
├── mcp-server/                   # MCP server for external integrations
│   ├── src/
│   │   ├── index.ts              # MCP server entry point
│   │   ├── tools.ts              # Tool definitions
│   │   ├── dql-client.ts         # DQL query client
│   │   ├── slack-integration.ts  # Slack MCP integration
│   │   ├── pagerduty-integration.ts # PagerDuty MCP integration
│   │   ├── prometheus-integration.ts # Prometheus MCP integration
│   │   ├── github-integration.ts # GitHub MCP integration
│   │   ├── grafana-integration.ts # Grafana MCP integration
│   │   ├── aws-billing-integration.ts # AWS billing data
│   │   ├── aws-cloudwatch-integration.ts # AWS CloudWatch metrics
│   │   └── agentic-workflows.ts  # Agentic workflow orchestration
│   └── package.json
├── mcp-gateway/                  # MCP gateway (planned)
├── scripts/
│   ├── strato-fix.js             # Strato Design System compliance automation
│   ├── strato-fix-{2..6}.js      # Additional compliance fix scripts
│   ├── strato-repair.js          # Post-fix repair script
│   └── strato-repair-imports.js  # Import deduplication repair
├── ui/
│   ├── main.tsx                  # App entry point
│   ├── tsconfig.json             # TypeScript config
│   ├── assets/                   # Static assets (logo SVG)
│   └── app/
│       ├── App.tsx               # Main app with routing (25 routes + 3 redirects)
│       ├── agent/                # AI agent orchestration
│       │   ├── orchestrator.ts       # Agent orchestration logic
│       │   ├── tools.ts              # Agent tool definitions
│       │   ├── aiToolSelector.ts     # AI-powered tool selection
│       │   ├── types.ts              # Agent type definitions
│       │   └── index.ts
│       ├── components/           # Reusable UI components (14)
│       │   ├── AskAIButton.tsx       # AI chat trigger button
│       │   ├── AskAISheet.tsx        # AI chat side panel
│       │   ├── Card.tsx              # Generic metric card
│       │   ├── CostGuardrailPanel.tsx # Cost guardrail management
│       │   ├── DavisResponse.tsx     # AI response markdown renderer
│       │   ├── ErrorBoundary.tsx     # React error boundary
│       │   ├── FilterBar.tsx         # Time range & dimension filters
│       │   ├── Header.tsx            # Navigation header (11 primary + overflow)
│       │   ├── LoadingSkeleton.tsx   # Loading state placeholder
│       │   ├── OptimizationAdvisor.tsx # Optimization recommendations
│       │   ├── RAGHealthPanel.tsx    # RAG health score display
│       │   ├── RateCardSettings.tsx  # Rate card configuration
│       │   ├── SampleDataBadge.tsx   # Sample data indicator
│       │   └── index.ts             # Barrel export
│       ├── config/               # Configuration
│       │   ├── provider-profiles.ts  # Provider cost models & capabilities
│       │   ├── rate-card-config.ts   # Token pricing rate cards
│       │   └── index.ts
│       ├── context/              # React context providers
│       │   ├── FilterContext.tsx     # Global filter state
│       │   └── index.ts
│       ├── hooks/                # Data fetching & state hooks (34)
│       │   ├── useDQLQueries.ts     # Core DQL query execution (2200+ lines)
│       │   ├── useDavisAI.ts        # Davis CoPilot integration
│       │   ├── useAgentTools.ts     # Agent monitoring (17 parallel queries)
│       │   ├── useAgentOptimization.ts # Agent optimization scoring
│       │   ├── useAdversarialThreatDetection.ts # Davis AI semantic attack detection
│       │   ├── useModelDrift.ts     # Drift detection & baseline management
│       │   ├── useVectorDB.ts       # RAG / vector store telemetry
│       │   ├── useAIArchitect.ts    # Architecture pattern detection
│       │   ├── useAIQuality.ts      # Quality scoring & Davis analysis
│       │   ├── useMLOps.ts          # Model registry, SLOs, comparison
│       │   ├── useInfrastructure.ts  # Infrastructure health monitoring
│       │   ├── useResponseAnalytics.ts  # Token efficiency metrics
│       │   ├── useResponseContent.ts # Response content analysis
│       │   ├── useProviderFailover.ts # Provider failover assessment
│       │   ├── useProviderDeepDive.ts # Provider deep analytics
│       │   ├── useCostGuardrails.ts  # Cost guardrail management
│       │   ├── useDavisForecast.ts   # Davis forecasting
│       │   ├── useFrameworkDetection.ts # OTel framework detection
│       │   ├── useRAGHealthScore.ts  # RAG pipeline health scoring
│       │   ├── useSecurityAutoResponse.ts # Security automation
│       │   ├── useAskAI.ts          # AI chat interface
│       │   ├── useRemediation.ts    # Workflow execution
│       │   ├── useWorkflows.ts      # Workflow management
│       │   ├── useAgenticWorkflows.ts # Agentic workflow orchestration
│       │   ├── useAgenticDeepDive.ts # Agentic deep analysis
│       │   ├── useRateCardStorage.ts # Rate card persistence
│       │   ├── useAWSBilling.ts     # AWS billing integration
│       │   ├── useAWSCloudWatch.ts  # AWS CloudWatch integration
│       │   ├── useSlackIntegration.ts # Slack MCP integration
│       │   ├── usePagerDutyIntegration.ts # PagerDuty MCP integration
│       │   ├── useGitHubIntegration.ts # GitHub MCP integration
│       │   ├── useGrafanaIntegration.ts # Grafana MCP integration
│       │   ├── usePrometheusMCP.ts   # Prometheus MCP integration
│       │   ├── useMCPGateway.ts      # MCP gateway communication
│       │   └── index.ts
│       ├── pages/                # Application pages (30)
│       │   ├── Home.tsx             # Executive dashboard
│       │   ├── HealthDashboard.tsx  # Service health monitoring
│       │   ├── FinOps.tsx           # Cost management
│       │   ├── ResponseAnalytics.tsx # ML engineer insights
│       │   ├── PromptGovernance.tsx  # PII/injection/Davis AI scoring
│       │   ├── Governance.tsx       # Enterprise governance challenges
│       │   ├── AITopology.tsx       # Interactive flow visualization
│       │   ├── AgentTools.tsx       # AI agent tool monitoring (5 tabs)
│       │   ├── ModelDrift.tsx       # Drift detection & baseline
│       │   ├── VectorDB.tsx         # RAG & vector store pipeline
│       │   ├── Intelligence.tsx     # Davis CoPilot AI
│       │   ├── Operations.tsx       # Runbooks & quick actions
│       │   ├── MLOps.tsx            # Model registry, SLOs, comparison
│       │   ├── Infrastructure.tsx   # Platform health & config
│       │   ├── AIQualityDashboard.tsx # Industry-standard quality scoring
│       │   ├── ConversationIntelligence.tsx # Session analytics
│       │   ├── DeveloperExperience.tsx # Instrumentation coverage
│       │   ├── SecurityAuditTrail.tsx # Security audit & compliance
│       │   ├── ThreatIntelligence.tsx # Davis AI adversarial prompt detection
│       │   ├── BusinessObservability.tsx # Business observability (planned)
│       │   ├── ProviderStatus.tsx    # Provider failover
│       │   ├── Integrations.tsx     # MCP integrations hub
│       │   ├── ProviderComparison.tsx # Provider analysis (redirects)
│       │   ├── AIArchitect.tsx      # Architecture recommendations
│       │   ├── RealTimeAlerts.tsx   # Live problem monitoring (redirects)
│       │   ├── AgenticDeepDive.tsx  # Agentic deep analysis (merged)
│       │   ├── Data.tsx             # GenAI data explorer
│       │   ├── DavisAssistant.tsx   # Direct Davis chat (legacy)
│       │   ├── RemediationLibrary.tsx # Workflow library (merged)
│       │   └── index.ts
│       ├── queries/              # DQL query definitions
│       │   └── dql-queries.ts       # All DQL queries (~700 lines)
│       ├── types/                # TypeScript type definitions
│       │   └── index.ts
│       ├── utils/                # Helper functions
│       │   ├── helpers.ts           # General calculations & helpers
│       │   ├── formatting.ts        # Locale-aware formatters (user-preferences SDK)
│       │   ├── design-tokens.ts     # Centralized color tokens (StatusColors, ChartColors)
│       │   ├── chatMemory.ts        # Chat memory persistence
│       │   ├── davisAnalyzers.ts    # Davis analyzer utilities
│       │   ├── traceLink.tsx        # Distributed trace deep-link builder
│       │   ├── providerIcons.tsx    # Provider icon mappings
│       │   └── index.ts             # Barrel export
│       ├── workflows/            # Automation templates
│       │   ├── agentic-templates.ts # Davis Intelligence workflow templates
│       │   ├── finops-digest-workflow.json # FinOps email digest workflow
│       │   └── index.ts
│       └── tests/
│           └── dql-queries.test.ts  # DQL query tests
```

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server with hot reload (`dt-app dev`) |
| `npm run build` | Build Dynatrace app package (`dt-app build`) |
| `npm run deploy` | Deploy to Dynatrace environment (`dt-app deploy`) |
| `npm run uninstall` | Remove app from environment (`dt-app uninstall`) |
| `npm run lint` | Run ESLint with security plugins |
| `npm run info` | Show dt-app CLI information |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript 5 |
| **UI Kit** | @dynatrace/strato-components-preview (Strato Design System) |
| **Icons** | @dynatrace/strato-icons |
| **Design Tokens** | @dynatrace/strato-design-tokens |
| **Data Layer** | DQL via @dynatrace-sdk/client-query |
| **AI Integration** | Davis CoPilot via @dynatrace-sdk/client-davis-copilot |
| **Navigation** | @dynatrace-sdk/navigation (deep links to Services, Traces) |
| **Routing** | react-router-dom v6 |
| **Build Tool** | dt-app CLI v1.8.1 |

## 📈 Metrics Tracked

| Metric | Source | Description |
|--------|--------|-------------|
| `gen_ai.system` | Span attribute | AI provider (openai, anthropic, etc.) |
| `gen_ai.provider.name` | Span attribute | Provider name |
| `gen_ai.request.model` | Span attribute | Requested model name (gpt-4, claude-3, etc.) |
| `gen_ai.response.model` | Span attribute | Actual model used (for version drift detection) |
| `gen_ai.usage.input_tokens` | Span attribute | Input token count |
| `gen_ai.usage.output_tokens` | Span attribute | Output token count |
| `gen_ai.usage.cost` | Calculated | Cost based on token pricing |
| `gen_ai.agent.name` | Span attribute | Agent identifier |
| `gen_ai.tool.name` | Span attribute | Tool identifier |
| `traceloop.span.kind` | Span attribute | Span classification (agent, tool, workflow) |
| `service.name` | Span attribute | Service identifier |
| `db.system` | Span attribute | Database system (pinecone, etc.) |
| Latency | Span duration | Response time |
| Error Rate | Span status | Failure percentage |

## 🔗 Integrations

### Dynatrace Native
- **Davis CoPilot** - Natural language to DQL, conversational AI
- **Dynatrace Grail** - DQL queries for AI telemetry
- **Dynatrace Services App** - Deep linking for detailed analysis
- **Dynatrace Distributed Traces** - Trace linking from agent flows
- **Dynatrace Workflows** - Automated remediation
- **OpenTelemetry** - GenAI semantic conventions

### MCP Server Integrations (NEW)
The Integrations page (`/integrations`) provides connections to external systems via MCP servers:

| Integration | Capabilities |
|-------------|--------------|
| 🔔 **Slack** | Send alerts, create channels, post incident updates |
| 📟 **PagerDuty** | Create incidents, list on-call schedules, manage escalations |
| 📊 **Prometheus** | Query metrics, execute PromQL, fetch alert rules |
| 🐙 **GitHub** | Repository info, issues, pull requests, code search |
| 📈 **Grafana** | Dashboard links, panel queries, annotation management |

## 🔒 Security Features

### Prompt Analysis Detections
| Type | Description |
|------|-------------|
| 🔐 PII | SSN, email, phone, credit card, PHI/HIPAA |
| ⚠️ Injection | Prompt injection attack patterns |
| 🎭 Hallucination | Factual queries without RAG grounding |
| ⚖️ Bias | Protected characteristics in decisions |
| 🔒 Sensitive | Financial, medical, legal data |

### Enterprise Governance
- Data sovereignty compliance
- Shadow AI detection
- Model version tracking
- Audit trail completeness
- Cost attribution

## 📋 Changelog

### v3.0.0 (March 2026)
- 🆕 **MLOps Dashboard**: Full model lifecycle management with 4 tabs
  - Model Registry with health indicators and version tracking
  - SLO tracking with compliance status and burn rate
  - Side-by-side model comparison with radar charts
  - Cost attribution by model, provider, and service
- 🆕 **Infrastructure Page**: Service config snapshot and model version history
- 🆕 **AI Quality Dashboard**: Industry-standard scoring (Accuracy/Latency/Throughput/Efficiency/Reliability)
  - Paginated DataTable with sorting and search
  - Davis Intelligence one-click analysis
  - Full scoring methodology transparency modal
- 🆕 **Conversation Intelligence**: Session-level AI observability
- 🆕 **Developer Experience**: Instrumentation coverage and shadow AI detection
- 🆕 **Security Audit Trail**: Prompt security analysis and compliance reporting
- 🆕 **Provider Status & Failover**: Provider health and failover readiness
- 📊 **VectorDB Enhancements**: Extended RAG pipeline with embedding provider breakdown and cache detection
- 📊 **Agent Tools Refactoring**: Token usage, LLM cost, and LLM/Tool time split per agent
- 📊 **MLOps SLO Tab**: SLO tracking with configurable targets and compliance monitoring
- 📝 **Comprehensive Roadmap Audit**: 2,400+ line roadmap with MCP-validated data feasibility
  - 8 features re-classified from Planned → Completed
  - Per-provider data completeness matrix (5 providers validated)
  - 10 untapped data sources identified (OTel GenAI metrics, business events)
  - Competitive assessment vs 7 alternatives
- 🔗 **25 Routes + 3 Redirects**: From 16 to 28 total routes
- 🛡️ **34 Custom Hooks**: From 11 to 34 data fetching hooks
- 🛠️ **14 Shared Components**: From 7 to 14 reusable components
- 🆕 **Threat Intelligence Page**: Adversarial prompt detection with Davis AI, MITRE ATT&CK-style techniques
- 🆕 **Data Playground Page**: DQL editor with 10 preset GenAI queries, results table & chart
- 🎨 **100% Strato Design System Compliance**: Centralized `formatting.ts` and `design-tokens.ts`
  - All raw HTML replaced with Strato components (`Flex`, `Text`, `Button`, `Chip`)
  - All hardcoded hex colors replaced with CSS variable design tokens
  - All `.toLocaleString()` calls replaced with locale-aware formatters
  - Fixed component APIs: Tabs `defaultIndex`, DonutChart `{slices}`, TimeseriesChart `start:Date`

### v2.9.0 (March 2026)
- 🔌 **Integrations Page**: New MCP server integrations hub
  - Slack: Send messages, create channels, post incident updates
  - PagerDuty: Create incidents, list on-call, manage escalations
  - Prometheus: Query metrics, execute PromQL, fetch alerts
  - GitHub: Repository info, issues, PRs, code search
  - Grafana: Dashboard links, panel queries, annotations
- 📊 **Agent Tools Optimizer Tab**: Industry-standard scoring methodology
  - Reliability Score (30%) based on Google SRE error budgets
  - Efficiency Score (30%) based on LLM context window utilization
  - Latency Score (25%) using Apdex methodology (T=10s for AI)
  - Retry Score (15%) per AWS/GCP retry guidelines
  - "How is this calculated?" modal with full methodology citations
- 🧹 **Agent Tools Tab Deduplication**: Each tab now has unique content
  - Overview: Active Agents, Tool Topology, Loop Detection
  - Optimizer: Scoring, anti-pattern detection
  - Flows: Handoffs, entity mapping, tool flows
  - Reliability: Tool frequency, reliability metrics, retry detection
  - Trends: Tool calls over time, agent activity over time
- 🐛 **Header Fixes**: Restored icons and More menu functionality

### v2.6.0 (February 2026)
- 🔍 **RAG / Vector DB Page**: End-to-end pipeline observability for Retrieval-Augmented Generation
  - Query volume & embedding volume timeseries (correct `makeTimeseries` bucket parsing)
  - Latency percentiles (avg/p50/p95/p99) for vector store operations
  - RAG chain step performance with progress bar visualization
  - Top slowest pipeline traces with Distributed Tracing deep-link
  - Response Latency by Model (TTFT proxy via span duration — `gen_ai.server.time_to_first_token` not required)
  - Semantic cache opportunity detection
  - Broad OTel coverage: Pinecone, ChromaDB, Qdrant, Weaviate, Milvus
- 📦 **Documentation**: ROADMAP, USER_GUIDE, and README updated to v2.6.0

### v2.5.0 (February 2026)
- 📋 **Viatris Metrics Gap Analysis**: 134 enterprise metrics assessed across 6 domains
- 🗺️ **Roadmap Phases 5-7**: RAG/Vector DB monitoring, Infrastructure Health, Enhanced Governance & Security
- 📄 **Documentation**: Updated README, ROADMAP with full implementation plan and timeline

### v2.8.0 (January 2026)
- 🆕 **Service Detail Modal**: Click any Service node in Topology for full-screen detail view
  - Summary stats, interactive SVG topology, provider cards, "View in Smartscape" link
- 🆕 **Home Page Agents Stat**: New StatCard showing active AI agents count
- ✨ **Simplified Topology Edges**: Cleaner, thinner dashed lines with smaller arrowheads
- 🔄 **Agent Activity Chart**: Replaced Tool Error Rate with Agent Activity Over Time
- 🔄 **Tool Calls Chart**: Replaced Loop Incidents with Tool Calls Over Time

### v2.7.0 (January 2026)
- 🆕 **AI Topology Page**: Interactive Smartscape-style visualization of GenAI service flows
  - Card-based nodes for Services, Providers, and Models
  - Connection-aware filtering, provider/model icons, hover tooltips
  - Edge labels showing token/request counts, deep-link to Services app
- ✨ **Model Icons**: Model nodes show provider-inferred icons
- 🐛 **Edge Fix**: Edges now show for connections with only request data
- 🐛 **Filter Fix**: Topology filtering respects actual connections

### v2.4.0 (January 2026)
- 🆕 **Enhanced Home Dashboard**: 8 trend charts in 2x2 CSS Grid sections
- 🆕 **Improved FinOps Dashboard**: Hero card layout, budget progress, chargeback table
- 🆕 **Contextual Tooltips**: Help icons on all cards explaining metrics
- 🐛 **DonutChart Fix**: Replaced with ProgressBar-based visualization
- 🐛 **DQL String Handling**: Fixed number parsing from DQL

### v2.3.0 (January 2026)
- 🆕 **Prompt Governance Page**: PII detection, injection risk, Davis AI scoring, cache candidates
- 🆕 **Response Analytics Page**: Token efficiency dashboard for ML Engineers
- 🆕 **TitleBar Component**: Consistent page headers across all pages
- ✨ **Real-Time Alerts Page**: Live Davis problem monitoring for AI services
- ✨ **Strato Design Tokens**: Official color tokens for status indicators

### v2.1.0 (January 2026)
- 🆕 **Executive Dashboard**: Home page with health overview and pillar navigation
- 🆕 **Health Dashboard**: AI service health with quality metrics
- 🆕 **Quick Actions**: One-click remediation actions in Operations
- 🆕 **GenAI Data Explorer**: Preset DQL queries for GenAI analysis

### v2.0.0 (January 2026)
- 🆕 **Four-pillar architecture**: FinOps, Governance, Intelligence, Operations
- 🆕 **Prompt Analysis**: PII detection, hallucination risk, injection detection
- 🆕 **Cost Forecasting**: 7/14/30-day projections with budget breach ETA
- 🆕 **Davis CoPilot Integration**: Real NL-to-DQL conversion

### v1.0.0 (December 2025)
- Initial release with Health Dashboard, Provider Comparison, Davis Assistant, Remediation Library

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/)
- Uses [Dynatrace Strato Components](https://developer.dynatrace.com/develop/ui/)
- Powered by [Davis CoPilot SDK](https://developer.dynatrace.com/)

---

**Built with ❤️ by Pushpendra Singh Baghel and AI Assistant**

*Version 3.0.0 | © 2026*

---

## ⚠️ Disclaimer

This application is provided "as is" without warranty of any kind, express or implied. The author(s) and contributor(s) are not liable for any claims, damages, or other liability arising from the use of this software. This project is a personal initiative and does not represent the views, policies, or endorsements of any employer, organization, or affiliated entity. Use at your own risk.
