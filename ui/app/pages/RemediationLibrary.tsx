// Remediation Library - Pillar D: One-Click Automation Actions

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { useRemediation, useRemediationActions, useAIServicesDiscovery } from '../hooks';
import type { RemediationAction, WorkflowExecution } from '../types';

// Action Card Component
const ActionCard: React.FC<{
  action: RemediationAction;
  onExecute: (action: RemediationAction) => void;
}> = ({ action, onExecute }) => {
  const icons: Record<string, string> = {
    'kill_switch': '⛔',
    'fallback_trigger': '🔄',
    'rate_limit': '⚡',
    'cache_enable': '💾',
    'provider_switch': '🔀',
    'alert_suppress': '🔕'
  };

  return (
    <Surface>
      <Flex 
        flexDirection="column" 
        padding={16} 
        gap={12}
        style={{ 
          borderLeft: action.isDestructive 
            ? '4px solid var(--dt-colors-feedback-critical-default)' 
            : '4px solid var(--dt-colors-charts-categorical-default-1)'
        }}
      >
        <Flex alignItems="center" gap={12}>
          <span style={{ fontSize: 28 }}>{icons[action.type] || '🔧'}</span>
          <div style={{ flex: 1 }}>
            <Flex alignItems="center" gap={8}>
              <span style={{ fontWeight: 600 }}>{action.name}</span>
              {action.isDestructive && (
                <span style={{ 
                  fontSize: 10, padding: '2px 6px', 
                  background: 'var(--dt-colors-feedback-critical-subtle)',
                  color: 'var(--dt-colors-feedback-critical-default)',
                  borderRadius: 4, textTransform: 'uppercase', fontWeight: 600
                }}>
                  Destructive
                </span>
              )}
            </Flex>
          </div>
        </Flex>
        <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
          {action.description}
        </span>
        <Flex justifyContent="flex-end">
          <Button 
            color={action.isDestructive ? 'critical' : 'primary'}
            onClick={() => onExecute(action)}
          >
            Configure & Execute
          </Button>
        </Flex>
      </Flex>
    </Surface>
  );
};

// Execution History Component
const ExecutionHistory: React.FC<{ executions: WorkflowExecution[] }> = ({ executions }) => {
  if (executions.length === 0) {
    return (
      <span style={{ color: 'var(--dt-colors-text-secondary-default)', padding: 16 }}>
        No executions yet.
      </span>
    );
  }

  return (
    <Flex flexDirection="column" gap={8}>
      {executions.map(execution => (
        <Surface key={execution.id}>
          <Flex padding={12} justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={12}>
              <span style={{ 
                fontSize: 12, padding: '4px 8px', borderRadius: 4,
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
              <span>{execution.workflowId}</span>
            </Flex>
            <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {execution.startTime.toLocaleTimeString()}
            </span>
          </Flex>
        </Surface>
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

  return (
    <Flex flexDirection="column" gap={24} padding={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={3}>Remediation Library</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            One-click automation actions for AI service issues
          </span>
        </div>
      </Flex>

      {/* Warning Banner */}
      <Surface>
        <Flex padding={16} alignItems="center" gap={12}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 600 }}>Important Safety Information</span>
            <div style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Destructive actions (marked in red) can impact production services. 
              Always verify the target service before executing.
            </div>
          </div>
        </Flex>
      </Surface>

      {/* Two Column Layout */}
      <Flex gap={24}>
        {/* Actions Grid */}
        <Flex flexDirection="column" gap={16} style={{ flex: 2 }}>
          <Heading level={5}>Available Actions</Heading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {actions.map(action => (
              <ActionCard key={action.id} action={action} onExecute={handleExecute} />
            ))}
          </div>
        </Flex>

        {/* Execution History */}
        <Flex flexDirection="column" gap={16} style={{ flex: 1 }}>
          <Heading level={5}>Execution History</Heading>
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
                <span>⚠️</span>
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
