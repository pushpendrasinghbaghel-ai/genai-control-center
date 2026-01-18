// GenAI Control Center - Operations Dashboard
// Runbooks, Remediation, and Operational Response

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressBar } from '@dynatrace/strato-components/content';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { 
  ClockIcon, CriticalIcon, MoneyIcon, SecurityIcon, DocumentIcon, 
  RefreshIcon, WarningIcon, CheckmarkIcon, StopIcon, SettingIcon, HelpIcon, WorkflowsIcon 
} from '@dynatrace/strato-icons';
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

interface QuickAction {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: React.ReactNode;
  isDestructive: boolean;
}

// Pre-defined runbooks for GenAI operations (Sample Data)
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
];

// Quick Actions for one-click remediation (Sample - requires Workflow integration)
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'kill_switch', name: 'Kill Switch', type: 'kill_switch', description: 'Immediately stop all AI requests to a provider', icon: <StopIcon style={{ width: 16, height: 16, color: 'var(--dt-colors-feedback-critical-default)' }} />, isDestructive: true },
  { id: 'fallback_trigger', name: 'Trigger Fallback', type: 'fallback_trigger', description: 'Route traffic to backup provider', icon: <RefreshIcon style={{ width: 16, height: 16 }} />, isDestructive: false },
  { id: 'rate_limit', name: 'Apply Rate Limit', type: 'rate_limit', description: 'Throttle requests to prevent overload', icon: <ClockIcon style={{ width: 16, height: 16 }} />, isDestructive: false },
  { id: 'cache_enable', name: 'Enable Caching', type: 'cache_enable', description: 'Enable response caching for common queries', icon: <SettingIcon style={{ width: 16, height: 16 }} />, isDestructive: false },
];

