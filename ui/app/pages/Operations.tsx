// GenAI Control Center - Operations Dashboard
// Surfaces real DQL-backed operational data: active incidents, service health, live problems

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { 
  CriticalIcon, WarningIcon, CheckmarkIcon, WorkflowsIcon, RefreshIcon
} from '@dynatrace/strato-icons';
import { useAIServicesDiscovery } from '../hooks/useDQLQueries';
import type { QueryFilters } from '../hooks/useDQLQueries';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useLiveProblems } from '../hooks/useWorkflows';

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
  const [selectedTab, setSelectedTab] = useState<'incidents' | 'problems'>('incidents');
  
  const { data: services, loading, refetch: refetchServices } = useAIServicesDiscovery(filters);
  const { genaiProblems, otherProblems, loading: problemsLoading, refetch: refetchProblems } = useLiveProblems(null);

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
          severity: service.avgLatency > 10000 ? 'critical' : 'open',
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
        <TitleBar.Subtitle>Live incidents & Davis problems from Grail data</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button variant="default" onClick={() => { refetchServices?.(); refetchProblems(); }}>
            <RefreshIcon /> Refresh
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Status Overview — all from real DQL data */}
      <Flex gap={16}>
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
              {activeIncidents.filter(i => i.severity === 'critical').length} critical, {activeIncidents.filter(i => i.severity === 'high').length} high
            </Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>GenAI Problems</Text>
            <Heading level={2} style={{ color: genaiProblems.length > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
              {problemsLoading ? '…' : genaiProblems.length}
            </Heading>
            <Text textStyle="small">Davis-detected problems on AI services</Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Monitored Services</Text>
            <Heading level={2}>{loading ? '…' : (services?.length || 0)}</Heading>
            <Text textStyle="small">AI service endpoints tracked via gen_ai.* spans</Text>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>All Problems</Text>
            <Heading level={2}>{problemsLoading ? '…' : (genaiProblems.length + otherProblems.length)}</Heading>
            <Text textStyle="small">Total open Davis problems in environment</Text>
          </Flex>
        </Surface>
      </Flex>

      {/* Tab Navigation */}
      <Flex gap={8}>
        <Button variant={selectedTab === 'incidents' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('incidents')}>
          Service Incidents ({activeIncidents.length})
        </Button>
        <Button variant={selectedTab === 'problems' ? 'emphasized' : 'default'} onClick={() => setSelectedTab('problems')}>
          Davis Problems ({genaiProblems.length})
        </Button>
      </Flex>

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
