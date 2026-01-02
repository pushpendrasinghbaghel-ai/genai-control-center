// Health Dashboard - Pillar A: Auto-Discovery & Health-at-a-Glance

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { useAIServicesDiscovery, useDistinctServices, useDistinctProviders, QueryFilters } from '../hooks';
import { FilterBar, FilterOptions } from '../components/FilterBar';
import { calculateOverallHealth, formatNumber, formatCurrency, getHealthStatusColor } from '../utils';
import type { AIService, HealthStatus } from '../types';

/**
 * Generate a deep link to Dynatrace Services app with the service entity pre-selected
 * Uses the standard Dynatrace URL format: /ui/apps/dynatrace.classic.services/ui/entity/{entityId}
 */
const getServicesAppLink = (entityId: string): string => {
  // Use the standard Dynatrace services URL pattern
  return `/ui/apps/dynatrace.classic.services/ui/entity/${entityId}`;
};

// Health Status Badge Component
const HealthStatusBadge: React.FC<{ status: HealthStatus; size?: 'small' | 'large' }> = ({ 
  status, 
  size = 'small' 
}) => {
  const icons: Record<HealthStatus, string> = { healthy: '✅', warning: '⚠️', critical: '🔴', unknown: '❓' };
  const labels: Record<HealthStatus, string> = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical', unknown: 'Unknown' };
  
  return (
    <Flex alignItems="center" gap={4}>
      <span style={{ fontSize: size === 'large' ? 24 : 16 }}>{icons[status]}</span>
      <span style={{ fontSize: size === 'large' ? 16 : 12, fontWeight: size === 'large' ? 600 : 400, color: getHealthStatusColor(status) }}>
        {labels[status]}
      </span>
    </Flex>
  );
};

// Metric Card Component
const MetricCard: React.FC<{ value: string | number; label: string; icon: string; color?: string }> = ({ value, label, icon, color }) => (
  <Surface>
    <Flex padding={16} flexDirection="column" alignItems="center" gap={8}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: color || 'inherit' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</span>
    </Flex>
  </Surface>
);

// Service Card Component with deep linking to Services app
const ServiceCard: React.FC<{ service: AIService; onInvestigate: (name: string) => void }> = ({ service, onInvestigate }) => {
  // Generate deep link to Services app if entity ID is available
  const handleViewInServices = () => {
    if (service.entityId) {
      const link = getServicesAppLink(service.entityId);
      window.open(link, '_blank');
    }
  };

  return (
    <Surface>
      <Flex padding={16} justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" gap={16}>
          <HealthStatusBadge status={service.healthStatus} />
          <div>
            {service.entityId ? (
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleViewInServices(); }}
                style={{ fontWeight: 600, color: 'var(--dt-colors-text-primary-default)', textDecoration: 'none' }}
              >
                {service.serviceName} ↗
              </a>
            ) : (
              <span style={{ fontWeight: 600 }}>{service.serviceName}</span>
            )}
            <div style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {service.modelName} • {service.provider}
            </div>
          </div>
        </Flex>
        <Flex alignItems="center" gap={24}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{formatNumber(service.totalTokens)} tokens</span>
            <div style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {Number(service.avgLatency || 0).toFixed(0)}ms avg
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(service.estimatedCost)}</span>
            <div style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
              {Number(service.errorRate || 0).toFixed(1)}% errors
            </div>
          </div>
          {service.entityId && (
            <Button variant="default" onClick={handleViewInServices}>
              View in Services
            </Button>
          )}
          <Button variant="accent" onClick={() => onInvestigate(service.serviceName)}>Investigate</Button>
        </Flex>
      </Flex>
    </Surface>
  );
};

export const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Filter state with native Dynatrace timeframe
  const [filters, setFilters] = useState<FilterOptions>({
    timeframe: null, // null means use default (last 24h)
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

  const handleInvestigate = (serviceName: string) => {
    navigate(`/davis?service=${encodeURIComponent(serviceName)}`);
  };

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={16}>
          <ProgressCircle />
          <span>Discovering AI services...</span>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <Surface>
          <Flex padding={32} flexDirection="column" alignItems="center" gap={16}>
            <span style={{ fontSize: 48 }}>⚠️</span>
            <Heading level={4}>Error Loading Data</Heading>
            <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{error.message}</span>
            <Button variant="accent" onClick={refetch}>Retry</Button>
          </Flex>
        </Surface>
      </Flex>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Flex flexDirection="column" gap={24} padding={24}>
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={3}>Health Dashboard</Heading>
            <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Searching for AI services...
            </span>
          </div>
        </Flex>

        {/* Filter Bar - always show so user can change timeframe */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          services={availableServices || []}
          providers={availableProviders || []}
          showServiceFilter={true}
          showProviderFilter={true}
          showModelFilter={false}
          onRefresh={refetch}
        />

        {/* Empty State */}
        <Flex justifyContent="center" alignItems="center" style={{ minHeight: '40vh' }}>
          <Surface>
            <Flex padding={32} flexDirection="column" alignItems="center" gap={16}>
              <span style={{ fontSize: 48 }}>🔍</span>
              <Heading level={4}>No AI Services Found</Heading>
              <span style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', maxWidth: 400 }}>
                No services with gen_ai.* attributes were detected in the selected time range. 
                Try adjusting the time frame or ensure your AI services are instrumented with 
                OpenTelemetry semantic conventions for GenAI.
              </span>
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
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Auto-discovered {services.length} AI service{services.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button variant="accent" onClick={() => navigate('/architect')}>View Recommendations</Button>
      </Flex>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        services={availableServices || []}
        providers={availableProviders || []}
        showServiceFilter={true}
        showProviderFilter={true}
        showModelFilter={false}
        onRefresh={refetch}
      />

      {/* Overall Health Status */}
      <Surface>
        <Flex alignItems="center" gap={16} padding={16}>
          <HealthStatusBadge status={healthMetrics.overallHealth} size="large" />
          <span>
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
          </span>
        </Flex>
      </Surface>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        <MetricCard value={services.length} label="AI Services" icon="🤖" />
        <MetricCard value={formatNumber(healthMetrics.totalTokensToday)} label="Total Tokens" icon="📊" />
        <MetricCard value={formatCurrency(healthMetrics.totalCostToday)} label="Estimated Cost" icon="💰" />
        <MetricCard value={`${healthMetrics.avgLatency.toFixed(0)}ms`} label="Avg Latency" icon="⚡" />
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
        <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>Sorted by token usage</span>
      </Flex>

      <Flex flexDirection="column" gap={8}>
        {services
          .sort((a, b) => b.totalTokens - a.totalTokens)
          .map((service, index) => (
            <ServiceCard key={`${service.serviceName}-${service.modelName}-${index}`} service={service} onInvestigate={handleInvestigate} />
          ))}
      </Flex>

      {/* Quick Actions */}
      <Surface>
        <Flex padding={16} gap={16} alignItems="center" justifyContent="center">
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>Quick Actions:</span>
          <Button onClick={() => navigate('/davis')}>Ask Davis AI</Button>
          <Button onClick={() => navigate('/providers')}>Compare Providers</Button>
          <Button onClick={() => navigate('/remediation')}>Remediation Actions</Button>
        </Flex>
      </Surface>
    </Flex>
  );
};
