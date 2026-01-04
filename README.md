# GenAI Control Center (GCC) v2.0

<p align="center">
  <img src="https://img.shields.io/badge/Dynatrace-AppEngine-4CAF50?style=for-the-badge&logo=dynatrace" alt="Dynatrace AppEngine"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Davis_CoPilot-AI-9B59B6?style=for-the-badge&logo=openai" alt="Davis CoPilot"/>
</p>

## 🎯 Overview

**GenAI Control Center** is a Dynatrace AppEngine application that provides **enterprise AI observability and governance** for organizations running GenAI workloads. It auto-discovers AI services instrumented with OpenTelemetry GenAI semantic conventions and provides comprehensive management across four key domains:

### 🏠 Four Pillars of AI Management

| Page | Purpose | Key Features |
|------|---------|--------------|
| 💰 **FinOps** | Cost Management & Optimization | Real-time spend tracking, cost forecasting, provider cost comparison, budget alerts |
| 🛡️ **Governance** | Compliance & Risk Management | Policy enforcement, PII detection, prompt analysis, enterprise governance challenges |
| 🧠 **Intelligence** | AI-Powered Insights | Davis CoPilot integration, natural language queries, DQL generation |
| 🔧 **Operations** | Health & Performance Monitoring | Service health, latency tracking, error rates, auto-remediation |

## 👥 Target Personas

| Persona | Primary Use Case |
|---------|------------------|
| 💰 **FinOps** | Cost visibility, budget forecasting, token optimization, showback |
| 🛡️ **Security/Compliance** | AI governance, PII detection, prompt analysis, audit trails |
| 🔧 **SRE** | Incident response, health monitoring, root cause analysis |
| 🏗️ **Platform Engineer** | Architecture optimization, provider selection, capacity planning |
| 👨‍💻 **Developer** | Debugging, performance tuning, model selection |

## 🚀 Key Features

### 💰 FinOps - Cost Management
- **Real-time Spend Dashboard** - Track AI costs across all providers
- **Cost Forecasting** - 7/14/30-day projections with confidence levels
- **Budget Breach ETA** - Predict when you'll exceed budget
- **Provider Comparison** - Cost-per-token by provider and model
- **Service Cost Attribution** - Breakdown by business unit

### 🛡️ Governance - Compliance & Risk
- **Prompt Analysis** - Detect security and optimization issues:
  - 🔐 **PII Detection** - SSN, emails, PHI/HIPAA data
  - 🎭 **Hallucination Risk** - Factual queries without grounding
  - 💰 **Expensive Prompts** - High-cost request identification
  - 🔄 **Cache Candidates** - Repetitive prompts for semantic caching
  - ⚠️ **Prompt Injection** - Malicious pattern detection
  - ⚖️ **Bias Risk** - Protected characteristics in decisions
- **Enterprise Challenges** - Track and mitigate:
  - Data Sovereignty & Cross-Border Transfers
  - Shadow AI Usage Detection
  - Model Drift & Version Control
  - Audit Trail Completeness
  - IP Contamination Risks
- **Provider Risk Scoring** - Certifications, data residency, compliance

### 🧠 Intelligence - Davis CoPilot AI
- **Natural Language Queries** - Ask questions in plain English
- **Auto DQL Generation** - Converts NL to Dynatrace Query Language
- **Query Explanation** - Understand generated queries
- **Collapsible Responses** - Clean output with expandable details

### 🔧 Operations - Health & Performance
- **Service Auto-Discovery** - Finds all `gen_ai.*` instrumented services
- **Health Indicators** - Traffic light status (Healthy/Warning/Critical)
- **Performance Metrics** - Latency, throughput, error rates
- **Deep Linking** - Jump to Dynatrace Services app
- **Remediation Playbooks** - Automated fix suggestions

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
│       │   ├── FilterBar.tsx
│       │   ├── MetricCard.tsx
│       │   ├── ServiceRow.tsx
│       │   └── DavisResponse.tsx
│       ├── pages/            # Main application pages
│       │   ├── FinOps.tsx        # Cost management
│       │   ├── Governance.tsx    # Compliance & prompt analysis
│       │   ├── Intelligence.tsx  # Davis CoPilot AI
│       │   └── Operations.tsx    # Health monitoring
│       ├── hooks/            # Data fetching hooks
│       │   ├── useDQLQueries.ts
│       │   └── useDavisAI.ts
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

*Version 2.0.0 | © 2026*

---

## 📋 Changelog

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
