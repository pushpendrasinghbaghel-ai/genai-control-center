// Utility functions for GenAI Control Center

import type { AIService, HealthStatus, HealthMetrics } from '../types';

/**
 * Cost estimation based on provider and token count
 */
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'openai': { input: 0.01, output: 0.03 },
  'azure_openai': { input: 0.01, output: 0.03 },
  'anthropic': { input: 0.008, output: 0.024 },
  'google': { input: 0.0005, output: 0.0015 },
  'cohere': { input: 0.0004, output: 0.0004 },
  'local': { input: 0, output: 0 },
  'default': { input: 0.005, output: 0.015 }
};

/**
 * Estimate cost based on provider and token usage
 */
export function estimateCost(
  provider: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = COST_PER_1K_TOKENS[provider.toLowerCase()] || COST_PER_1K_TOKENS['default'];
  const inputCost = (promptTokens / 1000) * rates.input;
  const outputCost = (completionTokens / 1000) * rates.output;
  return inputCost + outputCost;
}

/**
 * Calculate health status based on metrics
 */
export function calculateHealthStatus(
  errorRate: number,
  latency: number,
  latencyThreshold: number = 3000
): HealthStatus {
  if (errorRate > 10 || latency > latencyThreshold * 2) {
    return 'critical';
  }
  if (errorRate > 5 || latency > latencyThreshold) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Calculate overall health metrics from service list
 */
export function calculateOverallHealth(services: AIService[]): HealthMetrics {
  const healthyCount = services.filter(s => s.healthStatus === 'healthy').length;
  const warningCount = services.filter(s => s.healthStatus === 'warning').length;
  const criticalCount = services.filter(s => s.healthStatus === 'critical').length;

  let overallHealth: HealthStatus = 'healthy';
  if (criticalCount > 0) {
    overallHealth = 'critical';
  } else if (warningCount > 0) {
    overallHealth = 'warning';
  }

  return {
    overallHealth,
    totalServices: services.length,
    healthyCount,
    warningCount,
    criticalCount,
    totalTokensToday: services.reduce((sum, s) => sum + s.totalTokens, 0),
    totalCostToday: services.reduce((sum, s) => sum + s.estimatedCost, 0),
    avgLatency: services.length > 0
      ? services.reduce((sum, s) => sum + s.avgLatency, 0) / services.length
      : 0,
    avgErrorRate: services.length > 0
      ? services.reduce((sum, s) => sum + s.errorRate, 0) / services.length
      : 0
  };
}

/**
 * Format large numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * Format latency from nanoseconds (DQL returns ns)
 */
export function formatLatencyFromNs(ns: number): string {
  const ms = ns / 1_000_000;
  return formatDuration(ms);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get color for health status (Strato design tokens)
 */
export function getHealthStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'var(--dt-colors-feedback-success-default)';
    case 'warning':
      return 'var(--dt-colors-feedback-warning-default)';
    case 'critical':
      return 'var(--dt-colors-feedback-critical-default)';
    default:
      return 'var(--dt-colors-text-neutral-default)';
  }
}

/**
 * Normalize provider name for consistent display
 */
export function normalizeProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    'openai': 'OpenAI',
    'azure_openai': 'Azure OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google AI',
    'cohere': 'Cohere',
    'huggingface': 'Hugging Face',
    'local': 'Local Model',
    'ollama': 'Ollama',
    'llama': 'Llama'
  };
  return providerMap[provider.toLowerCase()] || provider;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate time ago string
 */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
}
