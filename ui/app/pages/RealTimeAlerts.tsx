import React, { useState, useMemo } from 'react';
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
 * Open problem in Davis Problems app using sendIntent
 * Uses 'problem' as the intent property
 */
const openProblemInDynatrace = (problemId: string): void => {
  sendIntent({ 'problem': problemId });
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
// Problem Card Component
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
            {problem.isGenAIRelated && (
              <span style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(156, 39, 176, 0.2)',
                color: '#9c27b0',
                fontSize: 10,
                fontWeight: 600
              }}>
                🤖 GenAI
              </span>
            )}
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
// Main Alerts Dashboard Component
// ============================================

export const RealTimeAlerts: React.FC = () => {
  const { 
    problems, 
    genaiProblems, 
    otherProblems, 
    loading, 
    error, 
    lastRefresh, 
    refetch 
  } = useLiveProblems(30000); // Auto-refresh every 30 seconds

  const [filterMode, setFilterMode] = useState<'all' | 'genai' | 'other'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Filter problems
  const filteredProblems = useMemo(() => {
    let filtered = filterMode === 'genai' ? genaiProblems 
                 : filterMode === 'other' ? otherProblems 
                 : problems;
    
    if (severityFilter !== 'all') {
      filtered = filtered.filter(p => p.severity === severityFilter);
    }
    
    return filtered;
  }, [problems, genaiProblems, otherProblems, filterMode, severityFilter]);

  // Count by severity
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    problems.forEach(p => {
      counts[p.severity] = (counts[p.severity] || 0) + 1;
    });
    return counts;
  }, [problems]);

  const openProblems = problems.filter(p => p.status === 'OPEN');
  const closedProblems = problems.filter(p => p.status === 'CLOSED');

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>🚨 Real-Time Alerts</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Live problems from Dynatrace Davis AI • Auto-refreshing every 30s
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
              Total Problems (24h)
            </Text>
            <Heading level={2} style={{ 
              color: problems.length > 0 ? Colors.Text.Warning.Default : Colors.Text.Success.Default 
            }}>
              {problems.length}
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
              GenAI Related
            </Text>
            <Heading level={2} style={{ color: '#9c27b0' }}>
              {genaiProblems.length}
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

      {/* Severity Breakdown */}
      <Surface style={{ padding: 12 }}>
        <Flex gap={16} alignItems="center">
          <Text textStyle="small" style={{ fontWeight: 600 }}>By Category:</Text>
          {Object.entries(severityCounts).map(([severity, count]) => (
            <Flex key={severity} alignItems="center" gap={4}>
              <span>{getSeverityIcon(severity)}</span>
              <Text textStyle="small">{severity}: {count}</Text>
            </Flex>
          ))}
        </Flex>
      </Surface>

      {/* Filters */}
      <Flex gap={8} alignItems="center">
        <Text textStyle="small" style={{ fontWeight: 500 }}>Filter:</Text>
        <Button
          variant={filterMode === 'all' ? 'emphasized' : 'default'}
          onClick={() => setFilterMode('all')}
        >
          All ({problems.length})
        </Button>
        <Button
          variant={filterMode === 'genai' ? 'emphasized' : 'default'}
          onClick={() => setFilterMode('genai')}
        >
          🤖 GenAI Only ({genaiProblems.length})
        </Button>
        <Button
          variant={filterMode === 'other' ? 'emphasized' : 'default'}
          onClick={() => setFilterMode('other')}
        >
          Other ({otherProblems.length})
        </Button>
        
        <div style={{ marginLeft: 'auto' }} />
        
        <Text textStyle="small" style={{ fontWeight: 500 }}>Severity:</Text>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--dt-colors-border-neutral-default)',
            background: 'var(--dt-colors-surface-default)'
          }}
        >
          <option value="all">All Severities</option>
          <option value="ERROR">Error</option>
          <option value="PERFORMANCE">Performance</option>
          <option value="AVAILABILITY">Availability</option>
          <option value="RESOURCE_CONTENTION">Resource</option>
          <option value="CUSTOM_ALERT">Custom</option>
        </select>
      </Flex>

      {/* Loading State */}
      {loading && problems.length === 0 && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <ProgressCircle size="large" />
          <Text style={{ marginTop: 16 }}>Loading problems from Dynatrace...</Text>
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

      {/* Problems List */}
      {!loading && filteredProblems.length === 0 && (
        <Surface style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>✅</span>
          <Heading level={5} style={{ marginTop: 16 }}>No Active Problems</Heading>
          <Text style={{ marginTop: 8, color: Colors.Text.Neutral.Subdued }}>
            {filterMode === 'genai' 
              ? 'No problems detected for GenAI services in the last 24 hours.'
              : 'All systems operating normally. No problems detected in the last 24 hours.'}
          </Text>
        </Surface>
      )}

      {filteredProblems.length > 0 && (
        <Flex flexDirection="column">
          {filteredProblems.map((problem) => (
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
