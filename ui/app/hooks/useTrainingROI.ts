// GenAI Control Center — Training ROI Tracker
// Phase 5: Fine-tuning investment vs inference savings timeline
// Tracks Bedrock training jobs and correlates with post-training inference cost

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface TrainingJob {
  baseModel: string;
  status: string;
  jobCount: number;
  estimatedCostUsd: number;
  latestTimestamp: string;
}

export interface TrainingROISummary {
  jobs: TrainingJob[];
  totalJobCount: number;
  totalInvestment: number;
  modelsTrainedCount: number;
  avgCostPerJob: number;
  completedJobs: number;
  inProgressJobs: number;
}

// ============================================
// DQL Query
// ============================================

const TRAINING_JOBS_DETAIL_QUERY = `
fetch bizevents, from: now()-7d, to: now()
| filter event.type == "gen_ai.auditing"
| filter gen_ai.type == "training"
| filter isNotNull(eventName)
| fieldsAdd params = toString(requestParameters)
| parse params, "ld 'baseModelIdentifier\":\"' ld:base_model '\"'"
| fieldsAdd status = coalesce(eventName, "unknown")
| summarize job_count = count(),
            latest = max(timestamp),
  by: { base_model, status }
| sort job_count desc
`;

// Approximate training cost per job by base model
const TRAINING_COST: Record<string, number> = {
  'amazon.titan-text-express': 8.0,
  'amazon.titan-text-express-v1': 8.0,
  'amazon.titan-text-lite': 4.0,
  'amazon.titan-text-lite-v1': 4.0,
  'meta.llama3-1-8b': 12.0,
  'meta.llama3-1-70b': 45.0,
  'meta.llama3-1-405b': 90.0,
  'anthropic.claude-3-haiku': 6.0,
  'anthropic.claude-3-sonnet': 25.0,
  'cohere.command-r': 10.0,
};
const DEFAULT_COST = 10.0;

// ============================================
// Safe DQL executor
// ============================================

async function safeDql(query: string): Promise<any[]> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
    });
    return response.result?.records || [];
  } catch (err) {
    console.warn('[GCC:TrainingROI] DQL error:', err);
    return [];
  }
}

// ============================================
// Hook
// ============================================

export function useTrainingROI() {
  const [data, setData] = useState<TrainingROISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const records = await safeDql(TRAINING_JOBS_DETAIL_QUERY);

      let totalJobCount = 0;
      let totalInvestment = 0;
      let completedJobs = 0;
      let inProgressJobs = 0;
      const modelsSet = new Set<string>();

      const jobs: TrainingJob[] = records.map((r: any) => {
        const baseModel = String(r.base_model || 'unknown');
        const status = String(r.status || 'unknown');
        const jobCount = Number(r.job_count) || 0;
        const latest = String(r.latest || '');

        modelsSet.add(baseModel);
        totalJobCount += jobCount;
        if (status.toLowerCase() === 'completed') completedJobs += jobCount;
        if (status.toLowerCase() === 'inprogress') inProgressJobs += jobCount;

        const perJob = Object.entries(TRAINING_COST).find(
          ([key]) => baseModel.toLowerCase().includes(key)
        )?.[1] ?? DEFAULT_COST;
        const cost = perJob * jobCount;
        totalInvestment += cost;

        return {
          baseModel,
          status,
          jobCount,
          estimatedCostUsd: cost,
          latestTimestamp: latest,
        };
      });

      setData({
        jobs,
        totalJobCount,
        totalInvestment,
        modelsTrainedCount: modelsSet.size,
        avgCostPerJob: totalJobCount > 0 ? totalInvestment / totalJobCount : 0,
        completedJobs,
        inProgressJobs,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
