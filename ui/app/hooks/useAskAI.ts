// Ask Dynatrace Intelligence Assist Hook
// Contextual AI assistant that enriches Davis AI queries with page/item-specific context
// Primary: Streaming conversation (tokens appear live) | Fallback: Non-streaming JSON

import { useState, useCallback, useRef } from 'react';
import { publicClient } from '@dynatrace-sdk/client-davis-copilot';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export interface AskAIContext {
  /** Page or section the query originates from */
  domain: string;
  /** Specific item label (e.g. provider name, model name) */
  itemLabel?: string;
  /** Structured data snapshot for the item */
  data?: Record<string, string | number | boolean | null>;
  /** Pre-built suggested prompts shown as chips */
  suggestedPrompts?: string[];
}

export interface AskAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  /** True while streaming tokens are still arriving */
  isStreaming?: boolean;
}

interface UseAskAIResult {
  messages: AskAIMessage[];
  isLoading: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
  clearMessages: () => void;
}

function buildContextPrefix(ctx: AskAIContext): string {
  const parts: string[] = [`Domain: ${ctx.domain}`];
  if (ctx.itemLabel) parts.push(`Item: ${ctx.itemLabel}`);
  if (ctx.data) {
    const entries = Object.entries(ctx.data)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : (v as number).toFixed(2)) : v}`);
    if (entries.length) parts.push(`Data — ${entries.join(', ')}`);
  }
  return parts.join(' | ');
}

let counter = 0;
function nextId(): string {
  return `ask-ai-${Date.now()}-${++counter}`;
}

type MessageUpdater = React.Dispatch<React.SetStateAction<AskAIMessage[]>>;

/**
 * Contextual "Ask AI" hook.
 * Uses streaming Davis CoPilot conversation for progressive token display.
 * Falls back to NL2DQL → execute → explain for data queries.
 */
export function useAskAI(context: AskAIContext): UseAskAIResult {
  const [messages, setMessages] = useState<AskAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const ask = useCallback(async (question: string) => {
    const ctx = contextRef.current;
    const userMsg: AskAIMessage = { id: nextId(), role: 'user', content: question, timestamp: new Date() };
    const assistantId = nextId();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true, isStreaming: true }]);
    setIsLoading(true);
    setError(null);

    try {
      const contextPrefix = buildContextPrefix(ctx);
      const enhancedQuery =
        `Context: ${contextPrefix}.\n` +
        `For GenAI/AI observability using OpenTelemetry gen_ai semantic conventions ` +
        `(gen_ai.provider.name, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model).\n` +
        `User question: ${question}`;

      // Primary: Streaming conversation — tokens appear live
      const streamed = await streamConversation(enhancedQuery, assistantId, setMessages);

      if (!streamed) {
        // Fallback: NL2DQL pipeline
        const answer = await nl2dqlPipeline(enhancedQuery);
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: answer, isLoading: false, isStreaming: false } : m
        ));
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error';
      const isTransient = /technical error|try again|timeout|unavailable|ECONNREFUSED/i.test(raw);
      const friendly = isTransient
        ? 'Dynatrace Intelligence is temporarily unavailable. This is usually a transient issue — please try again in a moment.'
        : `Something went wrong: ${raw}`;
      setError(friendly);
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: friendly, isLoading: false, isStreaming: false } : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, ask, clearMessages };
}

// ── helpers ──

/**
 * Primary: Streaming conversation via Davis CoPilot.
 * Progressively updates the assistant message as tokens arrive.
 * Returns true if streaming succeeded, false to trigger fallback.
 */
async function streamConversation(
  query: string,
  assistantId: string,
  setMessages: MessageUpdater,
): Promise<boolean> {
  try {
    const res = await publicClient.recommenderConversation({
      body: {
        text: query,
        context: [
          { type: 'supplementary', value: 'GenAI observability using OpenTelemetry gen_ai semantic conventions in Dynatrace. Attributes: gen_ai.provider.name, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model, gen_ai.response.finish_reason.' },
          { type: 'instruction', value: 'Answer with clear markdown formatting: use headings (##), bold (**), bullet points (-), and code blocks (```) for DQL. Be concise and actionable.' },
        ],
      },
    });

    // Streaming response — array of events
    if (Array.isArray(res)) {
      let accumulated = '';
      let gotTokens = false;

      for (const event of res) {
        const ev = event as { event?: string; data?: { tokens?: string[]; answer?: string } };

        // TokensEvent — append tokens progressively
        if (ev.data?.tokens && ev.data.tokens.length > 0) {
          gotTokens = true;
          accumulated += ev.data.tokens.join('');
          const content = accumulated;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: `## Dynatrace Intelligence Response\n\n${content}`, isLoading: false, isStreaming: true } : m
          ));
        }

        // EndEvent — final answer (overrides accumulated tokens)
        if (ev.data?.answer) {
          const finalAnswer = ev.data.answer;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: `## Dynatrace Intelligence Response\n\n${finalAnswer}`, isLoading: false, isStreaming: false } : m
          ));
          return true;
        }
      }

      // No EndEvent but we got tokens — finalize
      if (gotTokens) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        ));
        return true;
      }
    }

    // Non-streaming response (ConversationResponse)
    if (res && typeof res === 'object' && 'text' in res) {
      const conv = res as { text: string; status?: string };
      if (conv.status === 'FAILED') return false; // trigger fallback
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `## Dynatrace Intelligence Response\n\n${conv.text}`, isLoading: false, isStreaming: false } : m
      ));
      return true;
    }

    return false; // no usable response — trigger fallback
  } catch {
    return false; // streaming failed — trigger fallback
  }
}

