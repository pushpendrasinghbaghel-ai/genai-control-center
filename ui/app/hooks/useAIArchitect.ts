// AI Architect Hook - Pattern Detection & Recommendations

import { useState, useEffect, useCallback } from 'react';
import type { AIService, ArchitectRecommendation, PatternAnalysis, RecommendationType } from '../types';
import { generateId } from '../utils';

interface UseAIArchitectResult {
  recommendations: ArchitectRecommendation[];
  patterns: PatternAnalysis[];
  isLoading: boolean;
  loading: boolean;
  analyzing: boolean;
  error: Error | null;
  refreshAnalysis: () => void;
}

/**
 * Get severity color for display
 */
export function getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (severity) {
    case 'critical':
      return 'var(--dt-colors-feedback-critical-default)';
    case 'high':
      return 'var(--dt-colors-feedback-critical-default)';
    case 'medium':
      return 'var(--dt-colors-feedback-warning-default)';
    case 'low':
      return 'var(--dt-colors-feedback-info-default)';
  }
}

/**
 * Get icon for recommendation type
 */
export function getRecommendationIcon(type: RecommendationType): string {
  const iconMap: Record<RecommendationType, string> = {
    batch_size: 'layers',
    model_quantization: 'compress',
    semantic_cache: 'cache',
    provider_switch: 'redirect',
    prompt_optimization: 'edit',
    rate_limit_adjustment: 'speed',
    fallback_model: 'switch',
    cost_optimization: 'money',
    performance: 'speedometer',
    reliability: 'shield',
    security: 'lock',
    best_practice: 'lightbulb'
  };
  return iconMap[type] || 'lightbulb';
}

/**
 * Detect patterns in AI service data and generate recommendations
 */
function analyzePatterns(services: AIService[]): {
  recommendations: ArchitectRecommendation[];
  patterns: PatternAnalysis[];
} {
  const recommendations: ArchitectRecommendation[] = [];
  const patterns: PatternAnalysis[] = [];

  for (const service of services) {
    // Pattern 1: High latency services - suggest fallback or optimization
    if (service.avgLatency > 3000) {
      const rec: ArchitectRecommendation = {
        id: generateId(),
        type: 'fallback_model',
        severity: service.avgLatency > 5000 ? 'high' : 'medium',
        title: 'High Latency Detected',
        description: `Service "${service.serviceName}" using ${service.modelName} has average latency of ${service.avgLatency.toFixed(0)}ms. Consider using a faster model or implementing a fallback.`,
        affectedService: service.serviceName,
        estimatedImprovement: '40-60% latency reduction',
        actionable: true,
        workflowId: 'gcc-fallback-workflow'
      };
      recommendations.push(rec);
      patterns.push({
        pattern: 'high_latency',
        indicator: `${service.avgLatency.toFixed(0)}ms avg response time`,
        responseTime: service.avgLatency,
        recommendation: rec
      });
    }

    // Pattern 2: High error rate - suggest rate limiting or provider switch
    if (service.errorRate > 5) {
      const rec: ArchitectRecommendation = {
        id: generateId(),
        type: 'rate_limit_adjustment',
        severity: service.errorRate > 10 ? 'high' : 'medium',
        title: 'Elevated Error Rate',
        description: `Service "${service.serviceName}" has ${service.errorRate.toFixed(1)}% error rate. This may indicate rate limiting issues or provider problems.`,
        affectedService: service.serviceName,
        estimatedImprovement: 'Reduce errors by 80%+',
        actionable: true,
        workflowId: 'gcc-rate-limit-workflow'
      };
      recommendations.push(rec);
      patterns.push({
        pattern: 'high_error_rate',
        indicator: `${service.errorRate.toFixed(1)}% error rate`,
        recommendation: rec
      });
    }

    // Pattern 3: High token usage - suggest caching or prompt optimization
    if (service.totalTokens > 1_000_000) {
      const rec: ArchitectRecommendation = {
        id: generateId(),
        type: 'semantic_cache',
        severity: service.totalTokens > 10_000_000 ? 'high' : 'medium',
        title: 'High Token Consumption',
        description: `Service "${service.serviceName}" has consumed ${(service.totalTokens / 1_000_000).toFixed(2)}M tokens. Enable semantic caching to reduce redundant API calls.`,
        affectedService: service.serviceName,
        estimatedSavings: `$${(service.estimatedCost * 0.3).toFixed(2)}/day`,
        actionable: true,
        workflowId: 'gcc-cache-workflow'
      };
      recommendations.push(rec);
      patterns.push({
        pattern: 'high_token_usage',
        indicator: `${(service.totalTokens / 1_000_000).toFixed(2)}M tokens`,
        tokenThroughput: service.totalTokens,
        recommendation: rec
      });
    }

    // Pattern 4: Provider concentration risk
    const providerServices = services.filter(s => s.provider === service.provider);
    if (providerServices.length > 3 && service.provider !== 'local') {
      const existing = recommendations.find(
        r => r.type === 'provider_switch' && r.description.includes(service.provider)
      );
      if (!existing) {
        const rec: ArchitectRecommendation = {
          id: generateId(),
          type: 'provider_switch',
          severity: 'low',
          title: 'Provider Concentration Risk',
          description: `${providerServices.length} services depend on ${service.provider}. Consider diversifying across multiple providers for resilience.`,
          affectedService: `${providerServices.length} services`,
          estimatedImprovement: 'Improved reliability & availability',
          actionable: true,
          workflowId: 'gcc-provider-switch-workflow'
        };
        recommendations.push(rec);
        patterns.push({
          pattern: 'provider_concentration',
          indicator: `${providerServices.length} services on ${service.provider}`,
          recommendation: rec
        });
      }
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { recommendations, patterns };
}

/**
 * Hook for AI Architect pattern detection (Pillar B)
 */
export function useAIArchitect(services: AIService[]): UseAIArchitectResult {
  const [recommendations, setRecommendations] = useState<ArchitectRecommendation[]>([]);
  const [patterns, setPatterns] = useState<PatternAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const runAnalysis = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const result = analyzePatterns(services);
      setRecommendations(result.recommendations);
      setPatterns(result.patterns);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Analysis failed'));
      setIsLoading(false);
    }
  }, [services]);

  useEffect(() => {
    if (services.length > 0) {
      runAnalysis();
    } else {
      setIsLoading(false);
      setRecommendations([]);
      setPatterns([]);
    }
  }, [services, runAnalysis]);

  return {
    recommendations,
    patterns,
    isLoading,
    loading: isLoading,
    analyzing: isLoading,
    error,
    refreshAnalysis: runAnalysis
  };
}
