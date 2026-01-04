// Davis AI Integration Hook for GenAI Control Center
// Using real Davis CoPilot SDK for natural language processing

import { useState, useCallback } from 'react';
import { publicClient } from '@dynatrace-sdk/client-davis-copilot';
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
 * Analyze query using Davis CoPilot NL2DQL to generate DQL from natural language
 * Then execute the DQL and explain results using DQL2NL
 */
async function analyzeWithDavisCoPilot(query: string, serviceName?: string): Promise<string> {
  try {
    // Add context about GenAI monitoring to help Davis understand
    const enhancedQuery = serviceName 
      ? `For GenAI service "${serviceName}": ${query}. Focus on gen_ai spans with OpenTelemetry semantic conventions (gen_ai.usage.total_tokens, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model, gen_ai.system).`
      : `For GenAI/AI observability: ${query}. Query gen_ai spans using OpenTelemetry semantic conventions (gen_ai.usage.total_tokens, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model, gen_ai.system).`;

    // Step 1: Use Davis CoPilot NL2DQL to convert natural language to DQL
    const nl2dqlResponse = await publicClient.nl2dql({
      body: {
        text: enhancedQuery
      }
    });

    if (nl2dqlResponse.status === 'FAILED') {
      // Fall back to conversation mode if DQL generation fails
      return await askDavisCoPilotConversation(query, serviceName);
    }

    const generatedDQL = nl2dqlResponse.dql;

    // Step 2: Execute the generated DQL
    let queryResult;
    try {
      queryResult = await queryExecutionClient.queryExecute({
        body: {
          query: generatedDQL,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });
    } catch (queryError) {
      // If query fails, provide the DQL and explain what was attempted
      return `## Davis CoPilot Analysis\n\n` +
        `I generated the following DQL query based on your request:\n\n` +
        `\`\`\`\n${generatedDQL}\n\`\`\`\n\n` +
        `However, the query couldn't be executed. This might be because:\n` +
        `- No gen_ai spans are being ingested yet\n` +
        `- The attribute names differ from standard OpenTelemetry semantic conventions\n\n` +
        `**Suggestion**: Ensure your AI services are instrumented with OpenTelemetry gen_ai.* attributes.`;
    }

    const records = queryResult.result?.records || [];

    // Step 3: Use Davis CoPilot DQL2NL to explain the query
    let explanation = '';
    try {
      const dql2nlResponse = await publicClient.dql2nl({
        body: {
          dql: generatedDQL
        }
      });
      explanation = dql2nlResponse.explanation || dql2nlResponse.summary || '';
    } catch {
      // Explanation is optional, continue without it
    }

    // Step 4: Format the results
    let analysis = `## Davis CoPilot Analysis\n\n`;
    
    if (explanation) {
      analysis += `**Query Explanation**: ${explanation}\n\n`;
    }

    analysis += `**Generated DQL**:\n\`\`\`\n${generatedDQL}\n\`\`\`\n\n`;

    if (records.length === 0) {
      analysis += `No data found. Ensure your AI services are instrumented with OpenTelemetry gen_ai.* semantic conventions.\n`;
    } else {
      analysis += `### Results (${records.length} records)\n\n`;
      
      // Create a formatted table-like output
      const firstRecord = records[0] as Record<string, unknown>;
      const keys = Object.keys(firstRecord).filter(k => firstRecord[k] !== null && firstRecord[k] !== undefined);
      
      // Show up to 10 records in a readable format
      records.slice(0, 10).forEach((record: unknown, index: number) => {
        const rec = record as Record<string, unknown>;
        analysis += `**${index + 1}.** `;
        
        // Try to find a name/identifier field
        const nameField = keys.find(k => k.includes('name') || k.includes('service') || k.includes('model'));
        if (nameField && rec[nameField]) {
          analysis += `**${rec[nameField]}**\n`;
        } else {
          analysis += `Record ${index + 1}\n`;
        }
        
        keys.forEach(key => {
          if (key !== nameField && rec[key] !== null && rec[key] !== undefined) {
            const value = rec[key];
            const formattedValue = typeof value === 'number' 
              ? (Number.isInteger(value) ? value.toLocaleString() : (value as number).toFixed(2))
              : String(value);
            analysis += `   - ${key}: ${formattedValue}\n`;
          }
        });
        analysis += '\n';
      });

      if (records.length > 10) {
        analysis += `*...and ${records.length - 10} more records*\n`;
      }
    }

    return analysis;

  } catch (err) {
    // If Davis CoPilot SDK fails, try fallback to conversation
    console.error('Davis CoPilot NL2DQL failed, trying conversation mode:', err);
    return await askDavisCoPilotConversation(query, serviceName);
  }
}

/**
 * Use Davis CoPilot Conversation Recommender for general questions
 */
async function askDavisCoPilotConversation(query: string, serviceName?: string): Promise<string> {
  try {
    const contextText = serviceName 
      ? `I'm analyzing GenAI service "${serviceName}" in Dynatrace. Using OpenTelemetry gen_ai semantic conventions for AI observability.`
      : `I'm working with GenAI observability in Dynatrace. Looking at AI services instrumented with OpenTelemetry gen_ai semantic conventions.`;

    const response = await publicClient.recommenderConversation({
      body: {
        text: query,
        context: [
          {
            type: 'supplementary',
            value: contextText
          }
        ]
      }
    });

    // Handle both streaming and non-streaming responses
    if (Array.isArray(response)) {
      // Streaming response - collect tokens
      const tokens: string[] = [];
      for (const event of response) {
        if ('data' in event) {
          if ('tokens' in (event.data || {})) {
            tokens.push(...((event.data as { tokens?: string[] }).tokens || []));
          } else if ('answer' in (event.data || {})) {
            return `## Davis CoPilot Response\n\n${(event.data as { answer?: string }).answer}`;
          }
        }
      }
      if (tokens.length > 0) {
        return `## Davis CoPilot Response\n\n${tokens.join('')}`;
      }
    } else {
      // Non-streaming response
      return `## Davis CoPilot Response\n\n${response.text}`;
    }

    return `Davis CoPilot couldn't generate a response for this query. Try rephrasing your question.`;

  } catch (err) {
    throw new Error(`Davis CoPilot conversation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

      const analysisResult = await analyzeWithDavisCoPilot(query, serviceName);

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
