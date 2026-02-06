# 🎯 GenAI Control Center - 4-Minute Power Demo

## Target Audience: SE, Tech Leads, Platform Engineers
**Focus:** Model Drift Detection, Response Analytics, FinOps Cost Management, Agent Tools

---

## 🎬 Demo Flow (4 Minutes Total)

### 🔥 HOOK: The Challenge (20 seconds)

**Say:**
> "Your organization is running GenAI across multiple providers - OpenAI, Anthropic, Azure, Google, AWS Bedrock. But you're flying blind:
> - Is model behavior changing over time?  
> - Are responses degrading in quality?
> - How much are you actually spending?
> - Which agents are efficient vs wasteful?
>
> GenAI Control Center answers all of this in one unified view."

---

### 📈 DEMO STOP 1: Model Drift Detection (60 seconds)

**Navigate to:** `/drift`

**Show:**
1. **Summary Cards** - Quick view of model health:
   - Total Models Monitored
   - Critical/Warning/Normal counts
   - Active version changes

2. **Drift Score Table** - For each model:
   - Drift Score (0-100) with color coding
   - Severity badges (Normal/Warning/Critical)
   - Provider, Operation Type, Baseline Period

3. **Click a model row** → Opens Detail Modal showing:
   - Drift Score Gauge
   - Metric breakdown (Latency Δ%, Quality Δ%, Efficiency)
   - **🤖 Agents Impacted by Drift** - Shows which AI agents are affected
   - Trend chart over 24h
   - Anomaly timeline

**Say:**
> "Model Drift is the silent killer of AI applications. Providers push updates, models change behavior, and your app breaks.
>
> GCC calculates drift scores using 6 weighted metrics: latency, output tokens, error rate, P95 latency, input tokens, and token efficiency.
>
> Click any model to see which agents are impacted - this tells you exactly which parts of your system are affected when a model drifts."

**Key Demo Point:** Show the "Agents Impacted by Drift" section in the modal with impact severity.

---

### 📊 DEMO STOP 2: Response Analytics (60 seconds)

**Navigate to:** `/response-analytics`

**Show:**
1. **Top Summary Cards:**
   - Total Requests analyzed
   - Average Token Ratio (output/input efficiency)
   - Inefficient Services count
   - Inconsistent Services count

2. **Model Rankings Table** - Sort by Efficiency Score:
   - Models ranked by composite score (token ratio + latency + cost)
   - Compare GPT-4 vs Claude vs Gemini efficiency

3. **Service Analysis Tab:**
   - Per-service token efficiency breakdown
   - Flagged inefficient services (high input, low output)
   - Flagged inconsistent services (high output variance)

4. **Inefficient Prompts Tab:**
   - Services wasting tokens
   - Recommendations for optimization

**Say:**
> "This is your ML Engineer's command center. We answer the hard questions:
> - Which model gives you the best output for your token spend?
> - Which services have inefficient prompts?
> - Where are you seeing inconsistent responses?
>
> Look at this efficiency score ranking - you can immediately see which models deliver the best value."

**Key Demo Point:** Show the Model Rankings and highlight the efficiency score calculation.

---

### 💰 DEMO STOP 3: FinOps Cost Management (60 seconds)

**Navigate to:** `/finops`

**Show:**
1. **Hero Cards** - Real-time metrics:
   - Total AI Spend (estimated)
   - Daily Burn Rate
   - Budget Utilization %
   - Budget Breach ETA

2. **Cost by Provider Chart:**
   - Donut chart showing spend distribution
   - OpenAI vs Anthropic vs Google vs AWS

3. **Cost Trend Timeseries:**
   - Cost over time with provider breakdown
   - Identify cost spikes and anomalies

4. **Token Efficiency Section:**
   - High-input/low-output detection
   - Wasteful prompt identification
   - Optimization recommendations

5. **Cost Forecasting:**
   - 7/14/30 day projections
   - Confidence levels (high/medium/low)

**Say:**
> "FinOps teams finally have AI cost visibility:
> - Exact spend across all providers in real-time
> - Budget breach ETA tells you WHEN you'll exceed limits
> - Token efficiency analysis finds wasteful prompts
>
> See this service? High input tokens, low output - that's a $200/day optimization opportunity."

**Key Demo Point:** Highlight Budget Breach ETA and point out an inefficient service.

---

### 🤖 DEMO STOP 4: Agent Tools Monitoring (60 seconds)

**Navigate to:** `/agent-tools`

**Show:**
1. **Active Agents Summary Cards:**
   - Total Agents, Active Tools, Total Flows
   - Suspicious Loops detected (red alert if > 0)

2. **Active Agents Table:**
   - Agent name, tool calls, avg duration
   - Token usage (input/output/total)
   - **LLM Cost** - Estimated per-agent spend
   - **LLM/Tool Time Split** - Visual bar

3. **Agent Handoffs Section:**
   - Cross-agent communication patterns
   - Source → Target visualization
   - Self-loop detection (agents calling themselves)

4. **Tool Reliability Metrics:**
   - Per-agent tool usage with retry rates
   - Calls/Trace ratio (>1 indicates retries)
   - Error rates and health status

5. **Agent → LLM Provider Map:**
   - Which agents use which providers/models
   - Token usage and cost per agent-provider pair

**Say:**
> "For anyone running AI agents - LangChain, AutoGPT, custom orchestrations - this is essential:
> - See every agent and its tool usage patterns
> - Detect infinite loops before they drain your budget
> - Track handoffs between agents in multi-agent systems
> - Understand cost attribution per agent
>
> This Agent LLM Provider map shows exactly which models each agent consumes - critical for cost optimization."

**Key Demo Point:** Show the Agent → LLM Provider table and highlight estimated costs.

---

### 🎯 CLOSE: The Value Proposition (20 seconds)

**Say:**
> "GenAI Control Center transforms Dynatrace into your AI command center:
> - **Drift Detection** catches model behavior changes before they impact users
> - **Response Analytics** helps ML teams optimize for efficiency
> - **FinOps** delivers the cost visibility finance teams demand
> - **Agent Tools** monitors complex AI orchestrations
>
> All from OpenTelemetry data you're already collecting. No new instrumentation required."

---

## 📌 Quick Reference: Demo Paths

| Feature | Navigation | Time |
|---------|------------|------|
| Model Drift | `/drift` | 60s |
| Response Analytics | `/response-analytics` | 60s |
| FinOps | `/finops` | 60s |
| Agent Tools | `/agent-tools` | 60s |

---

## 💡 Pro Tips for Demo

1. **Pre-filter to 24h or 7d** - Ensures good data density
2. **Click into Detail Modals** - Shows depth of analysis
3. **Highlight UNIQUE GCC badges** - Features not in standard AI Observability
4. **Show cross-page correlation** - "This drifting model impacts these agents..."
5. **End on FinOps** - Cost visibility is often the executive hook

---

## 🎤 Objection Handlers

**"We already have AI Observability"**
> "Standard AI Observability shows you spans. GCC gives you drift detection, efficiency analysis, and agent monitoring that's unique to this app."

**"How hard is setup?"**
> "Zero configuration if you emit OpenTelemetry GenAI spans. Services auto-discover."

**"What providers are supported?"**
> "Any provider that follows OpenTelemetry GenAI semantic conventions: OpenAI, Anthropic, Azure OpenAI, Google Gemini, AWS Bedrock, Cohere, Mistral, and more."
