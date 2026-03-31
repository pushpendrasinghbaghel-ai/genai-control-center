# AI Coding Agent Instructions

## DQL - Dynatrace Query Language

Before writing any DQL query, the agent must always use the knowledge base (`dql_search` tool) to search for relevant DQL documentation, syntax, and examples, whenever the tool is available.

## UI Components - Strato

Before using any Strato UI component, the agent must always use the knowledge base tools to search for relevant component documentation and usage examples, whenever the tools are available:
- Use the `strato_search` tool to search for available Strato components by name or keyword.
- Use the `strato_get_component` tool to retrieve detailed documentation, props, and code examples for a specific component.
- Use the `strato_get_usecase_details` tool to get code for specific component use cases and patterns.

## Project Overview

This repository contains **GenAI Control Center (GCC)** — a **Dynatrace App** built with the Dynatrace App Toolkit "dt-app", running on **Dynatrace AppEngine**. Use the **App Toolkit** during development and CI (`dt-app dev`, `dt-app build`, `dt-app deploy`, `dt-app publish`).

### App Description
GenAI Control Center provides unified GenAI observability with 4 core pillars:
1. **Health Dashboard** - Auto-discovery of AI services using gen_ai.* spans
2. **AI Architect** - Pattern detection and recommendations
3. **Davis Assistant** - Chat-based deep-dive analysis
4. **Remediation Library** - One-click workflow automation

## Core Concepts

### Dynatrace Apps  
- UI is **TypeScript/React** using **Strato Design System** components for consistent Dynatrace UX.  
- Backend logic runs inside the **Dynatrace JavaScript runtime**. Let the app execute backend code, primarily to call external URLs (e.g., third‑party APIs) that shouldn't be invoked directly from the browser.
- Apps can use **Intents** for cross-app communication
- Apps can provide **Actions** and **Widgets** to extend Dynatrace. 

### Grail
- **Grail** stores observability data (logs, metrics, events, traces, business events).
- **DQL** is used to query Grail.

### DQL (Dynatrace Query Language)
DQL is a **pipeline-style query language** for Grail: you start with a data source (e.g., `fetch logs` or `timeseries` for metrics), then add pipe‑separated commands like `filter`, `summarize`, `sort`, and `makeTimeseries` to transform and aggregate results. Typical patterns include counting events, building time series, and grouping by dimensions (e.g., host or status).

### Platform Services
A set of services are available to Dynatrace Apps to read and write data. Every service provides a typescript **client sdk** to interact with it. Common services include:
- **Grail Query Service**: Query Dynatrace Grail data using DQL. Prefer using the `useDql` React hook from `@dynatrace-sdk/react-hooks` in UI code, but the low‑level client `@dynatrace-sdk/client-query` is also available.
- **Document Service**: Store and retrieve json files. Used e.g. for dashboards, can be shared with other users. Use `@dynatrace-sdk/client-document` to interact with it.
- **(User) App State Service**: Store and retrieve user‑specific or app‑specific key/value data. Used for caching or user preferences. Use `@dynatrace-sdk/client-state` to interact with it.

## Strato Design System

The **Strato Design System** is Dynatrace's official design system and component library. It provides React components, design tokens (colors, borders, shadows), and icons to build consistent UIs that align with Dynatrace's look and feel.

Available packages:
- `@dynatrace/strato-components` — Stable react components. Components here include: Button, ProgressBar, ProgressCircle, Skeleton, SkeletonText, AppRoot, Container, Divider, Flex, Grid, Surface, Heading, Link, List, Paragraph, Strikethrough, Strong, Text, TextEllipsis
- `@dynatrace/strato-components-preview` — Most components are here, including Charts (TimeseriesChart, HistogramChart, HoneycombChart, SingleValue, PieChart, DonutChart, ...), Content (Accordion, Chip, HealthIndicator, MessageContainer, ...), Editors (CodeEditor, DQLEditor), Filters (FilterBar, FilterField, SegmentSelector, TimeframeSelector), Forms (Checkbox, Radio, Select, Switch, TextInput, ...), Layouts (AppHeader, HelpMenu, InputGroup, Page, TitleBar), Navigation (AppLink, Breadcrumbs, Menu, Tabs), Overlays (Modal, Overlay, Sheet, Tooltip), Tables (DataTable, SimpleTable)
- `@dynatrace/strato-design-tokens` — design tokens (colors, spacing, typography) for consistent styling.
- `@dynatrace/strato-geo` — map visualization primitives.
- `@dynatrace/strato-icons` — Strato icon library.

### Working with Table components
When using table components from Strato, prefer `DataTable` from `@dynatrace/strato-components-preview/tables` for advanced features like sorting, filtering, pagination, and selection. Use `SimpleTable` for basic tabular data without interactivity, mostly used for Markdown rendering.

