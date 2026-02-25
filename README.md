# GenAI Control Center (GCC) v2.5.0

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
| 2 | 💰 **FinOps** | `/finops` | FinOps | Real-time spend tracking, cost forecasting, budget monitoring, chargeback |
| 3 | 📊 **Analytics** | `/analytics` | ResponseAnalytics | Token efficiency, model ranking, output consistency for ML Engineers |
| 4 | 🔒 **Governance** | `/prompt-governance` | PromptGovernance | PII detection, injection risks, Davis AI scoring, cache candidates |
| 5 | 🔗 **Topology** | `/topology` | AITopology | Interactive Smartscape-style flow diagram, service→provider→model |
| 6 | 🖥️ **Services** | `/services` | HealthDashboard | Auto-discovered AI services, quality metrics, deep linking |
| 7 | 🤖 **Agents** | `/agents` | AgentTools | Tool usage tracking, agent flows, loop detection, efficiency metrics |
| 8 | 🔬 **Drift** | `/drift` | ModelDrift | Drift scoring, version change alerts, baseline comparison, anomaly detection |
| 9 | 🧠 **Intelligence** | `/intelligence` | Intelligence | Davis CoPilot integration, natural language queries, DQL generation |
| 10 | ⚙️ **Operations** | `/operations` | Operations | Runbooks, agentic workflow templates, quick actions |

### Additional Routes (not in nav bar)

| Route | Page Component | Purpose |
|-------|----------------|---------|
| `/governance` | Governance | Enterprise governance challenges overview |
| `/providers` | ProviderComparison | Cross-provider analysis and comparison |
| `/ai-architect` | AIArchitect | Pattern detection and architecture recommendations |
| `/problems` | RealTimeAlerts | Live Davis problem monitoring for AI services |
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
- **Active Agents Table** - Comprehensive agent metrics including:
  - Tool calls, avg tools per trace, avg duration
  - **Token Usage** - Input tokens, output tokens, total tokens per agent
  - **LLM Cost** - Estimated inference cost per agent
  - **LLM/Tool Split** - Visual breakdown of time spent on LLM inference vs tool execution
- **Tool Call Frequency** - Tool usage metrics with call counts, health status, error rates
- **Agent Tool Flows** - Common tool calling sequences with occurrence counts and sample traces
- **Agent Handoffs** - Cross-agent communication patterns with:
  - Source → Target agent visualization
  - Self-transfer detection (agents restarting their own flow)
  - Handoff counts and average durations
- **Tool Reliability** - Per-agent tool usage patterns and reliability metrics:
  - Call counts and traces per agent-tool combination
  - **Calls/Trace** - Ratio indicating potential retry behavior (>1 = retries)
  - **Avg/P95 Duration** - Performance metrics per tool
  - **Error Rate** - Tool failure rates with health indicators
  - **Health Status** - Visual indicator based on error rate and retry patterns
- **🔗 Tool Topology** - Interactive SVG visualization of tool relationships:
  - Circular layout showing all tools used together
  - Edge thickness indicates co-occurrence frequency
  - Node size based on tool call volume
  - Error rate indicators (red border for high error tools)
  - Hover tooltips with detailed metrics
- **Loop Detection** - Identify suspicious patterns (>10 calls to same tool) indicating infinite loops
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

