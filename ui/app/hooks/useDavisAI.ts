// Davis AI Integration Hook for GenAI Control Center
// Using real Davis CoPilot SDK for natural language processing

import { useState, useCallback, useRef } from 'react';
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
 * Davis AI Prompt Risk Score result
 */
export interface DavisPromptScore {
  promptId: string;
  riskScore: number;  // 0-100
  category: 'pii' | 'injection' | 'sensitive' | 'bias' | 'hallucination' | 'safe';
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  recommendations: string[];
  confidence: number;  // 0-1
}

/**
 * Batch scoring result
 */
export interface DavisPromptScoreBatch {
  scores: DavisPromptScore[];
  summary: {
    totalAnalyzed: number;
    avgRiskScore: number;
    highRiskCount: number;
    topCategories: { category: string; count: number }[];
  };
  isLoading: boolean;
  error: Error | null;
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
      ? `For GenAI service "${serviceName}": ${query}. Focus on gen_ai spans with OpenTelemetry semantic conventions (gen_ai.provider.name, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model).`
      : `For GenAI/AI observability: ${query}. Query gen_ai spans using OpenTelemetry semantic conventions (gen_ai.provider.name, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model).`;

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
/**
 * Use Davis CoPilot to analyze ALL prompts in a SINGLE API call
 * This avoids rate limiting by sending one comprehensive request
 */
async function scorePromptsBatchWithDavis(
  prompts: Array<{
    id: string;
    content: string;
    completion?: string;
    serviceName?: string;
    model?: string;
    provider?: string;
  }>
): Promise<DavisPromptScore[]> {
  if (!prompts || prompts.length === 0) {
    return [];
  }

  // Prepare prompt summaries for batch analysis (limit content size to avoid token limits)
  const promptSummaries = prompts.map((p, idx) => {
    const truncatedContent = p.content.substring(0, 300).replace(/\n/g, ' ').trim();
    return `[${idx + 1}] ID:${p.id} | Service:${p.serviceName || 'N/A'} | Model:${p.model || 'N/A'}
Content: "${truncatedContent}${p.content.length > 300 ? '...' : ''}"`;
  }).join('\n\n');

  const batchAnalysisPrompt = `You are a GenAI security analyst. Analyze these ${prompts.length} prompts for governance risks.

PROMPTS TO ANALYZE:
${promptSummaries}

For EACH prompt, classify into ONE category:
- pii: Contains SSN, credit card, email, phone, DOB, medical records
- injection: Prompt injection attempts (ignore instructions, jailbreak, role override)
- sensitive: Passwords, API keys, tokens, internal data
- bias: Discrimination risk in HR/hiring/evaluation contexts
- hallucination: Requests for real-time/factual data without grounding
- safe: No significant risks detected

Respond with a JSON array. Each object must have:
- "idx": prompt number (1-${prompts.length})
- "category": one of the categories above
- "riskScore": 0-100
- "severity": "low"|"medium"|"high"|"critical"
- "reason": brief explanation (10 words max)

Response format (JSON only, no markdown):
[{"idx":1,"category":"safe","riskScore":5,"severity":"low","reason":"No issues detected"},{"idx":2,"category":"pii","riskScore":65,"severity":"high","reason":"Contains email addresses"}]`;

  try {
    const response = await publicClient.recommenderConversation({
      body: {
        text: batchAnalysisPrompt,
        context: [
          {
            type: 'supplementary',
            value: 'Respond ONLY with valid JSON array. No explanations, no markdown code blocks. Just the raw JSON array.'
          }
        ]
      }
    });

    // Parse response
    let responseText = '';
    if (Array.isArray(response)) {
      for (const event of response) {
        if ('data' in event) {
          if ('tokens' in (event.data || {})) {
            responseText += ((event.data as { tokens?: string[] }).tokens || []).join('');
          } else if ('answer' in (event.data || {})) {
            responseText = (event.data as { answer?: string }).answer || '';
          }
        }
      }
    } else {
      responseText = response.text || '';
    }

    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]) as Array<{
          idx: number;
          category: string;
          riskScore: number;
          severity: string;
          reason: string;
        }>;

