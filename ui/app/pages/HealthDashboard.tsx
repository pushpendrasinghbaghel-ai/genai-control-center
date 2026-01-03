/**
 * Health Dashboard - Pillar A: Auto-Discovery & Health-at-a-Glance
 * Standard Dynatrace app with FilterBar and deep linking to Services app
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { ExternalLinkIcon } from '@dynatrace/strato-icons';
import { sendIntent } from '@dynatrace-sdk/navigation';
import { useAIServicesDiscovery, useDistinctServices, useDistinctProviders, useDistinctModels, QueryFilters } from '../hooks';
import { FilterBar, FilterOptions, createDefaultTimeframe } from '../components/FilterBar';
import { calculateOverallHealth, formatNumber, formatCurrency, getHealthStatusColor } from '../utils';
import type { AIService, HealthStatus } from '../types';

// Health Status Badge Component
const HealthStatusBadge: React.FC<{ status: HealthStatus; size?: 'small' | 'large' }> = ({ 
  status, 
  size = 'small' 
}) => {
  const icons: Record<HealthStatus, string> = { 
    healthy: '✅', 
    warning: '⚠️', 
    critical: '🔴', 
    unknown: '❓' 
  };
  const labels: Record<HealthStatus, string> = { 
    healthy: 'Healthy', 
    warning: 'Warning', 
    critical: 'Critical', 
    unknown: 'Unknown' 
  };
  
  return (
    <Flex alignItems="center" gap={4}>
      <span style={{ fontSize: size === 'large' ? 24 : 16 }}>{icons[status]}</span>
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

// Metric Card Component
const MetricCard: React.FC<{ 
  value: string | number; 
  label: string; 
  icon: string; 
  color?: string 
}> = ({ value, label, icon, color }) => (
  <Surface>
    <Flex padding={16} flexDirection="column" alignItems="center" gap={8}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: color || 'inherit' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</span>
    </Flex>
  </Surface>
);

/**
 * Navigate directly to the new Services app for an entity
 * Uses sendIntent with correct entity property to bypass "Open with" dialog
 */
const openEntityInServices = (entityId: string): void => {
  // Use dt.entity.service for service entities
  // Use 'dynatrace.services' for the new Services app (not classic)
  sendIntent(
    { 'dt.entity.service': entityId },
    {
      recommendedAppId: 'dynatrace.services',
      recommendedIntentId: 'view-service'
    }
  );
};

// Service Card Component with deep linking
const ServiceCard: React.FC<{ 
  service: AIService; 
  onInvestigate: (name: string) => void 
}> = ({ service, onInvestigate }) => {
  
  const handleOpenInServices = () => {
    if (service.entityId) {
      // Use Dynatrace SDK navigation to open entity in Services app
      openEntityInServices(service.entityId);
    }
  };

  return (
    <Surface>
      <Flex padding={16} justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" gap={16}>
          <HealthStatusBadge status={service.healthStatus} />
          <div>
            <Flex alignItems="center" gap={8}>
              <Text style={{ fontWeight: 600 }}>{service.serviceName}</Text>
              {service.entityId && (
                <Button 
                  variant="default" 
                  onClick={handleOpenInServices}
                  title="Open in Services app"
                  style={{ padding: 4, minWidth: 'auto' }}
                >
                  <ExternalLinkIcon />
                </Button>
              )}
            </Flex>
            <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {service.modelName || 'Unknown model'} • {service.provider || 'Unknown provider'}
            </Text>
          </div>
        </Flex>
        
        <Flex alignItems="center" gap={24}>
          <div style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>
              {formatNumber(service.totalTokens)} tokens
            </Text>
            <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {Number(service.avgLatency || 0).toFixed(0)}ms avg
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>
              {formatCurrency(service.estimatedCost)}
            </Text>
            <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {Number(service.errorRate || 0).toFixed(1)}% errors
            </Text>
          </div>
          {service.entityId && (
            <Button variant="default" onClick={handleOpenInServices}>
              View in Services
            </Button>
          )}
          <Button variant="accent" onClick={() => onInvestigate(service.serviceName)}>
            Investigate
          </Button>
        </Flex>
      </Flex>
    </Surface>
  );
};

