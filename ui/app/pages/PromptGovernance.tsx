// GenAI Control Center - Prompt Governance Page
// Dedicated page for prompt analysis, PII detection, injection risks, and Davis AI scoring

import React, { useState, useMemo, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components-preview/overlays';
import { 
  RefreshIcon, 
  LockIcon, 
  WarningIcon,
  CheckmarkIcon, 
  HelpIcon, 
  InformationIcon, 
  ExternalLinkIcon,
  ResearchIcon,
  CriticalIcon
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { getIntentLink } from '@dynatrace-sdk/navigation';

import { FilterBar } from '../components';
import { useGlobalFilters } from '../context';
import { usePromptAnalysis, useGenAIErrors, AnalyzedPrompt, GenAIError, PromptFlag, QueryFilters } from '../hooks/useDQLQueries';
import { useDavisPromptScoring, DavisPromptScore } from '../hooks/useDavisAI';
import { useDistinctServices, useDistinctProviders, useDistinctModels } from '../hooks/useDQLQueries';

// Status colors matching Dynatrace design system
const STATUS_COLORS = {
  excellent: Colors.Charts.Apdex.Excellent.Default,
  good: Colors.Charts.Apdex.Good.Default,
  fair: Colors.Charts.Apdex.Fair.Default,
  poor: Colors.Charts.Apdex.Poor.Default,
};

// Tooltips for governance metrics
const GOVERNANCE_TOOLTIPS = {
  pii: 'Prompts containing potential PII (emails, phone numbers, SSN patterns, credit cards)',
  injection: 'Prompts with patterns suggesting injection attacks (e.g., "ignore previous instructions")',
  expensive: 'Prompts with high token costs (>$0.10 estimated cost)',
  repetitive: 'Identical prompts sent 15+ times - cache candidates',
  hallucination: 'Responses flagged for potential factual inaccuracies',
  error: 'Prompts that resulted in API errors',
  davisAI: 'Use Dynatrace Intelligence to perform advanced semantic analysis on prompts for nuanced risk detection'
};

/**
 * Navigate to Distributed Traces app for a specific trace
 */
const openTraceInDistributedTraces = (traceId: string, timestamp: string): void => {
  const timeDate = new Date(timestamp);
  const startTime = new Date(timeDate.getTime() - 10 * 60 * 1000).toISOString();
  const endTime = new Date(timeDate.getTime() + 10 * 60 * 1000).toISOString();

  const intentUrl = getIntentLink(
    { 
      'trace_id': traceId,
      'dt.timeframe': { from: startTime, to: endTime }
    },
    'dynatrace.distributedtracing',
    'view-trace'
  );
  
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

// ============================================
// Prompt Detail Modal
// ============================================

interface PromptDetailModalProps {
  prompt: AnalyzedPrompt;
  davisScore?: DavisPromptScore;
  onClose: () => void;
}

function PromptDetailModal({ prompt, davisScore, onClose }: PromptDetailModalProps) {
  const hasHallucination = prompt.flags.some(f => f.type === 'hallucination');
  
  return (
    <Modal title="Prompt Analysis Detail" show={true} onDismiss={onClose} size="large">
      <Flex flexDirection="column" gap={20} style={{ maxHeight: '80vh', overflow: 'auto', padding: '16px' }}>
        {/* Header Info */}
        <Flex justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={16}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="base-emphasized">{prompt.serviceName}</Text>
            <Text textStyle="small" style={{ opacity: 0.7 }}>{prompt.model} • {prompt.provider}</Text>
            <Text textStyle="small" style={{ opacity: 0.5 }}>{new Date(prompt.timestamp).toLocaleString()}</Text>
          </Flex>
          {prompt.traceId && (
            <Button onClick={() => openTraceInDistributedTraces(prompt.traceId, prompt.timestamp)}>
              <ExternalLinkIcon /> View Distributed Trace
            </Button>
          )}
        </Flex>

        {/* Dynatrace Intelligence Analysis */}
        {davisScore && (
          <Surface style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <InformationIcon />
                <Text textStyle="base-emphasized">Dynatrace Intelligence Analysis</Text>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: davisScore.riskScore >= 70 ? STATUS_COLORS.poor : 
                                   davisScore.riskScore >= 40 ? STATUS_COLORS.fair : STATUS_COLORS.excellent,
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  Risk: {davisScore.riskScore}/100
                </span>
              </Flex>
              <Text>{davisScore.explanation}</Text>
              {davisScore.recommendations && davisScore.recommendations.length > 0 && (
                <Flex flexDirection="column" gap={4}>
                  <Text textStyle="small-emphasized">Recommendations:</Text>
                  <Flex gap={8} flexWrap="wrap">
                    {davisScore.recommendations.map((rec, idx) => (
                      <span key={idx} style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: STATUS_COLORS.fair,
                        color: 'white',
                        fontSize: '11px'
                      }}>
                        {rec}
                      </span>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Flex>
          </Surface>
        )}

        {/* Detected Flags - ONE badge per category */}
        {prompt.flags.length > 0 && (
          <Flex flexDirection="column" gap={12}>
            <Text textStyle="base-emphasized">Pattern-based Flags</Text>
            <Flex gap={8} flexWrap="wrap">
              {/* Deduplicate flags by type, show one badge per category */}
              {(() => {
                const seenTypes = new Set<string>();
                return prompt.flags.filter(flag => {
                  if (seenTypes.has(flag.type)) return false;
                  seenTypes.add(flag.type);
                  return true;
                }).map((flag, idx) => {
                  const countOfType = prompt.flags.filter(f => f.type === flag.type).length;
                  return (
                    <Tooltip key={idx} text={flag.detail}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        backgroundColor: flag.severity === 'critical' ? STATUS_COLORS.poor :
                                         flag.severity === 'high' ? STATUS_COLORS.poor :
                                         flag.severity === 'medium' ? STATUS_COLORS.fair : STATUS_COLORS.good,
                        color: 'white',
                        fontSize: '12px',
                        textTransform: 'uppercase'
                      }}>
                        {flag.type}{countOfType > 1 ? ` (${countOfType})` : ''}
                      </span>
                    </Tooltip>
                  );
                });
              })()}
            </Flex>
            
            {/* Detailed Detection Legend */}
            <Surface style={{ 
              padding: '16px', 
              backgroundColor: 'rgba(0,0,0,0.03)',
              borderLeft: '4px solid rgba(100,100,100,0.3)'
            }}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <ResearchIcon />
                  <Text textStyle="base-emphasized">Detection Details</Text>
                </Flex>
                <Flex flexDirection="column" gap={8}>
                  {/* Group and explain each flag type */}
                  {(() => {
                    const flagsByType = prompt.flags.reduce((acc, flag) => {
                      if (!acc[flag.type]) acc[flag.type] = [];
                      acc[flag.type].push(flag);
                      return acc;
                    }, {} as Record<string, typeof prompt.flags>);
                    
                    return Object.entries(flagsByType).map(([type, flags]) => (
                      <Flex key={type} flexDirection="column" gap={4}>
                        <Flex alignItems="center" gap={8}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: flags[0].severity === 'critical' ? STATUS_COLORS.poor :
                                             flags[0].severity === 'high' ? STATUS_COLORS.poor :
                                             flags[0].severity === 'medium' ? STATUS_COLORS.fair : STATUS_COLORS.good,
                            color: 'white',
                            fontSize: '10px',
                            textTransform: 'uppercase'
                          }}>
                            {type}
                          </span>
                          <Text textStyle="small-emphasized" style={{ textTransform: 'capitalize' }}>
                            {type.replace(/_/g, ' ')} ({flags.length} detection{flags.length > 1 ? 's' : ''})
                          </Text>
                        </Flex>
                        <Flex flexDirection="column" gap={2} style={{ marginLeft: 16 }}>
                          {flags.map((flag, idx) => (
                            <Flex key={idx} flexDirection="column" gap={2}>
                              <Text textStyle="small" style={{ color: 'rgba(0,0,0,0.7)' }}>
                                • <strong style={{ 
                                    color: flag.severity === 'critical' ? STATUS_COLORS.poor : 
                                           flag.severity === 'high' ? STATUS_COLORS.poor : 
                                           'inherit' 
                                  }}>
                                  [{flag.severity.toUpperCase()}]
                                </strong> {flag.detail}
                              </Text>
                              {flag.metadata && (
                                <Text textStyle="small" style={{ color: 'rgba(0,0,0,0.5)', marginLeft: 16, fontStyle: 'italic' }}>
                                  {flag.metadata.detectionMethod && (
                                    <>Detection: {flag.metadata.detectionMethod.replace(/_/g, ' ')}</>
                                  )}
                                  {flag.metadata.confidence && (
                                    <> • Confidence: {Math.round(flag.metadata.confidence * 100)}%</>
                                  )}
                                  {flag.metadata.groundingScore !== undefined && flag.metadata.groundingScore >= 0 && (
                                    <> • Grounding: {flag.metadata.groundingScore}%</>
                                  )}
                                </Text>
                              )}
                            </Flex>
                          ))}
                        </Flex>
                      </Flex>
                    ));
                  })()}
                </Flex>
              </Flex>
            </Surface>
          </Flex>
        )}

        {/* Full Prompt Content */}
        <Flex flexDirection="column" gap={8}>
          <Text textStyle="base-emphasized">Full Prompt</Text>
          <Surface style={{ 
            padding: '16px', 
            backgroundColor: 'rgba(0,0,0,0.03)',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <pre style={{ 
              margin: 0, 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: '13px'
            }}>
              {prompt.fullPrompt || prompt.promptPreview}
            </pre>
          </Surface>
        </Flex>

        {/* Full Response Content (if available) */}
        {(prompt.fullCompletion || prompt.completionPreview) && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={8}>
              <Text textStyle="base-emphasized">Model Response</Text>
              {hasHallucination && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'orange',
                  color: 'white',
                  fontSize: '11px'
                }}>
                  ⚠️ Potential Hallucination
                </span>
              )}
            </Flex>
            <Surface style={{ 
              padding: '16px', 
              backgroundColor: hasHallucination ? 'rgba(255,165,0,0.1)' : 'rgba(0,0,0,0.03)',
              maxHeight: '300px',
              overflow: 'auto',
              border: hasHallucination ? '2px solid orange' : 'none'
            }}>
              <pre style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}>
                {prompt.fullCompletion || prompt.completionPreview}
              </pre>
            </Surface>
          </Flex>
        )}

        {/* Metrics */}
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: '12px', flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Input Tokens</Text>
              <Text textStyle="base-emphasized">{prompt.inputTokens.toLocaleString()}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '12px', flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Output Tokens</Text>
              <Text textStyle="base-emphasized">{prompt.outputTokens.toLocaleString()}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '12px', flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Est. Cost</Text>
              <Text textStyle="base-emphasized">${prompt.totalCost?.toFixed(4) || 'N/A'}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: '12px', flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text textStyle="small" style={{ opacity: 0.7 }}>Latency</Text>
              <Text textStyle="base-emphasized">{prompt.latencyMs?.toFixed(0) || 'N/A'}ms</Text>
            </Flex>
          </Surface>
          {prompt.requestCount && prompt.requestCount > 1 && (
            <Surface style={{ padding: '12px', flex: '1 1 120px' }}>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ opacity: 0.7 }}>Repeat Count</Text>
                <Text textStyle="base-emphasized" style={{ color: STATUS_COLORS.excellent }}>
                  {prompt.requestCount}x
                </Text>
              </Flex>
            </Surface>
          )}
        </Flex>

        {/* IDs for debugging */}
        <Flex flexDirection="column" gap={4}>
          <Text textStyle="small" style={{ opacity: 0.5 }}>
            Trace ID: {prompt.traceId || 'N/A'}
          </Text>
          <Text textStyle="small" style={{ opacity: 0.5 }}>
            Span ID: {prompt.spanId || 'N/A'}
          </Text>
        </Flex>
      </Flex>
    </Modal>
  );
}

