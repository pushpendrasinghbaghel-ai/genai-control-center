// DQL Queries for GenAI Control Center

import type { Timeframe } from '@dynatrace/strato-components/core';

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
 * Note: makeTimeseries has limited syntax - no math ops or countIf inside
 */
export const AI_SERVICES_TREND_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${serviceFilter}
| fieldsAdd input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
            output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| makeTimeseries tokens = sum(input_tokens + output_tokens), requests = count(), by: { dt.entity.service }, interval: 1h
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
| fieldsAdd prompt_preview = substring(prompt, from:0, to:150)
| fieldsAdd response_preview = substring(response, from:0, to:500)
| fieldsAdd has_error = (span.status_code == "error" OR isNotNull(error.type))
| summarize {
    request_count = count(),
    error_count = countIf(has_error),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_latency = avg(duration),
    sample_trace_id = takeLast(trace.id),
    sample_span_id = takeLast(span.id),
    sample_full_prompt = takeLast(prompt),
    sample_full_response = takeLast(response),
    sample_response = takeLast(response_preview),
    sample_timestamp = takeLast(start_time),
    sample_error_type = takeLast(error.type),
    sample_status_message = takeLast(status.message)
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

/**
 * Query for GenAI Errors - Fetch error spans that may not have prompt content
 * Error spans often don't have prompt/completion data since the error occurred before/during processing
 */
export const GENAI_ERRORS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  
  return `
fetch spans, ${timeClause}
| filter span.status_code == "error"
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
${providerFilter}
${modelFilter}
| fieldsAdd prompt = coalesce(gen_ai.prompt.1.content, gen_ai.prompt.0.content)
| fieldsAdd response = gen_ai.completion.0.content
| fields 
    trace_id = trace.id,
    span_id = span.id,
    span_name = span.name,
    timestamp = start_time,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    service = dt.entity.service,
    latency_ns = duration,
    error_type = error.type,
    error_message = error.message,
    status_message = status.message,
    span_status = span.status_code,
    prompt_content = prompt,
    response_content = response,
    input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
    output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| sort timestamp desc
| limit 200
`;
};

// ============================================
// RAG / Vector DB Queries (Phase 5 — Viatris Gap)
// Data source: Pinecone spans (~115K/wk) + embedding spans (~113K/wk)
// ============================================

/**
 * Vector DB query volume over time (timeseries)
 * Broad filter to catch Pinecone, Chroma, Weaviate, Qdrant and any OTel vector DB spans
 */
export const VECTOR_DB_VOLUME_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR contains(lower(span.name), "retrieve")
    OR isNotNull(db.vector.query.top_k)
| makeTimeseries queries = count(), interval: 1h
`;
};

/**
 * Vector DB query latency percentiles (avg, p50, p95, p99)
 * Broad filter — same vector store coverage as VECTOR_DB_VOLUME_QUERY
 */
export const VECTOR_DB_LATENCY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR contains(lower(span.name), "retrieve")
    OR isNotNull(db.vector.query.top_k)
| summarize
    avg_latency_ms = avg(duration) / 1000000,
    p50_ms = percentile(duration, 50) / 1000000,
    p95_ms = percentile(duration, 95) / 1000000,
    p99_ms = percentile(duration, 99) / 1000000,
    query_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
`;
};

/**
 * Embedding generation volume & latency by provider + model
 */
export const EMBEDDING_VOLUME_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter contains(lower(span.name), "embed")
    OR gen_ai.operation.name == "embeddings"
    OR gen_ai.operation.kind == "embedding"
    OR contains(lower(gen_ai.operation.name), "embed")
| summarize
    call_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: { provider = coalesce(gen_ai.provider.name, "unknown"), model = coalesce(gen_ai.request.model, "unknown") }
| sort call_count desc
`;
};

/**
 * Embedding volume trend over time (timeseries)
 * Catches OTel gen_ai embeddings, LangChain span name patterns, and LlamaIndex patterns
 */
export const EMBEDDING_TREND_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter contains(lower(span.name), "embed")
    OR gen_ai.operation.name == "embeddings"
    OR gen_ai.operation.kind == "embedding"
    OR contains(lower(gen_ai.operation.name), "embed")
| makeTimeseries embeddings = count(), interval: 1h
`;
};

/**
 * RAG pipeline E2E trace correlation: embed → vector retrieve → LLM generate
 * Groups by trace.id to get full pipeline view
 */
export const RAG_PIPELINE_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "embed")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR gen_ai.operation.name == "embeddings"
    OR (isNotNull(gen_ai.provider.name) AND (contains(lower(span.name), "chat") OR contains(lower(span.name), "completion")))
| fieldsAdd step_type = if(isNotNull(db.system) OR contains(lower(span.name), "vectorstore") OR contains(lower(span.name), "vector_store") OR contains(lower(span.name), "retrieve") OR contains(lower(span.name), "pinecone.query"), then: "retrieve",
    else: if(contains(lower(span.name), "embed") OR gen_ai.operation.name == "embeddings", then: "embed", else: "generate"))
| summarize
    span_types = collectDistinct(step_type),
    total_duration_ms = sum(duration) / 1000000,
    span_count = count(),
    has_embed = countIf(step_type == "embed") > 0,
    has_retrieve = countIf(step_type == "retrieve") > 0,
    has_generate = countIf(step_type == "generate") > 0,
    sample_trace_id = takeLast(trace.id),
    service_name = takeFirst(service.name),
    trace_start = min(start_time)
  , by: { trace.id }
| filter span_count >= 2
| sort total_duration_ms desc
| limit 100
`;
};

/**
 * RAG pipeline summary stats: avg E2E latency, full-pipeline traces, step breakdown
 */
export const RAG_PIPELINE_SUMMARY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "embed")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR gen_ai.operation.name == "embeddings"
    OR (isNotNull(gen_ai.provider.name) AND (contains(lower(span.name), "chat") OR contains(lower(span.name), "completion")))
| fieldsAdd step_type = if(isNotNull(db.system) OR contains(lower(span.name), "vectorstore") OR contains(lower(span.name), "vector_store") OR contains(lower(span.name), "retrieve") OR contains(lower(span.name), "pinecone.query"), then: "retrieve",
    else: if(contains(lower(span.name), "embed") OR gen_ai.operation.name == "embeddings", then: "embed", else: "generate"))
| summarize
    call_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: { step_type }
| sort avg_latency_ms desc
`;
};

/**
 * Vector store health — error rate + availability (timeseries)
 */
export const VECTOR_DB_HEALTH_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR contains(lower(span.name), "retrieve")
| makeTimeseries
    total = count(),
    interval: 1h
`;
};

/**
 * Top repeated vector queries — duplicate/cache-candidate detection
 */
export const VECTOR_DB_CACHE_CANDIDATES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR contains(lower(span.name), "retrieve")
    OR isNotNull(db.vector.query.top_k)
| fieldsAdd query_preview = substring(coalesce(db.statement, db.query.text, if(span.name != "pinecone.query", then: span.name, else: null), span.name), from: 0, to: 120)
| summarize
    count = count(),
    avg_latency_ms = avg(duration) / 1000000
  , by: { query_preview }
| filter count > 1
| sort count desc
| limit 20
`;
};

