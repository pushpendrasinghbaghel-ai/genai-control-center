/**
 * Health Dashboard - Pillar A: Auto-Discovery & Health-at-a-Glance
 * Standard Dynatrace app with FilterBar and deep linking to Services app
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { ExternalLinkIcon, CheckmarkIcon, WarningIcon, CriticalIcon, HelpIcon, ServicesIcon, BarChartIcon, MoneyIcon, ClockIcon } from '@dynatrace/strato-icons';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { useAIServicesDiscovery, useDistinctServices, useDistinctProviders, useDistinctModels, QueryFilters } from '../hooks';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { calculateOverallHealth, formatNumber, formatCurrency, getHealthStatusColor } from '../utils';
import type { AIService, HealthStatus } from '../types';

// Health Status Badge Component
const HealthStatusBadge: React.FC<{ status: HealthStatus; size?: 'small' | 'large' }> = ({ 
  status, 
  size = 'small' 
}) => {
  const icons: Record<HealthStatus, React.ReactNode> = { 
    healthy: <CheckmarkIcon style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: 'var(--dt-colors-feedback-success-default)' }} />, 
    warning: <WarningIcon style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: 'var(--dt-colors-feedback-warning-default)' }} />, 
    critical: <CriticalIcon style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: 'var(--dt-colors-feedback-critical-default)' }} />, 
    unknown: <HelpIcon style={{ width: size === 'large' ? 24 : 16, height: size === 'large' ? 24 : 16, color: 'var(--dt-colors-text-secondary-default)' }} /> 
  };
  const labels: Record<HealthStatus, string> = { 
    healthy: 'Healthy', 
    warning: 'Warning', 
    critical: 'Critical', 
    unknown: 'Unknown' 
  };
  
  return (
    <Flex alignItems="center" gap={4}>
      {icons[status]}
      <span style={{ 
        fontSize: size === 'large' ? 16 : 12, 
        fontWeight: size === 'large' ? 600 : 400, 
        color: getHealthStatusColor(status) 
      }}>
        {labels[status]}
      </span>
    </Flex>
  );
};

// Metric Card Component - Compact horizontal layout
const MetricCard: React.FC<{ 
  value: string | number; 
  label: string; 
  icon: React.ReactNode; 
  color?: string 
}> = ({ value, label, icon, color }) => (
  <Flex 
    alignItems="center" 
    gap={8} 
    padding={12}
    style={{ 
      background: 'var(--dt-colors-surface-default)',
      borderRadius: 6,
      border: '1px solid var(--dt-colors-border-neutral-default)'
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</div>
    </div>
  </Flex>
);

/**
 * Navigate directly to the new Services app for an entity
 * Opens in a new window/tab using getIntentLink with window.open
 */
