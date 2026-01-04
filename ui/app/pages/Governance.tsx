// GenAI Control Center - Governance Dashboard
// AI Governance, Compliance, and Risk Management

import React, { useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { useAIServicesDiscovery, useProviderComparison } from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';

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

export const Governance: React.FC = () => {
  const [filters] = useState<QueryFilters>({});
  const [selectedTab, setSelectedTab] = useState<'policies' | 'providers' | 'audit'>('policies');
  
  const { data: services, loading: servicesLoading } = useAIServicesDiscovery(filters);
  const { data: providers, loading: providersLoading } = useProviderComparison(filters);

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

  const loading = servicesLoading || providersLoading;

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
