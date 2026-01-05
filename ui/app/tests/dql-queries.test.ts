/**
 * GenAI Control Center - DQL Query Test Suite
 * 
 * Tests for verifying DQL queries work correctly with Dynatrace Grail data.
 * Based on actual field availability (validated from production data):
 * - gen_ai.provider.name: 100% available (primary provider field)
 * - gen_ai.usage.input_tokens: 59% available (primary token field)
 * - gen_ai.usage.output_tokens: 45% available
 * - gen_ai.usage.prompt_tokens: 9% available (fallback token field)
 * - gen_ai.usage.completion_tokens: 14% available (fallback token field)
 * - gen_ai.system: 0% available (NEVER populated - do not rely on this)
 * - gen_ai.model_name: 0% available (NEVER populated - do not rely on this)
 * - gen_ai.usage.total_tokens: 0% available (NEVER populated - compute from parts)
 */

import { estimateCost } from '../utils/helpers';

// Mock data representing typical Grail span schema
const STANDARD_SPAN = {
  'gen_ai.usage.input_tokens': 150,
  'gen_ai.usage.output_tokens': 350,
  'gen_ai.provider.name': 'Azure',
  'gen_ai.request.model': 'gpt-4',
  'gen_ai.response.model': 'gpt-4',
  'status.code': null,
  'duration': 2500000000, // 2.5 seconds in nanoseconds
};

const SPAN_WITH_LEGACY_TOKENS = {
  'gen_ai.usage.prompt_tokens': 150,
  'gen_ai.usage.completion_tokens': 350,
  'gen_ai.provider.name': 'openai',
  'gen_ai.request.model': 'gpt-4-turbo',
  'status.code': 'ERROR',
  'duration': 3000000000, // 3 seconds in nanoseconds
};

