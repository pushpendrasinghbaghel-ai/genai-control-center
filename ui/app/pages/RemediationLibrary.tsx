// Remediation Library - Pillar D: One-Click Automation Actions

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { StopIcon, RefreshIcon, ClockIcon, SettingIcon, ArrowRightIcon, NotificationIcon, WorkflowsIcon, WarningIcon, MailIcon, BarChartIcon } from '@dynatrace/strato-icons';
import { useRemediation, useRemediationActions, useAIServicesDiscovery } from '../hooks';
import type { RemediationAction, WorkflowExecution } from '../types';

// Agentic Workflow Templates
const AGENTIC_WORKFLOWS = [
  {
    id: 'finops-digest',
    title: 'Weekly FinOps Digest',
    description: 'Dynatrace Intelligence analyzes GenAI costs weekly and sends executive summary via email',
    icon: <MailIcon style={{ width: 20, height: 20 }} />,
    trigger: 'Every Monday 9 AM UTC',
    features: ['DQL cost aggregation', 'Dynatrace Intelligence Analysis', 'Email digest'],
    deployUrl: 'https://demo.apps.dynatrace.com/ui/apps/dynatrace.workflows/builder'
  },
  {
    id: 'budget-alert',
    title: 'Token Budget Alert',
    description: 'Alert when token usage exceeds 80% of configured budget threshold',
    icon: <BarChartIcon style={{ width: 20, height: 20 }} />,
    trigger: 'Hourly check',
    features: ['Budget monitoring', 'Slack notification', 'Usage %'],
    deployUrl: 'https://demo.apps.dynatrace.com/ui/apps/dynatrace.workflows/builder'
  },
  {
    id: 'error-monitor',
    title: 'Model Error Rate Monitor',
    description: 'Monitors error rates and creates ServiceNow incidents on spikes',
    icon: <WarningIcon style={{ width: 20, height: 20, color: 'var(--dt-colors-feedback-critical-default)' }} />,
    trigger: 'Davis Problem',
    features: ['Davis problem trigger', 'Root cause analysis', 'ServiceNow ticket'],
    deployUrl: 'https://demo.apps.dynatrace.com/ui/apps/dynatrace.workflows/builder'
  }
];

// Agentic Workflow Card Component
const AgenticWorkflowCard: React.FC<{
  workflow: typeof AGENTIC_WORKFLOWS[0];
  onDeploy: (id: string) => void;
}> = ({ workflow, onDeploy }) => (
  <Surface style={{ padding: 16, borderRadius: 8, border: '1px solid var(--dt-colors-border-neutral-default)' }}>
    <Flex flexDirection="column" gap={12}>
      <Flex alignItems="center" gap={8}>
        <span style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--dt-colors-charts-categorical-default-6)',
          color: 'white'
        }}>
          {workflow.icon}
        </span>
        <Flex flexDirection="column" style={{ flex: 1 }}>
          <Text style={{ fontWeight: 600, fontSize: 14 }}>{workflow.title}</Text>
          <Text style={{ fontSize: 11, opacity: 0.7 }}>Trigger: {workflow.trigger}</Text>
        </Flex>
        <Tooltip text="Agentic Workflow powered by Dynatrace Intelligence">
          <span style={{ 
            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
            background: '#7c3aed', color: 'white'
          }}>
            AGENTIC
          </span>
        </Tooltip>
      </Flex>
      
      <Text style={{ fontSize: 12, opacity: 0.85 }}>{workflow.description}</Text>
      
      <Flex gap={4} flexWrap="wrap">
        {workflow.features.map((f, i) => (
          <span key={i} style={{ 
            padding: '2px 6px', borderRadius: 4, fontSize: 10,
            background: 'var(--dt-colors-surface-neutral-default)',
            border: '1px solid var(--dt-colors-border-neutral-default)'
          }}>
            {f}
          </span>
        ))}
      </Flex>
      
      <Flex justifyContent="flex-end">
        <Button variant="accent" onClick={() => onDeploy(workflow.id)}>
          <WorkflowsIcon style={{ width: 14, height: 14 }} /> Deploy to Workflows
        </Button>
      </Flex>
    </Flex>
  </Surface>
);

