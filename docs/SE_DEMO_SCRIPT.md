# GenAI Control Center - SE Demo Script (5-7 minutes)

## 🎯 Demo Objective
Demonstrate how GCC provides **enterprise AI observability** that no other tool offers - combining health monitoring, cost management, security governance, analytics, and intelligent automation in one platform.

---

## ⏱️ Demo Flow (7 minutes)

### 🎬 OPENING (30 seconds)
> "Organizations are rapidly adopting GenAI, but they're flying blind. They don't know what AI services they have, what they cost, or if they're secure. Today I'll show you GenAI Control Center - the first enterprise-grade AI observability platform built on Dynatrace."

**Navigate to: Home Page**

---

### 1️⃣ HOME - Executive Dashboard (30 seconds)

**Key talking points:**
- "This is the executive view - instant visibility into your entire AI estate"
- "We auto-discover ALL AI services instrumented with OpenTelemetry GenAI conventions"
- Point to the **key metrics**: Total LLM calls, providers, models, agents
- "One click takes me to any area - Health, FinOps, Governance, Analytics, or Agent monitoring"

**Transition:** "Let me show you how we monitor AI agents in detail..."

---

### 2️⃣ AGENT TOOLS - The Star of the Show (1.5 minutes)

**Navigate to: Agent Tools page**

#### Active Agents Table (30 sec)
> "Here's every AI agent in your organization with complete visibility:"
- Point to **token usage columns**: "Input tokens, output tokens, total - we track every token"
- Point to **LLM Cost**: "Estimated cost per agent - crucial for chargeback"
- Point to **LLM/Tool Split**: "This visual shows time spent on LLM inference vs tool execution - tells you where optimization opportunities are"

#### Tool Reliability (30 sec)
> "This is unique to GCC - per-agent tool reliability metrics"
- Point to **Calls/Trace**: "If this is greater than 1, tools are being retried - reliability issue"
- Point to **P95 Duration**: "Performance metrics per tool"
- Point to **Error Rate with checkmarks**: "Green checkmarks mean healthy tools"

#### Tool Topology & Handoffs (30 sec)
> "This visualization shows which tools work together"
- Hover over connections: "Thicker lines mean tools frequently appear together"
- Point to **Agent Handoffs**: "In multi-agent systems, we track communication patterns"
- Point to **self-transfers**: "These indicate agents restarting their flow"

**Transition:** "Now let's see the analytics for ML teams..."

---

### 3️⃣ RESPONSE ANALYTICS - ML Engineer Insights (1 minute)

**Navigate to: Response Analytics page**

> "For ML Engineers, this is where they optimize models."

- Point to **Token Efficiency Metrics**: "Output-to-input ratio per service - shows prompt efficiency"
- Point to **Model Rankings**: "Composite scores based on efficiency, latency, and cost"
- Point to **Output Consistency**: "Variance analysis - detect models with unpredictable outputs"
- Point to **Inefficient Services**: "Services with low output ratios need prompt optimization"

> "This helps ML teams identify which models perform best and where to focus optimization."

**Transition:** "Now the cost impact..."

---

### 4️⃣ FINOPS - Cost Management (45 seconds)

**Navigate to: FinOps page**

> "For FinOps teams, this is gold."

- Point to **Total Spend**: "Real-time AI spend tracking"
- Point to **Cost Forecast**: "We predict your spend for 7, 14, 30 days with confidence levels"
- Point to **Budget Breach ETA**: "Know exactly when you'll exceed budget"
- Point to **Provider Comparison**: "Compare cost-per-token across providers"
- Point to **Token Efficiency**: "Identify wasteful prompts - high input, low output"

> "This enables showback and chargeback by service or team."

**Transition:** "But cost isn't everything - security matters too..."

---

### 5️⃣ GOVERNANCE - Security & Compliance (1 minute)

**Navigate to: Prompt Governance page**

> "This is where security and compliance teams live."

