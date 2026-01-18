import React, { useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Colors } from '@dynatrace/strato-design-tokens';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { DataTable, DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { CriticalIcon, WarningIcon, CheckmarkIcon } from '@dynatrace/strato-icons';
import { useLiveProblems, LiveProblem } from '../hooks/useWorkflows';
import { FilterBar, FilterOptions, createDefaultTimeframe } from '../components/FilterBar';

// ============================================
// Helper Functions
// ============================================

const openProblemInDynatrace = (problemId: string): void => {
  const link = getIntentLink(
    { 
      'event.id': problemId,
      'event.kind': 'DAVIS_PROBLEM'
    },
    'dynatrace.davis.problems',
    'view-problem'
  );
  window.open(link, '_blank');
};

const getSeverityIcon = (severity: string): React.ReactNode => {
  switch (severity) {
    case 'ERROR': return <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />;
    case 'AVAILABILITY': return <CriticalIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-critical-default)' }} />;
    case 'PERFORMANCE': return <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-warning-default)' }} />;
    case 'SLOWDOWN': return <WarningIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-feedback-warning-default)' }} />;
    case 'RESOURCE_CONTENTION': return <WarningIcon style={{ width: 14, height: 14, color: '#ff5722' }} />;
    case 'CUSTOM_ALERT': return <WarningIcon style={{ width: 14, height: 14, color: '#9c27b0' }} />;
    default: return <WarningIcon style={{ width: 14, height: 14 }} />;
  }
};

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return new Date(timestamp).toLocaleString();
};

// ============================================
// Main Component
// ============================================

export const RealTimeAlerts: React.FC = () => {
  // Filter state
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    timeframe: createDefaultTimeframe(),
    filterQuery: '',
    serviceFilter: '',
    providerFilter: '',
    modelFilter: ''
  });

  // Data hook
  const { 
    genaiProblems, 
    loading, 
    error, 
    lastRefresh, 
    refetch 
  } = useLiveProblems(filterOptions.timeframe, 30000); 

  // Client-side filtering
  const filteredProblems = useMemo(() => {
    if (!filterOptions.filterQuery) return genaiProblems;
    
    const query = filterOptions.filterQuery.toLowerCase();
    return genaiProblems.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.displayId.toLowerCase().includes(query) ||
      p.problemId.toLowerCase().includes(query) ||
      (p.rootCauseEntity && p.rootCauseEntity.toLowerCase().includes(query))
    );
  }, [genaiProblems, filterOptions.filterQuery]);

  // Table Columns Definition
  const columns = useMemo<DataTableColumnDef<LiveProblem>[]>(() => [
    {
      id: 'displayId',
      header: 'ID',
      accessor: 'displayId',
      width: 150,
      cell: ({ rowData }) => (
        <a 
          onClick={() => openProblemInDynatrace(rowData.problemId)} 
          style={{ textDecoration: 'underline', cursor: 'pointer', color: Colors.Text.Primary.Default }}
        >
          {rowData.displayId || rowData.problemId.substring(0, 8)}
        </a>
      )
    },
    {
      id: 'title',
      header: 'Name',
      accessor: 'title',
      cell: ({ value }) => (
         <Text style={{ fontWeight: 600 }}>{value as string}</Text>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 120,
      cell: ({ value }) => (
        <Flex 
          alignItems="center" 
          gap={4}
          style={{ 
            color: value === 'OPEN' ? Colors.Text.Critical.Default : Colors.Text.Success.Default,
            fontWeight: 600
          }}
        >
          {value === 'OPEN' 
            ? <><CriticalIcon style={{ width: 12, height: 12 }} /> Active</>
            : <><CheckmarkIcon style={{ width: 12, height: 12 }} /> Closed</>
          }
        </Flex>
      )
    },
    {
      id: 'severity',
      header: 'Category',
      accessor: 'severity',
      width: 150,
      cell: ({ value }) => (
        <Flex alignItems="center" gap={6}>
          <span>{getSeverityIcon(value as string)}</span>
          <span>{value as string}</span>
        </Flex>
      )
    },
    {
      id: 'affectedEntities',
      header: 'Affected',
      accessor: 'affectedEntities',
      width: 100,
      cell: ({ value }) => <span>{(value as string[]).length}</span>
    },
    {
      id: 'rootCauseEntity',
      header: 'Root cause',
      accessor: 'rootCauseEntity',
      cell: ({ value }) => <span>{(value as string) || '-'}</span>
    },
    {
      id: 'startTime',
      header: 'Started',
      accessor: 'startTime',
      width: 180,
      cell: ({ value }) => <span>{formatTimeAgo(value as string)}</span>
    }
  ], []);

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ height: '100%', overflow: 'hidden' }}>
      {/* Compact Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
          Problems Affecting AI Services
        </Text>
        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </Text>
      </Flex>

      {/* Filter Bar */}
      <Surface>
        <FilterBar 
          filters={filterOptions}
          onFiltersChange={setFilterOptions}
          onRefresh={refetch}
          isLoading={loading}
        />
      </Surface>

      {/* Main Content - Table View */}
      <Surface style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && filteredProblems.length === 0 ? (
           <Flex justifyContent="center" alignItems="center" style={{ padding: 48 }}>
             <ProgressCircle size="large" />
           </Flex>
        ) : error ? (
           <Flex flexDirection="column" alignItems="center" style={{ padding: 48, color: Colors.Text.Critical.Default }}>
             <Text>Error loading problems: {error.message}</Text>
             <Button onClick={refetch} variant="default" style={{ marginTop: 16 }}>Retry</Button>
           </Flex>
        ) : (
          <DataTable 
            data={filteredProblems} 
            columns={columns} 
            fullWidth 
          />
        )}
      </Surface>
    </Flex>
  );
};

export default RealTimeAlerts;
