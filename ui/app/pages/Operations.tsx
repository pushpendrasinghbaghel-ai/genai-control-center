// GenAI Control Center - Operations Dashboard
// Surfaces real DQL-backed operational data: active incidents, service health, live problems, and real workflows

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { 
  CriticalIcon, WarningIcon, CheckmarkIcon, WorkflowsIcon, RefreshIcon, PlayIcon
} from '@dynatrace/strato-icons';
import { useAIServicesDiscovery } from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useLiveProblems } from '../hooks/useWorkflows';
import { useAgenticWorkflows, type RealWorkflow, type RealExecution } from '../hooks/useAgenticWorkflows';

interface ActiveIncident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  service: string;
  model: string;
  status: 'open' | 'investigating';
}

export const Operations: React.FC = () => {
  const [filters] = useState<QueryFilters>({});
  const [selectedTab, setSelectedTab] = useState<'incidents' | 'problems' | 'workflows' | 'executions'>('workflows');
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  
  const { data: services, loading, refetch: refetchServices } = useAIServicesDiscovery(filters);
  const { genaiProblems, otherProblems, loading: problemsLoading, refetch: refetchProblems } = useLiveProblems(null);
  const { 
    realWorkflows, 
    realExecutions, 
    stats: workflowStats, 
    loading: workflowsLoading, 
    refresh: refetchWorkflows,
    executeWorkflow 
  } = useAgenticWorkflows('24h');

  const handleRunWorkflow = async (workflowId: string) => {
    setExecutingWorkflow(workflowId);
    try {
      await executeWorkflow(workflowId);
    } catch (err) {
      console.error('Failed to execute workflow:', err);
    } finally {
      setExecutingWorkflow(null);
    }
  };

  const handleRefresh = () => {
    refetchServices?.();
    refetchProblems();
    refetchWorkflows();
  };

  // Generate active incidents based on REAL service data thresholds
  const activeIncidents = useMemo((): ActiveIncident[] => {
    if (!services) return [];
    
    const incidents: ActiveIncident[] = [];
    
    services.forEach((service) => {
      const slowRate = service.slowRequestRate || 0;
      if (slowRate > 10) {
        incidents.push({
          id: `slow-${service.serviceName}`,
          title: `High slow request rate on ${service.serviceName}`,
          severity: slowRate > 20 ? 'critical' : 'high',
          service: service.serviceName,
          model: service.modelName,
          status: 'investigating',
        });
      }
      
      if (service.avgLatency > 5000) {
        incidents.push({
          id: `lat-${service.serviceName}`,
          title: `High latency on ${service.serviceName}`,
          severity: service.avgLatency > 10000 ? 'critical' : 'medium',
          service: service.serviceName,
          model: service.modelName,
          status: 'open',
        });
      }
    });
    
    return incidents.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [services]);

  const getSeverityIcon = (severity: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      critical: <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />,
      high: <WarningIcon style={{ width: 14, height: 14, color: '#ff5722' }} />,
      medium: <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-warning-default)' }} />,
      low: <CheckmarkIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-success-default)' }} />,
    };
    return icons[severity] || null;
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <WorkflowsIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>Operations Dashboard</TitleBar.Title>
        <TitleBar.Subtitle>Live workflows, incidents & Davis problems from Dynatrace</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button variant="default" onClick={handleRefresh}>
            <RefreshIcon /> Refresh
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Status Overview — workflows + incidents + problems */}
      <Flex gap={16}>
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Active Workflows</Text>
            <Heading level={2} style={{ color: Colors.Text.Neutral.Default }}>
              {workflowsLoading ? '…' : realWorkflows.filter(w => w.state === 'ENABLED').length}
            </Heading>
            <Text textStyle="small">
              {realWorkflows.length} total, {realWorkflows.filter(w => w.state === 'ENABLED').length} enabled
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Recent Executions</Text>
            <Heading level={2} style={{ 
              color: workflowStats.failed > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default 
            }}>
              {workflowsLoading ? '…' : realExecutions.length}
            </Heading>
            <Text textStyle="small">
              {realExecutions.filter(e => e.state === 'SUCCESS').length} success, {realExecutions.filter(e => e.state === 'ERROR').length} failed
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Active Incidents</Text>
            <Heading level={2} style={{ 
              color: activeIncidents.filter(i => i.severity === 'critical').length > 0 
                ? Colors.Text.Critical.Default 
                : Colors.Text.Neutral.Default 
            }}>
              {activeIncidents.length}
            </Heading>
            <Text textStyle="small">
              {activeIncidents.filter(i => i.severity === 'critical').length} critical
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Davis Problems</Text>
            <Heading level={2} style={{ color: genaiProblems.length > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
              {problemsLoading ? '…' : genaiProblems.length}
            </Heading>
            <Text textStyle="small">{otherProblems.length} other problems</Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        <Button variant={selectedTab === 'workflows' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('workflows')}>
          Workflows ({realWorkflows.length})
        </Button>
        <Button variant={selectedTab === 'executions' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('executions')}>
          Executions ({realExecutions.length})
        </Button>
        <Button variant={selectedTab === 'incidents' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('incidents')}>
          Incidents ({activeIncidents.length})
        </Button>
        <Button variant={selectedTab === 'problems' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('problems')}>
          Problems ({genaiProblems.length})
        </Button>
      </Flex>

      {/* Workflows Tab - Real workflows from Dynatrace Automation */}
      {selectedTab === 'workflows' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Dynatrace Workflows (from Automation API)</Heading>
            {workflowsLoading ? (
              <Text>Loading workflows…</Text>
            ) : realWorkflows.length === 0 ? (
              <Surface style={{ padding: 24, textAlign: 'center' }}>
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                  No workflows found. Create workflows in Dynatrace Automation to see them here.
                </Text>
              </Surface>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {realWorkflows.map((workflow) => (
                  <Surface key={workflow.id} style={{ 
                    padding: 12,
                    borderLeft: `4px solid ${
                      workflow.state === 'ENABLED' ? Colors.Charts.Apdex.Good.Default : Colors.Border.Neutral.Default
                    }`
                  }}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                        <Flex alignItems="center" gap={8}>
                          <WorkflowsIcon style={{ width: 14, height: 14 }} />
                          <Text style={{ fontWeight: 600 }}>{workflow.title}</Text>
                          <Text textStyle="small" style={{ 
                            padding: '2px 6px', 
                            backgroundColor: workflow.state === 'ENABLED' ? 'rgba(0,200,0,0.1)' : 'rgba(128,128,128,0.1)',
                            borderRadius: 4, textTransform: 'uppercase', fontSize: 10,
                            color: workflow.state === 'ENABLED' ? Colors.Text.Success.Default : Colors.Text.Neutral.Subdued
                          }}>
                            {workflow.state}
                          </Text>
                        </Flex>
                        {workflow.description && (
                          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                            {workflow.description}
                          </Text>
                        )}
                        <Flex gap={16}>
                          <Text textStyle="small">Owner: {workflow.owner}</Text>
                          <Text textStyle="small">ID: {workflow.id.slice(0, 8)}…</Text>
                          {workflow.lastExecution && (
                            <Text textStyle="small" style={{ 
                              color: workflow.lastExecution.state === 'SUCCESS' 
                                ? Colors.Text.Success.Default 
                                : workflow.lastExecution.state === 'ERROR' 
                                  ? Colors.Text.Critical.Default 
                                  : Colors.Text.Neutral.Subdued 
                            }}>
                              Last run: {workflow.lastExecution.state}
                            </Text>
                          )}
                        </Flex>
                      </Flex>
                      <Button 
                        variant="accent" 
                        onClick={() => handleRunWorkflow(workflow.id)}
                        disabled={executingWorkflow === workflow.id || workflow.state === 'DISABLED'}
                      >
                        {executingWorkflow === workflow.id ? 'Running…' : <><PlayIcon /> Run</>}
                      </Button>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {/* Executions Tab - Recent workflow executions */}
      {selectedTab === 'executions' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Recent Workflow Executions</Heading>
            {workflowsLoading ? (
              <Text>Loading executions…</Text>
            ) : realExecutions.length === 0 ? (
              <Surface style={{ padding: 24, textAlign: 'center' }}>
                <Text style={{ color: Colors.Text.Neutral.Subdued }}>
                  No recent executions. Run a workflow to see execution history.
                </Text>
              </Surface>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {realExecutions.map((execution) => (
                  <Surface key={execution.id} style={{ 
                    padding: 12,
                    borderLeft: `4px solid ${
                      execution.state === 'SUCCESS' ? Colors.Charts.Apdex.Good.Default :
                      execution.state === 'ERROR' ? Colors.Charts.Apdex.Poor.Default :
                      execution.state === 'RUNNING' ? Colors.Charts.Apdex.Fair.Default :
                      Colors.Border.Neutral.Default
                    }`
                  }}>
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        {execution.state === 'SUCCESS' && <CheckmarkIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-success-default)' }} />}
                        {execution.state === 'ERROR' && <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />}
                        {execution.state === 'RUNNING' && <WorkflowsIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-warning-default)' }} />}
                        <Text style={{ fontWeight: 600 }}>{execution.title}</Text>
                        <Text textStyle="small" style={{ 
                          padding: '2px 6px', 
                          backgroundColor: execution.state === 'SUCCESS' ? 'rgba(0,200,0,0.1)' : 
                            execution.state === 'ERROR' ? 'rgba(255,0,0,0.1)' : 
                            execution.state === 'RUNNING' ? 'rgba(255,165,0,0.1)' : 'rgba(128,128,128,0.1)',
                          borderRadius: 4, fontSize: 10, textTransform: 'uppercase'
                        }}>
                          {execution.state}
                        </Text>
                      </Flex>
                      <Flex gap={16}>
                        <Text textStyle="small">ID: {execution.id.slice(0, 8)}…</Text>
                        <Text textStyle="small">Trigger: {execution.trigger}</Text>
                        {execution.user && <Text textStyle="small">User: {execution.user}</Text>}
                      </Flex>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        Started: {new Date(execution.startTime).toLocaleString()}
                        {execution.endTime && ` — Ended: ${new Date(execution.endTime).toLocaleString()}`}
                      </Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}

      {/* Service Incidents — derived from real DQL service data */}
      {selectedTab === 'incidents' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Active Incidents (from DQL service metrics)</Heading>
            {loading ? (
              <Text>Loading incidents…</Text>
            ) : activeIncidents.length === 0 ? (
              <Surface style={{ padding: 24, textAlign: 'center' }}>
                <Text style={{ color: Colors.Text.Success.Default, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckmarkIcon style={{ width: 16, height: 16 }} /> No active incidents. All services operating normally.
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
                            padding: '2px 6px', backgroundColor: 'var(--dt-colors-background-default-secondary)',
                            borderRadius: 4, textTransform: 'uppercase', fontSize: 10
                          }}>
                            {incident.status}
                          </Text>
                        </Flex>
                        <Flex gap={16}>
                          <Text textStyle="small">Service: {incident.service}</Text>
                          <Text textStyle="small">Model: {incident.model}</Text>
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

      {/* Davis Problems — real live problems from dt.davis.problems */}
      {selectedTab === 'problems' && (
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Davis Problems (GenAI-related)</Heading>
            {problemsLoading ? (
              <Text>Loading problems…</Text>
            ) : genaiProblems.length === 0 ? (
              <Surface style={{ padding: 24, textAlign: 'center' }}>
                <Text style={{ color: Colors.Text.Success.Default, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckmarkIcon style={{ width: 16, height: 16 }} /> No GenAI-related Davis problems detected.
                </Text>
              </Surface>
            ) : (
              <Flex flexDirection="column" gap={8}>
                {genaiProblems.map((problem) => (
                  <Surface key={problem.problemId} style={{ 
                    padding: 12,
                    borderLeft: `4px solid ${
                      problem.severity === 'ERROR' ? Colors.Charts.Apdex.Poor.Default :
                      problem.severity === 'PERFORMANCE' ? Colors.Charts.Apdex.Fair.Default :
                      Colors.Charts.Apdex.Good.Default
                    }`
                  }}>
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />
                        <Text style={{ fontWeight: 600 }}>{problem.title}</Text>
                        <Text textStyle="small" style={{ 
                          padding: '2px 6px', backgroundColor: problem.status === 'OPEN' ? 'rgba(255,0,0,0.1)' : 'rgba(0,200,0,0.1)',
                          borderRadius: 4, fontSize: 10, textTransform: 'uppercase'
                        }}>
                          {problem.status}
                        </Text>
                      </Flex>
                      <Flex gap={16}>
                        <Text textStyle="small">ID: {problem.displayId}</Text>
                        <Text textStyle="small">Severity: {problem.severity}</Text>
                        {problem.rootCauseEntity && <Text textStyle="small">Root cause: {problem.rootCauseEntity}</Text>}
                      </Flex>
                      <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                        Started: {new Date(problem.startTime).toLocaleString()}
                        {problem.endTime && ` — Ended: ${new Date(problem.endTime).toLocaleString()}`}
                      </Text>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            )}
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default Operations;
