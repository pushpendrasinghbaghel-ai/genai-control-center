// Response Content Hook
// Real DQL queries for: Prompt/Response Content Viewer, Response Quality Analytics,
// Model Aliasing Detection, and Prompt Length Trends
// All data from gen_ai.completion.0.content, gen_ai.prompt.0.content, gen_ai.completion.0.finish_reason

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface PromptResponseEntry {
  timestamp: Date;
  provider: string;
  requestModel: string;
  responseModel: string;
  promptPreview: string;
  responsePreview: string;
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  promptLength: number;
  responseLength: number;
  traceId: string;
}

export interface FinishReasonBreakdown {
  provider: string;
  model: string;
  finishReason: string;
  count: number;
  avgDurationMs: number;
  avgOutputTokens: number;
  avgResponseLength: number;
}

export interface ModelAlias {
  requestModel: string;
  responseModel: string;
  provider: string;
  count: number;
  isMismatch: boolean;
  avgDurationMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

export interface PromptLengthTrend {
  timeBucket: Date;
  avgPromptLength: number;
  avgResponseLength: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestCount: number;
  maxPromptLength: number;
  maxResponseLength: number;
}

export interface ResponseQualitySummary {
  totalWithContent: number;
  totalWithFinishReason: number;
  finishReasonDistribution: { reason: string; count: number; pct: number }[];
  avgResponseLength: number;
  avgPromptLength: number;
  modelAliasCount: number;
}

// ============================================
// Content Viewer Hook
// ============================================

export function useContentViewer() {
  const [entries, setEntries] = useState<PromptResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContent = useCallback(async (timeframe: string = '2h') => {
    setLoading(true);
    setError(null);
    try {
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | filter isNotNull(gen_ai.completion.0.content) OR isNotNull(gen_ai.prompt.0.content)
            | fields
                timestamp = start_time,
                provider = gen_ai.provider.name,
                request_model = gen_ai.request.model,
                response_model = gen_ai.response.model,
                prompt = coalesce(gen_ai.prompt.1.content, gen_ai.prompt.0.content),
                response = gen_ai.completion.0.content,
                finish_reason = gen_ai.completion.0.finish_reason,
                input_tokens = gen_ai.usage.input_tokens,
                output_tokens = gen_ai.usage.output_tokens,
                latency_ns = duration,
                trace_id = trace.id
            | sort timestamp desc
            | limit 200
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      const mapped: PromptResponseEntry[] = records.map((r: any) => {
        const prompt = r.prompt || '';
        const resp = r.response || '';
        return {
          timestamp: new Date(r.timestamp || Date.now()),
          provider: r.provider || 'unknown',
          requestModel: r.request_model || 'unknown',
          responseModel: r.response_model || '',
          promptPreview: typeof prompt === 'string' ? prompt.slice(0, 300) : String(prompt).slice(0, 300),
          responsePreview: typeof resp === 'string' ? resp.slice(0, 500) : String(resp).slice(0, 500),
          finishReason: r.finish_reason || '',
          inputTokens: Number(r.input_tokens) || 0,
          outputTokens: Number(r.output_tokens) || 0,
          durationMs: (Number(r.latency_ns) || 0) / 1_000_000,
          promptLength: typeof prompt === 'string' ? prompt.length : 0,
          responseLength: typeof resp === 'string' ? resp.length : 0,
          traceId: r.trace_id || '',
        };
      });

      setEntries(mapped);
    } catch (err) {
      console.error('[GCC] Content viewer fetch failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch content'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, loading, error, fetchContent };
}

// ============================================
// Finish Reason / Response Quality Hook
// ============================================

export function useFinishReasonAnalytics() {
  const [breakdown, setBreakdown] = useState<FinishReasonBreakdown[]>([]);
  const [summary, setSummary] = useState<ResponseQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(async (timeframe: string = '2h') => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, summaryRes] = await Promise.all([
        // Per-provider/model/finish_reason breakdown
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}, to: now()
              | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
              | filter isNotNull(gen_ai.completion.0.finish_reason)
              | fieldsAdd resp_len = if(isNotNull(gen_ai.completion.0.content), then: toDouble(stringLength(toString(gen_ai.completion.0.content))), else: 0.0)
              | summarize {
                  cnt = count(),
                  avg_duration_ms = avg(toDouble(duration)) / 1000000,
                  avg_output_tokens = avg(coalesce(toDouble(gen_ai.usage.output_tokens), 0.0)),
                  avg_resp_len = avg(resp_len)
                }, by: {
                  provider = gen_ai.provider.name,
                  model = gen_ai.request.model,
                  finish_reason = gen_ai.completion.0.finish_reason
                }
              | sort cnt desc
              | limit 100
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        }),
        // Overall summary: coverage of content and finish reason fields
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}, to: now()
              | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
              | summarize {
                  total = count(),
                  with_content = countIf(isNotNull(gen_ai.completion.0.content)),
                  with_finish_reason = countIf(isNotNull(gen_ai.completion.0.finish_reason)),
                  with_prompt = countIf(isNotNull(gen_ai.prompt.0.content)),
                  avg_resp_len = avg(if(isNotNull(gen_ai.completion.0.content), then: toDouble(stringLength(toString(gen_ai.completion.0.content))), else: 0.0)),
                  avg_prompt_len = avg(if(isNotNull(gen_ai.prompt.0.content), then: toDouble(stringLength(toString(gen_ai.prompt.0.content))), else: 0.0)),
                  model_alias_count = countIf(isNotNull(gen_ai.response.model) AND gen_ai.request.model != gen_ai.response.model)
                }
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60
          }
        })
      ]);

      // Parse detail breakdown
      const detailRecords = detailRes.result?.records || [];
      const items: FinishReasonBreakdown[] = detailRecords.map((r: any) => ({
        provider: r.provider || 'unknown',
        model: r.model || 'unknown',
        finishReason: r.finish_reason || 'unknown',
        count: Number(r.cnt) || 0,
        avgDurationMs: Number(r.avg_duration_ms) || 0,
        avgOutputTokens: Number(r.avg_output_tokens) || 0,
        avgResponseLength: Number(r.avg_resp_len) || 0,
      }));
      setBreakdown(items);

      // Parse summary
      const sumRec = (summaryRes.result?.records || [])[0] as any;
      if (sumRec) {
        const totalWithFinish = Number(sumRec.with_finish_reason) || 0;
        // Build finish reason distribution from detail data
        const reasonMap = new Map<string, number>();
        items.forEach(i => {
          reasonMap.set(i.finishReason, (reasonMap.get(i.finishReason) || 0) + i.count);
        });
        const distribution = Array.from(reasonMap.entries())
          .map(([reason, count]) => ({
            reason,
            count,
            pct: totalWithFinish > 0 ? (count / totalWithFinish) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count);

        setSummary({
          totalWithContent: Number(sumRec.with_content) || 0,
          totalWithFinishReason: totalWithFinish,
          finishReasonDistribution: distribution,
          avgResponseLength: Number(sumRec.avg_resp_len) || 0,
          avgPromptLength: Number(sumRec.avg_prompt_len) || 0,
          modelAliasCount: Number(sumRec.model_alias_count) || 0,
        });
      }
    } catch (err) {
      console.error('[GCC] Finish reason analytics failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to analyze finish reasons'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { breakdown, summary, loading, error, analyze };
}

// ============================================
// Model Aliasing Detection Hook
// ============================================

export function useModelAliasing() {
  const [aliases, setAliases] = useState<ModelAlias[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const detect = useCallback(async (timeframe: string = '2h') => {
    setLoading(true);
    setError(null);
    try {
      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | filter isNotNull(gen_ai.response.model)
            | summarize {
                cnt = count(),
                avg_duration_ms = avg(toDouble(duration)) / 1000000,
                avg_input_tokens = avg(coalesce(toDouble(gen_ai.usage.input_tokens), 0.0)),
                avg_output_tokens = avg(coalesce(toDouble(gen_ai.usage.output_tokens), 0.0))
              }, by: {
                request_model = gen_ai.request.model,
                response_model = gen_ai.response.model,
                provider = gen_ai.provider.name
              }
            | sort cnt desc
            | limit 100
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      const mapped: ModelAlias[] = records.map((r: any) => {
        const reqModel = r.request_model || '';
        const resModel = r.response_model || '';
        return {
          requestModel: reqModel,
          responseModel: resModel,
          provider: r.provider || 'unknown',
          count: Number(r.cnt) || 0,
          isMismatch: reqModel !== resModel && reqModel !== '' && resModel !== '',
          avgDurationMs: Number(r.avg_duration_ms) || 0,
          avgInputTokens: Number(r.avg_input_tokens) || 0,
          avgOutputTokens: Number(r.avg_output_tokens) || 0,
        };
      });

      setAliases(mapped);
    } catch (err) {
      console.error('[GCC] Model aliasing detection failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to detect model aliasing'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { aliases, loading, error, detect };
}

// ============================================
// Prompt Length Trends Hook
// ============================================

export function usePromptLengthTrends() {
  const [trends, setTrends] = useState<PromptLengthTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrends = useCallback(async (timeframe: string = '2h') => {
    setLoading(true);
    setError(null);
    try {
      let bucketSize = '10m';
      if (timeframe === '1h') bucketSize = '5m';
      else if (timeframe === '6h') bucketSize = '15m';
      else if (timeframe === '12h') bucketSize = '30m';
      else if (timeframe === '24h') bucketSize = '1h';
      else if (timeframe === '7d') bucketSize = '6h';
      else if (timeframe === '30d') bucketSize = '1d';

      const response = await queryExecutionClient.queryExecute({
        body: {
          query: `
            fetch spans, from: now()-${timeframe}, to: now()
            | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
            | filter isNotNull(gen_ai.prompt.0.content) OR isNotNull(gen_ai.completion.0.content)
            | fieldsAdd prompt_len = if(isNotNull(gen_ai.prompt.0.content), then: toDouble(stringLength(toString(gen_ai.prompt.0.content))), else: 0.0)
            | fieldsAdd resp_len = if(isNotNull(gen_ai.completion.0.content), then: toDouble(stringLength(toString(gen_ai.completion.0.content))), else: 0.0)
            | summarize {
                avg_prompt_len = avg(prompt_len),
                avg_resp_len = avg(resp_len),
                avg_input_tokens = avg(coalesce(toDouble(gen_ai.usage.input_tokens), 0.0)),
                avg_output_tokens = avg(coalesce(toDouble(gen_ai.usage.output_tokens), 0.0)),
                request_count = count(),
                max_prompt_len = max(prompt_len),
                max_resp_len = max(resp_len)
              }, by: { time_bucket = bin(start_time, ${bucketSize}) }
            | sort time_bucket asc
          `,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      const mapped: PromptLengthTrend[] = records.map((r: any) => ({
        timeBucket: new Date(r.time_bucket || Date.now()),
        avgPromptLength: Number(r.avg_prompt_len) || 0,
        avgResponseLength: Number(r.avg_resp_len) || 0,
        avgInputTokens: Number(r.avg_input_tokens) || 0,
        avgOutputTokens: Number(r.avg_output_tokens) || 0,
        requestCount: Number(r.request_count) || 0,
        maxPromptLength: Number(r.max_prompt_len) || 0,
        maxResponseLength: Number(r.max_resp_len) || 0,
      }));

      setTrends(mapped);
    } catch (err) {
      console.error('[GCC] Prompt length trends failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch prompt length trends'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { trends, loading, error, fetchTrends };
}
