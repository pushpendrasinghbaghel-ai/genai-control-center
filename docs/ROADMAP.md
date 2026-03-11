# GenAI Control Center - Product Roadmap

> **Last Updated:** February 25, 2026  
> **Version:** v3.0.0  
> **Status:** Active Development

---

## 📋 Executive Summary

This roadmap is based on comprehensive research from **McKinsey State of AI 2025**, **Deloitte State of AI 2026**, **Viatris Enterprise AI Metrics Assessment** (Feb 2026), **Competitive Landscape Analysis** of Arize AX/Phoenix, Opik (Comet), Langfuse, LangSmith, Helicone, W&B Weave, and Datadog LLM Observability (Feb 2026), and validation against **Dynatrace Grail** data availability. Features are prioritized by:
1. **Data Availability** - Does the data exist in Dynatrace Grail?
2. **Business Value** - Does it address real customer pain points?
3. **Differentiation** - Does it set GCC apart from competitors?
4. **Enterprise Coverage** - Does it close gaps identified in the Viatris 134-metric assessment?
5. **Competitive Parity** - Does it close gaps vs. Arize, Opik, Langfuse, LangSmith, and Datadog LLM Obs?

---

## 🎯 Vision

Transform GCC from an AI observability tool into a **strategic AI control plane** that helps enterprises:
- **Govern** autonomous AI agents
- **Optimize** AI spend and performance
- **Ensure** quality and security of AI outputs
- **Scale** from pilot to production confidently

---

## 📊 Industry Context (Research Summary)

### McKinsey State of AI 2025
- 2/3 of organizations still not scaling AI beyond pilots
- Only 20% have mature agentic AI governance
- 51% experienced negative AI consequences (inaccuracy, compliance)
- High performers redesign workflows (3x more impact)

### Deloitte State of AI 2026
- Agentic AI usage to surge, but guardrails lag
- 67% view sovereign AI as strategically important
- Only 34% truly reimagining business with AI
- AI skills gap is #1 barrier to integration

---

## 🏆 Competitive Landscape Analysis (Feb 25, 2026)

> **Scope:** Deep research into 7 leading AI observability platforms — Arize AX/Phoenix, Opik (Comet), Langfuse, LangSmith, Helicone, W&B Weave, and Datadog LLM Observability. Research conducted via official documentation, GitHub repositories, and product pages. All platforms evaluated against GCC's current feature set.

### Competitor Overview

| Tool | Type | Stars | Key Strengths | Target Users |
|------|------|-------|--------------|--------------|
| **Arize AX / Phoenix** | OSS + Cloud | ~12k | Tracing, evals, hallucination detection, AI copilot (Alyx) | AI Engineers, PM |
| **Opik by Comet** | OSS + Cloud | 17.8k | LLM-as-judge, eval datasets, agent optimizer, guardrails, 50+ integrations | ML Engineers |
| **Langfuse** | OSS + Cloud | 22k | Prompt management, sessions, annotation queues, RBAC, CI/CD integration | Full LLM stack teams |
| **LangSmith** | Cloud | N/A | Agent tracing, conversation clustering, insights AI agent, dataset experiments | LangChain ecosystem |
| **Helicone** | OSS + Cloud | ~8k | AI gateway/proxy, cost tracking, caching, 100+ model routing | Developers, startups |
| **W&B Weave** | OSS + Cloud | N/A | Evaluation leaderboards, online evals, multi-modal, agent graphs, inference | ML researchers, teams |
| **Datadog LLM Obs** | Enterprise | N/A | Full-stack infra+LLM, cluster maps, prompt injection detection, APM correlation | Enterprise |

### Feature Coverage Matrix

| Feature Category | Arize | Opik | Langfuse | LangSmith | Helicone | W&B Weave | Datadog | **GCC** |
|-----------------|:-----:|:----:|:--------:|:---------:|:--------:|:---------:|:-------:|:-------:|
| **Tracing & Observability** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cost / Token Monitoring** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multi-Provider Comparison** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Agentic AI Tracing** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Infra + LLM Correlation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Auto Anomaly Detection (AI)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| **Workflow Automation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| **RAG / Vector DB Observability** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ⚠️ | 📋 |
| **LLM-as-a-Judge Evaluations** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Evaluation Datasets** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Experiment / A-B Model Testing** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Online Evaluation Rules** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Annotation Queues (Human Review)** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Evaluation Leaderboards** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Conversation / Session Tracking** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Conversation Clustering / Topics** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Prompt Version Control + A/B** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Interactive Prompt Playground** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Hallucination Score (eval metric)** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Toxicity / Safety Scoring** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **CI/CD LLM Testing (PyTest/hooks)** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **MCP Protocol Tracing** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **AI Gateway / LLM Proxy** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Agent Optimizer (auto prompt opt.)** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Spend Alerts / Cost Budgets** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **RBAC / SSO / SCIM** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Audit Logs** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Multi-modal (image/audio/code)** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Agent Visual Graph View** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Data Export (blob / S3 / GCS)** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

> ✅ = Available | ⚠️ = Partial | ❌ = Not Available | 📋 = On GCC Roadmap

### GCC Competitive Gaps — Grouped by Priority

| Group | Description | Competitors that have it | GCC Priority |
|-------|-------------|--------------------------|-------------|
| **A — Evaluation Engine** | LLM-as-judge scoring, hallucination/toxicity/relevance evals, eval datasets, experiments, online rules, annotation queues | All 7 | 🔴 Critical |
| **B — Conversation Intelligence** | Session/multi-turn tracking, conversation clustering, topic analysis, failure-to-answer | Arize, Opik, Langfuse, LangSmith, W&B, Datadog | 🔴 High |
| **C — Prompt Engineering Tooling** | Prompt playground (interactive), version control, A/B testing | All 7 | 🟡 High |
| **D — Modern Protocols** | MCP server tracing, CI/CD eval hooks | Langfuse, W&B, Datadog | 🟡 Medium |
| **E — Spend Management** | Cost budget alerts, threshold notifications, per-team cost budgets | Langfuse, LangSmith, Helicone, Datadog | 🟡 Medium |
| **F — Enterprise Governance** | RBAC, audit logs, data export, tenant isolation | Langfuse, LangSmith, W&B, Datadog | 🟠 Enterprise |

### GCC Unique Differentiators (vs ALL competitors)

These are capabilities that GCC has by virtue of being built on Dynatrace — **no competitor matches this**:

1. **Full-stack infra+LLM correlation** — GPU → K8s pod → service → LLM span chain in a single trace. No standalone AI observability tool can do this without a separate APM.
2. **Davis AI causal analysis** — Automatic root cause analysis using Dynatrace's Davis AI engine (not just pattern matching). Competitors use simple alerting.
3. **Zero-config ingest via OpenTelemetry** — No SDK changes required; Dynatrace auto-instruments LLM calls through existing OneAgent + OTel pipeline.
4. **Workflow Automation (built-in remediation)** — One-click Dynatrace Workflows to auto-remediate AI incidents. No competitor has native workflow automation.
5. **Grail-scale data** — 572K+ GenAI spans/week already flowing with zero configuration. Competitors require explicit SDK setup per framework.
6. **Davis CoPilot chat integration** — Native AI assistant for DQL queries and root cause analysis, built into the same platform.
7. **Unified observability across ALL services** — AI services correlated with non-AI backend services, databases, and infrastructure in one console.

---

## ✅ Current Capabilities (v2.4.0)

| Page | Status | Description |
|------|--------|-------------|
| 🏠 Home | ✅ Complete | Executive dashboard with KPIs |
| 💚 Health Dashboard | ✅ Complete | Service health monitoring |
| 🔗 AI Topology | ✅ Complete | Service→Provider→Model visualization |
| 🤖 Agent Tools | ✅ Complete | Agent/tool monitoring, loop detection |
| 📉 Model Drift | ✅ Complete | Drift scoring, baseline comparison |
| 💰 FinOps | ✅ Complete | Cost tracking, forecasting |
| 🛡️ Governance | ✅ Complete | Compliance, provider risk |
| 🔒 Prompt Governance | ✅ Complete | PII, injection detection |
| 📊 Response Analytics | ✅ Complete | Token efficiency, model comparison |
| 🤖 Intelligence | ✅ Complete | Davis CoPilot integration |
| ⚙️ Operations | ✅ Complete | Runbooks, remediation |
| 🚨 Real-Time Alerts | ✅ Complete | Davis problems for AI services |
| 🔍 RAG / Vector DB | ✅ Complete | Pinecone + embedding + RAG pipeline + response latency by model |

---

## 🚀 Roadmap Items

### Legend
- 🟢 **GREEN** = Data exists, high confidence
- 🟡 **YELLOW** = Partial data, some limitations
- 🔴 **RED** = No data, not recommended
- ✅ = Completed
- 🔄 = In Progress
- 📋 = Planned
- ❌ = Cancelled (no data)

---

## Phase 1: Agentic AI & Cost Intelligence (Week 2)

### 1.1 Enhanced Agentic AI Governance
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Agent Performance Dashboard | `traceloop.entity.name`, `traceloop.span.kind="task"` | 📋 | 62k supervisor calls available |
| Tool Reliability Metrics | `traceloop.span.kind="tool"` | 📋 | 7 tools, 34k calls detected |
| Workflow Tracking | `traceloop.span.kind="workflow"` | 📋 | LangGraph data exists |
| Loop Detection Alerts | Task count per trace | 📋 | Max 103 tasks/trace detected |
| Agent Handoff Visualization | `transfer_to_*` tools | 📋 | 9k+ handoff calls |
| Supervisor Pattern Analysis | `traceloop.entity.name="supervisor"` | 📋 | 62k supervisor spans |

#### DQL Queries Validated
```dql
-- Agent tracking
fetch spans | filter traceloop.span.kind == "task" 
| summarize by: { traceloop.entity.name }

-- Tool tracking  
fetch spans | filter traceloop.span.kind == "tool"
| summarize by: { traceloop.entity.name }

-- Loop detection
fetch spans | filter traceloop.span.kind == "task"
| summarize total_tasks = count(), by: { trace.id }
| filter total_tasks > 20
```

#### Not Feasible (No Data)
- ❌ Autonomy level configuration (no data)
- ❌ Guardrail enforcement (needs app-level state)
- ❌ Human-in-the-loop gates (no approval data)

---

### 1.2 Cost Forecasting with Davis Analyzers
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v3.0.0)

