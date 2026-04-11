/**
 * FilterContext - Global filter state that persists across pages
 * Provides consistent filtering experience across all GCC pages
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { Timeframe } from '@dynatrace/strato-components/core';

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
  from: { value: 'now()-2h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

/** Default filter values */
export const DEFAULT_FILTERS: FilterOptions = {
  timeframe: createDefaultTimeframe(),
  filterQuery: '',
  serviceFilter: '',
  providerFilter: '',
  modelFilter: ''
};

/** Convert a Timeframe to DQL-compatible from clause */
export const getTimeframeDqlClause = (timeframe: Timeframe | null): string => {
  if (!timeframe) {
    return 'from: now()-2h, to: now()';
  }
  const fromValue = timeframe.from?.value || 'now()-2h';
  const toValue = timeframe.to?.value || 'now()';
  return `from: ${fromValue}, to: ${toValue}`;
};

interface FilterContextValue {
  /** Current global filter state */
  filters: FilterOptions;
  /** Update filters - merges with existing */
  setFilters: (filters: FilterOptions) => void;
  /** Update a single filter field */
  updateFilter: <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Get DQL timeframe clause */
  timeframeDqlClause: string;
}

const FilterContext = createContext<FilterContextValue | null>(null);

interface FilterProviderProps {
  children: ReactNode;
}

/**
 * FilterProvider - Wrap the app with this to enable global filter state
 */
export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [filters, setFiltersState] = useState<FilterOptions>(DEFAULT_FILTERS);

  const setFilters = useCallback((newFilters: FilterOptions) => {
    console.log('[FilterContext] Updating filters:', newFilters);
    setFiltersState(newFilters);
  }, []);

  const updateFilter = useCallback(<K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const timeframeDqlClause = useMemo(() => 
    getTimeframeDqlClause(filters.timeframe)
  , [filters.timeframe]);

  const value = useMemo<FilterContextValue>(() => ({
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    timeframeDqlClause
  }), [filters, setFilters, updateFilter, resetFilters, timeframeDqlClause]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

/**
 * useGlobalFilters - Hook to access and update global filters
 */
export const useGlobalFilters = (): FilterContextValue => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useGlobalFilters must be used within a FilterProvider');
  }
  return context;
};

export default FilterContext;
