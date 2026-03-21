# GenAI Control Center - Product Roadmap

> **Last Updated:** March 21, 2026  
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
| **RAG / Vector DB Observability** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| **LLM-as-a-Judge Evaluations** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 📋 |
| **Evaluation Datasets** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 📋 |
| **Experiment / A-B Model Testing** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 📋 |
| **Online Evaluation Rules** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | 📋 |
| **Annotation Queues (Human Review)** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Evaluation Leaderboards** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 📋 |
| **Conversation / Session Tracking** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Conversation Clustering / Topics** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 📋 |
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
| **Audit Logs** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Multi-modal (image/audio/code)** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Agent Visual Graph View** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Data Export (blob / S3 / GCS)** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

> ✅ = Available | ⚠️ = Partial | ❌ = Not Available | 📋 = On GCC Roadmap

### GCC Competitive Gaps — Grouped by Priority (Updated March 21, 2026)

| Group | Description | Competitors that have it | GCC Status | GCC Priority |
|-------|-------------|--------------------------|------------|-------------|
| **A — Evaluation Engine** | LLM-as-judge scoring, hallucination/toxicity/relevance evals, eval datasets, experiments, online rules, annotation queues | All 7 | 📋 Phase 8.1 | 🔴 Critical — #1 gap |
| **B — Conversation Intelligence** | Session/multi-turn tracking, conversation clustering, topic analysis, failure-to-answer | Arize, Opik, Langfuse, LangSmith, W&B, Datadog | ✅ Core done, enhancements 📋 | 🟢 Mostly closed |
| **C — Prompt Engineering Tooling** | Prompt playground (interactive), version control, A/B testing | All 7 | 📋 | 🟡 High |
| **D — Modern Protocols** | MCP server tracing, CI/CD eval hooks | Langfuse, W&B, Datadog | 📋 | 🟡 Medium |
| **E — Spend Management** | Cost budget alerts, threshold notifications, per-team cost budgets | Langfuse, LangSmith, Helicone, Datadog | ⚠️ Partial (guardrails exist) | 🟡 Medium |
| **F — Enterprise Governance** | RBAC, audit logs, data export, tenant isolation | Langfuse, LangSmith, W&B, Datadog | ✅ Audit logs done | 🟠 Enterprise |

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

## ✅ Current Capabilities (v3.0.0 — March 21, 2026 Audit)

> **28 pages, 32 hooks, 13 reusable components, 8 MCP integrations** — all backed by real DQL queries against Dynatrace Grail. No mock data.

### Core Pages (Original Pillars)

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| 🏠 Home | `/` | ✅ Complete | Executive dashboard with KPIs, maturity score ring, DonutChart, TimeseriesChart |
| 💚 Health Dashboard | `/services` | ✅ Complete | Auto-discovery, FilterBar, service cards with latency/error/token metrics |
| 🔗 AI Topology | `/topology` | ✅ Complete | Service→Provider→Model node graph visualization |
| 🤖 Agent Tools | `/agents` | ✅ Complete | Tool calls DataTable, loop detection, HoneycombChart, agent cost analysis |
| 📉 Model Drift | `/drift` | ✅ Complete | Drift scoring, version tracking, baseline comparison |
| 💰 FinOps | `/finops` | ✅ Complete | Cost trends, provider split, Davis forecasting, cost guardrails, rate cards |
| 🛡️ Governance | `/governance` | ✅ Complete | OWASP LLM Top-10, audit trail, compliance |
| 🔒 Prompt Governance | `/prompt-governance` | ✅ Complete | PII/injection detection, Davis scoring, prompt pattern analysis |
| 📊 Response Analytics | `/analytics` | ✅ Complete | Token efficiency, TTFT anomalies, model comparison DataTable |
| 🤖 Intelligence | `/intelligence` | ✅ Complete | Full-width agentic chat, tool orchestration, NL→DQL |
| ⚙️ Operations | `/operations` | ✅ Complete | Davis problems, workflow execution, incident timeline |
| 🚨 Real-Time Alerts | `/problems` | ✅ Complete | Davis problems DataTable, severity badges, deep-links |
| 🔍 RAG / Vector DB | `/vector-db` | ✅ Complete | Pinecone metrics, embeddings, pipeline health, RAGHealthPanel |
| 🏗️ AI Architect | `/ai-architect` | ✅ Complete | Recommendation cards (cost/perf/reliability/security/best-practice) |

### Extended Pages (Added v2.9.0–v3.0.0)

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| 📈 AI Quality Dashboard | `/quality` | ✅ Complete | NIST AI RMF / DORA / Apdex 5-dimension scoring, DataTable, Davis forecast |
| 🏢 Infrastructure | `/infrastructure` | ✅ Complete | Deployment events, service config snapshot, model version history |
| 🔄 Provider Comparison | `/providers` | ✅ Complete | Cross-provider cards, normalized metrics |
| 🔀 Provider Status | `/provider-status` | ✅ Complete | Failover readiness, model health, error bursts, trend sparklines |
| 🔧 MLOps | `/mlops` | ✅ Complete | Model registry, SLOs, comparison, cost attribution, deployments |
| 🤖 Agentic Deep Dive | `/agentic` | ✅ Complete | Orchestration, handoffs, loops, decisions (MCP-validated 707M+ spans) |
| 💬 Conversation Intelligence | `/conversation` | ✅ Complete | Session grouping by conversation_id, turn counts, token usage |
| 👩‍💻 Developer Experience | `/devex` | ✅ Complete | Instrumentation coverage, model routing, DQLEditor, gap analysis |
| 🔐 Security Audit Trail | `/security` | ✅ Complete | Security events, PII detection, incident timeline, compliance |
| 🔌 Integrations Hub | `/integrations` | ✅ Complete | 8 MCP integrations (Slack, PagerDuty, Prometheus, AWS, Grafana, GitHub) |
| 🧪 Data Playground | `/data` | ✅ Complete | DQL playground with GenAI-specific preset queries |

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
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v3.0.0)

> Implemented across `AgentTools.tsx` (tool calls, loop detection, HoneycombChart, cost analysis) and `AgenticDeepDive.tsx` (orchestration, handoffs, loops, decisions). MCP-validated against 1.18M spans.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Agent Performance Dashboard | `traceloop.entity.name`, `traceloop.span.kind="task"` | ✅ | AgentTools + AgenticDeepDive pages |
| Tool Reliability Metrics | `traceloop.span.kind="tool"` | ✅ | 7 tools, 77K+ calls |
| Workflow Tracking | `traceloop.span.kind="workflow"` | ✅ | LangGraph data, 35K+ workflow spans |
| Loop Detection Alerts | Task count per trace | ✅ | Suspicious loop detection in AgentTools |
| Agent Handoff Visualization | `transfer_to_*` tools | ✅ | 35K+ handoff calls, delegation graph in AgenticDeepDive |
| Supervisor Pattern Analysis | `traceloop.entity.name="supervisor"` | ✅ | 141K supervisor spans, cross-agent token attribution |

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
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** ✅ Completed (v3.0.0)

> Implemented: `AIQualityDashboard.tsx` with NIST AI RMF / DORA / Apdex industry-standard 5-dimension scoring (Reliability, Latency, Efficiency, Error Resilience, Output Quality). Per-service DataTable with paginated scores, scoring methodology modal, Davis forecast integration. `ModelDrift.tsx` covers model version tracking.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Model Version Tracking | `gen_ai.request.model` vs `gen_ai.response.model` | ✅ | ModelDrift page — 66k mismatches detected |
| Response Variance Analysis | Completion grouping | ✅ | ResponseAnalytics page |
| Output Length Monitoring | Token counts | ✅ | ResponseAnalytics + AIQuality |
| Model A/B Comparison | 22 models with metrics | ✅ | MLOps Model Comparison tab |
| 5-Dimension Quality Scoring | NIST/DORA/Apdex composite | ✅ | AIQualityDashboard |
| Davis Forecast for Quality | `GenericForecastAnalyzer` | ✅ | Confidence band chart |

#### Limitations (Still Apply)
- ⚠️ No semantic similarity scoring (would need embeddings)
- ⚠️ No groundedness metrics (no source citations) → Partially addressable via RAG context parsing (see §5.4)
- ⚠️ No user feedback data (no thumbs up/down) → `/api/v1/thumbsUp|Down` endpoints detected but not enriched

---

### 2.2 Incident Correlation & RCA
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v3.0.0)

> Implemented across `Operations.tsx` (AnnotationsChart, Davis problems DataTable, workflow execution tracking) and `RealTimeAlerts.tsx` (live Davis problems, severity badges, deep-links to Dynatrace Problems app). `ProviderStatus.tsx` adds failover readiness and error burst detection.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Davis Problems for AI | `dt.davis.problems` | ✅ | Operations + RealTimeAlerts pages |
| Affected Entity Mapping | `affected_entity_ids` | ✅ | Service correlation with deep-links |
| Blast Radius Calculation | Entity relationships | ✅ | Provider failover readiness scoring |
| Problem Timeline | `event.start`, `event.end` | ✅ | AnnotationsChart in Operations |

#### DQL Validated
```dql
fetch dt.davis.problems, from: now()-7d
| filter contains(toString(affected_entity_ids), "SERVICE-E549607993D1A67C")
| fields event.id, event.name, event.category, affected_entity_ids
```

---

### 2.3 Security Posture (Basic)
**Priority:** P2 | **Feasibility:** 🟡 PARTIAL | **Status:** ✅ Completed (v3.0.0)

> Implemented: `SecurityAuditTrail.tsx` (security events DataTable, severity badges, PII detection, incident timeline). `Governance.tsx` OWASP LLM Top-10 tab (prompt injection, PII leakage, unvalidated outputs, excessive permissions, outdated SDKs). `PromptGovernance.tsx` (Davis scoring of prompts for PII/injection/bias/hallucination).

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Prompt Injection Detection | Pattern matching | ✅ | PromptGovernance + Governance OWASP tab |
| PII Detection (Enhanced) | Regex patterns + Davis scoring | ✅ | Davis `scorePromptsBatchWithDavis()` classifies PII |
| Large Response Flagging | Output token threshold | ✅ | ResponseAnalytics page |
| Suspicious Pattern Alerting | Davis integration | ✅ | SecurityAuditTrail page |

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
**Priority:** P3 | **Feasibility:** 🟡 PARTIAL | **Status:** ✅ Completed (v3.0.0)

> Implemented: `DeveloperExperience.tsx` with Lighthouse-style instrumentation coverage per model, model routing patterns, DQLEditor for ad-hoc queries, Davis AI for instrumentation gap analysis, and actionable recommendations.

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Deep Link to Traces | `trace.id`, `span.id` | ✅ | Distributed Traces integration |
| Service Entity Linking | `dt.entity.service` | ✅ | All pages |
| Model Selection Guide | Performance comparison | ✅ | MLOps Model Comparison tab |
| Instrumentation Coverage | Span field analysis | ✅ | DeveloperExperience page |

---

---

## 📊 Viatris Enterprise AI Metrics — Gap Analysis (Feb 24, 2026)

> **Source:** Viatris Metrics.xlsx — 134 metrics across 6 domains
> **Methodology:** Cross-referenced against Dynatrace Grail data, GCC code, and roadmap

### Coverage Summary

| Domain | Total Metrics | Already Built | Buildable Now | Blocked (No Data) | On Roadmap |
|---|---|---|---|---|---|
| **1. App & Model Inference Telemetry** | 22 | **20 (91%)** | 1 | 1 | 1 |
| **2. Agent & Workflow Tracing** | 22 | **18 (82%)** | 1 | 3 | 0 |
| **3. RAG / Retrieval & Vector DB** | 18 | **8 (44%)** | 4 | 6 | — |
| **4. Quality, Safety & Policy** | 22 | **8 (36%)** | 1 | 13 | Phase 0 |
| **5. Governance, Audit & Compliance** | 19 | **10 (53%)** | 4 | 5 | Phase 0/4 |
| **6. Platform & Dependency Health** | 31 | **16 (52%)** | 8 | 3 | — |
| **TOTAL** | **134** | **80 (60%)** | **19 (14%)** | **31 (23%)** | **4 (3%)** |

