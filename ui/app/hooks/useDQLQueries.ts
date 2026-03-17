// Custom hooks for DQL queries in GenAI Control Center

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { AIService, ServiceEntityOption } from '../types';
import { 
  AI_SERVICES_DISCOVERY_QUERY,
  AI_SERVICES_TREND_QUERY,
  PROVIDER_COMPARISON_QUERY,
  MODEL_COMPARISON_QUERY,
  HIGH_LATENCY_QUERY,
  SERVICE_DETAIL_QUERY,
  DISTINCT_SERVICES_QUERY,
  DISTINCT_ALL_SERVICES_QUERY,
  DISTINCT_PROVIDERS_QUERY,
  DISTINCT_MODELS_QUERY,
  PROMPT_ANALYSIS_QUERY,
  GENAI_ERRORS_QUERY,
  AUDIT_TRAIL_QUERY,
  QueryFilters,
  buildTimeRangeClauseFromTimeframe
} from '../queries/dql-queries';
import type { Timeframe } from '@dynatrace/strato-components/core';
import { estimateCost, calculateHealthStatus } from '../utils';

export type { QueryFilters } from '../queries/dql-queries';

/**
 * Derive provider name from model name when gen_ai.provider.name is not available
 */
function deriveProviderFromModel(modelName: string): string {
  const lower = modelName.toLowerCase();
  
  // OpenAI / Azure OpenAI models
  if (lower.includes('gpt-') || lower.includes('text-embedding') || lower.includes('ada')) {
    return 'OpenAI';
  }
  // Anthropic Claude models
  if (lower.includes('claude')) {
    return 'Anthropic';
  }
  // Google models
  if (lower.includes('gemini') || lower.includes('gecko')) {
    return 'Google';
  }
  // Amazon Bedrock / Titan models
  if (lower.includes('titan') || lower.includes('amazon.')) {
    return 'Amazon Bedrock';
  }
  // Ollama / local models
  if (lower.includes('llama') || lower.includes('mistral') || lower.includes('orca') || lower.includes('deepseek')) {
    return 'Ollama';
  }
  // Default - use the model name prefix as provider
  const parts = modelName.split(/[-:]/);
  return parts[0] || 'Unknown';
}

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseDQLQueryOptions<T> {
  /** Data to display while the first real query is still loading */
  placeholderData?: T;
  /** Automatically re-execute the query when the component remounts after an error (default: true) */
  retryOnMount?: boolean;
}

/**
 * Generic DQL query hook with dynamic query support.
 * Supports placeholderData for instant loading UX and retryOnMount for resilience.
 */
export function useDQLQuery<T>(
  query: string,
  transform?: (records: unknown[]) => T,
  options?: UseDQLQueryOptions<T>
): UseQueryResult<T> {
  const { placeholderData, retryOnMount = true } = options ?? {};
  const [data, setData] = useState<T | null>(placeholderData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountRef = React.useRef(false);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing DQL query:', query);
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 30000,
          fetchTimeoutSeconds: 60
        }
      });
      
      let records: unknown[] = [];

      if (response.state === 'SUCCEEDED') {
        records = response.result?.records || [];
      } else if (response.state === 'RUNNING' && response.requestToken) {
        // Poll for results if query didn't finish in initial timeout
        console.log('[GCC] Query still running, polling...');
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const poll = await queryExecutionClient.queryPoll({ requestToken: response.requestToken });
          if (poll.state === 'SUCCEEDED') {
            records = poll.result?.records || [];
            break;
          }
          if (poll.state === 'FAILED' || poll.state === 'CANCELLED') {
            throw new Error(`Query ${poll.state}`);
          }
        }
      } else if (response.state === 'FAILED' || response.state === 'CANCELLED') {
        throw new Error(`Query ${response.state}`);
      } else {
        records = response.result?.records || [];
      }

      console.log('[GCC] Query returned', records.length, 'records');
      const transformedData = transform ? transform(records) : (records as T);
      setData(transformedData);
    } catch (err) {
      console.error('[GCC] Query failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setLoading(false);
    }
  }, [query, transform]);

  useEffect(() => {
    // On initial mount, always execute
    if (!mountRef.current) {
      mountRef.current = true;
      executeQuery();
      return;
    }
    // On subsequent mounts (remount), retry only if previous attempt had an error
    if (retryOnMount && error) {
      executeQuery();
    }
  }, [executeQuery, retryOnMount, error]);

  return { data, loading, error, refetch: executeQuery };
}

/**
 * Hook for AI Services Discovery (Pillar A) - with filter support
 * Returns unique Dynatrace services with aggregated GenAI metrics
 */
