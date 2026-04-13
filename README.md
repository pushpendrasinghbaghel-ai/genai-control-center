# GenAI Control Center (GCC)

<p align="center">
  <img src="https://img.shields.io/badge/Dynatrace-AppEngine-4CAF50?style=for-the-badge&logo=dynatrace" alt="Dynatrace AppEngine"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Pages-23-blueviolet?style=for-the-badge" alt="23 Pages"/>
  <img src="https://img.shields.io/badge/Hooks-43-orange?style=for-the-badge" alt="43 Hooks"/>
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
  <img src="https://img.shields.io/badge/Ollama-supported-000000?style=flat-square" alt="Ollama"/>
</p>

---

## Why GenAI Control Center?

> **AI is going to production — and nobody knows what it's costing, whether it's working, or whether it's safe.**

GenAI Control Center is the single pane of glass for everyone who owns, operates, or is accountable for AI in production. It auto-discovers every AI service instrumented with OpenTelemetry GenAI semantic conventions and turns raw `gen_ai.*` spans into decisions: where is money being wasted, which models are drifting, which prompts carry security risk, and where your agents are looping.

Unlike dashboards that show infrastructure metrics alongside AI, GCC is AI-native from the ground up — built on the same GRAIL database that already holds your logs, traces, and metrics, so you get AI observability without a separate data store, a separate billing tool, or a separate security scanner.

**Three things that make it different:**
1. **No synthetic data** — every metric comes from real OTel spans queried live via DQL
2. **Persona-first UX** — FinOps engineers, SREs, security teams, and ML engineers each get a purpose-built view, not a generic table dump
3. **Act, don't just observe** — Davis CoPilot, workflow automation, and one-click remediation are built in, not bolted on

---

## Who Is This For?

### 💰 FinOps Engineer
*"I need to show my CFO exactly what we're spending on AI and justify every dollar."*

- Real-time token spend by provider, model, and service — not estimates
- Total Cost of AI Ownership (TCoAI) iceberg: token cost + infra + training in one view
- Budget breach ETA with burn rate forecasting
- Context Window Creep detection — the hidden cost of ballooning input/output ratios
- Time-of-day cost heatmaps to shift workloads off-peak
- Chargeback/showback by business unit

| Regional Value |
|---|
| 🇮🇳 **India**: Cost-per-token optimization is #1 concern for Infosys/TCS/Wipro running GenAI at scale. Budget ETA prevents surprise overruns on Azure OpenAI-heavy deployments. |
| 🌏 **APAC**: Multi-cloud is the norm (Azure + AWS + Google). Cross-provider cost comparison saves hours of manual spreadsheet work. |
| 🇺🇸 **US**: Board-level AI spend visibility for SEC AI disclosure requirements. Competes directly with Datadog AI cost tracking. |
| 🇪🇺 **Europe**: Sustainability reporting — AI carbon footprint correlates with token spend. ESG-friendly cost transparency. |

**Start at:** [FinOps →](/finops)

---

### 🛡️ Security & Compliance Officer
*"How do I audit every AI interaction and prove we're not leaking PII or exposing our models to injection attacks?"*

- Per-prompt security analysis: PII, injection, hallucination, bias — from real span data
- Davis AI semantic scoring for nuanced risk that regex misses
- Adversarial Prompt Threat Intelligence — Davis-powered detection of sophisticated attacks (authority impersonation, multi-stage extraction, token smuggling, and 5 more techniques)
- Tamper-resistant audit trail of every model invocation, paginated and sortable
- Provider risk scoring: data residency, certifications, compliance posture
- Governance policy compliance score with policy-by-policy breakdown
- One-click workflow creation from any threat finding → auto-generate Dynatrace alert workflows

| Regional Value |
|---|
| 🇮🇳 **India**: DPDP Act (2023) compliance + RBI guidelines for AI in financial services. Audit trail is a regulatory checkbox. |
| 🌏 **APAC**: Singapore MAS FEAT principles for financial AI. Japan METI AI guidelines require adversarial testing evidence. |
| 🇺🇸 **US**: NIST AI RMF mapping. SOC2 Type II evidence. Prompt injection is OWASP LLM Top 10 #1. |
| 🇪🇺 **Europe**: **EU AI Act Article 15 (robustness) REQUIRES testing for adversarial attacks on high-risk AI systems.** This is a mandatory compliance artifact. |

**Start at:** [Governance →](/prompt-governance), [Threat Intelligence →](/threat-intelligence)

---

### 🔧 Site Reliability Engineer
*"My AI services have no SLOs. I can't tell if they're healthy until users complain."*

- Auto-discovered AI service health with error rate, latency, and throughput
- Davis-standard anomaly detection applied to AI workloads
- One-click Distributed Traces deep-link from any service, agent, or prompt
- Provider failover readiness score — know before you need it
- Real-time problem feed from Davis AI
- Agent incident detection: infinite loops, context overflow, cost spikes

| Regional Value |
|---|
| 🇮🇳 **India**: SRE teams of 2–3 managing 50+ AI services. Auto-discovery + incident-first view saves hours of manual triage. |
| 🌏 **APAC**: Japanese enterprises demand exhaustive data with auditability. Progressive disclosure serves both minimal and detailed views. |
| 🇺🇸 **US**: Platform engineers expect Grafana-level flexibility. Deep-link to Distributed Traces provides drill-down without context switching. |
| 🇪🇺 **Europe**: German engineering teams want precision — every number traceable to source DQL query. |

**Start at:** [Services →](/services), [Operations →](/operations)

---

### 🤖 ML Engineer
*"Which model is actually delivering value? Are my agents efficient or are they just burning tokens in loops?"*

- Industry-standard quality scoring (accuracy, latency, throughput, efficiency, reliability)
- Model drift detection with configurable baselines — catch silent degradation
- Agent tool analysis: loop detection, LLM/tool split, optimization scoring
- RAG pipeline E2E latency from retrieval → embedding → generation
- Token efficiency ranking and output consistency analysis
- Conversation intelligence: multi-turn analysis, context growth tracking