export const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Filter state - initialize with a default timeframe
  const [filters, setFilters] = useState<FilterOptions>({
    timeframe: createDefaultTimeframe(),
    filterQuery: '',
    serviceFilter: '',
    providerFilter: '',
    modelFilter: ''
  });

  // Convert FilterOptions to QueryFilters for hooks
  const queryFilters: QueryFilters = useMemo(() => ({
    timeframe: filters.timeframe,
    serviceName: filters.serviceFilter || undefined,
    provider: filters.providerFilter || undefined,
    model: filters.modelFilter || undefined
  }), [filters]);

  // Data hooks with filters
  const { data: services, loading, error, refetch } = useAIServicesDiscovery(queryFilters);
  const { data: availableServices } = useDistinctServices(queryFilters);
  const { data: availableProviders } = useDistinctProviders(queryFilters);
  const { data: availableModels } = useDistinctModels(queryFilters);

  const handleInvestigate = (serviceName: string) => {
    navigate(`/davis?service=${encodeURIComponent(serviceName)}`);
  };

  // Loading state
  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={16}>
          <ProgressCircle />
          <Text>Discovering AI services...</Text>
        </Flex>
      </Flex>
    );
  }

  // Error state
  if (error) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <Surface>
          <Flex padding={32} flexDirection="column" alignItems="center" gap={16}>
            <span style={{ fontSize: 48 }}>⚠️</span>
            <Heading level={4}>Error Loading Data</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
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
      <Flex flexDirection="column" gap={24} padding={24}>
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={3}>Health Dashboard</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Searching for AI services...
            </Text>
          </div>
        </Flex>

        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refetch}
          isLoading={loading}
          availableServices={availableServices || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />

        <Flex justifyContent="center" alignItems="center" style={{ minHeight: '40vh' }}>
          <Surface>
            <Flex padding={32} flexDirection="column" alignItems="center" gap={16}>
              <span style={{ fontSize: 48 }}>🔍</span>
              <Heading level={4}>No AI Services Found</Heading>
              <Text style={{ 
                color: 'var(--dt-colors-text-secondary-default)', 
                textAlign: 'center', 
                maxWidth: 400 
              }}>
                No services with gen_ai.* attributes were detected in the selected time range. 
                Try adjusting the time frame or ensure your AI services are instrumented with 
                OpenTelemetry semantic conventions for GenAI.
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
    <Flex flexDirection="column" gap={24} padding={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={3}>Health Dashboard</Heading>
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Auto-discovered {services.length} AI service{services.length !== 1 ? 's' : ''}
          </Text>
        </div>
        <Button variant="accent" onClick={() => navigate('/architect')}>
          View Recommendations
        </Button>
      </Flex>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
        isLoading={loading}
        availableServices={availableServices || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Overall Health Status */}
      <Surface>
        <Flex alignItems="center" gap={16} padding={16}>
          <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
          <Text>
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
              <span style={{ color: 'var(--dt-colors-feedback-success-default)' }}>
                All services are healthy
              </span>
            )}
          </Text>
        </Flex>
      </Surface>

      {/* Summary Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: 16 
      }}>
        <MetricCard value={services.length} label="AI Services" icon="🤖" />
        <MetricCard 
          value={formatNumber(healthMetrics.totalTokensToday)} 
          label="Total Tokens" 
          icon="📊" 
        />
        <MetricCard 
          value={formatCurrency(healthMetrics.totalCostToday)} 
          label="Estimated Cost" 
          icon="💰" 
        />
        <MetricCard 
          value={`${healthMetrics.avgLatency.toFixed(0)}ms`} 
          label="Avg Latency" 
          icon="⚡" 
        />
        <MetricCard 
          value={`${healthMetrics.avgErrorRate.toFixed(2)}%`} 
          label="Avg Error Rate" 
          icon="❌"
          color={healthMetrics.avgErrorRate > 5 ? 'var(--dt-colors-feedback-critical-default)' : undefined}
        />
      </div>

      {/* Service List */}
      <Flex justifyContent="space-between" alignItems="center">
        <Heading level={5}>Discovered AI Services</Heading>
        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
          Sorted by token usage
        </Text>
      </Flex>

      <Flex flexDirection="column" gap={8}>
        {services
          .sort((a, b) => b.totalTokens - a.totalTokens)
          .map((service, index) => (
            <ServiceCard 
              key={`${service.serviceName}-${service.modelName}-${index}`} 
              service={service} 
              onInvestigate={handleInvestigate} 
            />
          ))}
      </Flex>

      {/* Quick Actions */}
      <Surface>
        <Flex padding={16} gap={16} alignItems="center" justifyContent="center">
          <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Quick Actions:
          </Text>
          <Button onClick={() => navigate('/davis')}>Ask Davis AI</Button>
          <Button onClick={() => navigate('/providers')}>Compare Providers</Button>
          <Button onClick={() => navigate('/remediation')}>Remediation Actions</Button>
        </Flex>
      </Surface>
    </Flex>
  );
};