export function useAIServicesDiscovery(filters?: QueryFilters): UseQueryResult<AIService[]> {
  const [data, setData] = useState<AIService[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const query = useMemo(() => AI_SERVICES_DISCOVERY_QUERY(filters), [filters]);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing AI Services Discovery query');
      
      // Step 1: Get aggregated metrics by dt.entity.service
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
      
      const records = response.result?.records || [];
      console.log('[GCC] Found', records.length, 'unique services');
      
      // Step 2: Fetch entity names for all service IDs
      const serviceEntityIds = records
        .map((r: any) => r['dt.entity.service'])
        .filter(Boolean);
      
      const entityNamesMap = new Map<string, string>();
      
      if (serviceEntityIds.length > 0) {
        try {
          const filterConditions = serviceEntityIds.map((id: string) => `id == "${id}"`).join(' OR ');
          const entityQuery = await queryExecutionClient.queryExecute({
            body: {
              query: `
                fetch dt.entity.service
                | filter ${filterConditions}
                | fields id, entity.name
              `,
              requestTimeoutMilliseconds: 30000,
              fetchTimeoutSeconds: 30
            }
          });
          
          (entityQuery.result?.records || []).forEach((rec: any) => {
            if (rec.id && rec['entity.name']) {
              entityNamesMap.set(rec.id, rec['entity.name']);
            }
          });
        } catch (e) {
          console.warn('[GCC] Could not fetch entity names:', e);
        }
      }
      
      // Step 3: Transform records to AIService[]
      const services: AIService[] = records.map((record: any) => {
        const entityId = record['dt.entity.service'];
        const serviceName = entityNamesMap.get(entityId) || entityId || 'Unknown Service';
        
        const latencyMs = Number(record.latency || 0) / 1_000_000;
        const errorRate = Number(record.error_rate || 0);
        const slowRequestRate = Number(record.slow_request_rate || 0);
        const lowOutputRate = Number(record.low_output_rate || 0);
        const tokens = Number(record.tokens || 0);
        const promptTokens = Number(record.prompt_tokens || 0);
        const completionTokens = Number(record.completion_tokens || 0);
        const requestCount = Number(record.request_count || 0);
        
        // Get providers and models from collectDistinct arrays
        const providers: string[] = record.providers || [];
        const models: string[] = record.models || [];
        const primaryProvider = providers[0] || 'Unknown';
        const primaryModel = models[0] || 'Unknown';
        
        // Calculate average output tokens per request
        const avgOutputTokens = requestCount > 0 ? completionTokens / requestCount : 0;
        
        // Estimate cost using blended rate when multiple providers
        // Use a weighted estimate since we don't have per-provider breakdown
        const cost = estimateCost(primaryProvider, promptTokens, completionTokens, primaryModel);
        
        return {
          serviceName: serviceName,
          modelName: models.length > 1 ? `${models.length} models` : primaryModel,
          provider: providers.length > 1 ? `${providers.length} providers` : primaryProvider,
          providers: providers.filter(Boolean),
          models: models.filter(Boolean),
          totalTokens: tokens,
          avgLatency: latencyMs,
          errorRate: errorRate,
          slowRequestRate: slowRequestRate,
          lowOutputRate: lowOutputRate,
          avgOutputTokens: avgOutputTokens,
          requestCount: requestCount,
          estimatedCost: cost,
          lastSeen: new Date().toISOString(),
          healthStatus: calculateHealthStatus(errorRate, latencyMs, slowRequestRate, lowOutputRate),
          entityId: entityId
        };
      });
      
      setData(services);
    } catch (err) {
      console.error('[GCC] AI Services Discovery failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch: executeQuery };
}

/**
 * Hook for Provider Comparison (Unified Governance) - with filter support
 */
export function useProviderComparison(filters?: QueryFilters) {
  const query = useMemo(() => PROVIDER_COMPARISON_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => {
      // The query now groups by coalesce(gen_ai.provider.name, gen_ai.request.model)
      const provider = record['coalesce(gen_ai.provider.name, gen_ai.request.model)'] || 
                       record['gen_ai.provider.name'] || 
                       record['gen_ai.request.model'] || 
                       'Unknown';
      // Extract actual input/output tokens from query results - parse as numbers to avoid string concatenation
      const inputTokens = Number(record.input_tokens) || 0;
      const outputTokens = Number(record.output_tokens) || 0;
      const totalTokens = Number(record.total_tokens) || (inputTokens + outputTokens);
      const totalRequests = Number(record.total_requests) || 0;
      
      return {
        provider: provider,
        models: record.models || [],
        totalRequests: totalRequests,
        avgLatency: (Number(record.avg_latency) || 0) / 1_000_000,
        errorRate: Number(record.error_rate) || 0,
        totalTokens: totalTokens,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        successRate: Number(record.success_rate) || 0,
        estimatedCost: estimateCost(
          provider,
          inputTokens || totalTokens * 0.3,
          outputTokens || totalTokens * 0.7,
          record.models?.[0]
        ),
        // GenAI Quality Metrics
        slowRequestRate: Number(record.slow_request_rate) || 0,
        lowOutputRate: Number(record.low_output_rate) || 0,
        avgOutputTokens: Number(record.avg_output_tokens) || 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Model Comparison - with filter support
 */
export function useModelComparison(filters?: QueryFilters) {
  const query = useMemo(() => MODEL_COMPARISON_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => {
      const modelName = record['gen_ai.request.model'] || record['gen_ai.response.model'] || 'Unknown';
      const provider = record['gen_ai.provider.name'] || deriveProviderFromModel(modelName);
      return {
        modelName: modelName,
        provider: provider,
        avgLatency: (Number(record.avg_latency) || 0) / 1_000_000,
        avgTokensPerRequest: Number(record.avg_tokens) || 0,
        errorRate: Number(record.error_rate) || 0,
        requestCount: Number(record.request_count) || 0,
        // GenAI Quality Metrics
        slowRequestRate: Number(record.slow_request_rate) || 0,
        lowOutputRate: Number(record.low_output_rate) || 0,
        avgOutputTokens: Number(record.avg_output_tokens) || 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for High Latency Services - with filter support
 */
export function useHighLatencyServices(filters?: QueryFilters) {
  const query = useMemo(() => HIGH_LATENCY_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      serviceName: record['dt.entity.service'] || 'Unknown',
      modelName: record['gen_ai.request.model'] || record['gen_ai.response.model'] || 'Unknown',
      slowRequests: Number(record.slow_requests) || 0,
      avgDuration: (Number(record.avg_duration) || 0) / 1_000_000,
      maxDuration: (Number(record.max_duration) || 0) / 1_000_000
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Service Detail - with filter support
 */
export function useServiceDetail(serviceEntityId: string, filters?: QueryFilters) {
  const query = useMemo(() => SERVICE_DETAIL_QUERY(serviceEntityId, filters), [serviceEntityId, filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => ({
      modelName: record['gen_ai.request.model'] || record['gen_ai.response.model'] || 'Unknown',
      provider: record['gen_ai.provider.name'] || deriveProviderFromModel(record['gen_ai.request.model'] || ''),
      tokens: Number(record.tokens) || 0,
      promptTokens: Number(record.prompt_tokens) || 0,
      completionTokens: Number(record.completion_tokens) || 0,
      avgLatency: (Number(record.latency) || 0) / 1_000_000,
      p50Latency: (Number(record.p50_latency) || 0) / 1_000_000,
      p95Latency: (Number(record.p95_latency) || 0) / 1_000_000,
      p99Latency: (Number(record.p99_latency) || 0) / 1_000_000,
      errorRate: Number(record.error_rate) || 0,
      requestCount: Number(record.request_count) || 0
    }));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook to get distinct Dynatrace service entities for filter dropdown
 * Returns ServiceEntityOption[] with both entity ID and name
 */
export function useDistinctServices(filters?: QueryFilters) {
  const [data, setData] = useState<ServiceEntityOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const genAiQuery = useMemo(() => DISTINCT_SERVICES_QUERY(filters), [filters]);
  const allServicesQuery = useMemo(() => DISTINCT_ALL_SERVICES_QUERY(filters), [filters]);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First try GenAI services
      console.log('[GCC] Fetching GenAI service entities');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: genAiQuery,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
      
      let records = response.result?.records || [];
      console.log('[GCC] GenAI services query returned', records.length, 'records');
      
      // If no GenAI services found, try all services as fallback
      if (records.length === 0) {
        console.log('[GCC] No GenAI services, falling back to all services');
        const fallbackResponse = await queryExecutionClient.queryExecute({
          body: {
            query: allServicesQuery,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        });
        records = fallbackResponse.result?.records || [];
      }
      
      // Get entity IDs
      const serviceEntityIds = records
        .map((record: any) => record['dt.entity.service'])
        .filter(Boolean);
      
      if (serviceEntityIds.length === 0) {
        setData([]);
        return;
      }
      
      // Fetch entity names
      const filterConditions = serviceEntityIds.map((id: string) => `id == "${id}"`).join(' OR ');
      const entityQuery = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch dt.entity.service
            | filter ${filterConditions}
            | fields id, entity.name
          `,
          requestTimeoutMilliseconds: 30000,
          fetchTimeoutSeconds: 30
        }
      });
      
      // Return both entity ID and name
      const serviceOptions: ServiceEntityOption[] = (entityQuery.result?.records || [])
        .filter((rec: any) => rec.id && rec['entity.name'])
        .map((rec: any) => ({
          entityId: rec.id,
          entityName: rec['entity.name']
        }));
      
      console.log('[GCC] Parsed service options:', serviceOptions);
      setData(serviceOptions);
    } catch (err) {
      console.error('[GCC] Distinct services query failed:', err);
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setLoading(false);
    }
  }, [genAiQuery, allServicesQuery]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch: executeQuery };
}

/**
 * Hook to get distinct providers for filter dropdown
 */
export function useDistinctProviders(filters?: QueryFilters) {
  const query = useMemo(() => DISTINCT_PROVIDERS_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): string[] => {
    const providers = records
      .map((record: any) => record.provider as string | undefined)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(providers));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook to get distinct models for filter dropdown
 */
export function useDistinctModels(filters?: QueryFilters) {
  const query = useMemo(() => DISTINCT_MODELS_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): string[] => {
    const models = records
      .map((record: any) => record.model as string | undefined)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(models));
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Interface for analyzed prompt data
 * NOTE: Now represents a GROUPED prompt pattern (server-side aggregated)
 * - requestCount = how many times this exact prompt pattern was sent
 * - inputTokens/outputTokens/totalCost = aggregated totals for all requests
 */
export interface AnalyzedPrompt {
  id: string;
  serviceName: string;
  model: string;
  provider: string;
  promptPreview: string;        // Truncated preview for list display
  fullPrompt?: string;          // Full prompt content for detail view
  completionPreview?: string;   // Model's response preview
  fullCompletion?: string;      // Full model response for detail view
  inputTokens: number;          // Total tokens for all requests with this pattern
  outputTokens: number;         // Total tokens for all requests with this pattern
  totalCost: number;            // Total cost for all requests with this pattern
  flags: PromptFlag[];
  timestamp: string;
  traceId: string;
  spanId: string;
  latencyMs: number;            // Average latency across all requests
  statusCode: string;
  requestCount?: number;        // Number of times this pattern appeared (server-grouped)
}

export interface PromptFlag {
  type: 'pii' | 'hallucination' | 'expensive' | 'repetitive' | 'injection' | 'sensitive' | 'bias' | 'error' | 'ungrounded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
  /** Additional metadata for advanced detection */
  metadata?: {
    confidence?: number;       // 0-1 confidence score
    detectionMethod?: string;  // Which method detected this
    urls?: string[];           // Extracted URLs for validation
    groundingScore?: number;   // 0-100 grounding score
  };
}

/**
 * Context for smarter prompt analysis
 * Includes tool/function usage info and completion for hallucination detection
 */
interface PromptContext {
  systemPrompt?: string;
  completion?: string;         // The model's response - key for hallucination detection
  hasToolUsage?: boolean;      // gen_ai.completion.0.tool_calls present
  hasAvailableTools?: boolean; // llm.request.functions present
  finishReason?: string;       // "tool_calls" indicates tool usage
  inputTokens?: number;        // Token counts for cost analysis
  outputTokens?: number;       // Token counts for cost analysis
  ragDocuments?: string[];     // RAG context documents for grounding score
  ragContext?: string;         // Full RAG context if available
}

/**
 * Calculate retrieval grounding score - how much of response is grounded in RAG context
 * Returns score 0-100 (100 = fully grounded, 0 = no grounding)
 */
function calculateGroundingScore(completion: string, ragContext?: string, ragDocuments?: string[]): number {
  if (!ragContext && (!ragDocuments || ragDocuments.length === 0)) {
    return -1; // No RAG context available, can't calculate
  }
  
  const contextText = ragContext || (ragDocuments || []).join(' ');
  if (!contextText.trim()) return -1;
  
  const completionLower = completion.toLowerCase();
  const contextLower = contextText.toLowerCase();
  
  // Extract key phrases/entities from completion (3+ word phrases)
  const completionWords = completionLower.split(/\s+/).filter(w => w.length > 3);
  const uniqueWords = [...new Set(completionWords)];
  
  // Count how many key words from completion appear in context
  let groundedCount = 0;
  for (const word of uniqueWords) {
    if (contextLower.includes(word)) {
      groundedCount++;
    }
  }
  
  // Calculate percentage (with minimum threshold)
  const score = uniqueWords.length > 0 
    ? Math.round((groundedCount / uniqueWords.length) * 100) 
    : 0;
  
  return Math.min(100, Math.max(0, score));
}

// NOTE: Response length anomaly detection was removed as it produced too many
// false positives. Long responses to short questions are normal LLM behavior.

/**
 * Analyze the MODEL'S RESPONSE (completion) for hallucination indicators
 * 
 * IMPORTANT: Regex-based hallucination detection has severe limitations.
 * Most patterns produce false positives because text matching cannot determine factuality.
 * 
 * RELIABLE approaches (kept):
 * - RAG Grounding Score: Compare response against retrieved context
 * 
 * REMOVED patterns (too many false positives):
 * - Fabricated statistics: "73% of users" could be real data
 * - Fake quotes: Some attributed quotes are real
 * - URL extraction: Having URLs is good, not bad
 * - Hedging language: Shows honesty, not hallucination
 * - Circular definitions: "Love is love" is valid
 * - Vague authority: Common writing style, not hallucination
 * - Contradictions: "Never say never" is valid
 * - LLM-as-Judge: Davis isn't designed for fact-checking
 * 
 * For production hallucination detection, consider:
 * - External fact-checking APIs (Wikipedia, search engines)
 * - Knowledge graph verification
 * - Human review for critical content
 */
function analyzeCompletionForHallucination(
  completion: string, 
  context?: PromptContext
): PromptFlag[] {
  const flags: PromptFlag[] = [];
  if (!completion) return flags;
  
  // ============================================
  // RELIABLE: RAG Grounding Score
  // This actually works - comparing response to provided context
  // ============================================
  if (context?.ragContext || context?.ragDocuments) {
    const groundingScore = calculateGroundingScore(completion, context.ragContext, context.ragDocuments);
    if (groundingScore >= 0 && groundingScore < 30) {
      flags.push({ 
        type: 'ungrounded', 
        severity: 'high', 
        detail: `Low grounding score (${groundingScore}%) - response may not be based on provided context`,
        metadata: { detectionMethod: 'grounding_score', confidence: 0.7, groundingScore }
      });
    } else if (groundingScore >= 30 && groundingScore < 50) {
      flags.push({ 
        type: 'ungrounded', 
        severity: 'medium', 
        detail: `Moderate grounding score (${groundingScore}%) - partially based on provided context`,
        metadata: { detectionMethod: 'grounding_score', confidence: 0.6, groundingScore }
      });
    }
  }
  
  // NOTE: For actual hallucination detection in production, consider:
  // - External fact-checking APIs (Wikipedia, search engines)
  // - Knowledge graph verification
  // - Human review for critical content
  // 
  // Automated detection without external knowledge sources is unreliable.
  
  return flags;
}

/**
 * Analyze a prompt for potential issues with context awareness
 * Detection patterns are based on real GenAI span data from Dynatrace environments
 * Uses tool/function context to avoid false positives on FAQ-style questions
 */
function analyzePromptForFlags(
  prompt: string, 
  tokens: number, 
  cost: number,
  context?: PromptContext
): PromptFlag[] {
  const flags: PromptFlag[] = [];
  const promptLower = prompt?.toLowerCase() || '';
  const systemLower = context?.systemPrompt?.toLowerCase() || '';
  
  // Check if this prompt has tool/RAG access (reduces hallucination risk)
  const hasToolAccess = context?.hasToolUsage || 
                        context?.hasAvailableTools || 
                        context?.finishReason === 'tool_calls' ||
                        systemLower.includes('tool') ||
                        systemLower.includes('function') ||
                        systemLower.includes('faq') ||
                        systemLower.includes('knowledge base') ||
                        systemLower.includes('database') ||
                        systemLower.includes('search');
  
  // PII Detection patterns
  const ssnPattern = /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const creditCardPattern = /\b\d{4}[-. ]?\d{4}[-. ]?\d{4}[-. ]?\d{4}\b/;
  const dobPattern = /\b(dob|date of birth|birth date|birthdate)\s*[:=]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i;
  const mrnPattern = /\b(mrn|medical record|patient id)\s*[:=]?\s*\d+\b/i;
  
  if (ssnPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'SSN pattern detected in prompt' });
  }
  if (emailPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'high', detail: 'Email address detected' });
  }
  if (phonePattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'medium', detail: 'Phone number detected' });
  }
  if (creditCardPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'Credit card number pattern detected' });
  }
  if (dobPattern.test(prompt) || mrnPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'PHI/HIPAA data detected (DOB/MRN)' });
  }
  
  // Sensitive content detection
  if (promptLower.includes('password') || promptLower.includes('secret') || promptLower.includes('api key') || promptLower.includes('token')) {
    flags.push({ type: 'sensitive', severity: 'high', detail: 'Potential credentials in prompt' });
  }
  if (promptLower.includes('patient') || promptLower.includes('diagnosis') || promptLower.includes('symptom')) {
    flags.push({ type: 'sensitive', severity: 'high', detail: 'Medical information detected' });
  }
  
  // Prompt injection detection
  const injectionPatterns = [
    'ignore all previous',
    'ignore previous instructions',
    'disregard your instructions',
    'forget your rules',
    'you are now',
    'new persona',
    'jailbreak',
    'dan mode',
    'developer mode'
  ];
  for (const pattern of injectionPatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'injection', severity: 'critical', detail: 'Prompt injection pattern detected' });
      break;
    }
  }
  
  // Expensive prompt detection - based on TOTAL token counts and cost (aggregated for grouped patterns)
  // Thresholds are for total spend/usage across all requests of this pattern
  if (cost > 100) {
    flags.push({ type: 'expensive', severity: 'critical', detail: `Very high total spend: $${cost.toFixed(2)}` });
  } else if (cost > 50) {
    flags.push({ type: 'expensive', severity: 'high', detail: `High total spend: $${cost.toFixed(2)}` });
  } else if (cost > 10) {
    flags.push({ type: 'expensive', severity: 'medium', detail: `Elevated total spend: $${cost.toFixed(2)}` });
  } else if (cost > 1) {
    flags.push({ type: 'expensive', severity: 'low', detail: `Notable total spend: $${cost.toFixed(2)}` });
  }
  if (tokens > 1000000) {
    flags.push({ type: 'expensive', severity: 'critical', detail: `Very high total tokens: ${(tokens/1000000).toFixed(1)}M tokens` });
  } else if (tokens > 100000) {
    flags.push({ type: 'expensive', severity: 'high', detail: `High total tokens: ${(tokens/1000).toFixed(0)}K tokens` });
  } else if (tokens > 10000) {
    flags.push({ type: 'expensive', severity: 'low', detail: `Elevated total tokens: ${tokens.toLocaleString()} tokens` });
  }
  
  // Real-time/factual query detection (hallucination risk)
  // ONLY flag if the agent does NOT have tool/RAG access
  // FAQ questions with tool access (like "baggage fee?") are NOT hallucination risks
  if (!hasToolAccess) {
    // Patterns that indicate real-time data needs (only when no tool access)
    const realTimePatterns = [
      'weather currently',   // Specific: requires live weather API
      'weather right now',
      'stock price',         // Requires live market data
      'current stock',
      'latest news',         // Requires news API
      'live update',
      'real-time',
      'right now',
      'at this moment'
    ];
    for (const pattern of realTimePatterns) {
      if (promptLower.includes(pattern)) {
        flags.push({ type: 'hallucination', severity: 'high', detail: 'Real-time data query without tool access - hallucination risk' });
        break;
      }
    }
  }
  
  // Even with tool access, flag if asking for data the LLM might fabricate
  // These are high-risk regardless of tool access
  const highRiskPatterns = [
    'exact number of',       // LLMs often fabricate specific numbers
    'exact figure',
    'precise count of',
    'how many exactly'
  ];
  for (const pattern of highRiskPatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'hallucination', severity: 'medium', detail: 'Query asks for precise numbers - verify against source' });
      break;
    }
  }
  
  // Bias detection (HR/hiring context)
  if ((promptLower.includes('candidate') || promptLower.includes('resume') || promptLower.includes('hire')) &&
      (promptLower.includes('age') || promptLower.includes('gender') || promptLower.includes('race') || 
       promptLower.includes('nationality') || promptLower.includes('religion'))) {
    flags.push({ type: 'bias', severity: 'high', detail: 'Protected characteristics in hiring context - bias risk' });
  }
  
  // Note: Repetitive/cacheable detection is done at the grouped level in Governance.tsx
  // based on actual request count, not content patterns
  
  return flags;
}

/**
 * Hook for Prompt Analysis - fetches real GenAI spans and analyzes them
 * Uses correct field names from Dynatrace span schema (validated from real data):
 * - trace.id, span.id (with dots)
 * - gen_ai.prompt.0.content = System prompt
 * - gen_ai.prompt.1.content = User prompt
 * - gen_ai.completion.0.content = Completion
 * - gen_ai.completion.0.tool_calls.0.name = Tool call (indicates RAG/function usage)
 * - gen_ai.usage.input_tokens, gen_ai.usage.output_tokens
 * 
 * NOTE: Query now returns SERVER-SIDE GROUPED data:
 * - Each row = unique prompt pattern (service + model + prompt preview)
 * - request_count = total times this pattern was sent
 * - total_input/output_tokens = aggregated token usage
 * - sample_trace_id = one trace ID for deep-linking
 */
export function usePromptAnalysis(filters?: QueryFilters): UseQueryResult<AnalyzedPrompt[]> {
  const [data, setData] = useState<AnalyzedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const query = useMemo(() => PROMPT_ANALYSIS_QUERY(filters), [filters]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Execute main query
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      
      // Step 2: Fetch entity names for service IDs
      const serviceEntityIds = [...new Set(records.map((r: any) => r['dt.entity.service']).filter(Boolean))];
      const entityNamesMap = new Map<string, string>();
      
      if (serviceEntityIds.length > 0) {
        try {
          const filterConditions = serviceEntityIds.map((id: string) => `id == "${id}"`).join(' OR ');
          const entityQueryStr = `fetch dt.entity.service | filter ${filterConditions} | fields id, entity.name`;
          console.log('[GCC] Fetching entity names for prompts. Query:', entityQueryStr);
          console.log('[GCC] Service entity IDs:', serviceEntityIds);
          
          const entityQuery = await queryExecutionClient.queryExecute({
            body: {
              query: entityQueryStr,
              requestTimeoutMilliseconds: 30000,
              fetchTimeoutSeconds: 30
            }
          });
          
          console.log('[GCC] Entity query response:', entityQuery.result?.records);
          
          (entityQuery.result?.records || []).forEach((rec: any) => {
            console.log('[GCC] Entity record:', rec);
            if (rec.id && rec['entity.name']) {
              entityNamesMap.set(rec.id, rec['entity.name']);
              console.log('[GCC] Mapped:', rec.id, '->', rec['entity.name']);
            }
          });
          
          console.log('[GCC] Final entityNamesMap:', Array.from(entityNamesMap.entries()));
        } catch (e) {
          console.error('[GCC] Could not fetch entity names for prompts:', e);
        }
      }

      // Step 3: Transform records with entity names
      const prompts: AnalyzedPrompt[] = records.map((record: any, index: number) => {
        // Get aggregated values from grouped query
        const requestCount = Number(record['request_count'] || 1);
        const inputTokens = Number(record['total_input_tokens'] || 0);
        const outputTokens = Number(record['total_output_tokens'] || 0);
        const totalTokens = inputTokens + outputTokens;
        const modelName = record['gen_ai.request.model'] || 'Unknown';
        const provider = record['gen_ai.provider.name'] || deriveProviderFromModel(modelName);
        const entityId = record['dt.entity.service'] || 'Unknown';
        const serviceName = entityNamesMap.get(entityId) || entityId;
      
        // Check if this is an embedding model (returns vectors, not text)
        const isEmbeddingModel = modelName.toLowerCase().includes('embedding') || 
                                 modelName.toLowerCase().includes('embed') ||
                                 modelName.toLowerCase().includes('ada-002');
        
        // Prompt preview from grouped query (truncated for list display)
        const promptPreview = record['prompt_preview'] || '[No prompt content]';
        // Full prompt for detail view (sampled from last matching span)
        const fullPrompt = record['sample_full_prompt'] || promptPreview;
        // Response previews
        const completionPreview = record['sample_response'] || '';
        const fullCompletion = record['sample_full_response'] || completionPreview;
        const latencyMs = Number(record['avg_latency'] || 0) / 1_000_000;
        
        // Calculate cost (for all requests in this group)
        const cost = estimateCost(provider, inputTokens, outputTokens, modelName);
        
        // Build context for flag detection - use full content for better analysis
        // Include token counts for response length anomaly detection
        const context: PromptContext = {
          systemPrompt: '',
          completion: fullCompletion || completionPreview,
          hasToolUsage: false,
          hasAvailableTools: false,
          finishReason: '',
          inputTokens: inputTokens / Math.max(1, requestCount),   // Average per request for anomaly detection
          outputTokens: outputTokens / Math.max(1, requestCount), // Average per request for anomaly detection
          // RAG context would be populated from gen_ai.retrieval.documents if available
          ragContext: record['rag_context'] || undefined,
          ragDocuments: record['rag_documents'] ? String(record['rag_documents']).split('|||') : undefined
        };
        
        // Skip analysis for embedding models (they return vectors, not text)
        let promptFlags: PromptFlag[] = [];
        let hallucinationFlags: PromptFlag[] = [];
        
        if (!isEmbeddingModel) {
          // Analyze prompt for issues (PII, injection, etc.)
          // Use FULL prompt content for better flag detection (PII, injection patterns)
          // Use TOTAL cost/tokens for expensive detection (grouped patterns can have high aggregated cost)
          promptFlags = analyzePromptForFlags(fullPrompt || promptPreview, totalTokens, cost, context);
          
          // Analyze completion for hallucination - use full completion for better analysis
          // Pass context for enhanced detection (length anomaly, grounding score)
          hallucinationFlags = analyzeCompletionForHallucination(fullCompletion || completionPreview, context);
        }
        
        // Merge all flags
        const flags = [...promptFlags, ...hallucinationFlags];
        
        // Add error flag if this prompt pattern has actual span errors
        const errorCount = Number(record['error_count'] || 0);
        if (errorCount > 0) {
          const errorType = record['sample_error_type'] || '';
          const statusMessage = record['sample_status_message'] || '';
          const errorDetail = errorType || statusMessage || 'Span error detected';
          flags.push({
            type: 'error' as const,
            severity: 'critical' as const,
            detail: `${errorCount} error(s): ${errorDetail}`
          });
        }
        
        // Add repetitive flag if this pattern appears many times (cache-eligible)
        const CACHE_THRESHOLD = 15;
        if (requestCount >= CACHE_THRESHOLD && !isEmbeddingModel) {
          flags.push({
            type: 'repetitive' as const,
            severity: 'low' as const,
            detail: `${requestCount} identical requests - candidate for semantic caching`
          });
        }
        
        // Use sample trace/span for deep-linking
        const traceId = record['sample_trace_id'] || '';
        const spanId = record['sample_span_id'] || '';
        
        return {
          id: `prompt-${index}-${spanId || Date.now()}`,
          serviceName: serviceName,
          model: modelName,
          provider: provider,
          promptPreview,
          fullPrompt,             // Full prompt content for detail view
          completionPreview,
          fullCompletion,         // Full response content for detail view
          inputTokens,           // Total for all requests
          outputTokens,          // Total for all requests
          totalCost: cost,       // Total for all requests
          flags,
          timestamp: record['sample_timestamp'] || new Date().toISOString(),  // Timestamp of the sampled trace
          traceId,
          spanId,
          latencyMs,             // Average latency
          statusCode: 'OK',
          requestCount           // NEW: Number of times this pattern appeared
        };
      });

      setData(prompts);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * GenAI Error interface - represents error spans from GenAI operations
 */
export interface GenAIError {
  id: string;
  traceId: string;
  spanId: string;
  spanName: string;
  timestamp: string;
  provider: string;
  model: string;
  serviceName: string;
  serviceEntityId: string;
  latencyMs: number;
  errorType: string;
  errorMessage: string;
  statusMessage: string;
  promptContent?: string;
  responseContent?: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Hook for fetching GenAI error spans
 * These are spans with status_code == "error" that may not have prompt content
 */
export function useGenAIErrors(filters?: QueryFilters): UseQueryResult<GenAIError[]> {
  const query = useMemo(() => GENAI_ERRORS_QUERY(filters), [filters]);
  const [data, setData] = useState<GenAIError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[GCC] Executing GenAI Errors query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      
      // Fetch entity names for service IDs
      const serviceEntityIds = [...new Set(records.map((r: any) => r['service']).filter(Boolean))];
      const entityNamesMap = new Map<string, string>();
      
      if (serviceEntityIds.length > 0) {
        try {
          const filterConditions = serviceEntityIds.map((id: string) => `id == "${id}"`).join(' OR ');
          const entityQueryStr = `fetch dt.entity.service | filter ${filterConditions} | fields id, entity.name`;
          
          const entityQuery = await queryExecutionClient.queryExecute({
            body: {
              query: entityQueryStr,
              requestTimeoutMilliseconds: 30000,
              fetchTimeoutSeconds: 30
            }
          });
          
          (entityQuery.result?.records || []).forEach((rec: any) => {
            if (rec.id && rec['entity.name']) {
              entityNamesMap.set(rec.id, rec['entity.name']);
            }
          });
        } catch (e) {
          console.error('[GCC] Could not fetch entity names for errors:', e);
        }
      }

      const errors: GenAIError[] = records
        .filter((record) => record !== null)
        .map((record: any, index: number) => {
          const serviceEntityId = record['service'] || 'Unknown';
          const serviceName = entityNamesMap.get(serviceEntityId) || serviceEntityId;
          const modelName = record['model'] || '';
          const provider = record['provider'] || deriveProviderFromModel(modelName) || 'Unknown';
          
          return {
            id: `error-${index}-${record['span_id'] || Date.now()}`,
            traceId: record['trace_id'] || '',
            spanId: record['span_id'] || '',
            spanName: record['span_name'] || '',
            timestamp: record['timestamp'] || new Date().toISOString(),
            provider,
            model: modelName,
            serviceName,
            serviceEntityId,
            latencyMs: Number(record['latency_ns'] || 0) / 1_000_000,
            errorType: record['error_type'] || '',
            errorMessage: record['error_message'] || '',
            statusMessage: record['status_message'] || '',
            promptContent: record['prompt_content'] || undefined,
            responseContent: record['response_content'] || undefined,
            inputTokens: Number(record['input_tokens'] || 0),
            outputTokens: Number(record['output_tokens'] || 0),
          };
        });

      console.log(`[GCC] Found ${errors.length} GenAI errors`);
      setData(errors);
    } catch (err) {
      console.error('[GCC] Error fetching GenAI errors:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Audit Trail Event interface
 */
export interface AuditTrailEvent {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  hasError: boolean;
  traceId: string;
  service: string;
}

/**
 * Hook for fetching audit trail data for governance compliance
 */
export function useAuditTrail(filters?: QueryFilters): UseQueryResult<AuditTrailEvent[]> {
  const query = useMemo(() => AUDIT_TRAIL_QUERY(filters), [filters]);
  const [data, setData] = useState<AuditTrailEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Audit Trail query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      
      const events: AuditTrailEvent[] = records
        .filter((record) => record !== null)
        .map((record) => {
          const r = record as Record<string, unknown>;
          return {
            timestamp: String(r['timestamp'] || new Date().toISOString()),
            provider: String(r['provider'] || 'Unknown'),
            model: String(r['model'] || ''),
            inputTokens: Number(r['input_tokens']) || 0,
            outputTokens: Number(r['output_tokens']) || 0,
            latencyMs: Number(r['latency_ns']) / 1000000 || 0, // Convert ns to ms
            hasError: Boolean(r['has_error']),
            traceId: String(r['trace_id'] || ''),
            service: String(r['service'] || ''),
          };
        });

      setData(events);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================
// Timeseries Data Hooks for Real DQL Charts
// ============================================

export interface TimeseriesDataPoint {
  start: Date;
  end?: Date;  // Required for area charts to render properly
  value: number;
}

export interface TimeseriesData {
  name: string;
  datapoints: TimeseriesDataPoint[];
  unit: string;
}

/**
 * Hook for AI Services Trend by Provider (real DQL timeseries data)
 * Returns token usage and requests over time, grouped by provider
 * Each provider gets its own line in the chart
 */
export function useAIServicesTrend(timeframe?: Timeframe): UseQueryResult<{
  tokens: TimeseriesData[];
  requests: TimeseriesData[];
  cost: TimeseriesData[];
}> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    // Determine interval based on timeframe
    const from = timeframe?.from?.value || 'now()-24h';
    let interval = '1h'; // default for 24h
    if (from.includes('1h')) interval = '5m';
    else if (from.includes('6h')) interval = '15m';
    else if (from.includes('12h')) interval = '30m';
    else if (from.includes('7d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    // makeTimeseries grouped by provider - each provider gets its own line
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
            output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0),
            provider = coalesce(gen_ai.provider.name, "Unknown")
| makeTimeseries {tokens = sum(input_tokens + output_tokens), requests = count()}, by: {provider}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<{
    tokens: TimeseriesData[];
    requests: TimeseriesData[];
    cost: TimeseriesData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing AI Services Trend by Provider query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      
      // Transform makeTimeseries by-provider result to chart-ready format
      // Each record is a provider with arrays of values
      const tokenSeries: TimeseriesData[] = [];
      const requestSeries: TimeseriesData[] = [];
      const costSeries: TimeseriesData[] = [];
      
      // Blended cost rate: ~$0.000002 per token average
      const costPerToken = 0.000002;
      
      records.forEach((record: any) => {
        const provider = record.provider || 'Unknown';
        const timeframeInfo = record.timeframe;
        const tokensArray = record.tokens || [];
        const requestsArray = record.requests || [];
        const intervalMs = Number(record.interval) / 1000000; // nanoseconds to ms
        
        if (timeframeInfo && tokensArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          // Create datapoints for this provider - include both start AND end for area charts
          const tokenDatapoints: TimeseriesDataPoint[] = tokensArray.map((val: number, i: number) => ({
            start: new Date(startTime + i * intervalMs),
            end: new Date(startTime + (i + 1) * intervalMs),
            value: val || 0
          }));
          
          const requestDatapoints: TimeseriesDataPoint[] = requestsArray.map((val: number, i: number) => ({
            start: new Date(startTime + i * intervalMs),
            end: new Date(startTime + (i + 1) * intervalMs),
            value: val || 0
          }));
          
          const costDatapoints: TimeseriesDataPoint[] = tokensArray.map((val: number, i: number) => ({
            start: new Date(startTime + i * intervalMs),
            end: new Date(startTime + (i + 1) * intervalMs),
            value: (val || 0) * costPerToken
          }));
          
          tokenSeries.push({ name: provider, datapoints: tokenDatapoints, unit: 'count' });
          requestSeries.push({ name: provider, datapoints: requestDatapoints, unit: 'count' });
          costSeries.push({ name: provider, datapoints: costDatapoints, unit: 'USD' });
        }
      });

      setData({
        tokens: tokenSeries,
        requests: requestSeries,
        cost: costSeries
      });
    } catch (err) {
      console.error('[GCC] AI Services Trend query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Token Distribution by Provider (for DonutChart)
 * Returns token breakdown by provider
 */
export function useTokensByProvider(timeframe?: Timeframe): UseQueryResult<{
  provider: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  percentage: number;
}[]> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
  }, by: { coalesce(gen_ai.provider.name, "Unknown") }
| sort tokens desc
| limit 10
`;
  }, [timeframe]);
  
  const [data, setData] = useState<{
    provider: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    percentage: number;
  }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Tokens by Provider query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      const totalTokens = records.reduce((sum: number, r: any) => sum + (Number(r.tokens) || 0), 0);
      
      const result = records.map((record: any) => {
        const tokens = Number(record.tokens) || 0;
        return {
          provider: record['coalesce(gen_ai.provider.name, "Unknown")'] || 'Unknown',
          tokens,
          inputTokens: Number(record.input_tokens) || 0,
          outputTokens: Number(record.output_tokens) || 0,
          percentage: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0
        };
      });

      setData(result);
    } catch (err) {
      console.error('[GCC] Tokens by Provider query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
/**
 * Hook for Error Rate Trend by Provider (real DQL timeseries data)
 * Returns error rate percentage over time, grouped by provider
 * Each provider gets its own line in the chart
 * Note: Error spans often don't have model info, so we group by provider instead
 */
export function useErrorRateTrendByModel(timeframe?: Timeframe): UseQueryResult<TimeseriesData[]> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    // Determine interval based on timeframe
    const from = timeframe?.from?.value || 'now()-24h';
    let interval = '1h'; // default for 24h
    if (from.includes('1h')) interval = '5m';
    else if (from.includes('6h')) interval = '15m';
    else if (from.includes('12h')) interval = '30m';
    else if (from.includes('7d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    // makeTimeseries grouped by provider - calculate error rate as percentage
    // Error spans often don't have model info, so provider is more reliable
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown"),
            is_error = (span.status_code == "error" OR isNotNull(error.type))
| makeTimeseries {
    total = count(),
    errors = countIf(is_error)
  }, by: {provider}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<TimeseriesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Error Rate Trend by Provider query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      
      // Transform makeTimeseries by-provider result to chart-ready format
      const errorRateSeries: TimeseriesData[] = [];
      
      records.forEach((record: any) => {
        const provider = record.provider || 'Unknown';
        const timeframeInfo = record.timeframe;
        const totalArray = record.total || [];
        const errorsArray = record.errors || [];
        const intervalMs = Number(record.interval) / 1000000; // nanoseconds to ms
        
        if (timeframeInfo && totalArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          // Calculate error rate percentage for each interval
          const errorRateDatapoints: TimeseriesDataPoint[] = totalArray.map((total: number, i: number) => {
            const errors = errorsArray[i] || 0;
            const errorRate = total > 0 ? (errors / total) * 100 : 0;
            return {
              start: new Date(startTime + i * intervalMs),
              end: new Date(startTime + (i + 1) * intervalMs),
              value: errorRate
            };
          });
          
          // Only include providers that have some errors (to reduce clutter)
          const hasAnyErrors = errorsArray.some((e: number) => e > 0);
          if (hasAnyErrors) {
            errorRateSeries.push({ name: provider, datapoints: errorRateDatapoints, unit: '%' });
          }
        }
      });
      
      // Sort by total errors (providers with most errors first)
      errorRateSeries.sort((a, b) => {
        const aTotal = a.datapoints.reduce((sum, d) => sum + d.value, 0);
        const bTotal = b.datapoints.reduce((sum, d) => sum + d.value, 0);
        return bTotal - aTotal;
      });

      setData(errorRateSeries.slice(0, 10)); // Limit to top 10 providers
    } catch (err) {
      console.error('[GCC] Error Rate Trend query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Latency Trend (P95) by Provider
 * Returns P95 latency in milliseconds over time, grouped by provider
 */
export function useLatencyTrendByProvider(timeframe?: Timeframe): UseQueryResult<TimeseriesData[]> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    const from = timeframe?.from?.value || 'now()-24h';
    let interval = '1h';
    if (from.includes('1h')) interval = '5m';
    else if (from.includes('6h')) interval = '15m';
    else if (from.includes('12h')) interval = '30m';
    else if (from.includes('7d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| makeTimeseries p95_latency = percentile(duration, 95), by: {provider}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<TimeseriesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Latency Trend by Provider query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      const latencySeries: TimeseriesData[] = [];
      
      records.forEach((record: any) => {
        const provider = record.provider || 'Unknown';
        const timeframeInfo = record.timeframe;
        const latencyArray = record.p95_latency || [];
        const intervalMs = Number(record.interval) / 1000000;
        
        if (timeframeInfo && latencyArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          // Convert nanoseconds to milliseconds
          const datapoints: TimeseriesDataPoint[] = latencyArray.map((val: number, i: number) => ({
            start: new Date(startTime + i * intervalMs),
            end: new Date(startTime + (i + 1) * intervalMs),
            value: (val || 0) / 1_000_000 // ns to ms
          }));
          
          latencySeries.push({ name: provider, datapoints, unit: 'ms' });
        }
      });
      
      // Sort by average latency (slowest first)
      latencySeries.sort((a, b) => {
        const aAvg = a.datapoints.reduce((sum, d) => sum + d.value, 0) / a.datapoints.length;
        const bAvg = b.datapoints.reduce((sum, d) => sum + d.value, 0) / b.datapoints.length;
        return bAvg - aAvg;
      });

      setData(latencySeries);
    } catch (err) {
      console.error('[GCC] Latency Trend query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Token Efficiency Ratio (output/input) by Provider
 * Returns the ratio of output to input tokens over time
 * Higher ratio = more output per input token
 */
export function useTokenEfficiencyByProvider(timeframe?: Timeframe): UseQueryResult<TimeseriesData[]> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    const from = timeframe?.from?.value || 'now()-24h';
    let interval = '1h';
    if (from.includes('1h')) interval = '5m';
    else if (from.includes('6h')) interval = '15m';
    else if (from.includes('12h')) interval = '30m';
    else if (from.includes('7d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown"),
            input_tokens = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0),
            output_tokens = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| makeTimeseries {
    total_input = sum(input_tokens),
    total_output = sum(output_tokens)
  }, by: {provider}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<TimeseriesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Token Efficiency by Provider query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      const efficiencySeries: TimeseriesData[] = [];
      
      records.forEach((record: any) => {
        const provider = record.provider || 'Unknown';
        const timeframeInfo = record.timeframe;
        const inputArray = record.total_input || [];
        const outputArray = record.total_output || [];
        const intervalMs = Number(record.interval) / 1000000;
        
        if (timeframeInfo && inputArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          // Calculate efficiency ratio (output/input)
          const datapoints: TimeseriesDataPoint[] = inputArray.map((input: number, i: number) => {
            const output = outputArray[i] || 0;
            const ratio = input > 0 ? output / input : 0;
            return {
              start: new Date(startTime + i * intervalMs),
              end: new Date(startTime + (i + 1) * intervalMs),
              value: ratio
            };
          });
          
          // Only include providers with actual token data
          const hasTokenData = inputArray.some((v: number) => v > 0) || outputArray.some((v: number) => v > 0);
          if (hasTokenData) {
            efficiencySeries.push({ name: provider, datapoints, unit: 'ratio' });
          }
        }
      });
      
      // Sort by average efficiency (highest first)
      efficiencySeries.sort((a, b) => {
        const aAvg = a.datapoints.reduce((sum, d) => sum + d.value, 0) / a.datapoints.length;
        const bAvg = b.datapoints.reduce((sum, d) => sum + d.value, 0) / b.datapoints.length;
        return bAvg - aAvg;
      });

      setData(efficiencySeries);
    } catch (err) {
      console.error('[GCC] Token Efficiency query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Model Usage Trend
 * Returns request count over time, grouped by model
 * Shows which models are gaining/losing usage
 */
export function useModelUsageTrend(timeframe?: Timeframe): UseQueryResult<TimeseriesData[]> {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    const from = timeframe?.from?.value || 'now()-24h';
    let interval = '1h';
    if (from.includes('1h')) interval = '5m';
    else if (from.includes('6h')) interval = '15m';
    else if (from.includes('12h')) interval = '30m';
    else if (from.includes('7d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| fieldsAdd model = coalesce(gen_ai.request.model, gen_ai.response.model, "Unknown")
| makeTimeseries requests = count(), by: {model}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<TimeseriesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Model Usage Trend query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      const usageSeries: TimeseriesData[] = [];
      
      records.forEach((record: any) => {
        const model = record.model || 'Unknown';
        const timeframeInfo = record.timeframe;
        const requestsArray = record.requests || [];
        const intervalMs = Number(record.interval) / 1000000;
        
        if (timeframeInfo && requestsArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          const datapoints: TimeseriesDataPoint[] = requestsArray.map((val: number, i: number) => ({
            start: new Date(startTime + i * intervalMs),
            end: new Date(startTime + (i + 1) * intervalMs),
            value: val || 0
          }));
          
          usageSeries.push({ name: model, datapoints, unit: 'count' });
        }
      });
      
      // Sort by total requests (most popular first)
      usageSeries.sort((a, b) => {
        const aTotal = a.datapoints.reduce((sum, d) => sum + d.value, 0);
        const bTotal = b.datapoints.reduce((sum, d) => sum + d.value, 0);
        return bTotal - aTotal;
      });

      // Limit to top 8 models to keep chart readable
      setData(usageSeries.slice(0, 8));
    } catch (err) {
      console.error('[GCC] Model Usage Trend query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Cost Trend - timeseries of estimated cost by provider
 * Used in FinOps dashboard for cost visualization
 */
export function useCostTrend(timeframe?: Timeframe) {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(timeframe);
    const from = timeframe?.from?.value || 'now()-24h';
    
    // Determine interval based on timeframe
    let interval = '1h';
    if (from.includes('7d') || from.includes('14d')) interval = '4h';
    else if (from.includes('30d')) interval = '1d';
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| filter isNotNull(gen_ai.usage.input_tokens) OR isNotNull(gen_ai.usage.output_tokens)
| fieldsAdd provider = coalesce(gen_ai.provider.name, "Unknown")
| fieldsAdd input_tok = coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)
| fieldsAdd output_tok = coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
| makeTimeseries 
    input_tokens = sum(input_tok),
    output_tokens = sum(output_tok),
    requests = count(),
    by: {provider}, interval: ${interval}
`;
  }, [timeframe]);
  
  const [data, setData] = useState<TimeseriesData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing Cost Trend query');
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60,
        },
      });

      const records = response.result?.records || [];
      const costSeries: TimeseriesData[] = [];
      
      records.forEach((record: any) => {
        const provider = record.provider || 'Unknown';
        const timeframeInfo = record.timeframe;
        const inputArray = record.input_tokens || [];
        const outputArray = record.output_tokens || [];
        const intervalMs = Number(record.interval) / 1000000;
        
        if (timeframeInfo && inputArray.length > 0) {
          const startTime = new Date(timeframeInfo.start).getTime();
          
          // Calculate cost for each interval
          const datapoints: TimeseriesDataPoint[] = inputArray.map((inputVal: number, i: number) => {
            const outputVal = outputArray[i] || 0;
            const cost = estimateCost(provider, inputVal || 0, outputVal || 0);
            return {
              start: new Date(startTime + i * intervalMs),
              end: new Date(startTime + (i + 1) * intervalMs),
              value: cost
            };
          });
          
          costSeries.push({ name: provider, datapoints, unit: '$' });
        }
      });
      
      // Sort by total cost (highest first)
      costSeries.sort((a, b) => {
        const aTotal = a.datapoints.reduce((sum, d) => sum + d.value, 0);
        const bTotal = b.datapoints.reduce((sum, d) => sum + d.value, 0);
        return bTotal - aTotal;
      });

      setData(costSeries);
    } catch (err) {
      console.error('[GCC] Cost Trend query failed:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for Model Cost Breakdown - cost by model with tokens breakdown
 * Used in FinOps dashboard for detailed cost analysis
 */
export function useModelCostBreakdown(filters?: QueryFilters) {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(filters?.timeframe);
    const serviceFilter = filters?.serviceName ? `| filter dt.entity.service == "${filters.serviceName}"` : '';
    const providerFilter = filters?.provider ? `| filter gen_ai.provider.name == "${filters.provider}"` : '';
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) OR isNotNull(gen_ai.response.model)
${serviceFilter}
${providerFilter}
| summarize {
    total_requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    avg_latency = avg(duration),
    error_rate = toDouble(countIf(span.status_code == "error")) / toDouble(count()) * 100.0
  }, by: { model = coalesce(gen_ai.request.model, gen_ai.response.model), provider = gen_ai.provider.name }
| sort input_tokens + output_tokens desc
| limit 15
`;
  }, [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    return records.map((record: any) => {
      const model = record.model || 'Unknown';
      const provider = record.provider || deriveProviderFromModel(model);
      const inputTokens = Number(record.input_tokens) || 0;
      const outputTokens = Number(record.output_tokens) || 0;
      const totalRequests = Number(record.total_requests) || 0;
      
      return {
        model,
        provider,
        totalRequests,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        avgLatency: (Number(record.avg_latency) || 0) / 1_000_000,
        errorRate: Number(record.error_rate) || 0,
        estimatedCost: estimateCost(provider, inputTokens, outputTokens, model),
        costPerRequest: totalRequests > 0 
          ? estimateCost(provider, inputTokens, outputTokens, model) / totalRequests 
          : 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Cost by Service - chargeback/allocation data
 * Groups costs by dt.entity.service for internal billing
 */
export function useCostByService(filters?: QueryFilters) {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(filters?.timeframe);
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize 
    total_requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
    errors = countIf(span.status_code == "error"),
    by: { service_id = dt.entity.service }
| sort input_tokens + output_tokens desc
| limit 20
`;
  }, [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    if (!records || !Array.isArray(records)) return [];
    
    return records.map((record: any) => {
      const inputTokens = Number(record.input_tokens) || 0;
      const outputTokens = Number(record.output_tokens) || 0;
      const totalRequests = Number(record.total_requests) || 0;
      const errors = Number(record.errors) || 0;
      // Use average pricing across providers for service-level cost
      const estimatedCost = estimateCost('openai', inputTokens, outputTokens);
      
      return {
        serviceId: record.service_id || 'Unknown',
        totalRequests,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        errors,
        errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
        estimatedCost,
        costPerRequest: totalRequests > 0 ? estimatedCost / totalRequests : 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Embedding vs Completion cost split
 * Separates embedding models (cheaper) from completion models
 */
export function useEmbeddingVsCompletion(filters?: QueryFilters) {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(filters?.timeframe);
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model)
| fieldsAdd is_embedding = if(
    contains(lower(gen_ai.request.model), "embed") OR 
    contains(lower(gen_ai.request.model), "gecko") OR
    contains(lower(gen_ai.request.model), "ada"), 
    true, else: false)
| summarize 
    requests = count(),
    input_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0)),
    output_tokens = sum(coalesce(gen_ai.usage.output_tokens, 0)),
    by: { model_type = if(is_embedding, "Embedding", else: "Completion") }
| sort requests desc
`;
  }, [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    if (!records || !Array.isArray(records)) return [];
    
    return records.map((record: any) => {
      const inputTokens = Number(record.input_tokens) || 0;
      const outputTokens = Number(record.output_tokens) || 0;
      const requests = Number(record.requests) || 0;
      const isEmbedding = record.model_type === 'Embedding';
      
      // Embeddings are ~10x cheaper than completions
      const estimatedCost = isEmbedding 
        ? inputTokens * 0.0001 / 1000  // ~$0.0001/1K tokens for embeddings
        : estimateCost('openai', inputTokens, outputTokens);
      
      return {
        modelType: record.model_type || 'Unknown',
        requests,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost,
        costPerRequest: record.requests > 0 ? estimatedCost / record.requests : 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

/**
 * Hook for Token Efficiency Analysis - find wasteful prompts
 * Low efficiency = high input, low output (potential waste)
 */
export function useTokenEfficiency(filters?: QueryFilters) {
  const query = useMemo(() => {
    const timeClause = buildTimeRangeClauseFromTimeframe(filters?.timeframe);
    
    return `
fetch spans, ${timeClause}
| filter isNotNull(gen_ai.request.model) AND isNotNull(gen_ai.usage.input_tokens) AND isNotNull(gen_ai.usage.output_tokens)
| summarize 
    requests = count(),
    total_input = sum(gen_ai.usage.input_tokens),
    total_output = sum(gen_ai.usage.output_tokens),
    avg_input = avg(gen_ai.usage.input_tokens),
    avg_output = avg(gen_ai.usage.output_tokens),
    by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
| fieldsAdd efficiency = toDouble(total_output) / toDouble(if(total_input > 0, total_input, else: 1))
| sort efficiency asc
| limit 15
`;
  }, [filters]);
  
  const transform = useCallback((records: unknown[]) => {
    if (!records || !Array.isArray(records)) return [];
    
    return records.map((record: any) => {
      const model = record.model || 'Unknown';
      const provider = record.provider || deriveProviderFromModel(model);
      const inputTokens = Number(record.total_input) || 0;
      const outputTokens = Number(record.total_output) || 0;
      const requests = Number(record.requests) || 0;
      const efficiency = Number(record.efficiency) || 0;
      const avgInput = Number(record.avg_input) || 0;
      const avgOutput = Number(record.avg_output) || 0;
      
      return {
        model,
        provider,
        requests,
        totalInput: inputTokens,
        totalOutput: outputTokens,
        avgInput,
        avgOutput,
        efficiency,
        // Flag as wasteful if efficiency < 0.5 (less than 50% output vs input)
        isWasteful: efficiency < 0.5,
        estimatedCost: estimateCost(provider, inputTokens, outputTokens, model),
        // Potential savings if efficiency improved to 1.0
        potentialSavings: efficiency < 1.0 
          ? estimateCost(provider, inputTokens * (1 - efficiency), 0, model)
          : 0
      };
    });
  }, []);

  return useDQLQuery(query, transform);
}

// ============================================
// Semantic Cache Savings Calculator
// ============================================

export interface SemanticCacheCandidate {
  promptPattern: string;
  serviceName: string;
  model: string;
  provider: string;
  requestCount: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCost: number;
  potentialSavings: number;  // Cost if we cached after first request
  cacheHitRate: number;      // (count-1)/count = potential cache hits
}

export interface SemanticCacheSummary {
  totalCandidates: number;
  totalPotentialSavings: number;
  totalRepetitiveRequests: number;
  avgPotentialCacheHitRate: number;
  topCandidates: SemanticCacheCandidate[];
}

/**
 * Hook for calculating semantic cache savings opportunities
 * Identifies repeated prompts that could benefit from caching
 */
export function useSemanticCacheSavings(filters?: QueryFilters) {
  const timeClause = buildTimeRangeClauseFromTimeframe(filters?.timeframe);
  
  const query = useMemo(() => {
    let filterClause = '';
    if (filters?.serviceName) {
      filterClause += ` | filter dt.entity.service == "${filters.serviceName}"`;
    }
    if (filters?.provider) {
      filterClause += ` | filter gen_ai.provider.name == "${filters.provider}"`;
    }
    if (filters?.model) {
      filterClause += ` | filter gen_ai.request.model == "${filters.model}"`;
    }
    
    // Query for repeated prompts grouped by normalized content
    return `
      fetch spans, ${timeClause}
      | filter isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.request.model)
      | filter span.kind == "CLIENT" OR span.kind == "INTERNAL"
      ${filterClause}
      | fieldsAdd prompt_normalized = lower(trim(substring(coalesce(gen_ai.prompt.0.content, ""), 0, 150)))
      | summarize {
          request_count = count(),
          total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
          total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
          avg_input = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
          avg_output = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
        }, by: { prompt_normalized, dt.entity.service, gen_ai.request.model, gen_ai.provider.name }
      | filter request_count >= 5
      | sort request_count desc
      | limit 50
    `;
  }, [filters, timeClause]);
  
  const transform = useCallback((records: unknown[]): SemanticCacheSummary => {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return {
        totalCandidates: 0,
        totalPotentialSavings: 0,
        totalRepetitiveRequests: 0,
        avgPotentialCacheHitRate: 0,
        topCandidates: []
      };
    }
    
    const candidates: SemanticCacheCandidate[] = records.map((record: any) => {
      const model = record['gen_ai.request.model'] || 'Unknown';
      const provider = record['gen_ai.provider.name'] || deriveProviderFromModel(model);
      const requestCount = Number(record.request_count) || 0;
      const totalInput = Number(record.total_input_tokens) || 0;
      const totalOutput = Number(record.total_output_tokens) || 0;
      const avgInput = Number(record.avg_input) || 0;
      const avgOutput = Number(record.avg_output) || 0;
      
      // Calculate total cost for all requests
      const totalCost = estimateCost(provider, totalInput, totalOutput, model);
      
      // If cached after first request, we'd save (count-1)/count of the cost
      // (First request pays full cost, subsequent requests are free/minimal)
      const cacheHitRate = requestCount > 1 ? (requestCount - 1) / requestCount : 0;
      const potentialSavings = totalCost * cacheHitRate * 0.95; // 95% savings (5% cache overhead)
      
      return {
        promptPattern: record.prompt_normalized || '[Pattern]',
        serviceName: record['dt.entity.service'] || 'Unknown',
        model,
        provider,
        requestCount,
        avgInputTokens: avgInput,
        avgOutputTokens: avgOutput,
        totalCost,
        potentialSavings,
        cacheHitRate
      };
    });
    
    // Filter to only patterns with meaningful savings (>$0.001)
    const meaningfulCandidates = candidates.filter(c => c.potentialSavings > 0.001);
    
    const totalSavings = meaningfulCandidates.reduce((sum, c) => sum + c.potentialSavings, 0);
    const totalRequests = meaningfulCandidates.reduce((sum, c) => sum + c.requestCount, 0);
    const avgHitRate = meaningfulCandidates.length > 0
      ? meaningfulCandidates.reduce((sum, c) => sum + c.cacheHitRate, 0) / meaningfulCandidates.length
      : 0;
    
    return {
      totalCandidates: meaningfulCandidates.length,
      totalPotentialSavings: totalSavings,
      totalRepetitiveRequests: totalRequests,
      avgPotentialCacheHitRate: avgHitRate,
      topCandidates: meaningfulCandidates.slice(0, 10)
    };
  }, []);

  return useDQLQuery(query, transform);
}