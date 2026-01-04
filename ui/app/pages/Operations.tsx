// GenAI Control Center - Operations Dashboard
// Runbooks, Remediation, and Operational Response

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { useAIServicesDiscovery } from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';

interface Runbook {
  id: string;
  name: string;
  category: 'performance' | 'errors' | 'cost' | 'security';
  trigger: string;
  description: string;
  steps: string[];
  automated: boolean;
  lastRun?: string;
  successRate: number;
}

interface ActiveIncident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  service: string;
  model: string;
  detectedAt: string;
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  suggestedRunbook: string;
}

// Pre-defined runbooks for GenAI operations
const RUNBOOKS: Runbook[] = [
  {
    id: 'rate-limit-429',
    name: '429 Rate Limit Response',
    category: 'errors',
    trigger: 'HTTP 429 errors > 5% of requests',
    description: 'Automated response to rate limiting from AI providers',
    steps: [
      '1. Identify affected provider and model',
      '2. Enable exponential backoff with jitter',
      '3. Activate request queuing',
      '4. Switch traffic to secondary provider if available',
      '5. Alert on-call team if errors persist > 10 minutes',
    ],
    automated: true,
    successRate: 94,
  },
  {
    id: 'high-latency',
    name: 'High Latency Mitigation',
    category: 'performance',
    trigger: 'P95 latency > 5 seconds for 5+ minutes',
    description: 'Response playbook for slow AI model responses',
    steps: [
      '1. Check provider status page for incidents',
      '2. Analyze prompt complexity (token count)',
      '3. Enable response caching for repeated queries',
      '4. Route to faster model variant if available',
      '5. Implement timeout and retry with smaller context',
    ],
    automated: false,
    successRate: 87,
  },
  {
    id: 'cost-spike',
    name: 'Cost Spike Investigation',
    category: 'cost',
    trigger: 'Token usage > 150% of daily average',
    description: 'Investigate and mitigate unexpected cost increases',
    steps: [
      '1. Identify services with highest token increase',
      '2. Check for new deployments or traffic spikes',
      '3. Analyze prompt/completion ratio changes',
      '4. Review for potential prompt injection attacks',
      '5. Implement token limits per request if needed',
    ],
    automated: false,
    successRate: 92,
  },
  {
    id: 'provider-failover',
    name: 'Provider Failover',
    category: 'errors',
    trigger: 'Primary provider error rate > 10%',
    description: 'Automatic failover to secondary AI provider',
    steps: [
      '1. Detect sustained error rate on primary',
      '2. Route traffic to secondary provider',
      '3. Log failover event for audit',
      '4. Monitor secondary provider health',
      '5. Auto-recover to primary when healthy',
    ],
    automated: true,
    successRate: 98,
  },
  {
    id: 'model-deprecation',
    name: 'Model Deprecation Response',
    category: 'security',
    trigger: 'Model version marked as deprecated by provider',
    description: 'Migration playbook for deprecated AI models',
    steps: [
      '1. Identify all services using deprecated model',
      '2. Test replacement model in staging',
      '3. Update configuration to new model version',
      '4. Deploy changes with canary rollout',
      '5. Monitor for regression in quality/performance',
    ],
    automated: false,
    successRate: 100,
  },
  {
    id: 'prompt-injection',
    name: 'Prompt Injection Detection',
    category: 'security',
    trigger: 'Unusual prompt patterns detected',
    description: 'Security response for potential prompt injection attacks',
    steps: [
      '1. Analyze flagged prompts for injection patterns',
      '2. Block suspicious requests at gateway',
      '3. Review affected user sessions',
      '4. Enable enhanced input sanitization',
      '5. Report to security team for investigation',
    ],
    automated: false,
    successRate: 85,
  },
];