| Regional Value |
|---|
| 🇮🇳 **India**: Strong ML talent pool expects raw data access. Token efficiency per rupee is the key metric. Azure OpenAI + open-source model mix (Llama, Mistral). |
| 🌏 **APAC**: Japanese teams prefer structured reporting. Australian ML teams want model drift detection. Singapore FI teams need explainability. |
| 🇺🇸 **US**: Expect integration patterns familiar from MLflow/W&B. A/B test support for prompt variants via model comparison. |
| 🇪🇺 **Europe**: EU AI Act explainability requirements — "why did the model do this?" Drift detection provides evidence. |

**Start at:** [Analytics →](/analytics), [Agents →](/agents), [Drift →](/drift)

---

### 🏗️ Platform / AI Infrastructure Engineer
*"I need to understand our AI topology, choose the right provider, and plan capacity."*

- Interactive Smartscape-style topology: service → agent → model → provider
- Cross-provider cost-per-token comparison with live data
- Model registry with version tracking, SLO monitoring, and cost attribution
- Instrumentation coverage gap analysis and shadow AI detection
- Infrastructure config snapshots and model version history

| Regional Value |
|---|
| 🇮🇳 **India**: Teams use mix of OTel + proprietary. ServiceNow/Jira integration critical. Must work with Azure OpenAI (dominant provider). |
| 🌏 **APAC**: Japanese enterprises often on custom monitoring stacks. OTel compatibility story is key. |
| 🇺🇸 **US**: Full OTel ecosystem expected. "Does it fit in my platform engineering IDP?" |
| 🇪🇺 **Europe**: Must work in regulated/air-gapped environments. Custom webhook support important. |

**Start at:** [Topology →](/topology), [MLOps →](/mlops), [Developer Exp →](/devex)

---

## What's Measured — All From Real gen_ai.* Spans

| Signal | OTel Source | Used For |
|--------|-------------|----------|
| Input tokens | `gen_ai.usage.input_tokens` | Cost, efficiency, context creep |
| Output tokens | `gen_ai.usage.output_tokens` | Quality, verbosity, cost |
| Model requested | `gen_ai.request.model` | Version tracking, cost routing |
| Model responded | `gen_ai.response.model` | Drift detection (requested ≠ responded) |
| Provider | `gen_ai.provider.name` | Multi-provider comparison, risk scoring |
| Finish reason | `gen_ai.response.finish_reason` | Truncation, stop, content filter analysis |
| Prompt content | `gen_ai.prompt.0.content` | Security analysis, threat detection |
| Completion content | `gen_ai.completion.0.content` | Response quality, exfiltration detection |
| Agent name | `gen_ai.agent.name` | Agent loop detection, efficiency scoring |
| Tool name | `gen_ai.tool.name` | Tool usage patterns, reliability metrics |
| Span duration | `start_time` / `end_time` | Latency SLOs, Apdex scoring |
| Span status | OTel span status | Error rates, reliability |
| DB system | `db.system` | Vector store / RAG pipeline detection |
| Business events | `gen_ai.auditing` | Audit trail, training job tracking |

---

## Application Structure

**23 pages, 27 routes (incl. 5 redirects), 43 custom hooks, 14 shared components**

Navigation follows the **Observe → Analyze → Act** pattern:

### Main Navigation Bar (11 items)

| # | Page | Route | Persona | Value |
|---|------|-------|---------|-------|
| 1 | 🏠 **Home** | `/` | Everyone | Executive KPI rollup across all pillars |
| 2 | ⚕️ **Services** | `/services` | SRE | Auto-discovered AI services, health, deep links |
| 3 | 💰 **FinOps** | `/finops` | FinOps | Spend, budget, forecasting, TCoAI, chargeback |
| 4 | 📊 **Analytics** | `/analytics` | ML Engineer | Token efficiency, model ranking, output consistency |
| 5 | 🔒 **Governance** | `/prompt-governance` | Security | PII/injection/bias analysis, audit trail, scoring |
| 6 | 🔗 **Topology** | `/topology` | Platform | Interactive AI service → model → provider graph |
| 7 | 🤖 **Agents** | `/agents` | SRE / ML Eng | Incidents-first: loops, overflow, cost spikes → health → tools |
| 8 | 🔍 **RAG** | `/vector-db` | ML Engineer | Vector store pipeline, embedding trends, latency |
| 9 | 🔬 **Drift** | `/drift` | ML Engineer | Model behavior drift, baseline comparison, alerts |
| 10 | 🧠 **Intelligence** | `/intelligence` | Everyone | Davis CoPilot, NL to DQL, conversational analysis |
| 11 | 🔧 **MLOps** | `/mlops` | Platform | Model registry, SLOs, comparison, cost attribution |

### Overflow ("More" Dropdown)

| Section | Page | Route | Persona | Value |
|---------|------|-------|---------|-------|
| Observe | 📈 AI Quality | `/quality` | ML Engineer | Composite quality scoring per model/service |
| Observe | 💬 Conversations | `/conversation` | ML Engineer | Session-level AI interaction analytics |
| Observe | 👨‍💻 Developer Experience | `/devex` | Platform | Instrumentation gaps, shadow AI, SDK versions |
| Observe | 🏗️ Infrastructure | `/infrastructure` | Platform | Service configs, model version history |
| Govern | 📋 Policies & Compliance | `/governance` | Security | Enterprise governance policy dashboard |
| Act | ⚙️ Operations | `/operations` | SRE | Runbooks, agentic workflow templates |
| Act | 🛡️ Security Audit | `/security` | Security | Prompt security, incident response timeline |
| Act | 🔐 Threat Intelligence | `/threat-intelligence` | Security | Davis AI adversarial prompt attack detection |
| Act | 🔄 Provider Failover | `/provider-status` | SRE | Failover readiness, provider health |
| Act | 🔌 Integrations Hub | `/integrations` | Platform | Slack, PagerDuty, Prometheus, GitHub, Grafana |
| Dev | 📝 Data Playground | `/data` | Developer | DQL editor with GenAI presets |
| Hidden | 🏛️ AI Architect | `/ai-architect` | ML Engineer | Pattern detection and recommendations |

---

## Key Capabilities — Deep Dive

### 💰 FinOps — Follow the Money

Five-tab narrative: **What it costs → Where → Is it worth it → Pay less → What's coming**

