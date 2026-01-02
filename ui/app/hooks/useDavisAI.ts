// Davis AI Integration Hook for GenAI Control Center

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type { ConversationMessage } from '../types';
import { generateId } from '../utils';

interface UseDavisAIResult {
  messages: ConversationMessage[];
  isLoading: boolean;
  error: Error | null;
  sendQuery: (query: string, context?: string) => Promise<void>;
  clearConversation: () => void;
}

/**
 * Pre-built investigation prompts for common AI issues
 */
export const INVESTIGATION_PROMPTS = {
  analyzeSpike: (serviceName: string) => 
    `Analyze the recent performance spike for service "${serviceName}". ` +
    `Look at traces, logs, and related errors. Identify the root cause and suggest remediation steps.`,
  
  correlate429Errors: (serviceName: string) => 
    `Investigate rate limiting (429) errors for service "${serviceName}". ` +
    `Correlate with Azure OpenAI or other LLM provider errors. Summarize the impact on users.`,
  
  analyzeLatency: (serviceName: string) =>
    `Analyze latency issues for AI service "${serviceName}". ` +
    `Check if the issue is related to model complexity, token count, or provider infrastructure. ` +
    `Provide recommendations for optimization.`,
  
  costAnalysis: (serviceName: string) =>
    `Analyze the token usage and cost patterns for service "${serviceName}". ` +
    `Identify any prompt bloat or inefficient API usage patterns. ` +
    `Suggest ways to reduce costs while maintaining quality.`,
  
  compareProviders: () =>
    `Compare all detected LLM providers in the environment. ` +
    `Analyze their performance, reliability, and cost-effectiveness. ` +
    `Recommend which provider is best suited for each use case.`,
  
  healthCheck: () =>
    `Perform a comprehensive health check on all AI/GenAI services. ` +
    `Identify any services with degraded performance or high error rates. ` +
    `Prioritize issues by business impact.`
};

/**
 * Analyze service data using DQL and generate insights
 */
