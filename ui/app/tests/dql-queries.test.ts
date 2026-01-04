/**
 * GenAI Control Center - DQL Query Test Suite
 * 
 * Tests for verifying DQL queries work correctly with both:
 * - Production environment (prompt_tokens, completion_tokens)
 * - Demo environment (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens)
 */

import { DQL_QUERIES } from '../dql-queries';

// Mock data representing different environment schemas
const DEMO_ENVIRONMENT_SPAN = {
  'gen_ai.usage.input_tokens': 150,
  'gen_ai.usage.output_tokens': 350,
  'gen_ai.usage.total_tokens': 500,
  'gen_ai.provider.name': 'Azure',
  'gen_ai.request.model': 'gpt-4',
  'gen_ai.system': null,
  'status.code': null,
  'duration': 2500000000, // 2.5 seconds in nanoseconds
};

const PRODUCTION_ENVIRONMENT_SPAN = {
  'prompt_tokens': 150,
  'completion_tokens': 350,
  'gen_ai.system': 'openai',
  'gen_ai.request.model': 'gpt-4-turbo',
  'gen_ai.provider.name': null,
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
    test('should calculate total tokens from demo environment fields', () => {
      const span = DEMO_ENVIRONMENT_SPAN;
      
      // This mirrors the coalesce logic in our DQL queries:
      // coalesce(gen_ai.usage.total_tokens, coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
      const totalTokens = coalesce(
        span['gen_ai.usage.total_tokens'],
        coalesce(span['gen_ai.usage.input_tokens'], 0) + coalesce(span['gen_ai.usage.output_tokens'], 0)
      );
      
      expect(totalTokens).toBe(500);
    });

    test('should calculate total tokens from production environment fields', () => {
      const span = PRODUCTION_ENVIRONMENT_SPAN;
      
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
    test('should prefer gen_ai.provider.name when available', () => {
      const span = DEMO_ENVIRONMENT_SPAN;
      const provider = coalesce(
        span['gen_ai.provider.name'],
        span['gen_ai.system'],
        deriveProviderFromModel(span['gen_ai.request.model'])
      );
      
      expect(provider).toBe('Azure');
    });

    test('should fallback to gen_ai.system when provider.name is null', () => {
      const span = PRODUCTION_ENVIRONMENT_SPAN;
      const provider = coalesce(
        span['gen_ai.provider.name'],
        span['gen_ai.system'],
        deriveProviderFromModel(span['gen_ai.request.model'])
      );
      
      expect(provider).toBe('openai');
    });

    test('should derive provider from model name as last resort', () => {
      const span = { 
        'gen_ai.provider.name': null, 
        'gen_ai.system': null, 
        'gen_ai.request.model': 'claude-3-sonnet' 
      };
      
      const provider = coalesce(
        span['gen_ai.provider.name'],
        span['gen_ai.system'],
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

  describe('Cost Estimation', () => {
    const PROVIDER_RATES: Record<string, { input: number; output: number }> = {
      'openai': { input: 0.01, output: 0.03 },
      'azure': { input: 0.01, output: 0.03 },
      'anthropic': { input: 0.008, output: 0.024 },
      'google': { input: 0.00025, output: 0.0005 },
      'ollama': { input: 0, output: 0 },
    };

    test('should estimate cost correctly for OpenAI/Azure', () => {
      const inputTokens = 1000;
      const outputTokens = 1000;
      const rates = PROVIDER_RATES.openai;
      
      const cost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
      
      expect(cost).toBe(0.04); // $0.01 + $0.03
    });

    test('should return zero cost for self-hosted Ollama', () => {
      const inputTokens = 10000;
      const outputTokens = 10000;
      const rates = PROVIDER_RATES.ollama;
      
      const cost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
      
      expect(cost).toBe(0);
    });

    test('should estimate cost correctly for Anthropic', () => {
      const inputTokens = 1000;
      const outputTokens = 1000;
      const rates = PROVIDER_RATES.anthropic;
      
      const cost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
      
      expect(cost).toBe(0.032); // $0.008 + $0.024
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