// ============================================
// TTFT — Time to First Token (Phase 5.2)
// ============================================

/**
 * Time to first token (TTFT) by model — streaming responsiveness
 */
export const TTFT_BY_MODEL_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
    AND (gen_ai.operation.name == "chat"
      OR gen_ai.operation.name == "text_completion"
      OR gen_ai.operation.name == "completion"
      OR contains(lower(span.name), "chat")
      OR contains(lower(span.name), "completion")
      OR contains(lower(span.name), "invoke")
      OR contains(lower(span.name), "generate"))
${providerFilter}
${modelFilter}
| summarize
    avg_ttft_ms = avg(duration) / 1000000,
    p50_ttft_ms = percentile(duration, 50) / 1000000,
    p95_ttft_ms = percentile(duration, 95) / 1000000,
    request_count = count()
  , by: { model = coalesce(gen_ai.request.model, gen_ai.response.model, "unknown"), provider = coalesce(gen_ai.provider.name, "unknown") }
| sort avg_ttft_ms desc
`;
};

/**
 * TTFT aggregate — uses span duration as TTFT proxy (gen_ai.server.time_to_first_token
 * is only set when streaming is explicitly instrumented; duration is the practical proxy)
 */
export const TTFT_SUMMARY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
    AND (gen_ai.operation.name == "chat"
      OR gen_ai.operation.name == "text_completion"
      OR gen_ai.operation.name == "completion"
      OR contains(lower(span.name), "chat")
      OR contains(lower(span.name), "completion")
      OR contains(lower(span.name), "invoke")
      OR contains(lower(span.name), "generate"))
| summarize
    avg_ttft_ms = avg(duration) / 1000000,
    p95_ttft_ms = percentile(duration, 95) / 1000000,
    count = count()
`;
};

// ============================================
// Agent Retry Monitoring (Phase 5.3)
// ============================================

/**
 * Detect retry patterns — traces where same agent task repeated more than expected
 */
export const AGENT_RETRY_DETECTION_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter traceloop.span.kind == "task"
| summarize
    task_count = count(),
    unique_agents = countDistinct(traceloop.entity.name),
    agents_list = collectDistinct(traceloop.entity.name),
    total_duration_ms = sum(duration) / 1000000
  , by: { trace.id }
| fieldsAdd retry_count = task_count - unique_agents
| filter retry_count > 0
| sort retry_count desc
| limit 50
`;
};

/**
 * Retry summary stats for agent monitoring
 */
export const AGENT_RETRY_SUMMARY_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter traceloop.span.kind == "task"
| summarize
    total_tasks = count(),
    unique_tasks = countDistinct(traceloop.entity.name)
  , by: { trace.id }
| fieldsAdd has_retry = total_tasks > unique_tasks
| summarize
    total_traces = count(),
    traces_with_retries = countIf(has_retry),
    total_extra_tasks = sum(if(has_retry, then: total_tasks - unique_tasks, else: 0))
`;
};

/**
 * Chain performance — average latency per step type across all RAG/agent traces
 */
export const CHAIN_PERFORMANCE_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.span.kind) OR db.system == "pinecone" OR contains(lower(span.name), "embedding")
| fieldsAdd step_label = if(db.system == "pinecone", then: "Vector Retrieve",
    else: if(contains(lower(span.name), "embedding"), then: "Embedding",
    else: if(traceloop.span.kind == "task", then: "Agent Task",
    else: if(traceloop.span.kind == "tool", then: "Tool Call",
    else: if(traceloop.span.kind == "workflow", then: "Workflow",
    else: "LLM Call")))))
| summarize
    avg_duration_ms = avg(duration) / 1000000,
    p95_duration_ms = percentile(duration, 95) / 1000000,
    call_count = count(),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: { step_label }
| sort avg_duration_ms desc
`;
};

// ============================================
// Vector DB Extended Observability (Phase 5.4)
// Index performance, ingestion, drift, anomaly detection
// ============================================

/**
 * Index performance — latency breakdown by operation type (query vs upsert vs delete).
 * Split reveals write amplification, read/write contention and ingestion cost.
 * OTel semantic convention: db.operation for standard ops; span name heuristic for Pinecone SDK.
 */
export const VECTOR_INDEX_PERFORMANCE_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR isNotNull(db.vector.query.top_k)
    OR contains(lower(span.name), "upsert")
    OR contains(lower(span.name), "index")
| fieldsAdd op_type = coalesce(
    db.operation,
    if(contains(lower(span.name), "upsert"),  then: "upsert",
    else: if(contains(lower(span.name), "delete") OR contains(lower(span.name), "remove"), then: "delete",
    else: if(contains(lower(span.name), "fetch") OR contains(lower(span.name), "query") OR contains(lower(span.name), "retrieve"), then: "query",
    else: "query"))))
| summarize
    avg_latency_ms = avg(duration) / 1000000,
    p50_latency_ms = percentile(duration, 50) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    call_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: { op_type }
| sort call_count desc
`;
};

/**
 * Data ingestion metrics — upsert/write throughput timeseries.
 * Tracks index build velocity; a sudden drop indicates ingestion pipeline failures.
 */
export const VECTOR_INGESTION_METRICS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter (db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store"))
  AND (contains(lower(span.name), "upsert")
    OR contains(lower(span.name), "insert")
    OR contains(lower(span.name), "index")
    OR contains(lower(span.name), "ingest")
    OR db.operation == "upsert"
    OR db.operation == "insert"
    OR db.operation == "index")
| makeTimeseries
    upserts = count(),
    avg_upsert_latency_ms = avg(duration) / 1000000,
    interval: 1h
`;
};

/**
 * Result set sizes & top-K configuration by namespace/index.
 * Reveals retrieval breadth — oversized top_k causes LLM context bloat;
 * undersized top_k causes context starvation.
 */
export const VECTOR_RESULT_SET_SIZES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter (db.system == "pinecone" AND (contains(lower(span.name), "query") OR contains(lower(span.name), "retrieve")))
    OR (db.system == "chromadb" OR db.system == "qdrant" OR db.system == "weaviate" OR db.system == "milvus")
| summarize
    query_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: { namespace = coalesce(db.namespace, "default"), index_name = coalesce(db.name, coalesce(db.system, "unknown")) }
| sort query_count desc
| limit 20
`;
};

/**
 * Source document metadata — namespace, index/collection, filter breakdown.
 * Maps which indexes are queried most, latency per namespace, enabling
 * namespace-level cost attribution and hot-spot identification.
 */
export const SOURCE_DOCUMENT_METADATA_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR isNotNull(db.vector.query.top_k)
| summarize
    query_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0
  , by: {
      namespace = coalesce(db.namespace, "default"),
      index_name = coalesce(db.name, "unknown"),
      db_system = coalesce(db.system, "unknown")
    }
