// AI Architect - Pillar B: Pattern Detection & Recommendations

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { useAIServicesDiscovery, useAIArchitect, getSeverityColor, useDistinctServices, useDistinctProviders, QueryFilters } from '../hooks';
import { FilterBar, FilterOptions } from '../components/FilterBar';
import type { ArchitectRecommendation } from '../types';

// Recommendation Card Component
const RecommendationCard: React.FC<{
  recommendation: ArchitectRecommendation;
  onApply?: () => void;
  onInvestigate?: () => void;
}> = ({ recommendation, onApply, onInvestigate }) => {
  const icons: Record<string, string> = {
    cost_optimization: '💰',
    performance: '⚡',
    reliability: '🛡️',
    security: '🔒',
    best_practice: '📋'
  };

  return (
    <Surface>
      <Flex padding={16} flexDirection="column" gap={12}>
        <Flex justifyContent="space-between" alignItems="flex-start">
          <Flex alignItems="center" gap={12}>
            <span style={{ fontSize: 28 }}>{icons[recommendation.type] || '💡'}</span>
            <div>
              <Flex alignItems="center" gap={8}>
                <span style={{ fontWeight: 600 }}>{recommendation.title}</span>
                <span style={{ 
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  backgroundColor: getSeverityColor(recommendation.severity) + '20',
                  color: getSeverityColor(recommendation.severity),
                  textTransform: 'uppercase', fontWeight: 600
                }}>
                  {recommendation.severity}
                </span>
              </Flex>
              {recommendation.affectedService && (
                <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
                  Affects: {recommendation.affectedService}
                </span>
              )}
            </div>
          </Flex>
          {recommendation.estimatedImpact && (
            <span style={{ 
              fontSize: 14, fontWeight: 600,
              color: recommendation.type === 'cost_optimization' ? 'var(--dt-colors-feedback-success-default)' : 'inherit'
            }}>
              {recommendation.estimatedImpact}
            </span>
          )}
        </Flex>

        <span style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)' }}>
          {recommendation.description}
        </span>

        <Flex gap={8} justifyContent="flex-end">
          {onInvestigate && (
            <Button onClick={onInvestigate}>Investigate</Button>
          )}
          {onApply && (
            <Button variant="accent" onClick={onApply}>Apply Fix</Button>
          )}
        </Flex>
      </Flex>
    </Surface>
  );
};

export const AIArchitect: React.FC = () => {
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
    provider: filters.providerFilter || undefined
  }), [filters]);

  const { data: services, loading: servicesLoading, refetch } = useAIServicesDiscovery(queryFilters);
  const { recommendations, loading: recommendationsLoading, analyzing } = useAIArchitect(services || []);
  const { data: availableServices } = useDistinctServices(queryFilters);
  const { data: availableProviders } = useDistinctProviders(queryFilters);

  const loading = servicesLoading || recommendationsLoading;

  const handleInvestigate = (recommendation: ArchitectRecommendation) => {
    const query = `Analyze ${recommendation.type} issue: ${recommendation.title}`;
    navigate(`/davis?query=${encodeURIComponent(query)}&service=${encodeURIComponent(recommendation.affectedService || '')}`);
  };

  const handleApplyFix = (recommendation: ArchitectRecommendation) => {
    navigate(`/remediation?action=${recommendation.type}&service=${encodeURIComponent(recommendation.affectedService || '')}`);
  };

  if (loading || analyzing) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={16}>
          <ProgressCircle />
          <span>{analyzing ? 'Analyzing patterns...' : 'Loading services...'}</span>
        </Flex>
      </Flex>
    );
  }

  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    if (!acc[rec.type]) acc[rec.type] = [];
    acc[rec.type].push(rec);
    return acc;
  }, {} as Record<string, ArchitectRecommendation[]>);

  const typeLabels: Record<string, string> = {
    cost_optimization: 'Cost Optimization',
    performance: 'Performance',
    reliability: 'Reliability',
    security: 'Security',
    best_practice: 'Best Practices'
  };

  const criticalCount = recommendations.filter(r => r.severity === 'critical').length;
  const highCount = recommendations.filter(r => r.severity === 'high').length;

  return (
    <Flex flexDirection="column" gap={24} padding={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={3}>AI Architect</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Intelligent pattern detection and optimization recommendations
          </span>
        </div>
        <Flex gap={12}>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
          <Button variant="accent" onClick={() => navigate('/remediation')}>
            Remediation Library
          </Button>
        </Flex>
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

      {/* Summary Stats */}
      <Surface>
        <Flex padding={16} gap={32} alignItems="center">
          <div>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{recommendations.length}</span>
            <span style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)', marginLeft: 8 }}>
              Total Recommendations
            </span>
          </div>
          <div style={{ borderLeft: '1px solid var(--dt-colors-border-default)', paddingLeft: 32 }}>
            <Flex gap={24}>
              {criticalCount > 0 && (
                <Flex alignItems="center" gap={8}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--dt-colors-feedback-critical-default)' }}>
                    {criticalCount}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>Critical</span>
                </Flex>
              )}
              {highCount > 0 && (
                <Flex alignItems="center" gap={8}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--dt-colors-feedback-warning-default)' }}>
                    {highCount}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>High</span>
                </Flex>
              )}
            </Flex>
          </div>
        </Flex>
      </Surface>

      {/* Recommendations by Type */}
      {recommendations.length === 0 ? (
        <Surface>
          <Flex padding={48} flexDirection="column" alignItems="center" gap={16}>
            <span style={{ fontSize: 48 }}>✨</span>
            <Heading level={4}>All Clear!</Heading>
            <span style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center' }}>
              No issues detected. Your AI services are following best practices.
            </span>
          </Flex>
        </Surface>
      ) : (
        Object.entries(groupedRecommendations).map(([type, recs]) => (
          <Flex key={type} flexDirection="column" gap={12}>
            <Heading level={5}>{typeLabels[type] || type}</Heading>
            <Flex flexDirection="column" gap={8}>
              {recs
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
                })
                .map(rec => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onInvestigate={() => handleInvestigate(rec)}
                    onApply={() => handleApplyFix(rec)}
                  />
                ))}
            </Flex>
          </Flex>
        ))
      )}
    </Flex>
  );
};
