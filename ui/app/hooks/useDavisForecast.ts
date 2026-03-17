// GenAI Control Center — Davis Analyzer Forecast Hook
// Uses the real Dynatrace GenericForecastAnalyzer for AI-powered cost forecasting
// with polling + convertToTimeseriesBand per official guide.
// Falls back to simple linear projection if the analyzer is unavailable.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimeseriesBand, Timeseries } from '@dynatrace/strato-components/charts';
import { forecastAICost, type ForecastResult, type ForecastPoint } from '../utils/davisAnalyzers';

// ============================================
// Types — same shape the UI already consumes
// ============================================

export interface DavisForecastDay {
  day: number;
  projectedCost: number;
  projectedTokens: number;
  confidence: 'high' | 'medium' | 'low';
  lowerBound?: number;
  upperBound?: number;
}

export interface DavisForecastOutput {
  /** Day-level projection data consumed by the cards */
  forecast: DavisForecastDay[];
  /** Trend detected by Davis: increasing / decreasing / stable */
  trend: 'increasing' | 'decreasing' | 'stable';
  /** Forecast quality reported by the analyzer */
  quality: 'good' | 'fair' | 'poor';
  /** Whether the result came from Davis (true) or the local fallback (false) */
  isDavisPowered: boolean;
  /** Day when budget will be breached (null = within budget) */
  budgetBreachDay: number | null;
  /** TimeseriesBand for chart visualization — confidence interval from Davis Analyzer */
  forecastBand: TimeseriesBand | null;
  /** Timeseries lines (historical + forecast) from Davis Analyzer output */
  forecastTimeseries: Timeseries[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================
// Fallback: simple linear forecast (same as the old calculateForecast)
// ============================================

function linearFallback(
  currentCost: number,
  currentTokens: number,
  daysOfData: number,
  budgetLimit: number,
): Pick<DavisForecastOutput, 'forecast' | 'trend' | 'quality' | 'budgetBreachDay'> {
  const dailyAvgCost = currentCost / Math.max(daysOfData, 1);
  const dailyAvgTokens = currentTokens / Math.max(daysOfData, 1);
  const dailyGrowthRate = 1.007;

  const forecast: DavisForecastDay[] = [];
  let budgetBreachDay: number | null = null;

  for (let day = 1; day <= 30; day++) {
    const growthFactor = Math.pow(dailyGrowthRate, day);
    const projectedDailyCost = dailyAvgCost * growthFactor;
    const projectedDailyTokens = dailyAvgTokens * growthFactor;
    const projectedCost = currentCost + projectedDailyCost * day;
    const projectedTokens = currentTokens + projectedDailyTokens * day;

    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (day > 14) confidence = 'low';
    else if (day > 7) confidence = 'medium';

    forecast.push({ day, projectedCost, projectedTokens, confidence });

    if (!budgetBreachDay && projectedCost >= budgetLimit) {
      budgetBreachDay = day;
    }
  }

  return { forecast, trend: 'stable', quality: 'poor', budgetBreachDay };
}

// ============================================
// Hook
// ============================================

export function useDavisForecast(
  currentCost: number,
  currentTokens: number,
  budgetLimit: number,
  /** How many hours of historical data to feed the analyzer */
  timeRangeHours: number = 168, // 7 days
): DavisForecastOutput {
  const [forecast, setForecast] = useState<DavisForecastDay[]>([]);
  const [trend, setTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');
  const [quality, setQuality] = useState<'good' | 'fair' | 'poor'>('poor');
  const [isDavisPowered, setIsDavisPowered] = useState(false);
  const [budgetBreachDay, setBudgetBreachDay] = useState<number | null>(null);
  const [forecastBand, setForecastBand] = useState<TimeseriesBand | null>(null);
  const [forecastTimeseries, setForecastTimeseries] = useState<Timeseries[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const runForecast = useCallback(async () => {
    if (currentCost <= 0) {
      const fb = linearFallback(0, 0, 7, budgetLimit);
      setForecast(fb.forecast);
      setTrend(fb.trend);
      setQuality(fb.quality);
      setBudgetBreachDay(fb.budgetBreachDay);
      setIsDavisPowered(false);
      setForecastBand(null);
      setForecastTimeseries(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the real Davis GenericForecastAnalyzer (600h max = ~25 days)
      const result: ForecastResult = await forecastAICost(
        currentCost,
        timeRangeHours,
        600, // max supported by analyzer
        budgetLimit,
      );

      if (result.success && result.forecastPoints.length > 0) {
        // Store the TimeseriesBand + Timeseries from the analyzer for chart visualization
        setForecastBand(result.timeseriesBand ?? null);
        setForecastTimeseries(result.forecastTimeseries ?? null);

        // Convert hourly forecast points → daily aggregates for cards
        const dailyMap = new Map<number, { costs: number[]; lows: number[]; highs: number[] }>();

        result.forecastPoints.forEach((pt: ForecastPoint, idx: number) => {
          const day = Math.floor(idx / 24) + 1;
          if (day > 30) return;
          if (!dailyMap.has(day)) dailyMap.set(day, { costs: [], lows: [], highs: [] });
          const bucket = dailyMap.get(day)!;
          bucket.costs.push(pt.value);
          bucket.lows.push(pt.lowerBound);
          bucket.highs.push(pt.upperBound);
        });

        // Build cumulative daily projection
        let cumCost = currentCost;
        const days: DavisForecastDay[] = [];
        let breach: number | null = null;

        for (let d = 1; d <= 30; d++) {
          const bucket = dailyMap.get(d);
          const dailyCost = bucket
            ? bucket.costs.reduce((a, b) => a + b, 0)
            : 0;
          cumCost += dailyCost;

          let confidence: 'high' | 'medium' | 'low' = 'high';
          if (d > 14) confidence = 'low';
          else if (d > 7) confidence = 'medium';

          const lb = bucket
            ? currentCost + bucket.lows.reduce((a, b) => a + b, 0) * d * 0.5
            : cumCost * 0.85;
          const ub = bucket
            ? currentCost + bucket.highs.reduce((a, b) => a + b, 0) * d * 0.5
            : cumCost * 1.15;

          days.push({
            day: d,
            projectedCost: cumCost,
            projectedTokens: 0,
            confidence,
            lowerBound: lb,
            upperBound: ub,
          });

          if (!breach && cumCost >= budgetLimit) breach = d;
        }

        setForecast(days);
        setTrend(result.trend);
        setQuality(result.forecastQuality);
        setBudgetBreachDay(result.budgetBreachDay ?? breach);
        setIsDavisPowered(true);
        console.log('[GCC] Davis Forecast succeeded — using real analyzer data');
        return;
      }

      // Analyzer returned no useful data — fall back
      throw new Error(result.error || 'No forecast data returned');
    } catch (err) {
      console.warn('[GCC] Davis Forecast unavailable, using linear fallback:', err);
      const fb = linearFallback(currentCost, currentTokens, 7, budgetLimit);
      setForecast(fb.forecast);
      setTrend(fb.trend);
      setQuality(fb.quality);
      setBudgetBreachDay(fb.budgetBreachDay);
      setIsDavisPowered(false);
      setForecastBand(null);
      setForecastTimeseries(null);
      setError(err instanceof Error ? err.message : 'Analyzer unavailable');
    } finally {
      setLoading(false);
    }
  }, [currentCost, currentTokens, budgetLimit, timeRangeHours]);

  // Auto-fetch once when cost data is available
  useEffect(() => {
    if (currentCost > 0 && !fetchedRef.current) {
      fetchedRef.current = true;
      void runForecast();
    }
  }, [currentCost, runForecast]);

  return {
    forecast,
    trend,
    quality,
    isDavisPowered,
    budgetBreachDay,
    forecastBand,
    forecastTimeseries,
    loading,
    error,
    refetch: runForecast,
  };
}