// Utility to simulate coalesce behavior
function coalesce(...values: any[]): any {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

// Utility to derive provider from model name (mirrors production logic)
function deriveProviderFromModel(modelName: string): string {
  const model = modelName?.toLowerCase() || '';
  
  if (model.includes('gpt') || model.includes('text-davinci')) return 'OpenAI';
  if (model.includes('claude')) return 'Anthropic';
  if (model.includes('gemini') || model.includes('palm')) return 'Google';
  if (model.includes('llama') || model.includes('mistral') || model.includes('qwen')) return 'Ollama';
  if (model.includes('titan') || model.includes('bedrock')) return 'Amazon';
  
  return 'Unknown';
}

describe('DQL Query Compatibility', () => {
  describe('Token Calculation with Coalesce', () => {
    test('should calculate total tokens from input/output fields', () => {
      const span = STANDARD_SPAN;
      
      // This mirrors the coalesce logic in our DQL queries:
      // coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) + coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)
      const inputTokens = coalesce(span['gen_ai.usage.input_tokens'], span['gen_ai.usage.prompt_tokens'], 0);
      const outputTokens = coalesce(span['gen_ai.usage.output_tokens'], span['gen_ai.usage.completion_tokens'], 0);
      const totalTokens = inputTokens + outputTokens;
      
      expect(totalTokens).toBe(500);
    });

    test('should fallback to prompt_tokens/completion_tokens when input/output not available', () => {
      const span = SPAN_WITH_LEGACY_TOKENS;
      
      // Production uses prompt_tokens + completion_tokens
      const inputTokens = coalesce(span['gen_ai.usage.input_tokens'], span['prompt_tokens'], 0);
      const outputTokens = coalesce(span['gen_ai.usage.output_tokens'], span['completion_tokens'], 0);
      const totalTokens = inputTokens + outputTokens;
      
      expect(totalTokens).toBe(500);
    });

    test('should handle missing token fields gracefully', () => {
      const spanWithNoTokens = { 'gen_ai.request.model': 'gpt-4' };
      
      const inputTokens = coalesce(
        spanWithNoTokens['gen_ai.usage.input_tokens' as keyof typeof spanWithNoTokens],
        0
      );
      const outputTokens = coalesce(
        spanWithNoTokens['gen_ai.usage.output_tokens' as keyof typeof spanWithNoTokens],
        0
      );
      
      expect(inputTokens).toBe(0);
      expect(outputTokens).toBe(0);
    });
  });

  describe('Provider Derivation', () => {
    test('should use gen_ai.provider.name (always available in Grail)', () => {
      const span = STANDARD_SPAN;
      const provider = coalesce(
        span['gen_ai.provider.name'],
        deriveProviderFromModel(span['gen_ai.request.model'])
      );
      
      expect(provider).toBe('Azure');
    });

    test('should fallback to deriveProviderFromModel when provider.name missing', () => {
      const span = { 
        'gen_ai.provider.name': null, 
        'gen_ai.request.model': 'gpt-4-turbo' 
      };
      const provider = coalesce(
        span['gen_ai.provider.name'],
        deriveProviderFromModel(span['gen_ai.request.model'])
      );
      
      expect(provider).toBe('OpenAI');
    });

    test('should derive provider from model name as last resort', () => {
      const span = { 
        'gen_ai.provider.name': null, 
        'gen_ai.request.model': 'claude-3-sonnet' 
      };
      
      const provider = coalesce(
        span['gen_ai.provider.name'],
        deriveProviderFromModel(span['gen_ai.request.model'])
      );
      
      expect(provider).toBe('Anthropic');
    });

    test('should derive various providers correctly', () => {
      expect(deriveProviderFromModel('gpt-4-turbo')).toBe('OpenAI');
      expect(deriveProviderFromModel('claude-3-opus')).toBe('Anthropic');
      expect(deriveProviderFromModel('gemini-pro')).toBe('Google');
      expect(deriveProviderFromModel('llama-3-70b')).toBe('Ollama');
      expect(deriveProviderFromModel('mistral-large')).toBe('Ollama');
      expect(deriveProviderFromModel('amazon.titan-text')).toBe('Amazon');
      expect(deriveProviderFromModel('unknown-model-xyz')).toBe('Unknown');
    });
  });

  describe('Latency Calculation', () => {
    test('should convert duration from nanoseconds to milliseconds', () => {
      const span = DEMO_ENVIRONMENT_SPAN;
      const latencyMs = span.duration / 1_000_000;
      
      expect(latencyMs).toBe(2500);
    });

    test('should handle missing duration', () => {
      const span = { 'gen_ai.request.model': 'gpt-4' };
      const latencyMs = (span as any).duration ? (span as any).duration / 1_000_000 : 0;
      
      expect(latencyMs).toBe(0);
    });
  });

  describe('Error Rate Calculation', () => {
    test('should detect errors from status.code', () => {
      const productionSpan = PRODUCTION_ENVIRONMENT_SPAN;
      const demoSpan = DEMO_ENVIRONMENT_SPAN;
      
      const productionHasError = productionSpan['status.code'] === 'ERROR';
      const demoHasError = demoSpan['status.code'] === 'ERROR';
      
      expect(productionHasError).toBe(true);
      expect(demoHasError).toBe(false);
    });

    test('should calculate error rate correctly', () => {
      const spans = [
        { 'status.code': 'ERROR' },
        { 'status.code': 'OK' },
        { 'status.code': 'OK' },
        { 'status.code': 'ERROR' },
        { 'status.code': null }, // Demo environment without status.code
      ];
      
      const errorCount = spans.filter(s => s['status.code'] === 'ERROR').length;
      const totalCount = spans.length;
      const errorRate = (errorCount / totalCount) * 100;
      
      expect(errorRate).toBe(40);
    });
  });

  describe('Cost Estimation Helper', () => {
    test('should estimate OpenAI style pricing', () => {
      const cost = estimateCost('OpenAI', 1000, 1000);
      expect(cost).toBeCloseTo(0.04, 5);
    });

    test('should treat Azure providers the same as OpenAI', () => {
      const cost = estimateCost('Azure', 2000, 3000);
      expect(cost).toBeCloseTo(0.01 * 2 + 0.03 * 3, 5);
    });

    test('should support Vertex AI pricing', () => {
      const cost = estimateCost('VertexAI', 4000, 6000);
      expect(cost).toBeCloseTo((0.00025 * 4) + (0.0005 * 6), 5);
    });

    test('should support Amazon Bedrock style pricing', () => {
      const cost = estimateCost('amazon', 1000, 1000);
      expect(cost).toBeCloseTo(0.0008 + 0.0024, 5);
    });

    test('should return zero cost for self-hosted/ollama models', () => {
      const cost = estimateCost('Ollama', 5000, 5000);
      expect(cost).toBe(0);
    });

    test('should fall back to default rates for unknown providers', () => {
      const cost = estimateCost('UnknownVendor', 1000, 1000);
      expect(cost).toBeCloseTo(0.02, 5); // default 0.005 + 0.015
    });
  });
});

describe('DQL Query Structure', () => {
  test('AI_SERVICES_DISCOVERY query should exist', () => {
    expect(DQL_QUERIES.AI_SERVICES_DISCOVERY).toBeDefined();
    expect(DQL_QUERIES.AI_SERVICES_DISCOVERY).toContain('fetch spans');
    expect(DQL_QUERIES.AI_SERVICES_DISCOVERY).toContain('gen_ai');
  });

  test('PROVIDER_COMPARISON query should exist', () => {
    expect(DQL_QUERIES.PROVIDER_COMPARISON).toBeDefined();
    expect(DQL_QUERIES.PROVIDER_COMPARISON).toContain('fetch spans');
  });

  test('MODEL_COMPARISON query should exist', () => {
    expect(DQL_QUERIES.MODEL_COMPARISON).toBeDefined();
    expect(DQL_QUERIES.MODEL_COMPARISON).toContain('gen_ai.request.model');
  });
});

describe('Health Score Calculation', () => {
  function calculateHealthScore(
    errorRate: number,
    avgLatency: number,
    successRate: number
  ): number {
    // Weight: Error rate 40%, Latency 30%, Success rate 30%
    const errorScore = Math.max(0, 100 - errorRate * 10);
    const latencyScore = Math.max(0, 100 - (avgLatency / 100)); // Penalize high latency
    const successScore = successRate;
    
    return Math.round(errorScore * 0.4 + latencyScore * 0.3 + successScore * 0.3);
  }

  test('should calculate perfect health score', () => {
    const score = calculateHealthScore(0, 500, 100);
    expect(score).toBeGreaterThan(90);
  });

  test('should penalize high error rate', () => {
    const goodScore = calculateHealthScore(1, 500, 99);
    const badScore = calculateHealthScore(10, 500, 90);
    
    expect(goodScore).toBeGreaterThan(badScore);
  });

  test('should penalize high latency', () => {
    const fastScore = calculateHealthScore(0, 500, 100);
    const slowScore = calculateHealthScore(0, 5000, 100);
    
    expect(fastScore).toBeGreaterThan(slowScore);
  });
});
