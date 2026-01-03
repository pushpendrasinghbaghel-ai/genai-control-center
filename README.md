# GenAI Control Center (GCC)

<p align="center">
  <img src="https://img.shields.io/badge/Dynatrace-AppEngine-4CAF50?style=for-the-badge&logo=dynatrace" alt="Dynatrace AppEngine"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
</p>

## 🎯 Overview

**GenAI Control Center** is a Dynatrace AppEngine application that provides **proactive AI service management** for enterprises running GenAI workloads. It auto-discovers AI services instrumented with OpenTelemetry GenAI semantic conventions and provides:

- 🏥 **Health Dashboard** - Real-time health monitoring of all AI services
- 🏗️ **AI Architect** - Optimization recommendations and best practices
- 🤖 **Davis Assistant** - Natural language Q&A powered by Davis AI
- 📊 **Provider Comparison** - Side-by-side provider/model analysis
- 📚 **Remediation Library** - Automated fix playbooks

## 👥 Target Personas

| Persona | Primary Use Case |
|---------|------------------|
| 🔧 **SRE** | Incident response, health monitoring, root cause analysis |
| 🏗️ **Platform Engineer** | Architecture optimization, provider selection |
| 💰 **FinOps** | Cost visibility, token usage analysis, optimization |
| 👨‍💻 **Developer** | Debugging, performance tuning, model selection |
| 🛡️ **Security/Compliance** | AI governance, provider inventory, audit |

📖 **[Full User Guide →](docs/USER_GUIDE.md)**

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
npm run start
```

### Required Scopes
The app requires these Dynatrace scopes:
- `storage:logs:read` - Read logs for AI service analysis
- `storage:spans:read` - Read GenAI spans for service discovery
- `storage:metrics:read` - Read metrics for SegmentSelector
- `storage:entities:read` - Read entities for filtering
- `storage:filter-segments:read/write` - Segment filtering
- `automation:workflows:read/run` - Remediation workflows

## 📊 Features

### Health Dashboard
- Auto-discovery of AI services with `gen_ai.*` spans
- Health status indicators (Healthy, Warning, Critical)
- Deep linking to Dynatrace Services app
- Filterable by service, provider, model, timeframe

### FilterBar
Standard Dynatrace filter experience with:
- **SegmentSelector** - Environment-based filtering
- **FilterField** - Entity-based filtering with suggestions
- **TimeframeSelector** - Time range selection
- **Update Button** - Apply all filter changes together

### Provider Comparison
- Side-by-side provider performance (OpenAI, Anthropic, Google, etc.)
- Model-level metrics (latency, error rate, tokens, cost)
- Visual request distribution

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to Dynatrace environment |
| `npm run uninstall` | Remove app from environment |

### Project Structure

```
gcc/
├── app.config.json       # App configuration & scopes
├── ui/
│   └── app/
│       ├── components/   # Reusable components (FilterBar, etc.)
│       ├── pages/        # Page components (HealthDashboard, etc.)
│       ├── hooks/        # Data fetching hooks (useDQLQueries)
│       ├── queries/      # DQL query definitions
│       ├── utils/        # Helper functions
│       └── types/        # TypeScript type definitions
└── docs/
    └── USER_GUIDE.md     # Persona-based user guide
```

## 📈 Metrics Tracked

| Metric | Source | Description |
|--------|--------|-------------|
| `gen_ai.system` | Span attribute | AI provider (openai, anthropic, etc.) |
| `gen_ai.request.model` | Span attribute | Model name (gpt-4, claude-3, etc.) |
| `gen_ai.usage.input_tokens` | Span attribute | Input token count |
| `gen_ai.usage.output_tokens` | Span attribute | Output token count |
| `service.name` | Span attribute | Service identifier |
| Latency | Span duration | Response time |
| Error Rate | Span status | Failure percentage |

## 🔗 Integrations

- **Dynatrace Services App** - Deep linking for detailed analysis
- **Davis AI** - Natural language queries
- **Dynatrace Workflows** - Automated remediation
- **OpenTelemetry** - GenAI semantic conventions

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/)
- Uses [Dynatrace Strato Components](https://developer.dynatrace.com/develop/ui/)

---

**Built with ❤️ by the GenAI Observability Team**

*Version 1.0.0 | © 2026*
