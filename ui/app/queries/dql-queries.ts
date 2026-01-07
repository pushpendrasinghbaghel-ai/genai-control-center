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
 * Accepts either dt.entity.service ID (SERVICE-xxx) or entity name
 */
export const buildServiceFilter = (serviceEntityId?: string): string => {
  if (!serviceEntityId) return '';
  const sanitized = sanitizeFilterValue(serviceEntityId);
  if (!sanitized) return '';
  // If it looks like an entity ID, filter by dt.entity.service
  if (sanitized.startsWith('SERVICE-')) {
    return `| filter dt.entity.service == "${sanitized}"`;
  }
  // Otherwise filter by entity name (for backward compatibility)
  return `| filter dt.entity.service == "${sanitized}"`;
};

/**
 * Build provider filter clause for DQL queries
 * Uses gen_ai.provider.name (e.g., openai, Azure, VertexAI, amazon)
 */
export const buildProviderFilter = (provider?: string): string => {
  if (!provider) return '';
  const sanitized = sanitizeFilterValue(provider);
  if (!sanitized) return '';
  return `| filter gen_ai.provider.name == "${sanitized}"`;
};

/**
 * Build model filter clause for DQL queries
 * Uses gen_ai.request.model (e.g., gpt-4o, gemini-1.5-flash-002, titan-text-lite-v1)
 */
export const buildModelFilter = (model?: string): string => {
  if (!model) return '';
  const sanitized = sanitizeFilterValue(model);
  if (!sanitized) return '';
  return `| filter gen_ai.request.model == "${sanitized}"`;
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
 * Discovery query - finds all AI-related Dynatrace service entities
 * Groups by dt.entity.service for unique services (not service.name + model combinations)
 * Includes entity ID for deep linking to Services app
 * 
 * Quality Metrics for GenAI developers:
 * - error_rate: Span errors (span.status_code == "error" or error.type set)
 * - slow_request_rate: Requests > 3 seconds (potential timeouts/issues)
 * - low_output_rate: Responses with < 10 output tokens (potential truncation/failures)
 */
export const AI_SERVICES_DISCOVERY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
${modelFilter}
| summarize {
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    latency = avg(duration),
    request_count = count(),
    prompt_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    completion_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    slow_request_rate = toDouble(countIf(toLong(duration) > 3000000000)) / toDouble(count()) * 100.0,
    low_output_rate = toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0 AND coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 10)) / toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0)) * 100.0,
    providers = collectDistinct(gen_ai.provider.name),
    models = collectDistinct(gen_ai.request.model)
  }, by: { dt.entity.service }
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
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${serviceFilter}
| makeTimeseries {
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    latency = avg(duration),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    requests = count()
  }, by: { dt.entity.service }, interval: 5m
`;
};

/**
 * Query for provider comparison
 * Groups by gen_ai.provider.name with fallback to gen_ai.request.model
 * Enhanced with GenAI-specific quality metrics:
 * - slow_request_rate: % of requests > 3 seconds
 * - low_output_rate: % of responses with minimal tokens
 * - avg_output_tokens: Average response size (quality indicator)
 */
export const PROVIDER_COMPARISON_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${serviceFilter}
| summarize {
    total_requests = count(),
    avg_latency = avg(duration),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    models = collectDistinct(gen_ai.request.model),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    slow_request_rate = toDouble(countIf(toLong(duration) > 3000000000)) / toDouble(count()) * 100.0,
    low_output_rate = toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0 AND coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 10)) / toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0)) * 100.0,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { coalesce(gen_ai.provider.name, gen_ai.request.model) }
| sort total_requests desc
`;
};

/**
 * Query for model-level comparison
 * Enhanced with GenAI-specific quality metrics
 */
export const MODEL_COMPARISON_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
| summarize {
    avg_latency = avg(duration),
    avg_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    request_count = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    slow_request_rate = toDouble(countIf(toLong(duration) > 3000000000)) / toDouble(count()) * 100.0,
    low_output_rate = toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0 AND coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) < 10)) / toDouble(countIf(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0) > 0)) * 100.0,
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { gen_ai.request.model, gen_ai.response.model, gen_ai.provider.name }
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
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter span.status_code == "error" OR isNotNull(error.type)
| filter matchesPhrase(status.message, "429") or matchesPhrase(status.message, "rate limit") or matchesPhrase(toString(error.type), "rate limit")
| summarize {
    error_count = count(),
    last_occurrence = max(timestamp)
  }, by: { dt.entity.service, gen_ai.request.model }
