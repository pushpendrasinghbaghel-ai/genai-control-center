# 🎯 GenAI Control Center - 5-Minute High-Impact Demo Script

## Executive Summary (30 seconds)
**"Organizations adopting GenAI face a critical blind spot: traditional APM doesn't understand AI workloads. The GenAI Control Center solves this by turning Dynatrace into the enterprise command center for AI observability."**

---

## 🎬 Demo Flow (5 Minutes Total)

### 🔥 HOOK: The Problem (30 seconds)

**Say:**
> "Every enterprise I talk to has the same problem: They're deploying GenAI across OpenAI, Anthropic, Azure, AWS Bedrock, Google Gemini... and they have ZERO visibility into what's actually happening."
>
> "How much are you spending? Which models are slow? Is there PII leaking into prompts? Are you hitting rate limits? Nobody knows."
>
> "GenAI Control Center gives you answers in seconds."

---

### 📊 DEMO STOP 1: Home Dashboard - The Single Pane of Glass (45 seconds)

**Navigate to:** `/` (Home)

**Show:**
- Overall health score across all AI services
- Key metrics: Total Requests, Token Usage, Error Rate, Latency
- Trend chart showing AI adoption over time
- Pillar navigation cards (FinOps, Governance, Intelligence, Operations)

**Say:**
> "This is your GenAI command center. One glance tells you everything: 
> - How many AI services are running
> - Total cost exposure
> - Whether anything is degraded
> - And clear pathways to drill down."

**Click:** "Health Dashboard" card

---

### 💚 DEMO STOP 2: Auto-Discovery & Health (45 seconds)

**Navigate to:** `/health`

**Show:**
- List of auto-discovered AI services (no manual config!)
- Service cards with health indicators (✅ Healthy, ⚠️ Warning, 🔴 Critical)
- Provider breakdown (OpenAI, Anthropic, Google, etc.)
- Deep-link to Dynatrace Services app

**Say:**
> "The magic? ZERO CONFIGURATION. If your services emit OpenTelemetry GenAI spans, they appear here automatically."
>
> "For each service, you see real-time health: error rates, latency percentiles, token consumption. Click 'View in Services' to dive into distributed traces in Dynatrace."

**Key Value:** Auto-discovery eliminates shadow AI - you see EVERY AI service in your environment.

---

### 💰 DEMO STOP 3: FinOps - Cost Visibility (60 seconds)

**Navigate to:** `/finops`

**Show:**
- Total estimated AI spend
- Cost breakdown by provider
- Budget tracking with breach ETA
- Cost forecasting (7/14/30 days)
- Cost-per-token comparison across providers

**Say:**
> "This is why FinOps teams LOVE this app. For the first time, you can see:
> - Exactly how much you're spending on AI
> - Which provider is the most cost-effective
> - When you'll breach your budget
> - 30-day cost projections with confidence levels"

**Highlight:**
- "See how GPT-4 is 10x more expensive than GPT-3.5? This data drives real optimization decisions."
- "Budget breach ETA tells you WHEN you'll exceed your limits - not IF."

---

### 🛡️ DEMO STOP 4: Prompt Governance - Security & Compliance (60 seconds)

**Navigate to:** `/prompt-governance`

**Show:**
- Summary cards: PII Detection, Injection Risks, Expensive Prompts, Cache Candidates
- Prompt analysis table with flags (🔐 PII, ⚠️ Injection, 💰 Expensive, 🔄 Repetitive)
- Davis AI scoring for advanced semantic analysis
- Click on a flagged prompt to show detail modal

**Say:**
> "This is the governance game-changer. We analyze EVERY prompt for:
> - **PII leakage** - SSN, emails, credit cards being sent to AI providers
> - **Prompt injection** - Malicious patterns that could compromise your models
> - **Expensive prompts** - Requests costing more than $0.10
> - **Cache candidates** - Repeated prompts that should use semantic caching"

**Click:** A flagged prompt → Show the detail modal with Davis AI analysis

**Say:**
> "And here's where it gets powerful: Davis AI performs semantic analysis - not just pattern matching - to detect nuanced risks that rules would miss."

---

### 🧠 DEMO STOP 5: Davis Intelligence - Natural Language Queries (60 seconds)

**Navigate to:** `/intelligence`

