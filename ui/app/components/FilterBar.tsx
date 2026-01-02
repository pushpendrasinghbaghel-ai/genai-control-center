// FilterBar - Reusable filter component with native Dynatrace TimeframeSelector

import React, { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { TimeframeSelector, FilterBar as StratoFilterBar } from '@dynatrace/strato-components-preview/filters';
import { Select, SelectOption } from '@dynatrace/strato-components-preview/forms';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';

export interface FilterOptions {
  /** Timeframe object from Dynatrace TimeframeSelector */
  timeframe: Timeframe | null;
  serviceFilter: string;
  providerFilter: string;
  modelFilter: string;
}

/** Default timeframe value (last 24 hours) */
export const getDefaultTimeframe = (): { from: string; to: string } => ({
  from: 'now()-24h',
  to: 'now()'
});

/** Convert a Timeframe to DQL-compatible from clause */
export const getTimeframeDqlClause = (timeframe: Timeframe | null): string => {
  if (!timeframe) {
    return 'from: now()-24h, to: now()';
  }
  const fromValue = timeframe.from?.value || 'now()-24h';
  const toValue = timeframe.to?.value || 'now()';
  return `from: ${fromValue}, to: ${toValue}`;
};

/** Convert a simple time range string to Timeframe for initial value */
export const timeRangeToTimeframe = (timeRange: string): { from: string; to: string } => {
  return {
    from: `now()-${timeRange}`,
    to: 'now()'
  };
};

interface FilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  services?: string[];
  providers?: string[];
  models?: string[];
  showServiceFilter?: boolean;
  showProviderFilter?: boolean;
  showModelFilter?: boolean;
  onRefresh?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  services = [],
  providers = [],
  models = [],
  showServiceFilter = true,
  showProviderFilter = false,
  showModelFilter = false,
  onRefresh
}) => {
  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleTimeframeChange = (value: Timeframe | null) => {
    updateFilter('timeframe', value);
  };

  // Calculate timeframe value for TimeframeSelector
  const timeframeValue = useMemo(() => {
    if (filters.timeframe) {
      return {
        from: filters.timeframe.from?.value || 'now()-24h',
        to: filters.timeframe.to?.value || 'now()'
      };
    }
    return getDefaultTimeframe();
  }, [filters.timeframe]);

  return (
    <Flex 
      gap={16} 
      alignItems="center" 
      flexWrap="wrap"
      style={{ 
        padding: '12px 16px',
        backgroundColor: 'var(--dt-colors-background-surface-default)',
        borderRadius: 8,
        border: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      {/* Native Dynatrace TimeframeSelector */}
      <Flex alignItems="center" gap={8}>
        <TimeframeSelector
          value={timeframeValue}
          onChange={handleTimeframeChange}
        />
      </Flex>

      {/* Service Filter */}
      {showServiceFilter && (
        <Flex alignItems="center" gap={8}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dt-colors-text-secondary-default)' }}>
            Service:
          </span>
          <div style={{ width: 200 }}>
            <Select
              value={filters.serviceFilter}
              onChange={(value) => updateFilter('serviceFilter', value || '')}
            >
              <SelectOption value="">All Services</SelectOption>
              {services.map(service => (
                <SelectOption key={service} value={service}>
                  {service}
                </SelectOption>
              ))}
            </Select>
          </div>
        </Flex>
      )}

      {/* Provider Filter */}
      {showProviderFilter && (
        <Flex alignItems="center" gap={8}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dt-colors-text-secondary-default)' }}>
            Provider:
          </span>
          <div style={{ width: 160 }}>
            <Select
              value={filters.providerFilter}
              onChange={(value) => updateFilter('providerFilter', value || '')}
            >
              <SelectOption value="">All Providers</SelectOption>
              {providers.map(provider => (
                <SelectOption key={provider} value={provider}>
                  {provider}
                </SelectOption>
              ))}
            </Select>
          </div>
        </Flex>
      )}

      {/* Model Filter */}
      {showModelFilter && (
        <Flex alignItems="center" gap={8}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dt-colors-text-secondary-default)' }}>
            Model:
          </span>
          <div style={{ width: 200 }}>
            <Select
              value={filters.modelFilter}
              onChange={(value) => updateFilter('modelFilter', value || '')}
            >
              <SelectOption value="">All Models</SelectOption>
              {models.map(model => (
                <SelectOption key={model} value={model}>
                  {model}
                </SelectOption>
              ))}
            </Select>
          </div>
        </Flex>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Refresh Button */}
      {onRefresh && (
        <Button onClick={onRefresh}>
          🔄 Refresh
        </Button>
      )}
    </Flex>
  );
};

export default FilterBar;