### Key Findings

1. **Domain 1 (Model Inference)** — Near-complete. Only TTFT display and precision/recall remain.
2. **Domain 3 (RAG/Vector DB)** — **Now 44% coverage** (was 0%). VectorDB page with Pinecone metrics, embeddings, pipeline health built. Remaining: retrieval relevance scores, semantic cache, embedding drift.
3. **Domain 6 (Platform Health)** — **Now 52% coverage** (was 39%). Infrastructure page live with deployment events + service config. Remaining: GPU/CPU/K8s cards.
4. **Domain 4 (Quality/Safety)** — **Now 36% coverage** (was 18%). AIQualityDashboard + SecurityAuditTrail + PromptGovernance built. 13 metrics still blocked on Phase 0.
5. **Domain 2 (Agent Tracing)** — **Now 82% coverage** (was 59%). AgentTools + AgenticDeepDive + ConversationIntelligence built. Only agent memory/A2A remain.
6. **Domain 5 (Governance)** — **Now 53% coverage** (was 26%). Governance OWASP tab + SecurityAuditTrail + audit trail. 5 metrics blocked on Phase 0.

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
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v3.0.0)

> Implemented: `VectorDB.tsx` with HoneycombChart (vector store), TreeMap (latency distribution), TimeseriesChart (pipeline health), RAGHealthPanel composite scoring. `useVectorDB.ts` hook with Pinecone + embedding pipeline queries. `useRAGHealthScore.ts` for composite RAG health scoring.

**Page:** `/vector-db` | **Hook:** `useVectorDB.ts`

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Pinecone Query Volume (timeseries) | `pinecone.query` spans | ✅ | ~141K/week (MCP-validated) |
| Query Latency (avg, p50, p95, p99) | `duration` on `db.system=pinecone` | ✅ | Avg 505ms, 0 errors |
| Embedding Volume by Provider | `openai.embeddings`, `ollama.embeddings`, `vertexai` embedding spans | ✅ | ~113K/week across 4 providers |
| Embedding Model Comparison | Provider × model × latency × volume | ✅ | 9 embedding models detected |
| RAG Pipeline Trace View | `trace.id` correlation: embed→pinecone→LLM | ✅ | Full E2E trace available |
| Vector Store Health | Pinecone error rate, availability | ✅ | RAGHealthPanel composite score |
| Retrieval Anomaly Detection | Davis `AutoAdaptiveAnomalyDetectionAnalyzer` | 📋 | Analyzer available, not yet wired |
| Duplicate Query Detection (Cache Opportunity) | Prompt grouping heuristic | 📋 | Hook ready, UI partial |

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

---

### 5.4 RAG Advanced Observability — Data Feasibility Assessment (March 2026)

> **DRIVER:** Community research (Reddit r/LangChain, r/Rag, r/LLMDevs, OpenAI forums) identified 7 critical RAG observability gaps that real users struggle with.
> **METHODOLOGY:** Each gap was validated against **live Dynatrace Grail data** via MCP DQL queries against the `ai-travel-advisor-agent-test` service (Pinecone + multi-provider LLMs). No mocks or stubs — only real telemetry.
> **STATUS:** 🔵 DEFERRED — Will reassess when upstream instrumentation adds the missing attributes.

#### Live Data Inventory (Validated via MCP — March 2026)

##### A. Standard OpenLLMetry Spans (`gen_ai.*`)

| Signal | Available? | Source / Details |
|--------|-----------|------------------|
| Full RAG pipeline trace (11 spans/request) | ✅ | `trace.id` correlation via `matchesPhrase(toString(trace.id), ...)` |
| Duration per pipeline step | ✅ | `duration` on every span (e.g., embed 146ms → Pinecone 645ms → LLM 1938ms) |
| Model name & provider | ✅ | `gen_ai.request.model`, `gen_ai.provider.name` — 20 model/provider combos |
| Input/output tokens (Azure, OpenAI) | ✅ | `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` |
| Prompt content (user query) | ✅ | `gen_ai.prompt.0.content` on LLM spans (e.g., "chicago") |
| Completion content (LLM response) | ✅ | `gen_ai.completion.0.content` on LLM & ChatGemini spans |
| Pinecone `top_k` & `read_units` | ✅ | `pinecone.query.top_k` = "4", `pinecone.usage.read_units` = "6" |
| Embedding model used | ✅ | e.g., `textembedding-gecko@001`, `text-embedding-3-large`, `text-embedding-ada-002` |
| Retrieval similarity scores | ❌ | `pinecone.query.score` = null |
| Retrieved document content | ❌ | Not captured in any span attribute |
| Embedding vectors/dimensions | ❌ | `embedding.dimension` = null |
| Quality/accuracy metrics | ❌ | `model.accuracy`, `model.quality`, `model.score` = null |
| Cost in dollars | ❌ | `gen_ai.usage.cost` = null (computable from tokens × rate card) |
| Span events for eval scores | ❌ | 0 events matching pinecone/retrieval/gen_ai/llm patterns |

##### B. Provider-Native Span Attributes (Non-OpenLLMetry)

> **Discovery (March 21, 2026):** Additional data exists in Grail that comes directly from cloud AI providers and LangChain, NOT in the standard `gen_ai.*` namespace.

| Signal | Available? | Span / Source | Details |
|--------|-----------|---------------|---------|
| `llm.request.type` | ✅ | `bedrock.invoke_model`, `openai.chat`, `vertexai.generate_content`, `ollama.chat` | Values: `"chat"`, `"completion"`, `"embeddings"` — distinguishes call type |
| `llm.is_streaming` | ✅ | `bedrock.invoke_model`, `openai.chat`, `vertexai.generate_content`, `ollama.chat` | Values: `"true"` / `"false"` — streaming vs batch |
| `gen_ai.request.temperature` | ✅ | `bedrock.invoke_model`, `openai.chat` | e.g., `"1.8"` — model temperature setting. NULL on Vertex/Ollama chat spans. |
| `gen_ai.prompt.0.role` | ✅ | `openai.chat`, `ollama.chat` | Values: `"user"` — message role. NULL on Bedrock/Vertex. |
| `gen_ai.completion.0.role` | ✅ | `openai.chat`, `vertexai.generate_content` | Values: `"assistant"` — response role. NULL on Bedrock/Ollama. |
| **Full RAG context in prompt** | ✅ | `openai.chat`, `ollama.chat` spans | `gen_ai.prompt.0.content` contains `"Context: [retrieved documents]\nQuestion: [user query]"` — **retrieved documents ARE embedded in the prompt** |
| `ChatBedrock.langchain.task` | ✅ | LangChain wrapper spans | Prompt + completion content on LangChain task spans (266 spans/2h) |
| `ChatOpenAI.langchain.task` | ✅ | LangChain wrapper spans | Prompt + completion (263 spans/2h) |
| `ChatGemini.langchain.task` | ✅ | LangChain wrapper spans | Prompt + completion (262 spans/2h) |
| `ChatOllama.langchain.task` | ✅ | LangChain wrapper spans | Prompt + completion (259 spans/2h) |
| `report_model_metrics` | ⚠️ | Custom span (742 spans/2h) | Span exists but all custom attributes are null |
| `/api/v1/thumbsUp` | ⚠️ | HTTP endpoint span | **User feedback endpoints exist** (2 spans each/2h) — spans have no attributes yet but the signal is present |
| `/api/v1/thumbsDown` | ⚠️ | HTTP endpoint span | Same as thumbsUp — feedback intent exists in the app |

##### B.1 Per-Provider Attribute Matrix (All 5 Providers — Validated March 21, 2026)

> **KEY FINDING:** Provider names differ between data sources — spans use lowercase (`"openai"`) while metrics use capitalized (`"Azure"`). The `openai` provider in spans covers BOTH Azure OpenAI (deployment names like `genai-demo` → `gpt-35-turbo`) and native OpenAI (`gpt-4o`). VertexAI appears in spans but NOT in metrics.

**Span Providers** (4 in `gen_ai.provider.name`): `openai` (535/2h), `amazon` (530/2h), `VertexAI` (528/2h), `ollama` (517/2h) + 10,656 null-provider spans

**Metric Providers** (4 in `gen_ai.provider.name`): `Azure`, `amazon`, `ollama`, `openai` — note: `VertexAI` absent from metrics, `Azure` absent from spans

**Bizevent Providers** (3 in `gen_ai.system`): `openai` (256 input/262 output), `amazon` (263/263), `ollama` (251/250) — VertexAI and Azure absent from bizevents