> Implemented: Real Davis `GenericForecastAnalyzer` integration per [official Dynatrace Intelligence guide](https://developer.dynatrace.com/develop/guides/forecast-with-dynatrace-intelligence/). Features polling for long-running executions, `convertToTimeseriesBand` for proper output parsing, band chart visualization with confidence intervals, and linear fallback when analyzer is unavailable.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Davis-Powered Forecasting | `GenericForecastAnalyzer` | ✅ | Polling + `convertToTimeseriesBand` per official guide |
| Confidence Band Chart | `TimeseriesChart.Band` | ✅ | Shows prediction interval from analyzer |
| 7/14/30-Day Projections | Analyzer output → daily aggregation | ✅ | Cards with confidence levels |
| Budget Breach ETA | Forecast + threshold | ✅ | Cumulative cost vs budget limit |
| Linear Fallback | Local calculation | ✅ | 0.7%/day growth when analyzer unavailable |
| Token Usage Trends | `gen_ai.usage.input_tokens/output_tokens` | ✅ | Full timeseries data |
| Provider Cost Comparison | Tokens × pricing model | ✅ | 6 providers tracked |

#### Davis Analyzers Available
- `dt.statistics.GenericForecastAnalyzer` — ✅ **Wired** (cost forecast with polling)
- `dt.statistics.anomaly_detection.AutoAdaptiveAnomalyDetectionAnalyzer` — SDK ready in `davisAnalyzers.ts`
- `dt.statistics.anomaly_detection.SeasonalBaselineAnomalyDetectionAnalyzer` — SDK ready in `davisAnalyzers.ts`
- `dt.statistics.anomaly_detection.StaticThresholdAnomalyDetectionAnalyzer` — SDK ready in `davisAnalyzers.ts`

#### Dynatrace Intelligence Integration Roadmap
Based on analysis of reference implementations, the following Davis Intelligence features are planned:

| Feature | Analyzer / Service | Priority | Status | Target |
|---------|-------------------|----------|--------|--------|
| Token/Cost Spike Detection | `AutoAdaptiveAnomalyDetectionAnalyzer` | P1 | 📋 Planned | Health Dashboard |
| Deployment Regression Detection | `NoveltyScoreAnalyzer` | P2 | 📋 Planned | Infrastructure |
| Business-Hour Pattern Anomalies | `SeasonalBaselineAnomalyDetectionAnalyzer` | P2 | 📋 Planned | Health Dashboard |
| Composite Health Analysis | All analyzers in parallel | P2 | 📋 Planned | Health Dashboard |
| Root Cause Analysis via Copilot | Davis Copilot conversations | P3 | 📋 Planned | Davis Assistant |

---

### 1.3 Prompt Engineering Insights
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v2.9.0)

> Implemented: Prompt Pattern Analysis section in PromptGovernance page showing top repeated patterns ranked by call count, token efficiency %, avg latency, and estimated cache savings per pattern.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| System Prompt Templates | `gen_ai.prompt.0.content` | 📋 | Templates detected |
| Repetitive Prompt Detection | Prompt grouping | 📋 | 31k+ identical prompts |
| Cache Candidates | High-frequency prompts | 📋 | Can identify |
| Token Efficiency Scoring | Input/output ratio | 📋 | Data available |
| PII Pattern Detection | `matchesPhrase()` | 📋 | Regex available |
| Injection Pattern Detection | Keyword matching | 📋 | "ignore", "bypass" etc. |

#### Sample Data Found
- FAQ agent system prompt: 31,616 occurrences
- Flight agent system prompt: 12,429 occurrences
- Location queries (city names): 11k+ each

---

## Phase 2: Quality & Incident Management (Week 3)

### 2.1 AI Quality & Reliability Metrics
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Model Version Tracking | `gen_ai.request.model` vs `gen_ai.response.model` | 📋 | 66k mismatches detected |
| Response Variance Analysis | Completion grouping | 📋 | Possible via prompt groups |
| Output Length Monitoring | Token counts | 📋 | Available |
| Model A/B Comparison | 22 models with metrics | 📋 | Full data |

#### Limitations
- ⚠️ No semantic similarity scoring (would need embeddings)
- ⚠️ No groundedness metrics (no source citations)
- ⚠️ No user feedback data (no thumbs up/down)

---

### 2.2 Incident Correlation & RCA
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Davis Problems for AI | `dt.davis.problems` | 📋 | 10+ problems detected |
| Affected Entity Mapping | `affected_entity_ids` | 📋 | Service correlation |
| Blast Radius Calculation | Entity relationships | 📋 | Available |
| Problem Timeline | `event.start`, `event.end` | 📋 | Full history |

#### DQL Validated
```dql
fetch dt.davis.problems, from: now()-7d
| filter contains(toString(affected_entity_ids), "SERVICE-E549607993D1A67C")
| fields event.id, event.name, event.category, affected_entity_ids
```

---

### 2.3 Security Posture (Basic)
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Prompt Injection Detection | Pattern matching | 📋 | Keywords available |
| PII Detection (Enhanced) | Regex patterns | 📋 | Email, SSN, phone |
| Large Response Flagging | Output token threshold | 📋 | Can detect |
| Suspicious Pattern Alerting | Davis integration | 📋 | Possible |

#### Not Feasible
- ❌ API key hygiene tracking (no credential data)
- ❌ Threat intelligence feeds (external source needed)
- ❌ Model poisoning detection (no training data)

---

## Phase 3: Maturity & Developer Experience (Week 4)

### 3.1 AI Maturity Score (Proxy Metrics)
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** ✅ Completed (v2.9.0)

> Implemented: Live maturity score on Home dashboard scoring 5 dimensions (Coverage, Reliability, Efficiency, Governance, Observability) from live telemetry. Shows numeric score + maturity level (Initial/Developing/Established/Advanced) with per-dimension progress bars.

#### Proposed Scoring Model
| Dimension | Weight | Metrics |
|-----------|--------|---------|
| Coverage | 20% | # services, # models, # providers |
| Reliability | 25% | Error rate, latency P95 |
| Efficiency | 20% | Token efficiency, cache hit rate |
| Governance | 20% | Prompt flagging rate, PII incidents |
| Observability | 15% | Trace coverage, metadata completeness |

**Note:** This is a proxy score derived from available metrics, not true business maturity.

---

### 3.2 Developer Experience Improvements
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Deep Link to Traces | `trace.id`, `span.id` | 📋 | Available |
| Service Entity Linking | `dt.entity.service` | 📋 | Works |
| Model Selection Guide | Performance comparison | 📋 | 22 models |
| Instrumentation Coverage | Span field analysis | 📋 | Can calculate |

---

---

## 📊 Viatris Enterprise AI Metrics — Gap Analysis (Feb 24, 2026)

> **Source:** Viatris Metrics.xlsx — 134 metrics across 6 domains
> **Methodology:** Cross-referenced against Dynatrace Grail data, GCC code, and roadmap

### Coverage Summary

| Domain | Total Metrics | Already Built | Buildable Now | Blocked (No Data) | On Roadmap |
|---|---|---|---|---|---|
| **1. App & Model Inference Telemetry** | 22 | **20 (91%)** | 1 | 1 | 1 |
| **2. Agent & Workflow Tracing** | 22 | **13 (59%)** | 3 | 3 | 3 |
| **3. RAG / Retrieval & Vector DB** | 18 | **0 (0%)** | 6 | 12 | — |
| **4. Quality, Safety & Policy** | 22 | **4 (18%)** | 1 | 17 | Phase 0 |
| **5. Governance, Audit & Compliance** | 19 | **5 (26%)** | 4 | 10 | Phase 0/4 |
| **6. Platform & Dependency Health** | 31 | **12 (39%)** | 10 | 3 | — |
| **TOTAL** | **134** | **54 (40%)** | **25 (19%)** | **46 (34%)** | **9 (7%)** |

### Key Findings

1. **Domain 1 (Model Inference)** — Near-complete. Only TTFT display and precision/recall remain.
2. **Domain 3 (RAG/Vector DB)** — **Biggest gap.** Zero built despite ~115K Pinecone + ~113K embedding spans available. → **New Phase 5**
3. **Domain 6 (Platform Health)** — Dynatrace has all the infra data (GPU, CPU, K8s, SLO). GCC just doesn't surface it. → **New Phase 6**
4. **Domain 4 (Quality/Safety)** — 17 of 22 metrics blocked on instrumentation (guardrail events, eval scores, bias/toxicity). → **Phase 0 dependency**
5. **Domain 2 (Agent Tracing)** — Good coverage, but retries, intermediate outputs, and chain perf views are missing. → **Phase 5 enhancements**
6. **Domain 5 (Governance)** — Deployment events, SLO integration, AppSec linking are buildable now. → **New Phase 7**

### Metrics NOT on Current Roadmap (New Additions)

The following **25 buildable metrics** have Dynatrace data available but were not previously on the roadmap:

| # | Metric | Domain | Data Source | New Phase |
|---|---|---|---|---|
| 1 | Vector DB query volume & distribution | RAG | `pinecone.query` spans (115K/wk) | Phase 5 |
| 2 | Retrieval patterns (latency, throughput) | RAG | `pinecone.query` duration | Phase 5 |
| 3 | Embedding generation latency | RAG | `openai.embeddings`, `ollama.embeddings` spans | Phase 5 |
| 4 | RAG pipeline performance (E2E trace) | RAG | trace correlation: embed→retrieve→generate | Phase 5 |
| 5 | Retrieval anomalies | RAG | Davis anomaly analyzers on pinecone metrics | Phase 5 |
| 6 | Query latency (pinecone p50/p95/p99) | RAG | `duration` on `db.system=pinecone` spans | Phase 5 |
| 7 | Time to first token (TTFT) | Inference | `gen_ai.server.time_to_first_token` | Phase 5 |
| 8 | Retry monitoring | Agent | Duplicate spans per trace | Phase 5 |
| 9 | Intermediate agent outputs | Agent | Child span completions in trace | Phase 5 |
| 10 | Chain performance view | Agent | Trace-level multi-span aggregation | Phase 5 |
| 11 | GPU/TPU utilization | Platform | `gpu.utilization` metric (query exists) | Phase 6 |
| 12 | GPU load, memory, temperature | Platform | Host metrics via OneAgent | Phase 6 |
| 13 | Memory utilization | Platform | `dt.host.memory.*` metrics | Phase 6 |
| 14 | CPU usage | Platform | `dt.host.cpu.*` metrics | Phase 6 |
| 15 | Network bottlenecks | Platform | `dt.host.network.*` metrics | Phase 6 |
| 16 | Process usage | Platform | Process group metrics | Phase 6 |
| 17 | K8s workload visibility | Platform | K8s entity data + events | Phase 6 |
| 18 | Container metrics | Platform | Container entity metrics | Phase 6 |
| 19 | Service uptime/SLA performance | Platform | Dynatrace SLO API | Phase 6 |
| 20 | Infrastructure saturation | Platform | Resource contention events | Phase 6 |
| 21 | Serverless LLM endpoint availability | Platform | Service health + error tracking | Phase 6 |
| 22 | Managed vector store availability | Platform | Pinecone span errors + health | Phase 6 |
| 23 | Security vulnerabilities (AppSec) | Governance | Dynatrace AppSec data | Phase 7 |
| 24 | Deployment event tracking | Governance | Dynatrace deployment events | Phase 7 |
| 25 | Access control tracking | Governance | Dynatrace IAM / audit logs | Phase 7 |

---

## Phase 5: RAG / Vector DB & Agent Enhancements (NEW — Viatris Gap)

