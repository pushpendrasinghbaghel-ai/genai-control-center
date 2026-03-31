// Provider Comparison - Unified Governance View

import React, { useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { BarChartIcon } from '@dynatrace/strato-icons';
import { useProviderComparison, useModelComparison, useDistinctServices, useDistinctProviders, useDistinctModels, QueryFilters } from '../hooks';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { formatNumber, formatCurrency, normalizeProviderName } from '../utils';

// Provider Card Component - Compact
const ProviderCard: React.FC<{
  provider: string;
  stats: {
    totalRequests: number;
    avgLatency: number;
    errorRate: number;
    totalTokens: number;
    estimatedCost: number;
    slowRequestRate?: number;
    lowOutputRate?: number;
    avgOutputTokens?: number;
  };
  maxRequests: number;
}> = ({ provider, stats, maxRequests }) => {
  const providerColors: Record<string, string> = {
    openai: 'var(--dt-colors-charts-categorical-color-03-default)',
    anthropic: 'var(--dt-colors-charts-status-warning-default)',
    google: 'var(--dt-colors-charts-categorical-color-01-default)',
    azure: 'var(--dt-colors-charts-categorical-color-01-default)',
    aws: 'var(--dt-colors-charts-categorical-color-04-default)',
    cohere: 'var(--dt-colors-charts-categorical-color-07-default)'
  };

  const normalizedProvider = normalizeProviderName(provider);
  const color = providerColors[normalizedProvider] || 'var(--dt-colors-charts-categorical-default-1)';
  
  const totalRequests = Number(stats.totalRequests) || 0;
  const avgLatency = Number(stats.avgLatency) || 0;
  const slowRequestRate = Number(stats.slowRequestRate) || 0;
  const totalTokens = Number(stats.totalTokens) || 0;
  const estimatedCost = Number(stats.estimatedCost) || 0;
  
  const barWidth = maxRequests > 0 ? (totalRequests / maxRequests) * 100 : 0;

  return (
    <Flex 
      padding={12} 
      flexDirection="column" 
      gap={8}
      style={{ 
        background: 'var(--dt-colors-surface-default)',
        borderRadius: 6,
        border: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" gap={6}>
          <Flex style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
          <Text style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{provider}</Text>
        </Flex>
        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
          {formatNumber(totalRequests)} requests
        </Text>
      </Flex>

      <Flex style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--dt-colors-background-default-secondary)' }}>
        <Flex style={{ width: `${barWidth}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
      </Flex>

      <Flex style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Flex>
          <Flex style={{ fontSize: 14, fontWeight: 600 }}>{avgLatency.toFixed(0)}ms</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>Latency</Flex>
        </Flex>
        <Flex>
          <Flex style={{ fontSize: 14, fontWeight: 600, color: slowRequestRate > 10 ? 'var(--dt-colors-feedback-warning-default)' : 'inherit' }}>
            {slowRequestRate.toFixed(1)}%
          </Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>Slow</Flex>
        </Flex>
        <Flex>
          <Flex style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(totalTokens)}</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</Flex>
        </Flex>
        <Flex>
          <Flex style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(estimatedCost)}</Flex>
          <Flex style={{ fontSize: 10, color: 'var(--dt-colors-text-secondary-default)' }}>Cost</Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};

// Model Table Component - Compact
const ModelTable: React.FC<{
  models: Array<{
    modelName: string;
    provider: string;
    avgLatency: number;
    avgTokensPerRequest: number;
    errorRate: number;
    requestCount: number;
    slowRequestRate?: number;
    lowOutputRate?: number;
    avgOutputTokens?: number;
  }>;
}> = ({ models }) => {
  if (!models || models.length === 0) {
    return (
      <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12 }}>
        No model data available
      </Text>
    );
  }

  return (
    <Flex style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dt-colors-border-default)' }}>
            <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Model</th>
            <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Provider</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Requests</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Latency</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--dt-colors-text-secondary-default)' }}>Slow %</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model, index) => {
            const avgLatency = Number(model.avgLatency) || 0;
            const slowRequestRate = Number(model.slowRequestRate) || 0;
            const avgTokens = Number(model.avgTokensPerRequest) || 0;
            const requestCount = Number(model.requestCount) || 0;
            
            return (
              <tr key={index} style={{ borderBottom: '1px solid var(--dt-colors-border-default)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 500, fontSize: 12 }}>{model.modelName}</td>
                <td style={{ padding: '8px 6px', textTransform: 'capitalize', fontSize: 12 }}>{model.provider}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12 }}>{formatNumber(requestCount)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12 }}>{avgLatency.toFixed(0)}ms</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12 }}>{formatNumber(avgTokens)}</td>
                <td style={{ 
                  padding: '8px 6px', textAlign: 'right', fontSize: 12,
                  color: slowRequestRate > 10 ? 'var(--dt-colors-feedback-warning-default)' : 'inherit'
                }}>
                  {slowRequestRate.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Flex>
  );
};

export const ProviderComparison: React.FC = () => {
  // Use global filter state for consistency across pages
  const { filters, setFilters } = useGlobalFilters();

  // Get available service options (with entity IDs)
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
      provider: filters.providerFilter || undefined
    };
  }, [filters, serviceNameToIdMap]);

  const { data: providerData, loading: loadingProviders, refetch: refetchProviders } = useProviderComparison(queryFilters);
  const { data: modelData, loading: loadingModels, refetch: refetchModels } = useModelComparison(queryFilters);

  const maxRequests = providerData 
    ? Math.max(...providerData.map(p => p.totalRequests), 1)
    : 1;

  const loading = loadingProviders || loadingModels;

  const handleRefresh = () => {
    refetchProviders();
    refetchModels();
  };

  // Calculate totals
  const totals = providerData?.reduce((acc, p) => ({
    requests: acc.requests + p.totalRequests,
    tokens: acc.tokens + p.totalTokens,
    cost: acc.cost + p.estimatedCost
  }), { requests: 0, tokens: 0, cost: 0 });

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Compact Header */}
      <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
        Unified Governance View Across AI Providers
      </Text>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={handleRefresh}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Summary Stats - Compact inline */}
      {totals && (
        <Flex gap={24} padding={12} alignItems="center" style={{
          background: 'var(--dt-colors-surface-default)',
          borderRadius: 6,
          border: '1px solid var(--dt-colors-border-neutral-default)'
        }}>
          <Flex style={{ textAlign: 'center' }}>
            <Flex style={{ fontSize: 22, fontWeight: 700 }}>{providerData?.length || 0}</Flex>
            <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Providers</Flex>
          </Flex>
          <Flex style={{ textAlign: 'center' }}>
            <Flex style={{ fontSize: 22, fontWeight: 700 }}>{formatNumber(totals.requests)}</Flex>
            <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Requests</Flex>
          </Flex>
          <Flex style={{ textAlign: 'center' }}>
            <Flex style={{ fontSize: 22, fontWeight: 700 }}>{formatNumber(totals.tokens)}</Flex>
            <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</Flex>
          </Flex>
          <Flex style={{ textAlign: 'center' }}>
            <Flex style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(totals.cost)}</Flex>
            <Flex style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Cost</Flex>
          </Flex>
        </Flex>
      )}

      {/* Provider Cards */}
      <Flex>
        <Heading level={6} style={{ marginBottom: 8 }}>Providers</Heading>
        {loading ? (
          <Flex justifyContent="center" padding={24}>
            <ProgressCircle />
          </Flex>
        ) : !providerData || providerData.length === 0 ? (
          <Flex padding={24} justifyContent="center" alignItems="center" flexDirection="column" gap={12} style={{
            background: 'var(--dt-colors-surface-default)',
            borderRadius: 6,
            border: '1px solid var(--dt-colors-border-neutral-default)'
          }}>
            <BarChartIcon style={{ width: 36, height: 36, color: 'var(--dt-colors-text-secondary-default)' }} />
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              No provider data available
            </Text>
          </Flex>
        ) : (
          <Flex style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {providerData.map(provider => (
              <ProviderCard
                key={provider.provider}
                provider={provider.provider}
                stats={{
                  totalRequests: provider.totalRequests,
                  avgLatency: provider.avgLatency,
                  errorRate: provider.errorRate,
                  totalTokens: provider.totalTokens,
                  estimatedCost: provider.estimatedCost
                }}
                maxRequests={maxRequests}
              />
            ))}
          </Flex>
        )}
      </Flex>

      {/* Model Comparison Table */}
      <Surface>
        <Flex flexDirection="column" gap={12} padding={12}>
          <Heading level={6}>Model Performance</Heading>
          {loadingModels ? (
            <Flex justifyContent="center" padding={12}>
              <ProgressCircle />
            </Flex>
          ) : (
            <ModelTable models={modelData || []} />
          )}
        </Flex>
      </Surface>
    </Flex>
  );
};
