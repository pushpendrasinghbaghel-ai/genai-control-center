// Provider Comparison - Unified Governance View

import React, { useState, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading } from '@dynatrace/strato-components/typography';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { useProviderComparison, useModelComparison, useDistinctServices, QueryFilters } from '../hooks';
import { FilterBar, FilterOptions } from '../components/FilterBar';
import { formatNumber, formatCurrency, normalizeProviderName } from '../utils';

// Provider Card Component
const ProviderCard: React.FC<{
  provider: string;
  stats: {
    totalRequests: number;
    avgLatency: number;
    errorRate: number;
    totalTokens: number;
    estimatedCost: number;
  };
  maxRequests: number;
}> = ({ provider, stats, maxRequests }) => {
  const providerColors: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d97706',
    google: '#4285f4',
    azure: '#0078d4',
    aws: '#ff9900',
    cohere: '#39594d'
  };

  const normalizedProvider = normalizeProviderName(provider);
  const color = providerColors[normalizedProvider] || 'var(--dt-colors-charts-categorical-default-1)';
  
  // Safely convert all numeric values
  const totalRequests = Number(stats.totalRequests) || 0;
  const avgLatency = Number(stats.avgLatency) || 0;
  const errorRate = Number(stats.errorRate) || 0;
  const totalTokens = Number(stats.totalTokens) || 0;
  const estimatedCost = Number(stats.estimatedCost) || 0;
  
  const barWidth = maxRequests > 0 ? (totalRequests / maxRequests) * 100 : 0;

  return (
    <Surface>
      <Flex padding={16} flexDirection="column" gap={12}>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={8}>
            <div style={{ 
              width: 12, height: 12, borderRadius: '50%', 
              backgroundColor: color 
            }} />
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{provider}</span>
          </Flex>
          <span style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
            {formatNumber(totalRequests)} requests
          </span>
        </Flex>

        {/* Request Bar */}
        <div style={{ 
          height: 8, borderRadius: 4, 
          backgroundColor: 'var(--dt-colors-background-default-secondary)'
        }}>
          <div style={{ 
            width: `${barWidth}%`, height: '100%', borderRadius: 4,
            backgroundColor: color
          }} />
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{avgLatency.toFixed(0)}ms</span>
            <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Avg Latency</div>
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{errorRate.toFixed(2)}%</span>
            <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Error Rate</div>
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{formatNumber(totalTokens)}</span>
            <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Tokens</div>
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{formatCurrency(estimatedCost)}</span>
            <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Est. Cost</div>
          </div>
        </div>
      </Flex>
    </Surface>
  );
};

// Model Table Component
const ModelTable: React.FC<{
  models: Array<{
    modelName: string;
    provider: string;
    avgLatency: number;
    avgTokensPerRequest: number;
    errorRate: number;
    requestCount: number;
  }>;
}> = ({ models }) => {
  if (!models || models.length === 0) {
    return (
      <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
        No model data available
      </span>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dt-colors-border-default)' }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Model</th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Provider</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Requests</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Avg Latency</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Avg Tokens</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: 12, fontWeight: 600 }}>Error Rate</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model, index) => {
            const avgLatency = Number(model.avgLatency) || 0;
            const errorRate = Number(model.errorRate) || 0;
            const avgTokens = Number(model.avgTokensPerRequest) || 0;
            const requestCount = Number(model.requestCount) || 0;
            
            return (
              <tr key={index} style={{ borderBottom: '1px solid var(--dt-colors-border-default)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{model.modelName}</td>
                <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{model.provider}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatNumber(requestCount)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{avgLatency.toFixed(0)}ms</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatNumber(avgTokens)}</td>
                <td style={{ 
                  padding: '12px 8px', textAlign: 'right',
                  color: errorRate > 5 ? 'var(--dt-colors-feedback-critical-default)' : 'inherit'
                }}>
                  {errorRate.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const ProviderComparison: React.FC = () => {
  // Filter state with native Dynatrace timeframe
  const [filters, setFilters] = useState<FilterOptions>({
    timeframe: null, // null means use default (last 24h)
    filterQuery: '',
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

  const { data: providerData, loading: loadingProviders, refetch: refetchProviders } = useProviderComparison(queryFilters);
  const { data: modelData, loading: loadingModels, refetch: refetchModels } = useModelComparison(queryFilters);
  const { data: availableServices } = useDistinctServices(queryFilters);

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
    <Flex flexDirection="column" gap={24} padding={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <div>
          <Heading level={3}>Provider Comparison</Heading>
          <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
            Unified governance view across all AI providers
          </span>
        </div>
      </Flex>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={handleRefresh}
      />

      {/* Summary Stats */}
      {totals && (
        <Surface>
          <Flex padding={24} gap={48} justifyContent="center">
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>
                {providerData?.length || 0}
              </span>
              <div style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)' }}>
                Providers
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>
                {formatNumber(totals.requests)}
              </span>
              <div style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)' }}>
                Total Requests
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>
                {formatNumber(totals.tokens)}
              </span>
              <div style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)' }}>
                Total Tokens
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>
                {formatCurrency(totals.cost)}
              </span>
              <div style={{ fontSize: 14, color: 'var(--dt-colors-text-secondary-default)' }}>
                Estimated Cost
              </div>
            </div>
          </Flex>
        </Surface>
      )}

      {/* Provider Cards */}
      <Flex flexDirection="column" gap={16}>
        <Heading level={5}>Providers</Heading>
        {loading ? (
          <Flex justifyContent="center" padding={32}>
            <ProgressCircle />
          </Flex>
        ) : !providerData || providerData.length === 0 ? (
          <Surface>
            <Flex padding={32} justifyContent="center" alignItems="center" flexDirection="column" gap={16}>
              <span style={{ fontSize: 48 }}>📊</span>
              <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                No provider data available for the selected time range
              </span>
            </Flex>
          </Surface>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
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
          </div>
        )}
      </Flex>

      {/* Model Comparison Table */}
      <Surface>
        <Flex flexDirection="column" gap={16} padding={16}>
          <Heading level={5}>Model Performance</Heading>
          {loadingModels ? (
            <Flex justifyContent="center" padding={16}>
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
