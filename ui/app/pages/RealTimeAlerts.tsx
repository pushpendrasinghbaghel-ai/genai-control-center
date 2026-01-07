import React, { useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { ExternalLinkIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { sendIntent } from '@dynatrace-sdk/navigation';
import { useLiveProblems, LiveProblem } from '../hooks/useWorkflows';

// ============================================
// Helper Functions
// ============================================

/**
 * Open problem in Dynatrace Problems app using sendIntent
 */
const openProblemInDynatrace = (problemId: string): void => {
  // Use specific event payload for Davis Problems app
  // including specific intent ID to bypass the 'Open with' dialog
  sendIntent(
    { 
      'event.id': problemId,
      'event.kind': 'DAVIS_PROBLEM'
    },
    { 
      'recommendedAppId': 'dynatrace.davis.problems',
      'recommendedIntentId': 'view-problem'
    }
  );
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'ERROR':
    case 'AVAILABILITY':
      return Colors.Text.Critical.Default;
    case 'PERFORMANCE':
    case 'SLOWDOWN':
      return Colors.Text.Warning.Default;
    case 'RESOURCE_CONTENTION':
      return '#ff9800';
    case 'CUSTOM_ALERT':
      return '#9c27b0';
    default:
      return Colors.Text.Neutral.Default;
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'ERROR':
    case 'AVAILABILITY':
      return '🔴';
    case 'PERFORMANCE':
    case 'SLOWDOWN':
      return '🟡';
    case 'RESOURCE_CONTENTION':
      return '🟠';
    case 'CUSTOM_ALERT':
      return '🟣';
    default:
      return '⚪';
  }
};

const formatDuration = (startTime: string, endTime?: string) => {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();
  
  const minutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
};

// ============================================
// Problem Card Component - Original Working Design
// ============================================

const ProblemCard: React.FC<{
  problem: LiveProblem;
}> = ({ problem }) => {
  const handleOpenInDynatrace = () => {
    openProblemInDynatrace(problem.problemId);
  };

  return (
    <Surface 
      style={{ 
        padding: 16,
        borderLeft: `4px solid ${getSeverityColor(problem.severity)}`,
        marginBottom: 8
      }}
    >
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
          <Flex alignItems="center" gap={8}>
            <span style={{ fontSize: 18 }}>{getSeverityIcon(problem.severity)}</span>
            <Text style={{ fontWeight: 600, fontSize: 14 }}>{problem.title}</Text>
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: problem.status === 'OPEN' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)',
              color: problem.status === 'OPEN' ? '#f44336' : '#4CAF50',
              fontSize: 10
            }}>
              {problem.status}
            </span>
          </Flex>
          
          <Flex gap={16}>
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                ID:
              </Text>
              <Text textStyle="small" style={{ fontFamily: 'monospace' }}>
                {problem.displayId || problem.problemId.substring(0, 12)}
              </Text>
            </Flex>
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Category:
              </Text>
              <Text textStyle="small">{problem.severity}</Text>
            </Flex>
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Duration:
              </Text>
              <Text textStyle="small">{formatDuration(problem.startTime, problem.endTime)}</Text>
            </Flex>
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Started:
              </Text>
              <Text textStyle="small">{formatTimeAgo(problem.startTime)}</Text>
            </Flex>
          </Flex>

          {problem.rootCauseEntity && (
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Root Cause:
              </Text>
              <Text textStyle="small" style={{ fontWeight: 500 }}>
                {problem.rootCauseEntity}
              </Text>
            </Flex>
          )}

          {problem.affectedEntities.length > 0 && (
            <Flex alignItems="center" gap={4}>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Affected:
              </Text>
              <Text textStyle="small">
                {problem.affectedEntities.length} {problem.affectedEntities.length === 1 ? 'entity' : 'entities'}
              </Text>
            </Flex>
          )}
        </Flex>

        <Flex gap={8}>
          <Button variant="emphasized" onClick={handleOpenInDynatrace}>
            <ExternalLinkIcon /> Open with Problems app
          </Button>
        </Flex>
      </Flex>
    </Surface>
  );
};

// ============================================
// Main Component - GenAI Problems Only
// ============================================

export const RealTimeAlerts: React.FC = () => {
  const { 
    genaiProblems, 
    loading, 
    error, 
    lastRefresh, 
    refetch 
  } = useLiveProblems(30000); // Auto-refresh every 30 seconds

  // Split into active vs closed
  const openProblems = useMemo(() => 
    genaiProblems.filter(p => p.status === 'OPEN'), [genaiProblems]);
  const closedProblems = useMemo(() => 
    genaiProblems.filter(p => p.status === 'CLOSED'), [genaiProblems]);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>GenAI Problems</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Problems affecting AI services • Auto-refreshing every 30s
          </Text>
        </Flex>
        <Flex alignItems="center" gap={12}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Text>
          <Button variant="default" onClick={refetch} disabled={loading}>
            {loading ? <ProgressCircle size="small" /> : '🔄 Refresh'}
          </Button>
        </Flex>
      </Flex>

      {/* Summary Cards */}
      <Flex gap={12}>
        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Total GenAI Problems (24h)
            </Text>
            <Heading level={2} style={{ 
              color: genaiProblems.length > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default 
            }}>
              {genaiProblems.length}
            </Heading>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Active (Open)
            </Text>
            <Heading level={2} style={{ 
              color: openProblems.length > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default 
            }}>
              {openProblems.length}
            </Heading>
          </Flex>
        </Surface>

        <Surface style={{ flex: 1, padding: 16 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Resolved (24h)
            </Text>
            <Heading level={2} style={{ color: Colors.Text.Success.Default }}>
              {closedProblems.length}
            </Heading>
          </Flex>
        </Surface>
      </Flex>

      {/* Loading State */}
      {loading && genaiProblems.length === 0 && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <ProgressCircle size="large" />
          <Text style={{ marginTop: 16 }}>Loading GenAI problems from Dynatrace...</Text>
        </Surface>
      )}

      {/* Error State */}
      {error && (
        <Surface style={{ padding: 24, textAlign: 'center' }}>
          <Text style={{ color: Colors.Text.Critical.Default }}>❌ {error.message}</Text>
          <Button variant="default" onClick={refetch} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </Surface>
      )}

      {/* No Problems - Success State */}
      {!loading && genaiProblems.length === 0 && !error && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>✅</span>
          <Heading level={5} style={{ marginTop: 16 }}>No GenAI Problems</Heading>
          <Text style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
            All AI services are operating normally. No problems detected in the last 24 hours.
          </Text>
        </Surface>
      )}

      {/* Problems List */}
      {genaiProblems.length > 0 && (
        <Flex flexDirection="column">
          {genaiProblems.map((problem) => (
            <ProblemCard
              key={problem.problemId}
              problem={problem}
            />
          ))}
        </Flex>
      )}
    </Flex>
  );
};

export default RealTimeAlerts;
