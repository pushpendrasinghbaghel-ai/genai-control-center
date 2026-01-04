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
 * Sanitize a value for use in DQL filter - remove any problematic characters
 */
const sanitizeFilterValue = (value: string): string => {
  if (!value) return '';
  let sanitized = value.trim();
  // Remove surrounding quotes if present
  if ((sanitized.startsWith('"') && sanitized.endsWith('"')) ||
      (sanitized.startsWith("'") && sanitized.endsWith("'"))) {
    sanitized = sanitized.slice(1, -1);
  }
  // Remove any backslashes and quotes that shouldn't be there
  sanitized = sanitized.replace(/[\\"']/g, '');
  return sanitized.trim();
};

/**
 * Build service filter clause for DQL queries
 */
export const buildServiceFilter = (serviceName?: string): string => {
  if (!serviceName) return '';
  const sanitized = sanitizeFilterValue(serviceName);
  if (!sanitized) return '';
  return `| filter service.name == "${sanitized}"`;
};

/**
 * Build provider filter clause for DQL queries
 */
export const buildProviderFilter = (provider?: string): string => {
  if (!provider) return '';
  const sanitized = sanitizeFilterValue(provider);
  if (!sanitized) return '';
  return `| filter gen_ai.system == "${sanitized}"`;
};

/**
 * Build model filter clause for DQL queries
 */
export const buildModelFilter = (model?: string): string => {
  if (!model) return '';
  const sanitized = sanitizeFilterValue(model);
  if (!sanitized) return '';
  return `| filter gen_ai.model_name == "${sanitized}"`;
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
 * Supports both gen_ai.system and gen_ai.request.model schemas
 */
export const AI_SERVICES_DISCOVERY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
${modelFilter}
| summarize {
    tokens = sum(coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))),
    latency = avg(duration),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count(),
    prompt_tokens = sum(coalesce(gen_ai.usage.prompt_tokens, gen_ai.usage.input_tokens, 0)),
    completion_tokens = sum(coalesce(gen_ai.usage.completion_tokens, gen_ai.usage.output_tokens, 0)),
    entity_id = takeFirst(dt.entity.service)
  }, by: { service.name, gen_ai.request.model, gen_ai.system, gen_ai.provider.name }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
${serviceFilter}
| makeTimeseries {
    tokens = sum(coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))),
    latency = avg(duration),
    errors = countIf(status.code == "ERROR"),
    requests = count()
  }, by: { service.name }, interval: 5m
`;
};

/**
 * Query for provider comparison
 * Groups by gen_ai.request.model when gen_ai.system is null
 */
export const PROVIDER_COMPARISON_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
${serviceFilter}
| summarize {
    total_requests = count(),
    avg_latency = avg(duration),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    total_tokens = sum(coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))),
    success_rate = countIf(status.code == "OK") / count() * 100,
    models = collectDistinct(gen_ai.request.model)
  }, by: { coalesce(gen_ai.provider.name, gen_ai.system, gen_ai.request.model) }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
| summarize {
    avg_latency = avg(duration),
    avg_tokens = avg(coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count()
  }, by: { gen_ai.request.model, gen_ai.response.model }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
| filter status.code == "ERROR"
| filter matchesPhrase(status.message, "429") or matchesPhrase(status.message, "rate limit")
${serviceFilter}
| summarize {
    error_count = count(),
    last_occurrence = max(timestamp)
  }, by: { service.name, gen_ai.request.model }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
| filter duration > 5000000000
${serviceFilter}
| summarize {
    slow_requests = count(),
    avg_duration = avg(duration),
    max_duration = max(duration)
  }, by: { service.name, gen_ai.request.model }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
| filter service.name == "${serviceName}"
| summarize {
    tokens = sum(coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))),
    prompt_tokens = sum(coalesce(gen_ai.usage.prompt_tokens, gen_ai.usage.input_tokens, 0)),
    completion_tokens = sum(coalesce(gen_ai.usage.completion_tokens, gen_ai.usage.output_tokens, 0)),
    latency = avg(duration),
    p50_latency = percentile(duration, 50),
    p95_latency = percentile(duration, 95),
    p99_latency = percentile(duration, 99),
    error_rate = countIf(status.code == "ERROR") / count() * 100,
    request_count = count()
  }, by: { gen_ai.request.model }
`;
};

/**
 * Query to get unique service names (for filter dropdown) - GenAI services only
 */
export const DISTINCT_SERVICES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
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
 * Falls back to request.model when gen_ai.system is null
 */
export const DISTINCT_PROVIDERS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
| summarize count = count(), by: { gen_ai.request.model }
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
| filter isNotNull(gen_ai.system) OR isNotNull(gen_ai.request.model)
| summarize count = count(), by: { gen_ai.request.model }
| sort count desc
| limit 100
`;
};