- Point to **PII Detection**: "We detect SSNs, emails, credit cards in prompts"
- Point to **Prompt Injection**: "Malicious patterns are flagged automatically"
- Point to **Davis AI Scoring**: "Our AI analyzes prompts for nuanced risks"
- Point to **Cache Candidates**: "Prompts used 15+ times - candidates for semantic caching"

**Navigate to: Governance page**

- Point to **Enterprise Challenges**: "Data sovereignty, shadow AI, model drift - all tracked"
- Point to **Provider Risk Scores**: "Compliance certifications and data residency info"

**Transition:** "And when you need to dig deeper..."

---

### 6️⃣ INTELLIGENCE - Davis CoPilot (45 seconds)

**Navigate to: Intelligence page**

> "You can ask questions in natural language"

**Type or show example query:**
> "Show me all failed LLM calls in the last hour"

- "Davis CoPilot generates DQL queries automatically"
- "Non-technical users can analyze AI operations without learning query syntax"

---

### 🎬 CLOSING (30 seconds)

> "GenAI Control Center gives you:
> 1. **Complete visibility** - auto-discovered AI services and agents
> 2. **ML Analytics** - token efficiency and model rankings
> 3. **Cost control** - real-time spend and forecasting
> 4. **Security** - PII detection and prompt analysis
> 5. **Intelligence** - Davis AI for insights
> 
> All built natively on Dynatrace, using the data you already have.
> 
> Questions?"

---

## 💡 Pro Tips for the Demo

### DO:
- ✅ Start with **business value** - "flying blind" is the pain point
- ✅ Use the **Agent Tools page** as your centerpiece - it's the most unique
- ✅ Show **Response Analytics** to appeal to ML Engineers
- ✅ Point out the **Dynatrace integration** - "uses your existing spans"
- ✅ Emphasize **auto-discovery** - no manual configuration
- ✅ Show the **visual elements** - topology, progress bars, health indicators

### DON'T:
- ❌ Don't dive into code or technical details
- ❌ Don't spend too long on any single feature
- ❌ Don't apologize for "demo environment data"
- ❌ Don't show loading states - have pages pre-loaded

### Handle Questions:
| Question | Answer |
|----------|--------|
| "How does it get data?" | "OpenTelemetry GenAI semantic conventions - industry standard" |
| "What providers?" | "OpenAI, Anthropic, Azure, Google, AWS Bedrock, Mistral, Cohere" |
| "Is it production ready?" | "Built on Dynatrace AppEngine - enterprise-grade infrastructure" |
| "Pricing?" | "Included with Dynatrace - uses existing spans and DPS" |
| "Who uses analytics?" | "ML Engineers for model optimization and prompt engineering" |

---

## 🎯 Key Differentiators to Emphasize

1. **Only solution** that combines Health + Analytics + Cost + Security + Agents in one platform
2. **Auto-discovery** - no manual instrumentation needed
3. **ML Engineer focus** - token efficiency, model rankings, output consistency
4. **Davis AI integration** - intelligent insights, not just dashboards
5. **Built on Dynatrace** - enterprise-grade, uses existing investment
6. **Multi-agent support** - handoffs, topology, loop detection

---

## 👥 Persona Coverage

| Persona | Pages to Show | Key Value |
|---------|---------------|-----------|
| **Executive** | Home | Single pane of glass |
| **ML Engineer** | Response Analytics, Agent Tools | Token efficiency, model rankings |
| **FinOps** | FinOps | Cost tracking, forecasting |
| **Security** | Governance, Prompt Governance | PII detection, compliance |
| **SRE** | Health, Agent Tools | Monitoring, loop detection |
| **Platform Eng** | Topology, Agent Tools | Architecture visibility |

---

## 🔥 Power Phrases

- "Flying blind with AI"
- "Token-level visibility"
- "Complete AI observability"
- "From chaos to control"
- "Enterprise-grade AI governance"
- "Built on the data you already have"
- "Optimize prompts, not just monitor them"

---

**Good luck! You've got this! 🚀**
