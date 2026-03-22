---
layout: default
title: GenAI Control Center
description: Unified GenAI Observability for the Enterprise
---

# GenAI Control Center (GCC)

**The enterprise platform for unified GenAI observability, governance, and optimization.**

Built on Dynatrace AppEngine with real-time Grail telemetry, Davis AI intelligence, and one-click remediation workflows.

---

## Why GCC?

| Metric | Impact |
|--------|--------|
| **50% faster MTTR** | AI-powered root cause analysis with Davis CoPilot |
| **30% cost savings** | FinOps visibility with provider-level cost attribution |
| **Zero manual discovery** | Auto-discovery of all AI services via OpenTelemetry gen_ai.* spans |
| **Proactive governance** | PII detection, injection risk analysis, prompt audit trails |

---

## Architecture: Observe → Analyze → Govern → Act

GCC follows the Dynatrace platform philosophy of four pillars:

### Observe
Auto-discover and monitor every AI service, model, agent, and RAG pipeline in your environment.

- [Home Dashboard](pages/home.md) — Executive KPIs and trend overview
- [AI Services](pages/services.md) — Auto-discovery of all gen_ai.* instrumented services
- [AI Topology](pages/topology.md) — Visual service → provider → model relationship map
- [Agent Tools](pages/agents.md) — AI agent workflow monitoring with tool reliability
- [RAG & Vector DB](pages/rag.md) — Pinecone, embeddings, semantic cache, retrieval health
- [MLOps](pages/mlops.md) — Model registry, SLOs, cost attribution, model comparison
- [AI Quality](pages/quality.md) — Hallucination scoring, quality dimensions
- [Conversations](pages/conversations.md) — Session-level AI observability
- [Developer Experience](pages/devex.md) — Instrumentation coverage, shadow AI detection
- [Infrastructure](pages/infrastructure.md) — Provider availability, service config snapshots

### Analyze
Deep-dive into model performance, drift detection, and AI-powered investigation.

- [Response Analytics](pages/analytics.md) — Token efficiency, streaming vs batch, model comparison
- [Model Drift](pages/drift.md) — Baseline comparison with real trend data across 6 metrics
- [Intelligence](pages/intelligence.md) — 33+ AI-powered tools with Davis CoPilot natural language

### Govern
Enforce compliance, manage costs, and audit every prompt interaction.

- [FinOps](pages/finops.md) — AI cost management, forecasting, chargeback by team
- [Prompt Governance](pages/prompt-governance.md) — PII detection, injection risks, audit trail
- [Policies & Compliance](pages/governance.md) — Data residency, rate limiting, provider policies

### Act
Automate remediation, manage incidents, and orchestrate failovers.

- [Operations](pages/operations.md) — Runbooks, workflow automation, one-click remediation
- [Security Audit](pages/security.md) — Prompt security, incident response workflows
- [Provider Failover](pages/provider-status.md) — Health index, failover readiness scoring
- [Integrations Hub](pages/integrations.md) — Slack, PagerDuty, GitHub, Prometheus, AWS, Grafana

---

## Personas & Workflows

| Persona | Key Pages | Primary Workflow |
|---------|-----------|-----------------|
| **SRE** | Services, Operations, Infrastructure | Monitor → Alert → Remediate |
| **Platform Engineer** | Topology, Agents, Provider Failover | Discover → Optimize → Scale |
| **FinOps Analyst** | FinOps, Analytics, MLOps | Track → Forecast → Chargeback |
| **ML Engineer** | Analytics, Drift, Quality, RAG | Evaluate → Compare → Tune |
| **Security Officer** | Prompt Governance, Security, Governance | Audit → Detect → Respond |

---

## Technology Stack

- **Frontend**: React 18 + TypeScript + Strato Design System
- **Data**: DQL (Dynatrace Query Language) against Grail
- **AI**: Davis CoPilot (NL2DQL, DQL2NL, Conversations)
- **Automation**: Dynatrace Workflows
- **Telemetry**: OpenTelemetry gen_ai.* semantic conventions

---

## Getting Started

1. **Prerequisites**: Dynatrace environment with AppEngine enabled
2. **Install**: `npm install`
3. **Configure**: Set `environmentUrl` in `app.config.json`
4. **Run**: `npm start`
5. **Deploy**: `npm run deploy`

See the [Setup Guide](getting-started.md) for detailed instructions.
