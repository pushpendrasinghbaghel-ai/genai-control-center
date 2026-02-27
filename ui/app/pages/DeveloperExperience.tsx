// DeveloperExperience.tsx — AI Integration Health
// A Lighthouse-style diagnostic for AI observability quality.
// Shows per-model telemetry completeness, model routing patterns, and actionable recommendations.
// Unique value: no competitor surfaces per-model instrumentation gaps or gateway routing visibility.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { CodeIcon, WarningIcon, CheckmarkIcon, CriticalIcon, AiIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  INSTRUMENTATION_COVERAGE_QUERY,
  INTEGRATION_REPORT_QUERY,
  MODEL_VERSION_MISMATCH_QUERY,
} from '../queries/dql-queries';
import type { QueryFilters } from '../queries/dql-queries';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';

// ============================================
// Types
// ============================================

interface IntegrationRow {
  model: string;
  provider: string;
  calls: number;
  errors: number;
  errorRate: number;
  tokensPct: number;
  responseModelPct: number;
  agentPct: number;
  conversationPct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalInput: number;
  totalOutput: number;
  completeness: number;
}

interface ModelRoute {
  requested: string;
  actual: string;
  provider: string;
  occurrences: number;
  avgLatencyMs: number;
  totalInput: number;
  totalOutput: number;
}

interface Recommendation {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  attribute: string;
}

interface CoverageSummary {
  total: number;
  withProvider: number;
  withTokens: number;
  withAgent: number;
  withConversation: number;
  withResponseModel: number;
}

// ============================================
// Helpers
// ============================================

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function StatusPill({ label, color }: { label: string | number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: color + '22', color,
    }}>
      {label}
    </span>
  );
}