Table API:
- Tables require the `data` and `columns` props
- Column definitions must include `id`, `header`, and `accessor` (string path or function)

### Importing Strato Components
When importing Strato components, follow these guidelines to ensure optimal bundle size and performance:
1. **Never** import from `@dynatrace/strato-components` or `@dynatrace/strato-components-preview` package root
2. **Always** import from the specific category subdirectory (e.g., `/layouts`, `/typography`, `/tables`)
3. **Wrong**: `import { Flex, Heading } from "@dynatrace/strato-components";`
4. **Correct**:
   ```typescript
   import { Flex } from "@dynatrace/strato-components/layouts";
   import { Heading } from "@dynatrace/strato-components/typography";
   ```

**TypeScript Definitions**: All Strato packages have TypeScript definitions located directly in the package root under each component folder. For example:
- `node_modules/@dynatrace/strato-components-preview/forms/select/Select.d.ts` - Main Select component
- `node_modules/@dynatrace/strato-components-preview/forms/select/SelectOption.d.ts` - Select.Option component
- Pattern: `node_modules/@dynatrace/strato-components[-preview]/<category>/<component>/<Component>.d.ts`

**Important**: Always check the `.d.ts` files directly in `node_modules/@dynatrace/strato-components[-preview]/` to understand component APIs. Do NOT look for a separate `types/` subdirectory.

## Client SDKs

Dynatrace provides TypeScript client SDKs to interact with platform services. Each service has its own package, for example: `@dynatrace-sdk/client-query`, `@dynatrace-sdk/client-document`, `@dynatrace-sdk/client-state`. Those packages are autogenerated from the service OpenAPI specs and have the following characteristics:
- Exported clients to call service endpoints, eg. `queryClient` or `documentClient`.
- Example: 
```typescript
const result = await queryClient.queryExecute({ body: { query: 'fetch logs | count' }});
```

**Important**: Prefer using the higher‑level React hooks from `@dynatrace-sdk/react-hooks` in UI code, as they encapsulate state management, polling, and error handling.

## Other SDKs

- React hooks — `@dynatrace-sdk/react-hooks`: React hooks for DQL (useDql), documents, app state, settings and other platform services. Prefer using these in UI code. Request and response types match the low‑level client SDKs. Example:
  ```typescript 
  const { data, error, isLoading } = useDocument({ id: documentId });
  ```
  - Common React Hooks:
    - `useDql(query: string)` - Execute DQL queries
    - `useDocument({ id: string })` - Fetch a single document
    - `useListDocuments(params)` - List all documents (requires `document:documents:read` scope)
    - `useAppState({ key: string })` and `useUserAppState({ key: string })` - Read app (user) state
    - `useSetAppState()` and `useSetUserAppState()` - Write app (user) state. Returns an execute function.
    - `useAppFunction({ name: string, data: any })` - Call backend functions
  - All update/set/POST hooks return an execute function that you can call to perform the action.
- Units & formatting — `@dynatrace-sdk/units`: Convert values to human‑readable strings (e.g., bytes → KiB/MB) and ensure consistent unit formatting across UI and functions.
- App Environment — `@dynatrace-sdk/app-environment`: Read app/environment context (IDs, URLs, current user) directly in the app
- User Preferences — `@dynatrace-sdk/user-preferences`: Retrieve the logged‑in user's theme, language, regional format, and timezone to adapt UI/formatting. Can not be used to store custom user settings. Use the App State service for that.

## Development Workflow

### Commands (via `dt-app` CLI)
- **Dev Server**: `npm run start` - runs with hot reload, auto-opens browser
- **Build**: `npm run build` - outputs to `dist/` folder
- **Deploy**: `npm run deploy` - deploys to environment in `app.config.json`
- **Lint**: `npm run lint` - runs ESLint checks

### Configuration
- **App Metadata**: `app.config.json` defines app name, ID, version, and required scopes
- **Environment URL**: Set `environmentUrl` in `app.config.json` to target Dynatrace environment
- **Scopes**: Add required permissions to `app.config.json` `scopes` array (e.g., `storage:logs:read`, `document:documents:read`, `document:documents:write`, `state:app-states:read`, `state:app-states:write`)

## Key Dependencies

- `@dynatrace/strato-components` and `-preview`: UI component library
- `@dynatrace/strato-design-tokens`: Design tokens (colors, borders, shadows)
- `@dynatrace-sdk/react-hooks`: Hooks for Dynatrace APIs (`useDql`, etc.)
- `@dynatrace-sdk/client-*`: Query API clients, every service has its own client package

## Common Tasks

- **Add Route**: Update `Routes` in [ui/app/App.tsx](ui/app/App.tsx) and add nav item to [ui/app/components/Header.tsx](ui/app/components/Header.tsx)
- **Query Data**: Use `useDql` hook with DQL query string (Dynatrace Query Language)
- **Style Components**: Import from `@dynatrace/strato-design-tokens/{colors,borders,box-shadows}` for design tokens