// ============================================
// Prompt Governance Card
// ============================================

interface PromptGovernanceCardProps {
  prompt: AnalyzedPrompt;
  davisScore?: DavisPromptScore;
  onViewDetail: (prompt: AnalyzedPrompt) => void;
}

function PromptGovernanceCard({ prompt, davisScore, onViewDetail }: PromptGovernanceCardProps) {
  const hasHallucinationFlag = prompt.flags.some(f => f.type === 'hallucination');
  const hasResponse = !!prompt.completionPreview;
  
  // Deduplicate flags by type and count occurrences
  const flagCountByType = prompt.flags.reduce((acc, flag) => {
    acc[flag.type] = (acc[flag.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const uniqueFlagTypes = Object.keys(flagCountByType);
  const uniqueFlags = uniqueFlagTypes.map(type => ({
    ...prompt.flags.find(f => f.type === type)!,
    count: flagCountByType[type]
  }));
  
  return (
    <Surface style={{ padding: '16px' }}>
      <Flex flexDirection="column" gap={12}>
        {/* Header Row */}
        <Flex justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={8}>
          <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
            <Text textStyle="base-emphasized">{prompt.serviceName}</Text>
            <Text textStyle="small" style={{ opacity: 0.7 }}>{prompt.model} • {prompt.provider}</Text>
          </Flex>
          
          <Flex gap={8} alignItems="center" flexWrap="wrap">
            {/* Flags - One badge per category with count */}
            {uniqueFlags.slice(0, 4).map((flag, idx) => (
              <Tooltip key={idx} text={`${flag.detail}${flag.count > 1 ? ` (${flag.count} detections)` : ''}`}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: flag.severity === 'critical' ? STATUS_COLORS.poor :
                                   flag.severity === 'high' ? STATUS_COLORS.poor :
                                   flag.severity === 'medium' ? STATUS_COLORS.fair : STATUS_COLORS.good,
                  color: 'white',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  cursor: 'help'
                }}>
                  {flag.type}{flag.count > 1 ? ` (${flag.count})` : ''}
                </span>
              </Tooltip>
            ))}
            {uniqueFlags.length > 4 && (
              <Text textStyle="small" style={{ opacity: 0.7 }}>+{uniqueFlags.length - 4}</Text>
            )}
            
            {/* Davis Score */}
            {davisScore && (
              <Tooltip text={`Dynatrace Intelligence Risk: ${davisScore.explanation}`}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: davisScore.riskScore >= 70 ? STATUS_COLORS.poor : 
                                   davisScore.riskScore >= 40 ? STATUS_COLORS.fair : STATUS_COLORS.excellent,
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'help'
                }}>
                  AI: {davisScore.riskScore}
                </span>
              </Tooltip>
            )}
            
            {/* Request count */}
            {prompt.requestCount && prompt.requestCount > 1 && (
              <Text textStyle="small" style={{ opacity: 0.7 }}>
                {prompt.requestCount}x
              </Text>
            )}
            
            {/* Detail Button */}
            <Button variant="default" onClick={() => onViewDetail(prompt)}>
              <ResearchIcon /> Detail
            </Button>
            
            {/* Trace Link */}
            {prompt.traceId && (
              <Tooltip text={`Open trace: ${prompt.traceId}`}>
                <Button 
                  variant="default"
                  onClick={() => openTraceInDistributedTraces(prompt.traceId, prompt.timestamp)}
                >
                  <ExternalLinkIcon /> Trace
                </Button>
              </Tooltip>
            )}
          </Flex>
        </Flex>

        {/* Prompt Preview */}
        <div 
          style={{ 
            padding: '8px 12px', 
            backgroundColor: 'rgba(0,0,0,0.03)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '60px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'pointer'
          }} 
          onClick={() => onViewDetail(prompt)}
        >
          {prompt.promptPreview.substring(0, 200)}{prompt.promptPreview.length > 200 ? '...' : ''}
        </div>

        {/* Response Preview for hallucination review */}
        {hasResponse && hasHallucinationFlag && (
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: 'rgba(255,165,0,0.1)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            maxHeight: '50px',
            overflow: 'hidden',
            border: '1px solid orange'
          }}>
            <Text textStyle="small" style={{ color: 'orange', marginBottom: '4px' }}>
              ⚠️ Response (potential hallucination):
            </Text>
            {prompt.completionPreview?.substring(0, 150)}...
          </div>
        )}

        {/* Timestamp */}
        <Flex justifyContent="flex-end">
          <Text textStyle="small" style={{ opacity: 0.5, fontSize: '10px' }}>
            {new Date(prompt.timestamp).toLocaleTimeString()}
          </Text>
        </Flex>
      </Flex>
    </Surface>
  );
}