> **DRIVER:** Viatris Gap Analysis — Domain 3 (0% coverage) and Domain 2 enhancements
> **DATA STATUS:** 🟢 HIGH — Pinecone + embedding spans available in Grail today

### 5.1 RAG / Vector DB Observability Page
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

**New Page:** `/vector-db` | **New Hook:** `useVectorDB.ts`

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Pinecone Query Volume (timeseries) | `pinecone.query` spans | 📋 | ~115K/week available |
| Query Latency (avg, p50, p95, p99) | `duration` on `db.system=pinecone` | 📋 | Standard percentile query |
| Embedding Volume by Provider | `openai.embeddings`, `ollama.embeddings`, `vertexai` embedding spans | 📋 | ~113K/week across 4 providers |
| Embedding Model Comparison | Provider × model × latency × volume | 📋 | 9 embedding models detected |
| RAG Pipeline Trace View | `trace.id` correlation: embed→pinecone→LLM | 📋 | Full E2E trace available |
| Retrieval Anomaly Detection | Davis `AutoAdaptiveAnomalyDetectionAnalyzer` | 📋 | Analyzer available |
| Vector Store Health | Pinecone error rate, availability | 📋 | `span.status_code` on pinecone spans |
| Duplicate Query Detection (Cache Opportunity) | Prompt grouping heuristic | 📋 | Identifies cache candidates |

#### DQL Queries (Validated)
```dql
-- Vector DB query volume over time
fetch spans, from:now()-24h
| filter db.system == "pinecone"
| makeTimeseries queries = count(), interval: 1h

-- Pinecone latency percentiles
fetch spans, from:now()-24h
| filter db.system == "pinecone"
| summarize
    avg_latency = avg(duration),
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    query_count = count()

-- Embedding volume by provider/model
fetch spans, from:now()-24h
| filter contains(span.name, "embedding") OR contains(span.name, "embeddings")
| summarize cnt = count(), avg_latency = avg(duration),
    by: { gen_ai.provider.name, gen_ai.request.model }
| sort cnt desc

-- RAG pipeline trace correlation (embed → retrieve → generate)
fetch spans, from:now()-24h
| filter db.system == "pinecone" OR contains(span.name, "embedding")
    OR (isNotNull(gen_ai.provider.name) AND contains(span.name, "chat"))
| summarize
    span_types = collectDistinct(span.name),
    total_duration = sum(duration),
    span_count = count(),
    by: { trace.id }
| filter span_count >= 2
| sort total_duration desc
| limit 100
```

#### Not Feasible (No Data)
- ❌ Semantic cache hit/miss rates (no cache instrumentation)
- ❌ Retrieval relevance scores (no scores in span attributes)
- ❌ Vector match quality (no similarity scores)
- ❌ Source document metadata (not in span data)
- ❌ Tokenization/semantic drift (needs embedding comparison)
- ❌ Data ingestion metrics (no write-side instrumentation)
- ❌ Index performance (Pinecone infrastructure metrics not exposed)

#### Implementation Checklist
| Component | Effort | Status |
|-----------|--------|--------|
| DQL queries in `dql-queries.ts` | 2h | 📋 |
| Types in `types/index.ts` | 1h | 📋 |
| `useVectorDB.ts` hook | 3h | 📋 |
| `VectorDB.tsx` page | 4h | 📋 |
| Route + navigation | 0.5h | 📋 |
| **Total** | **~10.5h** | |

---

### 5.2 TTFT (Time to First Token) Display
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| TTFT metric card | `gen_ai.server.time_to_first_token` | 📋 | Add to HealthDashboard + ResponseAnalytics |
| TTFT by model comparison | Group by `gen_ai.request.model` | 📋 | Streaming responsiveness indicator |

---

### 5.3 Agent Tracing Enhancements
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Retry Monitoring | Duplicate task spans per trace | 📋 | Count repeated `traceloop.entity.name` per `trace.id` |
| Intermediate Agent Outputs | `gen_ai.completion.0.content` on child spans | 📋 | Show step-by-step reasoning in trace drill-down |
| Chain Performance View | Multi-span duration breakdown per trace | 📋 | Waterfall view of embed→retrieve→generate chain |
| Agent Collaboration Steps | Sequential task span ordering | 📋 | Enhance existing AgentTools flow view |

#### DQL Queries
```dql
-- Retry detection
fetch spans, from:now()-24h
| filter traceloop.span.kind == "task"
| summarize
    task_count = count(),
    unique_agents = countDistinct(traceloop.entity.name),
    by: { trace.id }
| filter task_count > unique_agents * 2
| sort task_count desc

-- Chain performance (per-step breakdown)
fetch spans, from:now()-24h
| filter isNotNull(traceloop.span.kind) OR db.system == "pinecone" OR contains(span.name, "embedding")
| summarize
    step_duration = avg(duration),
    step_count = count(),
    by: { span.name, traceloop.span.kind }
| sort step_duration desc
```

#### Not Feasible (No Data)
- ❌ Agent memory state tracking (no memory telemetry)
- ❌ A2A protocol monitoring (no A2A-specific attributes)
- ❌ Capability discovery (no structured capability data)
- ❌ Artifact creation tracking (no artifact events)

---

## Phase 6: Platform & Infrastructure Health for AI (NEW — Viatris Gap)

> **DRIVER:** Viatris Gap Analysis — Domain 6 (39% coverage, but Dynatrace has ~90% of the data)
> **DATA STATUS:** 🟢 HIGH — Standard Dynatrace metrics, just not surfaced in GCC

### 6.1 AI Infrastructure Dashboard
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v2.9.0)

> Implemented: New `/infrastructure` page with provider availability progress bars, AI service workload table (span volume, error rate, latency, models used), Davis problems table, and deployment events.

**New Page:** `/infrastructure` or section in existing Health page

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| GPU Utilization | `gpu.utilization` metric | 📋 | DQL query already defined in GCC |
| GPU Memory & Temperature | `gpu.memory.*`, `gpu.temperature` | 📋 | If OneAgent reports it |
| Host CPU/Memory for AI Services | `dt.host.cpu.usage`, `dt.host.memory.usage` | 📋 | Filter by hosts running GenAI services |
| Network Metrics | `dt.host.network.*` | 📋 | Bottleneck detection |
| Process Monitoring | Process group entity metrics | 📋 | AI service processes |
| Infrastructure Saturation Events | `dt.davis.problems` with `RESOURCE_CONTENTION` | 📋 | Already in RealTimeAlerts, filter for AI |
| Errors & Availability | Service availability checks | 📋 | 

#### DQL Queries
```dql
-- GPU utilization for hosts running GenAI services
timeseries avg(gpu.utilization), from:now()-24h, by: { host.name }
| filter isNotNull(avg_gpu.utilization)

-- Host resources for AI service entities
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.provider.name)
| summarize cnt = count(), by: { dt.entity.service }
| lookup [fetch dt.entity.service | fields id, entity.name, belongs_to[dt.entity.host]],
    sourceField: dt.entity.service, lookupField: id
| fields dt.entity.service, entity.name, belongs_to[dt.entity.host]
```

---

### 6.2 Kubernetes & Container Visibility
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| K8s Workload Status | K8s entity queries + events | 📋 | Link AI services to K8s workloads |
| Container Metrics | Container entity metrics | 📋 | CPU, memory per container |
| Pod Restart Tracking | K8s events (`PROCESS_RESTART`) | 📋 | For AI service pods |

#### DQL Queries
```dql
-- K8s events for AI-related workloads
fetch events, from:now()-24h
| filter event.kind == "K8S_EVENT"
| filter contains(toString(dt.entity.cloud_application), "ai") 
    OR contains(toString(dt.entity.cloud_application), "llm")
| sort timestamp desc
| limit 50
```

---

### 6.3 SLO & Dependency Health
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| SLA/SLO Performance for AI Services | Dynatrace SLO API | 📋 | If SLOs are configured |
| LLM Endpoint Availability | Error rate inversion (1 - error_rate) | 📋 | Per-provider availability % |
| Vector Store Availability | Pinecone error tracking | 📋 | Part of Phase 5 vector DB page |
| Third-party Integration Health | Provider-level health aggregation | 📋 | Enhance ProviderComparison page |

#### Not Feasible (No Data)
- ❌ Carbon footprint monitoring (no energy/carbon metrics in Dynatrace)
- ❌ Energy consumption patterns (no power data)
- ❌ Infrastructure temperature beyond GPU (host-level temp not standard)

---

## Phase 7: Enhanced Governance & Security (NEW — Viatris Gap)

> **DRIVER:** Viatris Gap Analysis — Domains 4 & 5 (buildable subset without Phase 0)
> **DATA STATUS:** 🟡 PARTIAL — Some Dynatrace platform data available

### 7.1 AppSec Integration for AI Services
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v2.9.0)

> Implemented: AppSec tab in Governance page showing OWASP LLM Top-10 findings (prompt injection, PII leakage, unvalidated outputs, excessive agent permissions, outdated SDKs) with severity/status badges.

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Security Vulnerabilities Linked to AI Services | Dynatrace AppSec / `dt.davis.security` | 📋 | Correlate vulns with AI service entities |
| Vulnerability Severity for AI Stack | `list_vulnerabilities` API | 📋 | Filter by AI service entity IDs |

#### DQL Queries
```dql
-- Vulnerabilities affecting AI services
fetch events, from:now()-30d
| filter event.kind == "SECURITY_EVENT"
| filter contains(toString(affected_entity_ids), "SERVICE-")
| summarize vuln_count = count(), by: { event.name, event.category }
| sort vuln_count desc
```

---

### 7.2 Deployment & Configuration Tracking
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Deployment Event Timeline | Dynatrace deployment events API | 📋 | Overlay on performance charts |
| Model Version Change Events | `gen_ai.request.model` vs `gen_ai.response.model` changes | 📋 | Already tracked in ModelDrift |
| Configuration Action Events | Davis custom events | 📋 | If customers push config events |

---

### 7.3 Compliance Enhancements
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Data Retention Visibility | Grail bucket retention policies | 📋 | Surface retention config info |
| Regulatory Framework Templates | Static content + compliance scoring | 📋 | EU AI Act, NIST AI, ISO 42001 checkboxes |
| Access Control Audit | Dynatrace IAM audit logs (if accessible) | 📋 | Who accessed AI services |

#### Not Feasible Without Phase 0 (Demo App Instrumentation)
- ❌ Guardrail executions & activations (needs `gen_ai.guardrail_triggered` events)
- ❌ Blocked prompts / denied topics / filtered content (no guardrail system)
- ❌ Hallucination detection — true eval (needs `gen_ai.eval.hallucination_score` attribute)
- ❌ Accuracy, relevance, grounding scores (needs eval framework instrumentation)
- ❌ Bias / toxic language / sentiment (needs NLP pipeline instrumentation)
- ❌ Data handling tags, policy indicators (needs `gen_ai.data.classification` attributes)
- ❌ Region & data-residency attributes (needs `cloud.region` instrumentation)
- ❌ A2A authorization tracking (needs A2A protocol telemetry)
- ❌ Training data documentation (no training pipeline connected)
- ❌ FIPS/FedRAMP tracking (needs compliance framework integration)