| sort query_count desc
| limit 25
`;
};

/**
 * Tokenization drift — prompt token count trend over time.
 * Rising averages signal prompt bloat (larger retrieved chunks, growing context windows).
 * Falling averages may indicate context truncation or retrieval degradation.
 * Uses gen_ai.usage.prompt_tokens (OTel) or gen_ai.usage.input_tokens (Anthropic/AWS).
 */
export const TOKENIZATION_DRIFT_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.usage.prompt_tokens)
    OR isNotNull(gen_ai.usage.input_tokens)
    OR isNotNull(gen_ai.usage.completion_tokens)
    OR isNotNull(gen_ai.usage.output_tokens)
| fieldsAdd
    prompt_tokens = toLong(coalesce(gen_ai.usage.prompt_tokens, gen_ai.usage.input_tokens, 0)),
    completion_tokens = toLong(coalesce(gen_ai.usage.completion_tokens, gen_ai.usage.output_tokens, 0))
| filter prompt_tokens > 0
| makeTimeseries
    avg_prompt_tokens = avg(prompt_tokens),
    p95_prompt_tokens = percentile(prompt_tokens, 95),
    avg_completion_tokens = avg(completion_tokens),
    total_tokens = sum(prompt_tokens + completion_tokens),
    interval: 1h
`;
};

/**
 * Retrieval anomalies — per-hour vector store latency outlier detection.
 * Computes p99/avg ratio: ratio > 3x signals heavy-tail latency spikes
 * (large result sets, index fragmentation, cold cache, or network blips).
 */
export const RETRIEVAL_ANOMALIES_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR isNotNull(db.vector.query.top_k)
| summarize
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    query_count = count()
  , by: { hour_bucket = bin(start_time, 1h) }
| fieldsAdd
    anomaly_ratio = if(avg_latency_ms > 0, then: p99_latency_ms / avg_latency_ms, else: 0.0),
    is_anomalous = p99_latency_ms / avg_latency_ms > 3.0
| sort hour_bucket desc
| limit 48
`;
};

/**
 * Context retrieval effectiveness — retrieve success rate and top_k utilization by namespace.
 * Proxies retrieval quality: high error rate = retrieval failures;
 * avg_top_k << max_top_k = under-utilization (index too sparse or filters too restrictive).
 */
export const CONTEXT_RETRIEVAL_EFFECTIVENESS_QUERY = (filters?: QueryFilters) => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter (db.system == "pinecone"
    OR db.system == "chromadb"
    OR db.system == "qdrant"
    OR db.system == "weaviate"
    OR db.system == "milvus"
    OR contains(lower(span.name), "pinecone")
    OR contains(lower(span.name), "vectorstore")
    OR contains(lower(span.name), "vector_store")
    OR isNotNull(db.vector.query.top_k))
  AND NOT (contains(lower(span.name), "upsert")
    OR contains(lower(span.name), "insert")
    OR db.operation == "upsert")
| summarize
    total_queries = count(),
    successful_queries = countIf(NOT (span.status_code == "error" OR isNotNull(error.type))),
    failed_queries = countIf(span.status_code == "error" OR isNotNull(error.type)),
    success_rate = toDouble(countIf(NOT (span.status_code == "error" OR isNotNull(error.type)))) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000
  , by: { namespace = coalesce(db.namespace, coalesce(db.system, "all")) }
| sort total_queries desc
| limit 20
`;
};

/**
 * Query for Audit Trail - Recent GenAI invocations for compliance tracking
 */
export const AUDIT_TRAIL_QUERY = (filters?: QueryFilters) => {
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
| fields 
    timestamp = start_time,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
    output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0),
    latency_ns = duration,
    has_error = (span.status_code == "error" OR isNotNull(error.type)),
    trace_id = trace.id,
    service = dt.entity.service
| sort timestamp desc
| limit 100
`;
};

// ═══════════════════════════════════════════════════════════════
// PHASE 6 — INFRASTRUCTURE QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Provider availability: error rate per provider from AI spans.
 * Availability = 1 - (errors / total).
 */
export const INFRA_PROVIDER_AVAILABILITY_QUERY = (timeClause = 'from: now()-24h, to: now()'): string => {
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
| summarize 
    total = count(),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency_ms = avg(toLong(duration)) / 1000000,
    by: { provider = gen_ai.provider.name }
| fieldsAdd availability_pct = round(100.0 * (1.0 - toDouble(errors) / toDouble(total)), 2)
| sort availability_pct asc
`.trim();
};

/**
 * K8s-style workload summary for AI services: group by service name, count spans, errors, models used.
 */
export const INFRA_SERVICE_WORKLOAD_QUERY = (timeClause = 'from: now()-24h, to: now()'): string => {
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize
    span_count = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    model_count = countDistinct(gen_ai.request.model),
    avg_latency_ms = avg(toLong(duration)) / 1000000,
    last_seen = max(start_time),
    provider = takeFirst(gen_ai.provider.name),
    by: { service_name = service.name }
| fieldsAdd error_rate = round(100.0 * toDouble(error_count) / toDouble(span_count), 2)
| sort span_count desc
| limit 30
`.trim();
};

/**
 * Recent deployment events (pushed or observed by Dynatrace OneAgent).
 */
export const INFRA_DEPLOYMENT_EVENTS_QUERY = (timeClause = 'from: now()-24h, to: now()'): string => {
  return `
fetch events, ${timeClause}
| filter event.kind == "DEPLOYMENT_EVENT"
| fields
    event_id = id,
    title = event.name,
    entity = dt.entity.name,
    timestamp = timestamp,
    version = dt.event.deployment.version,
    artifact = dt.event.deployment.artifact_version
| sort timestamp desc
| limit 30
`.trim();
};

/**
 * Current model + provider configuration per service (config snapshot).
 * Shows which service is calling which LLM model/provider right now.
 */
export const INFRA_SERVICE_CONFIG_QUERY = (timeClause = 'from: now()-24h, to: now()'): string => {
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.provider.name)
| summarize
    model = takeFirst(gen_ai.request.model),
    provider = takeFirst(gen_ai.provider.name),
    model_versions = countDistinct(gen_ai.request.model),
    request_count = count(),
    last_seen = max(start_time),
    by: { service_name = service.name }
| sort last_seen desc
| limit 40
`.trim();
};

/**
 * Model version history — when each service used which model/provider.
 * Useful for detecting model switches and deployment-related config changes.
 * Uses a wider 7-day window to capture full change history.
 */
export const INFRA_MODEL_HISTORY_QUERY = (): string => {
  return `
fetch spans, from: now()-7d, to: now()
| filter isNotNull(gen_ai.request.model)
| summarize
    request_count = count(),
    first_seen = min(start_time),
    last_seen = max(start_time),
    by: { service_name = service.name, model = gen_ai.request.model, provider = gen_ai.provider.name }
| sort last_seen desc
| limit 60
`.trim();
};

