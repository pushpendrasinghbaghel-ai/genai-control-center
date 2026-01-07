// AI Architect - Pillar B: Pattern Detection & Recommendations

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { useAIServicesDiscovery, useAIArchitect, getSeverityColor, useDistinctServices, useDistinctProviders, QueryFilters } from '../hooks';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import type { ArchitectRecommendation } from '../types';

// Recommendation Card Component - Compact
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
    <Flex 
      padding={12} 
      gap={12}
      alignItems="flex-start"
      style={{ 
        background: 'var(--dt-colors-surface-default)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      <span style={{ fontSize: 20 }}>{icons[recommendation.type] || '💡'}</span>
      <div style={{ flex: 1 }}>
        <Flex alignItems="center" gap={8} style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{recommendation.title}</span>
          <span style={{ 
            fontSize: 9, padding: '2px 5px', borderRadius: 3,
            backgroundColor: getSeverityColor(recommendation.severity) + '20',
            color: getSeverityColor(recommendation.severity),
            textTransform: 'uppercase', fontWeight: 600
          }}>
            {recommendation.severity}
          </span>
          {recommendation.estimatedImpact && (
            <span style={{ 
              fontSize: 12, fontWeight: 600, marginLeft: 'auto',
              color: recommendation.type === 'cost_optimization' ? 'var(--dt-colors-feedback-success-default)' : 'inherit'
            }}>
              {recommendation.estimatedImpact}
            </span>
          )}
        </Flex>
        {recommendation.affectedService && (
          <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
            {recommendation.affectedService}
          </span>
        )}
        <p style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)', margin: '6px 0 0' }}>
          {recommendation.description}
        </p>
      </div>
      <Flex gap={6}>
        {onInvestigate && <Button onClick={onInvestigate}>Investigate</Button>}
        {onApply && <Button variant="accent" onClick={onApply}>Apply</Button>}
      </Flex>
    </Flex>
  );
};

export const AIArchitect: React.FC = () => {
  const navigate = useNavigate();
  
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();

  // Get available service options (with entity IDs)
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  
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
  const queryFilters: QueryFilters = useMemo(() => {
    const serviceEntityId = filters.serviceFilter 
      ? serviceNameToIdMap.get(filters.serviceFilter) || filters.serviceFilter
      : undefined;
    
    return {
      timeframe: filters.timeframe,
      serviceName: serviceEntityId,
      provider: filters.providerFilter || undefined
    };
  }, [filters, serviceNameToIdMap]);

  const { data: services, loading: servicesLoading, refetch } = useAIServicesDiscovery(queryFilters);
  const { recommendations, loading: recommendationsLoading, analyzing } = useAIArchitect(services || []);

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
      <Flex justifyContent="center" alignItems="center" style={{ height: '40vh' }}>
        <Flex flexDirection="column" alignItems="center" gap={12}>
          <ProgressCircle />
          <span style={{ fontSize: 13 }}>{analyzing ? 'Analyzing patterns...' : 'Loading services...'}</span>
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
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={4}>AI Architect</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
            Pattern detection and optimization recommendations
          </span>
        </div>
        <Flex gap={8}>
          <Button onClick={() => navigate('/')}>Dashboard</Button>
          <Button variant="accent" onClick={() => navigate('/remediation')}>
            Remediation
          </Button>
        </Flex>
      </Flex>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
      />

      {/* Summary Stats - Compact */}
      <Flex gap={16} alignItems="center" padding={12} style={{ 
        background: 'var(--dt-colors-surface-default)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-border-neutral-default)'
      }}>
        <div>
          <span style={{ fontSize: 24, fontWeight: 700 }}>{recommendations.length}</span>
          <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)', marginLeft: 6 }}>
            Recommendations
          </span>
        </div>
        {(criticalCount > 0 || highCount > 0) && (
          <div style={{ borderLeft: '1px solid var(--dt-colors-border-default)', paddingLeft: 16 }}>
            <Flex gap={16}>
              {criticalCount > 0 && (
                <Flex alignItems="center" gap={4}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dt-colors-feedback-critical-default)' }}>
                    {criticalCount}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Critical</span>
                </Flex>
              )}
              {highCount > 0 && (
                <Flex alignItems="center" gap={4}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--dt-colors-feedback-warning-default)' }}>
                    {highCount}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>High</span>
                </Flex>
              )}
            </Flex>
          </div>
        )}
      </Flex>

      {/* Recommendations by Type */}
      {recommendations.length === 0 ? (
        <Flex padding={32} flexDirection="column" alignItems="center" gap={12} style={{
          background: 'var(--dt-colors-surface-default)',
          borderRadius: 6,
          border: '1px solid var(--dt-colors-border-neutral-default)'
        }}>
          <span style={{ fontSize: 36 }}>✨</span>
          <Heading level={5}>All Clear!</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', fontSize: 13 }}>
            No issues detected. Your AI services are following best practices.
          </span>
        </Flex>
      ) : (
        Object.entries(groupedRecommendations).map(([type, recs]) => (
          <Flex key={type} flexDirection="column" gap={8}>
            <Heading level={6}>{typeLabels[type] || type}</Heading>
            <Flex flexDirection="column" gap={6}>
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