// Action Card Component - Compact
const ActionCard: React.FC<{
  action: RemediationAction;
  onExecute: (action: RemediationAction) => void;
}> = ({ action, onExecute }) => {
  const icons: Record<string, React.ReactNode> = {
    'kill_switch': <StopIcon style={{ width: 20, height: 20, color: 'var(--dt-colors-feedback-critical-default)' }} />,
    'fallback_trigger': <RefreshIcon style={{ width: 20, height: 20 }} />,
    'rate_limit': <ClockIcon style={{ width: 20, height: 20 }} />,
    'cache_enable': <SettingIcon style={{ width: 20, height: 20 }} />,
    'provider_switch': <ArrowRightIcon style={{ width: 20, height: 20 }} />,
    'alert_suppress': <NotificationIcon style={{ width: 20, height: 20 }} />
  };

  return (
    <Flex 
      flexDirection="column" 
      padding={12} 
      gap={8}
      style={{ 
        background: 'var(--dt-colors-surface-default)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-border-neutral-default)',
        borderLeft: action.isDestructive 
          ? '3px solid var(--dt-colors-feedback-critical-default)' 
          : '3px solid var(--dt-colors-charts-categorical-default-1)'
      }}
    >
      <Flex alignItems="center" gap={8}>
        <span style={{ display: 'flex', alignItems: 'center' }}>{icons[action.type] || <WorkflowsIcon style={{ width: 20, height: 20 }} />}</span>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{action.name}</span>
        {action.isDestructive && (
          <Flex alignItems="center" gap={2} style={{ 
            fontSize: 9, padding: '2px 5px', 
            background: 'var(--dt-colors-feedback-critical-subtle)',
            color: 'var(--dt-colors-feedback-critical-default)',
            borderRadius: 3, textTransform: 'uppercase', fontWeight: 600
          }}>
            <WarningIcon style={{ width: 10, height: 10 }} />
            Destructive
          </Flex>
        )}
      </Flex>
      <span style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12 }}>
        {action.description}
      </span>
      <Flex justifyContent="flex-end">
        <Button 
          color={action.isDestructive ? 'critical' : 'primary'}
          onClick={() => onExecute(action)}
        >
          Configure
        </Button>
      </Flex>
    </Flex>
  );
};

// Execution History Component - Compact
const ExecutionHistory: React.FC<{ executions: WorkflowExecution[] }> = ({ executions }) => {
  if (executions.length === 0) {
    return (
      <span style={{ color: 'var(--dt-colors-text-secondary-default)', padding: 12, fontSize: 12 }}>
        No executions yet.
      </span>
    );
  }

  return (
    <Flex flexDirection="column" gap={6}>
      {executions.map(execution => (
        <Flex 
          key={execution.id} 
          padding={8} 
          justifyContent="space-between" 
          alignItems="center"
          style={{
            background: 'var(--dt-colors-surface-default)',
            borderRadius: 4,
            border: '1px solid var(--dt-colors-border-neutral-default)'
          }}
        >
          <Flex alignItems="center" gap={8}>
            <span style={{ 
              fontSize: 10, padding: '3px 6px', borderRadius: 3,
              background: execution.status === 'completed' 
                ? 'var(--dt-colors-feedback-success-subtle)'
                : execution.status === 'failed'
                  ? 'var(--dt-colors-feedback-critical-subtle)'
                  : 'var(--dt-colors-feedback-info-subtle)',
              color: execution.status === 'completed'
                ? 'var(--dt-colors-feedback-success-default)'
                : execution.status === 'failed'
                  ? 'var(--dt-colors-feedback-critical-default)'
                  : 'var(--dt-colors-feedback-info-default)',
              textTransform: 'uppercase', fontWeight: 600
            }}>
              {execution.status}
            </span>
            <span style={{ fontSize: 12 }}>{execution.workflowId}</span>
          </Flex>
          <span style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>
            {execution.startTime.toLocaleTimeString()}
          </span>
        </Flex>
      ))}
    </Flex>
  );
};

