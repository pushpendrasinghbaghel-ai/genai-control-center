// DeveloperExperience.tsx — Phase 3.2: AI Developer Experience & Instrumentation Quality
// Surfaces instrumentation coverage, model version mismatches, shadow AI, and source code error attribution

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle, ProgressBar } from '@dynatrace/strato-components/content';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { AiIcon, CodeIcon, WarningIcon, CheckmarkIcon, CriticalIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import {
  INSTRUMENTATION_COVERAGE_QUERY,
  SOURCE_CODE_ERRORS_QUERY,
  TOP_ERROR_FUNCTIONS_QUERY,
  MODEL_VERSION_MISMATCH_QUERY,
  SHADOW_AI_DETECTION_QUERY,
} from '../queries/dql-queries';
import type { QueryFilters } from '../queries/dql-queries';
import { SampleDataBadge } from '../components/SampleDataBadge';

// ============================================
// Types
// ============================================

interface InstrumentationCoverage {
  total: number;
  withProvider: number;
  withTokens: number;
  withAgentName: number;
  withConversation: number;
  withCode: number;
  coverageScore: number;
}

interface SourceCodeError {
  functionName: string;
  fileName: string;
  lineNumber: number;
  errorCount: number;
  errorMessage: string;
  lastSeen: string;
  model: string;
}

interface ModelVersionMismatch {
  service: string;
  requestedModel: string;
  actualModel: string;
  count: number;
  deltaTokens: number;
}

interface ShadowAiService {
  host: string;
  provider: string;
  callCount: number;
  firstSeen: string;
  lastSeen: string;
  isUnknown: boolean;
}

const TIME_OPTIONS = ['1h', '2h', '6h', '24h', '7d'];

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

function CoverageRow({ label, value, total, color }: {
  label: string; value: number; total: number; color?: string;
}) {
  const p = pct(value, total);
  return (
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" justifyContent="space-between">
        <Text textStyle="small">{label}</Text>
        <Text textStyle="small" style={{ color: p >= 80 ? Colors.Text.Success.Default : p >= 50 ? Colors.Text.Warning.Default : Colors.Text.Critical.Default }}>
          {p}% ({formatNum(value)}/{formatNum(total)})
        </Text>
      </Flex>
      <ProgressBar value={p} />
    </Flex>
  );
}

// ============================================
// Main Page
// ============================================

export function DeveloperExperience() {
  const [timeframe, setTimeframe] = useState('2h');
  const [coverage, setCoverage] = useState<InstrumentationCoverage | null>(null);
  const [sourceErrors, setSourceErrors] = useState<SourceCodeError[]>([]);
  const [versionMismatches, setVersionMismatches] = useState<ModelVersionMismatch[]>([]);
  const [shadowAi, setShadowAi] = useState<ShadowAiService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'coverage' | 'errors' | 'mismatches' | 'shadow'>('coverage');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters: QueryFilters = { timeRange: timeframe };

    try {
      const [covRes, errRes, funcRes, verRes, shadowRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: INSTRUMENTATION_COVERAGE_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: SOURCE_CODE_ERRORS_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: TOP_ERROR_FUNCTIONS_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: MODEL_VERSION_MISMATCH_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: SHADOW_AI_DETECTION_QUERY(filters), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      // Coverage
      const cr = (covRes.result?.records || [])[0];
      if (cr) {
        const total = Number(cr['total_spans'] || 0);
        const wProvider = Number(cr['with_provider'] || 0);
        const wTokens = Number(cr['with_tokens'] || 0);
        const wAgent = Number(cr['with_agent_name'] || 0);
        const wConv = Number(cr['with_conversation_id'] || 0);
        const wCode = Number(cr['with_code_location'] || 0);
        const score = total > 0
          ? Math.round((wProvider + wTokens + wAgent + wConv + wCode) / (total * 5) * 100)
          : 0;
        setCoverage({ total, withProvider: wProvider, withTokens: wTokens, withAgentName: wAgent, withConversation: wConv, withCode: wCode, coverageScore: score });
      }

      // Source errors (prefer funcRes if it returns function-level data, else errRes)
      const errRows = [...(funcRes.result?.records || []), ...(errRes.result?.records || [])];
      setSourceErrors(errRows.slice(0, 50).map((r: any) => ({
        functionName: String(r['function_name'] || r['code.function'] || r['exception.type'] || 'unknown'),
        fileName: String(r['file_name'] || r['code.filepath'] || r['code.namespace'] || ''),
        lineNumber: Number(r['line_number'] || r['code.lineno'] || 0),
        errorCount: Number(r['error_count'] || r['count'] || 0),
        errorMessage: String(r['error_message'] || r['exception.message'] || r['status_message'] || ''),
        lastSeen: String(r['last_seen'] || r['max_timestamp'] || ''),
        model: String(r['model'] || r['gen_ai.request.model'] || ''),
      })));

      // Version mismatches
      setVersionMismatches((verRes.result?.records || []).map((r: any) => ({
        service: String(r['service'] || r['service.name'] || 'unknown'),
        requestedModel: String(r['requested_model'] || r['gen_ai.request.model'] || ''),
        actualModel: String(r['actual_model'] || r['gen_ai.response.model'] || ''),
        count: Number(r['count'] || 0),
        deltaTokens: Number(r['delta_tokens'] || 0),
      })));

      // Shadow AI
      setShadowAi((shadowRes.result?.records || []).map((r: any) => ({
        host: String(r['host'] || r['server.address'] || r['net.peer.name'] || 'unknown'),
        provider: String(r['provider'] || r['gen_ai.provider.name'] || 'unknown'),
        callCount: Number(r['call_count'] || r['count'] || 0),
        firstSeen: String(r['first_seen'] || ''),
        lastSeen: String(r['last_seen'] || ''),
        isUnknown: true,
      })));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load developer experience data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Table columns for source errors
  const errorColumns = useMemo<DataTableColumnDef<SourceCodeError>[]>(() => [
    {
      id: 'functionName', header: 'Function', accessor: 'functionName',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{value as string}</span>
      ),
    },
    {
      id: 'fileName', header: 'File', accessor: 'fileName',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: Colors.Text.Neutral.Subdued }}>
          {value as string}
        </span>
      ),
    },
    {
      id: 'lineNumber', header: 'Line', accessor: 'lineNumber', width: 70,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{value as number || '—'}</span>
      ),
    },
    {
      id: 'errorCount', header: 'Errors', accessor: 'errorCount', width: 80,
      cell: ({ value }: { value: unknown }) => (
        <StatusPill label={value as number} color={Colors.Text.Critical.Default} />
      ),
    },
    {
      id: 'errorMessage', header: 'Message', accessor: 'errorMessage',
      cell: ({ value }: { value: unknown }) => {
        const msg = (value as string) || '';
        return (
          <Tooltip text={msg}>
            <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 280 }}>
              {msg.substring(0, 60) + (msg.length > 60 ? '' : '')}
            </span>
          </Tooltip>
        );
      },
    },
    {
      id: 'model', header: 'Model', accessor: 'model', width: 160,
      cell: ({ value }: { value: unknown }) => <span style={{ fontSize: 12 }}>{value as string}</span>,
    },
  ], []);

  // Table columns for version mismatches
  const mismatchColumns = useMemo<DataTableColumnDef<ModelVersionMismatch>[]>(() => [
    {
      id: 'service', header: 'Service', accessor: 'service',
      cell: ({ value }: { value: unknown }) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value as string}</span>,
    },
    {
      id: 'requestedModel', header: 'Requested Model', accessor: 'requestedModel',
      cell: ({ value }: { value: unknown }) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value as string}</span>,
    },
    {
      id: 'actualModel', header: 'Actual Model', accessor: 'actualModel',
      cell: ({ value }: { value: unknown }) => (
        <Flex alignItems="center" gap={4}>
          <WarningIcon style={{ width: 12, height: 12, color: Colors.Text.Warning.Default }} />
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: Colors.Text.Warning.Default }}>{value as string}</span>
        </Flex>
      ),
    },
    {
      id: 'count', header: 'Occurrences', accessor: 'count', width: 110,
      cell: ({ value }: { value: unknown }) => <StatusPill label={value as number} color={Colors.Text.Warning.Default} />,
    },
  ], []);

  // Table columns for shadow AI
  const shadowColumns = useMemo<DataTableColumnDef<ShadowAiService>[]>(() => [
    {
      id: 'host', header: 'Host / Endpoint', accessor: 'host',
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value as string}</span>
      ),
    },
    {
      id: 'provider', header: 'Provider', accessor: 'provider',
      cell: ({ value }: { value: unknown }) => <span>{value as string}</span>,
    },
    {
      id: 'callCount', header: 'Calls', accessor: 'callCount', width: 90,
      cell: ({ value }: { value: unknown }) => (
        <StatusPill label={value as number} color={Colors.Text.Critical.Default} />
      ),
    },
    {
      id: 'lastSeen', header: 'Last Seen', accessor: 'lastSeen', width: 160,
      cell: ({ value }: { value: unknown }) => (
        <span style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{value as string}</span>
      ),
    },
  ], []);

  const overallScore = coverage?.coverageScore ?? 0;
  const scoreColor = overallScore >= 80 ? Colors.Text.Success.Default
    : overallScore >= 50 ? Colors.Text.Warning.Default
    : Colors.Text.Critical.Default;

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true"><CodeIcon /></TitleBar.Prefix>
        <TitleBar.Title>Developer Experience</TitleBar.Title>
        <TitleBar.Subtitle>AI instrumentation quality, source code error attribution, model version governance &amp; shadow AI detection</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <SampleDataBadge />
            {TIME_OPTIONS.map(t => (
              <Button key={t} variant={timeframe === t ? 'emphasized' : 'default'}
                onClick={() => setTimeframe(t)} style={{ padding: '4px 10px', fontSize: 12 }}>{t}</Button>
            ))}
            <Button onClick={fetchData} disabled={loading}>
              {loading ? <ProgressCircle size="small" /> : 'Refresh'}
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

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
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Instrumentation Score</Text>
            <Flex alignItems="center" gap={12}>
              <Heading level={2} style={{ margin: 0, color: scoreColor }}>{overallScore}%</Heading>
              <Flex flexDirection="column" gap={2}>
                <Text textStyle="small" style={{ color: overallScore >= 80 ? Colors.Text.Success.Default : Colors.Text.Warning.Default }}>
                  {overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Needs Work' : 'Poor'}
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>{formatNum(coverage?.total ?? 0)} total spans</Text>
              </Flex>
            </Flex>
            <ProgressBar value={overallScore} />
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Source Code Errors</Text>
            <Heading level={3} style={{ margin: 0, color: sourceErrors.length > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
              {loading ? '' : formatNum(sourceErrors.reduce((s, e) => s + e.errorCount, 0))}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>across {sourceErrors.length} functions</Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Model Mismatches</Text>
            <Heading level={3} style={{ margin: 0, color: versionMismatches.length > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default }}>
              {loading ? '' : versionMismatches.length}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>requested  served version</Text>
          </Flex>
        </Surface>

        <Surface style={{ padding: 16, flex: 1, minWidth: 150 }}>
          <Flex flexDirection="column" gap={6}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Shadow AI Services</Text>
            <Heading level={3} style={{ margin: 0, color: shadowAi.length > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
              {loading ? '' : shadowAi.length}
            </Heading>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>ungoverned AI endpoints</Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Alerts */}
      {shadowAi.length > 0 && (
        <Surface style={{ padding: 12, borderRadius: 6, background: Colors.Text.Critical.Default + '12', border: `1px solid ${Colors.Text.Critical.Default}50` }}>
          <Flex alignItems="center" gap={8}>
            <CriticalIcon style={{ color: Colors.Text.Critical.Default, width: 16, height: 16 }} />
            <Flex flexDirection="column" gap={2}>
              <Text textStyle="base-emphasized" style={{ color: Colors.Text.Critical.Default }}>
                {shadowAi.length} Ungoverned AI Endpoint{shadowAi.length > 1 ? 's' : ''} Detected
              </Text>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                AI calls observed to endpoints outside approved provider list. Review shadow AI tab for details.
              </Text>
            </Flex>
          </Flex>
        </Surface>
      )}

      {/* Tabs */}
      <Flex gap={8}>
        {([
          ['coverage', 'Instrumentation Coverage'],
          ['errors', `Source Code Errors (${sourceErrors.length})`],
          ['mismatches', `Model Mismatches (${versionMismatches.length})`],
          ['shadow', `Shadow AI (${shadowAi.length})`],
        ] as [string, string][]).map(([id, label]) => (
          <Button key={id} variant={activeTab === id ? 'emphasized' : 'default'}
            onClick={() => setActiveTab(id as typeof activeTab)}>{label}</Button>
        ))}
      </Flex>

      {/* Tab Panels */}
      {activeTab === 'coverage' && (
        <Surface style={{ padding: 24, flex: 1, overflow: 'auto' }}>
          <Flex flexDirection="column" gap={16}>
            <Flex alignItems="center" gap={8}>
              <AiIcon style={{ width: 16, height: 16 }} />
              <Heading level={5} style={{ margin: 0 }}>Span Attribute Coverage</Heading>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                ({formatNum(coverage?.total ?? 0)} total spans in last {timeframe})
              </Text>
            </Flex>
            {loading ? (
              <Flex alignItems="center" gap={12}><ProgressCircle /><Text>Analyzing instrumentation...</Text></Flex>
            ) : coverage ? (
              <Flex flexDirection="column" gap={12} style={{ maxWidth: 640 }}>
                <CoverageRow label="Provider Attribution (gen_ai.provider.name)" value={coverage.withProvider} total={coverage.total} />
                <CoverageRow label="Token Reporting (gen_ai.usage.*)" value={coverage.withTokens} total={coverage.total} />
                <CoverageRow label="Agent Identity (traceloop.entity.name)" value={coverage.withAgentName} total={coverage.total} />
                <CoverageRow label="Session Grouping (conversation_id)" value={coverage.withConversation} total={coverage.total} />
                <CoverageRow label="Code Location (code.function / code.filepath)" value={coverage.withCode} total={coverage.total} />
              </Flex>
            ) : (
              <Flex alignItems="center" justifyContent="center" style={{ padding: 48 }} gap={12}>
                <CheckmarkIcon style={{ color: Colors.Text.Success.Default, width: 24, height: 24 }} />
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>No span data found for this timeframe.</Text>
              </Flex>
            )}

            {coverage && (
              <Surface style={{ padding: 16, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 6, maxWidth: 640, marginTop: 8 }}>
                <Flex flexDirection="column" gap={8}>
                  <Heading level={6} style={{ margin: 0 }}>How to Improve Your Score</Heading>
                  {pct(coverage.withProvider, coverage.total) < 80 && (
                    <Text textStyle="small"> Add <code>gen_ai.provider.name</code> attribute to all LLM spans (e.g. <code>"azure_openai"</code>)</Text>
                  )}
                  {pct(coverage.withTokens, coverage.total) < 80 && (
                    <Text textStyle="small"> Enable token counting in your SDK — set <code>gen_ai.usage.input_tokens</code> and <code>gen_ai.usage.output_tokens</code></Text>
                  )}
                  {pct(coverage.withAgentName, coverage.total) < 80 && (
                    <Text textStyle="small"> Set <code>traceloop.entity.name</code> to identify which agent generated each span</Text>
                  )}
                  {pct(coverage.withConversation, coverage.total) < 80 && (
                    <Text textStyle="small"> Pass <code>traceloop.association.properties.conversation_id</code> to enable session grouping</Text>
                  )}
                  {pct(coverage.withCode, coverage.total) < 80 && (
                    <Text textStyle="small"> Ensure <code>code.function</code> and <code>code.filepath</code> are captured in exception spans</Text>
                  )}
                </Flex>
              </Surface>
            )}
          </Flex>
        </Surface>
      )}

      {activeTab === 'errors' && (
        <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            <CodeIcon style={{ width: 15, height: 15 }} />
            <Heading level={5} style={{ margin: 0 }}>Source Code Error Attribution</Heading>
            <StatusPill label={sourceErrors.length} color={Colors.Text.Critical.Default} />
          </Flex>
          {loading ? (
            <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
              <ProgressCircle /><Text>Loading error data...</Text>
            </Flex>
          ) : sourceErrors.length === 0 ? (
            <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
              <CheckmarkIcon style={{ width: 32, height: 32, color: Colors.Text.Success.Default }} />
              <Heading level={5} style={{ color: Colors.Text.Success.Default }}>No source code errors detected</Heading>
              <Text style={{ color: Colors.Text.Neutral.Subdued, textAlign: 'center', maxWidth: 400 }}>
                No exception spans with code location found. Ensure exception tracking is enabled.
              </Text>
            </Flex>
          ) : (
            <DataTable data={sourceErrors} columns={errorColumns} fullWidth />
          )}
        </Surface>
      )}

      {activeTab === 'mismatches' && (
        <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            <WarningIcon style={{ width: 15, height: 15, color: Colors.Text.Warning.Default }} />
            <Heading level={5} style={{ margin: 0 }}>Model Version Governance</Heading>
            <StatusPill label={versionMismatches.length} color={Colors.Text.Warning.Default} />
          </Flex>
          {loading ? (
            <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
              <ProgressCircle /><Text>Checking model versions...</Text>
            </Flex>
          ) : versionMismatches.length === 0 ? (
            <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
              <CheckmarkIcon style={{ width: 32, height: 32, color: Colors.Text.Success.Default }} />
              <Heading level={5} style={{ color: Colors.Text.Success.Default }}>No model version mismatches</Heading>
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                All observed model versions match expected configurations.
              </Text>
            </Flex>
          ) : (
            <DataTable data={versionMismatches} columns={mismatchColumns} fullWidth />
          )}
        </Surface>
      )}

      {activeTab === 'shadow' && (
        <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            <CriticalIcon style={{ width: 15, height: 15, color: Colors.Text.Critical.Default }} />
            <Heading level={5} style={{ margin: 0 }}>Shadow AI Detection</Heading>
            <StatusPill label={shadowAi.length} color={Colors.Text.Critical.Default} />
          </Flex>
          <Text textStyle="small" style={{ padding: '8px 16px', color: Colors.Text.Neutral.Subdued, borderBottom: '1px solid var(--dt-colors-border-neutral-default)', flexShrink: 0 }}>
            AI service endpoints detected outside of your approved provider list. Ensure all AI usage is governed and compliant.
          </Text>
          {loading ? (
            <Flex alignItems="center" justifyContent="center" style={{ flex: 1 }} gap={12}>
              <ProgressCircle /><Text>Scanning for shadow AI...</Text>
            </Flex>
          ) : shadowAi.length === 0 ? (
            <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ flex: 1, padding: 32 }} gap={12}>
              <CheckmarkIcon style={{ width: 32, height: 32, color: Colors.Text.Success.Default }} />
              <Heading level={5} style={{ color: Colors.Text.Success.Default }}>No shadow AI detected</Heading>
              <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                All observed AI endpoints are within approved providers.
              </Text>
            </Flex>
          ) : (
            <DataTable data={shadowAi} columns={shadowColumns} fullWidth />
          )}
        </Surface>
      )}
    </Flex>
  );
}

export default DeveloperExperience;