| Attribute | OpenAI (native) | Azure OpenAI | Amazon Bedrock | Google VertexAI | Ollama |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Span Names** | `openai.chat`, `openai.embeddings` | `openai.chat`, `openai.embeddings` | `bedrock.invoke_model` | `vertexai.generate_content` | `ollama.chat`, `ollama.embeddings` |
| **LangChain Task Span** | `ChatOpenAI.langchain.task` | `ChatOpenAI.langchain.task` | `ChatBedrock.langchain.task` | `ChatGemini.langchain.task` | `ChatOllama.langchain.task` |
| **Models (chat)** | `gpt-4o` → `gpt-4-turbo-2024-04-09` | `genai-demo` → `gpt-35-turbo`, `genai-model` | `claude-2.1`, `claude-opus-4-1`, `deepseek-llm-r1:7b`, `gpt-oss-20b-1:0`, `amazon.titan-text-premier-v1:0`, `titan-text-lite-v1` | `gemini-2.5-pro-preview-03-25`, `gemini-2.0-flash-001`, `gemini-1.5-flash-002` | `orca-mini:3b`, `llama3.1:405b`, `llama3.1:8b`, `mistral-small:22b` |
| **Models (embeddings)** | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` → `ada` | same | `titan-embed-text-v1` | `textembedding-gecko@001` | `llama3.1:8b`, `llama3.1:405b`, `mistral-small:22b`, `orca-mini:3b` |
| `gen_ai.usage.input_tokens` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `gen_ai.usage.output_tokens` | ✅ | ✅ | ✅ (chat only) | ❌ | ✅ |
| `gen_ai.prompt.0.content` | ✅ (with RAG context) | ✅ (with RAG context) | ❌ (null on `bedrock.*`) | ❌ (null) | ✅ (with RAG context) |
| `gen_ai.completion.0.content` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gen_ai.prompt.0.role` | ✅ `"user"` | ✅ `"user"` | ❌ | ❌ | ✅ `"user"` |
| `gen_ai.completion.0.role` | ✅ `"assistant"` | ✅ `"assistant"` | ❌ | ✅ `"assistant"` | ❌ |
| `gen_ai.request.temperature` | ✅ `"1.8"` | ✅ `"1.8"` | ✅ `"1.8"` | ❌ | ❌ |
| `llm.request.type` | ✅ `"chat"` / `"embeddings"` | ✅ | ✅ `"completion"` / `"embeddings"` | ✅ `"completion"` / `"embeddings"` | ✅ `"chat"` / `"embeddings"` |
| `llm.is_streaming` | ✅ `"false"` | ✅ `"false"` | ✅ `"false"` | ✅ `"false"` | ✅ `"false"` |
| `gen_ai.response.finish_reason` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gen_ai.response.id` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `server.address` | ❌ | ❌ | ❌ | ❌ | ❌ |
| **OTel Metric: token.usage** | ✅ | ✅ (separate `"Azure"` provider) | ✅ | ❌ | ✅ |
| **OTel Metric: operation.duration** | ✅ | ✅ (separate `"Azure"` provider) | ✅ | ❌ | ✅ |
| **Bizevent: prompt I/O** | ✅ | ✅ (within `"openai"` system) | ✅ | ❌ | ✅ |
| **Bizevent: training** | ❌ | ❌ | ✅ (CloudTrail) | ❌ | ❌ |

##### B.2 Key Provider-Specific Observations

1. **VertexAI is the least instrumented** — No tokens, no prompt content, no OTel metrics, no business events. Only has completion content, response role, and `llm.*` attributes. Possible fix: Vertex AI Python SDK may need explicit Traceloop/OpenLLMetry configuration.

2. **Azure OpenAI vs OpenAI** — Share the same span names (`openai.chat`/`openai.embeddings`) and provider `"openai"`. Distinguished only by deployment-style model names (`genai-demo`, `genai-model`). In OTel metrics, Azure is correctly separated as provider `"Azure"` with model `gpt-4o-mini-2024-07-18`.

3. **Amazon Bedrock** — Richest training data (CloudTrail fine-tuning events). Missing prompt content on direct `bedrock.invoke_model` spans, but LangChain `ChatBedrock.langchain.task` wrapper spans DO have prompts. Has unique models: `claude-opus-4-1`, `deepseek-llm-r1:7b`, `gpt-oss-20b-1:0`.

4. **Ollama** — Full prompt/completion/tokens despite being local. Interesting model mismatch: `gen_ai.request.model` = `"llama3.1:405b"` but `gen_ai.response.model` = `"orca-mini:3b"` (likely load-balanced or model-swapped).

5. **RAG context availability** — Retrieved documents embedded in prompt for OpenAI, Azure OpenAI, and Ollama chat spans. NOT available for Bedrock or VertexAI direct spans (but available on their LangChain task wrappers).

##### C. OTel GenAI Semantic Convention Metrics (Native)

> **Discovery:** Besides spans, the environment has **OTel GenAI metrics** flowing into Grail, following the [OpenTelemetry GenAI Semantic Conventions for Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/).

| Metric | Available? | Providers | Models | Details |
|--------|-----------|-----------|--------|---------|
| `gen_ai.client.token.usage` | ✅ | `Azure` (1), `amazon` (7), `ollama` (4), `openai` (8) = **20 model/provider combos** | gpt-4o, gpt-35-turbo, claude-2.1, claude-opus-4-1, deepseek-r1, titan-embed, llama3.1, orca-mini, mistral-small, ada, etc. | Token usage timeseries. ⚠️ VertexAI NOT present in metrics. |
| `gen_ai.client.operation.duration` | ✅ | `Azure` (1), `amazon` (7), `ollama` (4), `openai` (3) = **15 model combos** | Same minus some embedding models | LLM operation latency timeseries. ⚠️ VertexAI NOT present. |
| `gen_ai.client.time_to_first_token` | ❌ | — | — | Not present in this environment |
| `gen_ai.client.time_per_output_token` | ❌ | — | — | Not present |
| `gen_ai.server.request.duration` | ❌ | — | — | Not present (server-side metric) |
| `gen_ai.server.time_to_first_token` | ❌ | — | — | Not present |

##### D. Business Events (`gen_ai.auditing`)

> **Discovery:** 1,849 business events in 2h from the `gen_ai.auditing` event type — structured prompt I/O and AWS Bedrock training events.

| Event Type | `gen_ai.type` | Count (2h) | Providers (`gen_ai.system`) | Key Fields | Details |
|-----------|---------------|------------|----------------------------|------------|---------|
| Prompt Input | `prompt.input` | 776 | `openai` (262), `amazon` (263), `ollama` (251) | `gen_ai.prompt`, `trace.id`, `span.id` | User prompt text correlated to trace. ⚠️ VertexAI NOT present. |
| Prompt Output | `prompt.output` | 775 | `openai` (262), `amazon` (263), `ollama` (250) | `gen_ai.prompt` (output text), `trace.id`, `span.id` | LLM response text correlated to trace. ⚠️ VertexAI NOT present. |
| Training | `training` | 327 | `null` (AWS Bedrock CloudTrail) | `eventName`, `eventSource`, `awsRegion`, `jobName`, `jobStatus`, `baseModelArn`, `outputModelArn`, `hyperParameters` | AWS Bedrock `CreateModelCustomizationJob` events — IAM audit, S3 URIs, hyperparameters, job status (InProgress/Completed) |

##### E. Log Data (Validated March 21, 2026)

> **Discovery:** Grail logs were investigated for additional provider-specific telemetry, especially for VertexAI which is under-instrumented in spans/metrics/bizevents.

| Signal | Available? | Source / Details |
|--------|-----------|------------------|
| Azure OpenAI HTTP call logs | ✅ | Container output: `POST https://travel-advisor-demo.openai.azure.com/openai/deployments/genai-demo/chat/completions?api-version=2024-07-01-preview` — reveals actual endpoint URLs and deployment names |
| AWS Bedrock training events in logs | ✅ | CloudTrail `CreateModelCustomizationJob` events logged as container output — includes `jobName`, `jobStatus` (InProgress → Completed), `baseModelArn` (`amazon.titan-text-lite-v1:0:4k`), S3 URIs, hyperparameters (`batchSize`, `epochCount`, `learningRate`), IAM audit trail |
| K6 load test metrics | ✅ | Container output from K6 running against `travel-advisor-demo.travel-advisor-demo.svc.cluster.local:80` — endpoints `/api/v1/completion?prompt=berlin\|new_york\|bali`, `/api/v1/agent` — avg 2.92s latency, p95=5.38s, 4.34% error rate |
| GKE infrastructure context | ✅ | Cluster `gke-playground-dev` in `us-central1-a`, project `dynatrace-demoability`, OTel Collector DaemonSet (`otel-collector-agent`) v0.142.0 in namespace `otel-demo`, exporting via `otlphttp/dynatrace` |
| VertexAI-specific logs | ❌ | **0 results** across all search patterns: `vertex`, `gemini`, `vertexai`, `VertexAI`, `generate_content`, `textembedding-gecko`, `googleapis.com/aiplatform`, `generativelanguage` — confirms VertexAI is completely absent from logs |
| OpenAI-specific logs (beyond HTTP) | ❌ | No structured LLM request/response logging found |
| Ollama-specific logs | ❌ | No Ollama-specific container logs |

**Key Log Insight:** Logs add infrastructure context (GKE cluster, OTel Collector config, Azure endpoint URLs, load test baselines) but do NOT contain additional LLM telemetry beyond what's already in spans/metrics/bizevents. VertexAI's instrumentation gap extends to all four data sources (spans/metrics/bizevents/logs).

#### Gap-by-Gap Feasibility Verdict (REVISED — March 21, 2026)

| # | Gap | Previous Verdict | **Revised Verdict** | New Rationale |
|---|-----|:---:|:---:|-----------|
| 1 | **Retrieval Relevance Scores** | ❌ | ❌ NOT FEASIBLE | Still no `pinecone.query.score`. However, retrieved documents ARE available inside `gen_ai.prompt.0.content` on `openai.chat` spans (embedded in the RAG prompt template as `Context: ...`). Could parse these for basic context analysis. |
| 2 | **Hallucination / Answer Quality** | ⚠️ | ⬆️ **PARTIALLY FEASIBLE** | **UPGRADED:** `openai.chat` spans contain both the retrieved context (in prompt) AND the LLM completion. Can now compare completion against actual retrieved context for basic faithfulness checking. Business events (`prompt.input` + `prompt.output`) provide additional input/output pairs correlated to traces. |
| 3 | **Chunk Quality & Embedding Drift** | ❌ | ❌ NOT FEASIBLE | No change — no embedding dimensions or vectors. |
| 4 | **End-to-End RAG Quality Score** | ⚠️ | ⬆️ **PARTIALLY FEASIBLE** | **UPGRADED:** OTel metrics (`gen_ai.client.token.usage`, `gen_ai.client.operation.duration`) provide native timeseries for token efficiency and latency. Combined with pipeline trace completion rate → stronger proxy for RAG quality. |
| 5 | **Cost Attribution** | ✅ | ✅ **FULLY FEASIBLE** | No change — tokens, model, provider all present. Native metric `gen_ai.client.token.usage` adds timeseries dimension. |
| 6 | **Silent Failure Detection** | ⚠️ | ⚠️ PARTIAL | No change. |
| 7 | **User Feedback Loop** | ❌ | ⬆️ **SIGNAL EXISTS** | **UPGRADED:** `/api/v1/thumbsUp` and `/api/v1/thumbsDown` endpoint spans exist (4 spans seen). Span attributes are empty but the **feedback intent is instrumented** — app is already calling these endpoints. Business events with `prompt.input`/`prompt.output` provide the content correlation. Feasibility depends on enriching these spans with feedback metadata. |

#### What Can Be Built Today (No Mocks) — REVISED

| Feature | Data Backing | Priority | NEW? |
|---------|-------------|----------|------|
| **Cost Attribution per RAG Pipeline** | Tokens × rate card per model/provider/trace | P1 | |
| **Pipeline Latency Waterfall** | Full trace: embed (146ms) → Pinecone (645ms) → LLM gen (1938ms) | P1 | |
| **Pipeline Completion Monitoring** | Detect broken/incomplete pipelines via trace span analysis | P1 | |
| **Prompt/Completion Inspector** | Display actual prompt & completion pairs for manual quality review | P2 | |
| **Pipeline Health Score (proxy)** | Composite from latency SLOs, pipeline completion %, error rate | P2 | |
| **RAG Context Viewer** | Parse retrieved documents from `openai.chat` prompt content (`Context: ...`) | P2 | ✅ NEW |
| **Streaming vs Batch Analysis** | `llm.is_streaming` + `llm.request.type` attributes on provider spans | P2 | ✅ NEW |
| **Token Usage Timeseries (native metrics)** | `gen_ai.client.token.usage` metric, ~20 models, per-provider | P1 | ✅ NEW |
| **Operation Duration Timeseries (native metrics)** | `gen_ai.client.operation.duration` metric, 15 models | P1 | ✅ NEW |
| **Model Training Job Monitoring** | AWS Bedrock `gen_ai.auditing` business events — job status, hyperparameters, model ARNs | P2 | ✅ NEW |
| **Prompt I/O Audit Trail** | `gen_ai.auditing` bizevents with `prompt.input`/`prompt.output` per trace, 3 providers | P1 | ✅ NEW |
| **Basic Faithfulness Check** | Compare retrieved context (in prompt) vs completion (in response) on `openai.chat` spans | P3 | ✅ NEW |

#### What Requires Instrumentation Changes (Deferred)

| Feature | Missing Data | Instrumentation Needed |
|---------|-------------|----------------------|
| Retrieval relevance scores | `pinecone.query.score` | Pinecone SDK / Traceloop to emit per-result similarity scores |
| Embedding drift detection | Embedding dimensions & vectors | Instrumentation to capture `embedding.dimension`, vector norms |
| Automated hallucination detection (full) | Structured retrieved docs as separate attribute | Retrieved context as structured span attribute (not embedded in prompt text) |
| RAGAS-style quality scores | Eval framework outputs | LLM-as-judge eval pipeline emitting `gen_ai.eval.*` attributes |
| User feedback enrichment | Feedback attributes on thumbsUp/Down spans | Add `feedback.rating`, `feedback.score`, `trace.id` correlation to `/api/v1/thumbsUp|Down` endpoints |

#### Decision

> **We will reassess the remaining deferred items once upstream instrumentation adds the missing span attributes.** However, the March 21 provider-native data discovery significantly expands what can be built today — **12 features are now feasible** (up from 5), including OTel GenAI metrics, business event audit trails, RAG context parsing, and model training monitoring. All four Grail data sources (spans, metrics, bizevents, logs) have been audited across all 5 providers. VertexAI remains under-instrumented across all data sources — the only reliable VertexAI data comes via `ChatGemini.langchain.task` LangChain wrapper spans.

#### DQL Notes
- **Trace correlation quirk:** `trace.id == "..."` returns 0 results. Must use `matchesPhrase(toString(trace.id), "...")` for trace-level correlation.
- **Grail budget consumed during assessment:** ~701 GB / 1000 GB total (70.1%) across ~30 DQL queries (spans, metrics, bizevents, logs).
- **OTel GenAI metrics** consume 0 GB to query (metric timeseries are pre-aggregated).
- **Business events** are in the `bizevents` table, not `spans` — query with `fetch bizevents`.
- **Log queries** are expensive (~6 GB per broad `contains()` scan) — use targeted filters.

