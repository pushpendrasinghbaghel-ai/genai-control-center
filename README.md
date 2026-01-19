# GenAI Control Center (GCC) v2.3

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

**GenAI Control Center** is a Dynatrace AppEngine application that provides **enterprise AI observability and governance** for organizations running GenAI workloads. It auto-discovers AI services instrumented with OpenTelemetry GenAI semantic conventions and provides comprehensive management across four key domains:

### 🏠 Application Structure

| Page | Purpose | Key Features |
|------|---------|--------------|
| 🏠 **Home** | Executive Dashboard | Overall health status, key metrics summary, pillar navigation |
| 💚 **Health** | Service Health Monitoring | Auto-discovered AI services, quality metrics, deep linking |
| 🔗 **Topology** | AI Service Visualization | Interactive Smartscape-style flow diagram, service→provider→model connections |
| 💰 **FinOps** | Cost Management & Optimization | Real-time spend tracking, cost forecasting, provider comparison |
| 🛡️ **Governance** | Compliance & Risk Management | Policy enforcement, provider risk scoring, governance challenges |
| 🔒 **Prompt Governance** | Prompt Security & Analysis | PII detection, injection risks, Davis AI scoring, cache candidates |
| 📊 **Response Analytics** | ML Engineer Insights | Token efficiency, model ranking, output consistency metrics |
| 🤖 **Intelligence** | AI-Powered Insights | Davis CoPilot integration, natural language queries, DQL generation |
| ⚙️ **Operations** | Automation & Remediation | Runbooks, analytics, quick actions for common issues |
| 🚨 **Real-Time Alerts** | Live Problem Monitoring | Davis-detected problems affecting AI services |

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
- **Real-time Spend Dashboard** - Track AI costs across all providers
- **Cost Forecasting** - 7/14/30-day projections with confidence levels
- **Budget Breach ETA** - Predict when you'll exceed budget
- **Provider Comparison** - Cost-per-token by provider and model
- **Service Cost Attribution** - Breakdown by business unit

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
- **Analytics** - Operational insights and trends
- **Quick Actions** - One-click remediation for:
  - 🔄 Restart overloaded services
  - 🧹 Clear stale caches
  - 📈 Scale up capacity
  - 🔔 Create alert for monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ (recommended) or 18+
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
npx dt-app dev --port 3001
```

### Required Scopes
The app requires these Dynatrace scopes:
- `storage:logs:read` - Read logs for AI service analysis
- `storage:spans:read` - Read GenAI spans for service discovery
- `storage:metrics:read` - Read metrics for dashboards
- `storage:entities:read` - Read entities for filtering
- `storage:filter-segments:read/write` - Segment filtering
- `automation:workflows:read/run` - Remediation workflows
- `davis:copilot:*` - Davis CoPilot AI integration

## 📊 Architecture

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    GenAI Control Center                      │
├─────────────┬─────────────┬──────────────┬─────────────────┤
│   FinOps    │ Governance  │ Intelligence │   Operations    │
│   💰        │    🛡️      │     🧠       │      🔧         │
├─────────────┴─────────────┴──────────────┴─────────────────┤
│                     Shared Components                        │
│  FilterBar │ MetricCard │ ServiceRow │ RecommendationCard  │
├─────────────────────────────────────────────────────────────┤
│                      Custom Hooks                            │
│  useAIServicesDiscovery │ useProviderComparison │ useDavisAI│
├─────────────────────────────────────────────────────────────┤
│                    Dynatrace SDKs                            │
│    @dynatrace-sdk/client-query │ client-davis-copilot       │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gcc/
├── app.config.json           # App configuration & scopes
├── ui/
│   └── app/
│       ├── components/       # Reusable UI components
│       │   ├── Card.tsx          # Generic card component
│       │   ├── FilterBar.tsx     # Time range & filters
│       │   ├── Header.tsx        # Navigation header
│       │   └── DavisResponse.tsx # AI response display
│       ├── pages/            # Main application pages
│       │   ├── Home.tsx          # Executive dashboard
│       │   ├── HealthDashboard.tsx # Service health
│       │   ├── AITopology.tsx    # Interactive flow visualization
│       │   ├── FinOps.tsx        # Cost management
│       │   ├── Governance.tsx    # Compliance & risk
│       │   ├── PromptGovernance.tsx # PII/injection detection, Davis AI scoring
│       │   ├── ResponseAnalytics.tsx # Token efficiency for ML Engineers
│       │   ├── Intelligence.tsx  # Davis CoPilot AI
│       │   ├── Operations.tsx    # Runbooks & quick actions
│       │   ├── RealTimeAlerts.tsx # Live problem monitoring
│       │   ├── Data.tsx          # GenAI data explorer
│       │   ├── ProviderComparison.tsx # Provider analysis
│       │   └── AIArchitect.tsx   # Architecture insights
│       ├── hooks/            # Data fetching hooks
│       │   ├── useDQLQueries.ts
│       │   ├── useDavisAI.ts
│       │   ├── useAIArchitect.ts
│       │   ├── useResponseAnalytics.ts # Token efficiency metrics
│       │   └── useRemediation.ts
│       ├── queries/          # DQL query definitions
│       ├── utils/            # Helper functions
│       └── types/            # TypeScript type definitions
└── docs/
    └── USER_GUIDE.md
```

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npx dt-app dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript for production |
| `npx dt-app build` | Build Dynatrace app package |
| `npx dt-app deploy` | Deploy to Dynatrace environment |
| `npx dt-app uninstall` | Remove app from environment |

