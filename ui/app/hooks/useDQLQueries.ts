// Custom hooks for DQL queries in GenAI Control Center

import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { AIService, ServiceEntityOption } from '../types';
import { 
  AI_SERVICES_DISCOVERY_QUERY,
  PROVIDER_COMPARISON_QUERY,
  MODEL_COMPARISON_QUERY,
  HIGH_LATENCY_QUERY,
  SERVICE_DETAIL_QUERY,
  DISTINCT_SERVICES_QUERY,
  DISTINCT_ALL_SERVICES_QUERY,
  DISTINCT_PROVIDERS_QUERY,
  DISTINCT_MODELS_QUERY,
  PROMPT_ANALYSIS_QUERY,
  QueryFilters
} from '../queries/dql-queries';
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

/**
 * Generic DQL query hook with dynamic query support
 */
export function useDQLQuery<T>(
  query: string,
  transform?: (records: unknown[]) => T
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[GCC] Executing DQL query:', query);
      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
      
      const records = response.result?.records || [];
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
    executeQuery();
  }, [executeQuery]);

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
        const cost = estimateCost(primaryProvider, promptTokens, completionTokens);
        
        return {
          serviceName: serviceName,
          modelName: models.length > 1 ? `${models.length} models` : primaryModel,
          provider: providers.length > 1 ? `${providers.length} providers` : primaryProvider,
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
      return {
        provider: provider,
        models: record.models || [],
        totalRequests: record.total_requests || 0,
        avgLatency: (record.avg_latency || 0) / 1_000_000,
        errorRate: record.error_rate || 0,
        totalTokens: record.total_tokens || 0,
        successRate: record.success_rate || 0,
        estimatedCost: estimateCost(
          provider,
          record.input_tokens || record.total_tokens * 0.3,
          record.output_tokens || record.total_tokens * 0.7
        ),
        // GenAI Quality Metrics
        slowRequestRate: record.slow_request_rate || 0,
        lowOutputRate: record.low_output_rate || 0,
        avgOutputTokens: record.avg_output_tokens || 0
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
        avgLatency: (record.avg_latency || 0) / 1_000_000,
        avgTokensPerRequest: record.avg_tokens || 0,
        errorRate: record.error_rate || 0,
        requestCount: record.request_count || 0,
        // GenAI Quality Metrics
        slowRequestRate: record.slow_request_rate || 0,
        lowOutputRate: record.low_output_rate || 0,
        avgOutputTokens: record.avg_output_tokens || 0
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
      slowRequests: record.slow_requests || 0,
      avgDuration: (record.avg_duration || 0) / 1_000_000,
      maxDuration: (record.max_duration || 0) / 1_000_000
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
      tokens: record.tokens || 0,
      promptTokens: record.prompt_tokens || 0,
      completionTokens: record.completion_tokens || 0,
      avgLatency: (record.latency || 0) / 1_000_000,
      p50Latency: (record.p50_latency || 0) / 1_000_000,
      p95Latency: (record.p95_latency || 0) / 1_000_000,
      p99Latency: (record.p99_latency || 0) / 1_000_000,
      errorRate: record.error_rate || 0,
      requestCount: record.request_count || 0
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
  promptPreview: string;
  completionPreview?: string;   // Model's response - key for hallucination detection
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
  type: 'pii' | 'hallucination' | 'expensive' | 'repetitive' | 'injection' | 'sensitive' | 'bias';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
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
}

/**
 * Analyze the MODEL'S RESPONSE (completion) for hallucination indicators
 * This is the most reliable way to detect hallucination - look at what the model actually said
 */
function analyzeCompletionForHallucination(completion: string): PromptFlag[] {
  const flags: PromptFlag[] = [];
  if (!completion) return flags;
  
  const completionLower = completion.toLowerCase();
  
  // Pattern 1: Obvious factual errors (known false statements)
  // These are fabricated facts that are demonstrably wrong
  const obviousFalsehoods = [
    { pattern: /sydney.*(western australia|population of \d{1,3} people|accessed by camel)/i, detail: 'Fabricated geography/demographics' },
    { pattern: /can only be accessed by (camel|horse|boat)/i, detail: 'Fabricated transportation claim' },
    { pattern: /population of (\d{1,3}) people/i, detail: 'Unrealistic population number' },
  ];
  
  for (const { pattern, detail } of obviousFalsehoods) {
    if (pattern.test(completion)) {
      flags.push({ type: 'hallucination', severity: 'critical', detail: `Hallucination detected: ${detail}` });
    }
  }
  
  // Pattern 2: Hedging language that suggests uncertainty (potential hallucination)
  const hedgingPatterns = [
    'i believe', 'i think', 'probably', 'might be', 'could be',
    'if i recall', 'if i remember', 'i\'m not sure but',
    'i cannot verify', 'i don\'t have access to'
  ];
  let hedgingCount = 0;
  for (const pattern of hedgingPatterns) {
    if (completionLower.includes(pattern)) hedgingCount++;
  }
  if (hedgingCount >= 2) {
    flags.push({ type: 'hallucination', severity: 'medium', detail: 'Multiple hedging phrases suggest uncertainty' });
  }
  
  // Pattern 3: Overconfident specificity (making up precise details)
  // E.g., specific dates, names, or numbers without source
  const overlySpecificPatterns = [
    /on (january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2},? \d{4}/i,
    /according to a \d{4} (study|report|survey)/i,
    /founded in \d{4} by [A-Z][a-z]+ [A-Z][a-z]+/i,
  ];
  for (const pattern of overlySpecificPatterns) {
    if (pattern.test(completion) && !completionLower.includes('source') && !completionLower.includes('reference')) {
      flags.push({ type: 'hallucination', severity: 'low', detail: 'Specific claims without cited source - verify accuracy' });
      break;
    }
  }
  
  // Pattern 4: Contradictions within the response
  const contradictions = [
    { check: /does not have.*(airport|port).*easily accessible/i, detail: 'Contradictory statements about accessibility' },
    { check: /no.*but also has/i, detail: 'Self-contradictory claim' },
  ];
  for (const { check, detail } of contradictions) {
    if (check.test(completion)) {
      flags.push({ type: 'hallucination', severity: 'high', detail: `Contradiction: ${detail}` });
    }
  }
  
  // Pattern 5: Implausible claims (things that don't make sense)
  const implausiblePatterns = [
    /known for.*(winter sports|skiing).*tropical/i,
    /great for winter sports/i,  // Sydney-specific hallucination
  ];
  if (completionLower.includes('sydney') || completionLower.includes('australia')) {
    for (const pattern of implausiblePatterns) {
      if (pattern.test(completion)) {
        flags.push({ type: 'hallucination', severity: 'high', detail: 'Implausible geographic claim' });
        break;
      }
    }
  }
  
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
  const query = useMemo(() => PROMPT_ANALYSIS_QUERY(filters), [filters]);
  
  const transform = useCallback((records: unknown[]): AnalyzedPrompt[] => {
    return records.map((record: any, index: number) => {
      // Get aggregated values from grouped query
      const requestCount = Number(record['request_count'] || 1);
      const inputTokens = Number(record['total_input_tokens'] || 0);
      const outputTokens = Number(record['total_output_tokens'] || 0);
      const totalTokens = inputTokens + outputTokens;
      const modelName = record['gen_ai.request.model'] || 'Unknown';
      const provider = record['gen_ai.provider.name'] || deriveProviderFromModel(modelName);
      
      // Prompt preview from grouped query
      const promptPreview = record['prompt_preview'] || '[No prompt content]';
      const completionPreview = record['sample_response'] || '';
      const latencyMs = Number(record['avg_latency'] || 0) / 1_000_000;
      
      // Calculate cost (for all requests in this group)
      const cost = estimateCost(provider, inputTokens, outputTokens);
      
      // Build context for flag detection
      const context: PromptContext = {
        systemPrompt: '',
        completion: completionPreview,
        hasToolUsage: false,
        hasAvailableTools: false,
        finishReason: ''
      };
      
      // Analyze prompt for issues (PII, injection, etc.)
      // Use TOTAL cost/tokens for expensive detection (grouped patterns can have high aggregated cost)
      // Other flags (PII, injection) use per-request analysis since they're content-based
      const promptFlags = analyzePromptForFlags(promptPreview, totalTokens, cost, context);
      
      // Analyze completion for hallucination
      const hallucinationFlags = analyzeCompletionForHallucination(completionPreview);
      
      // Merge all flags
      const flags = [...promptFlags, ...hallucinationFlags];
      
      // Add repetitive flag if this pattern appears many times (cache-eligible)
      const CACHE_THRESHOLD = 15;
      if (requestCount >= CACHE_THRESHOLD) {
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
        serviceName: record['dt.entity.service'] || 'Unknown',
        model: modelName,
        provider: provider,
        promptPreview,
        completionPreview,
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
  }, []);

  return useDQLQuery(query, transform);
}