| sort error_count desc
`;
};

/**
 * Query for high latency detection
 */
export const HIGH_LATENCY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter duration > 5000000000
| summarize {
    slow_requests = count(),
    avg_duration = avg(duration),
    max_duration = max(duration)
  }, by: { dt.entity.service, gen_ai.request.model }
| sort slow_requests desc
`;
};

/**
 * Query for detailed service analysis - accepts entity ID or service name
 */
export const SERVICE_DETAIL_QUERY = (serviceEntityId: string, filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter dt.entity.service == "${serviceEntityId}"
| summarize {
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    prompt_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    completion_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    latency = avg(duration),
    p50_latency = percentile(duration, 50),
    p95_latency = percentile(duration, 95),
    p99_latency = percentile(duration, 99),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    request_count = count()
  }, by: { gen_ai.request.model, gen_ai.provider.name }
`;
};

/**
 * Query to get unique Dynatrace service entities (for filter dropdown) - GenAI services only
 */
export const DISTINCT_SERVICES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize count = count(), by: { dt.entity.service }
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
| filter isNotNull(dt.entity.service)
| summarize count = count(), by: { dt.entity.service }
| sort count desc
| limit 100
`;
};

/**
 * Query to get unique providers (for filter dropdown)
 * Uses gen_ai.provider.name with fallback to model name
 */
export const DISTINCT_PROVIDERS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, gen_ai.request.model)
| filter isNotNull(provider)
| summarize count = count(), by: { provider }
| sort count desc
| limit 100
`;
};

/**
 * Query to get unique models (for filter dropdown)
 */
export const DISTINCT_MODELS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, gen_ai.response.model)
| filter isNotNull(model)
| summarize count = count(), by: { model }
| sort count desc
| limit 100
`;
};

/**
 * Query for Prompt Analysis - fetches individual GenAI spans with trace context
 * Includes prompt content, tokens, costs, and trace IDs for deep linking
 * Field names based on actual Dynatrace span schema (validated from real data):
 * - trace.id, span.id (with dots, not underscores)
 * - gen_ai.prompt.0.content = System prompt (role: system)
 * - gen_ai.prompt.0.role = "system"
 * - gen_ai.prompt.1.content = User prompt (role: user)
 * - gen_ai.prompt.1.role = "user"
 * - gen_ai.completion.0.content (completion content)
 * - gen_ai.completion.0.tool_calls.0.name = Tool call name (indicates RAG/function usage)
 * - llm.request.functions.0.name = Available function name
 * - gen_ai.usage.input_tokens, gen_ai.usage.output_tokens
 * 
 * NOTE: This query now does SERVER-SIDE grouping by prompt pattern to:
 * 1. Reduce data transfer (unique patterns only, not all individual requests)
 * 2. Accurately count all requests in the timeframe
 * 3. Enable efficient Davis AI scoring on unique patterns
 */
export const PROMPT_ANALYSIS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${providerFilter}
${modelFilter}
| fieldsAdd prompt = coalesce(gen_ai.prompt.1.content, gen_ai.prompt.0.content)
| fieldsAdd response = gen_ai.completion.0.content
| filter isNotNull(prompt)
| fieldsAdd prompt_preview = substring(prompt, from:0, to:100)
| fieldsAdd response_preview = substring(response, from:0, to:200)
| summarize {
    request_count = count(),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_latency = avg(duration),
    sample_trace_id = takeLast(trace.id),
    sample_span_id = takeLast(span.id),
    sample_response = takeLast(response_preview),
    sample_timestamp = takeLast(start_time)
  }, by: { 
    dt.entity.service, 
    gen_ai.provider.name, 
    gen_ai.request.model, 
    prompt_preview
  }
| sort request_count desc
| limit 500
`;
};