### 🛡️ Governance - Compliance & Risk
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
| `davis-copilot:nl2dql:execute` | Convert natural language to DQL queries |
| `davis-copilot:dql2nl:execute` | Explain DQL queries in natural language |
| `davis-copilot:conversations:execute` | Davis CoPilot conversation recommender |

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GenAI Control Center v2.5.0                   │
├─────────────────────────────────────────────────────────────────┤
│  Observe          │  Analyze           │  Act                   │
│  ───────          │  ───────           │  ───                   │
│  Home             │  Analytics         │  Intelligence          │
│  FinOps           │  Governance        │  Operations            │
│  Services         │  Drift             │  Agentic Workflows     │
│  Agents           │  AI Architect      │                        │
│  Topology         │  Provider Compare  │                        │
│  Problems         │                    │                        │
├─────────────────────────────────────────────────────────────────┤
│                     Shared Components                            │
│  Header │ Card │ FilterBar │ DavisResponse │ ErrorBoundary      │
│  LoadingSkeleton │ SampleDataBadge                               │
├─────────────────────────────────────────────────────────────────┤
│                     Context & Config                             │
│  FilterContext (time range, provider, model, service filters)    │
│  ProviderProfiles (cost models, icons, capabilities)             │
├─────────────────────────────────────────────────────────────────┤
│                      Custom Hooks                                │
│  useDQLQueries │ useDavisAI │ useAgentTools │ useModelDrift     │
│  useAIArchitect │ useResponseAnalytics │ useAIQuality           │
│  useRemediation │ useWorkflows                                   │
├─────────────────────────────────────────────────────────────────┤
│                    Dynatrace SDKs                                │
│  @dynatrace-sdk/client-query │ client-davis-copilot             │
│  @dynatrace-sdk/navigation │ react-hooks │ app-environment      │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gcc/
├── app.config.json               # App configuration, scopes & environment URL
├── package.json                  # Dependencies & scripts
├── eslint.config.mjs             # ESLint flat config with security plugins
├── tsconfig.eslint.json          # TypeScript config for linting
├── docs/
│   ├── ROADMAP.md                # Product roadmap (Phases 0-7)
│   ├── USER_GUIDE.md             # End-user documentation
│   ├── DEMO_SCRIPT.md            # Demo walkthrough script
│   ├── SE_DEMO_SCRIPT.md         # Sales Engineer demo guide
│   └── DEMO_CHEATSHEET.md        # Quick demo reference card
├── ui/
│   ├── main.tsx                  # App entry point
│   ├── tsconfig.json             # TypeScript config
│   ├── assets/                   # Static assets (logo SVG)
│   └── app/
│       ├── App.tsx               # Main app with routing (15 routes)
│       ├── components/           # Reusable UI components
│       │   ├── Card.tsx              # Generic metric card
│       │   ├── DavisResponse.tsx     # AI response renderer
│       │   ├── ErrorBoundary.tsx     # React error boundary
│       │   ├── FilterBar.tsx         # Time range & dimension filters
│       │   ├── Header.tsx            # Navigation header (10 nav items)
│       │   ├── LoadingSkeleton.tsx   # Loading state placeholder
│       │   ├── SampleDataBadge.tsx   # Sample data indicator
│       │   └── index.ts             # Barrel export
│       ├── config/               # Configuration
│       │   ├── provider-profiles.ts  # Provider cost models & capabilities
│       │   └── index.ts             # Barrel export
│       ├── context/              # React context providers
│       │   ├── FilterContext.tsx     # Global filter state
│       │   └── index.ts             # Barrel export
│       ├── hooks/                # Data fetching & state hooks
│       │   ├── useDQLQueries.ts     # Core DQL query execution (2200+ lines)
│       │   ├── useDavisAI.ts        # Davis CoPilot integration
│       │   ├── useAgentTools.ts     # Agent monitoring (17 parallel queries)
│       │   ├── useModelDrift.ts     # Drift detection & baseline management
│       │   ├── useAIArchitect.ts    # Architecture pattern detection
│       │   ├── useAIQuality.ts      # Quality scoring & Davis analysis
│       │   ├── useResponseAnalytics.ts  # Token efficiency metrics
│       │   ├── useRemediation.ts    # Workflow execution
│       │   ├── useWorkflows.ts      # Workflow management
│       │   └── index.ts            # Barrel export
│       ├── pages/                # Application pages
│       │   ├── Home.tsx             # Executive dashboard
│       │   ├── FinOps.tsx           # Cost management
│       │   ├── ResponseAnalytics.tsx # ML engineer insights
│       │   ├── PromptGovernance.tsx  # PII/injection/Davis AI scoring
│       │   ├── Governance.tsx       # Enterprise governance challenges
│       │   ├── AITopology.tsx       # Interactive flow visualization
│       │   ├── HealthDashboard.tsx  # Service health monitoring
│       │   ├── AgentTools.tsx       # AI agent tool monitoring
│       │   ├── ModelDrift.tsx       # Drift detection & baseline
│       │   ├── Intelligence.tsx     # Davis CoPilot AI
│       │   ├── Operations.tsx       # Runbooks & quick actions
│       │   ├── ProviderComparison.tsx # Provider analysis
│       │   ├── AIArchitect.tsx      # Architecture recommendations
│       │   ├── RealTimeAlerts.tsx   # Live problem monitoring
│       │   ├── AIQualityDashboard.tsx # Quality metrics
│       │   ├── Data.tsx             # GenAI data explorer
│       │   ├── DavisAssistant.tsx   # Direct Davis chat
│       │   ├── RemediationLibrary.tsx # Workflow library
│       │   └── index.ts            # Barrel export
│       ├── queries/              # DQL query definitions
│       │   └── dql-queries.ts       # All DQL queries (~490 lines)
│       ├── types/                # TypeScript type definitions
│       │   └── index.ts
│       ├── utils/                # Helper functions
│       │   ├── helpers.ts           # Formatting, calculations
│       │   ├── providerIcons.tsx    # Provider icon mappings
│       │   └── index.ts
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
| **Build Tool** | dt-app CLI v1.5.1 |

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

- **Davis CoPilot** - Natural language to DQL, conversational AI
- **Dynatrace Grail** - DQL queries for AI telemetry
- **Dynatrace Services App** - Deep linking for detailed analysis
- **Dynatrace Distributed Traces** - Trace linking from agent flows
- **Dynatrace Workflows** - Automated remediation
- **OpenTelemetry** - GenAI semantic conventions

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

*Version 2.5.0 | © 2026*

---

## ⚠️ Disclaimer

This application is provided "as is" without warranty of any kind, express or implied. The author(s) and contributor(s) are not liable for any claims, damages, or other liability arising from the use of this software. This project is a personal initiative and does not represent the views, policies, or endorsements of any employer, organization, or affiliated entity. Use at your own risk.
