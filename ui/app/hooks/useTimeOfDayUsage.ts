// GenAI Control Center — Time-of-Day Usage Heatmap
// FinOps best practice: Monitor usage patterns to identify peak waste + idle periods.
// Narrative placement: Tab 2 "Cost Intelligence" — answers "WHEN does the money go?"

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { estimateCost } from '../utils/helpers';

// ============================================
// Types
// ============================================

export interface HourlyUsagePoint {
  /** 0-23 hour of day (UTC) */
  hour: number;
  /** Label like "00:00", "01:00" */
  label: string;
  /** Total request count in this hour bucket */
  requestCount: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Estimated cost for this hour */
  estimatedCost: number;
  /** Dominant provider in this hour */
  topProvider: string;
}

export interface UsageByHourResult {
  /** 24 hourly data points */
  hours: HourlyUsagePoint[];
  /** Peak hour (0-23) */
  peakHour: number;
  /** Quietest hour (0-23) */
  quietHour: number;
  /** Peak-to-trough ratio (how spiky is usage) */
  peakToTroughRatio: number;
  /** Total requests across all hours */
  totalRequests: number;
  /** Total estimated cost */
  totalCost: number;
  /** % of cost concentrated in the top 4 hours */
  top4HoursCostPct: number;
  /** Narrative insight */
  insight: string;
}

// ============================================
// DQL — hourly breakdown with provider split
// ============================================

const HOURLY_USAGE_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.request.model)
| fieldsAdd input_tok = toDouble(coalesce(gen_ai.usage.input_tokens, 0)),
            output_tok = toDouble(coalesce(gen_ai.usage.output_tokens, 0)),
            provider = coalesce(gen_ai.provider.name, "unknown"),
            model = coalesce(gen_ai.request.model, "unknown"),
            hour_of_day = getHour(timestamp)
| summarize request_count = count(),
            total_input = sum(input_tok),
            total_output = sum(output_tok),
  by: { hour_of_day, provider }
| sort hour_of_day asc
`;

// ============================================
// Hook
// ============================================

export function useTimeOfDayUsage() {
  const [data, setData] = useState<UsageByHourResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryExecutionClient.queryExecute({
        body: { query: HOURLY_USAGE_QUERY, requestTimeoutMilliseconds: 30000 },
      });

      const records = result?.result?.records || [];
      if (records.length === 0) { setData(null); setLoading(false); return; }

      // Aggregate by hour (DQL returns one row per hour × provider)
      const hourMap = new Map<number, { requestCount: number; inputTokens: number; outputTokens: number; providerCounts: Map<string, number> }>();
      for (let h = 0; h < 24; h++) {
        hourMap.set(h, { requestCount: 0, inputTokens: 0, outputTokens: 0, providerCounts: new Map() });
      }

      for (const r of records as any[]) {
        const hour = Number(r.hour_of_day);
        const provider = String(r.provider || 'unknown');
        const count = Number(r.request_count) || 0;
        const input = Number(r.total_input) || 0;
        const output = Number(r.total_output) || 0;

        if (hour < 0 || hour > 23) continue;
        const bucket = hourMap.get(hour)!;
        bucket.requestCount += count;
        bucket.inputTokens += input;
        bucket.outputTokens += output;
        bucket.providerCounts.set(provider, (bucket.providerCounts.get(provider) || 0) + count);
      }

      // Build final array
      const hours: HourlyUsagePoint[] = [];
      let totalReqs = 0;
      let totalCost = 0;

      for (let h = 0; h < 24; h++) {
        const bucket = hourMap.get(h)!;
        // Find dominant provider
        let topProvider = 'none';
        let topCount = 0;
        bucket.providerCounts.forEach((cnt, prov) => {
          if (cnt > topCount) { topCount = cnt; topProvider = prov; }
        });

        // Estimate cost using the dominant provider (simplified — exact would need per-model)
        const cost = estimateCost(topProvider, bucket.inputTokens, bucket.outputTokens, '');

        hours.push({
          hour: h,
          label: `${String(h).padStart(2, '0')}:00`,
          requestCount: bucket.requestCount,
          inputTokens: bucket.inputTokens,
          outputTokens: bucket.outputTokens,
          estimatedCost: cost,
          topProvider,
        });

        totalReqs += bucket.requestCount;
        totalCost += cost;
      }

      // Analytics
      const peakHourObj = hours.reduce((a, b) => a.requestCount > b.requestCount ? a : b, hours[0]);
      const quietHourObj = hours.reduce((a, b) => a.requestCount < b.requestCount ? a : b, hours[0]);
      const peakToTroughRatio = quietHourObj.requestCount > 0
        ? peakHourObj.requestCount / quietHourObj.requestCount
        : peakHourObj.requestCount > 0 ? Infinity : 1;

      // Top 4 hours cost concentration
      const sortedByCost = [...hours].sort((a, b) => b.estimatedCost - a.estimatedCost);
      const top4Cost = sortedByCost.slice(0, 4).reduce((s, h) => s + h.estimatedCost, 0);
      const top4Pct = totalCost > 0 ? (top4Cost / totalCost) * 100 : 0;

      // Build insight
      let insight: string;
      if (peakToTroughRatio > 5) {
        insight = `Usage is highly concentrated: peak at ${peakHourObj.label} UTC is ${peakToTroughRatio.toFixed(1)}x the quietest hour (${quietHourObj.label} UTC). ${top4Pct.toFixed(0)}% of cost occurs in just 4 hours — consider scheduling batch workloads during off-peak or implementing auto-scaling.`;
      } else if (peakToTroughRatio > 2) {
        insight = `Moderate usage variation: ${top4Pct.toFixed(0)}% of cost is in the top 4 hours. Peak at ${peakHourObj.label} UTC. There may be opportunity to shift non-urgent workloads to quieter hours.`;
      } else {
        insight = `Usage is evenly distributed across the day (${peakToTroughRatio.toFixed(1)}x peak/trough ratio). This is efficient — no obvious scheduling optimization needed.`;
      }

      setData({
        hours,
        peakHour: peakHourObj.hour,
        quietHour: quietHourObj.hour,
        peakToTroughRatio,
        totalRequests: totalReqs,
        totalCost,
        top4HoursCostPct: top4Pct,
        insight,
      });
    } catch (err) {
      console.error('[useTimeOfDayUsage] Query failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