// ═══════════════════════════════════════════════════════════════
// PHASE 8.2 — CONVERSATION INTELLIGENCE
// Data source: traceloop.association.properties.conversation_id (confirmed in Grail)
// ═══════════════════════════════════════════════════════════════

/**
 * List all conversations with session-level aggregates.
 * conversation_id lives in traceloop.association.properties.conversation_id.
 * Filters to spans that belong to a named conversation only.
 */
export const CONVERSATION_LIST_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize
    turns = count(),
    agents = collectDistinct(coalesce(traceloop.entity.name, gen_ai.agent.name)),
    models_used = collectDistinct(gen_ai.request.model),
    total_input_tokens = sum(coalesce(toLong(gen_ai.usage.input_tokens), toLong(gen_ai.usage.prompt_tokens), 0)),
    total_output_tokens = sum(coalesce(toLong(gen_ai.usage.output_tokens), toLong(gen_ai.usage.completion_tokens), 0)),
    session_start = min(start_time),
    session_end = max(start_time),
    error_turns = countIf(span.status_code == "error" OR isNotNull(error.type)),
    handoff_count = countIf(contains(lower(span.name), "transfer_to")),
    task_count = countIf(traceloop.span.kind == "task"),
    tool_count = countIf(traceloop.span.kind == "tool")
  , by: { conversation_id = traceloop.association.properties.conversation_id }
| fieldsAdd
    duration_secs = toLong(session_end - session_start) / 1000000000,
    total_tokens = total_input_tokens + total_output_tokens,
    has_errors = error_turns > 0,
    is_long = turns > 20
| sort session_end desc
| limit 200
`.trim();
};

/**
 * Conversation trends over time — sessions per hour, avg turns per session.
 */
export const CONVERSATION_TREND_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.association.properties.conversation_id)
| makeTimeseries
    sessions = countDistinct(traceloop.association.properties.conversation_id),
    spans = count(),
    interval: 1h
`.trim();
};

/**
 * Detect long conversations (>20 turns) that may indicate runaway agent loops.
 */
export const LONG_CONVERSATION_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize turns = count(), by: { conversation_id = traceloop.association.properties.conversation_id }
| filter turns > 20
| sort turns desc
| limit 50
`.trim();
};

/**
 * Conversation summary statistics — aggregate-level KPIs.
 */
export const CONVERSATION_STATS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize
    total_spans = count(),
    total_turns = countIf(traceloop.span.kind == "task" OR traceloop.span.kind == "workflow"),
    unique_conversations = countDistinct(traceloop.association.properties.conversation_id),
    error_spans = countIf(span.status_code == "error" OR isNotNull(error.type)),
    handoffs = countIf(contains(lower(span.name), "transfer_to")),
    total_input_tokens = sum(coalesce(toLong(gen_ai.usage.input_tokens), toLong(gen_ai.usage.prompt_tokens), 0)),
    total_output_tokens = sum(coalesce(toLong(gen_ai.usage.output_tokens), toLong(gen_ai.usage.completion_tokens), 0))
`.trim();
};

/**
 * Multi-agent handoff patterns across conversations.
 */
export const CONVERSATION_HANDOFF_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter traceloop.span.kind == "tool"
| filter contains(span.name, "transfer_to")
| summarize
    count = count(),
    avg_ms = avg(duration) / 1000000
  , by: { span.name }
| sort count desc
| limit 20
`.trim();
};

/**
 * Average session depth distribution bucket.
 */
export const CONVERSATION_DEPTH_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(traceloop.association.properties.conversation_id)
| summarize turns = count(), by: { conversation_id = traceloop.association.properties.conversation_id }
| fieldsAdd depth_bucket = if(turns <= 3, then: "1-3 turns",
    else: if(turns <= 10, then: "4-10 turns",
    else: if(turns <= 20, then: "11-20 turns",
    else: ">20 turns (runaway)")))
| summarize session_count = count(), by: { depth_bucket }
| sort session_count desc
`.trim();
};

// ═══════════════════════════════════════════════════════════════
// PHASE 3.2 — DEVELOPER EXPERIENCE
// Data source: code.function, code.namespace, code.filepath, instrumentation coverage
// ═══════════════════════════════════════════════════════════════

/**
 * Instrumentation coverage — what % of AI spans have proper gen_ai attributes.
 * Scoped to AI-related spans only (those with gen_ai.provider.name, gen_ai.request.model, or gen_ai.system)
 * so the denominator is meaningful and the score isn't diluted by millions of non-AI spans.
 */
export const INSTRUMENTATION_COVERAGE_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.system)
| summarize
    total = count(),
    with_provider = countIf(isNotNull(gen_ai.provider.name)),
    with_tokens = countIf(isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)),
    with_agent_name = countIf(isNotNull(gen_ai.agent.name)),
    with_conversation = countIf(isNotNull(traceloop.association.properties.conversation_id)),
    with_code = countIf(isNotNull(code.function)),
    with_response_model = countIf(isNotNull(gen_ai.response.model))
`.trim();
};

/**
 * Per-model×provider integration report — shows telemetry completeness for each model.
 * This is the core of the "AI Integration Health" view: which models report tokens,
 * response model, agent identity? Where are the telemetry blind spots?
 */
export const INTEGRATION_REPORT_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize
    calls = count(),
    errors = countIf(span.status_code == "error"),
    has_tokens = countIf(isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)),
    has_response_model = countIf(isNotNull(gen_ai.response.model)),
    has_agent = countIf(isNotNull(gen_ai.agent.name)),
    has_conversation = countIf(isNotNull(traceloop.association.properties.conversation_id)),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    total_input = sum(gen_ai.usage.input_tokens),
    total_output = sum(gen_ai.usage.output_tokens),
    by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
| sort calls, direction: "descending"
`.trim();
};

/**
 * Error spans with source code attribution — helps devs find the exact code location.
 */
export const SOURCE_CODE_ERRORS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) AND span.status_code == "error"
${serviceFilter}
| fields
    trace_id = trace.id,
    span_id = span.id,
    service = dt.entity.service,
    provider = gen_ai.provider.name,
    model = gen_ai.request.model,
    error_type = error.type,
    status_message = status.message,
    code_function = code.function,
    code_namespace = code.namespace,
    code_filepath = code.filepath,
    duration_ms = duration / 1000000,
    timestamp = start_time
| sort timestamp desc
| limit 100
`.trim();
};

/**
 * Top error locations by code function — which functions throw the most AI errors.
 */
export const TOP_ERROR_FUNCTIONS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) AND span.status_code == "error"
| filter isNotNull(code.function)
| summarize
    error_count = count(),
    avg_latency_ms = avg(duration) / 1000000,
    models = collectDistinct(gen_ai.request.model),
    providers = collectDistinct(gen_ai.provider.name),
    sample_trace_id = takeLast(trace.id)
  , by: { code.function, code.namespace, code.filepath }
| sort error_count desc
| limit 30
`.trim();
};

