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
- All DQL queries are defined in `ui/app/queries/dql-queries.ts`
- Custom hooks in `ui/app/hooks/` handle data fetching and state
- Types are centralized in `ui/app/types/index.ts`
- Utility functions in `ui/app/utils/` for formatting and calculations
- **Formatting**: All locale-aware formatting via `ui/app/utils/formatting.ts`
- **Design tokens**: All color constants via `ui/app/utils/design-tokens.ts`

## Development Commands
```bash
npm start     # Start dev server
npm run build # Build for production
npm run deploy # Deploy to Dynatrace
```

## Dynatrace MCP Server
**IMPORTANT:** Always use the **Demo Dynatrace MCP Server** (`mcp_demo_dynatrac_*` tools) for querying Dynatrace data. Do NOT use the `mcp_io_github_dyn_*` tools.

> **MCP Data Validation is MANDATORY for every implementation that writes or modifies DQL queries.** See the full workflow, pitfalls table, and validation steps in [`AGENTS.md` → MCP Data Validation](../AGENTS.md).

## Important Files
- `app.config.json` - App configuration and scopes
- `ui/app/App.tsx` - Main app with routing
- `ui/app/hooks/useDQLQueries.ts` - DQL query execution
- `ui/app/hooks/useDavisAI.ts` - Davis CoPilot integration
- `ui/app/utils/formatting.ts` - Locale-aware formatters (formatNumber, formatDateTime, formatTime, etc.)
- `ui/app/utils/design-tokens.ts` - Centralized color tokens (StatusColors, ChartColors, EntityColors)

## Documentation & Learning Resources
- **Official Dynatrace Developer Portal**: https://developer.dynatrace.com
  - App development guides
  - Strato Design System components
  - SDK references (@dynatrace-sdk/*)
  - DQL syntax and functions
  - Best practices for AppEngine apps

---

## Strato Design System Compliance — MANDATORY Rules

**Every line of UI code MUST follow these rules. No exceptions.**

### 1. No Raw HTML Elements

| Forbidden | Use Instead |
|-----------|-------------|
| `<div>` | `<Flex>` from `@dynatrace/strato-components/layouts` |
| `<span>` | `<Text>` from `@dynatrace/strato-components/typography` |
| `<button>` | `<Button>` from `@dynatrace/strato-components/buttons` |
| `<input>` | `<TextInput>`, `<NumberInput>` from `@dynatrace/strato-components/forms` (exception: hidden `<input type="file">`) |
| `<select>` | `<Select>` from `@dynatrace/strato-components-preview/forms` |
| `<table>` | `<DataTable>` from `@dynatrace/strato-components-preview/tables` |
| `<a>` | `<Link>` from `@dynatrace/strato-components/typography` or `<AppLink>` |

### 2. No Hardcoded Colors

- **NEVER** use hex colors (`#RRGGBB`) or `rgb()`/`rgba()`.
- **ALWAYS** use Strato CSS variables or design token imports from `ui/app/utils/design-tokens.ts`.
- For inline styles: `var(--dt-colors-text-primary-default)`, `var(--dt-colors-border-neutral-default)`, etc.
- **Only exception**: Hex as fallback in `var()` and brand SVG icons in `providerIcons.tsx`.

### 3. No Raw Locale Formatting

- **NEVER** use `.toLocaleString()`, `.toLocaleTimeString()`, `.toLocaleDateString()`, or `new Intl.NumberFormat()`.
- **ALWAYS** use `ui/app/utils/formatting.ts`: `formatNumber()`, `formatDateTime()`, `formatTime()`, `formatDate()`, `formatCurrencyLocalized()`, `formatPercent()`.

### 4. Strato Component API Rules

- **Tabs**: `defaultIndex={0}` (not `defaultValue`). Tab items use `title="..."` (not `value`/`label`).
- **DonutChart / PieChart**: Data = `{ slices: [...] }`, not a raw array.
- **TimeseriesChart**: Datapoints = `{ start: Date, value: number }` (not `timestamp: number`).
- **DataTable**: Cell renderers must return JSX (`<Text>`), not raw strings.
- **Flex gap**: Valid tokens only: `0 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64`.
- **Button variants**: `"default" | "emphasized" | "accent"` only. No `"minimal"`.

### 5. Responsive Layout

- **NEVER** `repeat(2, 1fr)` — use `repeat(auto-fit, minmax(280px, 1fr))` or `<Flex flexWrap="wrap">`.
- **NEVER** `calc(100vh - Xpx)` — let Strato handle layout.
- **NEVER** hardcode pixel widths on containers.

### 6. Imports

- Import Strato from category subdirectories, never package root.
- Never duplicate imports from both `../utils` and `../utils/formatting`.

### 7. Theming

- **DO NOT** set theme on `<AppRoot>` — it auto-handles dark/light mode.
- All colors via CSS variables adapt automatically. Hardcoded colors break dark mode.