**Show:**
- Quick Investigation buttons (Health Check, Cost Analysis, Latency Investigation)
- Custom query input
- Davis AI conversation

**Demo Action:** Click "Health Check" or type a natural language query:
> "Why is my OpenAI service slow today?"

**Say:**
> "Davis CoPilot brings AI-powered investigation to your AI workloads. Ask questions in plain English:
> - 'What's causing high latency in Claude?'
> - 'Compare costs between OpenAI and Anthropic'
> - 'Show me error patterns for the last 24 hours'"

**Show:** Davis response with DQL generation and analysis

**Say:**
> "Davis understands GenAI semantic conventions. It generates the right queries, analyzes the data, and gives you actionable insights."

---

### 🗺️ DEMO STOP 6: AI Topology - Visual Flow (30 seconds)

**Navigate to:** `/topology`

**Show:**
- Smartscape-style visualization
- Service → Provider → Model relationships
- Health indicators on each node
- Click on a service to show metrics

**Say:**
> "This is your AI architecture at a glance. See exactly which services call which providers and models, with real-time health overlaid. Click any node to drill down."

---

## 🚀 Closing: The Vision (30 seconds)

**Say:**
> "This is just the beginning. Dynatrace as the AI observability data platform enables:
>
> - **Automated remediation** - Workflows that respond to rate limits, cost spikes, latency issues
> - **Predictive alerts** - Davis AI forecasting problems before they impact users
> - **Full-stack correlation** - Connect AI performance to business outcomes
> - **Multi-cloud governance** - Unified view across AWS, Azure, GCP AI services"

**Final Statement:**
> "GenAI Control Center transforms Dynatrace from an APM tool into the enterprise AI command center. You get visibility, governance, and intelligence - in one platform you already trust."

---

## 📋 Key Talking Points

### Why This App?
| Challenge | GCC Solution |
|-----------|--------------|
| Shadow AI - Unknown services | Auto-discovery via OpenTelemetry |
| Cost overruns | FinOps dashboard with forecasting |
| Compliance risk | Prompt governance with PII/injection detection |
| Slow MTTR | Davis AI investigation + remediation workflows |
| Multi-provider complexity | Unified view across all AI providers |

### Value Metrics to Mention
- **50% faster MTTR** - Unified observability eliminates tool hopping
- **30% cost savings** - Optimization recommendations and right-sizing
- **Zero manual discovery** - OpenTelemetry auto-detection
- **100% compliance visibility** - Every prompt analyzed for risks

### Dynatrace Platform Advantage
> "The secret weapon is Grail. All this data - spans, logs, metrics - lives in one queryable platform. That's why Davis AI can correlate GenAI performance with infrastructure, security, and business impact."

---

## 🎨 Demo Tips

### Before the Demo
1. Ensure you have live data flowing (or enable sample data mode)
2. Test all navigation works
3. Have a "problem" service to investigate

### During the Demo
- **Start with pain** - Everyone relates to GenAI chaos
- **Show, don't tell** - Click through quickly, let the UI speak
- **End with vision** - Leave them excited about what's possible

### Handling Questions
- "Does this require instrumentation?" → OpenTelemetry GenAI semantic conventions
- "What providers are supported?" → All major ones: OpenAI, Anthropic, Azure, AWS, Google, Meta, Mistral, Cohere
- "Is this real-time?" → Yes, all data is live from Grail

---

## 🔮 Future Roadmap Teaser

Mention these upcoming capabilities to drive interest:

1. **Semantic Caching Integration** - Auto-configure caches based on repetitive prompt detection
2. **Model A/B Testing** - Compare model versions with statistical significance
3. **Carbon Footprint Tracking** - Environmental impact of AI workloads
4. **Prompt Engineering Insights** - ML recommendations for prompt optimization
5. **SLO Integration** - GenAI-specific service level objectives

---

## 📝 Appendix: Persona-Specific Angles

### For FinOps Teams
Focus on: Cost breakdown, forecasting, budget alerts, showback reports

### For Security/Compliance
Focus on: Prompt governance, PII detection, audit trails, provider risk scoring

### For SREs
Focus on: Health dashboard, error analysis, remediation workflows, deep linking

### For Executives
Focus on: Home dashboard, overall health score, cost trends, risk summary

---

*Demo created for GenAI Control Center v2.3*