export const RemediationLibrary: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service');

  const [selectedAction, setSelectedAction] = useState<RemediationAction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionParams, setActionParams] = useState<Record<string, string>>({});

  const { data: services } = useAIServicesDiscovery();
  const { actions } = useRemediationActions();
  const { executions, isExecuting, executeRemediation } = useRemediation();

  const handleExecute = (action: RemediationAction) => {
    setSelectedAction(action);
    setActionParams({
      serviceName: preselectedService || '',
      ...Object.fromEntries(
        Object.entries(action.parameters).map(([key, value]) => [key, String(value)])
      )
    });
    setShowModal(true);
  };

  const handleConfirmExecute = async () => {
    if (!selectedAction) return;
    await executeRemediation(selectedAction, actionParams);
    setShowModal(false);
    setSelectedAction(null);
    setActionParams({});
  };

  const handleCancel = () => {
    setShowModal(false);
    setSelectedAction(null);
    setActionParams({});
  };

  const handleDeployWorkflow = (workflowId: string) => {
    // Open Dynatrace Workflows app in new tab
    const workflow = AGENTIC_WORKFLOWS.find(w => w.id === workflowId);
    if (workflow) {
      window.open(workflow.deployUrl, '_blank');
    }
  };

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Agentic Workflows Section */}
      <Flex flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={8}>
          <WorkflowsIcon style={{ width: 18, height: 18, color: '#7c3aed' }} />
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
            Agentic Workflow Templates
          </Text>
          <Tooltip text="Powered by Dynatrace Intelligence - autonomous workflows that analyze, decide, and act">
            <span style={{ 
              padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
              background: '#7c3aed', color: 'white'
            }}>
              PREVIEW
            </span>
          </Tooltip>
        </Flex>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {AGENTIC_WORKFLOWS.map(workflow => (
            <AgenticWorkflowCard key={workflow.id} workflow={workflow} onDeploy={handleDeployWorkflow} />
          ))}
        </div>
      </Flex>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--dt-colors-border-neutral-default)', margin: '8px 0' }} />

      {/* Quick Actions Header */}
      <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
        Quick Actions
      </Text>

      {/* Warning Banner - Compact */}
      <Flex padding={12} alignItems="center" gap={8} style={{
        background: 'var(--dt-colors-feedback-warning-subtle)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-feedback-warning-default)'
      }}>
        <WarningIcon style={{ width: 18, height: 18, color: 'var(--dt-colors-feedback-warning-default)' }} />
        <div>
          <span style={{ fontWeight: 600, fontSize: 12 }}>Safety Notice</span>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, marginLeft: 6 }}>
            Destructive actions (red) can impact production. Verify target before executing.
          </span>
        </div>
      </Flex>

      {/* Two Column Layout */}
      <Flex gap={16}>
        {/* Actions Grid */}
        <Flex flexDirection="column" gap={12} style={{ flex: 2 }}>
          <Heading level={6}>Available Actions</Heading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {actions.map(action => (
              <ActionCard key={action.id} action={action} onExecute={handleExecute} />
            ))}
          </div>
        </Flex>

        {/* Execution History */}
        <Flex flexDirection="column" gap={12} style={{ flex: 1, minWidth: 220 }}>
          <Heading level={6}>Execution History</Heading>
          <ExecutionHistory executions={executions} />
        </Flex>
      </Flex>

      {/* Confirmation Modal */}
      <Modal 
        title={`Execute: ${selectedAction?.name || ''}`}
        show={showModal}
        onDismiss={handleCancel}
      >
        <Flex flexDirection="column" gap={16} padding={16}>
          <span>{selectedAction?.description}</span>
          
          {selectedAction?.isDestructive && (
            <Surface style={{ background: 'var(--dt-colors-feedback-critical-subtle)' }}>
              <Flex padding={12} alignItems="center" gap={8}>
                <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />
                <span style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>
                  This is a destructive action and may impact production services.
                </span>
              </Flex>
            </Surface>
          )}

          <div>
            <span style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Target Service
            </span>
            <TextInput
              value={actionParams.serviceName || ''}
              onChange={(value) => setActionParams({ ...actionParams, serviceName: value })}
              placeholder="Enter service name..."
            />
          </div>

          {services && services.length > 0 && (
            <div>
              <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
                Available services: {services.map(s => s.serviceName).join(', ')}
              </span>
            </div>
          )}

          <Flex gap={12} justifyContent="flex-end">
            <Button onClick={handleCancel}>Cancel</Button>
            <Button 
              variant="accent"
              color={selectedAction?.isDestructive ? 'critical' : 'primary'}
              onClick={handleConfirmExecute}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
};