---

## Phase 4: Advanced Features (Week 5) - Requires Demo App

> ⚠️ **DEPENDENCY:** These features require Phase 0 (Reference Demo App) to be completed first.
> They are not data limitations of Dynatrace, but instrumentation gaps that the demo app will fix.

### 4.1 Business ROI Dashboard
**Priority:** P2 | **Feasibility:** 🟢 HIGH (after Phase 0) | **Status:** 📋 Blocked by Phase 0

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Revenue Attribution | `gen_ai.business_outcome` bizevent | 📋 | Links AI to purchases |
| Conversion Tracking | `outcome.type`, `outcome.status` | 📋 | Success rate by AI |
| AI vs Non-AI Comparison | `outcome.channel` | 📋 | Prove AI value |
| Time to Conversion | `outcome.time_to_conversion_ms` | 📋 | Efficiency metric |
| Customer LTV by AI Usage | User cohort analysis | 📋 | Long-term value |

#### Proposed Dashboard Widgets
```
┌─────────────────────────────────────────────────────────────────────┐
│                      AI BUSINESS ROI DASHBOARD                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  AI-Attributed   │  │  Conversion Rate │  │  Avg. Order      │  │
│  │    Revenue       │  │  (AI vs Non-AI)  │  │    Value         │  │
│  │   $2.4M MTD      │  │   34% vs 12%     │  │  $340 vs $220    │  │
│  │   ↑ 23% MoM      │  │   2.8x lift      │  │   1.5x lift      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │            Revenue Attribution by AI Agent                   │   │
│  │  flight_agent    ████████████████████████████████  $1.2M    │   │
│  │  hotel_agent     █████████████████████  $800K               │   │
│  │  activity_agent  ██████████  $400K                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │             Conversion Funnel (AI-Assisted)                  │   │
│  │                                                               │   │
│  │  Conversations Started        ██████████████████████  10,000 │   │
│  │  AI Recommendations Used      █████████████████  7,500       │   │
│  │  Checkout Initiated           ████████████  5,000            │   │
│  │  Booking Completed            ████████  3,400                │   │
│  │                                                               │   │
│  │  Conversion Rate: 34%                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### DQL Queries (Will Work After Phase 0)
```dql
-- Revenue by AI agent
fetch bizevents
| filter event.type == "gen_ai.business_outcome"
| filter outcome.status == "success"
| summarize 
    total_revenue = sum(outcome.revenue),
    conversion_count = count(),
    by: { agent = traceloop.entity.name }
| sort total_revenue desc

-- AI vs Non-AI conversion comparison
fetch bizevents
| filter event.type == "gen_ai.business_outcome"
| summarize 
    total = count(),
    successful = countIf(outcome.status == "success"),
    by: { channel = outcome.channel }
| fieldsAdd conversion_rate = (successful / total) * 100
```

---

### 4.2 User Feedback Analytics (RLHF Insights)
**Priority:** P2 | **Feasibility:** 🟢 HIGH (after Phase 0) | **Status:** 📋 Blocked by Phase 0

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Thumbs Up/Down Tracking | `feedback.rating` | 📋 | Real-time metrics |
| Satisfaction by Model | Feedback × model | 📋 | Model comparison |
| Response Quality Trends | Feedback over time | 📋 | Quality monitoring |
| Low-Rated Response Analysis | Linked prompts | 📋 | Debug bad responses |
| Feedback by Agent | Feedback × agent | 📋 | Agent comparison |

#### Proposed Dashboard Widgets
```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER FEEDBACK ANALYTICS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Satisfaction    │  │  Total Feedback  │  │  Response Rate   │  │
│  │    Score         │  │  Collected       │  │  (Gave Feedback) │  │
│  │    4.2 / 5.0     │  │    12,450        │  │     18%          │  │
│  │   👍 84% 👎 16%  │  │    ↑ 15% WoW     │  │   Target: 25%    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │          Satisfaction Score by Model                         │   │
│  │  gpt-4o           ████████████████████████████████  4.5/5   │   │
│  │  claude-3-sonnet  ██████████████████████████████  4.3/5     │   │
│  │  llama3.1:8b      ██████████████████████  3.8/5             │   │
│  │  mistral:7b       █████████████████████  3.6/5              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │      🔴 Low-Rated Responses (Needs Review)                   │   │
│  │                                                               │   │
│  │  ID      Model        Agent         Rating   Issue           │   │
│  │  ─────────────────────────────────────────────────────────   │   │
│  │  #1234   llama3.1     flight_agent  👎       Hallucination   │   │
│  │  #1235   mistral      hotel_agent   👎       Wrong info      │   │
│  │  #1236   gpt-4o       activity      👎       Incomplete      │   │
│  │                                                               │   │
│  │  [View Prompt] [View Response] [Retrain Signal]              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### DQL Queries (Will Work After Phase 0)
```dql
-- Satisfaction by model
fetch bizevents
| filter event.type == "gen_ai.user_feedback"
| summarize 
    thumbs_up = countIf(feedback.rating == "thumbs_up"),
    thumbs_down = countIf(feedback.rating == "thumbs_down"),
    avg_score = avg(feedback.score),
    by: { model = gen_ai.response.model }
| fieldsAdd satisfaction_pct = (thumbs_up / (thumbs_up + thumbs_down)) * 100

-- Low-rated responses for analysis
fetch bizevents
| filter event.type == "gen_ai.user_feedback"
| filter feedback.rating == "thumbs_down"
| lookup [fetch spans | fieldsKeep trace.id, gen_ai.prompt, gen_ai.completion], sourceField: trace.id, lookupField: trace.id
| fields trace.id, gen_ai.prompt, feedback.comment
```

---

### 4.3 Sovereign AI & Data Residency Compliance
**Priority:** P2 | **Feasibility:** 🟢 HIGH (after Phase 0) | **Status:** 📋 Blocked by Phase 0

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Regional Traffic Map | `cloud.region` | 📋 | Where data flows |
| Data Residency Violations | Region × data type | 📋 | GDPR compliance |
| Provider Region Distribution | `cloud.provider` × region | 📋 | Geographic spread |
| Compliance Framework Tracking | `gen_ai.compliance.framework` | 📋 | GDPR, SOC2, HIPAA |
| On-Prem vs Cloud Split | `cloud.provider` | 📋 | Sovereignty metrics |

#### Proposed Dashboard Widgets
```
┌─────────────────────────────────────────────────────────────────────┐
│                  SOVEREIGN AI COMPLIANCE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────┐  ┌──────────────────────┐  │
│  │       Global Traffic Distribution  │  │  Compliance Status   │  │
│  │                                    │  │                      │  │
│  │    🇺🇸 US (45%)     🇪🇺 EU (35%)   │  │  ✅ GDPR  Compliant  │  │
│  │        ●                ●          │  │  ✅ SOC2  Compliant  │  │
│  │                                    │  │  ⚠️ HIPAA Partial    │  │
│  │    🏢 On-Prem (15%)  🇸🇬 APAC (5%)│  │  ✅ PCI   Compliant  │  │
│  │        ●                ●          │  │                      │  │
│  └────────────────────────────────────┘  └──────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │        Data Residency Violations (Last 24h)                  │   │
│  │                                                               │   │
│  │  ⚠️ 12 EU user queries routed to US-East region             │   │
│  │  ⚠️ 3 PII-containing prompts sent to non-EU provider        │   │
│  │  ✅ 99.7% traffic compliant with residency policy            │   │
│  │                                                               │   │
│  │  [View Violations] [Update Routing Rules]                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Traffic by Provider & Region                    │   │
│  │                                                               │   │
│  │  Provider        Region         Calls    Data Class          │   │
│  │  ─────────────────────────────────────────────────────────   │   │
│  │  Azure OpenAI    eastus         45,000   PII, Sensitive      │   │
│  │  AWS Bedrock     eu-west-1      35,000   PII (EU only)       │   │
│  │  Ollama          on-prem        15,000   All (restricted)    │   │
│  │  Vertex AI       asia-se1       5,000    Public only         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### DQL Queries (Will Work After Phase 0)
```dql
-- Traffic by region
fetch spans
| filter isNotNull(gen_ai.system)
| summarize 
    calls = count(),
    by: { cloud.provider, cloud.region, gen_ai.data.residency }
| sort calls desc

-- Data residency violations (EU users → non-EU providers)
fetch spans
| filter gen_ai.data.classification == "PII"
| filter user.geo.country IN ["DE", "FR", "IT", "ES", "NL"]
| filter cloud.region NOT IN ["eu-west-1", "eu-central-1", "europe-west1"]
| summarize violations = count(), by: { cloud.region, gen_ai.system }
```

---

### 4.4 Source Code Linking
**Priority:** P3 | **Feasibility:** 🟢 HIGH (after Phase 0) | **Status:** 📋 Blocked by Phase 0

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Click-Through to Source | `code.filepath`, `code.lineno` | 📋 | GitHub integration |
| Function-Level Attribution | `code.function` | 📋 | Identify hot paths |
| Git Commit Linking | `vcs.revision` | 📋 | Blame analysis |
| Code Change Impact | Version × metrics | 📋 | Performance regression |

#### DQL Queries (Will Work After Phase 0)
```dql
-- Errors by code location
fetch spans
| filter isNotNull(gen_ai.system)
| filter otel.status_code == "ERROR"
| summarize 
    error_count = count(),
    by: { code.filepath, code.function, code.lineno }
| sort error_count desc

-- Hot functions (most expensive)
fetch spans
| filter isNotNull(gen_ai.system)
| summarize 
    total_tokens = sum(gen_ai.usage.output_tokens),
    avg_latency = avg(duration),
    by: { code.function, code.namespace }