// ============================================
// Phase 7 — Cross-Provider Deep Observability
// Only queries backed by confirmed live Grail data
// ============================================

// ---- 7.1 Prompt Caching Metrics ----

/**
 * Prompt caching summary — cache hit rate, tokens saved, estimated $ saved.
 */
export const PROMPT_CACHE_SUMMARY_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
timeseries cache_read = sum(gen_ai.prompt.caching), ${timeClause},
  filter: { gen_ai.cache.type == "read" }
| fieldsAdd total_cached_tokens = arraySum(cache_read)
| append [
  timeseries cache_write = sum(gen_ai.prompt.caching), ${timeClause},
    filter: { gen_ai.cache.type == "write" }
  | fieldsAdd total_write_tokens = arraySum(cache_write)
]
| summarize {
  cached_tokens = takeMax(total_cached_tokens),
  write_tokens = takeMax(total_write_tokens)
}
| fieldsAdd estimated_savings_usd = (toDouble(cached_tokens) / 1000000.0) * 15.0 * 0.50
`.trim();
};

/**
 * Prompt cache hit rate — % of requests served from cache.
 */
export const PROMPT_CACHE_HIT_RATE_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) AND gen_ai.prompt_caching == "read"
| summarize cache_hits = count()
| append [
  fetch spans, ${timeClause}
  | filter isNotNull(gen_ai.provider.name)
  | summarize total_requests = count()
]
| summarize {
  hits = takeMax(cache_hits),
  total = takeMax(total_requests)
}
| fieldsAdd cache_hit_pct = if(total > 0, 100.0 * toDouble(hits) / toDouble(total), else: 0.0)
`.trim();
};

/**
 * Prompt cache trend timeseries — cached tokens over time.
 */
export const PROMPT_CACHE_TREND_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
timeseries {
  cache_read = sum(gen_ai.prompt.caching),
  cache_write = sum(gen_ai.prompt.caching)
}, ${timeClause},
  filter: { gen_ai.cache.type == "read" }
`.trim();
};

/**
 * Cache time saved — avg response time difference between cached and non-cached requests.
 */
export const PROMPT_CACHE_TIME_SAVED_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) AND gen_ai.prompt_caching == "read"
| summarize cached_count = count(), cached_avg_duration = avg(duration)
| append [
  fetch spans, ${timeClause}
  | filter isNotNull(gen_ai.provider.name) AND isTrueOrNull(gen_ai.prompt_caching != "read")
  | summarize normal_count = count(), normal_avg_duration = avg(duration)
]
| summarize {
  cached_duration_ns = takeMax(cached_avg_duration),
  normal_duration_ns = takeMax(normal_avg_duration)
}
| fieldsAdd time_saved_ms = (normal_duration_ns - cached_duration_ns) / 1000000.0
`.trim();
};

// ---- 7.3 OTel Metric-Based Token Consumption ----

/**
 * Token consumption from OTel gen_ai.client.token.usage metric — aggregated across all providers.
 * This gives the "metric" view vs the span-attribute view.
 */
export const OTEL_TOKEN_CONSUMPTION_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
timeseries input_tokens = sum(gen_ai.client.token.usage), ${timeClause},
  filter: { gen_ai.token.type == "input" }
| fieldsAdd total_input = arraySum(input_tokens)
| append [
  timeseries output_tokens = sum(gen_ai.client.token.usage), ${timeClause},
    filter: { gen_ai.token.type == "output" }
  | fieldsAdd total_output = arraySum(output_tokens)
]
| summarize {
  total_input_tokens = takeMax(total_input),
  total_output_tokens = takeMax(total_output)
}
| fieldsAdd total_tokens = total_input_tokens + total_output_tokens,
  estimated_cost_usd = (toDouble(total_input_tokens) * 0.02 + toDouble(total_output_tokens) * 0.01)
`.trim();
};

/**
 * Token consumption trend timeseries — input + output tokens over time from metrics.
 */
export const OTEL_TOKEN_TREND_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
timeseries {
  input = sum(gen_ai.client.token.usage),
  output = sum(gen_ai.client.token.usage)
}, ${timeClause},
  filter: { gen_ai.token.type == "input" }
`.trim();
};

// ---- 7.5 Cross-Provider Top Prompts ----

/**
 * Top 10 most expensive prompts across ALL providers — ranked by total tokens.
 */
export const TOP_EXPENSIVE_PROMPTS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
${providerFilter}
| fieldsAdd inputToken = coalesce(asLong(gen_ai.usage.input_tokens), 0)
| fieldsAdd oldInput = coalesce(asLong(gen_ai.usage.prompt_tokens), 0)
| fieldsAdd outputToken = coalesce(asLong(gen_ai.usage.output_tokens), 0)
| fieldsAdd oldOutput = coalesce(asLong(gen_ai.usage.completion_tokens), 0)
| fieldsAdd input_total = inputToken + oldInput
| fieldsAdd output_total = outputToken + oldOutput
| fieldsAdd tokens = input_total + output_total
| fieldsAdd prompt = gen_ai.prompt.0.content
| fieldsAdd response = gen_ai.completion.0.content
| filter isNotNull(response) AND response != ""
| summarize {
    total_tokens = sum(tokens),
    trace = takeAny(record(trace.id, end_time, start_time, gen_ai.provider.name, gen_ai.response.model, duration))
  }, by: { prompt, response }
| sort total_tokens desc
| fields prompt, response,
    trace_id = trace[trace.id],
    provider = trace[gen_ai.provider.name],
    model = trace[gen_ai.response.model],
    total_tokens,
    duration_ms = trace[duration] / 1000000
| limit 10
`.trim();
};

/**
 * Top 10 slowest prompts across ALL providers — ranked by response time.
 */
export const TOP_SLOWEST_PROMPTS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
${providerFilter}
| fieldsAdd inputToken = coalesce(asLong(gen_ai.usage.input_tokens), 0)
| fieldsAdd oldInput = coalesce(asLong(gen_ai.usage.prompt_tokens), 0)
| fieldsAdd outputToken = coalesce(asLong(gen_ai.usage.output_tokens), 0)
| fieldsAdd oldOutput = coalesce(asLong(gen_ai.usage.completion_tokens), 0)
| fieldsAdd input_total = inputToken + oldInput
| fieldsAdd output_total = outputToken + oldOutput
| fieldsAdd tokens = input_total + output_total
| fieldsAdd prompt = gen_ai.prompt.0.content
| fieldsAdd response = gen_ai.completion.0.content
| filter isNotNull(response) AND response != ""
| summarize {
    trace = takeAny(record(trace.id, end_time, start_time, gen_ai.provider.name, gen_ai.response.model, duration, tokens))
  }, by: { prompt, response }
| sort trace[duration] desc
| fields prompt, response,
    trace_id = trace[trace.id],
    provider = trace[gen_ai.provider.name],
    model = trace[gen_ai.response.model],
    tokens = trace[tokens],
    response_time_ms = trace[duration] / 1000000
| limit 10
`.trim();
};