const openEntityInServices = (entityId: string): void => {
  // Use dt.entity.service for service entities
  // Use 'dynatrace.services' for the Services app
  const intentUrl = getIntentLink(
    { 'dt.entity.service': entityId },
    'dynatrace.services',
    'view-service'
  );
  
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

// Service Row Component - Compact table-style layout
const ServiceRow: React.FC<{ 
  service: AIService; 
  onInvestigate: (name: string) => void 
}> = ({ service, onInvestigate }) => {
  
  const handleOpenInServices = () => {
    if (service.entityId) {
      openEntityInServices(service.entityId);
    }
  };

  return (
    <Flex 
      padding={12} 
      justifyContent="space-between" 
      alignItems="center"
      style={{ 
        borderBottom: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      <Flex alignItems="center" gap={12} style={{ flex: 2 }}>
        <HealthStatusBadge status={service.healthStatus} />
        <div>
          <Flex alignItems="center" gap={6}>
            <Text style={{ fontWeight: 600, fontSize: 13 }}>{service.serviceName}</Text>
            {service.entityId && (
              <Button 
                variant="default"
                onClick={handleOpenInServices}
                title="Open in Services"
                style={{ padding: 2, minWidth: 'auto' }}
              >
                <ExternalLinkIcon />
              </Button>
            )}
          </Flex>
          <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
            {service.modelName || 'Unknown'} • {service.provider || 'Unknown'}
          </Text>
        </div>
      </Flex>
      
      <Flex alignItems="center" gap={20} style={{ flex: 2 }}>
        <div style={{ textAlign: 'right', minWidth: 70 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.totalTokens)}</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>tokens</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{Number(service.avgLatency || 0).toFixed(0)}ms</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>latency</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 60 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(service.estimatedCost)}</div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>cost</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <div style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.slowRequestRate || 0) > 10 
              ? 'var(--dt-colors-feedback-critical-default)' 
              : Number(service.slowRequestRate || 0) > 5 
              ? 'var(--dt-colors-feedback-warning-default)' 
              : 'var(--dt-colors-feedback-success-default)'
          }}>
            {Number(service.slowRequestRate || 0).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }} title="Requests taking >3 seconds">slow (&gt;3s)</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 50 }}>
          <div style={{ 
            fontSize: 12, fontWeight: 600,
            color: Number(service.lowOutputRate || 0) > 20 ? 'var(--dt-colors-feedback-warning-default)' : 'inherit'
          }}>
            {Number(service.lowOutputRate || 0).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>low output</div>
        </div>
      </Flex>
      
      <Button variant="accent" onClick={() => onInvestigate(service.serviceName)}>
        Investigate
      </Button>
    </Flex>
  );
};

