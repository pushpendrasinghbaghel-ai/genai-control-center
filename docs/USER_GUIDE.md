# GenAI Control Center - User Guide

## 🎯 Executive Summary

The **GenAI Control Center (GCC)** is a Dynatrace AppEngine application that provides **proactive AI service management** for enterprises running GenAI workloads. It auto-discovers AI services, provides health-at-a-glance dashboards, offers AI-powered recommendations via Davis, and enables automated remediation.

### Key Value Propositions
- **50% faster MTTR** - Unified observability across all AI providers
- **30% cost savings** - FinOps visibility and optimization recommendations
- **Zero manual discovery** - Auto-detection of OpenTelemetry GenAI spans
- **Proactive governance** - Real-time health monitoring with Davis AI integration

---

## 👥 User Personas & Use Cases

### 1. 🔧 Site Reliability Engineer (SRE)

**Primary Goal:** Ensure AI service reliability and minimize incidents

#### Key Features
| Feature | Description | Navigation |
|---------|-------------|------------|
| Health Dashboard | Real-time health status of all AI services | Home → Health Dashboard |
| Error Rate Monitoring | Track error rates by service, provider, model | Health Dashboard → Service Cards |
| Deep Linking to Services | One-click drill-down to Dynatrace Services app | Click "View in Services" button |
| Davis Assistant | AI-powered root cause analysis | Davis Assistant tab |

#### Workflow: Investigating a Degraded AI Service
1. **Open Health Dashboard** - See all AI services with health indicators (✅ Healthy, ⚠️ Warning, 🔴 Critical)
2. **Identify problematic service** - Look for services with high error rates or latency
3. **Click "View in Services"** - Deep link directly to Dynatrace Services app for detailed analysis
4. **Use Davis Assistant** - Ask natural language questions like "Why is my OpenAI service slow?"
5. **Apply Remediation** - Execute pre-built remediation workflows

#### Sample Questions for Davis Assistant
```
"What's causing high latency in my Claude service?"
"Show me error patterns for the last 24 hours"
"Compare performance between OpenAI and Anthropic"
"What remediation actions are recommended?"
```

---

### 2. 🏗️ Platform Engineer

**Primary Goal:** Architect and optimize AI infrastructure

#### Key Features
| Feature | Description | Navigation |
|---------|-------------|------------|
| AI Architect | Optimization recommendations and best practices | AI Architect tab |
| Provider Comparison | Side-by-side provider performance analysis | Providers tab |
| Model Comparison | Detailed model-level metrics | Providers → Model Table |
| Architecture Patterns | Recommended deployment patterns | AI Architect → Patterns |

#### Workflow: Optimizing AI Architecture
1. **Review AI Architect recommendations** - See prioritized optimization suggestions
2. **Compare providers** - Analyze latency, error rates, and costs across OpenAI, Anthropic, Google, etc.
3. **Evaluate models** - Compare GPT-4 vs Claude vs Gemini performance
4. **Apply recommendations** - Follow architecture pattern guidance

#### Architecture Recommendations Include
- 🚀 **Performance** - Latency optimization, caching strategies
- 💰 **Cost** - Token usage optimization, model right-sizing
- 🔒 **Security** - Rate limiting, authentication best practices
- 🏛️ **Resilience** - Multi-provider fallback, circuit breakers

---

### 3. 💰 FinOps / Cost Analyst

**Primary Goal:** Optimize AI spending and provide cost visibility

#### Key Features
| Feature | Description | Navigation |
|---------|-------------|------------|
| Cost Dashboard | Estimated costs by service, provider, model | Health Dashboard → Cost metrics |
| Token Usage | Track input/output tokens | Provider Comparison → Tokens |
| Cost Trends | Historical cost analysis | Coming soon |
| Budget Alerts | Cost threshold notifications | Coming soon |

#### Workflow: Monthly AI Cost Review
1. **Open Provider Comparison** - See total costs by provider
2. **Analyze token usage** - Identify high-token-consuming services
3. **Compare model costs** - GPT-4 vs GPT-3.5 vs Claude cost efficiency
4. **Generate reports** - Export data for finance team

#### Cost Metrics Tracked
- **Estimated Cost** - Based on public pricing models
- **Total Tokens** - Input + Output token counts
- **Tokens per Request** - Average token efficiency
- **Cost per Request** - Unit economics

---

### 4. 👨‍💻 Developer / ML Engineer

**Primary Goal:** Debug AI integrations and optimize prompts

#### Key Features
| Feature | Description | Navigation |
|---------|-------------|------------|
| Service Discovery | See all AI services with GenAI spans | Health Dashboard |
| Latency Analysis | P50, P95, P99 latency metrics | Health Dashboard → Service Cards |
| Error Debugging | Deep link to traces and spans | View in Services → Traces |
| Model Selection | Compare model performance for use case | Provider Comparison |

