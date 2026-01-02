// DQL Queries for GenAI Control Center

import type { Timeframe } from '@dynatrace/strato-components-preview/core';

/**
 * Build time range clause for DQL queries from Timeframe object
 */
export const buildTimeRangeClauseFromTimeframe = (timeframe?: Timeframe | null): string => {
  if (!timeframe) {
    return 'from: now()-24h, to: now()';
  }
  const fromValue = timeframe.from?.value || 'now()-24h';
  const toValue = timeframe.to?.value || 'now()';
  return `from: ${fromValue}, to: ${toValue}`;
};

/**
 * Build time range clause for DQL queries (legacy string-based)
 */
export const buildTimeRangeClause = (timeRange: string): string => {
  const timeMap: Record<string, string> = {
    '15m': 'from: now()-15m, to: now()',
    '1h': 'from: now()-1h, to: now()',
    '3h': 'from: now()-3h, to: now()',
    '6h': 'from: now()-6h, to: now()',
    '12h': 'from: now()-12h, to: now()',
    '24h': 'from: now()-24h, to: now()',
    '2d': 'from: now()-2d, to: now()',
    '7d': 'from: now()-7d, to: now()',
    '30d': 'from: now()-30d, to: now()',
  };
  return timeMap[timeRange] || 'from: now()-24h, to: now()';
};

/**
 * Build service filter clause for DQL queries
 */
export const buildServiceFilter = (serviceName?: string): string => {
  if (!serviceName || serviceName === '') return '';
  return `| filter service.name == "${serviceName}"`;
};

/**
 * Build provider filter clause for DQL queries
 */
export const buildProviderFilter = (provider?: string): string => {
  if (!provider || provider === '') return '';
  return `| filter gen_ai.system == "${provider}"`;
};

/**
 * Build model filter clause for DQL queries
 */
export const buildModelFilter = (model?: string): string => {
  if (!model || model === '') return '';
  return `| filter gen_ai.model_name == "${model}"`;
};

export interface QueryFilters {
  timeRange?: string;
  timeframe?: Timeframe | null;
  serviceName?: string;
  provider?: string;
  model?: string;
}

/**
 * Get the time clause from filters (supports both timeframe and legacy timeRange)
 */
const getTimeClause = (filters?: QueryFilters): string => {
  if (filters?.timeframe) {
    return buildTimeRangeClauseFromTimeframe(filters.timeframe);
  }
  return buildTimeRangeClause(filters?.timeRange || '24h');
};

/**
 * Discovery query - finds all AI-related services
 * Populates the Health-at-a-Glance dashboard
 * Includes dt.entity.service for deep linking to Services app
 */
export const AI_SERVICES_DISCOVERY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
${serviceFilter}
${providerFilter}
${modelFilter}
| summarize {
    tokens = sum(gen_ai.usage.total_tokens),
    latency = avg(duration),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count(),
    prompt_tokens = sum(gen_ai.usage.prompt_tokens),
    completion_tokens = sum(gen_ai.usage.completion_tokens),
    entity_id = takeFirst(dt.entity.service)
  }, by: { service.name, gen_ai.model_name, gen_ai.system }
| sort tokens desc
`;
};

/**
 * Query for AI service health over time (for trend charts)
 */
export const AI_SERVICES_TREND_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
${serviceFilter}
| makeTimeseries {
    tokens = sum(gen_ai.usage.total_tokens),
    latency = avg(duration),
    errors = countIf(status.code == "ERROR"),
    requests = count()
  }, by: { service.name }, interval: 5m
`;
};

/**
 * Query for provider comparison
 */
export const PROVIDER_COMPARISON_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
${serviceFilter}
| summarize {
    total_requests = count(),
    avg_latency = avg(duration),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    total_tokens = sum(gen_ai.usage.total_tokens),
    success_rate = countIf(status.code == "OK") / count() * 100,
    models = collectDistinct(gen_ai.model_name)
  }, by: { gen_ai.system }
| sort total_requests desc
`;
};

/**
 * Query for model-level comparison
 */
export const MODEL_COMPARISON_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
${serviceFilter}
${providerFilter}
| summarize {
    avg_latency = avg(duration),
    avg_tokens = avg(gen_ai.usage.total_tokens),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count()
  }, by: { gen_ai.model_name, gen_ai.system }
| sort request_count desc
`;
};

/**
 * Query for GPU utilization (if available)
 */
export const GPU_UTILIZATION_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
timeseries avg(gpu.utilization), ${timeClause}, by: { host.name }
| filter isNotNull(avg_gpu.utilization)
`;
};

/**
 * Query for 429 (rate limit) error detection
 */
export const RATE_LIMIT_ERRORS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| filter status.code == "ERROR"
| filter matchesPhrase(status.message, "429") or matchesPhrase(status.message, "rate limit")
${serviceFilter}
| summarize {
    error_count = count(),
    last_occurrence = max(timestamp)
  }, by: { service.name, gen_ai.system }
| sort error_count desc
`;
};

/**
 * Query for high latency detection
 */
export const HIGH_LATENCY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| filter duration > 5000000000
${serviceFilter}
| summarize {
    slow_requests = count(),
    avg_duration = avg(duration),
    max_duration = max(duration)
  }, by: { service.name, gen_ai.model_name }
| sort slow_requests desc
`;
};

/**
 * Query for detailed service analysis
 */
export const SERVICE_DETAIL_QUERY = (serviceName: string, filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| filter service.name == "${serviceName}"
| summarize {
    tokens = sum(gen_ai.usage.total_tokens),
    prompt_tokens = sum(gen_ai.usage.prompt_tokens),
    completion_tokens = sum(gen_ai.usage.completion_tokens),
    latency = avg(duration),
    p50_latency = percentile(duration, 50),
    p95_latency = percentile(duration, 95),
    p99_latency = percentile(duration, 99),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count()
  }, by: { gen_ai.model_name }
`;
};

/**
 * Query to get unique service names (for filter dropdown) - GenAI services only
 */
export const DISTINCT_SERVICES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| summarize count = count(), by: { service.name }
| sort count desc
| limit 100
`;
};

/**
 * Query to get unique service names (fallback - ALL services)
 */
export const DISTINCT_ALL_SERVICES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(service.name)
| summarize count = count(), by: { service.name }
| sort count desc
| limit 100
`;
};

/**
 * Query to get unique providers (for filter dropdown)
 */
export const DISTINCT_PROVIDERS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| summarize count = count(), by: { gen_ai.system }
| sort count desc
`;
};

/**
 * Query to get unique models (for filter dropdown)
 */
export const DISTINCT_MODELS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system)
| summarize count = count(), by: { gen_ai.model_name }
| sort count desc
| limit 100
`;
};