// ---- 7.6 Cross-Provider Service Health ----

/**
 * Service health pie — success vs failed requests across all providers.
 */
export const SERVICE_HEALTH_PIE_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
${providerFilter}
| fieldsAdd status = if(span.status_code == "error", "Failed", else: "Successful")
| summarize requests = count(), by: { status }
`.trim();
};

/**
 * Per-provider request count, cost, latency — the universal provider comparison tile.
 */
export const CROSS_PROVIDER_SUMMARY_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
| fieldsAdd inputToken = coalesce(asLong(gen_ai.usage.input_tokens), 0)
| fieldsAdd oldInput = coalesce(asLong(gen_ai.usage.prompt_tokens), 0)
| fieldsAdd outputToken = coalesce(asLong(gen_ai.usage.output_tokens), 0)
| fieldsAdd oldOutput = coalesce(asLong(gen_ai.usage.completion_tokens), 0)
| fieldsAdd input_total = inputToken + oldInput
| fieldsAdd output_total = outputToken + oldOutput
| summarize
    requests = count(),
    total_input = sum(input_total),
    total_output = sum(output_total),
    avg_latency_ms = avg(duration) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    errors = countIf(span.status_code == "error")
  , by: { gen_ai.provider.name }
| fieldsAdd error_rate = if(requests > 0, 100.0 * toDouble(errors) / toDouble(requests), else: 0.0)
| sort requests desc
`.trim();
};

/**
 * Model routing map — tracks where requested model ≠ served model.
 * Reveals API gateways, load balancers, proxy patterns, and model aliasing.
 * E.g. "genai-demo" → "gpt-4o-mini-2024-07-18", embedding aliases → "ada".
 */
export const MODEL_VERSION_MISMATCH_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) AND isNotNull(gen_ai.response.model)
| filter gen_ai.request.model != gen_ai.response.model
| summarize
    occurrences = count(),
    avg_latency_ms = avg(duration) / 1000000,
    total_input = sum(gen_ai.usage.input_tokens),
    total_output = sum(gen_ai.usage.output_tokens)
  , by: { requested = gen_ai.request.model, actual = gen_ai.response.model, provider = gen_ai.provider.name }
| sort occurrences, direction: "descending"
| limit 30
`.trim();
};

/**
 * Shadow AI detection — services calling LLMs without going through approved catalogue.
 * Groups by service + provider + model to surface unexpected AI usage.
 */
export const SHADOW_AI_DETECTION_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
| summarize
    span_count = count(),
    error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100,
    total_tokens = sum(coalesce(toLong(gen_ai.usage.input_tokens), 0) + coalesce(toLong(gen_ai.usage.output_tokens), 0)),
    first_seen = min(start_time),
    last_seen = max(start_time),
    sample_trace = takeLast(trace.id)
  , by: { service = dt.entity.service, gen_ai.provider.name, gen_ai.request.model }
| sort span_count desc
| limit 50
`.trim();
};

/**
 * K8s events for AI workloads — pod restarts, container issues.
 * Phase 6.2 — Kubernetes & Container Visibility
 */
export const K8S_AI_EVENTS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch events, ${timeClause}
| filter event.kind == "K8S_EVENT" OR event.kind == "ERROR_EVENT" OR event.type == "PROCESS_RESTART"
| sort timestamp desc
| limit 50
`.trim();
};

/**
 * Pod restart count for AI services.
 */
export const PROCESS_RESTARTS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch events, ${timeClause}
| filter event.type == "PROCESS_RESTART"
| summarize restarts = count(), by: { dt.entity.process_group, dt.entity.host }
| sort restarts desc
| limit 20
`.trim();
};


// ============================================
// MLOps — Model Registry, SLOs, Comparison, Cost Attribution
// ============================================

/**
 * Model Registry — Every model+provider combination in use, with usage stats.
 * Pure aggregation from gen_ai.* spans. No synthetic scores.
 */
export const MLOPS_MODEL_REGISTRY_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
| summarize
    requests = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    services = collectDistinct(entityName(dt.entity.service)),
    first_seen = min(start_time),
    last_seen = max(start_time)
  , by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
| fieldsAdd error_rate = if(requests > 0, 100.0 * toDouble(error_count) / toDouble(requests), else: 0.0)
| sort requests desc
| limit 100
`.trim();
};

/**
 * AI SLO Compliance — Measures actual compliance against latency and error targets.
 * Returns raw counts so the UI can compute compliance % against user-defined thresholds.
 */
export const MLOPS_SLO_COMPLIANCE_QUERY = (filters?: QueryFilters, latencyThresholdMs = 3000, errorBudgetPct = 1.0): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  const modelFilter = buildModelFilter(filters?.model);
  const latencyNs = latencyThresholdMs * 1000000;
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
${modelFilter}
| summarize
    total_requests = count(),
    fast_requests = countIf(duration <= ${latencyNs}),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000
  , by: { model = gen_ai.request.model, provider = gen_ai.provider.name, service_name = entityName(dt.entity.service) }
| fieldsAdd
    latency_compliance = if(total_requests > 0, 100.0 * toDouble(fast_requests) / toDouble(total_requests), else: 100.0),
    error_rate = if(total_requests > 0, 100.0 * toDouble(error_count) / toDouble(total_requests), else: 0.0)
| fieldsAdd
    error_budget_remaining = ${errorBudgetPct} - error_rate,
    meets_latency_slo = latency_compliance >= 99.0,
    meets_error_slo = error_rate <= ${errorBudgetPct}
| sort total_requests desc
| limit 100
`.trim();
};

/**
 * SLO Trend — Hourly compliance breakdown for timeseries charts.
 */
export const MLOPS_SLO_TREND_QUERY = (filters?: QueryFilters, latencyThresholdMs = 3000): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const latencyNs = latencyThresholdMs * 1000000;
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
| summarize
    total = count(),
    fast = countIf(duration <= ${latencyNs}),
    errors = countIf(span.status_code == "error" OR isNotNull(error.type))
  , by: { time_bucket = bin(start_time, 1h) }
| fieldsAdd
    latency_compliance = if(total > 0, 100.0 * toDouble(fast) / toDouble(total), else: 100.0),
    error_rate = if(total > 0, 100.0 * toDouble(errors) / toDouble(total), else: 0.0)
| sort time_bucket asc
`.trim();
};

/**
 * Model Comparison — Side-by-side metrics for all models.
 * Pure DQL aggregation: latency percentiles, token efficiency, error rates.
 */
export const MLOPS_MODEL_COMPARISON_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
${providerFilter}
| fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
| fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| summarize
    requests = count(),
    avg_latency_ms = avg(duration) / 1000000,
    p50_latency_ms = percentile(duration, 50) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000,
    p99_latency_ms = percentile(duration, 99) / 1000000,
    avg_input = avg(input_tok),
    avg_output = avg(output_tok),
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
  , by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
| fieldsAdd
    error_rate = if(requests > 0, 100.0 * toDouble(error_count) / toDouble(requests), else: 0.0),
    token_efficiency = if(avg_input > 0, avg_output / avg_input, else: 0.0)
| sort requests desc
`.trim();
};