| sort total_tokens desc
```

---

## 🏗️ Phase 0: Reference Demo Application (PRE-REQUISITE)

> **CRITICAL:** This demo app must be built FIRST to unlock all GCC features.
> Without proper instrumentation, many advanced features remain impossible.

### 0.0 Overview

**Purpose:** Create a fully-instrumented reference demo application that:
1. ✅ Generates realistic GenAI traffic for ALL GCC features
2. ✅ Demonstrates proper OpenTelemetry instrumentation patterns
3. ✅ Enables "Not Recommended" features (business outcomes, feedback, sovereign AI)
4. ✅ Serves as a customer reference implementation

**Demo App Name:** `AI Travel Advisor Pro`

---

### 0.1 Demo App Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI TRAVEL ADVISOR PRO                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Frontend   │───▶│  API Gateway │───▶│   Agentic    │          │
│  │   (React)    │    │   (FastAPI)  │    │  Supervisor  │          │
│  │              │    │              │    │              │          │
│  │ - Chat UI    │    │ - Auth       │    │ - Routing    │          │
│  │ - Feedback👍 │    │ - Rate Limit │    │ - Orchestr.  │          │
│  │ - Booking    │    │ - Logging    │    │ - Guardrails │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                 │                   │
│                    ┌────────────────────────────┼───────────────┐   │
│                    │                            │               │   │
│              ┌─────▼─────┐   ┌─────────────┐   ┌▼──────────┐    │   │
│              │  Flight   │   │   Hotel     │   │ Activity  │    │   │
│              │   Agent   │   │   Agent     │   │  Agent    │    │   │
│              │           │   │             │   │           │    │   │
│              │ GPT-4o    │   │ Claude-3    │   │ Llama-3   │    │   │
│              │ (Azure)   │   │ (Bedrock)   │   │ (Ollama)  │    │   │
│              └─────┬─────┘   └──────┬──────┘   └─────┬─────┘    │   │
│                    │                │               │           │   │
│              ┌─────▼─────┐   ┌──────▼──────┐   ┌────▼──────┐    │   │
│              │  Tools:   │   │   Tools:    │   │  Tools:   │    │   │
│              │ - search  │   │ - search    │   │ - search  │    │   │
│              │ - book    │   │ - book      │   │ - book    │    │   │
│              │ - pricing │   │ - reviews   │   │ - weather │    │   │
│              └───────────┘   └─────────────┘   └───────────┘    │   │
│                                                                 │   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │  Azure    │   │  AWS      │   │  Local    │
              │  OpenAI   │   │  Bedrock  │   │  Ollama   │
              │ (US-East) │   │ (EU-West) │   │ (On-Prem) │
              │           │   │           │   │           │
              │ cloud.    │   │ cloud.    │   │ cloud.    │
              │ region=   │   │ region=   │   │ region=   │
              │ eastus    │   │ eu-west-1 │   │ on-prem   │
              └───────────┘   └───────────┘   └───────────┘
```

---

### 0.2 Instrumentation Specification

#### A. Core GenAI Spans (Already Exists ✅)
Standard OpenTelemetry GenAI semantic conventions:
```python
# These are already instrumented via Traceloop/OpenLLMetry
span.set_attribute("gen_ai.system", "openai")
span.set_attribute("gen_ai.request.model", "gpt-4o")
span.set_attribute("gen_ai.response.model", "gpt-4o-2024-05-13")
span.set_attribute("gen_ai.usage.input_tokens", 150)
span.set_attribute("gen_ai.usage.output_tokens", 230)
```

#### B. Agentic AI Attributes (Already Exists ✅)
Traceloop instrumentation for agents/tools:
```python
span.set_attribute("traceloop.span.kind", "task")  # agent/task/tool/workflow
span.set_attribute("traceloop.entity.name", "flight_agent")
span.set_attribute("traceloop.association.properties.conversation_id", "conv-123")
```

#### C. Source Code Mapping (NEW - Unlocks Feature ⭐)
**Purpose:** Enable click-through from span → source code
```python
# Add to every agent/tool span
span.set_attribute("code.filepath", "src/agents/flight_agent.py")
span.set_attribute("code.function", "search_flights")
span.set_attribute("code.lineno", 142)
span.set_attribute("code.namespace", "travel_advisor.agents")
span.set_attribute("code.column", 8)  # Optional

# Repository linkage
span.set_attribute("vcs.repository.url", "https://github.com/org/ai-travel-advisor")
span.set_attribute("vcs.revision", "abc123def")  # Git SHA
```

#### D. Sovereign AI / Data Residency (NEW - Unlocks Feature ⭐)
**Purpose:** Track where AI calls are processed geographically
```python
# Add to every LLM call span
span.set_attribute("cloud.provider", "azure")  # azure, aws, gcp, on-prem
span.set_attribute("cloud.region", "eastus")   # Azure region
span.set_attribute("cloud.availability_zone", "eastus-1")

# Custom: Data sovereignty classification
span.set_attribute("gen_ai.data.residency", "US")       # US, EU, APAC, etc.
span.set_attribute("gen_ai.data.classification", "PII") # PII, sensitive, public
span.set_attribute("gen_ai.compliance.framework", "GDPR,SOC2")  # Applicable frameworks
```

#### E. Business Context (NEW - Unlocks ROI ⭐)
**Purpose:** Link AI calls to business operations
```python
# Add to conversation/session spans
span.set_attribute("business.department", "customer_service")
span.set_attribute("business.cost_center", "CC-12345")
span.set_attribute("business.use_case", "travel_booking")
span.set_attribute("business.customer_tier", "premium")  # premium, standard, trial
span.set_attribute("business.transaction_id", "TXN-789")
```

---

### 0.3 Business Events Specification

#### A. User Feedback Event (NEW - Unlocks RLHF Analytics ⭐)
**Event Type:** `gen_ai.user_feedback`
```json
{
  "event.type": "gen_ai.user_feedback",
  "event.provider": "ai-travel-advisor",
  
  // Link to AI response
  "trace.id": "abc123...",
  "span.id": "def456...",
  "gen_ai.response.id": "chatcmpl-xyz",
  "gen_ai.conversation_id": "conv-789",
  
  // Feedback data
  "feedback.rating": "thumbs_up",         // thumbs_up, thumbs_down
  "feedback.score": 5,                     // 1-5 scale (optional)
  "feedback.category": "helpful",          // helpful, accurate, fast, creative
  "feedback.comment": "Great recommendation!",  // Optional free text
  "feedback.timestamp": "2026-02-08T10:30:00Z",
  
  // User context
  "user.id": "user-123",
  "user.type": "customer",                 // customer, internal, test
  "session.id": "sess-456"
}
```

#### B. Business Outcome Event (NEW - Unlocks ROI Dashboard ⭐)
**Event Type:** `gen_ai.business_outcome`
```json
{
  "event.type": "gen_ai.business_outcome",
  "event.provider": "ai-travel-advisor",
  
  // Link to AI conversation
  "trace.id": "abc123...",
  "gen_ai.conversation_id": "conv-789",
  
  // Business outcome
  "outcome.type": "booking_completed",     // booking_completed, lead_generated, issue_resolved
  "outcome.status": "success",             // success, abandoned, failed
  "outcome.revenue": 2450.00,              // USD
  "outcome.currency": "USD",
  "outcome.order_id": "ORD-12345",
  
  // Attribution
  "outcome.ai_assisted": true,
  "outcome.ai_recommendation_used": true,
  "outcome.ai_interactions_count": 5,
  "outcome.time_to_conversion_ms": 180000, // 3 minutes
  
  // Comparison baseline
  "outcome.channel": "ai_chat",            // ai_chat, web, mobile, phone
  "outcome.user_segment": "returning"      // new, returning, premium
}
```

#### C. Guardrail Trigger Event (NEW - Unlocks Security Analytics ⭐)
**Event Type:** `gen_ai.guardrail_triggered`
```json
{
  "event.type": "gen_ai.guardrail_triggered",
  "event.provider": "ai-travel-advisor",
  
  // Link to AI call
  "trace.id": "abc123...",
  "span.id": "def456...",
  
  // Guardrail details
  "guardrail.name": "pii_detection",
  "guardrail.type": "input",               // input, output
  "guardrail.action": "blocked",           // blocked, flagged, redacted
  "guardrail.severity": "high",            // low, medium, high, critical
  "guardrail.rule_id": "RULE-PII-001",
  
  // Detection details
  "guardrail.pattern_matched": "SSN",
  "guardrail.confidence": 0.95,
  "guardrail.sample_redacted": "User provided SSN: [REDACTED]"
}
```

---

### 0.4 Traffic Generation Patterns

#### Data Volume Targets (per day)
| Metric | Target | Purpose |
|--------|--------|---------|
| Total GenAI Calls | 100,000 | Stress test dashboards |
| Unique Conversations | 10,000 | Session analytics |
| Agent Task Executions | 50,000 | Agent monitoring |
| Tool Invocations | 30,000 | Tool reliability |
| Feedback Events | 5,000 | RLHF analytics |
| Business Outcomes | 2,000 | ROI calculations |
| Guardrail Triggers | 500 | Security analytics |
| Error Scenarios | 2,000 | Incident correlation |

#### Scenario Distribution
```yaml
scenarios:
  happy_path:
    weight: 60%
    description: "User asks → AI responds → User books"
    outcome: booking_completed
    
  abandoned_flow:
    weight: 20%
    description: "User asks → AI responds → User leaves"
    outcome: abandoned
    feedback: null
    
  error_scenario:
    weight: 10%
    description: "Rate limit, timeout, model error"
    outcome: failed
    
  guardrail_trigger:
    weight: 5%
    description: "PII detected, injection attempted"
    guardrail: triggered
    
  multi_agent:
    weight: 5%
    description: "Complex trip planning (3+ agents)"
    agents: [flight, hotel, activity, supervisor]
```

#### Provider Distribution (Sovereign AI Demo)
```yaml
providers:
  azure_openai:
    weight: 40%
    region: eastus
    models: [gpt-4o, gpt-4-turbo]
    data_residency: US
    
  aws_bedrock:
    weight: 30%
    region: eu-west-1
    models: [claude-3-sonnet, claude-3-haiku]
    data_residency: EU
    
  local_ollama:
    weight: 20%
    region: on-prem
    models: [llama3.1:8b, mistral:7b]
    data_residency: ON_PREM
    
  google_vertex:
    weight: 10%
    region: asia-southeast1
    models: [gemini-pro]
    data_residency: APAC
```

---

### 0.5 Implementation Checklist

> ⚡ **Accelerated Timeline:** With GitHub Copilot AI assistance, estimated effort reduced by 70%

| Component | Priority | Effort | AI-Assisted | Status |
|-----------|----------|--------|-------------|--------|
| **Phase 0a: Core App** | | | | |
| FastAPI backend skeleton | P0 | 2d | **4h** | 📋 |
| React chat UI | P0 | 2d | **4h** | 📋 |
| OpenTelemetry setup | P0 | 1d | **2h** | 📋 |
| Basic agent (1 provider) | P0 | 2d | **3h** | 📋 |
| **Phase 0b: Multi-Provider** | | | | |
| Azure OpenAI integration | P0 | 1d | **2h** | 📋 |
| AWS Bedrock integration | P0 | 1d | **2h** | 📋 |
| Ollama local integration | P0 | 0.5d | **1h** | 📋 |
| Google Vertex integration | P1 | 1d | **2h** | 📋 |
| **Phase 0c: Agentic Patterns** | | | | |
| Supervisor agent | P0 | 2d | **3h** | 📋 |
| Flight booking agent | P0 | 1d | **2h** | 📋 |
| Hotel booking agent | P0 | 1d | **2h** | 📋 |
| Activity agent | P1 | 1d | **2h** | 📋 |
| Tool implementations | P0 | 2d | **3h** | 📋 |
| **Phase 0d: Advanced Instrumentation** | | | | |
| `code.*` attributes | P1 | 0.5d | **1h** | 📋 |
| `cloud.region` attributes | P1 | 0.5d | **1h** | 📋 |
| Business context attributes | P1 | 0.5d | **1h** | 📋 |
| **Phase 0e: Business Events** | | | | |
| Feedback UI + bizevent | P0 | 1d | **2h** | 📋 |
| Booking → outcome event | P0 | 1d | **2h** | 📋 |
| Guardrail trigger events | P1 | 1d | **2h** | 📋 |
| **Phase 0f: Traffic Generation** | | | | |
| Load test framework | P1 | 1d | **2h** | 📋 |
| Scenario scripts | P1 | 2d | **3h** | 📋 |
| Error injection | P2 | 1d | **1h** | 📋 |

