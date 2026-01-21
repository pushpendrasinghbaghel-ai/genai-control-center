// Utility functions for GenAI Control Center

import type { AIService, HealthStatus, HealthMetrics } from '../types';

/**
 * Cost estimation based on provider and token count
 */
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  openai: { input: 0.01, output: 0.03 },
  azure_openai: { input: 0.01, output: 0.03 },
  azure: { input: 0.01, output: 0.03 },
  anthropic: { input: 0.008, output: 0.024 },
  google: { input: 0.0005, output: 0.0015 },
  vertexai: { input: 0.00025, output: 0.0005 },
  amazon: { input: 0.0008, output: 0.0024 },
  amazon_bedrock: { input: 0.0008, output: 0.0024 },
  cohere: { input: 0.0004, output: 0.0004 },
  local: { input: 0, output: 0 },
  ollama: { input: 0, output: 0 },
  langchain: { input: 0.005, output: 0.015 },
  default: { input: 0.005, output: 0.015 }
};

/**
 * Estimate cost based on provider and token usage
 */
export function estimateCost(
  provider: string,
  promptTokens: number,
  completionTokens: number
): number {
  const normalizedProvider = provider?.toLowerCase().trim() || 'default';
  const rates = COST_PER_1K_TOKENS[normalizedProvider] || COST_PER_1K_TOKENS.default;
  const inputCost = (promptTokens / 1000) * rates.input;
  const outputCost = (completionTokens / 1000) * rates.output;
  return inputCost + outputCost;
}

/**
 * Calculate health status based on metrics
 * Enhanced for GenAI with quality metrics:
 * - errorRate: Traditional span errors
 * - slowRequestRate: % of requests > 3 seconds (GenAI typical: <5% good, 5-10% warning, >10% critical)
 * - lowOutputRate: % of responses with minimal tokens (potential failures)
 */
export function calculateHealthStatus(
  errorRate: number,
  latency: number,
  slowRequestRate: number = 0,
  lowOutputRate: number = 0,
  latencyThreshold: number = 3000
): HealthStatus {
  // Calculate a combined "issue rate" for GenAI-specific problems
  // Weight: errors most severe, slow requests moderate, low output minor
  const issueScore = errorRate * 2 + slowRequestRate * 1 + lowOutputRate * 0.5;
  
  if (errorRate > 10 || latency > latencyThreshold * 2 || issueScore > 30) {
    return 'critical';
  }
  if (errorRate > 5 || latency > latencyThreshold || issueScore > 15 || slowRequestRate > 20) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Calculate overall health metrics from service list
 * Enhanced with GenAI quality metrics
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
      : 0,
    avgSlowRequestRate: services.length > 0
      ? services.reduce((sum, s) => sum + (s.slowRequestRate || 0), 0) / services.length
      : 0,
    avgLowOutputRate: services.length > 0
      ? services.reduce((sum, s) => sum + (s.lowOutputRate || 0), 0) / services.length
      : 0
  };
}

/**
 * Format large numbers for display
 */
export function formatNumber(num: number | string | null | undefined): string {
  const n = Number(num);
  if (isNaN(n) || num === null || num === undefined) {
    return '0';
  }
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return n.toFixed(2);
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number | string | null | undefined): string {
  const n = Number(ms);
  if (isNaN(n) || ms === null || ms === undefined) {
    return '0ms';
  }
  if (n < 1000) {
    return `${n.toFixed(0)}ms`;
  }
  if (n < 60000) {
    return `${(n / 1000).toFixed(2)}s`;
  }
  return `${(n / 60000).toFixed(2)}min`;
}

/**
 * Format latency from nanoseconds (DQL returns ns)
 */
export function formatLatencyFromNs(ns: number | string | null | undefined): string {
  const n = Number(ns);
  if (isNaN(n) || ns === null || ns === undefined) {
    return '0ms';
  }
  const ms = n / 1_000_000;
  return formatDuration(ms);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = 'USD'): string {
  const n = Number(amount);
  if (isNaN(n) || amount === null || amount === undefined) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(n);
}

/**
 * Format cost per 1K requests (industry standard pricing format)
 * Shows cost scaled to per 1,000 requests for readability
 */
export function formatCostPer1K(totalCost: number, totalRequests: number): string {
  if (totalRequests === 0) return '$0.00 / 1K req';
  const costPer1K = (totalCost / totalRequests) * 1000;
  if (costPer1K < 0.01) {
    return `$${costPer1K.toFixed(4)} / 1K req`;
  }
  return `$${costPer1K.toFixed(2)} / 1K req`;
}

/**
 * Format large numbers to readable format (K, M, B, T, Q)
 * Handles very large numbers including quadrillions
 */
export function formatRequestCount(count: number | string | null | undefined): string {
  if (count === null || count === undefined) {
    return '0';
  }
  
  // Parse the number, handling potential string inputs
  let n: number;
  if (typeof count === 'string') {
    // Remove any commas or whitespace
    n = parseFloat(count.replace(/[,\s]/g, ''));
  } else {
    n = Number(count);
  }
  
  if (isNaN(n) || n === 0) {
    return '0';
  }
  
  // Use absolute value for formatting, preserve sign
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  
  // Quadrillion (10^15)
  if (absN >= 1e15) {
    return `${sign}${(absN / 1e15).toFixed(1)}Q`;
  }
  // Trillion (10^12)
  if (absN >= 1e12) {
    return `${sign}${(absN / 1e12).toFixed(1)}T`;
  }
  // Billion (10^9)
  if (absN >= 1e9) {
    return `${sign}${(absN / 1e9).toFixed(1)}B`;
  }
  // Million (10^6)
  if (absN >= 1e6) {
    return `${sign}${(absN / 1e6).toFixed(1)}M`;
  }
  // Thousand (10^3)
  if (absN >= 1e3) {
    return `${sign}${(absN / 1e3).toFixed(1)}K`;
  }
  return n.toLocaleString();
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