function CompletionBadge({ value }: { value: number }) {
  const color = value >= 80 ? Colors.Text.Success.Default
    : value >= 50 ? Colors.Text.Warning.Default
    : Colors.Text.Critical.Default;
  return (
    <Flex alignItems="center" gap={6}>
      <div style={{ width: 48, height: 6, borderRadius: 3, background: color + '30', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{value}%</span>
    </Flex>
  );
}

function AttributeCheck({ pctValue }: { pctValue: number }) {
  if (pctValue >= 80) {
    return (
      <Flex alignItems="center" gap={4}>
        <CheckmarkIcon style={{ width: 13, height: 13, color: Colors.Text.Success.Default }} />
        <span style={{ fontSize: 11, color: Colors.Text.Success.Default }}>{pctValue}%</span>
      </Flex>
    );
  }
  if (pctValue > 0) {
    return (
      <Flex alignItems="center" gap={4}>
        <WarningIcon style={{ width: 13, height: 13, color: Colors.Text.Warning.Default }} />
        <span style={{ fontSize: 11, color: Colors.Text.Warning.Default }}>{pctValue}%</span>
      </Flex>
    );
  }
  return (
    <Flex alignItems="center" gap={4}>
      <CriticalIcon style={{ width: 13, height: 13, color: Colors.Text.Critical.Default }} />
      <span style={{ fontSize: 11, color: Colors.Text.Critical.Default }}>None</span>
    </Flex>
  );
}

// ============================================
// Main Page
// ============================================

export function DeveloperExperience() {
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const [report, setReport] = useState<IntegrationRow[]>([]);
  const [routes, setRoutes] = useState<ModelRoute[]>([]);
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'routing' | 'recommendations'>('report');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qf: QueryFilters = {
      timeframe: globalFilters.timeframe,
      serviceName: globalFilters.serviceFilter || undefined,
      provider: globalFilters.providerFilter || undefined,
      model: globalFilters.modelFilter || undefined,
    };

    try {
      const [reportRes, routeRes, covRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: INTEGRATION_REPORT_QUERY(qf), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: MODEL_VERSION_MISMATCH_QUERY(qf), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: INSTRUMENTATION_COVERAGE_QUERY(qf), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      // Integration report — per model×provider
      const rows = (reportRes.result?.records || []).map((r: any) => {
        const calls = Number(r['calls'] || 0);
        const tokPct = pct(Number(r['has_tokens'] || 0), calls);
        const resPct = pct(Number(r['has_response_model'] || 0), calls);
        const agtPct = pct(Number(r['has_agent'] || 0), calls);
        const convPct = pct(Number(r['has_conversation'] || 0), calls);
        const errors = Number(r['errors'] || 0);
        return {
          model: String(r['model'] || '(no model)'),
          provider: String(r['provider'] || '(no provider)'),
          calls,
          errors,
          errorRate: pct(errors, calls),
          tokensPct: tokPct,
          responseModelPct: resPct,
          agentPct: agtPct,
          conversationPct: convPct,
          avgLatencyMs: Math.round(Number(r['avg_latency_ms'] || 0)),
          p95LatencyMs: Math.round(Number(r['p95_latency_ms'] || 0)),
          totalInput: Number(r['total_input'] || 0),
          totalOutput: Number(r['total_output'] || 0),
          completeness: Math.round((tokPct + resPct + agtPct + convPct) / 4),
        } as IntegrationRow;
      });
      setReport(rows);

      // Model routing — requested ≠ served
      setRoutes((routeRes.result?.records || []).map((r: any) => ({
        requested: String(r['requested'] || ''),
        actual: String(r['actual'] || ''),
        provider: String(r['provider'] || ''),
        occurrences: Number(r['occurrences'] || 0),
        avgLatencyMs: Math.round(Number(r['avg_latency_ms'] || 0)),
        totalInput: Number(r['total_input'] || 0),
        totalOutput: Number(r['total_output'] || 0),
      })));

      // Coverage summary
      const cr = (covRes.result?.records || [])[0];
      if (cr) {
        setCoverage({
          total: Number(cr['total'] || 0),
          withProvider: Number(cr['with_provider'] || 0),
          withTokens: Number(cr['with_tokens'] || 0),
          withAgent: Number(cr['with_agent_name'] || 0),
          withConversation: Number(cr['with_conversation'] || 0),
          withResponseModel: Number(cr['with_response_model'] || 0),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integration health data');
    } finally {
      setLoading(false);
    }
  }, [globalFilters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ============================================
  // Computed KPIs
  // ============================================

  const kpis = useMemo(() => {
    const modelsTracked = report.filter(r => r.model !== '(no model)').length;
    const blindSpots = report.filter(r => r.tokensPct < 50 && r.calls > 10).length;
    const routeCount = routes.reduce((s, r) => s + r.occurrences, 0);
    const avgCompleteness = report.length > 0
      ? Math.round(report.reduce((s, r) => s + r.completeness, 0) / report.length)
      : 0;
    return { modelsTracked, blindSpots, routeCount, avgCompleteness };
  }, [report, routes]);

  // ============================================
  // Auto-generated Recommendations
  // ============================================

  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    // Models with no token data
    const noTokenModels = report.filter(r => r.tokensPct === 0 && r.calls > 10);
    if (noTokenModels.length > 0) {
      const names = noTokenModels.slice(0, 3).map(r => `${r.provider}/${r.model}`).join(', ');
      const extra = noTokenModels.length > 3 ? ` +${noTokenModels.length - 3} more` : '';
      recs.push({
        severity: 'critical',
        title: `${noTokenModels.length} model${noTokenModels.length > 1 ? 's' : ''} report zero token data`,
        detail: `${names}${extra} — ${formatNum(noTokenModels.reduce((s, r) => s + r.calls, 0))} calls with no cost visibility. Add gen_ai.usage.input_tokens and gen_ai.usage.output_tokens to these spans.`,
        attribute: 'gen_ai.usage.input_tokens',
      });
    }

    // Models with no response model (can't detect routing/aliasing)
    const noResponseModel = report.filter(r => r.responseModelPct === 0 && r.calls > 10);
    if (noResponseModel.length > 0) {
      const names = noResponseModel.slice(0, 3).map(r => `${r.provider}/${r.model}`).join(', ');
      recs.push({
        severity: 'warning',
        title: `${noResponseModel.length} model${noResponseModel.length > 1 ? 's' : ''} don't report response model`,
        detail: `${names} — without gen_ai.response.model you can't detect model aliasing, version pinning, or gateway routing.`,
        attribute: 'gen_ai.response.model',
      });
    }

    // No conversation IDs at all
    if (coverage && coverage.withConversation === 0) {
      recs.push({
        severity: 'warning',
        title: 'No session grouping — 0 conversation IDs found',
        detail: `${formatNum(coverage.total)} AI spans have no traceloop.association.properties.conversation_id. Session tracking, multi-turn analysis, and conversation-level cost attribution are impossible without this.`,
        attribute: 'traceloop.association.properties.conversation_id',
      });
    }

    // Significant model routing detected
    if (routes.length > 0) {
      const totalRouted = routes.reduce((s, r) => s + r.occurrences, 0);
      const topRoute = routes[0];
      recs.push({
        severity: 'info',
        title: `${formatNum(totalRouted)} calls routed through ${routes.length} model aliases`,
        detail: `Top route: "${topRoute.requested}" → "${topRoute.actual}" (${formatNum(topRoute.occurrences)} calls). Verify these routes are intentional — this typically indicates an API gateway, proxy, or deployment alias.`,
        attribute: 'gen_ai.request.model / gen_ai.response.model',
      });
    }

    // Low agent identity coverage
    const lowAgentModels = report.filter(r => r.agentPct === 0 && r.calls > 50);
    if (lowAgentModels.length > 3) {
      recs.push({
        severity: 'info',
        title: `${lowAgentModels.length} models have no agent identity`,
        detail: 'Set gen_ai.agent.name to attribute AI calls to specific agents, workflows, or application modules. This enables per-agent cost and performance analysis.',
        attribute: 'gen_ai.agent.name',
      });
    }

    // Framework-only spans (provider set but no model)
    const frameworkSpans = report.filter(r => r.model === '(no model)');
    if (frameworkSpans.length > 0) {
      const total = frameworkSpans.reduce((s, r) => s + r.calls, 0);
      const providers = frameworkSpans.map(r => r.provider).join(', ');
      recs.push({
        severity: 'info',
        title: `${formatNum(total)} framework/orchestration spans detected`,
        detail: `Providers: ${providers}. These spans have gen_ai.provider.name but no model — likely from LangChain, Traceloop, or similar orchestration layers. Consider enriching with gen_ai.request.model for complete attribution.`,
        attribute: 'gen_ai.request.model',
      });
    }

    return recs;
  }, [report, routes, coverage]);

  // ============================================
  // Table Columns
  // ============================================

  const reportColumns = useMemo<DataTableColumnDef<IntegrationRow>[]>(() => [
    {
      id: 'provider', header: 'Provider', accessor: 'provider', width: 110,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontWeight: 600, fontSize: 12 }}>{value as string}</span>
      ),
    },
    {
      id: 'model', header: 'Model', accessor: 'model',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{value as string}</span>
      ),
    },
    {
      id: 'calls', header: 'Calls', accessor: 'calls', width: 80,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontSize: 12, fontWeight: 600 }}>{formatNum(value as number)}</span>
      ),
    },
    {
      id: 'tokensPct', header: 'Tokens', accessor: 'tokensPct', width: 90,
      cell: ({ value }: { value: unknown }) => <AttributeCheck pctValue={value as number} />,
    },
    {
      id: 'responseModelPct', header: 'Resp Model', accessor: 'responseModelPct', width: 100,
      cell: ({ value }: { value: unknown }) => <AttributeCheck pctValue={value as number} />,
    },
    {
      id: 'agentPct', header: 'Agent ID', accessor: 'agentPct', width: 90,
      cell: ({ value }: { value: unknown }) => <AttributeCheck pctValue={value as number} />,
    },
    {
      id: 'errorRate', header: 'Errors', accessor: 'errorRate', width: 75,
      cell: ({ value }: { value: unknown }) => {
        const v = value as number;
        return v > 0
          ? <StatusPill label={`${v}%`} color={Colors.Text.Critical.Default} />
          : <span style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>0%</span>;
      },
    },
    {
      id: 'avgLatencyMs', header: 'Avg Latency', accessor: 'avgLatencyMs', width: 100,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontSize: 12 }}>{formatNum(value as number)} ms</span>
      ),
    },
    {
      id: 'completeness', header: 'Completeness', accessor: 'completeness', width: 130,
      cell: ({ value }: { value: unknown }) => <CompletionBadge value={value as number} />,
    },
  ], []);

  const routeColumns = useMemo<DataTableColumnDef<ModelRoute>[]>(() => [
    {
      id: 'provider', header: 'Provider', accessor: 'provider', width: 110,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontWeight: 600, fontSize: 12 }}>{value as string}</span>
      ),
    },
    {
      id: 'requested', header: 'Requested Model', accessor: 'requested',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value as string}</span>
      ),
    },
    {
      id: 'arrow', header: '', accessor: 'requested', width: 30,
      cell: () => <span style={{ fontSize: 14, color: Colors.Text.Neutral.Subdued }}>→</span>,
    },
    {
      id: 'actual', header: 'Served Model', accessor: 'actual',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: Colors.Text.Warning.Default, fontWeight: 600 }}>
          {value as string}
        </span>
      ),
    },
    {
      id: 'occurrences', header: 'Calls', accessor: 'occurrences', width: 90,
      cell: ({ value }: { value: unknown }) => (
        <StatusPill label={formatNum(value as number)} color={Colors.Text.Warning.Default} />
      ),
    },
    {
      id: 'avgLatencyMs', header: 'Avg Latency', accessor: 'avgLatencyMs', width: 100,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontSize: 12 }}>{formatNum(value as number)} ms</span>
      ),
    },
  ], []);

  // ============================================
  // Render
  // ============================================

  const completenessColor = kpis.avgCompleteness >= 80 ? Colors.Text.Success.Default
    : kpis.avgCompleteness >= 50 ? Colors.Text.Warning.Default
    : Colors.Text.Critical.Default;

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true"><CodeIcon /></TitleBar.Prefix>
        <TitleBar.Title>AI Integration Health</TitleBar.Title>
        <TitleBar.Subtitle>Per-model telemetry completeness, model routing visibility, and actionable instrumentation recommendations</TitleBar.Subtitle>
      </TitleBar>

      {/* Standard FilterBar */}
      <FilterBar
        filters={globalFilters}
        onFiltersChange={setFilters}
        onRefresh={fetchData}
        isLoading={loading}
      />

      {error && (
        <Surface style={{ padding: 12, borderRadius: 6, border: `1px solid ${Colors.Text.Critical.Default}50` }}>
          <Flex alignItems="center" gap={8}>
            <WarningIcon style={{ color: Colors.Text.Critical.Default }} />
            <Text style={{ color: Colors.Text.Critical.Default }}>{error}</Text>
          </Flex>
        </Surface>
      )}

      {/* KPI Row */}
      <Flex gap={12} flexWrap="wrap">
        <Surface style={{ padding: 16, flex: 1, minWidth: 180 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Integration Completeness</Text>
            <Flex alignItems="center" gap={12}>
              <Heading level={2} style={{ margin: 0, color: completenessColor }}>
                {loading ? '—' : `${kpis.avgCompleteness}%`}
              </Heading>
              <Flex flexDirection="column" gap={2}>
                <Text textStyle="small" style={{ color: completenessColor }}>
                  {kpis.avgCompleteness >= 80 ? 'Excellent' : kpis.avgCompleteness >= 60 ? 'Good' : kpis.avgCompleteness >= 40 ? 'Needs Work' : 'Poor'}
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  avg across {kpis.modelsTracked} models
                </Text>
              </Flex>
            </Flex>
            <ProgressBar value={kpis.avgCompleteness} />
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Models Tracked</Text>
            <Heading level={3} style={{ margin: 0 }}>
              {loading ? '—' : kpis.modelsTracked}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {coverage ? `${formatNum(coverage.total)} total AI spans` : ''}
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Telemetry Blind Spots</Text>
            <Heading level={3} style={{ margin: 0, color: kpis.blindSpots > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
              {loading ? '—' : kpis.blindSpots}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              models with &lt;50% token coverage
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Model Routes</Text>
            <Heading level={3} style={{ margin: 0, color: routes.length > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default }}>
              {loading ? '—' : routes.length}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {routes.length > 0 ? `${formatNum(kpis.routeCount)} routed calls` : 'all models served as requested'}
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Tabs */}
      <Flex gap={8}>
        {([
          ['report', `Integration Report (${report.length})`],
          ['routing', `Model Routing (${routes.length})`],
          ['recommendations', `Recommendations (${recommendations.length})`],
        ] as [string, string][]).map(([id, label]) => (
          <Button key={id} variant={activeTab === id ? 'emphasized' : 'default'}
            onClick={() => setActiveTab(id as typeof activeTab)}>{label}</Button>
        ))}
      </Flex>

      {/* Tab: Integration Report */}
      {activeTab === 'report' && (
        <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            <AiIcon style={{ width: 15, height: 15 }} />
            <Heading level={5} style={{ margin: 0 }}>Per-Model Telemetry Completeness</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Green = ≥80% · Yellow = partial · Red = none
            </Text>
          </Flex>
          {loading ? (
            <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
              <ProgressCircle /><Text>Analyzing per-model instrumentation...</Text>
            </Flex>
          ) : report.length === 0 ? (
            <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
              <AiIcon style={{ width: 32, height: 32, color: Colors.Text.Neutral.Subdued }} />
              <Heading level={5}>No AI spans found</Heading>
              <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 400 }}>
                No gen_ai.* spans detected in this timeframe. Ensure your AI services are instrumented with OpenTelemetry gen_ai semantic conventions.
              </Text>
            </Flex>
          ) : (
            <DataTable data={report} columns={reportColumns} fullWidth />
          )}
        </Surface>
      )}

      {/* Tab: Model Routing */}
      {activeTab === 'routing' && (
        <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            <WarningIcon style={{ width: 15, height: 15, color: Colors.Text.Warning.Default }} />
            <Heading level={5} style={{ margin: 0 }}>Model Routing Map</Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Where requested model ≠ served model — reveals gateways, proxies, and aliasing
            </Text>
          </Flex>
          {loading ? (
            <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
              <ProgressCircle /><Text>Scanning model routing patterns...</Text>
            </Flex>
          ) : routes.length === 0 ? (
            <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
              <CheckmarkIcon style={{ width: 32, height: 32, color: Colors.Text.Success.Default }} />
              <Heading level={5} style={{ color: Colors.Text.Success.Default }}>No model routing detected</Heading>
              <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 400 }}>
                All gen_ai.response.model values match gen_ai.request.model — no gateway aliasing or proxy routing detected.
              </Text>
            </Flex>
          ) : (
            <DataTable data={routes} columns={routeColumns} fullWidth />
          )}
        </Surface>
      )}

      {/* Tab: Recommendations */}
      {activeTab === 'recommendations' && (
        <Surface style={{ padding: 24, flex: 1, overflow: 'auto' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <CodeIcon style={{ width: 16, height: 16 }} />
              <Heading level={5} style={{ margin: 0 }}>Actionable Recommendations</Heading>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Auto-generated from your telemetry — prioritized by impact
              </Text>
            </Flex>

            {loading ? (
              <Flex alignItems="center" gap={12}><ProgressCircle /><Text>Generating recommendations...</Text></Flex>
            ) : recommendations.length === 0 ? (
              <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ padding: 48 }} gap={12}>
                <CheckmarkIcon style={{ width: 32, height: 32, color: Colors.Text.Success.Default }} />
                <Heading level={5} style={{ color: Colors.Text.Success.Default }}>All clear</Heading>
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>No instrumentation gaps detected. Your AI telemetry is comprehensive.</Text>
              </Flex>
            ) : (
              <Flex flexDirection="column" gap={12}>
                {recommendations.map((rec, i) => {
                  const severityColors: Record<string, string> = {
                    critical: Colors.Text.Critical.Default,
                    warning: Colors.Text.Warning.Default,
                    info: 'var(--dt-colors-text-primary-default)',
                  };
                  const color = severityColors[rec.severity] || severityColors.info;
                  const severityIcons: Record<string, React.ReactNode> = {
                    critical: <CriticalIcon style={{ width: 16, height: 16, color, flexShrink: 0 }} />,
                    warning: <WarningIcon style={{ width: 16, height: 16, color, flexShrink: 0 }} />,
                    info: <AiIcon style={{ width: 16, height: 16, color, flexShrink: 0 }} />,
                  };
                  return (
                    <Surface key={i} style={{
                      padding: 16, borderRadius: 6,
                      borderLeft: `4px solid ${color}`,
                    }}>
                      <Flex flexDirection="column" gap={6}>
                        <Flex alignItems="center" gap={8}>
                          {severityIcons[rec.severity]}
                          <Text textStyle="base-emphasized" style={{ color }}>{rec.title}</Text>
                          <StatusPill label={rec.severity} color={color} />
                        </Flex>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, lineHeight: '1.5' }}>
                          {rec.detail}
                        </Text>
                        <Tooltip text="OpenTelemetry semantic convention attribute">
                          <span style={{
                            display: 'inline-block', fontFamily: 'monospace', fontSize: 11,
                            padding: '2px 8px', borderRadius: 4,
                            background: 'var(--dt-colors-surface-neutral-subdued)',
                            color: Colors.Text.Neutral.Subdued, alignSelf: 'flex-start',
                          }}>
                            {rec.attribute}
                          </span>
                        </Tooltip>
                      </Flex>
                    </Surface>
                  );
                })}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
}

export default DeveloperExperience;