| | Traditional | AI-Assisted |
|---|-------------|-------------|
| **Total Effort** | ~25 days | **~5 days** |
| **Calendar Time** | 5 weeks | **1 week** |

---

### 0.6 GCC Features Unlocked by Demo App

| Feature | Current Status | After Demo App |
|---------|---------------|----------------|
| Source Code Mapping | ❌ No Data | ✅ Click-through to code |
| Business ROI Dashboard | ❌ No Data | ✅ Revenue attribution |
| User Feedback Analytics | ❌ No Data | ✅ RLHF insights |
| Sovereign AI Compliance | ❌ No Data | ✅ Regional tracking |
| Guardrail Analytics | ⚠️ Basic | ✅ Full security view |
| Agent Loop Detection | ✅ Works | ✅ Enhanced with context |
| Multi-Provider Comparison | ✅ Works | ✅ With regional costs |

---

### 0.7 Repository Structure

```
ai-travel-advisor-pro/
├── README.md
├── docker-compose.yml
├── .env.example
├── pyproject.toml
├── src/
│   ├── api/
│   │   ├── main.py              # FastAPI app
│   │   ├── routes/
│   │   │   ├── chat.py          # Chat endpoints
│   │   │   ├── feedback.py      # Feedback endpoints
│   │   │   └── booking.py       # Booking endpoints
│   │   └── middleware/
│   │       └── telemetry.py     # OTel setup
│   ├── agents/
│   │   ├── supervisor.py        # Main orchestrator
│   │   ├── flight_agent.py
│   │   ├── hotel_agent.py
│   │   └── activity_agent.py
│   ├── tools/
│   │   ├── flight_search.py
│   │   ├── hotel_search.py
│   │   ├── booking.py
│   │   └── weather.py
│   ├── providers/
│   │   ├── azure_openai.py
│   │   ├── aws_bedrock.py
│   │   ├── ollama.py
│   │   └── vertex_ai.py
│   └── telemetry/
│       ├── spans.py             # Custom span helpers
│       ├── bizevents.py         # Business event senders
│       └── attributes.py        # Attribute constants
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── Chat.tsx
│       │   ├── FeedbackButton.tsx
│       │   └── BookingConfirmation.tsx
│       └── hooks/
│           └── useChat.ts
├── load_tests/
│   ├── locustfile.py
│   └── scenarios/
│       ├── happy_path.py
│       ├── error_injection.py
│       └── guardrail_test.py
└── deploy/
    ├── kubernetes/
    │   ├── deployment.yaml
    │   └── service.yaml
    └── terraform/
        └── main.tf
```

---

## ❌ Deprecated: Not Recommended (No Data Available)

> ⚠️ **UPDATE:** These features were previously marked as "Not Recommended" but can be
> **fully implemented** once the Reference Demo App (Phase 0) is built with proper instrumentation.
> See Phase 0 above for implementation details.

| Feature | Previous Status | New Status | Enabled By |
|---------|----------------|------------|------------|
| Business Outcome Mapping | ❌ No Data | ✅ Phase 4 | `gen_ai.business_outcome` bizevent |
| Sovereign AI / Data Residency | ❌ No Data | ✅ Phase 4 | `cloud.region` span attribute |
| User Feedback Integration | ❌ No Data | ✅ Phase 4 | `gen_ai.user_feedback` bizevent |
| Source Code Mapping | ❌ No Data | ✅ Phase 4 | `code.*` span attributes |
| Provider Status Integration | ❌ No API | 🟡 Phase 5 | External API + Davis events |

---

## 📈 Data Availability Summary

### Current Grail Data (Feb 2026)

| Data Type | Volume | Fields Available |
|-----------|--------|------------------|
| GenAI Spans | 572,660 (7d) | provider, model, tokens, latency, errors |
| Agent Tasks | 142,580 (7d) | entity.name, span.kind, duration |
| Tool Calls | 74,376 (7d) | tool name, duration, error rate |
| Workflows | 15,796 (7d) | LangGraph executions |
| Prompts | 284,146 (7d) | Full prompt content |
| Completions | 209,998 (7d) | Full response content |
| Davis Problems | 10+ (7d) | AI service correlated |
| BizEvents | 109,537 (7d) | `gen_ai.auditing` type |
| **Pinecone (Vector DB)** | **115,303 (7d)** | `db.system=pinecone`, `pinecone.query` spans |
| **Embedding Spans** | **~113,000 (7d)** | OpenAI/Ollama/VertexAI/Bedrock embedding models |
| **Infrastructure Metrics** | Continuous | GPU, CPU, memory, network via OneAgent |

### Data Gaps (To Be Filled by Demo App)

| Data Type | Current State | After Demo App |
|-----------|---------------|----------------|
| `code.filepath` | ❌ Empty/generic | ✅ Real file paths |
| `code.function` | ❌ "Span" only | ✅ Actual function names |
| `cloud.region` | ❌ NULL | ✅ US/EU/APAC/On-Prem |
| User Feedback | ❌ None | ✅ 5k+/day thumbs up/down |
| Business Outcomes | ❌ None (no link) | ✅ 2k+/day bookings |
| Guardrail Triggers | ❌ None | ✅ 500+/day security events |

### Demo App Target Data Volume (Daily)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DEMO APP DATA GENERATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GenAI Spans        ████████████████████████████████████  100,000  │
│  Agent Tasks        ██████████████████████████████  50,000         │
│  Tool Invocations   ██████████████████████  30,000                 │
│  Unique Sessions    ██████████████████  10,000                     │
│  Feedback Events    ███████████  5,000                             │
│  Business Outcomes  ██████  2,000                                   │
│  Error Scenarios    ██████  2,000                                   │
│  Guardrail Triggers ██  500                                         │
│                                                                     │
│  Total Daily Events: ~200,000                                       │
│  Monthly Grail Usage Estimate: ~50 GB                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Providers Detected
1. Azure (65k requests)
2. Langchain (65k requests)
3. Amazon/Bedrock (37k requests)
4. OpenAI (37k requests)
5. Ollama (37k requests)
6. VertexAI (37k requests)

### Models Detected (22 unique)
- GPT-4o, GPT-4-turbo, GPT-35-turbo
- Claude-2.1, Claude-opus-4
- Llama3.1:8b, Llama3.1:405b
- Mistral-small:22b, Orca-mini:3b
- Amazon Titan, Deepseek-r1
- Text-embedding-ada-002, text-embedding-3-*

---

## 📅 Visual Timeline (AI-Accelerated - 10 Weeks)

```
FEBRUARY 2026                MARCH 2026                          APRIL 2026                  MAY 2026
Wk1   Wk2   Wk3   Wk4   Wk5   Wk6   Wk7   Wk8   Wk9   Wk10
 |     |     |     |     |     |     |     |     |     |
[P0]->[P1]->[P2]->[P3]->[P5]->[P6+P7]->[P4]->[P8]->[P8]->[DONE]
Demo  Agent Qual  Mat   RAG   Plat    Adv   Eval  Conv  Release
5d    5d    5d    3d    5d    5d      5d    5d    5d    v3.0

AI-ASSISTED DEVELOPMENT (GitHub Copilot) = 70% faster

10-WEEK SPRINT PLAN (Updated for Viatris Coverage + Competitive Parity):

WEEK 1: Demo App Foundation
  - Day 1-2: FastAPI + React skeleton
  - Day 3: OpenTelemetry + Multi-provider setup
  - Day 4-5: Supervisor + 3 agents
  Milestone: Basic AI Travel Advisor working

WEEK 2: GCC Phase 1 - Agentic + Cost
  - Day 1-2: Enhanced Agent Dashboard
  - Day 3-4: Davis Cost Forecasting
  - Day 5: Prompt Engineering Insights
  Milestone: Agent governance + cost forecasting live

WEEK 3: GCC Phase 2 - Quality + RCA
  - Day 1-2: Model Quality Dashboard
  - Day 3-4: Incident Correlation
  - Day 5: Security Posture (basic)
  Milestone: Quality monitoring + problem correlation

WEEK 4: GCC Phase 3 - Maturity
  - Day 1-2: AI Maturity Score
  - Day 3: Developer Experience + TTFT metric
  Milestone: Maturity scoring live

WEEK 5: GCC Phase 5 - RAG / Vector DB + Agent Enhancements  [NEW-VIATRIS]
  - Day 1-2: Vector DB page (Pinecone + embeddings)
  - Day 3: RAG pipeline trace correlation
  - Day 4: Agent retry monitoring + chain perf view
  - Day 5: Retrieval anomaly detection + duplicate query detection
  Milestone: RAG observability + enhanced agent tracing live
  Viatris Impact: Domain 3 coverage 0% → 33%, Domain 2 coverage 59% → 73%

WEEK 6: GCC Phase 6 + 7 - Platform Health + Governance  [NEW-VIATRIS]
  - Day 1-2: AI Infrastructure cards (GPU, CPU, memory, K8s)
  - Day 3: SLO/availability integration + provider health
  - Day 4: AppSec vulnerability linking + deployment events
  - Day 5: Compliance enhancements (retention, regulatory templates)
  Milestone: Full-stack AI observability + security posture
  Viatris Impact: Domain 6 coverage 39% → 74%, Domain 5 coverage 26% → 47%

WEEK 8: GCC Phase 4 - Advanced Features (Requires Demo App)
  - Day 1-2: Business ROI Dashboard
  - Day 3: User Feedback Analytics (RLHF)
  - Day 4: Sovereign AI Compliance
  - Day 5: Source Code Linking
  Milestone: All enterprise features complete

WEEK 9: GCC Phase 8 - Competitive Parity [NEW-COMPETITOR GAP]
  - Day 1: LLM Evaluation Engine (heuristic tier) + Evaluations page
  - Day 2: Conversation Intelligence + Sessions page
  - Day 3: Prompt Playground + Version History (enhance PromptGovernance)
  - Day 4: MCP Protocol tracing (enhance AgentTools) + Spend Alerts (enhance FinOps)
  - Day 5: Enterprise Access Controls (enhance Governance) + polish
  Milestone: Competitive parity with Arize, Opik, Langfuse on evaluation + conversation layers
  Competitive Impact: Closes 16 of top competitor feature gaps

WEEK 10: Polish + Documentation
  - Day 1-2: Bug fixes, UI polish
  - Day 3-4: Demo scripts, documentation
  - Day 5: Release v3.0.0

TOTAL: 10 weeks -> Full Enterprise AI Control Center + Competitive Parity
VIATRIS COVERAGE: 40% → 72% (97 of 134 metrics addressed)
COMPETITIVE GAPS CLOSED: 16 of 22 identified gaps (73%)
```

---

---

