// Centralized formatting utilities using Dynatrace user preferences
// All date, number, and duration formatting MUST go through these functions
// to respect user timezone, locale, and regional format settings.

import { getTimezone, getRegionalFormat } from '@dynatrace-sdk/user-preferences';

/**
 * Get user's regional format (locale) with fallback
 */
function getUserLocale(): string {
  try {
    return getRegionalFormat() || navigator.language || 'en';
  } catch {
    return navigator.language || 'en';
  }
}

/**
 * Get user's timezone with fallback
 */
function getUserTimezone(): string {
  try {
    return getTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

/**
 * Format a date/time value respecting user preferences (timezone + locale)
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';

  const locale = getUserLocale();
  const timeZone = getUserTimezone();

  const defaults: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    ...options,
  };

  return date.toLocaleString(locale, defaults);
}

/**
 * Format time-only (HH:mm:ss) respecting user preferences
 */
export function formatTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString(getUserLocale(), {
    timeZone: getUserTimezone(),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format date-only (e.g., Mar 31, 2026) respecting user preferences
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(getUserLocale(), {
    timeZone: getUserTimezone(),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a number respecting user regional format.
 * Use this instead of toLocaleString() or hardcoded Intl.NumberFormat('en-US').
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  const n = Number(value);
  if (value === null || value === undefined || isNaN(n)) return '0';
  return new Intl.NumberFormat(getUserLocale(), options).format(n);
}

/**
 * Format currency respecting user locale for symbol placement & separators.
 */
export function formatCurrencyLocalized(
  amount: number | string | null | undefined,
  currency: string = 'USD'
): string {
  const n = Number(amount);
  if (amount === null || amount === undefined || isNaN(n)) return '$0.00';
  return new Intl.NumberFormat(getUserLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

/**
 * Format percentage respecting user locale decimal separator.
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return new Intl.NumberFormat(getUserLocale(), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format duration in milliseconds to human-readable (locale-aware).
 * Single source of truth — replaces all custom formatDuration implementations.
 */
export function formatDurationMs(ms: number | string | null | undefined): string {
  const n = Number(ms);
  if (ms === null || ms === undefined || isNaN(n)) return '0 ms';
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(1)} s`;
  if (n < 3_600_000) return `${(n / 60_000).toFixed(1)} min`;
  return `${(n / 3_600_000).toFixed(1)} h`;
}

/**
 * Format latency from nanoseconds (DQL returns ns) — locale-aware
 */
export function formatLatencyNs(ns: number | string | null | undefined): string {
  const n = Number(ns);
  if (ns === null || ns === undefined || isNaN(n)) return '0 ms';
  return formatDurationMs(n / 1_000_000);
}