#### Implementation Checklist
| Component | Effort | Status |
|-----------|--------|--------|
| DQL queries in `dql-queries.ts` | 2h | ✅ |
| Types in `types/index.ts` | 1h | ✅ |
| `useVectorDB.ts` hook | 3h | ✅ |
| `VectorDB.tsx` page | 4h | ✅ |
| Route + navigation | 0.5h | ✅ |
| **Total** | **~10.5h** | ✅ |

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
**Priority:** P2 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v2.9.0) — Core page live, GPU/K8s items pending

> Implemented: `/infrastructure` page with provider availability progress bars, AI service workload table (span volume, error rate, latency, models used), Davis problems table, deployment events, service config snapshot, and model version history.
> **MCP Log Finding (March 21, 2026):** GKE cluster `gke-playground-dev` in `us-central1-a` confirmed, OTel Collector v0.142.0 DaemonSet in `otel-demo` namespace — infrastructure context available.

**Page:** `/infrastructure` | **Hook:** `useInfrastructure.ts`

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

### Current Grail Data (March 21, 2026 — MCP-Validated)

| Data Type | Volume | Fields Available | GCC Usage |
|-----------|--------|------------------|-----------|
| GenAI Spans | 572K+ (7d) | provider, model, tokens, latency, errors, prompt, completion | **20+ pages** |
| Agent Spans (traceloop) | 1.18M (7d) | entity.name, span.kind (task/tool/workflow), agent.name | **AgentTools, AgenticDeepDive** |
| Tool Calls | 77,820 (7d) | 7 unique tools, transfer_to_* handoffs | **AgentTools** |
| Workflows | 35,401 (7d) | LangGraph executions | **AgenticDeepDive** |
| Prompts | 288K (7d) | Full prompt content incl. RAG context | **PromptGovernance** |
| Completions | 176K (7d) | Full response content | **ResponseAnalytics** |
| Davis Problems | 10+ (7d) | AI service correlated | **Operations, RealTimeAlerts** |
| Pinecone (Vector DB) | 141K (7d) | `db.system=pinecone`, avg 505ms, 0 errors | **VectorDB** |
| Embedding Spans | ~113K (7d) | OpenAI/Ollama/VertexAI/Bedrock embedding models | **VectorDB** |
| Infrastructure Metrics | Continuous | GPU, CPU, memory, network via OneAgent | **Infrastructure (partial)** |
| **OTel GenAI Metrics** | **20 model combos** | `gen_ai.client.token.usage`, `gen_ai.client.operation.duration` | **⚠️ NOT USED — 0 GB query cost** |
| **BizEvents (`gen_ai.auditing`)** | **1,849/2h** | prompt.input (776), prompt.output (775), training (327) | **⚠️ NOT USED** |
| **Logs (provider-specific)** | Varies | Azure OpenAI HTTP calls, Bedrock CloudTrail, K6 load tests, GKE infra | **⚠️ NOT USED** |

### ⚠️ Untapped Data Sources — Quick Wins

> **Discovery (March 21, 2026):** The following data sources exist in Grail but are NOT consumed by any GCC page or hook. These represent free performance and capability wins.

| Data Source | What It Contains | Potential Use | Effort |
|---|---|---|---|
| **`gen_ai.client.token.usage` metric** | Pre-aggregated token timeseries for 20 model/provider combos (Azure, Amazon, Ollama, OpenAI). 0 GB query cost. | Replace span-derived token counts in FinOps/ResponseAnalytics with native metrics | 3h |
| **`gen_ai.client.operation.duration` metric** | Pre-aggregated latency timeseries for 15 model combos. 0 GB query cost. | Native latency timeseries in HealthDashboard, ResponseAnalytics | 2h |
| **`gen_ai.auditing` bizevents — prompt I/O** | 776 input + 775 output prompts/2h with `trace.id` correlation across 3 providers | Prompt I/O audit trail in Governance, compliance evidence | 4h |
| **`gen_ai.auditing` bizevents — training** | 327 Bedrock CloudTrail events/2h: `CreateModelCustomizationJob`, hyperparameters, job status, model ARNs | Model training job monitoring in MLOps | 4h |
| **Azure OpenAI HTTP logs** | Endpoint URLs: `travel-advisor-demo.openai.azure.com/openai/deployments/genai-demo/chat/completions` | Endpoint URL tracking in ProviderComparison | 2h |
| **K6 load test logs** | Performance baselines: avg 2.92s latency, p95=5.38s, 4.34% error rate | Load test baseline display in DeveloperExperience | 3h |
| **GKE infrastructure logs** | Cluster `gke-playground-dev`, OTel Collector v0.142.0, namespace `otel-demo` | Infrastructure context in Infrastructure page | 2h |
| **Provider-native span attributes** | `llm.request.type`, `llm.is_streaming`, `gen_ai.request.temperature` on provider spans | Streaming vs batch analysis, temperature visibility | 3h |
| **LangChain wrapper spans** | `ChatBedrock/OpenAI/Gemini/Ollama.langchain.task` with prompt + completion (~260 spans/2h each) | VertexAI data recovery (only reliable source), cross-provider prompt comparison | 4h |
| **User feedback endpoints** | `/api/v1/thumbsUp` and `/api/v1/thumbsDown` span signals (sparse) | Feedback intent detection, enrichment candidate | 2h |

### Per-Provider Data Completeness (MCP-Validated March 21, 2026)

| Data Source | OpenAI | Azure OpenAI | Amazon Bedrock | Google VertexAI | Ollama |
|---|:---:|:---:|:---:|:---:|:---:|
| **Spans (tokens)** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Spans (prompt)** | ✅ + RAG context | ✅ + RAG context | ❌ (via LangChain ✅) | ❌ (via LangChain ✅) | ✅ + RAG context |
| **Spans (completion)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OTel Metrics** | ✅ | ✅ (as "Azure") | ✅ | ❌ | ✅ |
| **BizEvents** | ✅ | ✅ (within "openai") | ✅ + training | ❌ | ✅ |
| **Logs** | — | ✅ HTTP calls | ✅ CloudTrail | ❌ | — |
| **Overall Coverage** | 🟢 Complete | 🟢 Complete | 🟡 Good | 🔴 Sparse | 🟢 Complete |

> **VertexAI Gap:** Under-instrumented across ALL 4 data sources. Only reliable data via `ChatGemini.langchain.task` LangChain wrapper spans. Multi-provider features should handle VertexAI's sparse data gracefully.

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

## 📅 Visual Timeline (Updated March 21, 2026)

```
FEBRUARY 2026                MARCH 2026                          APRIL 2026                  MAY 2026
Wk1   Wk2   Wk3   Wk4   Wk5   Wk6   Wk7   Wk8   Wk9   Wk10
 |     |     |     |     |     |     |     |     |     |
[P1]→[P2]→[P3]→[P5]→[P11]→[P12]→[P6+7]→[P8]→[P4]→[DONE]
Agent Qual  Mat  RAG  MLOps AgDive Plat   Eval  Adv  Release
 ✅    ✅   ✅   ✅    ✅    ✅    PART   📋   📋   v3.0

COMPLETED PHASES (as of March 21, 2026):
  ✅ Phase 1  — Agentic AI Governance + Cost Forecasting + Prompt Engineering
  ✅ Phase 2  — AI Quality + Incident Correlation + Security Posture
  ✅ Phase 3  — AI Maturity Score + Developer Experience
  ✅ Phase 5  — RAG/Vector DB page (core features)
  ✅ Phase 6  — Infrastructure Dashboard (core page, GPU/K8s items pending)
  ✅ Phase 7  — AppSec Integration + Security Audit Trail
  ✅ Phase 8.2 — Conversation Intelligence (core page, enhancements pending)
  ✅ Phase 11 — MLOps (Model Registry, SLOs, Comparison, Cost Attribution)
  ✅ Phase 12 — Agentic AI Deep Observability (Orchestration, Handoffs, Loops)

REMAINING (Priority Order):
  🔴 Phase 8.1 — LLM Evaluation Engine (#1 competitive gap — all 7 competitors have this)
     Phase A: Heuristic span-based scoring (~8.5h)
     Phase B: Davis CoPilot as LLM judge + golden datasets (~21.5h)
     Phase C: Scheduled eval workflows + CI/CD gates (~9h)
  🟡 Phase 6 enhancements — GPU/CPU/K8s/SLO cards (~12h)
  🟡 Untapped Data Sources — OTel metrics + bizevents + logs integration (~27h)
  🟡 Phase 4 — Advanced Features (blocked on Phase 0 demo app)
  🟡 Phase 0 — Reference Demo App (unblocks Business ROI, Feedback, Sovereign AI)

VIATRIS COVERAGE: 40% → 60% (80 of 134 metrics addressed)
COMPETITIVE GAPS REMAINING: 6 of 22 (Evaluation Engine is the #1 gap)
```

WEEK 9: GCC Phase 8.1 - Evaluation Engine [NEXT PRIORITY]
  - Day 1-2: Heuristic span-based scoring (Phase A)
  - Day 3: Davis CoPilot as LLM judge integration
  - Day 4: Golden dataset CRUD via Document Service
  - Day 5: Evaluation results dashboard + bizevents persistence
  Milestone: LLM evaluation parity with Arize/LangSmith/Opik
  Competitive Impact: Closes #1 competitive gap

WEEK 10: Quick Wins + Polish
  - Day 1: OTel GenAI native metrics integration (FinOps/ResponseAnalytics)
  - Day 2: Bizevent prompt I/O audit trail (Governance)
  - Day 3: GPU/K8s infrastructure cards
  - Day 4: Conversation Intelligence enhancements (topic clustering, failure-to-answer)
  - Day 5: Bug fixes, documentation, release v3.1.0