## Phase 8: Competitive Parity — Evaluation, Conversation Intelligence & Prompt Tooling (NEW — Competitor Gap)

> **DRIVER:** Competitive Analysis (Feb 25, 2026) — Deep research into Arize AX/Phoenix, Opik (Comet), Langfuse, LangSmith, Helicone, W&B Weave, and Datadog LLM Observability revealed that GCC's biggest gap vs. all 7 competitors is the **evaluation & experimentation layer** and **conversation intelligence**. These are the #1 features customers from the AI observability space ask for when evaluating tools.
>
> **DATA STATUS:** 🟢 HIGH for Groups B, E — conversation IDs, token costs already in Grail. 🟡 PARTIAL for Group A — basic heuristic evals now; true LLM-as-judge requires Phase 0. Phase 0 unlocks the full layer.

### 8.1 LLM Evaluation Engine
**Priority:** P1 | **Feasibility:** 🟡 PARTIAL (heuristics now; full LLM-judge after Phase 0) | **Status:** 📋 Planned

**Why:** This is the single most-repeated feature across all 7 competitors. Arize, Opik, Langfuse, LangSmith, W&B, and Datadog all have robust LLM-as-a-judge scoring. Customers evaluating GCC for AI observability ask: *"Can I automatically score my production traces for hallucinations, relevance, and toxicity?"*

**New Page:** `/evaluations` | **New Hook:** `useEvaluations.ts`

#### Features
| Feature | Data Source | Feasibility | Status | Notes |
|---------|-------------|------------|--------|-------|
| Heuristic eval metrics | Span attributes (response length, latency, error rate) | 🟢 HIGH | 📋 | Buildable today from Grail spans |
| Hallucination scoring (pattern-based) | Response content patterns + DQL | 🟢 HIGH | 📋 | Flag responses with known hallucination indicators |
| Response quality score (latency × error-rate × token-efficiency) | `gen_ai.usage.*`, `duration`, error spans | 🟢 HIGH | 📋 | Composite score per trace |
| Online evaluation rules (auto-flag low-quality traces) | DQL threshold rules + Davis events | 🟢 HIGH | 📋 | If response quality score < threshold → flag |
| Annotation queue (human review of flagged traces) | Dynatrace notebook + workflow trigger | 🟡 PARTIAL | 📋 | Review via Dynatrace; not native GCC UI |
| LLM-as-a-judge scoring (true semantic eval) | `gen_ai.eval.*` attributes OR Phase 0 bizevent | 🔴 Blocked | 📋 | Requires Phase 0 or external eval API |
| Evaluation datasets (curate production traces) | `gen_ai.prompt`, `gen_ai.completion` in Grail | 🟡 PARTIAL | 📋 | Export curated trace subsets to JSON |
| Experiment comparison (prompt A vs B vs C) | DQL group by `gen_ai.request.model` × time window | 🟢 HIGH | 📋 | Compare quality/latency/cost across versions |

#### Heuristic Eval Metrics (DQL — Buildable Today)
```dql
-- Response quality composite score (heuristic, no LLM judge needed)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.provider.name)
| summarize
    avg_latency_ms = avg(duration) / 1000000,
    error_rate = countIf(otel.status_code == "ERROR") / count() * 100,
    avg_output_tokens = avg(gen_ai.usage.output_tokens),
    avg_input_tokens = avg(gen_ai.usage.input_tokens),
    total_calls = count(),
    by: { service = dt.entity.service, gen_ai.request.model }
| fieldsAdd
    token_efficiency = avg_output_tokens / avg_input_tokens,
    quality_score = (100 - error_rate) * 0.5 + (if(avg_latency_ms < 2000, 30, if(avg_latency_ms < 5000, 15, 0))) + (if(token_efficiency > 0.3, 20, 10))
| sort quality_score asc
| limit 50

-- Flag low-quality responses (long latency + high token use + error)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.provider.name)
| filter otel.status_code == "ERROR" OR duration > 10000000000  -- > 10s
| summarize count = count(), by: { gen_ai.request.model, dt.entity.service, otel.status_code }
| sort count desc

-- Trace-level quality view with inputs/outputs
fetch spans, from:now()-1h
| filter isNotNull(gen_ai.prompt)
| filter otel.status_code == "ERROR" OR duration > 8000000000
| fields timestamp, trace.id, gen_ai.request.model, gen_ai.provider.name,
    gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, duration, otel.status_code,
    gen_ai.prompt, gen_ai.completion.0.content
| sort duration desc
| limit 100
```

#### What's Blocked (Requires Phase 0 LLM-judge instrumentation)
- ❌ True hallucination score (needs `gen_ai.eval.hallucination_score` on spans)
- ❌ Answer relevance / context precision (needs external eval call)
- ❌ Grounding / faithfulness scoring (needs RAG context + eval pipeline)
- ❌ Toxicity/bias detection (needs NLP classifier or LLM judge call)

#### Implementation Checklist
| Component | Effort | Status |
|-----------|--------|--------|
| DQL queries — heuristic evals | 2h | 📋 |
| Types: `EvalScore`, `EvalResult`, `AnnotationFlag` | 1h | 📋 |
| `useEvaluations.ts` hook | 3h | 📋 |
| `Evaluations.tsx` page (quality scores, flagged traces table) | 5h | 📋 |
| Route + navigation | 0.5h | 📋 |
| **Total (heuristic tier)** | **~11.5h** | |

---

### 8.2 Conversation Intelligence & Session Tracking
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

**Why:** Arize, Opik, Langfuse, LangSmith, W&B, and Datadog all offer session/conversation tracking — grouping individual LLM calls into multi-turn conversation views. GCC currently shows individual spans but has no concept of a conversation. The data is **already available in Grail**: `traceloop.association.properties.conversation_id` is populated on agent spans.

**Enhancement target:** Add `/conversations` page OR conversation tab on HealthDashboard.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Conversation list (grouped by conversation_id) | `traceloop.association.properties.conversation_id` | 📋 | Already in Grail data |
| Conversation turn count | Span count per conversation_id | 📋 | Simple groupby |
| Conversation duration (start → end) | min/max timestamp per conversation_id | 📋 | Session length |
| Multi-turn token usage | Sum tokens per conversation_id | 📋 | Total cost per session |
| Agent involved per conversation | Distinct `traceloop.entity.name` per conversation_id | 📋 | Which agents participated |
| Error rate per conversation | Error spans / total spans per conversation_id | 📋 | Session-level SLA |
| Conversation topic clustering (heuristic) | Group by `gen_ai.prompt` keyword patterns | 📋 | Auto-tag: question, booking, complaint |
| Failure-to-answer rate | Flag responses < 50 tokens or containing "I cannot" patterns | 📋 | Quality signal |
| Long conversation detection (agent loops) | conversation turn count > threshold | 📋 | Agentic loop warning |

#### DQL Queries (Validated — Data Exists in Grail)
```dql
-- Conversation summary (multi-turn session view)
fetch spans, from:now()-24h
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize
    turns = count(),
    total_input_tokens = sum(toLong(gen_ai.usage.input_tokens)),
    total_output_tokens = sum(toLong(gen_ai.usage.output_tokens)),
    session_start = min(timestamp),
    session_end = max(timestamp),
    agents = collectDistinct(traceloop.entity.name),
    error_turns = countIf(otel.status_code == "ERROR"),
    models_used = collectDistinct(gen_ai.request.model),
    by: { conversation_id = traceloop.association.properties.conversation_id }
| fieldsAdd
    duration_secs = toLong(session_end - session_start) / 1000000000,
    total_tokens = total_input_tokens + total_output_tokens
| sort turns desc
| limit 200

-- Failure-to-answer detection (short or evasive responses)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.completion.0.content)
| filter toLong(gen_ai.usage.output_tokens) < 30
    OR contains(toString(gen_ai.completion.0.content), "I cannot")
    OR contains(toString(gen_ai.completion.0.content), "I don't know")
    OR contains(toString(gen_ai.completion.0.content), "I'm not able")
| summarize
    failure_count = count(),
    by: { gen_ai.request.model, gen_ai.provider.name }
| sort failure_count desc

-- Topic clustering (heuristic keyword grouping)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.prompt)
| fieldsAdd
    topic = if(contains(toString(gen_ai.prompt), "book") OR contains(toString(gen_ai.prompt), "reservation"), "Booking",
            if(contains(toString(gen_ai.prompt), "cancel") OR contains(toString(gen_ai.prompt), "refund"), "Cancellation",
            if(contains(toString(gen_ai.prompt), "error") OR contains(toString(gen_ai.prompt), "problem"), "Issue-Resolution",
            if(contains(toString(gen_ai.prompt), "price") OR contains(toString(gen_ai.prompt), "cost"), "Pricing",
            "General"))))
| summarize call_count = count(), by: { topic, gen_ai.request.model }
| sort call_count desc

-- Long conversation / agent loop warning
fetch spans, from:now()-24h
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize turns = count(), by: { conversation_id = traceloop.association.properties.conversation_id }
| filter turns > 20
| sort turns desc
```

#### Implementation Checklist
| Component | Effort | Status |
|-----------|--------|--------|
| DQL queries for sessions | 2h | 📋 |
| Types: `ConversationSession`, `ConversationTopic` | 1h | 📋 |
| `useConversations.ts` hook | 3h | 📋 |
| `Conversations.tsx` page (session list, topic chart, failure rate) | 5h | 📋 |
| Route + navigation | 0.5h | 📋 |
| **Total** | **~11.5h** | |

---

### 8.3 Prompt Playground & Version Control
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

**Why:** Langfuse, LangSmith, Arize, Opik, and W&B Weave all offer interactive prompt playgrounds — letting users run prompts against live models and compare results. GCC has a PromptGovernance page that shows prompt data but offers no interactive testing or version-diff capability.

**Enhancement target:** Enhance existing PromptGovernance page + add playground tab.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Prompt version history (per service) | `gen_ai.prompt` grouped by service × time bucket | 📋 | Track prompt drift over time |
| Prompt hash deduplication | SHA fingerprint of prompt content | 📋 | Detect when prompt template changed |
| Prompt diff view | Latest vs 24h-ago prompt template | 📋 | Visual highlight of changes |
| Most common prompts (ranked by frequency) | `gen_ai.prompt` sorted by count | 📋 | Top prompt templates in production |
| Prompt cost breakdown | Prompt × token cost | 📋 | Which prompt is most expensive |
| Interactive playground (call live model via Davis CoPilot) | Davis AI SDK | 📋 | Requires Davis Copilot integration |
| A/B prompt comparison (same input, different prompt versions) | DQL: group by time window × prompt hash | 📋 | Compare quality across versions |