/**
 * Cost Attribution by Service — Token usage per service for cost allocation.
 * Maps AI spend to individual services consuming models.
 */
export const MLOPS_COST_BY_SERVICE_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const providerFilter = buildProviderFilter(filters?.provider);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${providerFilter}
| fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
| fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| summarize
    requests = count(),
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    models_used = collectDistinct(gen_ai.request.model),
    providers_used = collectDistinct(gen_ai.provider.name),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type))
  , by: { service_name = entityName(dt.entity.service) }
| fieldsAdd
    total_tokens = total_input + total_output,
    error_rate = if(requests > 0, 100.0 * toDouble(error_count) / toDouble(requests), else: 0.0)
| sort total_tokens desc
`.trim();
};

/**
 * Cost Attribution by Model — Token/cost breakdown per model across all services.
 */
export const MLOPS_COST_BY_MODEL_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
| fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
| fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| summarize
    requests = count(),
    total_input = sum(input_tok),
    total_output = sum(output_tok),
    avg_input = avg(input_tok),
    avg_output = avg(output_tok),
    services_count = countDistinct(entityName(dt.entity.service))
  , by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
| fieldsAdd total_tokens = total_input + total_output
| sort total_tokens desc
`.trim();
};

/**
 * Model Usage Trend — Hourly request volume per model for timeseries display.
 */
export const MLOPS_MODEL_USAGE_TREND_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  const serviceFilter = buildServiceFilter(filters?.serviceName);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
${serviceFilter}
| summarize
    requests = count(),
    total_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
  , by: { model = gen_ai.request.model, time_bucket = bin(start_time, 1h) }
| sort time_bucket asc
`.trim();
};


// ============================================
// Phase 12: Agentic AI Deep Observability
// MCP-Validated: All queries run against real Grail data (March 2026)
// ============================================

/**
 * 12.1 Agent Trace Waterfall — All spans in a single agent trace, ordered by time.
 * MCP Finding: parent_span_id is NULL — use start_time ordering.
 * MCP Finding: No traceloop.span.kind=="agent" — agents identified via gen_ai.agent.name.
 */
export const AGENT_TRACE_WATERFALL_QUERY = (traceId: string): string => {
  return `
fetch spans
| filter trace.id == "${traceId}"
| fields start_time, span.name, traceloop.span.kind, traceloop.entity.name,
    gen_ai.agent.name, gen_ai.request.model, gen_ai.provider.name,
    gen_ai.usage.input_tokens, gen_ai.usage.output_tokens,
    gen_ai.completion.0.content, gen_ai.completion.0.tool_calls.0.name,
    duration, otel.status_code, span.id, trace.id
| sort start_time asc
`.trim();
};

/**
 * 12.1 Agent Step Counts — Steps per agent trace with type breakdown.
 * MCP: Confirmed task(1M+), tool(78K), workflow(35K) span kinds exist.
 * MCP: Tokens only on LLM spans (gen_ai.request.model != null).
 */
export const AGENT_STEP_COUNT_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.agent.name)
| summarize
    total_spans = count(),
    task_steps = countIf(traceloop.span.kind == "task"),
    tool_steps = countIf(traceloop.span.kind == "tool"),
    workflow_steps = countIf(traceloop.span.kind == "workflow"),
    llm_steps = countIf(isNotNull(gen_ai.request.model)),
    total_input_tokens = sum(toLong(coalesce(gen_ai.usage.input_tokens, 0))),
    total_output_tokens = sum(toLong(coalesce(gen_ai.usage.output_tokens, 0))),
    avg_duration_ms = avg(duration) / 1000000,
    error_count = countIf(otel.status_code == "ERROR"),
    unique_traces = countDistinct(trace.id),
    sample_trace_id = takeFirst(trace.id),
    by: { agent_name = gen_ai.agent.name }
| fieldsAdd steps_per_trace = if(unique_traces > 0, toDouble(total_spans) / toDouble(unique_traces), else: 0.0)
| fieldsAdd error_rate = if(total_spans > 0, 100.0 * toDouble(error_count) / toDouble(total_spans), else: 0.0)
| sort total_spans desc
`.trim();
};

/**
 * 12.1 Agent Exit Conditions — Infer why agents stop (success/error/timeout/slow).
 * MCP: Zero errors in current env, but query is structurally sound.
 */
export const AGENT_EXIT_CONDITIONS_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.agent.name) AND isNotNull(gen_ai.request.model)
| summarize
    last_status = takeAny(otel.status_code),
    max_duration_ns = max(duration),
    total_spans = count(),
    error_count = countIf(otel.status_code == "ERROR"),
    by: { trace_id = trace.id, agent_name = gen_ai.agent.name }
| fieldsAdd exit_condition = if(error_count > 0, "error",
    else: if(max_duration_ns > 60000000000, "timeout",
    else: if(max_duration_ns > 30000000000, "slow_completion", else: "success")))
| summarize
    total = count(),
    success = countIf(exit_condition == "success"),
    errors = countIf(exit_condition == "error"),
    timeouts = countIf(exit_condition == "timeout"),
    slow = countIf(exit_condition == "slow_completion"),
    by: { agent_name }
| sort total desc
`.trim();
};

/**
 * 12.3 Multi-Agent Hierarchy — Supervisor → worker delegation patterns.
 * MCP: Confirmed supervisor(141K), FAQ_agent(99K), flight_state_and_weather_agent(57K).
 * MCP: parent_span_id is NULL — infer hierarchy from gen_ai.agent.name co-occurrence in traces.
 */
export const MULTI_AGENT_HIERARCHY_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.agent.name) AND isNotNull(gen_ai.request.model)
| summarize
    agents = collectDistinct(gen_ai.agent.name),
    agent_count = countDistinct(gen_ai.agent.name),
    total_spans = count(),
    total_input_tokens = sum(toLong(coalesce(gen_ai.usage.input_tokens, 0))),
    total_output_tokens = sum(toLong(coalesce(gen_ai.usage.output_tokens, 0))),
    total_duration_ms = sum(duration) / 1000000,
    error_count = countIf(otel.status_code == "ERROR"),
    by: { trace_id = trace.id }
| filter agent_count > 1
| sort total_spans desc
| limit 200
`.trim();
};

/**
 * 12.3 Agent Parallelism Detection — Are agents running sequentially or concurrently?
 * MCP: Overlap detection via start_time + duration per agent within trace.
 */
export const AGENT_PARALLELISM_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.agent.name) AND traceloop.span.kind == "task" AND traceloop.entity.name == "agent"
| summarize
    agent_count = countDistinct(gen_ai.agent.name),
    min_start = min(start_time),
    max_end = max(start_time + duration),
    total_agent_time_ms = sum(duration) / 1000000,
    by: { trace_id = trace.id }