export const Operations: React.FC = () => {
  const [filters] = useState<QueryFilters>({});
  const [selectedTab, setSelectedTab] = useState<'runbooks' | 'incidents' | 'automation' | 'actions'>('runbooks');
  const [executingRunbook, setExecutingRunbook] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [actionTarget, setActionTarget] = useState('');
  
  const { data: services, loading } = useAIServicesDiscovery(filters);

  // Generate active incidents based on service data
  const activeIncidents = useMemo((): ActiveIncident[] => {
    if (!services) return [];
    
    const incidents: ActiveIncident[] = [];
    
    services.forEach((service) => {
      // Use slowRequestRate for GenAI-specific quality monitoring (error rate is typically 0% for GenAI spans)
      const slowRate = service.slowRequestRate || 0;
      if (slowRate > 10) {
        incidents.push({
          id: `slow-${service.serviceName}`,
          title: `High slow request rate on ${service.serviceName}`,
          severity: slowRate > 20 ? 'critical' : 'high',
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
  const getCategoryIcon = (category: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      performance: <ClockIcon style={{ width: 14, height: 14 }} />,
      errors: <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />,
      cost: <MoneyIcon style={{ width: 14, height: 14 }} />,
      security: <SecurityIcon style={{ width: 14, height: 14 }} />,
    };
    return icons[category] || <DocumentIcon style={{ width: 14, height: 14 }} />;
  };

  // Severity icons helper
  const getSeverityIcon = (severity: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      critical: <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />,
      high: <WarningIcon style={{ width: 14, height: 14, color: '#ff5722' }} />,
      medium: <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-warning-default)' }} />,
      low: <CheckmarkIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-success-default)' }} />,
    };
    return icons[severity] || <DocumentIcon style={{ width: 14, height: 14 }} />;
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <WorkflowsIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Operations Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>Runbooks & automated response</TitleBar.Subtitle>
      </TitleBar>

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
          variant={selectedTab === 'actions' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('actions')}
        >
          Quick Actions
        </Button>
        <Button
          variant={selectedTab === 'automation' ? 'emphasized' : 'default'}
          onClick={() => setSelectedTab('automation')}
        >
          Automation Rules
        </Button>
      </Flex>

      {/* Sample Data Disclaimer */}
      <Surface style={{ padding: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={8}>
          <DocumentIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            <strong>Note:</strong> Runbook success rates and quick actions are sample templates. 
            Connect to Dynatrace Workflows for production automation.
          </Text>
        </Flex>
      </Surface>

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
                          {runbook.automated 
                          ? <Flex alignItems="center" gap={2}><WorkflowsIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-feedback-success-default)' }} /> Automated</Flex> 
                          : <Flex alignItems="center" gap={2}><HelpIcon style={{ width: 10, height: 10 }} /> Manual</Flex>
                        }
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
                <Text style={{ color: Colors.Text.Success.Default, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckmarkIcon style={{ width: 16, height: 16 }} /> No active incidents detected. All services operating normally.
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

      {selectedTab === 'actions' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Flex justifyContent="space-between" alignItems="center">
              <Heading level={6}>Quick Actions</Heading>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                One-click remediation for common issues
              </Text>
            </Flex>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              {QUICK_ACTIONS.map((action) => (
                <Surface key={action.id} style={{ 
                  padding: 16,
                  borderLeft: action.isDestructive 
                    ? '4px solid var(--dt-colors-feedback-critical-default)'
                    : '4px solid var(--dt-colors-charts-categorical-default-1)'
                }}>
                  <Flex flexDirection="column" gap={8}>
                    <Flex alignItems="center" gap={8}>
                      <span style={{ fontSize: 24 }}>{action.icon}</span>
                      <Text style={{ fontWeight: 600 }}>{action.name}</Text>
                      {action.isDestructive && (
                        <Text textStyle="small" style={{ 
                          padding: '2px 6px',
                          backgroundColor: 'var(--dt-colors-feedback-critical-subtle)',
                          color: 'var(--dt-colors-feedback-critical-default)',
                          borderRadius: 4,
                          fontSize: 10,
                          textTransform: 'uppercase'
                        }}>
                          Destructive
                        </Text>
                      )}
                    </Flex>
                    <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                      {action.description}
                    </Text>
                    <Button 
                      variant="default"
                      color={action.isDestructive ? 'critical' : undefined}
                      onClick={() => {
                        setSelectedAction(action);
                        setShowActionModal(true);
                      }}
                    >
                      Configure & Execute
                    </Button>
                  </Flex>
                </Surface>
              ))}
            </div>
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
                    <Flex alignItems="center" gap={4}>
                      <CheckmarkIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-success-default)' }} />
                      <Text style={{ color: Colors.Text.Success.Default }}>Active</Text>
                    </Flex>
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

      {/* Quick Action Confirmation Modal */}
      <Modal
        title={`Execute: ${selectedAction?.name || ''}`}
        show={showActionModal}
        onDismiss={() => {
          setShowActionModal(false);
          setSelectedAction(null);
          setActionTarget('');
        }}
      >
        <Flex flexDirection="column" gap={16} padding={16}>
          <Text>{selectedAction?.description}</Text>
          
          {selectedAction?.isDestructive && (
            <Surface style={{ backgroundColor: 'var(--dt-colors-feedback-critical-subtle)', padding: 12 }}>
              <Flex alignItems="center" gap={8}>
                <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />
                <Text style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>
                  This is a destructive action and may impact production services.
                </Text>
              </Flex>
            </Surface>
          )}

          <div>
            <Text textStyle="small" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Target Service / Provider
            </Text>
            <TextInput
              value={actionTarget}
              onChange={(value) => setActionTarget(value)}
              placeholder="Enter service or provider name..."
            />
          </div>

          {services && services.length > 0 && (
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Available: {services.slice(0, 5).map(s => s.serviceName).join(', ')}
              {services.length > 5 && ` +${services.length - 5} more`}
            </Text>
          )}

          <Surface style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 12 }}>
            <Text textStyle="small">
              <strong>Demo Mode:</strong> This action is simulated. Connect to Dynatrace Workflows for production use.
            </Text>
          </Surface>

          <Flex gap={12} justifyContent="flex-end">
            <Button onClick={() => {
              setShowActionModal(false);
              setSelectedAction(null);
              setActionTarget('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="accent"
              color={selectedAction?.isDestructive ? 'critical' : undefined}
              onClick={() => {
                // Simulate execution
                setShowActionModal(false);
                setSelectedAction(null);
                setActionTarget('');
              }}
              disabled={!actionTarget.trim()}
            >
              Execute
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
};

export default Operations;