- **TCoAI Iceberg** — Token cost (real), infrastructure cost (requires BizEvent ingestion), training cost (estimated from job count × rate table)
- **Context Window Creep** — Distribution of input/output ratios; >5:1 flagged as waste
- **Time-of-Day Heatmap** — 24-bucket hourly aggregation, peak/trough ratio, top-4-hours cost concentration
- **Model Quality-Need Matching** — MMLU-benchmarked tier alignment: are flagship models doing simple tasks?
- **Cost Velocity** — Real-time burn rate, budget ETA, guardrail management
- **7/14/30-day Forecasting** — Davis-powered projections with confidence intervals

### 🔒 Governance & Security — Observe, Audit, Enforce

**Prompt Governance** (`/prompt-governance`) — The daily-use security dashboard:
- **Prompt Analysis** — Paginated security analysis (20/page) with per-category filters: PII, injection, hallucination, ungrounded, expensive, cacheable, bias
- **Davis AI Scoring** — Batch semantic risk scoring beyond regex patterns
- **Audit Trail** — Sortable `DataTable` with built-in pagination (25/page) for every model invocation

**Policies & Compliance** (`/governance`) — The enterprise governance layer:
- **Policy Compliance** — 5 auto-generated policies from real data: multi-provider strategy, error threshold, latency SLA, data residency, model versioning
- **Provider Risk** — Data residency, certifications, dynamic risk adjustment from real error/latency data

**Threat Intelligence** (`/threat-intelligence`) — Adversarial prompt attack detection:
- **Davis AI Semantic Classification** — 8 adversarial techniques detected: authority impersonation, multi-stage extraction, context manipulation, obfuscated PII harvesting, roleplay escalation, indirect injection, goal hijacking, token smuggling
- **Behavioral Context** — Anomalous time-of-day correlation and request velocity spike detection
- **FilterBar + TimeframeSelector** — Standard Dynatrace filtering with configurable time window (default 30 min)
- **Create Workflow** — One-click Dynatrace Workflow generation from any threat finding

**Security Audit Trail** (`/security`) — Incident response timeline and forensic analysis

### 🤖 Agent Tools — AI Agent Observability

**5-tab, incidents-first dashboard.** The narrative: *Three things silently destroy AI agent systems — runaway loops, context overflow, and tool failure cascades. Here's which of your agents are hitting them right now.*

**Primary personas:**

| Persona | Goes to first | Key question answered |
|---------|--------------|----------------------|
| 🚨 **SRE on-call** | Incidents tab | Is anything broken right now? |
| 🏗️ **Platform Engineer** | Agent Health | Are my agents passing SLO? |
| 🔧 **AI Engineer** | Tool Intelligence | Which tools are failing? |
| 🤖 **ML Engineer** | Trends | Is agent efficiency improving? |
| 👨‍💻 **Developer** | Investigate | What happened in this specific trace? |

**Five tabs:**

#### Incidents (default landing)
- **Infinite Loop Alerts** — agents calling the same tool >10× in one trace; cost impact shown per incident
- **Context Window Near-Capacity** — models hitting >90% fill; silent quality degradation
- **Cost Spike Alerts** — hours exceeding 2× average spend with token/request context
- **All-clear state** — when no incidents exist, shows green "All agents healthy" confirmation

#### Agent Health
- **Agent Success Rate** — DonutChart with industry benchmarks (>95% excellent, 85–95% acceptable)
- **Token Efficiency** — output/input ratio; low ratio = prompt bloat
- **Estimated AI Spend** — cost per LLM call with total
- **Avg Response Time** — Apdex-aligned (<2s excellent, <5s acceptable)
- **Time Distribution** — LLM vs tool time split per agent
- **Active Agents Table** — full DataTable with tool calls, token counts, LLM cost, trace deep-link
- **Optimization Advisor** — composite score (reliability 30%, efficiency 30%, latency 25%, retry 15%)

#### Tool Intelligence
- **Agent Handoffs** — cross-agent delegation patterns with self-transfer detection
- **Agent → Service Dependencies** — HTTP/DB/gRPC backends called by agents
- **Common Tool Flows** — frequent tool-call sequences with topology modal
- **Agent-Tool Map SVG** — Smartscape-style topology: edge thickness = call volume, red = high errors
- **Tool Reliability** — per-agent tool usage with retry detection
- **Agent → LLM Provider Map** — which provider/model each agent uses, with cost tracking

#### Trends
- **Error Rate** — hourly timeseries with avg annotation
- **Agent Latency** — P50 + P95 dual-series
- **Hourly Cost** — spend trend with breach detection
- **Token Consumption** — input vs output stacked bar timeseries
- **Context Window Utilization** — per-model fill % with near-capacity flags

#### Investigate
- **Step Tracing** — spans per trace by type (task/tool/workflow/LLM), exit conditions
- **Multi-Agent Traces** — traces involving 2+ agents with parallelism detection
- **Cross-Agent Token Attribution** — LLM cost and token breakdown per agent
- **Conversation State** — single-turn vs multi-turn vs runaway (>20 turns) distribution
- **Context Growth** — token escalation across conversation turns

**Framework detection:** LangChain, CrewAI, Bedrock Agents, Semantic Kernel auto-detected from span attributes.

### 🔬 Model Drift — Silent Degradation Detection

```
driftScore = min(100, (|current - baseline| / baseline) / threshold × 50)
```
Weighted across: latency (25%), output tokens (15%), error rate (20%), p95 latency (15%), input tokens (10%), efficiency (15%)

Auto-baseline: last 7–14 days vs last 7 days. Manual baseline capture persisted in localStorage.

### 🔍 RAG / Vector DB — Pipeline E2E

- Query volume and embedding trends from `db.system` spans (Pinecone, ChromaDB, Qdrant, Weaviate, Milvus)
- Per-stage latency: retrieve → embed → augment → generate
- Top slowest traces with direct Distributed Traces deep-link
- Response latency by model (Excellent / Good / Fair / Slow by Apdex thresholds)

### 🔐 Adversarial Prompt Threat Intelligence

**Competitive differentiator** — No other observability platform (Datadog, LangSmith, Arize, Grafana) does AI-powered adversarial prompt classification in-platform.