async function analyzeWithDQL(query: string, serviceName?: string): Promise<string> {
  try {
    let dqlQuery = '';
    let analysis = '';

    // Build DQL query based on user intent
    if (query.toLowerCase().includes('health') || query.toLowerCase().includes('check')) {
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        | summarize {
            tokens = sum(gen_ai.usage.total_tokens),
            latency_ms = avg(duration) / 1000000,
            error_rate = countIf(status.code == "ERROR") / count() * 100,
            request_count = count()
          }, by: { service.name, gen_ai.model_name, gen_ai.system }
        | sort error_rate desc
        | limit 20
      `;
    } else if (query.toLowerCase().includes('cost')) {
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        | summarize {
            total_tokens = sum(gen_ai.usage.total_tokens),
            prompt_tokens = sum(gen_ai.usage.prompt_tokens),
            completion_tokens = sum(gen_ai.usage.completion_tokens)
          }, by: { service.name, gen_ai.system }
        | sort total_tokens desc
      `;
    } else if (query.toLowerCase().includes('latency') || query.toLowerCase().includes('slow')) {
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        ${serviceName ? `| filter service.name == "${serviceName}"` : ''}
        | summarize {
            avg_latency = avg(duration) / 1000000,
            p95_latency = percentile(duration, 95) / 1000000,
            p99_latency = percentile(duration, 99) / 1000000,
            slow_count = countIf(duration > 5000000000)
          }, by: { service.name, gen_ai.model_name }
        | sort p99_latency desc
      `;
    } else if (query.toLowerCase().includes('error') || query.toLowerCase().includes('429')) {
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        | filter status.code == "ERROR"
        ${serviceName ? `| filter service.name == "${serviceName}"` : ''}
        | summarize error_count = count(), by: { service.name, gen_ai.system, status.message }
        | sort error_count desc
        | limit 20
      `;
    } else if (query.toLowerCase().includes('provider') || query.toLowerCase().includes('compare')) {
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        | summarize {
            requests = count(),
            avg_latency = avg(duration) / 1000000,
            success_rate = countIf(status.code == "OK") / count() * 100,
            tokens = sum(gen_ai.usage.total_tokens)
          }, by: { gen_ai.system }
        | sort requests desc
      `;
    } else {
      // Default: general overview
      dqlQuery = `
        fetch spans
        | filter isNotNull(gen_ai.system)
        | summarize {
            tokens = sum(gen_ai.usage.total_tokens),
            latency = avg(duration) / 1000000,
            error_rate = countIf(status.code == "ERROR") / count() * 100,
            requests = count()
          }, by: { service.name, gen_ai.model_name }
        | sort tokens desc
        | limit 10
      `;
    }

    // Execute DQL query
    const response = await queryExecutionClient.queryExecute({
      body: {
        query: dqlQuery,
        requestTimeoutMilliseconds: 60000,
        fetchTimeoutSeconds: 60
      }
    });

    const records = response.result?.records || [];

    if (records.length === 0) {
      return `No data found for your query. Make sure your AI services are instrumented with OpenTelemetry gen_ai.* semantic conventions.`;
    }

    analysis = `## Analysis Results\n\nI found ${records.length} relevant data points.\n\n`;

    if (query.toLowerCase().includes('health')) {
      const critical = records.filter((r: any) => (r.error_rate || 0) > 5);
      const warning = records.filter((r: any) => (r.error_rate || 0) > 1 && (r.error_rate || 0) <= 5);
      
      analysis += `### Health Overview\n`;
      analysis += `- 🔴 **Critical issues**: ${critical.length} services with error rate > 5%\n`;
      analysis += `- 🟡 **Warnings**: ${warning.length} services with elevated error rates\n`;
      analysis += `- ✅ **Healthy**: ${records.length - critical.length - warning.length} services\n\n`;

      if (critical.length > 0) {
        analysis += `### Critical Services\n`;
        critical.forEach((r: any) => {
          analysis += `- **${r['service.name']}** (${r['gen_ai.model_name']}): ${(r.error_rate || 0).toFixed(1)}% error rate\n`;
        });
      }
    } else if (query.toLowerCase().includes('cost')) {
      let totalTokens = 0;
      records.forEach((r: any) => totalTokens += (r.total_tokens || 0));
      const estimatedCost = (totalTokens / 1000) * 0.01;
      
      analysis += `### Token Usage Summary\n`;
      analysis += `- **Total tokens**: ${totalTokens.toLocaleString()}\n`;
      analysis += `- **Estimated cost**: $${estimatedCost.toFixed(2)}\n\n`;
      analysis += `### By Service\n`;
      records.slice(0, 5).forEach((r: any) => {
        analysis += `- **${r['service.name']}**: ${(r.total_tokens || 0).toLocaleString()} tokens\n`;
      });
    } else if (query.toLowerCase().includes('provider') || query.toLowerCase().includes('compare')) {
      analysis += `### Provider Comparison\n\n`;
      records.forEach((r: any, i: number) => {
        analysis += `${i + 1}. **${r['gen_ai.system']}**\n`;
        analysis += `   - Requests: ${(r.requests || 0).toLocaleString()}\n`;
        analysis += `   - Avg Latency: ${(r.avg_latency || 0).toFixed(0)}ms\n`;
        analysis += `   - Success Rate: ${(r.success_rate || 0).toFixed(1)}%\n\n`;
      });
    } else {
      analysis += `### Service Data\n`;
      records.slice(0, 5).forEach((r: any) => {
        analysis += `- **${r['service.name']}** (${r['gen_ai.model_name'] || 'unknown'})\n`;
        if (r.tokens) analysis += `  - Tokens: ${(r.tokens || 0).toLocaleString()}\n`;
        if (r.latency) analysis += `  - Latency: ${(r.latency || 0).toFixed(0)}ms\n`;
        if (r.error_rate !== undefined) analysis += `  - Error Rate: ${(r.error_rate || 0).toFixed(1)}%\n`;
      });
    }

    return analysis;
  } catch (err) {
    throw new Error(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Hook for Davis AI CoPilot integration (Pillar C)
 */
export function useDavisAI(): UseDavisAIResult {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendQuery = useCallback(async (query: string, context?: string) => {
    const userMessageId = generateId();
    const userMessage: ConversationMessage = {
      id: userMessageId,
      type: 'user',
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    const loadingMessageId = generateId();
    setMessages(prev => [...prev, {
      id: loadingMessageId,
      type: 'davis',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }]);

    try {
      const serviceMatch = context?.match(/service[:\s]+["']?([^"'\n]+)["']?/i);
      const serviceName = serviceMatch ? serviceMatch[1] : undefined;

      const analysisResult = await analyzeWithDQL(query, serviceName);

      const davisResponse: ConversationMessage = {
        id: generateId(),
        type: 'davis',
        role: 'assistant',
        content: analysisResult,
        timestamp: new Date()
      };

      setMessages(prev => 
        prev.filter(m => m.id !== loadingMessageId).concat(davisResponse)
      );

    } catch (err) {
      const errorMessage: ConversationMessage = {
        id: generateId(),
        type: 'davis',
        role: 'assistant',
        content: `I encountered an error while analyzing your query: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };

      setMessages(prev => 
        prev.filter(m => m.id !== loadingMessageId).concat(errorMessage)
      );
      setError(err instanceof Error ? err : new Error('Analysis failed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendQuery,
    clearConversation
  };
}

/**
 * Hook for quick Davis investigations
 */
export function useDavisInvestigation() {
  const { sendQuery, isLoading, ...rest } = useDavisAI();

  const investigateSpike = useCallback((serviceName: string) => {
    return sendQuery(INVESTIGATION_PROMPTS.analyzeSpike(serviceName), `service: ${serviceName}`);
  }, [sendQuery]);

  const investigateRateLimits = useCallback((serviceName: string) => {
    return sendQuery(INVESTIGATION_PROMPTS.correlate429Errors(serviceName), `service: ${serviceName}`);
  }, [sendQuery]);

  const investigateLatency = useCallback((serviceName: string) => {
    return sendQuery(INVESTIGATION_PROMPTS.analyzeLatency(serviceName), `service: ${serviceName}`);
  }, [sendQuery]);

  const analyzeCosts = useCallback((serviceName: string) => {
    return sendQuery(INVESTIGATION_PROMPTS.costAnalysis(serviceName), `service: ${serviceName}`);
  }, [sendQuery]);

  const compareProviders = useCallback(() => {
    return sendQuery(INVESTIGATION_PROMPTS.compareProviders());
  }, [sendQuery]);

  const runHealthCheck = useCallback(() => {
    return sendQuery(INVESTIGATION_PROMPTS.healthCheck());
  }, [sendQuery]);

  return {
    ...rest,
    isLoading,
    isProcessing: isLoading,
    sendQuery,
    sendMessage: sendQuery,
    investigateSpike,
    investigateRateLimits,
    investigateLatency,
    analyzeCosts,
    compareProviders,
    runHealthCheck
  };
}
