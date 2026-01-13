// GenAI Control Center - Governance Dashboard
// AI Governance, Compliance, and Risk Management

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Link } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { ExternalLinkIcon } from '@dynatrace/strato-icons';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { useAIServicesDiscovery, useProviderComparison, usePromptAnalysis, useDistinctServices, useDistinctProviders, useDistinctModels } from '../hooks/useDQLQueries';
import { useDavisPromptScoring, type DavisPromptScore } from '../hooks/useDavisAI';
import type { QueryFilters, AnalyzedPrompt, PromptFlag } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';

/**
 * Navigate directly to Distributed Traces app for a specific trace
 * Opens in a new window/tab using getIntentLink with window.open
 */
const openTraceInDistributedTraces = (traceId: string, timestamp: string): void => {
  // Calculate the window (recommended for better UX)
  const timeDate = new Date(timestamp);
  const startTime = new Date(timeDate.getTime() - 10 * 60 * 1000).toISOString();
  const endTime = new Date(timeDate.getTime() + 10 * 60 * 1000).toISOString();

  const intentUrl = getIntentLink(
    { 
      'trace_id': traceId,
      'dt.timeframe': {
        from: startTime,
        to: endTime
      }
    },
    'dynatrace.distributedtracing',
    'view-trace'
  );
  
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

interface GovernancePolicy {
  id: string;
  name: string;
  category: 'data-privacy' | 'security' | 'compliance' | 'cost' | 'performance';
  status: 'compliant' | 'warning' | 'violation';
  description: string;
  affectedServices: number;
  recommendation: string;
}

interface ProviderRisk {
  provider: string;
  riskScore: number; // 0-100
  riskFactors: string[];
  dataResidency: string;
  certifications: string[];
  recommendation: string;
}

interface AuditEvent {
  timestamp: string;
  service: string;
  model: string;
  eventType: string;
  details: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface GovernanceChallenge {
  id: string;
  category: string;
  challenge: string;
  impact: string;
  mitigation: string;
  status: 'detected' | 'monitoring' | 'resolved';
}

export const Governance: React.FC = () => {
  // Use global filter state for consistency across pages
  const { filters: globalFilters, setFilters: setGlobalFilters } = useGlobalFilters();
  
  // Get available filter options
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();
  
  // Convert global FilterOptions to QueryFilters for hooks
  const filters = useMemo<QueryFilters>(() => ({
    timeframe: globalFilters.timeframe,
    serviceName: globalFilters.serviceFilter || undefined,
    provider: globalFilters.providerFilter || undefined,
    model: globalFilters.modelFilter || undefined
  }), [globalFilters]);

  const [selectedTab, setSelectedTab] = useState<'policies' | 'providers' | 'prompts' | 'challenges' | 'audit'>('policies');
  const [promptFilter, setPromptFilter] = useState<'all' | 'error' | 'pii' | 'injection' | 'expensive' | 'hallucination' | 'repetitive' | 'bias'>('all');
  
  // Configurable threshold for cache-eligible prompts (minimum requests in timeframe)
  const CACHE_THRESHOLD = 15;
  
  const { data: services, loading: servicesLoading, refetch: refetchServices } = useAIServicesDiscovery(filters);
  const { data: providers, loading: providersLoading, refetch: refetchProviders } = useProviderComparison(filters);
  const { data: promptAnalysisData, loading: promptsLoading, refetch: refetchPrompts } = usePromptAnalysis(filters);

  // Davis AI-powered prompt scoring
  const { 
    scores: davisScores, 
    isLoading: davisScoringLoading, 
    progress: scoringProgress,
    scorePromptBatch, 
    getSummary: getDavisSummary,
    cancelScoring,
    clearScores 
  } = useDavisPromptScoring();
  const [davisScoringEnabled, setDavisScoringEnabled] = useState(false);

  // Interface for prompt with Davis score (data is now pre-grouped server-side by DQL)
  interface GroupedPrompt {
    id: string;
    promptPattern: string;  // Normalized prompt for grouping
    promptPreview: string;  // Original prompt preview
    completionPreview?: string; // Model's response - for hallucination detection
    serviceName: string;
    model: string;
    provider: string;
    count: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    avgLatencyMs: number;
    flags: PromptFlag[];
    flagTypes: Set<string>;
    latestTimestamp: string;
    traceId: string;  // Keep one trace for linking
    spanId: string;
    davisScore?: DavisPromptScore;  // Davis AI score when available
  }

  // Data is now PRE-GROUPED by DQL query (server-side aggregation)
  // This ensures we get ALL unique prompt patterns in the timeframe, not just first N
  const groupedPrompts = useMemo((): GroupedPrompt[] => {
    if (!promptAnalysisData) return [];
    
    // Transform pre-grouped DQL results into GroupedPrompt format
    return promptAnalysisData.map(prompt => ({
      id: prompt.id,
      promptPattern: prompt.promptPreview.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100),
      promptPreview: prompt.promptPreview,
      completionPreview: prompt.completionPreview,
      serviceName: prompt.serviceName,
      model: prompt.model,
      provider: prompt.provider,
      count: prompt.requestCount || 1,  // Use server-side count
      totalInputTokens: prompt.inputTokens,
      totalOutputTokens: prompt.outputTokens,
      totalCost: prompt.totalCost,
      avgLatencyMs: prompt.latencyMs,
      flags: [...prompt.flags],
      flagTypes: new Set(prompt.flags.map(f => f.type)),
      latestTimestamp: prompt.timestamp,
      traceId: prompt.traceId,
      spanId: prompt.spanId,
    }));
  }, [promptAnalysisData]);

  // Create a map of Davis scores by prompt ID for quick lookup
  const davisScoreMap = useMemo(() => {
    const map = new Map<string, DavisPromptScore>();
    davisScores.forEach(score => map.set(score.promptId, score));
    return map;
  }, [davisScores]);

  // Merge Davis AI scores with grouped prompts BEFORE filtering
  // This ensures tab counts reflect Davis AI categorizations
  const groupedPromptsWithDavisScores = useMemo(() => {
    if (!davisScoringEnabled || davisScores.length === 0) return groupedPrompts;
    
    return groupedPrompts.map(prompt => {
      const davisScore = davisScoreMap.get(prompt.id);
      if (!davisScore) return prompt;
      
      // Merge Davis AI flags with existing flags
      const enhancedFlags = [...prompt.flags];
      const enhancedFlagTypes = new Set(prompt.flagTypes);
      
      // Add Davis AI-detected issues if not already present
      if (davisScore.category !== 'safe' && !enhancedFlagTypes.has(davisScore.category)) {
        enhancedFlags.push({
          type: davisScore.category as PromptFlag['type'],
          severity: davisScore.severity,
          detail: `🤖 Davis AI: ${davisScore.explanation}`
        });
        enhancedFlagTypes.add(davisScore.category);
      }
      
      return {
        ...prompt,
        flags: enhancedFlags,
        flagTypes: enhancedFlagTypes,
        davisScore  // Attach the full Davis score for display
      };
    });
  }, [groupedPrompts, davisScores, davisScoreMap, davisScoringEnabled]);

  // Filter grouped prompts by category (now includes Davis AI scores)
  const filteredPrompts = useMemo(() => {
    if (promptFilter === 'all') return groupedPromptsWithDavisScores;
    return groupedPromptsWithDavisScores.filter(p => p.flagTypes.has(promptFilter));
  }, [groupedPromptsWithDavisScores, promptFilter]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchServices?.();
    refetchProviders?.();
    refetchPrompts?.();
    clearScores();  // Clear Davis scores on refresh
  }, [refetchServices, refetchProviders, refetchPrompts, clearScores]);

  // Trigger Davis AI scoring for all prompts - uses SINGLE batch API call
  const handleDavisScoring = useCallback(async () => {
    if (!groupedPrompts.length) return;
    
    setDavisScoringEnabled(true);
    // Process up to 50 unique prompts in ONE Davis API call (or 2 calls if >25)
    const promptsToScore = groupedPrompts.slice(0, 50).map(p => ({
      id: p.id,
      content: p.promptPreview,
      completion: p.completionPreview,
      serviceName: p.serviceName,
      model: p.model,
      provider: p.provider
    }));
    
    // Single batch call - all prompts analyzed at once
    await scorePromptBatch(promptsToScore, { maxBatchSize: 25 });
  }, [groupedPrompts, scorePromptBatch]);

  // Get Davis AI summary stats
  const davisSummary = useMemo(() => getDavisSummary(), [getDavisSummary, davisScores]);

  // Note: availableServices, availableProviders, availableModels are now from hooks above

  // Generate governance policies based on actual data
  const governancePolicies = useMemo((): GovernancePolicy[] => {
    if (!services || !providers) return [];
    
    const policies: GovernancePolicy[] = [];
    
    // Multi-provider policy
    const providerCount = providers.length;
    policies.push({
      id: 'multi-provider',
      name: 'Multi-Provider Strategy',
      category: 'compliance',
      status: providerCount >= 2 ? 'compliant' : 'warning',
      description: `Currently using ${providerCount} provider(s). Best practice recommends at least 2 for resilience.`,
      affectedServices: services.length,
      recommendation: providerCount < 2 ? 'Add a secondary provider for failover capability' : 'Continue monitoring provider health',
    });

    // Error rate policy
    const highErrorServices = services.filter(s => s.errorRate > 5);
    policies.push({
      id: 'error-threshold',
      name: 'Error Rate Threshold',
      category: 'performance',
      status: highErrorServices.length === 0 ? 'compliant' : highErrorServices.length > 2 ? 'violation' : 'warning',
      description: `${highErrorServices.length} service(s) exceed 5% error rate threshold.`,
      affectedServices: highErrorServices.length,
      recommendation: highErrorServices.length > 0 ? 'Investigate high-error services and implement retry logic' : 'Error rates within acceptable limits',
    });

    // Latency policy
    const slowServices = services.filter(s => s.avgLatency > 5000);
    policies.push({
      id: 'latency-threshold',
      name: 'Response Time SLA',
      category: 'performance',
      status: slowServices.length === 0 ? 'compliant' : slowServices.length > 2 ? 'violation' : 'warning',
      description: `${slowServices.length} service(s) exceed 5-second response time SLA.`,
      affectedServices: slowServices.length,
      recommendation: slowServices.length > 0 ? 'Consider smaller models or caching for slow endpoints' : 'All services within SLA',
    });

    // Data residency policy (simulated based on provider)
    const hasUSProviders = providers.some((p: any) => ['openai', 'anthropic'].includes(p.provider?.toLowerCase()));
    const hasEUProviders = providers.some((p: any) => ['azure'].includes(p.provider?.toLowerCase()));
    policies.push({
      id: 'data-residency',
      name: 'Data Residency Compliance',
      category: 'data-privacy',
      status: hasEUProviders || !hasUSProviders ? 'compliant' : 'warning',
      description: hasUSProviders ? 'Data may be processed in US-based providers' : 'Data residency requirements met',
      affectedServices: services.length,
      recommendation: hasUSProviders && !hasEUProviders ? 'Consider EU-based alternatives for GDPR compliance' : 'Data residency policy satisfied',
    });

    // Model versioning policy
    policies.push({
      id: 'model-versioning',
      name: 'Model Version Tracking',
      category: 'compliance',
      status: 'compliant',
      description: 'All model versions are being tracked via OpenTelemetry spans.',
      affectedServices: services.length,
      recommendation: 'Continue monitoring for model deprecation notices',
    });

    // PII Detection policy (simulated)
    policies.push({
      id: 'pii-detection',
      name: 'PII in Prompts Detection',
      category: 'data-privacy',
      status: 'warning',
      description: 'PII scanning not yet implemented. Prompts may contain sensitive data.',
      affectedServices: services.length,
      recommendation: 'Enable prompt content analysis to detect PII leakage',
    });

    return policies;
  }, [services, providers]);

  // Calculate provider risk profiles
  const providerRisks = useMemo((): ProviderRisk[] => {
    if (!providers) return [];
    
    return providers.map((p: any) => {
      const providerName = p.provider?.toLowerCase() || 'unknown';
      let riskScore = 30; // Base risk
      const riskFactors: string[] = [];
      let dataResidency = 'Unknown';
      let certifications: string[] = [];
      
      // Adjust risk based on provider
      switch (providerName) {
        case 'openai':
          riskScore = 35;
          riskFactors.push('US-based data processing');
          dataResidency = 'United States';
          certifications = ['SOC 2', 'GDPR DPA'];
          break;
        case 'azure':
          riskScore = 25;
          dataResidency = 'Configurable (EU available)';
          certifications = ['SOC 2', 'ISO 27001', 'GDPR', 'HIPAA'];
          break;
        case 'anthropic':
          riskScore = 35;
          riskFactors.push('Limited compliance certifications');
          dataResidency = 'United States';
          certifications = ['SOC 2'];
          break;
        case 'google':
        case 'vertexai':
          riskScore = 25;
          dataResidency = 'Configurable (Multi-region)';
          certifications = ['SOC 2', 'ISO 27001', 'GDPR', 'HIPAA', 'FedRAMP'];
          break;
        case 'amazon':
          riskScore = 20;
          dataResidency = 'Configurable (Multi-region)';
          certifications = ['SOC 2', 'ISO 27001', 'GDPR', 'HIPAA', 'FedRAMP'];
          break;
        case 'ollama':
          riskScore = 15;
          dataResidency = 'On-premises';
          certifications = ['Self-managed'];
          riskFactors.push('Requires self-managed security');
          break;
        default:
          riskScore = 50;
          riskFactors.push('Unknown provider risk profile');
      }

      // Adjust for error rate
      if (p.errorRate > 5) {
        riskScore += 15;
        riskFactors.push('High error rate detected');
      }

      // Adjust for high latency
      if (p.avgLatency > 5000) {
        riskScore += 10;
        riskFactors.push('Performance concerns');
      }

      return {
        provider: p.provider || 'Unknown',
        riskScore: Math.min(riskScore, 100),
        riskFactors,
        dataResidency,
        certifications,
        recommendation: riskScore > 50 ? 'Review usage and consider alternatives' : 'Acceptable risk level',
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [providers]);

  // Calculate compliance score
  const complianceScore = useMemo(() => {
    if (governancePolicies.length === 0) return 100;
    const compliant = governancePolicies.filter(p => p.status === 'compliant').length;
    return Math.round((compliant / governancePolicies.length) * 100);
  }, [governancePolicies]);

  // Enterprise Governance Challenges
  const governanceChallenges = useMemo((): GovernanceChallenge[] => {
    return [
      {
        id: 'gc1',
        category: 'Data Sovereignty',
        challenge: 'Cross-Border Data Transfers',
        impact: 'Customer data sent to US-based AI providers may violate GDPR Article 44-49 transfer restrictions',
        mitigation: 'Use EU-hosted provider endpoints (Azure EU, AWS Frankfurt) or deploy on-premises models',
        status: 'monitoring',
      },
      {
        id: 'gc2',
        category: 'Shadow AI',
        challenge: 'Unmonitored AI Tool Usage',
        impact: 'Employees using personal ChatGPT accounts with company data bypasses security controls',
        mitigation: 'Deploy enterprise AI gateway with SSO, implement DLP policies, provide approved alternatives',
        status: 'detected',
      },
      {
        id: 'gc3',
        category: 'Model Governance',
        challenge: 'Model Drift & Version Control',
        impact: 'Provider model updates may change behavior, affecting accuracy and compliance',
        mitigation: 'Pin model versions, implement A/B testing for updates, maintain baseline evaluations',
        status: 'monitoring',
      },
      {
        id: 'gc4',
        category: 'Security',
        challenge: 'Prompt Injection Attacks',
        impact: 'Malicious inputs may manipulate AI responses, leak system prompts, or bypass guardrails',
        mitigation: 'Input sanitization, prompt templates, output validation, rate limiting suspicious patterns',
        status: 'detected',
      },
      {
        id: 'gc5',
        category: 'Fairness & Ethics',
        challenge: 'AI Output Bias',
        impact: 'Model responses may discriminate based on protected characteristics in HR, lending, healthcare',
        mitigation: 'Bias testing frameworks, human review for high-stakes decisions, diverse training data audits',
        status: 'monitoring',
      },
      {
        id: 'gc6',
        category: 'Compliance',
        challenge: 'Audit Trail Completeness',
        impact: 'Incomplete logging of prompts/responses makes incident investigation and compliance audits difficult',
        mitigation: 'Enable gen_ai.* OpenTelemetry attributes, centralize logs in Grail, implement retention policies',
        status: 'monitoring',
      },
      {
        id: 'gc7',
        category: 'Cost Management',
        challenge: 'Cost Attribution to Business Units',
        impact: 'Cannot accurately charge back AI costs to departments, leading to budget overruns',
        mitigation: 'Tag all requests with cost center, implement showback dashboards, set per-team quotas',
        status: 'resolved',
      },
      {
        id: 'gc8',
        category: 'Data Privacy',
        challenge: 'Training Data Exposure',
        impact: 'Customer data used in prompts may be retained by providers for model training',
        mitigation: 'Opt-out of training data programs, use zero-retention APIs, anonymize sensitive fields',
        status: 'monitoring',
      },
      {
        id: 'gc9',
        category: 'Vendor Risk',
        challenge: 'Single Provider Dependency',
        impact: 'Over-reliance on one AI provider creates availability and pricing risks',
        mitigation: 'Multi-provider strategy, abstract AI calls through gateway layer, maintain fallback providers',
        status: 'monitoring',
      },
      {
        id: 'gc10',
        category: 'Legal',
        challenge: 'Intellectual Property Contamination',
        impact: 'AI-generated code/content may include copyrighted material, creating legal liability',
        mitigation: 'Use models with indemnification, implement code scanning, document AI usage in IP policies',
        status: 'monitoring',
      },
    ];
  }, []);

  // Prompt analysis summary stats (based on grouped prompts for unique patterns)
  // Now uses groupedPromptsWithDavisScores so tab counts update after Davis AI scoring
  const promptStats = useMemo(() => {
    const grouped = groupedPromptsWithDavisScores;
    
    // Counts based on unique patterns (grouped, including Davis AI categorizations)
    const errorCount = grouped.filter(p => p.flagTypes.has('error')).length;
    const piiCount = grouped.filter(p => p.flagTypes.has('pii')).length;
    const hallucinationCount = grouped.filter(p => p.flagTypes.has('hallucination')).length;
    const expensiveCount = grouped.filter(p => p.flagTypes.has('expensive')).length;
    const repetitiveCount = grouped.filter(p => p.flagTypes.has('repetitive')).length;
    const injectionCount = grouped.filter(p => p.flagTypes.has('injection')).length;
    const biasCount = grouped.filter(p => p.flagTypes.has('bias')).length;
    const criticalCount = grouped.filter(p => p.flags.some(f => f.severity === 'critical')).length;
    
    // Total cost and total requests from grouped data (server-side aggregated)
    const totalCost = grouped.reduce((sum, p) => sum + p.totalCost, 0);
    const totalRequests = grouped.reduce((sum, p) => sum + p.count, 0);  // Sum of all request counts
    
    return { 
      errorCount, piiCount, hallucinationCount, expensiveCount, repetitiveCount, injectionCount, biasCount, criticalCount, 
      totalCost, 
      total: grouped.length,  // Unique patterns
      totalRequests  // Total individual requests (aggregated from server)
    };
  }, [groupedPromptsWithDavisScores]);

  const loading = servicesLoading || providersLoading || promptsLoading;

  // Helper to get status icon
  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = { compliant: '✅', warning: '⚠️', violation: '❌' };
    return icons[status] || '❓';
  };

  // Helper to get risk color
  const getRiskColor = (score: number) => {
    if (score > 50) return Colors.Text.Critical.Default;
    if (score > 30) return Colors.Text.Warning.Default;
    return Colors.Text.Success.Default;
  };

  // Helper to get flag badge style
  const getFlagStyle = (flag: PromptFlag) => {
    const baseStyle = {
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    };
    
    const colors: Record<string, { bg: string; text: string }> = {
      critical: { bg: 'rgba(255, 50, 50, 0.2)', text: Colors.Text.Critical.Default },
      high: { bg: 'rgba(255, 150, 50, 0.2)', text: Colors.Text.Warning.Default },
      medium: { bg: 'rgba(255, 200, 50, 0.2)', text: '#C99700' },
      low: { bg: 'rgba(100, 180, 255, 0.2)', text: Colors.Text.Primary.Default },
    };
    
    const color = colors[flag.severity] || colors.medium;
    return { ...baseStyle, backgroundColor: color.bg, color: color.text };
  };

  // Helper to get flag icon
  const getFlagIcon = (type: PromptFlag['type']) => {
    const icons: Record<string, string> = {
      error: '🚨',
      pii: '🔐',
      hallucination: '🎭',
      expensive: '💰',
      repetitive: '🔄',
      injection: '⚠️',
      sensitive: '🔒',
      bias: '⚖️',
    };
    return icons[type] || '❓';
  };

  // Helper for challenge status
  const getChallengeStatusStyle = (status: GovernanceChallenge['status']) => {
    const styles: Record<string, { bg: string; text: string }> = {
      detected: { bg: 'rgba(255, 50, 50, 0.2)', text: Colors.Text.Critical.Default },
      monitoring: { bg: 'rgba(255, 200, 50, 0.2)', text: '#C99700' },
      resolved: { bg: 'rgba(50, 200, 100, 0.2)', text: Colors.Text.Success.Default },
    };
    return styles[status] || styles.monitoring;
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>Governance - AI Compliance & Risk</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Monitor AI governance policies, provider risks, and compliance status
          </Text>
        </Flex>
      </Flex>

      {/* Provider Data Disclaimer */}
      <Surface style={{ padding: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={8}>
          <span>ℹ️</span>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            <strong>Note:</strong> Provider certifications and data residency are reference data based on public information. 
            Verify with your provider agreements. Governance challenges are sample scenarios.
          </Text>
        </Flex>
      </Surface>

      {/* Filter Bar */}
      <FilterBar
        filters={globalFilters}
        onFiltersChange={setGlobalFilters}
        onRefresh={handleRefresh}
        isLoading={servicesLoading || providersLoading || promptsLoading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />
      {/* Compliance Overview */}
      <Flex gap={16}>
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Compliance Score
            </Text>
            <Heading level={2} style={{ 
              color: complianceScore >= 80 ? Colors.Text.Success.Default : 
                     complianceScore >= 60 ? Colors.Text.Warning.Default : 
                     Colors.Text.Critical.Default 
            }}>
              {complianceScore}%
            </Heading>
            <ProgressBar value={complianceScore} />
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Policy Status
            </Text>
            <Flex gap={16}>
              <Text>✅ {governancePolicies.filter(p => p.status === 'compliant').length} Compliant</Text>
              <Text>⚠️ {governancePolicies.filter(p => p.status === 'warning').length} Warnings</Text>
              <Text>❌ {governancePolicies.filter(p => p.status === 'violation').length} Violations</Text>
            </Flex>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Avg Provider Risk
            </Text>
            <Heading level={2}>
              {providerRisks.length > 0 
                ? Math.round(providerRisks.reduce((sum, p) => sum + p.riskScore, 0) / providerRisks.length)
                : 0}/100
            </Heading>
            <Text textStyle="small">
              {providerRisks.filter(p => p.riskScore > 50).length} high-risk providers
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Prompt Security
            </Text>
            <Heading level={2} style={{ 
              color: promptStats.errorCount > 0 ? Colors.Text.Critical.Default : 
                     promptStats.criticalCount > 0 ? Colors.Text.Critical.Default : 
                     promptStats.piiCount > 0 ? Colors.Text.Warning.Default : 
                     Colors.Text.Success.Default 
            }}>
              {promptStats.errorCount} 🚨
            </Heading>
            <Text textStyle="small">
              Real Errors • {promptStats.piiCount} PII • {promptStats.injectionCount} Injection
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        <Button
          variant={selectedTab === 'policies' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('policies')}
        >
          Policies ({governancePolicies.length})
        </Button>
        <Button
          variant={selectedTab === 'providers' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('providers')}
        >
          Provider Risk ({providerRisks.length})
        </Button>
        <Button
          variant={selectedTab === 'prompts' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('prompts')}
        >
          🔍 Prompt Analysis ({promptStats.total})
        </Button>
        <Button
          variant={selectedTab === 'challenges' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('challenges')}
        >
          ⚠️ Challenges ({governanceChallenges.filter(c => c.status !== 'resolved').length})
        </Button>
        <Button
          variant={selectedTab === 'audit' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('audit')}
        >
          Audit Trail
        </Button>
      </Flex>

      {/* Tab Content */}
      {selectedTab === 'policies' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Governance Policies</Heading>
            {loading ? (
              <Text>Loading policies...</Text>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {governancePolicies.map((policy, idx) => (
                  <Surface key={idx} style={{ 
                    padding: 12, 
                    borderLeft: `4px solid ${
                      policy.status === 'compliant' ? Colors.Charts.Apdex.Excellent.Default : 
                      policy.status === 'warning' ? Colors.Charts.Apdex.Good.Default : 
                      Colors.Charts.Apdex.Poor.Default
                    }`
                  }}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                        <Flex alignItems="center" gap={8}>
                          <span>{getStatusIcon(policy.status)}</span>
                          <Text style={{ fontWeight: 600 }}>{policy.name}</Text>
                          <Text textStyle="small" style={{ 
                            padding: '2px 6px', 
                            backgroundColor: 'var(--dt-colors-background-default-secondary)',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            fontSize: 10
                          }}>
                            {policy.category.replace('-', ' ')}
                          </Text>
                        </Flex>
                        <Text textStyle="small">{policy.description}</Text>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          💡 {policy.recommendation}
                        </Text>
                      </Flex>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        {policy.affectedServices} services
                      </Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {selectedTab === 'providers' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Provider Risk Assessment</Heading>
            {loading ? (
              <Text>Loading risk data...</Text>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {providerRisks.map((risk, idx) => (
                  <Surface key={idx} style={{ padding: 12 }}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                        <Flex alignItems="center" gap={8}>
                          <Text style={{ fontWeight: 600, textTransform: 'capitalize' }}>{risk.provider}</Text>
                          <Text style={{ color: getRiskColor(risk.riskScore), fontWeight: 600 }}>
                            Risk: {risk.riskScore}/100
                          </Text>
                        </Flex>
                        <Flex gap={8} style={{ flexWrap: 'wrap' }}>
                          <Text textStyle="small">📍 {risk.dataResidency}</Text>
                          {risk.riskFactors.length > 0 && (
                            <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>
                              ⚠️ {risk.riskFactors.join(', ')}
                            </Text>
                          )}
                        </Flex>
                        <Flex gap={4} style={{ flexWrap: 'wrap' }}>
                          {risk.certifications.map((cert, i) => (
                            <span key={i} style={{ 
                              fontSize: 10, 
                              padding: '2px 6px', 
                              backgroundColor: 'var(--dt-colors-background-default-secondary)',
                              borderRadius: 4
                            }}>
                              {cert}
                            </span>
                          ))}
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {selectedTab === 'prompts' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={16}>
            <Flex justifyContent="space-between" alignItems="center">
              <Heading level={6}>🔍 Prompt Analysis - Security & Optimization</Heading>
              
              {/* Davis AI Scoring Controls */}
              <Flex gap={8} alignItems="center">
                {davisScoringLoading && (
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                    🤖 Analyzing {scoringProgress.current}/{scoringProgress.total}...
                  </Text>
                )}
                {davisScoringEnabled && davisSummary.totalAnalyzed > 0 && !davisScoringLoading && (
                  <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>
                    ✓ Davis AI: {davisSummary.totalAnalyzed} scored (Avg Risk: {davisSummary.avgRiskScore})
                  </Text>
                )}
                <Button
                  variant={davisScoringEnabled ? 'default' : 'emphasized'}
                  onClick={davisScoringLoading ? cancelScoring : handleDavisScoring}
                  disabled={!groupedPrompts.length || promptsLoading}
                >
                  {davisScoringLoading ? '⏹️ Cancel' : '🤖 Score with Davis AI'}
                </Button>
              </Flex>
            </Flex>

            {/* Davis AI Summary (when scoring enabled) */}
            {davisScoringEnabled && davisSummary.totalAnalyzed > 0 && (
              <Surface style={{ padding: 12, backgroundColor: 'var(--dt-colors-surface-neutral-subdued)' }}>
                <Flex gap={16} alignItems="center" style={{ flexWrap: 'wrap' }}>
                  <Flex flexDirection="column" alignItems="center" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>🤖 AI Risk Score</Text>
                    <Heading level={4} style={{ 
                      color: davisSummary.avgRiskScore >= 50 ? Colors.Text.Critical.Default : 
                             davisSummary.avgRiskScore >= 25 ? Colors.Text.Warning.Default : 
                             Colors.Text.Success.Default 
                    }}>
                      {davisSummary.avgRiskScore}/100
                    </Heading>
                  </Flex>
                  <Flex flexDirection="column" alignItems="center" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>High Risk</Text>
                    <Heading level={4} style={{ color: Colors.Text.Critical.Default }}>
                      {davisSummary.highRiskCount}
                    </Heading>
                  </Flex>
                  <Flex flexDirection="column" alignItems="center" gap={2}>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Critical</Text>
                    <Heading level={4} style={{ color: Colors.Text.Critical.Default }}>
                      {davisSummary.criticalCount}
                    </Heading>
                  </Flex>
                  {davisSummary.topCategories.length > 0 && (
                    <Flex flexDirection="column" gap={2}>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Top Categories:</Text>
                      <Flex gap={8}>
                        {davisSummary.topCategories.slice(0, 3).map(cat => (
                          <Text key={cat.category} textStyle="small">
                            {cat.category}: {cat.count}
                          </Text>
                        ))}
                      </Flex>
                    </Flex>
                  )}
                </Flex>
              </Surface>
            )}
            
            {/* Summary Stats */}
            <Flex gap={12} style={{ flexWrap: 'wrap' }}>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>🚨 Real Errors</Text>
                  <Heading level={3} style={{ color: Colors.Text.Critical.Default }}>{promptStats.errorCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>🔐 PII Detected</Text>
                  <Heading level={3}>{promptStats.piiCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>🎭 Hallucination Risk</Text>
                  <Heading level={3}>{promptStats.hallucinationCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>💰 Expensive</Text>
                  <Heading level={3}>{promptStats.expensiveCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>🔄 Cache Candidates</Text>
                  <Heading level={3}>{promptStats.repetitiveCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>⚠️ Injection</Text>
                  <Heading level={3}>{promptStats.injectionCount}</Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, minWidth: 100 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>⚖️ Bias Risk</Text>
                  <Heading level={3}>{promptStats.biasCount}</Heading>
                </Flex>
              </Surface>
            </Flex>

            {/* Category Filter Tabs */}
            <Flex gap={8} style={{ flexWrap: 'wrap', borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
              <Button 
                variant={promptFilter === 'all' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('all')}
              >
                📋 All ({promptStats.total})
              </Button>
              <Button 
                variant={promptFilter === 'error' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('error')}
              >
                🚨 Errors ({promptStats.errorCount})
              </Button>
              <Button 
                variant={promptFilter === 'pii' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('pii')}
              >
                🔐 PII ({promptStats.piiCount})
              </Button>
              <Button 
                variant={promptFilter === 'injection' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('injection')}
              >
                ⚠️ Injection ({promptStats.injectionCount})
              </Button>
              <Button 
                variant={promptFilter === 'expensive' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('expensive')}
              >
                💰 Expensive ({promptStats.expensiveCount})
              </Button>
              <Button 
                variant={promptFilter === 'hallucination' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('hallucination')}
              >
                🎭 Hallucination ({promptStats.hallucinationCount})
              </Button>
              <Button 
                variant={promptFilter === 'repetitive' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('repetitive')}
              >
                🔄 Cacheable ({promptStats.repetitiveCount})
              </Button>
              <Button 
                variant={promptFilter === 'bias' ? 'emphasized' : 'default'}
                onClick={() => setPromptFilter('bias')}
              >
                ⚖️ Bias ({promptStats.biasCount})
              </Button>
            </Flex>

            {/* Prompt Analysis List */}
            <Flex flexDirection="column" gap={8}>
              <Flex justifyContent="space-between" alignItems="center">
                <Text style={{ fontWeight: 600, marginTop: 8 }}>
                  {promptFilter === 'all' ? 'Grouped Prompt Patterns' : `${promptFilter.charAt(0).toUpperCase() + promptFilter.slice(1)} Flagged Patterns`}
                  {' '}({filteredPrompts.length} patterns, {promptStats.totalRequests} total requests)
                </Text>
                {promptsLoading && <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Loading...</Text>}
              </Flex>
              {!promptsLoading && (!filteredPrompts || filteredPrompts.length === 0) && (
                <Surface style={{ padding: 16, backgroundColor: 'rgba(0, 150, 255, 0.1)' }}>
                  <Text>No prompts found for this filter. This could mean:</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                    <li><Text textStyle="small">No GenAI spans with prompt content in the selected timeframe</Text></li>
                    <li><Text textStyle="small">No prompts match the "{promptFilter}" category</Text></li>
                    <li><Text textStyle="small">Try selecting "All" to see all prompts</Text></li>
                  </ul>
                </Surface>
              )}
              {(filteredPrompts || []).map((prompt) => {
                const davisScore = prompt.davisScore;
                return (
                <Surface key={prompt.id} style={{ 
                  padding: 8,
                  borderLeft: `3px solid ${
                    prompt.flags.some(f => f.severity === 'critical') ? Colors.Charts.Apdex.Poor.Default :
                    prompt.flags.some(f => f.severity === 'high') ? Colors.Charts.Apdex.Fair.Default :
                    prompt.flags.length > 0 ? Colors.Charts.Apdex.Good.Default :
                    'var(--dt-colors-border-neutral-default)'
                  }`
                }}>
                  <Flex flexDirection="column" gap={4}>
                    {/* Header row: service, model, count, trace link */}
                    <Flex justifyContent="space-between" alignItems="center" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <Flex alignItems="center" gap={6} style={{ flexWrap: 'wrap' }}>
                        <Text style={{ fontWeight: 600, fontSize: 13 }}>{prompt.serviceName}</Text>
                        <Text textStyle="small" style={{ 
                          padding: '1px 4px', 
                          backgroundColor: 'var(--dt-colors-background-default-secondary)',
                          borderRadius: 3,
                          fontSize: 10
                        }}>
                          {prompt.model}
                        </Text>
                        <Text textStyle="small" style={{ 
                          padding: '1px 6px', 
                          backgroundColor: prompt.count > 10 ? 'rgba(255, 150, 50, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                          color: prompt.count > 10 ? Colors.Text.Warning.Default : Colors.Text.Primary.Default,
                          borderRadius: 3,
                          fontWeight: 600,
                          fontSize: 10
                        }}>
                          {prompt.count}x
                        </Text>
                        {/* Davis AI Risk Score Badge */}
                        {davisScore && (
                          <Text textStyle="small" style={{ 
                            padding: '1px 6px', 
                            backgroundColor: davisScore.riskScore >= 50 ? 'rgba(255, 60, 60, 0.2)' :
                                           davisScore.riskScore >= 25 ? 'rgba(255, 180, 60, 0.2)' :
                                           'rgba(60, 200, 100, 0.2)',
                            color: davisScore.riskScore >= 50 ? Colors.Text.Critical.Default :
                                  davisScore.riskScore >= 25 ? Colors.Text.Warning.Default :
                                  Colors.Text.Success.Default,
                            borderRadius: 3,
                            fontWeight: 600,
                            fontSize: 10
                          }}
                          title={`Davis AI: ${davisScore.explanation}\nConfidence: ${(davisScore.confidence * 100).toFixed(0)}%`}
                          >
                            🤖 {davisScore.riskScore}
                          </Text>
                        )}
                        {/* Open Trace in Distributed Traces app */}
                        {prompt.traceId && (
                          <Button
                            variant="default"
                            onClick={() => openTraceInDistributedTraces(prompt.traceId, prompt.latestTimestamp)}
                            title={`Open Trace: ${prompt.traceId}`}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 2,
                              fontSize: 10,
                              padding: '1px 6px',
                              minHeight: 'auto',
                              height: 'auto'
                            }}
                          >
                            <ExternalLinkIcon /> Trace
                          </Button>
                        )}
                      </Flex>
                      {/* Stats: tokens, cost */}
                      <Flex alignItems="center" gap={8}>
                        <Text textStyle="small" style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>
                          {prompt.totalInputTokens.toLocaleString()}/{prompt.totalOutputTokens.toLocaleString()} tokens
                        </Text>
                        <Text style={{ fontWeight: 600, fontSize: 11, color: prompt.totalCost > 1 ? Colors.Text.Warning.Default : undefined }}>
                          ${prompt.totalCost.toFixed(3)}
                        </Text>
                      </Flex>
                    </Flex>
                    
                    {/* Prompt preview - single line */}
                    <Text textStyle="small" style={{ 
                      color: Colors.Text.Neutral.Subdued,
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--dt-colors-background-default-secondary)',
                      padding: '4px 6px',
                      borderRadius: 3,
                      fontSize: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {prompt.promptPreview}
                    </Text>
                    
                    {/* Completion preview - shown when hallucination detected (this is the evidence!) */}
                    {prompt.completionPreview && prompt.flagTypes.has('hallucination') && (
                      <Flex flexDirection="column" gap={2}>
                        <Text textStyle="small" style={{ fontSize: 9, color: Colors.Text.Warning.Default, fontWeight: 600 }}>
                          🔍 Model Response (Hallucination Evidence):
                        </Text>
                        <Text textStyle="small" style={{ 
                          color: Colors.Text.Critical.Default,
                          fontFamily: 'monospace',
                          backgroundColor: 'rgba(255, 50, 50, 0.1)',
                          padding: '4px 6px',
                          borderRadius: 3,
                          fontSize: 10,
                          borderLeft: '3px solid rgba(255, 50, 50, 0.5)'
                        }}>
                          {prompt.completionPreview}
                        </Text>
                      </Flex>
                    )}
                    
                    {/* Flags - inline */}
                    {prompt.flags.length > 0 && (
                      <Flex gap={4} style={{ flexWrap: 'wrap' }}>
                        {prompt.flags.map((flag, idx) => (
                          <span key={idx} style={{
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 500,
                            backgroundColor: flag.severity === 'critical' ? 'rgba(255, 50, 50, 0.2)' :
                                           flag.severity === 'high' ? 'rgba(255, 150, 50, 0.2)' :
                                           'rgba(100, 180, 255, 0.2)',
                            color: flag.severity === 'critical' ? Colors.Text.Critical.Default :
                                   flag.severity === 'high' ? Colors.Text.Warning.Default :
                                   Colors.Text.Primary.Default
                          }}>
                            {getFlagIcon(flag.type)} {flag.type}
                          </span>
                        ))}
                      </Flex>
                    )}
                    
                    {/* Davis AI Recommendations */}
                    {davisScore && davisScore.recommendations.length > 0 && (
                      <Flex flexDirection="column" gap={2} style={{ 
                        marginTop: 4, 
                        padding: '4px 8px', 
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: 4
                      }}>
                        <Text textStyle="small" style={{ fontWeight: 600, fontSize: 10 }}>
                          🤖 Davis AI Recommendations:
                        </Text>
                        {davisScore.recommendations.slice(0, 2).map((rec, idx) => (
                          <Text key={idx} textStyle="small" style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>
                            • {rec}
                          </Text>
                        ))}
                      </Flex>
                    )}
                  </Flex>
                </Surface>
                );
              })}
            </Flex>
          </Flex>
        </Surface>
      )}

      {selectedTab === 'challenges' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={16}>
            <Flex flexDirection="column" gap={4}>
              <Heading level={6}>⚠️ Enterprise AI Governance Challenges</Heading>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Common governance challenges faced by enterprises dealing with customer data and AI
              </Text>
            </Flex>

            {/* Challenge Summary */}
            <Flex gap={12}>
              <Surface style={{ padding: 12, flex: 1 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Detected</Text>
                  <Heading level={3} style={{ color: Colors.Text.Critical.Default }}>
                    {governanceChallenges.filter(c => c.status === 'detected').length}
                  </Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, flex: 1 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Monitoring</Text>
                  <Heading level={3} style={{ color: '#C99700' }}>
                    {governanceChallenges.filter(c => c.status === 'monitoring').length}
                  </Heading>
                </Flex>
              </Surface>
              <Surface style={{ padding: 12, flex: 1 }}>
                <Flex flexDirection="column" alignItems="center" gap={4}>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Resolved</Text>
                  <Heading level={3} style={{ color: Colors.Text.Success.Default }}>
                    {governanceChallenges.filter(c => c.status === 'resolved').length}
                  </Heading>
                </Flex>
              </Surface>
            </Flex>

            {/* Challenges List */}
            <Flex flexDirection="column" gap={8}>
              {governanceChallenges.map((challenge) => {
                const statusStyle = getChallengeStatusStyle(challenge.status);
                return (
                  <Surface key={challenge.id} style={{ 
                    padding: 12,
                    borderLeft: `4px solid ${statusStyle.text}`
                  }}>
                    <Flex flexDirection="column" gap={8}>
                      <Flex justifyContent="space-between" alignItems="flex-start">
                        <Flex alignItems="center" gap={8}>
                          <Text style={{ fontWeight: 600 }}>{challenge.challenge}</Text>
                          <span style={{ 
                            padding: '2px 8px', 
                            backgroundColor: 'var(--dt-colors-background-default-secondary)',
                            borderRadius: 4,
                            fontSize: 10,
                            textTransform: 'uppercase'
                          }}>
                            {challenge.category}
                          </span>
                        </Flex>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          textTransform: 'uppercase'
                        }}>
                          {challenge.status}
                        </span>
                      </Flex>
                      
                      <Flex flexDirection="column" gap={4}>
                        <Flex gap={8}>
                          <Text textStyle="small" style={{ fontWeight: 600, minWidth: 60 }}>Impact:</Text>
                          <Text textStyle="small">{challenge.impact}</Text>
                        </Flex>
                        <Flex gap={8}>
                          <Text textStyle="small" style={{ fontWeight: 600, minWidth: 60, color: Colors.Text.Success.Default }}>Mitigation:</Text>
                          <Text textStyle="small">{challenge.mitigation}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Surface>
                );
              })}
            </Flex>

            {/* Best Practices */}
            <Surface style={{ padding: 16, backgroundColor: 'rgba(0, 150, 255, 0.1)' }}>
              <Flex flexDirection="column" gap={8}>
                <Text style={{ fontWeight: 600 }}>📋 Enterprise AI Governance Best Practices</Text>
                <Flex flexDirection="column" gap={4}>
                  <Text textStyle="small">• Establish an AI Center of Excellence with cross-functional governance board</Text>
                  <Text textStyle="small">• Implement AI gateway layer for centralized control, logging, and policy enforcement</Text>
                  <Text textStyle="small">• Deploy PII detection and masking before data leaves your network</Text>
                  <Text textStyle="small">• Use semantic caching to reduce costs and latency for repetitive queries</Text>
                  <Text textStyle="small">• Maintain model inventory with version tracking and deprecation alerts</Text>
                  <Text textStyle="small">• Implement output validation and human-in-the-loop for high-stakes decisions</Text>
                  <Text textStyle="small">• Regular bias audits and fairness testing for customer-facing AI</Text>
                  <Text textStyle="small">• Document AI usage in privacy policies and obtain appropriate consent</Text>
                </Flex>
              </Flex>
            </Surface>
          </Flex>
        </Surface>
      )}

      {selectedTab === 'audit' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Audit Trail</Heading>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>
              Audit logging captures AI model invocations, prompt metadata, and compliance events.
              Enable prompt content analysis to track PII exposure and policy violations.
            </Text>
            <Surface style={{ padding: 12, backgroundColor: 'rgba(0, 150, 255, 0.1)' }}>
              <Text>
                <strong>Coming Soon:</strong> Real-time audit event streaming with prompt/response metadata analysis.
                This requires enabling the gen_ai.prompt.* span attributes in your OpenTelemetry instrumentation.
              </Text>
            </Surface>
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default Governance;
