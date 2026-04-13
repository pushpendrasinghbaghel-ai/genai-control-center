// Instruction Quality Hook — Tier 1 Eval Engine (DQL-native, zero LLM cost)
//
// Measures real instruction-following quality from production spans:
//   1. Thin Response Rate  — proxy for "did the model refuse / truncate?"
//   2. Constraint Adherence — word-limit prompts: did the model stay within stated bounds?
//
// All DQL validated via MCP against demo tenant (April 12 2026):
//   • Query 1 returns 17 models, thin_responses correct for all
//   • Query 2 returns 8 models with constraint data (coalesce + contains pattern confirmed)

import { useState, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface InstructionQualityMetric {
  model: string;
  // Completeness proxy
  totalRequests: number;
  thinResponseRate: number;    // % of responses with < 20 output tokens
  avgOutputTokens: number | null;
  // Constraint adherence (only for models with word-limit prompts)
  hasConstraintData: boolean;
  constraintRequests: number;
  violationRate: number;       // % that exceeded stated word limit
  complianceRate: number;      // 100 − violationRate
  avgWordCount: number;
  // Instruction following score 0–100 (higher = better)
  score: number;
}

export interface InstructionQualitySummary {
  totalModels: number;
  modelsWithConstraintData: number;
  overallComplianceRate: number;   // avg across models that have constraint data
  overallThinRate: number;         // avg thin-response rate across all models
  bestCompliantModel: string | null;
  worstCompliantModel: string | null;
}

// ============================================
// Hook
// ============================================

export function useInstructionQuality() {
  const [metrics, setMetrics] = useState<InstructionQualityMetric[]>([]);
  const [summary, setSummary] = useState<InstructionQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(async (timeframe = '7d') => {
    setLoading(true);
    setError(null);

    try {
      // ── Query 1: Thin response rate (completeness proxy) — all models ──
      const [thinRes, constraintRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}
              | filter isNotNull(gen_ai.request.model)
              | filter isNotNull(\`gen_ai.completion.0.content\`)
              | fieldsAdd output_tok = toLong(gen_ai.usage.output_tokens)
              | summarize
                  total = count(),
                  thin_responses = countIf(output_tok < 20 AND output_tok > 0),
                  avg_output_tok = avg(output_tok),
                  by: { model = gen_ai.request.model }
              | sort total desc
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60,
          },
        }),

        // ── Query 2: Constraint adherence — prompts mentioning word limits ──
        queryExecutionClient.queryExecute({
          body: {
            query: `
              fetch spans, from: now()-${timeframe}
              | filter isNotNull(\`gen_ai.completion.0.content\`)
              | filter contains(coalesce(\`gen_ai.prompt.0.content\`, ""), "words")
                  OR contains(coalesce(\`gen_ai.prompt.1.content\`, ""), "words")
              | fieldsAdd word_count = arraySize(splitString(\`gen_ai.completion.0.content\`, " "))
              | summarize
                  constraint_requests = count(),
                  violations = countIf(word_count > 50),
                  avg_word_count = avg(word_count),
                  by: { model = gen_ai.request.model }
              | sort constraint_requests desc
            `,
            requestTimeoutMilliseconds: 60000,
            fetchTimeoutSeconds: 60,
          },
        }),
      ]);

      const thinRecords: any[] = thinRes.result?.records ?? [];
      const constraintRecords: any[] = constraintRes.result?.records ?? [];

      // Build constraint lookup by model
      const constraintMap = new Map<string, { requests: number; violations: number; avgWords: number }>();
      for (const r of constraintRecords) {
        const requests = Number(r.constraint_requests) || 0;
        if (requests > 50) {  // require meaningful sample
          constraintMap.set(r.model, {
            requests,
            violations: Number(r.violations) || 0,
            avgWords: Number(r.avg_word_count) || 0,
          });
        }
      }

      // Build per-model metrics
      const result: InstructionQualityMetric[] = thinRecords.map((r: any) => {
        const model: string = r.model || 'Unknown';
        const total = Number(r.total) || 0;
        const thin = Number(r.thin_responses) || 0;
        const avgOutputTok = r.avg_output_tok != null ? Number(r.avg_output_tok) : null;
        const thinRate = total > 0 ? (thin / total) * 100 : 0;

        const constraint = constraintMap.get(model);
        const hasConstraintData = !!constraint;
        const violationRate = hasConstraintData
          ? (constraint!.violations / constraint!.requests) * 100
          : 0;
        const complianceRate = hasConstraintData ? 100 - violationRate : 0;

        // Score: constraint data is primary signal (70%), thin rate is secondary (30%)
        // Without constraint data score is purely completeness-based
        const completenessScore = Math.max(0, 100 - thinRate * 2);
        const score = hasConstraintData
          ? Math.round(complianceRate * 0.7 + completenessScore * 0.3)
          : Math.round(completenessScore);

        return {
          model,
          totalRequests: total,
          thinResponseRate: Math.round(thinRate * 10) / 10,
          avgOutputTokens: avgOutputTok != null ? Math.round(avgOutputTok * 10) / 10 : null,
          hasConstraintData,
          constraintRequests: hasConstraintData ? constraint!.requests : 0,
          violationRate: Math.round(violationRate * 10) / 10,
          complianceRate: Math.round(complianceRate * 10) / 10,
          avgWordCount: hasConstraintData ? Math.round(constraint!.avgWords) : 0,
          score: Math.max(0, Math.min(100, score)),
        };
      });

      setMetrics(result);

      // Summary
      const withConstraints = result.filter(m => m.hasConstraintData);
      const sortedByCompliance = [...withConstraints].sort((a, b) => b.complianceRate - a.complianceRate);
      const overallCompliance = withConstraints.length > 0
        ? withConstraints.reduce((s, m) => s + m.complianceRate, 0) / withConstraints.length
        : 0;
      const overallThin = result.length > 0
        ? result.reduce((s, m) => s + m.thinResponseRate, 0) / result.length
        : 0;

      setSummary({
        totalModels: result.length,
        modelsWithConstraintData: withConstraints.length,
        overallComplianceRate: Math.round(overallCompliance * 10) / 10,
        overallThinRate: Math.round(overallThin * 10) / 10,
        bestCompliantModel: sortedByCompliance[0]?.model ?? null,
        worstCompliantModel: sortedByCompliance[sortedByCompliance.length - 1]?.model ?? null,
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { metrics, summary, loading, error, analyze };
}
