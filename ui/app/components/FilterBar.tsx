/**
 * FilterBar - Standard Dynatrace filter bar following UX patterns
 * Layout: SegmentSelector | FilterField | TimeframeSelector | Refresh
 * 
 * Reference: https://developer.dynatrace.com/design/filtering/
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { RefreshIcon, PlayIcon } from '@dynatrace/strato-icons';
import { 
  FilterField,
  TimeframeSelector,
  SegmentSelector
} from '@dynatrace/strato-components-preview/filters';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';

export interface FilterOptions {
  /** Timeframe object from Dynatrace TimeframeSelector */
  timeframe: Timeframe | null;
  /** Free-text filter query */
  filterQuery: string;
  /** Parsed filter values for specific fields */
  serviceFilter: string;
  providerFilter: string;
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
  /** Available services for suggestions */
  availableServices?: string[];
  /** Available providers for suggestions */
  availableProviders?: string[];
  /** Available models for suggestions */
  availableModels?: string[];
}

// Filter keys matching Dynatrace entity naming conventions
const FILTER_KEYS = {
  SERVICE: 'dt.entity.service.name',
  PROVIDER: 'gen_ai.provider.name',
  MODEL: 'gen_ai.request.model'
} as const;

/**
 * Parse the FilterField syntax tree to extract filter values
 * The tree structure: { type: 'Group', children: [{ type: 'Statement', key, operator, value }] }
 */
const parseFilterTree = (tree: any): { service?: string; provider?: string; model?: string } => {
  const result: { service?: string; provider?: string; model?: string } = {};
  
  if (!tree) {
    console.log('[FilterBar] parseFilterTree: tree is null/undefined');
    return result;
  }
  
  console.log('[FilterBar] parseFilterTree: tree =', JSON.stringify(tree, null, 2));
  
  if (tree.type !== 'Group') {
    console.log('[FilterBar] parseFilterTree: tree.type is not Group:', tree.type);
    return result;
  }
  
  const extractValue = (node: any): string | undefined => {
    if (!node.value) return undefined;
    if (node.value.type === 'Value') {
      return node.value.value;
    }
    if (node.value.type === 'Contains' || node.value.type === 'StartsWith' || node.value.type === 'EndsWith') {
      return node.value.value;
    }
    return undefined;
  };
  
  const processNode = (node: any) => {
    console.log('[FilterBar] processNode:', node);
    if (node.type === 'Statement') {
      const key = node.key?.value;
      const value = extractValue(node);
      console.log('[FilterBar] Found statement: key=', key, 'value=', value);
      
      if (key === FILTER_KEYS.SERVICE && value) {
        result.service = value;
      } else if (key === FILTER_KEYS.PROVIDER && value) {
        result.provider = value;
      } else if (key === FILTER_KEYS.MODEL && value) {
        result.model = value;
      }
    } else if (node.type === 'Group' && node.children) {
      node.children.forEach(processNode);
    }
  };
  
  tree.children?.forEach(processNode);
  console.log('[FilterBar] parseFilterTree result:', result);
  return result;
};