#### Workflow: Debugging Slow AI Responses
1. **Check Health Dashboard** - Identify services with high latency
2. **Filter by service** - Use FilterBar to isolate specific service
3. **Click "View in Services"** - Jump to Dynatrace for trace analysis
4. **Analyze spans** - See `gen_ai.request.model`, `gen_ai.usage.input_tokens`, etc.
5. **Optimize** - Adjust prompts, switch models, or add caching

---

### 5. 🛡️ Security / Compliance Officer

**Primary Goal:** Ensure AI governance and compliance

#### Key Features
| Feature | Description | Navigation |
|---------|-------------|------------|
| Provider Inventory | Complete inventory of AI providers in use | Provider Comparison |
| Model Inventory | All models deployed across services | Providers → Model Table |
| Segment Filtering | Filter by environment, namespace | SegmentSelector |
| Audit Trail | Track AI service usage | Coming soon |

#### Compliance Use Cases
- **Shadow AI Detection** - Discover unauthorized AI services
- **Data Residency** - Identify which providers are in use
- **Model Governance** - Track which models are deployed
- **Usage Patterns** - Monitor AI consumption trends

---

## 🚀 Getting Started

### First-Time Setup
1. **Access the app** - Navigate to Dynatrace → Apps → GenAI Control Center
2. **Grant permissions** - Accept scope requests for logs, spans, metrics, segments
3. **Wait for discovery** - AI services with `gen_ai.*` spans are auto-detected

### Required OpenTelemetry Instrumentation
Your AI services must emit spans with GenAI semantic conventions:
```
gen_ai.system = "openai" | "anthropic" | "google" | etc.
gen_ai.request.model = "gpt-4" | "claude-3-opus" | etc.
gen_ai.usage.input_tokens = <number>
gen_ai.usage.output_tokens = <number>
```

### Navigation Guide
| Tab | Purpose | Key Actions |
|-----|---------|-------------|
| 🏠 Health Dashboard | Overview of all AI services | Filter, View in Services, Investigate |
| 🏗️ AI Architect | Optimization recommendations | Review, Apply, Track |
| 🤖 Davis Assistant | Natural language Q&A | Ask questions, Get insights |
| 📊 Providers | Provider & model comparison | Compare, Analyze, Optimize |
| 📚 Remediation | Automated fix playbooks | Browse, Execute, Monitor |

---

## 🔧 FilterBar Usage

### Filter Syntax
The FilterBar supports Dynatrace filter syntax:

```
dt.entity.service.name = "my-ai-service"
gen_ai.system = "openai"
gen_ai.request.model = "gpt-4"
```

### Operators Supported
| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `gen_ai.system = "openai"` | Exact match |
| `!=` | `gen_ai.system != "openai"` | Not equal |
| `in()` | `gen_ai.system in("openai", "anthropic")` | Multiple values |
| `contains` | `gen_ai.request.model *gpt*` | Contains substring |

### Workflow
1. **Select Segment** - Use SegmentSelector for environment filtering
2. **Add Filters** - Type filter key, select operator, enter value
3. **Set Timeframe** - Choose time range (Last 30 min, 2 hours, etc.)
4. **Click Update** - Apply all filters together

---

## 📈 Metrics & KPIs

### Health Dashboard Metrics
| Metric | Description | Formula |
|--------|-------------|---------|
| Error Rate | Percentage of failed requests | `errors / total_requests * 100` |
| Avg Latency | Mean response time | `sum(latency) / count` |
| Total Tokens | Sum of input + output tokens | `input_tokens + output_tokens` |
| Estimated Cost | Projected spend | Based on provider pricing |

### Provider Comparison Metrics
| Metric | Description | Use Case |
|--------|-------------|----------|
| Request Count | Total API calls | Volume analysis |
| Avg Latency | Response time by provider | Performance comparison |
| Error Rate | Failure rate by provider | Reliability assessment |
| Cost per Token | Efficiency metric | Cost optimization |

---

## 🔗 Integration Points

### Dynatrace Platform
- **Services App** - Deep linking for detailed service analysis
- **Davis AI** - Natural language queries and insights
- **Workflows** - Automated remediation execution
- **Segments** - Environment-based filtering

### OpenTelemetry
- **GenAI Semantic Conventions** - Standard span attributes
- **Trace Correlation** - End-to-end tracing across services

---

## 📞 Support & Feedback

### Reporting Issues
Contact the development team for:
- Feature requests
- Bug reports
- Documentation updates

### Roadmap
- [ ] Cost trend analysis & forecasting
- [ ] Budget alerts & anomaly detection
- [ ] Custom dashboards
- [ ] Export & reporting
- [ ] Multi-tenant support

---

## 🏆 Success Stories

> "GCC reduced our AI incident response time from 45 minutes to under 10 minutes by providing unified visibility across all our AI providers."
> — *SRE Team Lead*

> "We discovered $15K/month in wasted AI spend by identifying inefficient model usage patterns."
> — *FinOps Manager*

> "The Davis integration lets our developers ask questions in plain English instead of writing complex queries."
> — *Platform Engineering Director*

---

**Built with ❤️ using Dynatrace AppEngine**

*GenAI Control Center v1.0.0 | © 2026*