| What We Do | How It Works |
|-----------|-------------|
| Detect authority impersonation | Users claiming admin/system privileges to override safety |
| Detect multi-stage extraction | Gradual context-building across prompts to extract secrets |
| Detect context manipulation | Instructions embedded in innocent-looking JSON/code/stories |
| Detect obfuscated PII harvesting | PII requested in encoded, reversed, or indirect forms |
| Detect roleplay escalation | Fiction/roleplay framing to bypass safety guidelines |
| Detect indirect injection | Malicious instructions smuggled through external data or tools |
| Detect goal hijacking | Subtly redirecting the model away from its intended purpose |
| Detect token smuggling | Unicode tricks, homoglyphs, zero-width character manipulation |

**How it works:** Davis CoPilot semantically classifies each prompt (not regex). Behavioral context (anomalous time-of-day, velocity spikes) is correlated. Findings can generate Dynatrace Workflows with one click.

**Positioning:** "Others monitor tokens. We monitor **intent**."

| Competitor | What They Do | Our Edge |
|-----------|-------------|----------|
| **Lakera Guard** | Real-time prompt firewall | We **correlate** threats with infrastructure (latency, errors, service dependencies) |
| **LangSmith** | Prompt tracing + eval | No adversarial detection at all |
| **Arize Phoenix** | LLM tracing | No security features |
| **Datadog LLM Obs** | Token/cost tracking | No adversarial classification |

---

## Installation

### Prerequisites
- **Node.js 18+** (22+ recommended)
- **Minimum 8 GB RAM** available for the build process
- Dynatrace environment with Apps enabled (AppEngine)
- AI services instrumented with OpenTelemetry GenAI semantic conventions (`gen_ai.*` spans)
- `dt-app` CLI (installed via `npm install` as devDependency)

### Clone & Install

```bash
git clone https://github.com/pushpendrasinghbaghel-ai/genai-control-center.git
cd genai-control-center/gcc
npm install
```

### ⚠️ Heap Memory Configuration (REQUIRED for Build)

The app has **23 pages, 43 hooks, and extensive type checking**. The default Node.js heap (1.7 GB) is **insufficient** — builds will crash with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`.

**Set the heap size before building:**

```bash
# Linux / macOS
export NODE_OPTIONS="--max-old-space-size=8192"

# Windows PowerShell
$env:NODE_OPTIONS="--max-old-space-size=8192"

# Windows CMD
set NODE_OPTIONS=--max-old-space-size=8192
```

**Recommended heap sizes:**

| Machine RAM | `--max-old-space-size` | Notes |
|-------------|----------------------|-------|
| 8 GB | `4096` | Minimum viable — may be slow |
| 16 GB | `8192` | Recommended for development |
| 32 GB+ | `16384` | Fast builds, comfortable for `tsc --watch` |

**Permanent setup** — add to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
export NODE_OPTIONS="--max-old-space-size=8192"

# PowerShell $PROFILE
$env:NODE_OPTIONS="--max-old-space-size=8192"
```

### Development Server

```bash
npm start        # Starts dt-app dev server with hot reload
                 # Opens at http://localhost:3000/ui
                 # In-environment: https://<your-tenant>.apps.dynatrace.com/ui/apps/local-dev-server/
```

> **Note:** `npm start` (dev server) typically works without extra heap. Only `npm run build` and `npx tsc --noEmit` require the increased heap.

### Build

```bash
# MUST set heap first (see above)
npm run build    # Outputs to dist/
```

### Deploy to Dynatrace

```bash
npm run deploy   # Deploys to environment configured in app.config.json
```

### All Commands

| Command | Purpose | Needs Heap? |
|---------|---------|-------------|
| `npm start` | Dev server with hot reload | No |
| `npm run build` | Build app package | **Yes** — set `NODE_OPTIONS` first |
| `npm run deploy` | Deploy to Dynatrace environment | **Yes** — runs build internally |
| `npm run lint` | ESLint with security plugins | No |
| `npx tsc --noEmit` | Type check only | **Yes** — for full 43-hook codebase |

### Required Scopes (`app.config.json`)

20 scopes declared — grouped by function:

| Category | Scope | Purpose |
|----------|-------|---------|
| **Data** | `storage:spans:read` | Core — gen_ai.* span discovery |
| | `storage:bizevents:read` | Prompt audit trail, training job events |
| | `storage:metrics:read` | gen_ai.client.token.usage metrics |
| | `storage:logs:read` | Log-based AI analysis |
| | `storage:events:read` | Davis problems |
| | `storage:entities:read` | Entity filtering |
| | `storage:buckets:read` | Data bucket access |
| **Filtering** | `storage:filter-segments:read` | FilterBar segment persistence |
| | `storage:filter-segments:write` | FilterBar segment persistence |
| **Automation** | `automation:workflows:read` | Read workflow definitions |
| | `automation:workflows:run` | Execute remediation workflows |
| | `automation:workflows:write` | Create workflows (threat intelligence, alerts) |
| **Davis AI** | `davis-copilot:nl2dql:execute` | Natural language → DQL |
| | `davis-copilot:dql2nl:execute` | DQL → natural language explanation |
| | `davis-copilot:conversations:execute` | Davis Assist + adversarial classification |
| | `davis:analyzers:execute` | Forecasting, anomaly detection |
| | `davis:analyzers:read` | List available analyzers |
| **Documents** | `document:documents:read` | Rate card + configuration persistence |
| | `document:documents:write` | Save configuration |
| | `document:documents:delete` | Remove configuration |

---

## Provider Data Completeness

Validated via live MCP DQL queries against `demo.apps.dynatrace.com`:

| Provider | Tokens | Latency | Errors | Prompt Content | BizEvents |
|----------|--------|---------|--------|----------------|-----------|
| **OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |
| **Azure OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |
| **Amazon Bedrock** | ✅ Full | ✅ Full | ✅ Full | ⚠️ null on direct SDK | ✅ CloudTrail |
| **Google VertexAI** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ LangChain only | ❌ None |
| **Ollama** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |

> **Data honesty note:** TCoAI infrastructure cost requires `cost.list.price` BizEvent ingestion (not available in all environments). Training cost is estimated from job count × hardcoded AWS Bedrock rate table — not actual billing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| UI Kit | @dynatrace/strato-components[-preview] v3.1 (Strato Design System) |
| Design Tokens | @dynatrace/strato-design-tokens v1.3 |
| Icons | @dynatrace/strato-icons v2.1 |
| Data Layer | DQL via @dynatrace-sdk/client-query v1.22 |
| AI Integration | Davis CoPilot via @dynatrace-sdk/client-davis-copilot v1.0 |
| Automation | Workflows via @dynatrace-sdk/client-automation v6.0 |
| Navigation | Intent links via @dynatrace-sdk/navigation v2.1 |
| Formatting | Locale-aware via @dynatrace-sdk/user-preferences v1.1 |
| Build | dt-app CLI v1.8.1 |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     GenAI Control Center                            │
├─────────────────┬──────────────────────┬────────────────────────────┤
│  OBSERVE        │  ANALYZE             │  ACT                       │
│  Home           │  Analytics           │  Intelligence              │
│  Services       │  Prompt Governance   │  Operations                │
│  FinOps         │  Policies/Compliance │  Security Audit            │
│  Agents         │  Drift               │  Threat Intelligence       │
│  Topology       │  AI Quality          │  Provider Failover         │
│  RAG / VectorDB │  Conversations       │  Integrations Hub          │
│  MLOps          │  Developer Exp       │  Data Playground           │
│  Infrastructure │  AI Architect        │                            │
├─────────────────┴──────────────────────┴────────────────────────────┤
│             43 Custom React Hooks  │  14 Shared Components          │
├────────────────────────────────────────────────────────────────────┤
│   Dynatrace GRAIL (DQL) │ Davis CoPilot │ Davis Analyzers           │
│   Dynatrace Workflows   │ Document Store │ App State                │
│   Distributed Traces (intent nav) │ Entity Store                   │
└────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gcc/
├── app.config.json              # App ID, scopes, environment URL
├── package.json                 # Dependencies and scripts
├── eslint.config.mjs            # ESLint with security plugins
├── ui/
│   ├── main.tsx                 # Entry point
│   ├── app/
│   │   ├── App.tsx              # 27 routes (incl. 5 redirects)
│   │   ├── pages/               # 23 page components
│   │   ├── hooks/               # 43 custom hooks (data fetching, analysis)
│   │   ├── components/          # 14 shared UI components
│   │   ├── queries/             # Centralized DQL query definitions
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/
│   │   │   ├── formatting.ts    # Locale-aware formatters (MUST use these)
│   │   │   └── design-tokens.ts # Centralized color constants
│   │   ├── config/              # Provider profiles, rate cards
│   │   ├── context/             # React Context (FilterContext)
│   │   ├── workflows/           # Workflow templates
│   │   └── agent/               # AI orchestration layer
│   └── assets/                  # Icons, logos
├── mcp-server/                  # Optional MCP server for external integrations
├── docs/                        # User guide, demo scripts, roadmaps
└── scripts/                     # Build utility scripts
```

---

## Changelog

### v3.2.0 (April 2026)
- 🔐 **Threat Intelligence — Live Data** — Fixed DQL field mapping (`start_time`, `trace.id`); Davis AI adversarial classification now populates with real prompt data
- 🔐 **Threat Intelligence — FilterBar** — Standard FilterBar with TimeframeSelector (default 30 min), service/provider/model filtering
- 🔐 **Threat Intelligence — Create Workflow** — One-click Dynatrace Workflow creation from any threat finding
- 🔐 **Threat Intelligence — Performance** — Reduced from 200 to 50 prompts per scan; batch size optimized for Davis rate limits
- 📖 **README — Full Rewrite** — Aligned with actual 23-page/43-hook codebase; persona-based regional value narratives; heap memory installation guide

### v3.1.0 (April 2026)
- 🔍 **TCoAI Data Honesty** — Infrastructure layer shows NO DATA badge when `cost.list.price` BizEvents not ingested; Training layer shows ESTIMATED badge
- 💰 **FinOps — Context Window Creep** — Input/output ratio distribution (1–2x healthy, 5x+ waste) with per-model waste cost
- 💰 **FinOps — Time-of-Day Heatmap** — 24-bucket hourly aggregation, peak/trough ratio, top-4-hours cost concentration
- 💰 **FinOps — Model Quality-Need Matching** — MMLU benchmark tier alignment, over-provisioning detection
- 🔒 **Prompt Governance — Strato Compliance** — 50+ hardcoded color violations → CSS variables; all raw HTML → Strato components
- 🔒 **Prompt Governance — Pagination** — Prompts, error spans, and audit trail all paginated at 25 rows/page
- 🎨 **Prompt Governance — Dark Mode** — All hardcoded colors → CSS status tokens that auto-adapt to light/dark theme

### v3.0.0 (March 2026)
- Initial release: 23 pages, 27 routes, 43 custom hooks, 14 shared components
- MLOps, AI Quality, Conversation Intelligence, Developer Experience, Security Audit Trail, Provider Status & Failover, Threat Intelligence, Data Playground
- Agent Tools: 5-tab incidents-first dashboard with loop detection, context overflow, cost spikes
- VectorDB: embedding provider breakdown, semantic cache detection
- 100% Strato Design System compliance: centralized formatting.ts and design-tokens.ts
# GenAI Control Center (GCC)

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

---

## Why GenAI Control Center?

> **AI is going to production — and nobody knows what it's costing, whether it's working, or whether it's safe.**

GenAI Control Center is the single pane of glass for everyone who owns, operates, or is accountable for AI in production. It auto-discovers every AI service instrumented with OpenTelemetry GenAI semantic conventions and turns raw `gen_ai.*` spans into decisions: where is money being wasted, which models are drifting, which prompts carry security risk, and where your agents are looping.

Unlike dashboards that show infrastructure metrics alongside AI, GCC is AI-native from the ground up — built on the same GRAIL database that already holds your logs, traces, and metrics, so you get AI observability without a separate data store, a separate billing tool, or a separate security scanner.

**Three things that make it different:**
1. **No synthetic data** — every metric comes from real OTel spans queried live via DQL
2. **Persona-first UX** — FinOps engineers, SREs, security teams, and ML engineers each get a purpose-built view, not a generic table dump
3. **Act, don't just observe** — Davis CoPilot, workflow automation, and one-click remediation are built in, not bolted on

---

## Who Is This For?

### 💰 FinOps Engineer
*"I need to show my CFO exactly what we're spending on AI and justify every dollar."*

- Real-time token spend by provider, model, and service — not estimates
- Total Cost of AI Ownership (TCoAI) iceberg: token cost + infra + training in one view
- Budget breach ETA with burn rate forecasting
- Context Window Creep detection — the hidden cost of ballooning input/output ratios
- Time-of-day cost heatmaps to shift workloads off-peak
- Chargeback/showback by business unit

**Start at:** [FinOps →](/finops)

---

### 🛡️ Security & Compliance Officer
*"How do I audit every AI interaction and prove we're not leaking PII or exposing our models to injection attacks?"*

- Per-prompt security analysis: PII, injection, hallucination, bias — from real span data
- Davis AI semantic scoring for nuanced risk that regex misses
- Tamper-resistant audit trail of every model invocation, paginated and sortable
- Provider risk scoring: data residency, certifications, compliance posture
- Governance policy compliance score with policy-by-policy breakdown

**Start at:** [Governance →](/governance)

---

### 🔧 Site Reliability Engineer
*"My AI services have no SLOs. I can't tell if they're healthy until users complain."*

- Auto-discovered AI service health with error rate, latency, and throughput
- Davis-standard anomaly detection applied to AI workloads
- One-click Distributed Traces deep-link from any service, agent, or prompt
- Provider failover readiness score — know before you need it
- Real-time problem feed from Davis AI

**Start at:** [Services →](/services), [Operations →](/operations)

---

### 🤖 ML Engineer
*"Which model is actually delivering value? Are my agents efficient or are they just burning tokens in loops?"*

- Industry-standard quality scoring (accuracy, latency, throughput, efficiency, reliability)
- Model drift detection with configurable baselines — catch silent degradation
- Agent tool analysis: loop detection, LLM/tool split, optimization scoring
- RAG pipeline E2E latency from retrieval → embedding → generation
- Token efficiency ranking and output consistency analysis

**Start at:** [Analytics →](/analytics), [Agents →](/agents), [Drift →](/drift)

---

### 🏗️ Platform / AI Infrastructure Engineer
*"I need to understand our AI topology, choose the right provider, and plan capacity."*

- Interactive Smartscape-style topology: service → agent → model → provider
- Cross-provider cost-per-token comparison with live data
- Model registry with version tracking, SLO monitoring, and cost attribution
- Instrumentation coverage gap analysis and shadow AI detection
- Infrastructure config snapshots and model version history

**Start at:** [Topology →](/topology), [MLOps →](/mlops), [Developer Exp →](/devex)

---

## What's Measured — All From Real gen_ai.* Spans

| Signal | OTel Source | Used For |
|--------|-------------|----------|
| Input tokens | `gen_ai.usage.input_tokens` | Cost, efficiency, context creep |
| Output tokens | `gen_ai.usage.output_tokens` | Quality, verbosity, cost |
| Model requested | `gen_ai.request.model` | Version tracking, cost routing |
| Model responded | `gen_ai.response.model` | Drift detection (requested ≠ responded) |
| Provider | `gen_ai.provider.name` | Multi-provider comparison, risk scoring |
| Finish reason | `gen_ai.response.finish_reason` | Truncation, stop, content filter analysis |
| Agent name | `gen_ai.agent.name` | Agent loop detection, efficiency scoring |
| Tool name | `gen_ai.tool.name` | Tool usage patterns, reliability metrics |
| Span duration | Trace duration | Latency SLOs, Apdex scoring |
| Span status | OTel span status | Error rates, reliability |
| DB system | `db.system` | Vector store / RAG pipeline detection |
| Business events | `gen_ai.auditing` | Audit trail, training job tracking |

---

## Application Structure

Navigation follows the **Observe → Analyze → Act** pattern:

| # | Page | Route | Value |
|---|------|-------|-------|
| 1 | 🏠 **Home** | `/` | Executive KPI rollup across all pillars |
| 2 | ⚕️ **Services** | `/services` | Auto-discovered AI services, health, deep links |
| 3 | 💰 **FinOps** | `/finops` | Spend, budget, forecasting, TCoAI, chargeback |
| 4 | 📊 **Analytics** | `/analytics` | Token efficiency, model ranking, output consistency |
| 5 | 🔒 **Governance** | `/governance` | PII/injection/audit trail/risk/compliance |
| 6 | 🔗 **Topology** | `/topology` | Interactive AI service → model → provider graph |
| 7 | 🤖 **Agents** | `/agents` | Incidents-first: loop detection, context overflow, cost spikes → agent health → tool intelligence |
| 8 | 🔍 **RAG** | `/vector-db` | Vector store pipeline, embedding trends, latency |
| 9 | 🔬 **Drift** | `/drift` | Model behavior drift, baseline comparison, alerts |
| 10 | 🧠 **Intelligence** | `/intelligence` | Davis CoPilot, NL to DQL, conversational analysis |
| 11 | 🔧 **MLOps** | `/mlops` | Model registry, SLOs, comparison, cost attribution |

### Overflow ("More" dropdown)

| Section | Page | Route | Value |
|---------|------|-------|-------|
| Observe | 📈 AI Quality | `/quality` | Composite quality scoring per model/service |
| Observe | 💬 Conversations | `/conversation` | Session-level AI interaction analytics |
| Observe | 👨‍💻 Developer Experience | `/devex` | Instrumentation gaps, shadow AI, SDK versions |
| Observe | 🏗️ Infrastructure | `/infrastructure` | Service configs, model version history |
| Govern | 📋 Policies & Compliance | `/governance` | Enterprise governance policy dashboard |
| Act | ⚙️ Operations | `/operations` | Runbooks, agentic workflow templates |
| Act | 🛡️ Security Audit | `/security` | Prompt security, incident response timeline |
| Act | 🔄 Provider Failover | `/provider-status` | Failover readiness, provider health |
| Act | 🔌 Integrations Hub | `/integrations` | Slack, PagerDuty, Prometheus, GitHub, Grafana |
| Advanced | 🔐 Threat Intelligence | `/threat-intelligence` | Adversarial prompt attack detection |
| Advanced | 📝 Data Playground | `/data` | DQL editor with GenAI presets |

---

## Key Capabilities — Deep Dive

### 💰 FinOps — Follow the Money

Five-tab narrative: **What it costs → Where → Is it worth it → Pay less → What's coming**

- **TCoAI Iceberg** — Token cost (real), infrastructure cost (requires BizEvent ingestion), training cost (estimated from job count × rate table)
- **Context Window Creep** — Distribution of input/output ratios; >5:1 flagged as waste
- **Time-of-Day Heatmap** — 24-hour cost concentration; identify peak and off-peak windows
- **Model Quality-Need Matching** — MMLU-benchmarked tier alignment: are flagship models doing simple tasks?
- **Cost Velocity** — Real-time burn rate, budget ETA, guardrail management
- **7/14/30-day Forecasting** — Davis-powered projections with confidence intervals

### 🔒 Governance — Observe, Audit, Enforce

- **Prompt Analysis** — Paginated security analysis (20/page) with per-category filters: PII, injection, hallucination, ungrounded, expensive, cacheable, bias
- **Davis AI Scoring** — Batch semantic risk scoring beyond regex patterns
- **Audit Trail** — Sortable `DataTable` with built-in pagination (25/page) for every model invocation
- **Policy Compliance** — 5 auto-generated policies from real data: multi-provider strategy, error threshold, latency SLA, data residency, model versioning
- **Provider Risk** — Data residency, certifications, dynamic risk adjustment from real error/latency data

### 🤖 Agent Tools — AI Agent Observability

**5-tab, incidents-first dashboard.** The narrative: *Three things silently destroy AI agent systems — runaway loops, context overflow, and tool failure cascades. Here's which of your agents are hitting them right now.*

**Primary personas:**

| Persona | Goes to first | Key question answered |
|---------|--------------|----------------------|
| 🚨 **SRE on-call** | Incidents tab | Is anything broken right now? |
| 🏗️ **Platform Engineer** | Agent Health | Are my agents passing SLO? |
| 🔧 **AI Engineer** | Tool Intelligence | Which tools are failing? |
| 🤖 **ML Engineer** | Trends | Is agent efficiency improving? |
| 👨‍💻 **Developer** | Investigate | What happened in this specific trace? |

**Five tabs:**

#### Incidents (default landing)
The "NOW" view — fires only when something needs attention:
- **Infinite Loop Alerts** — agents calling the same tool >10× in one trace; cost impact shown per incident
- **Context Window Near-Capacity** — models hitting >90% fill; silent quality degradation invisible to provider dashboards
- **Cost Spike Alerts** — hours exceeding 2× average spend with token/request context
- **All-clear state** — when no incidents exist, shows green "All agents healthy" confirmation

#### Agent Health
Are your agents meeting SLA?
- **Agent Success Rate** — DonutChart with industry benchmarks (>95% excellent, 85–95% acceptable)
- **Token Efficiency** — output/input ratio; low ratio = prompt bloat
- **Estimated AI Spend** — cost per LLM call with total
- **Avg Response Time** — end-to-end agent latency (Apdex-aligned: <2s excellent, <5s acceptable)
- **Time Distribution** — LLM vs tool time split DonutChart per agent
- **Agent Leaderboard** — ranked by success rate with color thresholds
- **Active Agents Table** — full DataTable with tool calls, token counts, LLM cost, LLM/tool split, trace deep-link
- **Optimization Advisor** — composite score (reliability 30%, efficiency 30%, latency 25%, retry 15%) with anti-pattern detection

#### Tool Intelligence
Which tools are failing your agents? (Requires `gen_ai.tool.name` attribute — empty-state guard surfaces instrumentation gap for LangChain/CrewAI deployments)
- **Agent Handoffs** — cross-agent delegation patterns with self-transfer detection
- **Agent Flow Efficiency** — repetitive pattern rate, token waste estimate, handoff latency, LLM/tool time ratio
- **Agent → Service Dependencies** — HTTP/DB/gRPC backends called by agents
- **Common Tool Flows** — frequent tool-call sequences with topology modal
- **Agent-Tool Map SVG** — Smartscape-style topology: edge thickness = call volume, red = high errors
- **Tool Call Frequency** — counts, duration, error rates per tool
- **Tool Reliability** — per-agent tool usage with retry detection (calls/trace > 1)
- **Agent → LLM Provider Map** — which provider/model each agent uses, with cost tracking

#### Trends
Is agent behavior improving or degrading?
- **Error Rate** — hourly timeseries with avg annotation
- **Agent Latency** — P50 + P95 dual-series (area/line)
- **Hourly Cost** — spend trend with breach detection
- **Token Consumption** — input vs output stacked bar timeseries
- **Tool Calls Over Time** — volume context for operations
- **Agent Activity** — per-agent invocation rates (top 6)
- **Context Window Utilization** — per-model fill % with near-capacity flags
- **Hourly Cost Table** — breach hours highlighted (>2× avg)

#### Investigate
Drill into a specific agent run:
- **Step Tracing** — spans per trace by type (task/tool/workflow/LLM), exit conditions (success/error/timeout/slow)
- **Multi-Agent Traces** — traces involving 2+ agents with parallelism detection
- **Cross-Agent Token Attribution** — LLM cost and token breakdown per agent in multi-agent traces
- **Conversation State** — single-turn vs multi-turn vs runaway (>20 turns) distribution
- **Context Growth** — token escalation across conversation turns with growth ratio

**Framework detection:** LangChain, CrewAI, Bedrock Agents, Semantic Kernel auto-detected from span attributes.

### 🔬 Model Drift — Silent Degradation Detection

```
driftScore = min(100, (|current - baseline| / baseline) / threshold × 50)
```
Weighted across: latency (25%), output tokens (15%), error rate (20%), p95 latency (15%), input tokens (10%), efficiency (15%)

Auto-baseline: last 7–14 days vs last 7 days. Manual baseline capture persisted in localStorage.

### 🔍 RAG / Vector DB — Pipeline E2E

- Query volume and embedding trends from `db.system` spans (Pinecone, ChromaDB, Qdrant, Weaviate, Milvus)
- Per-stage latency: retrieve → embed → augment → generate
- Top slowest traces with direct Distributed Traces deep-link
- Response latency by model (Excellent / Good / Fair / Slow by Apdex thresholds)

---

## Quick Start

### Prerequisites
- Node.js 16+ (22+ recommended)
- Dynatrace environment with Apps enabled
- AI services instrumented with OpenTelemetry GenAI semantic conventions (`gen_ai.*` spans)

### Installation

```bash
git clone https://github.com/pushpendrasinghbaghel-ai/genai-control-center.git
cd genai-control-center/gcc
npm install
npm start
```

### Deploy to Dynatrace

```bash
npm run deploy
```

### Required Scopes (`app.config.json`)

| Scope | Purpose |
|-------|---------|
| `storage:spans:read` | Core — gen_ai.* span discovery |
| `storage:bizevents:read` | Prompt audit trail, training job events |
| `storage:metrics:read` | gen_ai.client.token.usage metrics |
| `storage:logs:read` | Log-based AI analysis |
| `storage:events:read` | Davis problems |
| `storage:entities:read` | Entity filtering |
| `automation:workflows:*` | Remediation workflow execution |
| `davis-copilot:*` | NL → DQL, conversational analysis |
| `davis:analyzers:*` | Davis Intelligence scoring |
| `document:documents:*` | Rate card + configuration persistence |

---

## Provider Data Completeness

Validated via live MCP DQL queries against `demo.apps.dynatrace.com`:

| Provider | Tokens | Latency | Errors | Prompt Content | BizEvents |
|----------|--------|---------|--------|----------------|-----------|
| **OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |
| **Azure OpenAI** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |
| **Amazon Bedrock** | ✅ Full | ✅ Full | ✅ Full | ⚠️ null on direct SDK | ✅ CloudTrail auditing |
| **Google VertexAI** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ LangChain only | ❌ None |
| **Ollama** | ✅ Full | ✅ Full | ✅ Full | ✅ via LangChain | ✅ Auditing |

> **Data honesty note:** TCoAI infrastructure cost requires `cost.list.price` BizEvent ingestion (not available in all environments). Training cost is estimated from job count × hardcoded AWS Bedrock rate table — not actual billing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| UI Kit | @dynatrace/strato-components[-preview] (Strato Design System) |
| Design Tokens | @dynatrace/strato-design-tokens |
| Data Layer | DQL via @dynatrace-sdk/client-query |
| AI Integration | Davis CoPilot via @dynatrace-sdk/client-davis-copilot |
| Navigation (intents) | @dynatrace-sdk/navigation |
| Build | dt-app CLI |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     GenAI Control Center                            │
├─────────────────┬──────────────────────┬────────────────────────────┤
│  OBSERVE        │  ANALYZE             │  ACT                       │
│  Home           │  Analytics           │  Intelligence              │
│  Services       │  Governance          │  Operations                │
│  FinOps         │  Drift               │  Security Audit            │
│  Agents         │  AI Quality          │  Provider Failover         │
│  Topology       │  Conversations       │  Integrations Hub          │
│  RAG / VectorDB │  Developer Exp       │  Threat Intelligence       │
│  MLOps          │  AI Architect        │                            │
│  Infrastructure │                      │                            │
├─────────────────┴──────────────────────┴────────────────────────────┤
│             34 Custom React Hooks  │  14 Shared Components          │
├────────────────────────────────────────────────────────────────────┤
│   Dynatrace GRAIL (DQL) │ Davis CoPilot │ Davis Analyzers           │
│   Dynatrace Workflows   │ Document Store │ App State                │
│   Distributed Traces (intent nav) │ Entity Store                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Development

```bash
npm start        # Dev server with hot reload
npm run build    # Build app package
npm run deploy   # Deploy to Dynatrace environment
npm run lint     # ESLint with security plugins
```

---

## Changelog

### v3.1.0 (April 2026)
- 🔍 **TCoAI Data Honesty** — Infrastructure layer shows NO DATA badge when `cost.list.price` BizEvents not ingested; Training layer shows ESTIMATED badge with tooltip explaining hardcoded rate table
- 💰 **FinOps — Context Window Creep** — Input/output ratio distribution (1–2x healthy, 5x+ waste) with per-model waste cost
- 💰 **FinOps — Time-of-Day Heatmap** — 24-bucket hourly aggregation, peak/trough ratio, top-4-hours cost concentration
- 💰 **FinOps — Model Quality-Need Matching** — MMLU benchmark tier alignment, over-provisioning detection
- 🔒 **Governance — Value Narrative Banner** — Explains data provenance (real gen_ai.* spans)
- 🔒 **Governance — DataTable Audit Trail** — Replaces hand-rolled flex rows; sortable, 25/page, built-in empty state
- 🎨 **Governance — Strato Compliance** — All rgba() → CSS variable tokens, ul/li → MessageContainer+Flex, getStatusIcon → real Strato icons
- 🔒 **Prompt Governance — Strato Compliance** — 50+ hardcoded color/opacity violations → CSS variables; all `<pre>` → `<Text>` with monospace; `textStyle="*-emphasized"` → `fontWeight: 600`; `Button variant="accent"` → `"emphasized"`
- 🔒 **Prompt Governance — Pagination** — Prompts, error spans, and audit trail all paginated at 25 rows/page with Prev/Next controls (was: hard-capped slices)
- 🔒 **Prompt Governance — Value Narrative Banner** — Detect / Audit / Score three-pillar framing with persona context
- 🎨 **Prompt Governance — Dark Mode** — All `rgba()` + `color:'white'` + `backgroundColor:'orange'` → proper CSS status tokens that auto-adapt to light/dark theme

### v3.0.0 (March 2026)
- MLOps Dashboard, AI Quality Dashboard, Conversation Intelligence, Developer Experience, Security Audit Trail, Provider Status & Failover, Threat Intelligence, Data Playground
- Agent Tools: token usage, LLM cost, LLM/tool time split per agent, optimization scoring
- VectorDB: embedding provider breakdown, semantic cache detection
- 25 routes + 3 redirects, 34 custom hooks, 14 shared components
- 100% Strato Design System compliance: centralized formatting.ts and design-tokens.ts