        // Map parsed results back to prompts
        const results: DavisPromptScore[] = prompts.map((prompt, idx) => {
          const match = parsed.find(p => p.idx === idx + 1);
          if (match) {
            return {
              promptId: prompt.id,
              riskScore: Math.min(100, Math.max(0, Number(match.riskScore) || 0)),
              category: (match.category as DavisPromptScore['category']) || 'safe',
              severity: (match.severity as DavisPromptScore['severity']) || 'low',
              explanation: match.reason || 'Analyzed by Davis AI',
              recommendations: [],
              confidence: 0.85
            };
          }
          // Fallback for prompts not in response
          return analyzePromptFallback(prompt.id, prompt.content);
        });

        return results;
      } catch (parseErr) {
        console.error('[DavisAI] Failed to parse batch response JSON:', parseErr);
      }
    }

    // JSON parsing failed - use fallback for all
    console.warn('[DavisAI] Batch response not parseable, using fallback analysis');
    return prompts.map(p => analyzePromptFallback(p.id, p.content));

  } catch (err) {
    console.error('[DavisAI] Batch scoring failed:', err);
    // Return fallback analysis for all prompts
    return prompts.map(p => analyzePromptFallback(p.id, p.content));
  }
}

// ============================================
// NOTE: LLM-AS-JUDGE HALLUCINATION DETECTION REMOVED
// ============================================
// The Davis CoPilot LLM-as-Judge approach was removed because:
// 1. Davis isn't designed for fact-checking - it's for NL2DQL/DQL2NL
// 2. Using AI to judge AI hallucinations is circular and unreliable
// 3. Without external knowledge bases, no LLM can verify facts
// 4. High latency/cost for questionable value
//
// For hallucination detection, use:
// - RAG Grounding Score (compare response to provided context)
// - External fact-checking APIs (Wikipedia, search engines)
// - Human review for critical content
// ============================================

/**
 * Use Davis CoPilot to analyze and score a single prompt for risk
 * This provides AI-powered analysis beyond simple regex patterns
 */
async function scorePromptWithDavis(
  promptId: string,
  promptContent: string,
  completionContent?: string,
  context?: { serviceName?: string; model?: string; provider?: string }
): Promise<DavisPromptScore> {
  const defaultScore: DavisPromptScore = {
    promptId,
    riskScore: 0,
    category: 'safe',
    severity: 'low',
    explanation: 'Unable to analyze prompt',
    recommendations: [],
    confidence: 0
  };

  if (!promptContent || promptContent.trim().length === 0) {
    return { ...defaultScore, explanation: 'Empty prompt content' };
  }

  try {
    // Build analysis request for Davis CoPilot
    const analysisPrompt = `Analyze this GenAI prompt for security and governance risks.

PROMPT TO ANALYZE:
"""
${promptContent.substring(0, 2000)}
"""
${completionContent ? `\nMODEL RESPONSE:\n"""\n${completionContent.substring(0, 1000)}\n"""` : ''}

Context: Service=${context?.serviceName || 'Unknown'}, Model=${context?.model || 'Unknown'}, Provider=${context?.provider || 'Unknown'}

Evaluate for these risk categories:
1. PII (Personal Identifiable Information): SSN, credit cards, emails, phone numbers, addresses, medical records
2. Prompt Injection: Attempts to override instructions, jailbreaks, role-playing attacks
3. Sensitive Data: Passwords, API keys, tokens, internal company data
4. Bias: Gender, race, age discrimination, especially in HR/hiring contexts
5. Hallucination Risk: Requests for real-time data, factual claims without sources

Respond in this exact JSON format:
{
  "riskScore": <0-100>,
  "category": "<pii|injection|sensitive|bias|hallucination|safe>",
  "severity": "<low|medium|high|critical>",
  "explanation": "<one sentence explanation>",
  "recommendations": ["<action 1>", "<action 2>"],
  "confidence": <0.0-1.0>
}`;

    const response = await publicClient.recommenderConversation({
      body: {
        text: analysisPrompt,
        context: [
          {
            type: 'supplementary',
            value: 'You are a security analyst specializing in GenAI/LLM prompt governance. Be concise and precise in your JSON response.'
          }
        ]
      }
    });

    // Parse response - handle both streaming and non-streaming
    let responseText = '';
    if (Array.isArray(response)) {
      for (const event of response) {
        if ('data' in event) {
          if ('tokens' in (event.data || {})) {
            responseText += ((event.data as { tokens?: string[] }).tokens || []).join('');
          } else if ('answer' in (event.data || {})) {
            responseText = (event.data as { answer?: string }).answer || '';
          }
        }
      }
    } else {
      responseText = response.text || '';
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          promptId,
          riskScore: Math.min(100, Math.max(0, Number(parsed.riskScore) || 0)),
          category: parsed.category || 'safe',
          severity: parsed.severity || 'low',
          explanation: parsed.explanation || 'Analysis complete',
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5))
        };
      } catch {
        // JSON parse failed, fall back to regex-based scoring
      }
    }

    // Fallback: Use keyword analysis if Davis response wasn't parseable
    return analyzePromptFallback(promptId, promptContent);

  } catch (err) {
    console.error('[DavisAI] Prompt scoring failed:', err);
    // Return fallback analysis
    return analyzePromptFallback(promptId, promptContent);
  }
}