TOTAL: 10 weeks → Full Enterprise AI Control Center
VIATRIS COVERAGE: 40% → 60% (80 of 134 metrics addressed, up from 54)
COMPETITIVE GAPS CLOSED: 16 of 22 identified gaps (73%) after Phase 8.1
```

---

---

## Phase 8: Competitive Parity — Evaluation, Conversation Intelligence & Prompt Tooling (NEW — Competitor Gap)

> **DRIVER:** Competitive Analysis (Feb 25, 2026) — Deep research into Arize AX/Phoenix, Opik (Comet), Langfuse, LangSmith, Helicone, W&B Weave, and Datadog LLM Observability revealed that GCC's biggest gap vs. all 7 competitors is the **evaluation & experimentation layer** and **conversation intelligence**. These are the #1 features customers from the AI observability space ask for when evaluating tools.
> **UPDATE (March 21, 2026):** Conversation Intelligence (Phase 8.2) is now ✅ LIVE. Phase 8.1 (Evaluation Engine) is the #1 remaining priority.
>
> **DATA STATUS:** 🟢 HIGH for Groups B, E — conversation IDs, token costs already in Grail. 🟡 PARTIAL for Group A — basic heuristic evals now; true LLM-as-judge requires Phase 0. Phase 0 unlocks the full layer.\n> **PROGRESS (March 21, 2026):** Phase 8.2 (Conversation Intelligence) ✅ COMPLETED. Phase 8.1 (Evaluation Engine) remains the #1 competitive priority.

### 8.1 LLM Evaluation Engine
**Priority:** P1 | **Feasibility:** � HIGH (Davis CoPilot as LLM-judge + Document Service + Bizevents) | **Status:** 📋 Planned

**Why:** This is the single most-repeated feature across all 7 competitors. Arize, Opik, Langfuse, LangSmith, W&B, and Datadog all have robust LLM-as-a-judge scoring. Customers evaluating GCC for AI observability ask: *"Can I automatically score my production traces for hallucinations, relevance, and toxicity?"*

**Key Insight (March 2026):** Davis CoPilot IS an LLM — it can serve as the evaluation judge without requiring Phase 0 or an external eval API. Combined with the Document Service (for dataset/rubric storage) and Bizevents (for persisting evaluation results in Grail), the full evaluation engine is **unblocked today**.

**New Page:** `/evaluations` | **New Hook:** `useEvaluations.ts`

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    UI LAYER (New Page or MLOps Tab)      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Dataset Mgr  │  │ Run Manager  │  │ Results View  │  │
│  │ (upload/edit │  │ (pick model, │  │ (scores table,│  │
│  │  golden set) │  │  run eval)   │  │  trend chart) │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
├─────────┼────────────────┼───────────────────┼──────────┤
│         │          HOOK LAYER                │          │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │            useEvaluation.ts                      │    │
│  │  • loadDataset() → Document Service              │    │
│  │  • runEvaluation() → Davis CoPilot batch score   │    │
│  │  • saveResults() → Bizevents to Grail            │    │
│  │  • queryResults() → DQL fetch bizevents          │    │
│  └──────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                         │
│  ┌────────────────┐  ┌────────────┐  ┌──────────────┐   │
│  │ Documents API  │  │ Bizevents  │  │  DQL Queries  │  │
│  │ (datasets +    │  │ (eval      │  │ (query eval   │  │
│  │  rubrics)      │  │  results)  │  │  results)     │  │
│  └────────────────┘  └────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### Implementation Phases

**Phase A — Span-Based Evaluation (2-3 days, immediate value)**
Score existing production traffic with no new infrastructure.
- DQL fetches recent `gen_ai.*` spans with input/output content
- Davis CoPilot batch-scores each span on custom rubrics (reuses `scorePromptsBatchWithDavis()` from `useDavisAI.ts`)
- Results displayed in new "Evaluation" tab on MLOps page or standalone page
- Dimensions: Relevance, Completeness, Safety (governance scoring), Latency SLO, Cost Efficiency
- **Impact:** Matches Datadog's auto-evaluators. Beats Helicone & New Relic.

**Phase B — Golden Dataset Evaluation (5-7 days, enterprise feature)**
Upload test sets, run models against them, persist results.
- User creates **golden datasets** (input + expected output pairs) stored via **Document Service** (`documentsClient` — pattern from `useRateCardStorage.ts`)
- User defines **rubrics** (scoring criteria) — also stored as Documents
- Davis CoPilot acts as LLM-judge with custom evaluation prompts per rubric dimension
- Results written as **bizevents** to Grail (`event.type: "gcc.evaluation.result"`) for historical tracking + DQL querying
- UI shows pass/fail per sample, aggregate scores, trend over time
- **Scope change:** Add `storage:bizevents:write` to `app.config.json`
- **Impact:** Matches Arize/LangSmith core evaluation workflow.

**Phase C — Automated Evaluation Pipeline (5-7 days, full parity)**
- **Scheduled runs:** Dynatrace Workflow triggers nightly evaluation against golden datasets
- **CI/CD gate:** Workflow blocks model rollout if evaluation fails
- **Drift detection:** Compare current eval scores vs. baseline; alert on regression
- **Leaderboard:** Rank models by aggregate evaluation score across datasets
- **Agent tool:** Add `evaluate_model` tool to agentic orchestrator for on-demand evaluation
- **Impact:** Full competitive parity. GCC-unique: no competitor connects evaluation → workflow automation.

#### Data Schemas

**Evaluation Dataset** (stored as Dynatrace Document):
```typescript
interface EvaluationDataset {
  id: string;
  name: string;
  description: string;
  version: number;
  samples: Array<{
    id: string;
    input: string;           // The prompt
    expectedOutput?: string; // Golden answer (optional)
    context?: string;        // RAG context (optional)
    tags: string[];          // e.g., ["rag", "summarization", "code-gen"]
    metadata: Record<string, string>;
  }>;
}
```

**Evaluation Rubric** (stored as Dynatrace Document):
```typescript
interface EvaluationRubric {
  id: string;
  name: string;            // e.g., "RAG Faithfulness"
  dimensions: Array<{
    name: string;          // e.g., "Groundedness"
    weight: number;        // 0-1, weights sum to 1
    judgePrompt: string;   // Prompt template for Davis CoPilot
    passingScore: number;  // Threshold for pass (e.g., 70)
  }>;
}
```

**Evaluation Result** (written as bizevent to Grail):
```typescript
// Queryable via: fetch bizevents | filter event.type == "gcc.evaluation.result"
{
  "event.type": "gcc.evaluation.result",
  "dataset_id": "ds-001",
  "rubric_id": "rubric-rag-v2",
  "sample_id": "sample-042",
  "model": "gpt-4o",
  "provider": "openai",
  "dimension": "groundedness",
  "score": 85,
  "pass": true,
  "judge_reasoning": "Output is well-grounded in the provided context...",
  "run_id": "eval-run-2026-03-16T14:00:00Z",
  "timestamp": "2026-03-16T14:30:00Z"
}
```

#### Davis CoPilot as LLM-as-Judge
Davis CoPilot is already an LLM. Custom judge prompts can be sent through the conversation API:
```typescript
// Extend useDavisAI.ts
async function judgeResponse(input: string, output: string, rubric: string): Promise<{score: number, reasoning: string}> {
  const judgePrompt = `You are an AI evaluation judge. Score the following AI response on a 0-100 scale.
    RUBRIC: ${rubric}
    USER INPUT: ${input}
    AI OUTPUT: ${output}
    Respond with ONLY a JSON object: { "score": <number>, "reasoning": "<brief explanation>" }`;
  const result = await davisCopilotClient.executeConversation({
    body: { messages: [{ role: 'user', content: judgePrompt }] }
  });
  return JSON.parse(result.content);
}
```

#### Existing Building Blocks (Already in GCC)
| Component | Where | Reuse For |
|-----------|-------|-----------|
| Davis CoPilot batch scoring | `useDavisAI.ts` → `scorePromptsBatchWithDavis()` | LLM-as-judge per sample |
| 5-dimension quality model | `useAIQuality.ts` | Extend with custom rubric dimensions |
| Document Service (CRUD) | `useRateCardStorage.ts` pattern | Store datasets + rubrics |
| Bizevents (write to Grail) | `scripts/send_demo_bizevents.py` pattern | Persist evaluation results |
| QualityScoreRing, DimensionBar, ForecastChart | `AIQualityDashboard.tsx` | Scoring visualizations |
| Workflow automation | `useWorkflows.ts` | Scheduled runs, CI/CD gates |
| Agentic tool registry | `agent/tools.ts` | `evaluate_model` agent tool |

#### Features
| Feature | Data Source | Feasibility | Status | Phase | Notes |
|---------|-------------|------------|--------|-------|-------|
| Heuristic eval metrics | Span attributes (response length, latency, error rate) | 🟢 HIGH | 📋 | A | Buildable today from Grail spans |
| Hallucination scoring (pattern-based) | Response content patterns + DQL | 🟢 HIGH | 📋 | A | Flag responses with known hallucination indicators |
| Response quality score (latency × error-rate × token-efficiency) | `gen_ai.usage.*`, `duration`, error spans | 🟢 HIGH | 📋 | A | Composite score per trace |
| Online evaluation rules (auto-flag low-quality traces) | DQL threshold rules + Davis events | 🟢 HIGH | 📋 | A | If response quality score < threshold → flag |
| LLM-as-a-judge scoring (Davis CoPilot) | Davis CoPilot conversation API + custom judge prompts | 🟢 HIGH | 📋 | B | **UNBLOCKED** — Davis CoPilot IS the judge |
| Golden dataset management | Document Service (JSON CRUD) | 🟢 HIGH | 📋 | B | Store/edit/version datasets via `documentsClient` |
| Custom evaluation rubrics | Document Service (JSON CRUD) | 🟢 HIGH | 📋 | B | Configurable judge prompts per dimension |
| Evaluation results in Grail | Bizevents (`gcc.evaluation.result`) | 🟢 HIGH | 📋 | B | Requires `storage:bizevents:write` scope |
| DQL-queryable eval history | `fetch bizevents \| filter event.type == "gcc.evaluation.result"` | 🟢 HIGH | 📋 | B | Trend analysis, regression detection |
| Experiment comparison (prompt A vs B vs C) | DQL group by `gen_ai.request.model` × time window | 🟢 HIGH | 📋 | B | Compare quality/latency/cost across versions |
| Annotation queue (human review) | Dynatrace notebook + workflow trigger | 🟡 PARTIAL | 📋 | B | Review via Dynatrace; not native GCC UI |
| Scheduled evaluation workflows | Dynatrace Automation Engine | 🟢 HIGH | 📋 | C | Nightly runs against golden datasets |
| CI/CD quality gate | Workflow blocks deployment on eval failure | 🟢 HIGH | 📋 | C | Model rollout gated on evaluation pass |
| Evaluation leaderboard | DQL aggregate scores across datasets | 🟢 HIGH | 📋 | C | Rank models by eval score |
| Agent tool: `evaluate_model` | Agentic tool registry | 🟢 HIGH | 📋 | C | On-demand evaluation via AI assistant |

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

#### Previously Blocked — Now Unblocked via Davis CoPilot
- ~~❌ True hallucination score~~ → ✅ Davis CoPilot judges output groundedness via custom prompt
- ~~❌ Answer relevance / context precision~~ → ✅ Davis CoPilot scores relevance given input + context
- ~~❌ Grounding / faithfulness scoring~~ → ✅ Davis CoPilot evaluates RAG context + output alignment
- ~~❌ Toxicity/bias detection~~ → ✅ Existing `scorePromptsBatchWithDavis()` already classifies `pii|injection|bias|hallucination`

#### Implementation Checklist
| Component | Effort | Phase | Status |
|-----------|--------|-------|--------|
| DQL queries — heuristic evals (span-based scoring) | 2h | A | 📋 |
| Types: `EvalDataset`, `EvalRubric`, `EvalResult`, `EvalRun` | 2h | A | 📋 |
| `useEvaluation.ts` hook (Davis judge + Document Service + Bizevents) | 5h | A+B | 📋 |
| Evaluation page/tab — span-based scoring UI | 4h | A | 📋 |
| Golden dataset CRUD UI (Document Service) | 4h | B | 📋 |
| Rubric editor UI | 3h | B | 📋 |
| Davis CoPilot judge integration (`judgeResponse()`) | 3h | B | 📋 |
| Bizevents writer (eval results → Grail) | 2h | B | 📋 |
| Results dashboard (pass/fail, trends, DQL query) | 4h | B | 📋 |
| Experiment comparison view (prompt A vs B) | 3h | B | 📋 |
| Scheduled workflow evaluation runs | 3h | C | 📋 |
| CI/CD gate workflow template | 2h | C | 📋 |
| Evaluation leaderboard | 2h | C | 📋 |
| Agent tool: `evaluate_model` | 2h | C | 📋 |
| Route + navigation | 0.5h | A | 📋 |
| `storage:bizevents:write` scope addition | 0.5h | B | 📋 |
| **Phase A total** | **~8.5h** | A | |
| **Phase B total** | **~21.5h** | B | |
| **Phase C total** | **~9h** | C | |
| **Grand total** | **~39h** | | |

---

### 8.2 Conversation Intelligence & Session Tracking
**Priority:** P1 | **Feasibility:** 🟢 HIGH | **Status:** ✅ Completed (v3.0.0)

> Implemented: `ConversationIntelligence.tsx` with DataTable showing conversation summaries grouped by conversation_id/trace_id, turn counts, token usage per conversation, long-dialogue alerts, handoff detection. Enhancement opportunities remain for topic clustering and failure-to-answer detection.

**Why:** Arize, Opik, Langfuse, LangSmith, W&B, and Datadog all offer session/conversation tracking — grouping individual LLM calls into multi-turn conversation views. GCC currently shows individual spans but has no concept of a conversation. The data is **already available in Grail**: `traceloop.association.properties.conversation_id` is populated on agent spans.

**Page:** `/conversation` | **Hook:** Direct DQL via QueryClient

#### Features
| Feature | Data Source | Status | Notes |
|---------|-------------|--------|-------|
| Conversation list (grouped by conversation_id) | `traceloop.association.properties.conversation_id` | ✅ | ConversationIntelligence page |
| Conversation turn count | Span count per conversation_id | ✅ | DataTable column |
| Conversation duration (start → end) | min/max timestamp per conversation_id | ✅ | Session length |
| Multi-turn token usage | Sum tokens per conversation_id | ✅ | Total cost per session |
| Agent involved per conversation | Distinct `traceloop.entity.name` per conversation_id | ✅ | Which agents participated |
| Error rate per conversation | Error spans / total spans per conversation_id | ✅ | Session-level SLA |
| Conversation topic clustering (heuristic) | Group by `gen_ai.prompt` keyword patterns | 📋 Enhance | Auto-tag: question, booking, complaint |
| Failure-to-answer rate | Flag responses < 50 tokens or containing "I cannot" patterns | 📋 Enhance | Quality signal |
| Long conversation detection (agent loops) | conversation turn count > threshold | ✅ | Agentic loop warning |

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

---

## Phase 11 — MLOps (Implemented)

> **Status:** ✅ LIVE  
> **Route:** `/mlops`  
> **Added:** March 2026  
> **Hook:** `useMLOps.ts` | **Page:** `MLOps.tsx`

### What It Does
Unified MLOps observability page with 5 tabs — all backed by real DQL queries against gen_ai.* spans in Grail. No mock data, no arbitrary composite scores.

### Tabs

1. **Model Registry** — Every model+provider combination in production. Requests, latency (avg/p95/p99), tokens, error rates, services consuming each model, first/last seen timestamps.
2. **AI SLOs** — User-configurable latency and error thresholds. Compliance computed from actual span data (% requests meeting SLO). Error budget tracking per model+service.
3. **Model Comparison** — Side-by-side performance: latency percentiles (p50/p95/p99), token efficiency (output/input ratio), error rates. Direct comparison from real metrics.
4. **Cost Attribution** — Token consumption by service and by model. Shows which services and models consume the most tokens, with % share calculations. Pairs with FinOps rate cards.
5. **Deployment Tracker** — Model version history and current service configuration. Reuses Infrastructure queries (model history + service config snapshots).

### DQL Queries Added
- `MLOPS_MODEL_REGISTRY_QUERY` — Model+provider aggregation with usage stats
- `MLOPS_SLO_COMPLIANCE_QUERY` — SLO compliance per model+provider+service
- `MLOPS_SLO_TREND_QUERY` — Hourly compliance for timeseries
- `MLOPS_MODEL_COMPARISON_QUERY` — Side-by-side model metrics
- `MLOPS_COST_BY_SERVICE_QUERY` — Token cost by service
- `MLOPS_COST_BY_MODEL_QUERY` — Token cost by model
- `MLOPS_MODEL_USAGE_TREND_QUERY` — Hourly model usage

### Key Design Decisions
- **No arbitrary scores**: All numbers are direct DQL aggregations (counts, averages, percentiles)
- **SLO management is a unique differentiator**: No competitor offers configurable AI-specific SLOs with error budget tracking

### Planned Enhancements (ties to Phase 8.1 Evaluation Engine)

| Enhancement | Effort | Impact | Phase |
|-------------|--------|--------|-------|
| **SLO burn rate alerts** — "At current error rate, you'll exhaust budget in 4h" | 3h | Very High — extends unique differentiator | Quick Win |
| **SLO report export** — PDF/JSON export for customer-facing uptime commitments | 3h | High — enterprise procurement requirement | Quick Win |
| **Cost forecasting** — "At current rate, $X by month end" (surface FinOps data) | 2h | High — parity with Helicone/Datadog | Quick Win |

---

## Phase 12 — Agentic AI Deep Observability (Implemented)

> **Status:** ✅ LIVE  
> **Driver:** Holistic Agentic AI Observability Gap Analysis (March 2026)  
> **Goal:** Elevate GCC from "GenAI monitoring" to "full Agentic AI observability platform"  
> **Methodology:** Assessed against OpenTelemetry GenAI Semantic Conventions, enterprise agentic frameworks (LangGraph, CrewAI, AutoGen, OpenAI Agents SDK), and competitive platforms  
> **Data Validation:** ✅ Validated against live Dynatrace Grail data via MCP Server (March 20, 2026)  
> **Implementation:** `AgenticDeepDive.tsx` page with orchestration, handoffs, loops, decisions tabs. `useAgenticDeepDive.ts` hook.

### MCP-Validated Data Inventory (Live Grail — 7-day window)

| Data Signal | Volume | Details |
|------------|--------|---------|
| **`traceloop.span.kind` values** | 1.18M spans | `task`: 1,068,798 / `tool`: 77,820 / `workflow`: 35,401 |
| **`traceloop.span.kind == "agent"`** | **0 spans** | ❌ No explicit agent spans — agents tracked via `gen_ai.agent.name` on task/chat spans instead |
| **`gen_ai.agent.name`** | 297K spans | `supervisor`: 141K / `FAQ_agent`: 99K / `flight_state_and_weather_agent`: 57K |
| **`traceloop.entity.name`** | 1.18M spans | 18 unique entities: `supervisor`, `agent`, `call_model`, `RunnableSequence`, `Prompt`, `should_continue`, `tools`, `FAQ_agent`, `call_agent`, `LangGraph`, `flight_state_and_weather_agent`, `transfer_to_faq_agent`, `transfer_to_flight_state_and_weather_agent`, `faq`, `ticket_cost`, `flight_status`, `weather`, `baggage_information_and_overweight_fees` |
| **GenAI spans (with tokens)** | 358K spans | 4 providers: Azure (149K), Ollama (70K), Amazon (70K), OpenAI (70K) |
| **Prompt content** | 288K spans | `gen_ai.prompt.0.content` populated |
| **Completion content** | 176K spans | `gen_ai.completion.0.content` populated |
| **Tool calls in completions** | 78K spans | `gen_ai.completion.0.tool_calls.0.name` populated |
| **`gen_ai.response.model`** | 358K spans | 100% populated on gen_ai spans |
| **Vector DB (Pinecone)** | 141K spans | `db.system == "pinecone"`, avg latency 505ms, 0 errors |
| **Retry patterns** | 35K traces | avg 30 tasks/trace, max 35/trace |
| **Multi-agent traces** | All traces | 2 agents per trace (`supervisor` + worker), 10 spans/trace avg |

### Key Data Findings from MCP Validation

1. **NO `traceloop.span.kind == "agent"` spans exist** — The LangGraph instrumentation emits `task`, `tool`, and `workflow` span kinds only. Agents are identified via `gen_ai.agent.name` on LLM chat spans (`AzureChatOpenAI.chat`) and task spans (`agent.task`).

2. **`gen_ai.response.finish_reason` = NOT populated** — Zero spans have this attribute. Cannot detect content_filter, length truncation, or tool_call finish reasons.

3. **`gen_ai.server.time_to_first_token` = NOT populated** — Zero spans. TTFT must use `duration` as proxy.

4. **`traceloop.association.properties.conversation_id` = NOT populated** — Zero spans. Multi-turn conversation grouping must use `trace.id` only.

5. **Zero errors across all providers** — No 429s, no error spans. Guardrail/error features will work structurally but won't show data in this environment.

6. **Zero prompt injection patterns detected** — No "ignore previous", "bypass", "jailbreak" patterns in prompts.

7. **`parent_span_id` = NOT populated on traceloop spans** — All 1.18M traceloop spans have `parent_span_id = null`. Step hierarchy must be inferred from `trace.id` + `start_time` ordering, not parent-child relationships.

8. **Token data only on LLM chat spans** — Task/tool/workflow spans have zero tokens. Token attribution per agent step requires joining by `trace.id` + `gen_ai.agent.name`.

9. **Trace structure is consistent**: Every trace = ~10 spans (5 task + 4 LLM chat + 1 tool), 2 agents (supervisor + worker), ~1093 input tokens, ~102 output tokens, 3 tool calls.

### Current Coverage Heatmap

```
LLM Calls             ██████████████████░░  90%
Token & Cost           █████████████████░░░  85%
Anti-Pattern Detection ████████████████░░░░  80%
Service Dependencies   ████████████████░░░░  80%
RAG / Vector DB        ███████████████░░░░░  75%
Tool Call Analytics    ███████████████░░░░░  75%
Agent Discovery        ██████████████░░░░░░  70%
Retry/Error Patterns   ██████████████░░░░░░  70%
Conversation Intel     █████████████░░░░░░░  65%
Multi-Agent Orch.      ██████░░░░░░░░░░░░░░  30%
Security/Injection     ████░░░░░░░░░░░░░░░░  20%
Guardrail Enforcement  █░░░░░░░░░░░░░░░░░░░   5%
Agent Reasoning        ░░░░░░░░░░░░░░░░░░░░   0%
Human Feedback         ░░░░░░░░░░░░░░░░░░░░   0%
Context Window Mgmt    ░░░░░░░░░░░░░░░░░░░░   0%
Streaming/TTFT         ░░░░░░░░░░░░░░░░░░░░   0%
Tool Params/Results    ░░░░░░░░░░░░░░░░░░░░   0%
```

---

### 12.1 — Agent Step-Level Tracing & Reasoning Visibility
**Priority:** P0 — CRITICAL | **Feasibility (no mocks):** 🟢 HIGH | **MCP Validated:** ✅

> **Data exists?** YES — `traceloop.span.kind` values ("task", "tool", "workflow") confirmed in Grail with 1.18M spans. **Note: No `agent` span kind exists** — agents tracked via `gen_ai.agent.name` on task/LLM spans. `parent_span_id` is NULL on traceloop spans, so hierarchy must use `trace.id` + `start_time` ordering.

#### Features — MCP-Validated Real Data

| Feature | Data Source | MCP Status | DQL Approach |
|---------|-----------|-------------|-------------|
| Agent step waterfall view | All spans in `trace.id`, ordered by `start_time` | ✅ 10 spans/trace confirmed | No parent_span_id — use timestamp ordering |
| Step count per agent invocation | Count spans per `trace.id` where `gen_ai.agent.name` is set | ✅ Avg 10 spans/trace | Join task+LLM spans by trace.id |
| Step type breakdown | `traceloop.span.kind` distribution | ✅ task/tool/workflow confirmed | LLM spans have NO span.kind — identify by `gen_ai.request.model` presence |
| Agent exit condition inference | Last span's status in trace | ✅ But 0 errors in current data | Will work structurally; needs error data to demonstrate |
| Per-step token consumption | `gen_ai.usage.input_tokens` on LLM spans within trace | ✅ Tokens ONLY on LLM spans | Task/tool spans have 0 tokens — attribute by `gen_ai.agent.name` |
| Reasoning chain reconstruction | `gen_ai.completion.0.content` on LLM spans | ✅ 176K spans have completions | Show ordered completions per agent within trace |

#### DQL Queries (Validated Pattern)
```dql
-- Agent step waterfall: all spans in an agent trace, ordered
fetch spans, from:now()-24h
| filter trace.id == "<trace_id>"
| fields span.id, span.name, parent_span_id, traceloop.span.kind,
    gen_ai.agent.name, traceloop.entity.name,
    start_time, duration, otel.status_code,
    gen_ai.usage.input_tokens, gen_ai.usage.output_tokens,
    gen_ai.completion.0.content
