// Centralized design token mappings for GCC
// All color references MUST use these tokens or Strato CSS variables.
// Never use hardcoded hex colors (#xxxx) in component code.

import { Colors } from '@dynatrace/strato-design-tokens';

/**
 * Status colors — use for health indicators, badges, alerts
 */
export const StatusColors = {
  good: Colors.Charts.Status.Good.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
} as const;

/**
 * Categorical chart colors — use for distinguishing entities (services, providers, models)
 */
export const ChartColors = {
  color01: Colors.Charts.Categorical.Color01.Default,
  color02: Colors.Charts.Categorical.Color02.Default,
  color03: Colors.Charts.Categorical.Color03.Default,
  color04: Colors.Charts.Categorical.Color04.Default,
  color05: Colors.Charts.Categorical.Color05.Default,
  color06: Colors.Charts.Categorical.Color06.Default,
  color07: Colors.Charts.Categorical.Color07.Default,
  color08: Colors.Charts.Categorical.Color08.Default,
  color09: Colors.Charts.Categorical.Color09.Default,
  color10: Colors.Charts.Categorical.Color10.Default,
  color11: Colors.Charts.Categorical.Color11.Default,
  color12: Colors.Charts.Categorical.Color12.Default,
} as const;

/**
 * Semantic CSS variable references — theme-aware, work in both dark & light mode
 */
export const CssTokens = {
  // Text
  textPrimary: 'var(--dt-colors-text-primary-default)',
  textSecondary: 'var(--dt-colors-text-neutral-default)',
  textAccent: 'var(--dt-colors-text-accent-default)',
  textDisabled: 'var(--dt-colors-text-primary-disabled)',

  // Feedback
  feedbackSuccess: 'var(--dt-colors-feedback-success-default)',
  feedbackWarning: 'var(--dt-colors-feedback-warning-default)',
  feedbackCritical: 'var(--dt-colors-feedback-critical-default)',
  feedbackInfo: 'var(--dt-colors-feedback-info-default)',

  // Surfaces
  surfacePrimary: 'var(--dt-colors-surface-primary-default)',
  surfaceSecondary: 'var(--dt-colors-surface-default)',
  surfaceHover: 'var(--dt-colors-surface-hover)',

  // Borders
  borderPrimary: 'var(--dt-colors-border-primary-default)',
  borderNeutral: 'var(--dt-colors-border-neutral-default)',

  // Background
  backgroundPrimary: 'var(--dt-colors-background-primary-default)',
  backgroundSurface: 'var(--dt-colors-background-surface-default)',
} as const;

/**
 * Entity type color mapping for topology, charts, and badges.
 * Maps GenAI entity types to categorical chart colors.
 */
export const EntityColors = {
  service: ChartColors.color01,
  provider: ChartColors.color02,
  model: ChartColors.color03,
  agent: ChartColors.color04,
  tool: ChartColors.color05,
  workflow: ChartColors.color06,
  vectorDb: ChartColors.color07,
  embedding: ChartColors.color08,
  endpoint: ChartColors.color09,
  user: ChartColors.color10,
} as const;

/**
 * Grade/score color mapping (A-F)
 */
export const GradeColors = {
  A: StatusColors.good,
  B: ChartColors.color03,
  C: StatusColors.warning,
  D: ChartColors.color05,
  F: StatusColors.critical,
} as const;