/**
 * Fallback prompt analysis using enhanced regex patterns
 * Used when Davis CoPilot is unavailable
 */
function analyzePromptFallback(promptId: string, promptContent: string): DavisPromptScore {
  const content = promptContent.toLowerCase();
  let riskScore = 0;
  let category: DavisPromptScore['category'] = 'safe';
  let severity: DavisPromptScore['severity'] = 'low';
  const recommendations: string[] = [];
  const findings: string[] = [];

  // PII Detection - high priority
  const piiPatterns = [
    { pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, name: 'SSN', score: 40 },
    { pattern: /\b\d{4}[-. ]?\d{4}[-. ]?\d{4}[-. ]?\d{4}\b/, name: 'Credit Card', score: 45 },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, name: 'Email', score: 25 },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, name: 'Phone', score: 20 },
    { pattern: /\b(dob|date of birth|birthdate)\s*[:=]?\s*\d/i, name: 'DOB', score: 35 },
    { pattern: /\b(mrn|medical record|patient id)\s*[:=]?\s*\d/i, name: 'Medical ID', score: 40 },
  ];

  for (const { pattern, name, score } of piiPatterns) {
    if (pattern.test(promptContent)) {
      riskScore += score;
      category = 'pii';
      findings.push(`${name} detected`);
      recommendations.push(`Remove or mask ${name} before sending to LLM`);
    }
  }

  // Injection Detection
  const injectionPatterns = [
    'ignore all previous', 'ignore previous instructions', 'disregard your instructions',
    'forget your rules', 'you are now', 'new persona', 'jailbreak', 'dan mode', 'developer mode'
  ];
  for (const pattern of injectionPatterns) {
    if (content.includes(pattern)) {
      riskScore += 50;
      category = 'injection';
      findings.push('Prompt injection attempt');
      recommendations.push('Block this request and alert security team');
      break;
    }
  }

  // Sensitive Data
  const sensitivePatterns = ['password', 'api key', 'secret key', 'access token', 'private key'];
  for (const pattern of sensitivePatterns) {
    if (content.includes(pattern)) {
      riskScore += 30;
      if (category === 'safe') category = 'sensitive';
      findings.push('Sensitive data keywords detected');
      recommendations.push('Ensure credentials are not being exposed to LLM');
      break;
    }
  }

  // Bias Risk (HR/hiring context)
  if ((content.includes('candidate') || content.includes('resume') || content.includes('hire')) &&
      (content.includes('age') || content.includes('gender') || content.includes('race') || 
       content.includes('nationality') || content.includes('religion'))) {
    riskScore += 35;
    if (category === 'safe') category = 'bias';
    findings.push('Protected characteristics in hiring context');
    recommendations.push('Review for potential discrimination bias');
  }

  // Determine severity based on score
  if (riskScore >= 70) severity = 'critical';
  else if (riskScore >= 50) severity = 'high';
  else if (riskScore >= 25) severity = 'medium';
  else severity = 'low';

  return {
    promptId,
    riskScore: Math.min(100, riskScore),
    category,
    severity,
    explanation: findings.length > 0 ? findings.join('; ') : 'No significant risks detected',
    recommendations,
    confidence: 0.7  // Regex-based analysis has lower confidence
  };
}

/**
 * Hook for Davis AI-powered prompt scoring
 * Analyzes prompts in batches for governance dashboard
 */