| sort start_time asc

-- Step count distribution across all agent traces
fetch spans, from:now()-24h
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent"
| lookup [
    fetch spans, from:now()-24h
    | filter isNotNull(traceloop.span.kind)
    | summarize step_count = count(), by: {trace.id}
  ], sourceField:trace.id, lookupField:trace.id, fields:{step_count}
| summarize avg_steps = avg(step_count), max_steps = max(step_count),
    p95_steps = percentile(step_count, 95),
    by: {gen_ai.agent.name, traceloop.entity.name}

-- Agent exit condition inference
fetch spans, from:now()-24h
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent"
| fieldsAdd exit_condition = if(otel.status_code == "ERROR", "error",
    if(duration > 60000000000, "timeout",
    if(duration > 30000000000, "slow_completion", "success")))
| summarize
    total = count(),
    errors = countIf(exit_condition == "error"),
    timeouts = countIf(exit_condition == "timeout"),
    slow = countIf(exit_condition == "slow_completion"),
    success = countIf(exit_condition == "success"),
    by: {gen_ai.agent.name, traceloop.entity.name}
```

#### Not Feasible Without Mocks
- ❌ Agent CoT/reasoning text capture (`gen_ai.agent.reasoning`) — Requires framework-level instrumentation to emit thinking steps as span attributes
- ❌ Agent plan/subgoal tracking (`gen_ai.agent.plan`) — No standard OTel attribute yet
- ❌ Agent type classification (`gen_ai.agent.type`) — Would need framework metadata or manual tagging

---

### 12.2 — Tool Parameter & Result Transparency
**Priority:** P1 — HIGH | **Feasibility (no mocks):** 🟡 PARTIAL | **MCP Validated:** ✅

> **Data exists?** PARTIALLY — 77,820 tool spans confirmed (`traceloop.span.kind == "tool"`). 7 unique tools: `transfer_to_faq_agent`, `transfer_to_flight_state_and_weather_agent`, `faq`, `ticket_cost`, `flight_status`, `weather`, `baggage_information_and_overweight_fees`. Tool spans have **zero tokens, zero model, zero completions** — they are envelope spans only. Tool call names also appear in 78K LLM completion spans via `gen_ai.completion.0.tool_calls.0.name`.

#### Features

| Feature | Data Source | Feasibility | Notes |
|---------|-----------|-------------|-------|
| Tool input parameter capture | `gen_ai.completion.0.tool_calls.0.arguments` | 🟡 PARTIAL | Some SDKs populate; many don't |
| Tool result summary | Child span content after tool span | 🟡 PARTIAL | Can infer from next LLM span's prompt context |
| Tool success/failure per invocation | `otel.status_code` on tool spans | 🟢 REAL | Already available, not surfaced granularly |
| Duplicate tool call detection | Same `gen_ai.tool.name` + same trace with similar timestamps | 🟢 REAL | Extend existing loop detection |
| Tool call sequence diff | Compare tool sequences across traces for same agent | 🟢 REAL | Flow topology already exists; add diff view |

#### DQL Queries
```dql
-- Tool outcomes per invocation (success/failure breakdown)
fetch spans, from:now()-24h
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool"
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name)
| fieldsAdd outcome = if(otel.status_code == "ERROR", "failure", "success")
| summarize
    total = count(),
    successes = countIf(outcome == "success"),
    failures = countIf(outcome == "failure"),
    success_rate = toDouble(countIf(outcome == "success")) / toDouble(count()) * 100,
    avg_duration_ms = avg(duration) / 1000000,
    by: {tool_name, gen_ai.agent.name, traceloop.entity.name}