// ============================================
// Main Prompt Governance Page
// ============================================

export function PromptGovernance() {
  // Use global filter context (same as other pages)
  const { filters: globalFilters, setFilters: setGlobalFilters } = useGlobalFilters();
  
  // Get available filter options for FilterBar
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();
  
  // Convert global FilterOptions to QueryFilters for hooks
  const queryFilters = useMemo<QueryFilters>(() => ({
    timeframe: globalFilters.timeframe,
    serviceName: globalFilters.serviceFilter || undefined,
    provider: globalFilters.providerFilter || undefined,
    model: globalFilters.modelFilter || undefined
  }), [globalFilters]);

  // Fetch prompts with applied filters
  const { data: promptsRaw, loading: promptsLoading, error: promptsError, refetch: refetchPrompts } = usePromptAnalysis(queryFilters);
  const prompts = promptsRaw || [];
  
  // Fetch GenAI errors separately (these are error spans that may not have prompt content)
  const { data: genaiErrors, loading: errorsLoading, refetch: refetchErrors } = useGenAIErrors(queryFilters);

  // Davis AI scoring
  const { 
    scores: davisScores, 
    isLoading: davisLoading, 
    scorePromptBatch, 
    progress: davisProgress 
  } = useDavisPromptScoring();
  const [davisScored, setDavisScored] = useState(false);

  // Local UI state
  const [governanceFilter, setGovernanceFilter] = useState<'all' | 'pii' | 'injection' | 'expensive' | 'repetitive' | 'hallucination' | 'error'>('all');
  const [detailPrompt, setDetailPrompt] = useState<AnalyzedPrompt | null>(null);
  const [detailError, setDetailError] = useState<GenAIError | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Davis score map for quick lookup
  const davisScoreMap = useMemo(() => {
    const map = new Map<string, DavisPromptScore>();
    davisScores.forEach(score => map.set(score.promptId, score));
    return map;
  }, [davisScores]);

  // Filter prompts by flag type and search query
  const filteredPrompts = useMemo(() => {
    let filtered = prompts;
    
    // Filter by flag type (except 'error' which uses separate data)
    if (governanceFilter !== 'all' && governanceFilter !== 'error') {
      filtered = filtered.filter(p => p.flags.some(f => f.type === governanceFilter));
    }
    
    // For hallucination filter, deduplicate by prompt content to show only unique prompts
    if (governanceFilter === 'hallucination') {
      const seenPrompts = new Set<string>();
      filtered = filtered.filter(p => {
        const promptKey = p.promptPreview.trim().toLowerCase();
        if (seenPrompts.has(promptKey)) {
          return false;
        }
        seenPrompts.add(promptKey);
        return true;
      });
    }
    
    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.promptPreview.toLowerCase().includes(query) ||
        (p.completionPreview && p.completionPreview.toLowerCase().includes(query)) ||
        p.serviceName.toLowerCase().includes(query) ||
        p.model.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [prompts, governanceFilter, searchQuery]);
  
  // Filter errors by search query
  const filteredErrors = useMemo(() => {
    if (!genaiErrors) return [];
    if (!searchQuery.trim()) return genaiErrors;
    
    const query = searchQuery.toLowerCase();
    return genaiErrors.filter(e => 
      e.serviceName.toLowerCase().includes(query) ||
      e.model.toLowerCase().includes(query) ||
      e.provider.toLowerCase().includes(query) ||
      e.spanName.toLowerCase().includes(query) ||
      e.traceId.toLowerCase().includes(query)
    );
  }, [genaiErrors, searchQuery]);

  // Calculate governance stats - use actual error count from errors query
  // For hallucination, count unique prompts only
  const governanceStats = useMemo(() => {
    const hallucinationPrompts = prompts.filter(p => p.flags.some(f => f.type === 'hallucination'));
    const uniqueHallucinationPrompts = new Set(hallucinationPrompts.map(p => p.promptPreview.trim().toLowerCase()));
    
    return {
      total: prompts.length,
      withFlags: prompts.filter(p => p.flags.length > 0).length,
      pii: prompts.filter(p => p.flags.some(f => f.type === 'pii')).length,
      injection: prompts.filter(p => p.flags.some(f => f.type === 'injection')).length,
      expensive: prompts.filter(p => p.flags.some(f => f.type === 'expensive')).length,
      repetitive: prompts.filter(p => p.flags.some(f => f.type === 'repetitive')).length,
      hallucination: uniqueHallucinationPrompts.size,  // Count unique prompts only
      error: genaiErrors?.length || 0,  // Use actual error spans count
      critical: prompts.filter(p => p.flags.some(f => f.severity === 'critical')).length,
    };
  }, [prompts, genaiErrors]);

  // Run Davis AI scoring
  const runDavisScoring = async () => {
    if (prompts.length === 0) return;
    
    const promptsToScore = prompts.slice(0, 50).map(p => ({
      id: p.id,
      content: p.promptPreview,
      completion: p.completionPreview,
      serviceName: p.serviceName,
      model: p.model,
      provider: p.provider
    }));
    
    await scorePromptBatch(promptsToScore);
    setDavisScored(true);
  };

  // ─── Prompt Pattern Analysis (Phase 1.3) ───
  // Top repeated patterns ranked by count × avg cost, with token efficiency score
  const patternInsights = useMemo(() => {
    return [...prompts]
      .filter(p => (p.requestCount ?? 1) > 1 || (p.inputTokens + p.outputTokens) > 100)
      .sort((a, b) => (b.requestCount ?? 1) - (a.requestCount ?? 1))
      .slice(0, 12)
      .map(p => {
        const totalTokens = p.inputTokens + p.outputTokens;
        const efficiency = totalTokens > 0 ? Math.round((p.outputTokens / totalTokens) * 100) : 0;
        const costPerCall = (p.requestCount ?? 1) > 0 ? p.totalCost / (p.requestCount ?? 1) : 0;
        const cacheSaving = ((p.requestCount ?? 1) - 1) * costPerCall;
        return {
          id: p.id,
          preview: p.promptPreview.slice(0, 90) + (p.promptPreview.length > 90 ? '…' : ''),
          serviceName: p.serviceName,
          model: p.model,
          count: p.requestCount ?? 1,
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          efficiency,
          avgLatencyMs: p.latencyMs,
          totalCost: p.totalCost,
          cacheSaving,
          hasPii: p.flags.some(f => f.type === 'pii'),
          hasInjection: p.flags.some(f => f.type === 'injection'),
        };
      });
  }, [prompts]);

  const handleRefresh = useCallback(() => {
    refetchPrompts();
    refetchErrors();
  }, [refetchPrompts]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Title>Prompt Governance</TitleBar.Title>
        <TitleBar.Subtitle>
          PII detection, injection risk analysis, and Dynatrace Intelligence prompt scoring
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <Button onClick={handleRefresh} aria-label="Refresh">
              <RefreshIcon /> Refresh
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Standard FilterBar (same as other pages) */}
      <FilterBar
        filters={globalFilters}
        onFiltersChange={setGlobalFilters}
        onRefresh={handleRefresh}
        isLoading={promptsLoading}
        availableServices={availableServiceOptions || undefined}
        availableProviders={availableProviders || undefined}
        availableModels={availableModels || undefined}
      />

      {promptsError && (
        <Surface style={{ padding: '16px', backgroundColor: STATUS_COLORS.poor }}>
          <Text style={{ color: 'white' }}>Error loading prompts: {promptsError.message}</Text>
        </Surface>
      )}

      {/* Detail Modal */}
      {detailPrompt && (
        <PromptDetailModal
          prompt={detailPrompt}
          davisScore={davisScoreMap.get(detailPrompt.id)}
          onClose={() => setDetailPrompt(null)}
        />
      )}

      {/* Stats Summary */}
      <Flex gap={16} flexWrap="wrap">
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ opacity: 0.7 }}>Total Prompts</Text>
            <Heading level={3}>{governanceStats.total}</Heading>
            {filteredPrompts.length !== governanceStats.total && (
              <Text textStyle="small" style={{ color: STATUS_COLORS.fair }}>
                ({filteredPrompts.length} shown)
              </Text>
            )}
          </Flex>
        </Surface>
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Tooltip text={GOVERNANCE_TOOLTIPS.pii}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>PII Detected</Text>
            </Tooltip>
            <Heading level={3} style={{ color: governanceStats.pii > 0 ? STATUS_COLORS.poor : 'inherit' }}>
              {governanceStats.pii}
            </Heading>
          </Flex>
        </Surface>
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Tooltip text={GOVERNANCE_TOOLTIPS.injection}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Injection Risk</Text>
            </Tooltip>
            <Heading level={3} style={{ color: governanceStats.injection > 0 ? STATUS_COLORS.poor : 'inherit' }}>
              {governanceStats.injection}
            </Heading>
          </Flex>
        </Surface>
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Tooltip text={GOVERNANCE_TOOLTIPS.expensive}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Expensive</Text>
            </Tooltip>
            <Heading level={3} style={{ color: governanceStats.expensive > 0 ? STATUS_COLORS.fair : 'inherit' }}>
              {governanceStats.expensive}
            </Heading>
          </Flex>
        </Surface>
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Tooltip text={GOVERNANCE_TOOLTIPS.repetitive}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Cache Candidates</Text>
            </Tooltip>
            <Heading level={3} style={{ color: STATUS_COLORS.excellent }}>
              {governanceStats.repetitive}
            </Heading>
          </Flex>
        </Surface>
        <Surface style={{ padding: '16px', flex: '1 1 150px', minWidth: '150px' }}>
          <Flex flexDirection="column" gap={4}>
            <Tooltip text={GOVERNANCE_TOOLTIPS.hallucination}>
              <Text textStyle="small" style={{ opacity: 0.7, cursor: 'help' }}>Hallucination</Text>
            </Tooltip>
            <Heading level={3} style={{ color: governanceStats.hallucination > 0 ? STATUS_COLORS.fair : 'inherit' }}>
              {governanceStats.hallucination}
            </Heading>
          </Flex>
        </Surface>
      </Flex>

      {/* Flag Type Filter & Davis AI Actions */}
      <Surface style={{ padding: '16px' }}>
        <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={16}>
          <Flex gap={8} alignItems="center" flexWrap="wrap">
            <Text textStyle="small-emphasized">Issue Type:</Text>
            {(['all', 'pii', 'injection', 'expensive', 'repetitive', 'hallucination', 'error'] as const).map(filter => (
              <Button
                key={filter}
                variant={governanceFilter === filter ? 'accent' : 'default'}
                onClick={() => setGovernanceFilter(filter)}
                style={{ textTransform: 'capitalize' }}
              >
                {filter === 'all' ? 'All' : filter}
                {filter !== 'all' && ` (${governanceStats[filter as keyof typeof governanceStats] || 0})`}
              </Button>
            ))}
          </Flex>
          
          <Flex gap={8} alignItems="center">
            <Tooltip text={GOVERNANCE_TOOLTIPS.davisAI}>
              <Button
                onClick={runDavisScoring}
                disabled={davisLoading || prompts.length === 0}
              >
                {davisLoading ? (
                  <>
                    <ProgressCircle size="small" />
                    Scoring {davisProgress.current}/{davisProgress.total}
                  </>
                ) : (
                  <>
                    <InformationIcon /> {davisScored ? 'Re-Score with Dynatrace Intelligence' : 'Score with Dynatrace Intelligence'}
                  </>
                )}
              </Button>
            </Tooltip>
          </Flex>
        </Flex>
      </Surface>

      {/* How Detection Works */}
      <Surface style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)' }}>
        <Flex flexDirection="column" gap={8}>
          <Flex alignItems="center" gap={8}>
            <HelpIcon />
            <Text textStyle="base-emphasized">How Detection Works</Text>
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.8 }}>
            <strong>Real-time pattern analysis</strong> on actual prompt content from gen_ai.prompt.*.content spans:
          </Text>
          <Flex gap={16} flexWrap="wrap" style={{ marginTop: '4px' }}>
            <Text textStyle="small">
              <strong>PII:</strong> Regex for email, phone, SSN, credit cards
            </Text>
            <Text textStyle="small">
              <strong>Injection:</strong> "ignore previous instructions" patterns
            </Text>
            <Text textStyle="small">
              <strong>Expensive:</strong> Token costs from gen_ai.usage.*
            </Text>
            <Text textStyle="small">
              <strong>Repetitive:</strong> 15+ identical prompts (DQL aggregation)
            </Text>
          </Flex>
          <Text textStyle="small" style={{ opacity: 0.7, marginTop: '4px' }}>
            💡 <strong>Dynatrace Intelligence</strong> adds semantic analysis for nuanced risk detection.
          </Text>
        </Flex>
      </Surface>

      {/* Prompts List or Errors List */}
      <Surface style={{ padding: '20px' }}>
        <Flex flexDirection="column" gap={16}>
          {governanceFilter === 'error' ? (
            /* Error Spans Section */
            <>
              <Flex alignItems="center" gap={8}>
                <CriticalIcon style={{ color: STATUS_COLORS.poor }} />
                <Heading level={4}>GenAI Error Spans</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  {filteredErrors.length} error spans
                </Text>
              </Flex>

              {errorsLoading && (
                <Flex justifyContent="center" padding={32}>
                  <ProgressCircle />
                </Flex>
              )}

              {!errorsLoading && filteredErrors.length === 0 && (
                <Flex alignItems="center" gap={8}>
                  <CheckmarkIcon style={{ color: STATUS_COLORS.excellent }} />
                  <Text style={{ color: STATUS_COLORS.excellent }}>
                    No GenAI errors found in this timeframe - great!
                  </Text>
                </Flex>
              )}

              {filteredErrors.slice(0, 100).map(error => (
                <Surface key={error.id} style={{ padding: '16px', borderLeft: `3px solid ${STATUS_COLORS.poor}` }}>
                  <Flex flexDirection="column" gap={12}>
                    {/* Header */}
                    <Flex justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={8}>
                      <Flex flexDirection="column" gap={4}>
                        <Flex alignItems="center" gap={8}>
                          <CriticalIcon style={{ width: 16, height: 16, color: STATUS_COLORS.poor }} />
                          <Text textStyle="base-emphasized">{error.spanName}</Text>
                        </Flex>
                        <Text textStyle="small" style={{ opacity: 0.7 }}>
                          {error.serviceName} • {error.provider || 'Unknown Provider'} • {error.model || 'Unknown Model'}
                        </Text>
                      </Flex>
                      <Button onClick={() => openTraceInDistributedTraces(error.traceId, error.timestamp)}>
                        <ExternalLinkIcon /> View Trace
                      </Button>
                    </Flex>
                    
                    {/* Error Details */}
                    <Flex gap={16} flexWrap="wrap">
                      <Flex flexDirection="column" gap={2}>
                        <Text textStyle="small" style={{ opacity: 0.5 }}>Error Type</Text>
                        <Text textStyle="small-emphasized">{error.errorType || 'N/A'}</Text>
                      </Flex>
                      <Flex flexDirection="column" gap={2}>
                        <Text textStyle="small" style={{ opacity: 0.5 }}>Latency</Text>
                        <Text textStyle="small-emphasized">{error.latencyMs.toFixed(0)}ms</Text>
                      </Flex>
                      <Flex flexDirection="column" gap={2}>
                        <Text textStyle="small" style={{ opacity: 0.5 }}>Trace ID</Text>
                        <Text textStyle="small" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{error.traceId}</Text>
                      </Flex>
                    </Flex>
                    
                    {/* Prompt Content if available */}
                    {error.promptContent && (
                      <Surface style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                        <Flex flexDirection="column" gap={4}>
                          <Text textStyle="small" style={{ opacity: 0.5 }}>Prompt Content</Text>
                          <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {error.promptContent.substring(0, 300)}{error.promptContent.length > 300 ? '...' : ''}
                          </pre>
                        </Flex>
                      </Surface>
                    )}
                    
                    {/* Timestamp */}
                    <Text textStyle="small" style={{ opacity: 0.5, fontSize: '10px' }}>
                      {new Date(error.timestamp).toLocaleString()}
                    </Text>
                  </Flex>
                </Surface>
              ))}

              {filteredErrors.length > 100 && (
                <Text textStyle="small" style={{ opacity: 0.7, textAlign: 'center' }}>
                  Showing 100 of {filteredErrors.length} errors. Use filters to narrow results.
                </Text>
              )}
            </>
          ) : (
            /* Prompts Section */
            <>
              <Flex alignItems="center" gap={8}>
                <LockIcon />
                <Heading level={4}>Prompt Analysis</Heading>
                <Text textStyle="small" style={{ opacity: 0.7 }}>
                  {filteredPrompts.length} prompts {governanceFilter !== 'all' ? `with ${governanceFilter} flags` : ''}
                </Text>
              </Flex>

              {promptsLoading && (
                <Flex justifyContent="center" padding={32}>
                  <ProgressCircle />
                </Flex>
              )}

              {promptsError && (
                <Text style={{ color: STATUS_COLORS.poor }}>
                  Error loading prompts: {promptsError.message}
                </Text>
              )}

              {!promptsLoading && filteredPrompts.length === 0 && (
                <Flex alignItems="center" gap={8}>
                  <CheckmarkIcon style={{ color: STATUS_COLORS.excellent }} />
                  <Text style={{ color: STATUS_COLORS.excellent }}>
                    {governanceFilter === 'all' 
                      ? 'No prompts found. Ensure gen_ai.prompt.*.content attributes are being captured.'
                      : `No prompts with ${governanceFilter} flags - looking good!`}
                  </Text>
                </Flex>
              )}

              {filteredPrompts.slice(0, 50).map(prompt => (
                <PromptGovernanceCard 
                  key={prompt.id} 
                  prompt={prompt}
                  davisScore={davisScoreMap.get(prompt.id)}
                  onViewDetail={setDetailPrompt}
                />
              ))}

              {filteredPrompts.length > 50 && (
                <Text textStyle="small" style={{ opacity: 0.7, textAlign: 'center' }}>
                  Showing first 50 of {filteredPrompts.length} prompts
                </Text>
              )}
            </>
          )}
        </Flex>
      </Surface>

      {/* ─── Prompt Pattern Analysis (Phase 1.3) ─── */}
      {patternInsights.length > 0 && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex alignItems="center" gap={8}>
              <ResearchIcon style={{ color: STATUS_COLORS.good }} />
              <Heading level={4}>Prompt Pattern Analysis</Heading>
              <Text textStyle="small" style={{ opacity: 0.6 }}>top repeated patterns · efficiency · cache savings</Text>
            </Flex>
            {patternInsights.map((p, i) => (
              <Surface key={p.id} style={{
                padding: 14, borderRadius: 6,
                borderLeft: `3px solid ${
                  p.hasPii ? Colors.Charts.Status.Critical.Default
                  : p.hasInjection ? Colors.Charts.Status.Warning.Default
                  : Colors.Charts.Status.Good.Default}`,
              }}>
                <Flex gap={12} flexWrap="wrap" alignItems="flex-start">
                  {/* Rank + prompt preview */}
                  <Flex flexDirection="column" gap={4} style={{ flex: '1 1 360px', minWidth: 240 }}>
                    <Flex gap={6} alignItems="center">
                      <Text style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: 'var(--dt-colors-background-base-default)',
                        color: 'var(--dt-colors-text-secondary-default)' }}>#{i + 1}
                      </Text>
                      {p.hasPii && <Text style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: Colors.Charts.Status.Critical.Default + '25', color: Colors.Charts.Status.Critical.Default }}>PII</Text>}
                      {p.hasInjection && <Text style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: Colors.Charts.Status.Warning.Default + '25', color: Colors.Charts.Status.Warning.Default }}>Injection</Text>}
                      <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.serviceName}</Text>
                    </Flex>
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', fontFamily: 'monospace', lineHeight: 1.4 }}>{p.preview}</Text>
                  </Flex>
                  {/* Stats */}
                  <Flex gap={16} flexWrap="wrap" alignItems="center">
                    <Flex flexDirection="column" alignItems="flex-end">
                      <Text textStyle="small" style={{ opacity: 0.6 }}>Calls</Text>
                      <Text style={{ fontWeight: 700, fontSize: 14 }}>{p.count.toLocaleString()}</Text>
                    </Flex>
                    <Flex flexDirection="column" alignItems="flex-end">
                      <Text textStyle="small" style={{ opacity: 0.6 }}>Efficiency</Text>
                      <Text style={{ fontWeight: 700, color: p.efficiency > 50 ? Colors.Charts.Status.Ideal.Default : Colors.Charts.Status.Warning.Default }}>
                        {p.efficiency}%
                      </Text>
                    </Flex>
                    <Flex flexDirection="column" alignItems="flex-end">
                      <Text textStyle="small" style={{ opacity: 0.6 }}>Avg Latency</Text>
                      <Text style={{ fontWeight: 600 }}>
                        {p.avgLatencyMs >= 1000 ? `${(p.avgLatencyMs / 1000).toFixed(1)}s` : `${Math.round(p.avgLatencyMs)}ms`}
                      </Text>
                    </Flex>
                    {p.cacheSaving > 0.001 && (
                      <Flex flexDirection="column" alignItems="flex-end">
                        <Text textStyle="small" style={{ opacity: 0.6 }}>Cache Saving</Text>
                        <Text style={{ fontWeight: 700, color: Colors.Charts.Status.Ideal.Default }}>
                          ${p.cacheSaving.toFixed(3)}
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              </Surface>
            ))}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
}
