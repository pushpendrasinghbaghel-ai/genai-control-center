/**
 * FilterBar - Standard Dynatrace filter bar following official UX patterns
 * Uses FilterField for in-context filtering with auto-suggestions
 * Combined with TimeframeSelector for time range
 * 
 * Filter keys map to Grail fields:
 * - service → dt.entity.service (entity ID for GenAI services)
 * - provider → gen_ai.provider.name  
 * - model → gen_ai.request.model
 */

import React, { useCallback, useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { RefreshIcon } from '@dynatrace/strato-icons';
import { 
  FilterField,
  TimeframeSelector,
  type FilterFieldValidatorMap
} from '@dynatrace/strato-components/filters';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { Text } from '@dynatrace/strato-components/typography';

/** Service option with both display name and entity ID for Grail queries */
export interface ServiceOption {
  entityId: string;   // e.g., SERVICE-xxx - used for DQL filtering
  entityName: string; // Display name shown in UI
}

export interface FilterOptions {
  /** Timeframe object from Dynatrace TimeframeSelector */
  timeframe: Timeframe | null;
  /** Free-text filter query */
  filterQuery: string;
  /** Service entity ID (SERVICE-xxx) for DQL filtering */
  serviceFilter: string;
  /** Provider name (gen_ai.provider.name) */
  providerFilter: string;
  /** Model name (gen_ai.request.model) */
  modelFilter: string;
}

/** Create a default Timeframe object (last 24 hours) */
export const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
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

interface FilterBarProps {
  /** Current filter values */
  filters: FilterOptions;
  /** Callback when any filter changes */
  onFiltersChange: (filters: FilterOptions) => void;
  /** Callback when refresh is triggered */
  onRefresh?: () => void;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Available GenAI services (with entity ID and name) */
  availableServices?: ServiceOption[];
  /** Available providers (gen_ai.provider.name values) */
  availableProviders?: string[];
  /** Available models (gen_ai.request.model values) */
  availableModels?: string[];
}

/**
 * Parse filter tree to extract individual filter values
 */
interface FilterStatement {
  key?: { value?: string };
  value?: { value?: string };
}

interface FilterTree {
  children?: (FilterStatement | FilterTree)[];
  key?: { value?: string };
  value?: { value?: string };
}

const extractFiltersFromTree = (
  tree: FilterTree | null,
  serviceNameToIdMap: Map<string, string>
): { service: string; provider: string; model: string } => {
  const result = { service: '', provider: '', model: '' };
  
  if (!tree) return result;

  const processNode = (node: FilterStatement | FilterTree) => {
    if ('key' in node && node.key?.value && 'value' in node && node.value?.value) {
      const key = node.key.value.toLowerCase();
      const value = node.value.value;
      
      switch (key) {
        case 'service':
          // Convert service name to entity ID if available
          result.service = serviceNameToIdMap.get(value) || value;
          break;
        case 'provider':
          result.provider = value;
          break;
        case 'model':
          result.model = value;
          break;
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach(processNode);
    }
  };

  if (tree.children) {
    tree.children.forEach(processNode);
  } else {
    processNode(tree);
  }

  return result;
};

/**
 * Standard Dynatrace FilterBar component
 * Uses FilterField for in-context filtering with auto-suggestions
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  onRefresh,
  isLoading = false,
  availableServices = [],
  availableProviders = [],
  availableModels = []
}) => {
  // Create name-to-ID map for service lookup
  const serviceNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    availableServices.forEach(s => map.set(s.entityName, s.entityId));
    return map;
  }, [availableServices]);

  // Build the filter string from current filter values (display names)
  const filterValue = useMemo(() => {
    const parts: string[] = [];
    
    // For service, find the display name from entity ID
    if (filters.serviceFilter) {
      const serviceName = availableServices.find(s => s.entityId === filters.serviceFilter)?.entityName 
                         || filters.serviceFilter;
      parts.push(`service="${serviceName}"`);
    }
    if (filters.providerFilter) parts.push(`provider="${filters.providerFilter}"`);
    if (filters.modelFilter) parts.push(`model="${filters.modelFilter}"`);
    
    return parts.join(' ');
  }, [filters.serviceFilter, filters.providerFilter, filters.modelFilter, availableServices]);

  // Validator map with dynamic value suggestions from GenAI data
  const validatorMap = useMemo<FilterFieldValidatorMap>(() => ({
    keyPredicates: {
      service: {
        operators: ['equals', 'not-equals'],
        valuePredicate: availableServices.length > 0 
          ? availableServices.map(s => s.entityName)
          : { type: 'String' as const }
      },
      provider: {
        operators: ['equals', 'not-equals'],
        valuePredicate: availableProviders.length > 0 
          ? availableProviders 
          : { type: 'String' as const }
      },
      model: {
        operators: ['equals', 'not-equals'],
        valuePredicate: availableModels.length > 0 
          ? availableModels 
          : { type: 'String' as const }
      }
    },
    exhaustive: false
  }), [availableServices, availableProviders, availableModels]);

  // Handle filter submission (Enter key or button)
  const handleFilter = useCallback((filterState: { value: string; syntaxTree: unknown; isValid: boolean }) => {
    const extracted = extractFiltersFromTree(filterState.syntaxTree as FilterTree, serviceNameToIdMap);
    
    onFiltersChange({
      ...filters,
      filterQuery: filterState.value,
      serviceFilter: extracted.service,
      providerFilter: extracted.provider,
      modelFilter: extracted.model
    });
  }, [filters, onFiltersChange, serviceNameToIdMap]);

  // Handle real-time changes as user types (required for controlled FilterField)
  const handleChange = useCallback((value: string, syntaxTree: unknown, isValid: boolean) => {
    // Update the filter query in real-time to allow typing
    // Only update parsed filters when valid and user submits (in handleFilter)
    onFiltersChange({
      ...filters,
      filterQuery: value
    });
  }, [filters, onFiltersChange]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((timeframe: Timeframe | null) => {
    if (timeframe) {
      onFiltersChange({ ...filters, timeframe });
    }
  }, [filters, onFiltersChange]);

  return (
    <Flex alignItems="center" gap={16} style={{ width: '100%', padding: '8px 0' }}>
      {/* FilterField - In-context filtering with auto-suggestions */}
      <Flex style={{ flex: 1, minWidth: 300 }}>
        <FilterField
          value={filters.filterQuery}
          onChange={handleChange}
          onFilter={handleFilter}
          validatorMap={validatorMap}
          autoSuggestions
          placeholder="Filter by service, provider, model (e.g., service=myapp)"
        />
      </Flex>

      {/* TimeframeSelector */}
      <TimeframeSelector
        value={filters.timeframe || createDefaultTimeframe()}
        onChange={handleTimeframeChange}
      />

      {/* Refresh Button */}
      {onRefresh && (
        <Button 
          variant="default" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <Flex alignItems="center" gap={4}>
            <RefreshIcon />
            <Text>Refresh</Text>
          </Flex>
        </Button>
      )}
    </Flex>
  );
};

export default FilterBar;
