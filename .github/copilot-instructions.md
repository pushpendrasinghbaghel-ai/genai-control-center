<!-- GenAI Control Center - Copilot Instructions -->

## Project Overview
This is a **Dynatrace AppEngine** application called **GenAI Control Center (GCC)**. It's built with React, TypeScript, and the Strato Design System.

## Technology Stack
- **Frontend**: React 18 + TypeScript
- **UI Kit**: @dynatrace/strato-components-preview (Strato Design System)
- **Data Layer**: DQL (Dynatrace Query Language) via @dynatrace-sdk/client-query
- **AI Integration**: Davis CoPilot via @dynatrace-sdk/client-davis-ai
- **Automation**: Workflows via @dynatrace-sdk/client-automation

## Architecture
The app has 4 core pillars:
1. **Health Dashboard** - Auto-discovery of AI services using gen_ai.* spans
2. **AI Architect** - Pattern detection and recommendations
3. **Davis Assistant** - Chat-based deep-dive analysis
4. **Remediation Library** - One-click workflow automation

## Key Conventions
- All DQL queries are defined in `src/queries/dql-queries.ts`
- Custom hooks in `src/hooks/` handle data fetching and state
- Types are centralized in `src/types/index.ts`
- Utility functions in `src/utils/` for formatting and calculations

## Development Commands
```bash
npm start     # Start dev server
npm run build # Build for production
npm run deploy # Deploy to Dynatrace
```

## Dynatrace MCP Server
**IMPORTANT:** Always use the **Demo Dynatrace MCP Server** (`mcp_demo_dynatrac_*` tools) for querying Dynatrace data. Do NOT use the `mcp_io_github_dyn_*` tools.

## Important Files
- `app.config.ts` - App configuration and scopes
- `src/app/App.tsx` - Main app with routing
- `src/hooks/useDQLQueries.ts` - DQL query execution
- `src/hooks/useDavisAI.ts` - Davis CoPilot integration