---

## GCC Project-Specific Conventions

### Project Structure
```
ui/
├── app/
│   ├── App.tsx              # Main app with routing
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks for data fetching
│   ├── pages/               # Page components (one per route)
│   ├── queries/             # DQL query definitions
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── context/             # React Context providers
├── assets/                  # Static assets (icons, images)
└── main.tsx                 # App entry point
```

### Key Conventions

1. **DQL Queries**: All DQL queries are centralized in `ui/app/queries/dql-queries.ts`
2. **Custom Hooks**: Data fetching hooks in `ui/app/hooks/` (e.g., `useDQLQueries.ts`, `useDavisAI.ts`)
3. **Types**: Centralized in `ui/app/types/index.ts`
4. **Utilities**: Formatting and calculation functions in `ui/app/utils/`

### GenAI Semantic Conventions

This app queries **gen_ai.*** spans following OpenTelemetry GenAI semantic conventions:
- `gen_ai.request.model` - Model name (e.g., gpt-4o, claude-3-opus)
- `gen_ai.provider.name` - Provider (e.g., openai, anthropic, azure)
- `gen_ai.usage.input_tokens` - Input token count
- `gen_ai.usage.output_tokens` - Output token count
- `gen_ai.response.finish_reason` - Completion reason (stop, length, etc.)

### Davis AI Integration

The app uses Davis CoPilot for:
- Natural language to DQL conversion (`davis-copilot:nl2dql:execute`)
- DQL explanation (`davis-copilot:dql2nl:execute`)
- Conversational analysis (`davis-copilot:conversations:execute`)

### MCP Server Integration

For querying Dynatrace data via MCP, use the **Demo Dynatrace MCP Server** (`mcp_demo_dynatrac_*` tools). Do NOT use `mcp_io_github_dyn_*` tools.

### MCP Data Validation — MANDATORY for Every Implementation

**Every feature that writes or modifies DQL queries MUST validate them against the live Dynatrace environment using the MCP server before the implementation is considered complete. No exceptions.**

#### Why
DQL queries that pass TypeScript compilation can still fail at runtime — wrong field names, missing commas before `by:`, null fields in actual event data, or schema mismatches between assumed and real structures. These bugs only surface as "no data" in the UI. MCP validation catches them early.

#### Mandatory Steps

1. **Run every DQL query via MCP** — Use `mcp_demo_dynatrac_execute_dql` with the exact query string from the code:
   ```
   Tool: mcp_demo_dynatrac_execute_dql
   Input: { "dql_query": "<exact DQL from hook/module>" }
   ```

2. **Verify response schema** — For each result, confirm:
   - Query returns records (not empty)
   - All expected field names exist (e.g., `provider`, `model`, `request_count`)
   - Field values are correct types (string, number, not null)
   - Aggregation shapes match what the UI code unpacks
   - `by:` grouping produces the expected dimensions

3. **Investigate failures** — If fields are null or missing:
   - Run exploratory query: `fetch bizevents | filter event.type == "X" | limit 1` or `fetch spans | filter ... | limit 1`
   - Inspect raw record structure to find the real field names
   - Use DQL `parse` command for JSON-embedded data (e.g., `requestParameters` in CloudTrail events)

4. **Fix, re-validate, confirm** — After fixing the DQL:
   - Re-run via MCP to confirm data flows correctly
   - Update hook data processing if field names/types changed
   - Run TypeScript compilation to ensure no type errors

5. **Report results** — Briefly state: records returned per query, any field adjustments, any data gaps.

#### Known DQL Pitfalls

| Pitfall | Example | Fix |
|---------|---------|-----|
| Missing comma before `by:` | `summarize count()` *(newline)* `by: { field }` | `summarize count(), by: { field }` |
| Assumed field doesn't exist | `gen_ai.training.base_model` is null in CloudTrail events | Use `parse` to extract from JSON string fields |
| Field returns as string | `avg_duration_ns` = `"123456"` | Wrap with `Number()` in hook processing |
| BizEvent schema mismatch | Expected structured fields, got raw webhook payload | Exploratory query first: `fetch bizevents \| limit 1` |
| Time window too narrow | 0 records for `last 5 minutes` | Start with `last 24 hours`, narrow later |

#### When to Skip
MCP validation may be skipped ONLY if:
- The change is purely UI/styling with no DQL modifications
- The query is identical to one already validated in the same session
- MCP tools are unavailable (document this as a known gap)

### Important Files