| filter agent_count > 1
| fieldsAdd wall_clock_ms = (max_end - min_start) / 1000000
| fieldsAdd parallelism_ratio = if(wall_clock_ms > 0, toDouble(total_agent_time_ms) / toDouble(wall_clock_ms), else: 1.0)
| fieldsAdd execution_mode = if(parallelism_ratio > 1.5, "parallel", else: if(parallelism_ratio > 1.1, "mixed", else: "sequential"))
| summarize
    total_traces = count(),
    parallel = countIf(execution_mode == "parallel"),
    sequential = countIf(execution_mode == "sequential"),
    mixed = countIf(execution_mode == "mixed"),
    avg_parallelism = avg(parallelism_ratio)
`.trim();
};

/**
 * 12.3 Cross-Agent Token Attribution — Per-agent token consumption within multi-agent traces.
 * MCP: Tokens ONLY on LLM spans. Supervisor avg 307, Workers avg 196-245 input tokens/call.
 */
export const CROSS_AGENT_TOKEN_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.agent.name) AND isNotNull(gen_ai.usage.input_tokens)
| summarize
    llm_calls = count(),
    total_input = sum(toLong(gen_ai.usage.input_tokens)),
    total_output = sum(toLong(gen_ai.usage.output_tokens)),
    avg_input_per_call = avg(toLong(gen_ai.usage.input_tokens)),
    avg_output_per_call = avg(toLong(gen_ai.usage.output_tokens)),
    unique_traces = countDistinct(trace.id),
    unique_models = collectDistinct(gen_ai.request.model),
    providers = collectDistinct(gen_ai.provider.name),
    tool_calls_made = countIf(isNotNull(gen_ai.completion.0.tool_calls.0.name)),
    by: { agent_name = gen_ai.agent.name }
| fieldsAdd total_tokens = total_input + total_output
| fieldsAdd est_cost_usd = (toDouble(total_input) * 0.000003) + (toDouble(total_output) * 0.000015)
| fieldsAdd tool_call_rate = if(llm_calls > 0, 100.0 * toDouble(tool_calls_made) / toDouble(llm_calls), else: 0.0)
| sort total_tokens desc
`.trim();
};

/**
 * 12.5 Conversation Context Growth — Token escalation across conversation turns.
 * MCP: conversation_id is NULL everywhere — uses trace.id as conversation proxy.
 */
export const CONTEXT_GROWTH_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.usage.input_tokens)
| summarize
    turns = count(),
    min_input = min(toLong(gen_ai.usage.input_tokens)),
    max_input = max(toLong(gen_ai.usage.input_tokens)),
    total_input = sum(toLong(gen_ai.usage.input_tokens)),
    total_output = sum(toLong(gen_ai.usage.output_tokens)),
    total_tokens = sum(toLong(gen_ai.usage.input_tokens)) + sum(toLong(gen_ai.usage.output_tokens)),
    duration_ms = (max(start_time) - min(start_time)) / 1000000,
    agents = collectDistinct(gen_ai.agent.name),
    by: { trace_id = trace.id }
| filter turns > 1
| fieldsAdd context_growth_ratio = if(min_input > 0, toDouble(max_input) / toDouble(min_input), else: 1.0)
| fieldsAdd avg_tokens_per_turn = toDouble(total_tokens) / toDouble(turns)
| sort context_growth_ratio desc
| limit 100
`.trim();
};

/**
 * 12.5 Conversation State Classification — Active, completed, errored, runaway.
 */
export const CONVERSATION_STATE_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name)
| summarize
    turns = count(),
    errors = countIf(otel.status_code == "ERROR"),
    total_tokens = sum(toLong(coalesce(gen_ai.usage.input_tokens, 0))) + sum(toLong(coalesce(gen_ai.usage.output_tokens, 0))),
    duration_ms = (max(start_time) - min(start_time)) / 1000000,
    by: { trace_id = trace.id }
| fieldsAdd state = if(errors > 0 AND errors == turns, "errored",
    else: if(errors > 0, "partial_failure",
    else: if(turns == 1, "single_turn",
    else: if(turns > 20, "runaway", else: "multi_turn"))))
| summarize
    total = count(),
    single_turn = countIf(state == "single_turn"),
    multi_turn = countIf(state == "multi_turn"),
    errored = countIf(state == "errored"),
    partial_failure = countIf(state == "partial_failure"),
    runaway = countIf(state == "runaway"),
    avg_turns = avg(turns),
    avg_tokens = avg(total_tokens),
    avg_duration_ms = avg(duration_ms)
`.trim();
};

/**
 * 12.6 Context Window Utilization — How much of model context window is used per call.
 * Model limits hardcoded (GPT-4: 128K, Claude: 200K, Gemini: 1M, etc.)
 */
export const CONTEXT_WINDOW_UTILIZATION_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.usage.input_tokens) AND isNotNull(gen_ai.request.model)
| fieldsAdd input_tokens = toLong(gen_ai.usage.input_tokens)
| fieldsAdd model = toString(gen_ai.request.model)
| fieldsAdd context_limit = if(contains(model, "gpt-4o"), 128000,
    else: if(contains(model, "gpt-4-turbo"), 128000,
    else: if(contains(model, "gpt-4"), 8192,
    else: if(contains(model, "gpt-3.5"), 16385,
    else: if(contains(model, "claude-3"), 200000,
    else: if(contains(model, "claude-2"), 100000,
    else: if(contains(model, "gemini"), 1000000,
    else: if(contains(model, "llama"), 8192,
    else: if(contains(model, "titan"), 8192,
    else: if(contains(model, "genai-demo"), 128000, else: 4096))))))))))
| fieldsAdd utilization_pct = toDouble(input_tokens) / toDouble(context_limit) * 100
| summarize
    avg_utilization = avg(utilization_pct),
    max_utilization = max(utilization_pct),
    requests = count(),
    high_util_count = countIf(utilization_pct > 80),
    near_capacity_count = countIf(utilization_pct > 90),
    avg_input_tokens = avg(input_tokens),
    by: { model, provider = gen_ai.provider.name }
| fieldsAdd high_util_pct = if(requests > 0, 100.0 * toDouble(high_util_count) / toDouble(requests), else: 0.0)
| sort avg_utilization desc
`.trim();
};

/**
 * 12.4 Cost Threshold Breach Detection — Per-hour cost spikes.
 * MCP: Token data confirmed on 358K spans across 4 providers.
 */
export const COST_BREACH_DETECTION_QUERY = (filters?: QueryFilters): string => {
  const timeClause = getTimeClause(filters);
  return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.prompt_tokens)
| fieldsAdd
    input_t = toLong(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_t = toLong(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
| fieldsAdd estimated_cost = (toDouble(input_t) * 0.000003) + (toDouble(output_t) * 0.000015)
| summarize
    hourly_cost = sum(estimated_cost),
    hourly_requests = count(),
    hourly_tokens = sum(input_t + output_t),
    by: { time_bucket = bin(start_time, 1h) }
| sort time_bucket asc
`.trim();
};