| sort failures desc

-- Duplicate tool call detection (same tool called multiple times in same trace)
fetch spans, from:now()-24h
| filter traceloop.span.kind == "tool" OR gen_ai.operation.kind == "tool"
| fieldsAdd tool_name = coalesce(gen_ai.tool.name, span.name)
| summarize call_count = count(), by: {trace.id, tool_name}
| filter call_count > 1
| summarize
    traces_with_dupes = count(),
    avg_duplicate_calls = avg(call_count),
    max_duplicate_calls = max(call_count),
    by: {tool_name}
| sort traces_with_dupes desc
```

#### Not Feasible Without Mocks
- ❌ Tool input parameters (`gen_ai.tool.parameters`) — Not standardly emitted by most frameworks
- ❌ Tool output/result content (`gen_ai.tool.result`) — Most frameworks don't emit tool results as span attributes
- ❌ Tool caching detection (`gen_ai.tool.cache_hit`) — No standard attribute

---

### 12.3 — Multi-Agent Orchestration Depth
**Priority:** P1 — HIGH | **Feasibility (no mocks):** 🟢 HIGH | **MCP Validated:** ✅

> **Data exists?** YES — Confirmed: every trace has 2 agents (`supervisor` → `FAQ_agent` or `flight_state_and_weather_agent`), 35K+ `transfer_to_*` handoff tool calls, and 10 spans/trace with clear orchestration flow. **However:** `parent_span_id` is NULL on all traceloop spans — hierarchy must be inferred from `gen_ai.agent.name` + `start_time` ordering within `trace.id`, not from parent-child span relationships.

#### Features — MCP-Validated Real Data

| Feature | Data Source | MCP Status | Notes |
|---------|-----------|-------------|-------|
| Agent hierarchy (supervisor → worker) | `gen_ai.agent.name` on LLM spans within same trace | ✅ supervisor + FAQ_agent/flight_agent confirmed | Cannot use parent_span_id (all NULL) — infer from trace ordering |
| Multi-agent conversation flow | `traceloop.entity.name` per span in trace | ✅ 18 unique entities | Full flow: LangGraph → call_agent → supervisor → worker → tools |
| Parallel vs sequential agent execution | Overlapping `start_time` windows within trace | ✅ Calculable | Parallelism ratio from total_agent_time / wall_clock |
| Agent delegation graph | `transfer_to_faq_agent` (21K), `transfer_to_flight_state_and_weather_agent` (14K) | ✅ Real handoff data | Supervisor delegates via transfer_to_* tool calls |
| Cross-agent token consumption | `gen_ai.usage.input_tokens` grouped by `gen_ai.agent.name` per trace | ✅ ~1093 input / ~102 output per trace | Supervisor: 307 tokens/call, Workers: 196-245 tokens/call |
| Agent communication volume | Count of `transfer_to_*` tool spans per agent pair | ✅ 35K+ handoff calls | Clear routing patterns |

#### DQL Queries
```dql
-- Multi-agent hierarchy (supervisor → workers)
fetch spans, from:now()-24h
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent"
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
| lookup [
    fetch spans, from:now()-24h
    | filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent"
    | fieldsAdd parent_agent = coalesce(gen_ai.agent.name, traceloop.entity.name, span.name)
    | fields span.id, parent_agent
  ], sourceField:parent_span_id, lookupField:span.id, fields:{parent_agent}
| filter isNotNull(parent_agent)
| summarize
    delegation_count = count(),
    by: {parent_agent, agent_name}
| sort delegation_count desc

-- Parallel agent detection (overlapping execution windows)
fetch spans, from:now()-24h
| filter traceloop.span.kind == "agent" OR gen_ai.operation.kind == "agent"
| fieldsAdd agent_name = coalesce(gen_ai.agent.name, traceloop.entity.name)
| fieldsAdd end_time = start_time + duration
| summarize
    agents = collectDistinct(agent_name),
    agent_count = countDistinct(agent_name),
    min_start = min(start_time),
    max_end = max(end_time),
    total_agent_time = sum(duration),
    by: {trace.id}
| fieldsAdd wall_clock = max_end - min_start
| fieldsAdd parallelism_ratio = toDouble(total_agent_time) / toDouble(wall_clock)
| filter agent_count > 1
| sort parallelism_ratio desc
| limit 50
```

#### Not Feasible Without Mocks
- ❌ Agent-to-agent message content — Messages between agents are not captured in span attributes
- ❌ Agent consensus/voting patterns — Requires custom instrumentation
- ❌ A2A (Agent-to-Agent) protocol tracing — No A2A-specific OTel attributes yet

---

### 12.4 — Guardrail Enforcement Telemetry
**Priority:** P0 — CRITICAL | **Feasibility (no mocks):** 🟡 PARTIAL | **MCP Validated:** ✅

> **Data exists?** PARTIALLY — Token data confirmed (358K spans across 4 providers). **However:** Zero errors exist in current environment (no 429s, no error status codes), zero prompt injection patterns detected, and `gen_ai.response.finish_reason` is NOT populated on any span. Features will work structurally but need error/attack data to demonstrate value.

#### Features — MCP Validation Status

| Feature | Data Source | MCP Status | Notes |
|---------|-----------|-------------|-------|
| Cost threshold breach detection | Token counts × pricing, computed per time window | ✅ Data exists (358K spans with tokens) | Azure avg 219 input / 23 output tokens per call |
| Rate limit detection (429s) | `error.type` or `status.message` containing "429" | ⚠️ Structural only — 0 rate limit events in current data | Will work when errors occur |
| Prompt injection pattern detection | `gen_ai.prompt.*.content` keyword matching | ⚠️ Structural only — 0 injection patterns detected | 288K prompts checked, none match |
| PII detection events | `gen_ai.prompt.*.content` + `gen_ai.completion.*.content` regex | ✅ 288K prompts + 176K completions queryable | Content searchable |
| Token budget burn rate alerts | Cumulative token usage vs configured budget | ✅ Real token data | Can compute hourly cost velocity |
| Content filter trigger inference | `gen_ai.response.finish_reason == "content_filter"` | ❌ finish_reason NOT populated | Cannot detect — attribute missing from all spans |

#### DQL Queries
```dql
-- Cost threshold breach detection (per-hour cost spikes)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)
| fieldsAdd
    input_t = coalesce(toLong(gen_ai.usage.input_tokens), toLong(gen_ai.usage.prompt_tokens), 0),
    output_t = coalesce(toLong(gen_ai.usage.output_tokens), toLong(gen_ai.usage.completion_tokens), 0)
| fieldsAdd estimated_cost = (toDouble(input_t) * 0.000003) + (toDouble(output_t) * 0.000015)
| makeTimeseries hourly_cost = sum(estimated_cost), interval: 1h
| fieldsAdd cost_spike = if(hourly_cost > 10.0, true, false)

-- Prompt injection pattern detection
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.prompt.1.content)
| fieldsAdd prompt_text = coalesce(toString(gen_ai.prompt.1.content), toString(gen_ai.prompt.0.content))
| filter matchesPhrase(prompt_text, "ignore previous")
    OR matchesPhrase(prompt_text, "ignore all instructions")
    OR matchesPhrase(prompt_text, "bypass")
    OR matchesPhrase(prompt_text, "pretend you are")
    OR matchesPhrase(prompt_text, "jailbreak")
    OR matchesPhrase(prompt_text, "DAN")
    OR matchesPhrase(prompt_text, "do anything now")
| summarize injection_attempts = count(),
    by: {gen_ai.request.model, gen_ai.provider.name, dt.entity.service}
| sort injection_attempts desc

-- Rate limit (429) event detection
fetch spans, from:now()-24h
| filter otel.status_code == "ERROR"
| filter contains(toString(error.type), "429")
    OR contains(toString(status.message), "rate_limit")
    OR contains(toString(status.message), "Rate limit")
    OR contains(toString(error.message), "429")
| summarize
    rate_limit_hits = count(),
    by: {gen_ai.provider.name, gen_ai.request.model, dt.entity.service}
| sort rate_limit_hits desc
```

#### Not Feasible Without Mocks
- ❌ Explicit guardrail trigger events (`gen_ai.guardrail.policy_enforced`) — Requires business events or custom instrumentation
- ❌ Guardrail action taken (block/throttle/fallback) — No standard attribute
- ❌ Content filter details from provider — Provider-specific, not standardized

---

### 12.5 — Conversation State & Session Quality
**Priority:** P1 — HIGH | **Feasibility (no mocks):** 🟢 HIGH

> **Data exists?** YES — `traceloop.association.properties.conversation_id` or `trace.id` grouping + token/error metrics per session are all queryable.

#### Features — All REAL DATA

| Feature | Data Source | Feasibility | Notes |
|---------|-----------|-------------|-------|
| Conversation state classification | Span count per conversation + last span status | 🟢 REAL | Active/completed/abandoned/errored |
| Context growth tracking | Cumulative `gen_ai.usage.input_tokens` per conversation | 🟢 REAL | Shows context window filling up |
| Turn-by-turn token efficiency | Input/output tokens per turn within conversation | 🟢 REAL | Detect context bloat |
| Conversation duration distribution | Time from first to last span per conversation | 🟢 REAL | Histogram of session lengths |
| Failure-to-answer rate per conversation | Output <30 tokens or "I cannot" patterns | 🟢 REAL | Already partially implemented |
| Conversation abandonment detection | Long gap between last span and "now" without resolution | 🟢 REAL | Heuristic: no new spans in >30min |

#### DQL Queries
```dql
-- Conversation context growth (token escalation per turn)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.usage.input_tokens)
| fieldsAdd conv_id = coalesce(
    traceloop.association.properties.conversation_id,
    toString(trace.id))