export function useDavisPromptScoring() {
  const [scores, setScores] = useState<DavisPromptScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  /**
   * Score a single prompt with Davis AI
   */
  const scorePrompt = useCallback(async (
    promptId: string,
    promptContent: string,
    completionContent?: string,
    context?: { serviceName?: string; model?: string; provider?: string }
  ): Promise<DavisPromptScore> => {
    return scorePromptWithDavis(promptId, promptContent, completionContent, context);
  }, []);

  /**
   * Score multiple prompts in a SINGLE batch API call
   * Dramatically reduces API calls - sends ALL prompts to Davis at once
   * Falls back to chunk-based processing only for very large batches (>25 prompts)
   */
  const scorePromptBatch = useCallback(async (
    prompts: Array<{
      id: string;
      content: string;
      completion?: string;
      serviceName?: string;
      model?: string;
      provider?: string;
    }>,
    options?: { maxBatchSize?: number }
  ): Promise<DavisPromptScore[]> => {
    // Max prompts per single API call (to stay within token limits)
    const MAX_BATCH_SIZE = options?.maxBatchSize || 25;
    
    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: prompts.length });
    abortRef.current = false;

    const allResults: DavisPromptScore[] = [];

    try {
      // Split into chunks if needed, but each chunk = 1 API call
      const chunks: typeof prompts[] = [];
      for (let i = 0; i < prompts.length; i += MAX_BATCH_SIZE) {
        chunks.push(prompts.slice(i, i + MAX_BATCH_SIZE));
      }

      console.log(`[DavisAI] Scoring ${prompts.length} prompts in ${chunks.length} API call(s)`);

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        if (abortRef.current) break;

        const chunk = chunks[chunkIdx];
        
        // SINGLE API CALL for entire chunk
        const chunkResults = await scorePromptsBatchWithDavis(chunk);
        
        allResults.push(...chunkResults);
        setProgress({ 
          current: Math.min((chunkIdx + 1) * MAX_BATCH_SIZE, prompts.length), 
          total: prompts.length 
        });
        setScores([...allResults]);

        // Small delay between chunks if multiple
        if (chunkIdx < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[DavisAI] Completed scoring - ${allResults.length} results`);
      return allResults;

    } catch (err) {
      console.error('[DavisAI] Batch scoring error:', err);
      setError(err instanceof Error ? err : new Error('Batch scoring failed'));
      
      // Fallback: use local regex analysis for remaining prompts
      const remaining = prompts.slice(allResults.length);
      const fallbackResults = remaining.map(p => analyzePromptFallback(p.id, p.content));
      allResults.push(...fallbackResults);
      setScores([...allResults]);
      
      return allResults;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Cancel ongoing batch scoring
   */
  const cancelScoring = useCallback(() => {
    abortRef.current = true;
  }, []);

  /**
   * Get summary statistics from scored prompts
   */
  const getSummary = useCallback(() => {
    if (scores.length === 0) {
      return {
        totalAnalyzed: 0,
        avgRiskScore: 0,
        highRiskCount: 0,
        criticalCount: 0,
        topCategories: []
      };
    }

    const categoryCount = new Map<string, number>();
    let totalRisk = 0;
    let highRiskCount = 0;
    let criticalCount = 0;

    for (const score of scores) {
      totalRisk += score.riskScore;
      if (score.severity === 'high' || score.severity === 'critical') highRiskCount++;
      if (score.severity === 'critical') criticalCount++;
      categoryCount.set(score.category, (categoryCount.get(score.category) || 0) + 1);
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAnalyzed: scores.length,
      avgRiskScore: Math.round(totalRisk / scores.length),
      highRiskCount,
      criticalCount,
      topCategories
    };
  }, [scores]);

  /**
   * Clear all scores
   */
  const clearScores = useCallback(() => {
    setScores([]);
    setError(null);
    setProgress({ current: 0, total: 0 });
  }, []);

  return {
    scores,
    isLoading,
    error,
    progress,
    scorePrompt,
    scorePromptBatch,
    cancelScoring,
    getSummary,
    clearScores
  };
}

/**
 * Davis AI Risk Analysis Prompts for Governance
 */
export const GOVERNANCE_ANALYSIS_PROMPTS = {
  analyzePromptRisk: (promptSample: string) =>
    `Analyze this GenAI prompt for security risks, PII exposure, and governance violations:\n\n"${promptSample}"\n\nProvide a risk score (0-100) and specific recommendations.`,
  
  summarizeRiskTrends: () =>
    `Analyze the prompt risk trends across all GenAI services. Identify patterns in PII exposure, injection attempts, and policy violations. Provide actionable governance recommendations.`,
  
  benchmarkCompliance: () =>
    `Compare our GenAI usage against industry compliance standards (SOC2, HIPAA, GDPR). Identify gaps and prioritize remediation actions.`,
  
  predictRiskHotspots: () =>
    `Based on current prompt patterns, predict which services or models are most likely to have governance issues. Recommend proactive controls.`
};