| File | Purpose |
|------|---------|
| `app.config.json` | App configuration, scopes, and metadata |
| `ui/app/App.tsx` | Main routing and layout |
| `ui/app/hooks/useDQLQueries.ts` | DQL query execution hooks |
| `ui/app/hooks/useDavisAI.ts` | Davis CoPilot integration |
| `ui/app/queries/dql-queries.ts` | Centralized DQL query definitions |
| `ui/app/types/index.ts` | TypeScript type definitions |
| `ui/app/utils/formatting.ts` | Locale-aware number/date/currency formatters |
| `ui/app/utils/design-tokens.ts` | Centralized color token constants |

---

## Strato Design System Compliance — MANDATORY Rules

**Every line of UI code in this project MUST follow these rules. No exceptions.**

### 1. No Raw HTML Elements

| Forbidden | Use Instead |
|-----------|-------------|
| `<div>` | `<Flex>` from `@dynatrace/strato-components/layouts` |
| `<span>` | `<Text>` from `@dynatrace/strato-components/typography` |
| `<button>` | `<Button>` from `@dynatrace/strato-components/buttons` |
| `<input>` | `<TextInput>`, `<NumberInput>` from `@dynatrace/strato-components/forms` (exception: hidden `<input type="file">` for file uploads) |
| `<select>` | `<Select>` from `@dynatrace/strato-components-preview/forms` |
| `<table>` | `<DataTable>` from `@dynatrace/strato-components-preview/tables` |
| `<a>` | `<Link>` from `@dynatrace/strato-components/typography` or `<AppLink>` |

### 2. No Hardcoded Colors

- **NEVER** use hex colors (`#RRGGBB`) or `rgb()`/`rgba()` in component styles.
- **ALWAYS** use Strato CSS variables or design token imports.
- Centralized tokens are in `ui/app/utils/design-tokens.ts` — use `StatusColors`, `ChartColors`, `EntityColors`, `GradeColors`.
- For inline styles, use CSS variables: `var(--dt-colors-text-primary-default)`, `var(--dt-colors-border-neutral-default)`, etc.
- **Only exception**: Hex colors as fallbacks inside `var()` expressions (e.g., `var(--dt-colors-x, #fallback)`) and brand-identity SVG icons in `providerIcons.tsx`.

### 3. No Raw Locale Formatting

- **NEVER** use `.toLocaleString()`, `.toLocaleTimeString()`, `.toLocaleDateString()`, or `new Intl.NumberFormat()` directly.
- **ALWAYS** use the centralized formatters from `ui/app/utils/formatting.ts`:

| Instead of | Use |
|------------|-----|
| `value.toLocaleString()` | `formatNumber(value)` |
| `new Date(x).toLocaleString()` | `formatDateTime(x)` |
| `new Date(x).toLocaleTimeString()` | `formatTime(x)` |
| `new Date(x).toLocaleDateString()` | `formatDate(x)` |
| `new Intl.NumberFormat('en-US', { style: 'currency' })` | `formatCurrencyLocalized(amount, 'USD')` |
| `value.toFixed(2) + '%'` | `formatPercent(value)` |

These formatters respect the user's Dynatrace regional format, timezone, and language preferences via `@dynatrace-sdk/user-preferences`.

### 4. Strato Component API Rules

- **Tabs**: Use `defaultIndex={0}` (not `defaultValue`). Tab items use `title="..."` (not `value`/`label`).
- **DonutChart / PieChart**: Data must be `{ slices: [...] }` object, not a raw array.
- **TimeseriesChart**: Datapoints need `start: Date` and `value: number` (not `timestamp: number`).
- **DataTable**: Cell renderers must return JSX (`<Text>`) not raw strings.
- **Flex gap**: Only use valid Strato spacing tokens: `0 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64`.
- **Button variants**: Only `"default" | "emphasized" | "accent"`. There is no `"minimal"` variant.

### 5. Responsive Layout

- **NEVER** use fixed column grids like `gridTemplateColumns: 'repeat(2, 1fr)'`.
- **ALWAYS** use responsive patterns: `repeat(auto-fit, minmax(280px, 1fr))` or `<Flex flexWrap="wrap">` with `flex: '1 1 280px'`.
- **NEVER** use `calc(100vh - Xpx)` for height — let Strato `<Page>` and `<Flex>` handle layout.
- **NEVER** hardcode pixel widths on containers — use `flex`, `minWidth`, and `maxWidth`.

### 6. Imports

- **ALWAYS** import Strato components from category subdirectories, never from package root.
- **NEVER** create duplicate imports of the same symbol from both `../utils` and `../utils/formatting` — the barrel export in `utils/index.ts` already re-exports everything.
- When adding formatting calls, check if the file already imports from `../utils` before adding a `../utils/formatting` import.

### 7. Theming

- **DO NOT** set theme manually on `<AppRoot>`. It handles dark/light mode automatically.
- All colors via CSS variables automatically adapt to the user's theme. This is why hardcoded colors break in dark mode.