#### DQL Queries
```dql
-- Prompt version history per service (detect template changes)
fetch spans, from:now()-7d
| filter isNotNull(gen_ai.prompt)
| summarize
    call_count = count(),
    avg_tokens = avg(gen_ai.usage.input_tokens),
    by: { dt.entity.service, prompt_day = bin(timestamp, 1d),
          gen_ai.request.model }
| sort prompt_day asc

-- Most common prompts (ranked by frequency)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.prompt)
| summarize count = count(), avg_latency = avg(duration), by: { gen_ai.prompt }
| sort count desc
| limit 50

-- Prompt cost breakdown
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.prompt) AND isNotNull(gen_ai.usage.input_tokens)
| summarize
    calls = count(),
    total_input_tokens = sum(toLong(gen_ai.usage.input_tokens)),
    avg_cost_per_call = avg(toLong(gen_ai.usage.input_tokens)) * 0.000003,
    by: { gen_ai.request.model, gen_ai.provider.name }
| sort total_input_tokens desc
```

---

### 8.4 MCP Protocol Observability
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL (depends on instrumentation) | **Status:** 📋 Planned

**Why:** Model Context Protocol (MCP) is rapidly becoming the standard for tool-calling in AI agents. Langfuse, W&B Weave, and Datadog already have MCP tracing. As customers adopt MCP-based agent architectures, GCC needs to detect and surface MCP tool calls.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| MCP server detection | `mcp.*` span attributes or `span.name` pattern | 📋 | Detect MCP calls in traces |
| MCP tool invocation count & latency | `span.name` contains "mcp" | 📋 | Which MCP tools called most |
| MCP tool error rate | Error spans on MCP calls | 📋 | MCP server health |
| MCP call chain in agent traces | Parent-child span correlation with MCP | 📋 | Full agent→MCP→tool trace |

#### DQL Queries
```dql
-- Detect MCP tool calls
fetch spans, from:now()-24h
| filter contains(span.name, "mcp") OR contains(span.name, "MCP")
    OR contains(toString(span.attributes), "mcp")
| summarize
    invocations = count(),
    error_rate = countIf(otel.status_code == "ERROR") / count() * 100,
    avg_latency_ms = avg(duration) / 1000000,
    by: { span.name, otel.status_code }
| sort invocations desc

-- MCP server health per tool
fetch spans, from:now()-24h
| filter contains(span.name, "mcp")
| makeTimeseries calls = count(), errors = countIf(otel.status_code == "ERROR"),
    interval: 1h, by: { span.name }
```

---

### 8.5 Spend Alerts & Cost Budget Management
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** 📋 Planned

**Why:** Langfuse, LangSmith, Helicone, and Datadog all have cost threshold alerting. GCC shows cost analytics (FinOps page) but has no alerting capability when spend exceeds a budget. Using Dynatrace Workflow automation, this is fully buildable now.

**Enhancement target:** Enhance FinOps page + add workflow-based alerting.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Daily cost budget tracking | Token count × model pricing | 📋 | Existing FinOps data + threshold |
| Cost spike detection | Davis anomaly on cost timeseries | 📋 | Automatic anomaly via DQL Davis analyzer |
| Budget alert workflow | Dynatrace Workflow → Slack/Email | 📋 | One-click workflow from Remediation Library |
| Per-service cost breakdown alerts | Token cost grouped by service | 📋 | Alert if service spend > X |
| Weekly cost forecast vs. budget | Davis forecasting analyzer | 📋 | Project monthly spend from current rate |
| Cost comparison (this week vs last week) | DQL makeTimeseries + shift | 📋 | Detect unusual week-over-week increase |

#### DQL Queries
```dql
-- Daily cost tracker with trend
fetch spans, from:now()-7d
| filter isNotNull(gen_ai.provider.name) AND isNotNull(gen_ai.usage.input_tokens)
| summarize
    input_tokens = sum(toLong(gen_ai.usage.input_tokens)),
    output_tokens = sum(toLong(gen_ai.usage.output_tokens)),
    by: { day = bin(timestamp, 1d), gen_ai.request.model, gen_ai.provider.name }
| fieldsAdd
    estimated_cost_usd = input_tokens * 0.000003 + output_tokens * 0.000015
| sort day asc

-- Cost spike: today vs 7-day average
fetch spans, from:now()-7d
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize
    total_tokens = sum(toLong(gen_ai.usage.input_tokens) + toLong(gen_ai.usage.output_tokens)),
    by: { day = bin(timestamp, 1d) }
| fieldsAdd estimated_cost = total_tokens * 0.000009
| sort day asc

-- Week-over-week cost comparison
fetch spans, from:now()-14d
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize tokens = sum(toLong(gen_ai.usage.input_tokens) + toLong(gen_ai.usage.output_tokens)),
    by: { week = bin(timestamp, 7d) }
| sort week asc
```

#### Workflow Template (Spend Alert)
```json
{
  "name": "AI Spend Budget Alert",
  "trigger": { "type": "schedule", "cron": "0 9 * * *" },
  "actions": [
    {
      "name": "Check daily spend",
      "type": "run_dql",
      "query": "fetch spans, from:now()-24h | filter isNotNull(gen_ai.usage.input_tokens) | summarize total = sum(toLong(gen_ai.usage.input_tokens) + toLong(gen_ai.usage.output_tokens)) | fieldsAdd cost_usd = total * 0.000009"
    },
    {
      "name": "Alert if over budget",
      "type": "send_notification",
      "condition": "cost_usd > 500",
      "channels": ["slack", "email"]
    }
  ]
}
```

---

### 8.6 Enterprise Access & Data Controls
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** 📋 Planned

**Why:** Langfuse, LangSmith, W&B, and Datadog all offer RBAC, audit logs, and data export. Enterprise customers need to know who accessed AI observability data and be able to export raw traces. Dynatrace has RBAC and audit logs natively — GCC just needs to surface this guidance.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| RBAC documentation for GCC | Dynatrace permission groups | 📋 | Document viewer/editor/admin roles |
| Audit log viewer (who triggered workflows) | Dynatrace audit logs | 📋 | Surface in Governance page |
| Data export (raw trace data to CSV/JSON) | Grail export API | 📋 | "Export last 7d traces" button |
| Data retention visibility | Grail bucket configuration | 📋 | Show retention period per bucket |
| Tenant/environment isolation | Dynatrace environment boundaries | 📋 | Document multi-env strategy |

#### DQL Queries
```dql
-- Audit: workflow execution history
fetch events, from:now()-7d
| filter event.kind == "WORKFLOW_EXECUTION"
| fields timestamp, event.name, user.name, workflow.status
| sort timestamp desc
| limit 100

-- Data retention check (what's oldest span in Grail)
fetch spans, from:now()-90d
| summarize oldest = min(timestamp), newest = max(timestamp), total = count()
```

---

### Phase 8 Implementation Summary

| Sub-Phase | Feature Group | Effort | Feasibility | New Page/Hook |
|-----------|--------------|--------|------------|--------------|
| 8.1 | LLM Evaluation Engine | ~11.5h | 🟡 PARTIAL | `/evaluations`, `useEvaluations.ts` |
| 8.2 | Conversation Intelligence | ~11.5h | 🟢 HIGH | `/conversations`, `useConversations.ts` |
| 8.3 | Prompt Playground + Version History | ~6h | 🟢 HIGH | Enhance PromptGovernance |
| 8.4 | MCP Protocol Observability | ~4h | 🟡 PARTIAL | Enhance AgentTools |
| 8.5 | Spend Alerts + Cost Budgets | ~5h | 🟢 HIGH | Enhance FinOps + Remediation |
| 8.6 | Enterprise Access Controls | ~4h | 🟡 PARTIAL | Enhance Governance |
| **Total** | | **~42h** | | **2 new pages, 4 enhancements** |

**Competitive Impact After Phase 8:**

| Feature Gap | Arize | Opik | Langfuse | LangSmith | W&B | Datadog | GCC (after Phase 8) |
|------------|:-----:|:----:|:--------:|:---------:|:---:|:-------:|:------------------:|
| Heuristic Evals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conversation Tracking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Topic Clustering | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Spend Alerts | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Prompt History | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MCP Tracing | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| LLM-as-judge (true) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Phase 0 needed) |
| **Infra+LLM Correlation** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | **✅ (Unique!)** |
| **Davis AI Causation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ (Unique!)** |
| **Workflow Automation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ (Unique!)** |

---

## 🔄 Changelog

### v3.0.0 (Feb 25, 2026)
- **Competitive Landscape Analysis**: Comprehensive research across 7 AI observability competitors — Arize AX/Phoenix, Opik (Comet), Langfuse, LangSmith, Helicone, W&B Weave, Datadog LLM Observability
- **NEW Phase 8**: Competitive Parity — LLM Evaluation Engine, Conversation Intelligence, Prompt Playground, MCP Observability, Spend Alerts, Enterprise Access Controls
- **Competitive Feature Matrix** added: 28 features mapped across 7 competitors + GCC
- **GCC Differentiators** documented: 7 unique capabilities no competitor matches
- **Infrastructure Page**: Redesigned to remove duplicates; unique Service Config + Model History sections added
- Updated timeline: 9 weeks total; Phase 8 closes ~16 competitive gaps

### v2.5.0 (Feb 24, 2026)
- **Viatris Metrics Gap Analysis**: Full assessment of 134 enterprise AI metrics across 6 domains
- **NEW Phase 5**: RAG / Vector DB Observability + Agent Enhancements (6 new buildable features)
- **NEW Phase 6**: Platform & Infrastructure Health for AI (12 new buildable features)
- **NEW Phase 7**: Enhanced Governance & Security (AppSec, deployments, compliance)
- Added Pinecone (115K spans/wk) and embedding data (113K spans/wk) to data summary
- Updated timeline: 6 weeks → 8 weeks to accommodate Viatris coverage gaps
- Viatris target: 40% → 72% metric coverage (54 → 97 of 134 metrics)

### v2.4.0 (Feb 8, 2026)
- Improved drift score trend chart with severity-based color coding
- Created roadmap based on industry research and Grail validation
- Added Phase 0: Reference Demo App specification
- Upgraded "Not Recommended" features to Phase 4 (data gap, not platform limitation)
- Added comprehensive instrumentation specification
- Added business events specification (feedback, outcomes, guardrails)
- Updated timeline: 6 weeks with AI assistance (70% faster)

### Previous Versions
- See git tags for version history

---

## 📝 How to Use This Roadmap

### For Development
1. Reference this file when starting new features
2. Check "Data Source" column before implementing
3. Use validated DQL queries as starting points
4. Update status when completing items

### For Planning
1. Prioritize 🟢 GREEN items (data exists)
2. Evaluate 🟡 YELLOW items for business value
3. Avoid 🔴 RED items unless data sources change

### Updating This File
```bash
# After completing a feature:
1. Change status from 📋 to ✅
2. Add completion date
3. Update version number
4. Commit with message: "docs: update roadmap - completed [feature name]"
```

---

## 🔗 Related Documents

- [User Guide](./USER_GUIDE.md)
- [Demo Script](./DEMO_SCRIPT.md)
- [SE Demo Script](./SE_DEMO_SCRIPT.md)
- [Demo Cheatsheet](./DEMO_CHEATSHEET.md)

---

## 📞 Contact

For questions about this roadmap, refer to the GitHub repository or review conversation history with the AI assistant that created this document.

**Repository:** pushpendrasinghbaghel-ai/genai-control-center