/**
 * Fallback: NL2DQL → execute DQL → explain with DQL2NL
 */
async function nl2dqlPipeline(query: string): Promise<string> {
  const nl2dql = await publicClient.nl2dql({ body: { text: query } });

  if (nl2dql.status === 'FAILED' || !nl2dql.dql) {
    // Last resort: non-streaming conversation
    return nonStreamingFallback(query);
  }

  return executeDqlAndExplain(nl2dql.dql);
}

async function executeDqlAndExplain(dql: string): Promise<string> {
  let records: unknown[] = [];
  try {
    const result = await queryExecutionClient.queryExecute({
      body: { query: dql, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
    });
    records = result.result?.records || [];
  } catch {
    return `## Dynatrace Intelligence Analysis\n\nGenerated DQL:\n\`\`\`\n${dql}\n\`\`\`\n\nThe query could not be executed — the data may not be available yet.`;
  }

  let explanation = '';
  try {
    const res = await publicClient.dql2nl({ body: { dql } });
    explanation = res.explanation || res.summary || '';
  } catch { /* optional */ }

  let out = '## Dynatrace Intelligence Analysis\n\n';
  if (explanation) out += `**Query Explanation**: ${explanation}\n\n`;
  out += `**Generated DQL**:\n\`\`\`\n${dql}\n\`\`\`\n\n`;

  if (records.length === 0) {
    out += 'No data found for this query.\n';
  } else {
    out += `### Results (${records.length} records)\n\n`;
    const first = records[0] as Record<string, unknown>;
    const keys = Object.keys(first).filter(k => first[k] != null);

    records.slice(0, 10).forEach((rec, i) => {
      const r = rec as Record<string, unknown>;
      const nameKey = keys.find(k => /name|service|model/.test(k));
      out += nameKey && r[nameKey] ? `**${i + 1}. ${r[nameKey]}**\n` : `**${i + 1}.** Record\n`;
      keys.forEach(k => {
        if (k !== nameKey && r[k] != null) {
          const v = r[k];
          out += `   - ${k}: ${typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : (v as number).toFixed(2)) : String(v)}\n`;
        }
      });
      out += '\n';
    });
    if (records.length > 10) out += `*...and ${records.length - 10} more records*\n`;
  }

  return out;
}

/**
 * Last-resort fallback: non-streaming JSON conversation
 */
async function nonStreamingFallback(query: string): Promise<string> {
  const res = await publicClient.recommenderConversation({
    acceptType: 'application/json',
    body: {
      text: query,
      context: [
        { type: 'supplementary', value: 'GenAI observability using OpenTelemetry gen_ai semantic conventions in Dynatrace.' },
        { type: 'instruction', value: 'Answer with clear markdown formatting. Be concise and actionable.' },
      ],
    },
  } as any);

  if (res && typeof res === 'object' && 'text' in res) {
    const conv = res as { text: string; status?: string };
    if (conv.status === 'FAILED') throw new Error('Davis CoPilot returned a failed status.');
    return `## Dynatrace Intelligence Response\n\n${conv.text}`;
  }

  return 'Dynatrace Intelligence could not generate a response. Try rephrasing.';
}