export const Operations: React.FC = () => {
  const [filters] = useState<QueryFilters>({});
  const [selectedTab, setSelectedTab] = useState<'runbooks' | 'incidents' | 'automation'>('runbooks');
  const [executingRunbook, setExecutingRunbook] = useState<string | null>(null);
  
  const { data: services, loading } = useAIServicesDiscovery(filters);

  // Generate active incidents based on service data
  const activeIncidents = useMemo((): ActiveIncident[] => {
    if (!services) return [];
    
    const incidents: ActiveIncident[] = [];
    
    services.forEach((service) => {
      if (service.errorRate > 5) {
        incidents.push({
          id: `err-${service.serviceName}`,
          title: `High error rate on ${service.serviceName}`,
          severity: service.errorRate > 10 ? 'critical' : 'high',
          service: service.serviceName,
          model: service.modelName,
          detectedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          status: 'investigating',
          suggestedRunbook: 'rate-limit-429',
        });
      }
      
      if (service.avgLatency > 5000) {
        incidents.push({
          id: `lat-${service.serviceName}`,
          title: `High latency on ${service.serviceName}`,
          severity: service.avgLatency > 10000 ? 'critical' : 'medium',
          service: service.serviceName,
          model: service.modelName,
          detectedAt: new Date(Date.now() - Math.random() * 7200000).toISOString(),
          status: 'open',
          suggestedRunbook: 'high-latency',
        });
      }
    });
    
    return incidents.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [services]);

  // Runbook execution simulation
  const executeRunbook = (runbookId: string) => {
    setExecutingRunbook(runbookId);
    setTimeout(() => {
      setExecutingRunbook(null);
    }, 3000);
  };

  // Category icons helper
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      performance: '⚡',
      errors: '🔴',
      cost: '💰',
      security: '🔒',
    };
    return icons[category] || '📋';
  };

  // Severity icons helper
  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[severity] || '⚪';
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>Operations - Runbooks & Response</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Standardized response procedures and automated remediation for AI operations
          </Text>
        </Flex>
      </Flex>

      {/* Status Overview */}
      <Flex gap={16}>
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Active Incidents
            </Text>
            <Heading level={2} style={{ 
              color: activeIncidents.filter(i => i.severity === 'critical').length > 0 
                ? Colors.Text.Critical.Default 
                : Colors.Text.Neutral.Default 
            }}>
              {activeIncidents.length}
            </Heading>
            <Text textStyle="small">
              {activeIncidents.filter(i => i.severity === 'critical').length} critical, 
              {activeIncidents.filter(i => i.severity === 'high').length} high
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Available Runbooks
            </Text>
            <Heading level={2}>
              {RUNBOOKS.length}
            </Heading>
            <Text textStyle="small">
              {RUNBOOKS.filter(r => r.automated).length} automated, {RUNBOOKS.filter(r => !r.automated).length} manual
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Avg Success Rate
            </Text>
            <Heading level={2}>
              {Math.round(RUNBOOKS.reduce((sum, r) => sum + r.successRate, 0) / RUNBOOKS.length)}%
            </Heading>
            <ProgressBar 
              value={Math.round(RUNBOOKS.reduce((sum, r) => sum + r.successRate, 0) / RUNBOOKS.length)} 
            />
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Automation Coverage
            </Text>
            <Heading level={2}>
              {Math.round((RUNBOOKS.filter(r => r.automated).length / RUNBOOKS.length) * 100)}%
            </Heading>
            <Text textStyle="small">
              of runbooks are automated
            </Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        <Button
          variant={selectedTab === 'runbooks' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('runbooks')}
        >
          Runbooks ({RUNBOOKS.length})
        </Button>
        <Button
          variant={selectedTab === 'incidents' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('incidents')}
        >
          Active Incidents ({activeIncidents.length})
        </Button>
        <Button
          variant={selectedTab === 'automation' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('automation')}
        >
          Automation Rules
        </Button>
      </Flex>

      {/* Tab Content */}
      {selectedTab === 'runbooks' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Operational Runbooks</Heading>
            <Flex flexDirection="column" gap={8}>
              {RUNBOOKS.map((runbook) => (
                <Surface key={runbook.id} style={{ padding: 12 }}>
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                      <Flex alignItems="center" gap={8}>
                        <span>{getCategoryIcon(runbook.category)}</span>
                        <Text style={{ fontWeight: 600 }}>{runbook.name}</Text>
                        <Text textStyle="small" style={{ 
                          padding: '2px 6px', 
                          backgroundColor: runbook.automated ? 'rgba(0, 200, 100, 0.2)' : 'var(--dt-colors-background-default-secondary)',
                          borderRadius: 4,
                          fontSize: 10
                        }}>
                          {runbook.automated ? '✅ Automated' : '👤 Manual'}
                        </Text>
                      </Flex>
                      <Text textStyle="small">{runbook.description}</Text>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        Trigger: {runbook.trigger}
                      </Text>
                      <Flex alignItems="center" gap={8}>
                        <Text textStyle="small">Success Rate: {runbook.successRate}%</Text>
                        <ProgressBar value={runbook.successRate} style={{ width: 100 }} />
                      </Flex>
                    </Flex>
                    <Button
                      variant="default"
                      onClick={() => executeRunbook(runbook.id)}
                      disabled={executingRunbook === runbook.id}
                    >
                      {executingRunbook === runbook.id ? 'Running...' : 'Execute'}
                    </Button>
                  </Flex>
                </Surface>
              ))}
            </Flex>
          </Flex>
        </Surface>
      )}

      {selectedTab === 'incidents' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Active Incidents</Heading>
            {loading ? (
              <Text>Loading incidents...</Text>
            ) : activeIncidents.length === 0 ? (
              <Surface style={{ padding: 24, textAlign: 'center' }}>
                <Text style={{ color: Colors.Text.Success.Default }}>
                  ✅ No active incidents detected. All services operating normally.
                </Text>
              </Surface>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {activeIncidents.map((incident) => (
                  <Surface key={incident.id} style={{ 
                    padding: 12,
                    borderLeft: `4px solid ${
                      incident.severity === 'critical' ? Colors.Charts.Apdex.Poor.Default :
                      incident.severity === 'high' ? Colors.Charts.Apdex.Fair.Default :
                      Colors.Charts.Apdex.Good.Default
                    }`
                  }}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                        <Flex alignItems="center" gap={8}>
                          <span>{getSeverityIcon(incident.severity)}</span>
                          <Text style={{ fontWeight: 600 }}>{incident.title}</Text>
                          <Text textStyle="small" style={{ 
                            padding: '2px 6px', 
                            backgroundColor: 'var(--dt-colors-background-default-secondary)',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            fontSize: 10
                          }}>
                            {incident.status}
                          </Text>
                        </Flex>
                        <Flex gap={16}>
                          <Text textStyle="small">Service: {incident.service}</Text>
                          <Text textStyle="small">Model: {incident.model}</Text>
                        </Flex>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                          Suggested: {RUNBOOKS.find(r => r.id === incident.suggestedRunbook)?.name || incident.suggestedRunbook}
                        </Text>
                      </Flex>
                      <Button variant="default" onClick={() => executeRunbook(incident.suggestedRunbook)}>
                        Run Playbook
                      </Button>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {selectedTab === 'automation' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Automation Rules</Heading>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>
              Configure automatic runbook execution based on detected conditions.
            </Text>
            
            <Flex flexDirection="column" gap={8}>
              {RUNBOOKS.filter(r => r.automated).map((runbook) => (
                <Surface key={runbook.id} style={{ padding: 12, backgroundColor: 'rgba(0, 200, 100, 0.1)' }}>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex flexDirection="column" gap={4}>
                      <Text><strong>{runbook.name}</strong></Text>
                      <Text textStyle="small">Trigger: {runbook.trigger}</Text>
                    </Flex>
                    <Text style={{ color: Colors.Text.Success.Default }}>✅ Active</Text>
                  </Flex>
                </Surface>
              ))}
            </Flex>

            <Surface style={{ padding: 12, backgroundColor: 'rgba(0, 150, 255, 0.1)', marginTop: 8 }}>
              <Text>
                <strong>Tip:</strong> Enable Dynatrace Workflows integration to connect runbooks 
                with automated remediation actions like ServiceNow tickets or Slack notifications.
              </Text>
            </Surface>
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default Operations;