/**
 * Standard Dynatrace FilterBar component
 * Matches the Services app UX pattern with:
 * - SegmentSelector (left)
 * - FilterField for text filtering (center, expandable)
 * - TimeframeSelector (right)
 * - Update button (enabled when filters change)
 * - Refresh button (far right)
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
  // Pending filter state - holds changes until Update is clicked
  const [pendingFilters, setPendingFilters] = useState<FilterOptions>(filters);
  const [filterValue, setFilterValue] = useState(filters.filterQuery || '');
  const [pendingFilterTree, setPendingFilterTree] = useState<any>(null);

  // Track if there are unsaved changes
  const hasChanges = useMemo(() => {
    const timeframeChanged = JSON.stringify(pendingFilters.timeframe) !== JSON.stringify(filters.timeframe);
    const filterQueryChanged = filterValue !== (filters.filterQuery || '');
    return timeframeChanged || filterQueryChanged;
  }, [pendingFilters.timeframe, filters.timeframe, filterValue, filters.filterQuery]);

  // Sync pending state when applied filters change externally
  useEffect(() => {
    setPendingFilters(filters);
    setFilterValue(filters.filterQuery || '');
  }, [filters]);

  // Build validatorMap for FilterField with proper entity keys and types
  // This enables the standard operator suggestions (=, !=, in(), contains, etc.)
  // keyPredicates defines allowed keys and their value options
  const validatorMap = useMemo(() => {
    console.log('[FilterBar] Building validatorMap with:', {
      availableServices,
      availableProviders,
      availableModels
    });
    
    return {
      exhaustive: false, // Allow any key, but suggest these
      keyPredicates: {
        [FILTER_KEYS.SERVICE]: {
          valuePredicate: availableServices.length > 0 
            ? [...availableServices, { type: 'String' as const }]
            : [{ type: 'String' as const }]
        },
        [FILTER_KEYS.PROVIDER]: {
          valuePredicate: availableProviders.length > 0
            ? [...availableProviders, { type: 'String' as const }]
            : [{ type: 'String' as const }]
        },
        [FILTER_KEYS.MODEL]: {
          valuePredicate: availableModels.length > 0
            ? [...availableModels, { type: 'String' as const }]
            : [{ type: 'String' as const }]
        }
      }
    };
  }, [availableServices, availableProviders, availableModels]);

  // Handle timeframe changes - store in pending state
  const handleTimeframeChange = useCallback((value: Timeframe | null) => {
    console.log('[FilterBar] Timeframe changed (pending):', value);
    setPendingFilters(prev => ({ ...prev, timeframe: value }));
  }, []);

  // Handle filter field changes - store in local state
  const handleFilterChange = useCallback((value: string) => {
    setFilterValue(value);
  }, []);

  // Handle filter field submission (Enter key) - store the parsed tree for later
  const handleFilterSubmit = useCallback((filterState: { 
    value: string; 
    syntaxTree: any; 
    isValid: boolean 
  }) => {
    const { syntaxTree } = filterState;
    console.log('[FilterBar] Filter entered (pending):', filterState);
    setPendingFilterTree(syntaxTree);
  }, []);

  // Apply all pending changes when Update is clicked
  const handleUpdate = useCallback(() => {
    console.log('[FilterBar] Applying filters...');
    
    // Parse the filter tree to extract field values
    const parsed = parseFilterTree(pendingFilterTree);
    console.log('[FilterBar] Parsed filter values:', parsed);
    
    const newFilters: FilterOptions = {
      timeframe: pendingFilters.timeframe,
      filterQuery: filterValue,
      serviceFilter: parsed.service || '',
      providerFilter: parsed.provider || '',
      modelFilter: parsed.model || ''
    };
    
    console.log('[FilterBar] Applying new filters:', newFilters);
    onFiltersChange(newFilters);
  }, [pendingFilters.timeframe, filterValue, pendingFilterTree, onFiltersChange]);

  return (
    <Flex 
      alignItems="center" 
      gap={0}
      style={{ 
        width: '100%',
        borderBottom: '1px solid var(--dt-colors-border-neutral-default)'
      }}
    >
      {/* Segment Selector - matches standard Dynatrace UX */}
      <SegmentSelector />

      {/* Filter Field with validatorMap for entity-based filtering */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <FilterField
          value={filterValue}
          onChange={handleFilterChange}
          onFilter={handleFilterSubmit}
          validatorMap={validatorMap}
          autoSuggestions
          placeholder="Filter by dt.entity.service.name, gen_ai.provider.name, gen_ai.request.model..."
        >
          <FilterField.Suggestions>
            {/* Key suggestions only - values come from validatorMap valuePredicate */}
            <FilterField.Suggestion value={FILTER_KEYS.SERVICE}>
              {FILTER_KEYS.SERVICE}
            </FilterField.Suggestion>
            <FilterField.Suggestion value={FILTER_KEYS.PROVIDER}>
              {FILTER_KEYS.PROVIDER}
            </FilterField.Suggestion>
            <FilterField.Suggestion value={FILTER_KEYS.MODEL}>
              {FILTER_KEYS.MODEL}
            </FilterField.Suggestion>
          </FilterField.Suggestions>
        </FilterField>
      </div>

      {/* Timeframe Selector - controlled with pending state */}
      <TimeframeSelector
        value={pendingFilters.timeframe || createDefaultTimeframe()}
        onChange={handleTimeframeChange}
      />

      {/* Update Button - enabled when filters have changed */}
      <Button 
        variant="accent" 
        onClick={handleUpdate}
        disabled={!hasChanges || isLoading}
        style={{ marginLeft: 8 }}
      >
        <Flex alignItems="center" gap={4}>
          <PlayIcon />
          <span>Update</span>
        </Flex>
      </Button>

      {/* Refresh Button */}
      {onRefresh && (
        <Button 
          variant="default" 
          onClick={onRefresh}
          disabled={isLoading}
          style={{ marginLeft: 8 }}
        >
          <Flex alignItems="center" gap={4}>
            <RefreshIcon />
            <span>Refresh</span>
          </Flex>
        </Button>
      )}
    </Flex>
  );
};

export default FilterBar;