| summarize
    turns = count(),
    first_turn_tokens = min(toLong(gen_ai.usage.input_tokens)),
    last_turn_tokens = max(toLong(gen_ai.usage.input_tokens)),
    total_tokens = sum(toLong(gen_ai.usage.input_tokens)) + sum(toLong(gen_ai.usage.output_tokens)),
    duration_sec = (max(start_time) - min(start_time)) / 1000000000,
    by: {conv_id}
| fieldsAdd context_growth_ratio = toDouble(last_turn_tokens) / toDouble(first_turn_tokens)
| filter turns > 2
| sort context_growth_ratio desc
| limit 100

-- Conversation state classification
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.provider.name)
| fieldsAdd conv_id = coalesce(
    traceloop.association.properties.conversation_id,
    toString(trace.id))
| summarize
    turns = count(),
    errors = countIf(otel.status_code == "ERROR"),
    last_activity = max(start_time),
    by: {conv_id}
| fieldsAdd state = if(errors > 0 AND errors == turns, "errored",
    if(errors > 0, "partial_failure",
    if(turns == 1, "single_turn",
    if(turns > 20, "runaway", "completed"))))
| summarize count = count(), by: {state}
```

#### Not Feasible Without Mocks
- ❌ User satisfaction / feedback score — No feedback telemetry in spans
- ❌ Human approval events — No approval workflow instrumentation
- ❌ Human correction tracking — No correction event attributes

---

### 12.6 — Context Window Utilization
**Priority:** P2 — MEDIUM | **Feasibility (no mocks):** 🟡 PARTIAL

> **Data exists?** PARTIALLY — Token counts per call exist. Context window *limits* per model are known constants (GPT-4: 128K, Claude: 200K, etc.) but not in spans.

#### Features

| Feature | Data Source | Feasibility | Notes |
|---------|-----------|-------------|-------|
| Context utilization % per call | `gen_ai.usage.input_tokens` / model_context_limit (lookup table) | 🟢 REAL | Needs hardcoded model limits |
| Context near-capacity warnings | Calls where input_tokens > 80% of model limit | 🟢 REAL | Threshold-based alert |
| Context growth trend over time | Timeseries of avg input_tokens per model | 🟢 REAL | Already available as tokenization drift |
| Truncation event detection | `gen_ai.response.finish_reason == "length"` | 🟡 PARTIAL | Only if finish_reason is populated |

#### DQL Queries
```dql
-- Context window utilization (requires model limit lookup)
fetch spans, from:now()-24h
| filter isNotNull(gen_ai.usage.input_tokens)
| fieldsAdd input_tokens = toLong(gen_ai.usage.input_tokens)
| fieldsAdd model = toString(gen_ai.request.model)
| fieldsAdd context_limit = if(contains(model, "gpt-4o"), 128000,
    if(contains(model, "gpt-4-turbo"), 128000,
    if(contains(model, "gpt-3.5"), 16385,
    if(contains(model, "claude-3"), 200000,
    if(contains(model, "gemini"), 1000000,
    if(contains(model, "llama"), 8192, 4096))))))
| fieldsAdd utilization_pct = toDouble(input_tokens) / toDouble(context_limit) * 100
| filter utilization_pct > 50
| summarize
    avg_utilization = avg(utilization_pct),
    max_utilization = max(utilization_pct),
    high_utilization_count = countIf(utilization_pct > 80),
    by: {model, gen_ai.provider.name}
| sort avg_utilization desc
```

#### Not Feasible Without Mocks
- ❌ Context pruning events — No attribute for "context was trimmed"
- ❌ Memory management state — No agent memory snapshots in spans
- ❌ Context reuse detection — Would need exact prompt hash comparison

---

### 12.7 — Streaming & TTFT Metrics
**Priority:** P2 — MEDIUM | **Feasibility (no mocks):** 🟡 PARTIAL

> **Data exists?** `gen_ai.server.time_to_first_token` is rarely populated. `duration` serves as proxy.

#### Features

| Feature | Data Source | Feasibility | Notes |
|---------|-----------|-------------|-------|
| Duration as TTFT proxy | `duration` on LLM spans | 🟢 REAL | Already used in TTFT queries |
| True TTFT when available | `gen_ai.server.time_to_first_token` | 🟡 PARTIAL | Few SDKs populate this |
| TTFT by model comparison | Group by `gen_ai.request.model` | 🟢 REAL | Chart p50/p95 per model |
| Streaming error detection | Error spans with short duration (connection drop) | 🟢 REAL | Heuristic: error + duration < 1s |

#### Not Feasible Without Mocks
- ❌ Inter-token latency — No per-token timing in spans
- ❌ Streaming chunk count — No `gen_ai.stream.chunk_count` attribute
- ❌ Partial response detection — Requires client-side instrumentation

---

### 12.8 — Rate Limit & Capacity Management
**Priority:** P2 — MEDIUM | **Feasibility (no mocks):** 🟢 HIGH

> **Data exists?** YES — 429 errors are captured as error spans. Usage trends enable capacity forecasting.

#### Features — All REAL DATA

| Feature | Data Source | Feasibility | Notes |
|---------|-----------|-------------|-------|
| Rate limit event tracking | `error.type`/`status.message` matching "429"/"rate_limit" | 🟢 REAL | Count rate limit hits per provider |
| Rate limit trend over time | Timeseries of 429 errors | 🟢 REAL | Detect increasing pressure |
| Usage vs capacity headroom | Request volume trend + Davis forecast | 🟢 REAL | Forecast when limits will be hit |
| Provider-level rate limit comparison | Rate limit hits grouped by provider | 🟢 REAL | Which provider is most constrained |

---

### Summary: Feasibility Without Mocks — MCP Validated ✅

> **Validated:** March 20, 2026 via Demo Dynatrace MCP Server against live Grail data (7-day window, 707M+ spans scanned)

| Sub-Phase | REAL DATA Features | STRUCTURAL ONLY (no current data) | NEEDS MOCKS | Total |
|-----------|-------------------|----------------------------------|-------------|-------|
| 12.1 Agent Step Tracing | 6 | 0 | 3 | 9 |
| 12.2 Tool Transparency | 3 | 0 | 3 | 6 |
| 12.3 Multi-Agent Depth | 6 | 0 | 3 | 9 |
| 12.4 Guardrail Events | 3 | 3 (errors/429s/injection = 0 in current env) | 3 | 9 |
| 12.5 Conversation State | 4 | 2 (conversation_id = NULL everywhere) | 3 | 9 |
| 12.6 Context Window | 3 | 0 | 3 | 6 |
| 12.7 Streaming/TTFT | 1 (duration proxy) | 2 (TTFT attr missing) | 3 | 6 |
| 12.8 Rate Limit/Capacity | 2 | 2 (0 errors in env) | 0 | 4 |
| **TOTALS** | **28** | **9** | **21** | **58** |

**28 features have confirmed REAL data. 9 more will work structurally but need production traffic with errors/security events to demonstrate. 21 need instrumentation changes (mocks).**

### Key MCP Findings Impacting Implementation

1. **`parent_span_id` is NULL everywhere** — Cannot build true parent-child span trees. Must use `trace.id` + `start_time` ordering for waterfall views. This changes DQL query patterns for 12.1 and 12.3.

2. **No `traceloop.span.kind == "agent"` exists** — Agents are identified ONLY by `gen_ai.agent.name` on LLM chat spans. DQL queries filtering for `span.kind == "agent"` will return 0 results.

3. **Tokens only on LLM spans** — Task/tool/workflow spans carry NO token data. Per-step cost attribution requires joining LLM spans to their parent agent via `trace.id` + `gen_ai.agent.name`.

4. **`gen_ai.response.finish_reason` not populated** — Cannot detect truncation (`length`), content filtering, or tool_call finish reasons. This blocks content filter detection in 12.4.

5. **Zero errors in current environment** — Guardrail, rate limit, and error cascade features will compile and run but won't show data until production environments with real error traffic are connected.

6. **`conversation_id` not populated** — Must fall back to `trace.id` for conversation grouping. Multi-session conversation tracking (12.5) will be limited to single-trace scope.

### Implementation Priority (Real-Data-First)

| Priority | What to Build | Features (Real) | Confidence |
|----------|--------------|-----------------|------------|
| **Sprint 1** | 12.1 Agent Step Tracing + 12.3 Multi-Agent Depth | 12 features | ✅ HIGH — confirmed with real trace data |
| **Sprint 2** | 12.4 Cost Guardrails + 12.8 Rate Limits | 5 real + 5 structural | ⚠️ MEDIUM — queries work but 0 error data to show |
| **Sprint 3** | 12.5 Conversation State + 12.6 Context Window | 7 features | ✅ HIGH — token data confirmed |
| **Sprint 4** | 12.2 Tool Transparency + 12.7 TTFT | 4 features | ⚠️ MEDIUM — tool spans are envelopes only |
| **Evaluation tab** — Span-based quality scoring via Davis CoPilot as judge | 8.5h | Critical — table stakes for enterprise adoption | Phase 8.1A |
| **Golden dataset evaluation** — Upload test sets, run models, persist to Grail | 21.5h | Critical — matches Arize/LangSmith | Phase 8.1B |
| **Automated eval pipeline** — Scheduled runs, CI/CD gates, leaderboard | 9h | High — GCC-unique: eval → workflow automation | Phase 8.1C |
- **No mock data**: Everything runs against real Grail span data
- **SLO thresholds are user-configurable**: Latency threshold (ms) and error budget (%) stored in localStorage
- **Reuses existing hooks**: Deployment Tracker tab uses `useInfrastructure` for model history data

### Future Enhancements (Planned)
- [ ] Evaluation Dataset Management (capture golden prompt/response pairs)
- [ ] Prompt Template Library with versioning
- [ ] A/B testing with statistical significance
- [ ] Compliance reporting (EU AI Act evidence packages)
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
| 8.1 | LLM Evaluation Engine | ~39h (3 phases) | 🟢 HIGH | `/evaluations`, `useEvaluation.ts` |
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
| LLM-as-judge (true) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Davis CoPilot) |
| **Infra+LLM Correlation** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | **✅ (Unique!)** |
| **Davis AI Causation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ (Unique!)** |
| **Workflow Automation** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ (Unique!)** |

---

## 🔄 Changelog

### v3.1.0 (Mar 16, 2026)
- **Evaluation Engine Blueprint**: Full 3-phase implementation plan for LLM-as-judge using Davis CoPilot
  - Phase A: Span-based evaluation (~8.5h) — score production traffic with Davis CoPilot
  - Phase B: Golden dataset evaluation (~21.5h) — Document Service for datasets/rubrics, Bizevents for results
  - Phase C: Automated pipeline (~9h) — scheduled workflows, CI/CD gates, leaderboard
- **LLM-as-judge UNBLOCKED**: Davis CoPilot serves as evaluation judge (no Phase 0 dependency)
- **Data schemas defined**: `EvaluationDataset`, `EvaluationRubric`, `EvalResult` (bizevent) schemas
- **Architecture diagram** added to Phase 8.1 (UI → Hook → Storage 3-layer design)
- **MLOps enhancements planned**: SLO burn rate alerts, report export, cost forecasting, evaluation tab
- **Competitive matrix updated**: GCC LLM-as-judge status changed from ❌ to ✅
- **Existing building blocks mapped**: 7 reusable components identified (Davis batch scoring, Document Service, Bizevents, quality visualizations, workflows, agent tools)
- **New competitors identified** for tracking: MLflow, WhyLabs, Galileo, Fiddler AI, TruEra/TruLens, Neptune.ai

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