export const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();

  // Data hooks with filters - use empty filters first to get available options
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();
  
  // Create a mapping from entity name to entity ID
  const serviceNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (availableServiceOptions) {
      availableServiceOptions.forEach(opt => {
        map.set(opt.entityName, opt.entityId);
      });
    }
    return map;
  }, [availableServiceOptions]);

  // Convert FilterOptions to QueryFilters for hooks
  // When user selects a service name, convert it to entity ID for querying
  const queryFilters: QueryFilters = useMemo(() => {
    const serviceEntityId = filters.serviceFilter 
      ? serviceNameToIdMap.get(filters.serviceFilter) || filters.serviceFilter
      : undefined;
    
    return {
      timeframe: filters.timeframe,
      serviceName: serviceEntityId,
      provider: filters.providerFilter || undefined,
      model: filters.modelFilter || undefined
    };
  }, [filters, serviceNameToIdMap]);

  // Data hooks with filters
  const { data: services, loading, error, refetch } = useAIServicesDiscovery(queryFilters);

  const handleInvestigate = (serviceName: string) => {
    navigate(`/davis?service=${encodeURIComponent(serviceName)}`);
  };

  // Loading state
  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '40vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={12}>
          <ProgressCircle />
          <Text>Discovering AI services...</Text>
        </Flex>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '40vh' }}>
        <Surface>
          <Flex padding={24} flexDirection="column" alignItems="center" gap={12}>
            <span style={{ fontSize: 36 }}>⚠️</span>
            <Heading level={5}>Error Loading Data</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              {error.message}
            </Text>
            <Button variant="accent" onClick={refetch}>Retry</Button>
          </Flex>
        </Surface>
      </Flex>
    );
  }

  // Empty state
  if (!services || services.length === 0) {
    return (
      <Flex flexDirection="column" gap={16} padding={16}>
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={4}>Health Dashboard</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              Searching for AI services...
            </Text>
          </div>
        </Flex>

        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refetch}
          isLoading={loading}
          availableServices={availableServiceOptions || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />

        <Flex justifyContent="center" alignItems="center" style={{ minHeight: '35vh' }}>
          <Surface>
            <Flex padding={24} flexDirection="column" alignItems="center" gap={12}>
              <span style={{ fontSize: 36 }}>🔍</span>
              <Heading level={5}>No AI Services Found</Heading>
              <Text style={{ 
                color: 'var(--dt-colors-text-secondary-default)', 
                textAlign: 'center', 
                maxWidth: 380,
                fontSize: 13 
              }}>
                No services with gen_ai.* attributes were detected. 
                Adjust the time range or ensure your AI services are instrumented.
              </Text>
              <Button variant="accent" onClick={refetch}>Refresh</Button>
            </Flex>
          </Surface>
        </Flex>
      </Flex>
    );
  }

  const healthMetrics = calculateOverallHealth(services);

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header - Compact */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={4}>Health Dashboard</Heading>
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
            {services.length} AI service{services.length !== 1 ? 's' : ''} discovered
          </Text>
        </div>
        <Button variant="accent" onClick={() => navigate('/architect')}>
          Recommendations
        </Button>
      </Flex>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Health Status + Metrics Row - Compact inline */}
      <Flex gap={12} alignItems="stretch" flexWrap="wrap">
        {/* Health Status */}
        <Flex 
          alignItems="center" 
          gap={12} 
          padding={12}
          style={{ 
            background: 'var(--dt-colors-surface-default)',
            borderRadius: 6,
            border: '1px solid var(--dt-colors-border-neutral-default)',
            minWidth: 180
          }}
        >
          <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
          <Text style={{ fontSize: 12 }}>
            {healthMetrics.criticalCount > 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-critical-default)' }}>
                {healthMetrics.criticalCount} critical
              </span>
            )}
            {healthMetrics.criticalCount > 0 && healthMetrics.warningCount > 0 && ' • '}
            {healthMetrics.warningCount > 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-warning-default)' }}>
                {healthMetrics.warningCount} warning{healthMetrics.warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {healthMetrics.criticalCount === 0 && healthMetrics.warningCount === 0 && (
              <span style={{ color: 'var(--dt-colors-feedback-success-default)' }}>All healthy</span>
            )}
          </Text>
        </Flex>

        {/* Metrics - Compact - Key aggregates only (avoid duplicating per-row data) */}
        <MetricCard value={services.length} label="Services" icon={<ServicesIcon style={{ width: 18, height: 18 }} />} />
        <MetricCard value={formatNumber(healthMetrics.totalTokensToday)} label="Tokens" icon={<BarChartIcon style={{ width: 18, height: 18 }} />} />
        <MetricCard value={formatCurrency(healthMetrics.totalCostToday)} label="Cost" icon={<MoneyIcon style={{ width: 18, height: 18 }} />} />
        <MetricCard value={`${healthMetrics.avgLatency.toFixed(0)}ms`} label="Avg Latency" icon={<ClockIcon style={{ width: 18, height: 18 }} />} />
      </Flex>

      {/* Service List - Table Style */}
      <Surface>
        <Flex flexDirection="column">
          {/* Table Header */}
          <Flex 
            padding={12} 
            style={{ 
              borderBottom: '1px solid var(--dt-colors-border-neutral-default)',
              background: 'var(--dt-colors-background-default-secondary)'
            }}
          >
            <Text style={{ flex: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>
              Service
            </Text>
            <Flex style={{ flex: 2 }} gap={20}>
              <Text style={{ textAlign: 'right', minWidth: 70, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</Text>
              <Text style={{ textAlign: 'right', minWidth: 50, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Latency</Text>
              <Text style={{ textAlign: 'right', minWidth: 60, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Cost</Text>
              <Text style={{ textAlign: 'right', minWidth: 50, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Slow %</Text>
              <Text style={{ textAlign: 'right', minWidth: 50, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Low Out %</Text>
            </Flex>
            <div style={{ width: 90 }} />
          </Flex>
          
          {/* Service Rows */}
          {services
            .sort((a, b) => b.totalTokens - a.totalTokens)
            .map((service, index) => (
              <ServiceRow 
                key={`${service.serviceName}-${service.modelName}-${index}`} 
                service={service} 
                onInvestigate={handleInvestigate} 
              />
            ))}
        </Flex>
      </Surface>
    </Flex>
  );
};
