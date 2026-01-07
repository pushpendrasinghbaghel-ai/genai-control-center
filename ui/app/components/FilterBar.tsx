/**
 * FilterBar - Standard Dynatrace filter bar following official UX patterns
 * Uses FilterField for text-based filtering with suggestions (like Problems app)
 * Combined with TimeframeSelector for time range
 * 
 * Filter keys map to Grail fields:
 * - service → dt.entity.service (entity ID for GenAI services)
 * - provider → gen_ai.provider.name  
 * - model → gen_ai.request.model
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { RefreshIcon } from '@dynatrace/strato-icons';
import { 
  FilterField,
  TimeframeSelector,
  type FilterFieldValidatorMap
} from '@dynatrace/strato-components-preview/filters';
import type { Timeframe } from '@dynatrace/strato-components-preview/core';

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
 * Parse filter string to extract individual filter values
 * Returns the display values (service name) not entity IDs
 */
const parseFilterString = (filterString: string): { service?: string; provider?: string; model?: string } => {
  const result: { service?: string; provider?: string; model?: string } = {};
  
  // Match patterns like: service="value" or service=value
  const serviceMatch = filterString.match(/service\s*=\s*"([^"]+)"/i) || 
                       filterString.match(/service\s*=\s*([^\s"]+)/i);
  const providerMatch = filterString.match(/provider\s*=\s*"([^"]+)"/i) ||
                        filterString.match(/provider\s*=\s*([^\s"]+)/i);
  const modelMatch = filterString.match(/model\s*=\s*"([^"]+)"/i) ||
                     filterString.match(/model\s*=\s*([^\s"]+)/i);
  
  if (serviceMatch) result.service = serviceMatch[1];
  if (providerMatch) result.provider = providerMatch[1];
  if (modelMatch) result.model = modelMatch[1];
  
  return result;
};

/**
 * Standard Dynatrace FilterBar component
 * Uses FilterField for text-based filtering with dynamic suggestions
 * 
 * Usage: Type 'service=' to see available GenAI services, then select one
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
  // Track suggestion state for dynamic rendering
  const [suggestionType, setSuggestionType] = useState<'key' | 'value' | 'none'>('none');
  const [currentKey, setCurrentKey] = useState<string>('');

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
    
    return parts.join(' AND ');
  }, [filters.serviceFilter, filters.providerFilter, filters.modelFilter, availableServices]);

  // Validator map with dynamic value suggestions from GenAI data
  const validatorMap = useMemo<FilterFieldValidatorMap>(() => ({
    keyPredicates: {
      service: {
        operators: ['equals', 'not-equals'],
        // Provide service names as suggestions
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

  // Handle suggestion state changes
  const handleSuggest = useCallback((state?: {
    suggestionTypes: ('key' | 'value' | 'comparisonOperator' | 'pastedContent' | 'none')[];
    currentStatement?: { key?: { value?: string } };
  }) => {
    if (!state) {
      setSuggestionType('none');
      return;
    }
    
    const types = state.suggestionTypes;
    if (types.includes('key')) {
      setSuggestionType('key');
      setCurrentKey('');
    } else if (types.includes('value')) {
      setSuggestionType('value');
      const keyValue = state.currentStatement?.key?.value;
      setCurrentKey(keyValue || '');
    } else {
      setSuggestionType('none');
    }
  }, []);

  // Handle filter changes and convert service names to entity IDs
  const handleFilterChange = useCallback((value: string, _tree: unknown, _isValid: boolean) => {
    const parsed = parseFilterString(value);
    
    // Convert service name to entity ID for DQL filtering
    const serviceEntityId = parsed.service 
      ? (serviceNameToIdMap.get(parsed.service) || parsed.service)
      : '';
    
    onFiltersChange({
      ...filters,
      filterQuery: value,
      serviceFilter: serviceEntityId,
      providerFilter: parsed.provider || '',
      modelFilter: parsed.model || ''
    });
  }, [filters, onFiltersChange, serviceNameToIdMap]);

  // Handle filter apply (Enter key)
  const handleFilter = useCallback((filterState: { value: string; syntaxTree: unknown; isValid: boolean }) => {
    const parsed = parseFilterString(filterState.value);
    
    // Convert service name to entity ID
    const serviceEntityId = parsed.service 
      ? (serviceNameToIdMap.get(parsed.service) || parsed.service)
      : '';
    
    onFiltersChange({
      ...filters,
      filterQuery: filterState.value,
      serviceFilter: serviceEntityId,
      providerFilter: parsed.provider || '',
      modelFilter: parsed.model || ''
    });
  }, [filters, onFiltersChange, serviceNameToIdMap]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((timeframe: Timeframe | null) => {
    if (timeframe) {
      onFiltersChange({ ...filters, timeframe });
    }
  }, [filters, onFiltersChange]);

  // Get value suggestions based on current key
  const valueSuggestions = useMemo(() => {
    if (suggestionType !== 'value') return [];
    
    switch (currentKey.toLowerCase()) {
      case 'service':
        return availableServices.map(s => ({ 
          value: s.entityName, 
          displayValue: s.entityName 
        }));
      case 'provider':
        return availableProviders.map(p => ({ value: p, displayValue: p }));
      case 'model':
        return availableModels.map(m => ({ value: m, displayValue: m }));
      default:
        return [];
    }
  }, [suggestionType, currentKey, availableServices, availableProviders, availableModels]);

  return (
    <Flex alignItems="center" gap={16} style={{ width: '100%', padding: '8px 0' }}>
      {/* FilterField - Text-based filter with dynamic suggestions */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <FilterField
          value={filterValue}
          onChange={handleFilterChange}
          onFilter={handleFilter}
          onSuggest={handleSuggest}
          validatorMap={validatorMap}
          autoSuggestions
          placeholder="Type to filter (service, provider, model)"
        >
          <FilterField.Suggestions>
            {/* Show key suggestions when appropriate */}
            {suggestionType === 'key' && (
              <FilterField.SuggestionGroup label="Filter by">
                <FilterField.Suggestion value="service" displayValue="Service" details="GenAI service name" />
                <FilterField.Suggestion value="provider" displayValue="Provider" details="AI provider (openai, anthropic, etc.)" />
                <FilterField.Suggestion value="model" displayValue="Model" details="Model name (gpt-4, claude-3, etc.)" />
              </FilterField.SuggestionGroup>
            )}
            
            {/* Show value suggestions when entering a value */}
            {suggestionType === 'value' && valueSuggestions.length > 0 && (
              <FilterField.SuggestionGroup label={`Available ${currentKey}s`}>
                {valueSuggestions.map((suggestion, idx) => (
                  <FilterField.Suggestion 
                    key={`${suggestion.value}-${idx}`}
                    value={suggestion.value} 
                    displayValue={suggestion.displayValue}
                  />
                ))}
              </FilterField.SuggestionGroup>
            )}
          </FilterField.Suggestions>
        </FilterField>
      </div>

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
            <span>Refresh</span>
          </Flex>
        </Button>
      )}
    </Flex>
  );
};

export default FilterBar;