## 📈 Metrics Tracked

| Metric | Source | Description |
|--------|--------|-------------|
| `gen_ai.system` | Span attribute | AI provider (openai, anthropic, etc.) |
| `gen_ai.request.model` | Span attribute | Model name (gpt-4, claude-3, etc.) |
| `gen_ai.usage.input_tokens` | Span attribute | Input token count |
| `gen_ai.usage.output_tokens` | Span attribute | Output token count |
| `gen_ai.usage.cost` | Calculated | Cost based on token pricing |
| `service.name` | Span attribute | Service identifier |
| Latency | Span duration | Response time |
| Error Rate | Span status | Failure percentage |

## 🔗 Integrations

- **Davis CoPilot** - Natural language to DQL, conversational AI
- **Dynatrace Grail** - DQL queries for AI telemetry
- **Dynatrace Services App** - Deep linking for detailed analysis
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

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/)
- Uses [Dynatrace Strato Components](https://developer.dynatrace.com/develop/ui/)
- Powered by [Davis CoPilot SDK](https://developer.dynatrace.com/)

---

**Built with ❤️ by Pushpendra Singh Baghel and AI Assistant**

*Version 2.3.0 | © 2026*

---

## 📋 Changelog

### v2.3.0 (January 2026)
- 🆕 **Prompt Governance Page**: Dedicated page for prompt security analysis
  - PII detection (SSN, email, phone, credit cards)
  - Injection risk detection
  - Davis AI scoring with semantic analysis
  - Cache candidate identification (repetitive prompts)
  - Detailed prompt modal with trace linking
- 🆕 **Response Analytics Page**: Token efficiency dashboard for ML Engineers
  - Token ratio analysis (output/input)
  - Model efficiency rankings with composite scores
  - Output consistency and variance metrics
  - Inefficient/inconsistent service detection
  - Cost estimation per model and provider
- 🆕 **TitleBar Component**: Consistent page headers across all pages
  - Page icon, title, and subtitle
  - Strato TitleBar component integration
  - Accessibility improvements (aria-labels, aria-hidden)
- ✨ **New App Icon**: 3D isometric Dynatrace-style logo with AI sparkle
- ✨ **Strato Design Tokens**: Using official color tokens for status indicators
- ✨ **Real-Time Alerts Page**: Live Davis problem monitoring for AI services
- 🛠️ **useResponseAnalytics Hook**: New hook for token efficiency metrics
- 🐛 **Accessibility**: Added aria-labels and aria-hidden throughout

### v2.2.0 (January 2026)
- 🆕 **AI Topology Page**: Interactive Smartscape-style visualization of GenAI service flows
  - Card-based nodes for Services (blue), Providers (purple), and Models (teal)
  - Connection-aware filtering - shows only related entities
  - Provider and model icons (OpenAI, Anthropic, Google, Meta, Mistral, etc.)
  - Hover tooltips with detailed metrics
  - Edge labels showing token/request counts
  - Deep-link to Dynatrace Services app
- ✨ **Compact UI**: Reduced card sizes, tighter spacing, responsive SVG layout
- ✨ **Model Icons**: Model nodes now show provider-inferred icons (GPT→OpenAI, Claude→Anthropic, etc.)
- 🐛 **Edge Fix**: Edges now show for connections with only request data (no tokens)
- 🐛 **Filter Fix**: Topology filtering now respects actual service→provider→model connections

### v2.1.0 (January 2026)
- 🆕 **Executive Dashboard**: New Home page with health overview and pillar navigation
- 🆕 **Health Dashboard**: Dedicated page for AI service health with quality metrics
- 🆕 **Quick Actions**: One-click remediation actions in Operations
- 🆕 **GenAI Data Explorer**: Preset DQL queries for GenAI-specific analysis
- ✨ **Quality Metrics**: Slow request rate (>5s), low output rate (<10 tokens), token efficiency
- ✨ **Disclaimers**: Clear labeling of estimated/reference data in FinOps & Governance
- 🗑️ **Removed Duplicates**: Consolidated duplicate pages and metrics
- 🔗 **Improved Navigation**: Direct routes to all pages with redirects for legacy URLs

### v2.0.0 (January 2026)
- 🆕 **Four-pillar architecture**: FinOps, Governance, Intelligence, Operations
- 🆕 **Prompt Analysis**: PII detection, hallucination risk, injection detection
- 🆕 **Cost Forecasting**: 7/14/30-day projections with budget breach ETA
- 🆕 **Davis CoPilot Integration**: Real NL-to-DQL conversion
- 🆕 **Enterprise Governance Challenges**: 10 common enterprise AI risks
- 🆕 **Collapsible Responses**: Clean UI with expandable details
- ✨ **Tab Highlighting**: Active tab visual indicators
- ✨ **Compact Layout**: Optimized screen space utilization

### v1.0.0 (December 2025)
- Initial release with Health Dashboard
- Provider Comparison
- Basic Davis Assistant
- Remediation Library

---

## ⚠️ Disclaimer

This application is provided "as is" without warranty of any kind, express or implied. The author(s) and contributor(s) are not liable for any claims, damages, or other liability arising from the use of this software. This project is a personal initiative and does not represent the views, policies, or endorsements of any employer, organization, or affiliated entity. Use at your own risk.
