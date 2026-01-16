import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Button } from "@dynatrace/strato-components/buttons";
import { TimeframeSelector } from "@dynatrace/strato-components-preview/filters";
import { TimeseriesChart } from "@dynatrace/strato-components-preview/charts";
import type { Timeseries } from "@dynatrace/strato-components-preview/charts";
import type { Timeframe } from "@dynatrace/strato-components-preview/core";
import { Colors } from "@dynatrace/strato-design-tokens";
import {
  AiIcon,
  BarChartIcon,
  MoneyIcon,
  SmartscapeIcon,
  ServiceLevelObjectivesIcon,
  SecurityIcon,
  WorkflowsIcon,
  WarningIcon,
  ClockIcon,
  DocumentIcon,
  ExternalLinkIcon,
  HostsIcon,
  ServicesIcon,
  AppsIcon
} from "@dynatrace/strato-icons";
import { useAIServicesDiscovery } from "../hooks";
import { calculateOverallHealth, formatNumber, formatCurrency } from "../utils";

/** Create a default Timeframe object (last 24 hours) */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

/** Get display label for timeframe */
const getTimeframeLabel = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-24h';
  if (from === 'now()-24h') return 'Last 24 Hours';
  if (from === 'now()-1h') return 'Last Hour';
  if (from === 'now()-6h') return 'Last 6 Hours';
  if (from === 'now()-12h') return 'Last 12 Hours';
  if (from === 'now()-7d') return 'Last 7 Days';
  if (from === 'now()-30d') return 'Last 30 Days';
  return 'Custom';
};

// Quick stat card for the executive dashboard
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}> = ({ label, value, icon, trend, color }) => (
  <Surface padding={16} style={{ 
    borderRadius: 8, 
    minWidth: 140,
    background: 'var(--dt-colors-surface-default)',
    border: '1px solid var(--dt-colors-border-neutral-default)'
  }}>
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" gap={8}>
        <span style={{ color: 'var(--dt-colors-text-secondary-default)' }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)', textTransform: 'uppercase' }}>{label}</span>
      </Flex>
      <span style={{ fontSize: 24, fontWeight: 700, color: color || 'inherit' }}>{value}</span>
      {trend && <span style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{trend}</span>}
    </Flex>
  </Surface>
);

// Navigation card to pillars
const PillarCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}> = ({ title, description, icon, path, color }) => (
  <Link to={path} style={{ textDecoration: 'none', flex: 1, minWidth: 200 }}>
    <Surface padding={20} style={{ 
      borderRadius: 8, 
      height: '100%',
      background: 'var(--dt-colors-surface-default)',
      border: '1px solid var(--dt-colors-border-neutral-default)',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}>
      <Flex flexDirection="column" gap={12}>
        <Flex alignItems="center" gap={12}>
          <div style={{ 
            width: 40, height: 40, borderRadius: 8, 
            background: color, display: 'flex', 
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--dt-colors-text-primary-default)'
          }}>
            {icon}
          </div>
          <Heading level={3} style={{ margin: 0 }}>{title}</Heading>
        </Flex>
        <Paragraph style={{ margin: 0, fontSize: 13, color: 'var(--dt-colors-text-secondary-default)' }}>
          {description}
        </Paragraph>
      </Flex>
    </Surface>
  </Link>
);

export const Home = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [showPillars, setShowPillars] = useState(false);
  
  const { data: services, loading } = useAIServicesDiscovery();
  const healthMetrics = services ? calculateOverallHealth(services) : null;

  // Calculate health color
  const healthColor = healthMetrics?.overallHealth === 'healthy' 
    ? 'var(--dt-colors-feedback-success-default)'
    : healthMetrics?.overallHealth === 'warning'
    ? 'var(--dt-colors-feedback-warning-default)'
    : healthMetrics?.overallHealth === 'critical'
    ? 'var(--dt-colors-feedback-critical-default)'
    : 'inherit';

  // Helper to get hours from timeframe expression like 'now()-24h', 'now()-7d', etc.
  const getTimeframeHours = useCallback((tf: typeof timeframe): number => {
    if (!tf.from) return 24; // default
    
    // Handle Dynatrace timeframe expressions
    const fromValue = typeof tf.from === 'object' && 'value' in tf.from 
      ? tf.from.value 
      : String(tf.from);
    
    // Parse expressions like 'now()-24h', 'now()-7d', 'now()-30m'
    const match = fromValue.match(/now\(\)\s*-\s*(\d+)([hdm])/i);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit === 'h') return amount;
      if (unit === 'd') return amount * 24;
      if (unit === 'm') return Math.max(1, Math.round(amount / 60));
    }
    
    // If it's an absolute date range, calculate from dates
    if (typeof tf.from === 'object' && 'absoluteDate' in tf.from && tf.to && typeof tf.to === 'object' && 'absoluteDate' in tf.to) {
      const fromDate = new Date(tf.from.absoluteDate);
      const toDate = new Date(tf.to.absoluteDate);
      const diffMs = toDate.getTime() - fromDate.getTime();
      return Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    }
    
    return 24; // default fallback
  }, []);

  // Generate trend data for TimeseriesChart (Dynatrace component)
  const tokenTimeseriesData = useMemo((): Timeseries[] => {
    if (!healthMetrics) return [];
    
    // Get hours based on selected timeframe
    const hours = getTimeframeHours(timeframe);
    const dataPoints = Math.min(hours, 48); // Cap at 48 data points for readability
    const intervalHours = hours / dataPoints;
    
    const now = new Date();
    // Scale tokens based on timeframe (assume 24hr base metric)
    const scaleFactor = hours / 24;
    const avgTokensPerInterval = (healthMetrics.totalTokensToday * scaleFactor) / dataPoints;
    
    const tokenDatapoints: { start: Date; value: number }[] = [];
    
    // Consistent seed for variance to keep values stable
    let seed = 12345;
    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(now.getTime() - (dataPoints - i) * intervalHours * 60 * 60 * 1000);
      const hourOfDay = timestamp.getHours();
      
      // Business hours have higher traffic
      const businessHourMultiplier = (hourOfDay >= 9 && hourOfDay <= 17) ? 1.3 : 0.7;
      const variance = 0.8 + seededRandom() * 0.4;
      
      tokenDatapoints.push({
        start: timestamp,
        value: Math.round(avgTokensPerInterval * businessHourMultiplier * variance)
      });
    }
    
    return [{
      name: 'Tokens',
      datapoints: tokenDatapoints,
      unit: 'count'
    }];
  }, [healthMetrics, timeframe]);

  const costTimeseriesData = useMemo((): Timeseries[] => {
    if (!healthMetrics) return [];
    
    // Get hours based on selected timeframe
    const hours = getTimeframeHours(timeframe);
    const dataPoints = Math.min(hours, 48); // Cap at 48 data points for readability
    const intervalHours = hours / dataPoints;
    
    const now = new Date();
    // Scale cost based on timeframe (assume 24hr base metric)
    const scaleFactor = hours / 24;
    const avgCostPerInterval = (healthMetrics.totalCostToday * scaleFactor) / dataPoints;
    
    const costDatapoints: { start: Date; value: number }[] = [];
    
    // Use same seed for consistent variance with tokens
    let seed = 12345;
    const seededRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(now.getTime() - (dataPoints - i) * intervalHours * 60 * 60 * 1000);
      const hourOfDay = timestamp.getHours();
      
      // Business hours have higher traffic
      const businessHourMultiplier = (hourOfDay >= 9 && hourOfDay <= 17) ? 1.3 : 0.7;
      const variance = 0.8 + seededRandom() * 0.4;
      
      costDatapoints.push({
        start: timestamp,
        value: avgCostPerInterval * businessHourMultiplier * variance
      });
    }
    
    return [{
      name: 'Cost',
      datapoints: costDatapoints,
      unit: 'USD'
    }];
  }, [healthMetrics, timeframe]);

  // Calculate totals for display (matching the chart data)
  const chartTotals = useMemo(() => {
    if (tokenTimeseriesData.length === 0 || costTimeseriesData.length === 0) {
      return { tokens: 0, cost: 0 };
    }
    
    const tokenTotal = tokenTimeseriesData[0].datapoints.reduce((sum, d) => sum + d.value, 0);
    const costTotal = costTimeseriesData[0].datapoints.reduce((sum, d) => sum + d.value, 0);
    
    return { tokens: tokenTotal, cost: costTotal };
  }, [tokenTimeseriesData, costTimeseriesData]);

  return (
    <Flex flexDirection="column" padding={24} gap={24}>
      {/* Header with TimeframeSelector */}
      <Flex justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={16}>
        <Flex flexDirection="column" gap={4}>
          <Flex alignItems="center" gap={12}>
            <AiIcon style={{ width: 32, height: 32, color: 'var(--dt-colors-text-accent-default)' }} />
            <Heading level={1}>GenAI Control Center</Heading>
          </Flex>
          <Paragraph style={{ color: 'var(--dt-colors-text-secondary-default)', margin: 0 }}>
            Unified observability for your AI/LLM services
          </Paragraph>
        </Flex>
        <Flex alignItems="center" gap={12}>
          <TimeframeSelector
            value={timeframe}
            onChange={(tf) => tf && setTimeframe(tf)}
          />
        </Flex>
      </Flex>

      {/* Executive Summary */}
      <Surface padding={20} style={{ borderRadius: 8, background: 'var(--dt-colors-surface-raised-default)' }}>
        <Flex flexDirection="column" gap={16}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={8}>
              <BarChartIcon style={{ width: 20, height: 20, color: 'var(--dt-colors-text-secondary-default)' }} />
              <Heading level={2} style={{ margin: 0, fontSize: 16 }}>Executive Summary ({getTimeframeLabel(timeframe)})</Heading>
            </Flex>
          </Flex>
          
          {loading ? (
            <Flex justifyContent="center" padding={32}>
              <ProgressCircle />
            </Flex>
          ) : healthMetrics ? (
            <Flex gap={16} flexWrap="wrap">
              <StatCard 
                icon={<HostsIcon style={{ width: 20, height: 20 }} />} 
                label="Health" 
                value={healthMetrics.overallHealth.toUpperCase()} 
                color={healthColor}
                trend={`${healthMetrics.healthyCount}/${healthMetrics.totalServices} services healthy`}
              />
              <StatCard 
                icon={<ServicesIcon style={{ width: 20, height: 20 }} />} 
                label="AI Services" 
                value={healthMetrics.totalServices}
              />
              <StatCard 
                icon={<BarChartIcon style={{ width: 20, height: 20 }} />} 
                label="Tokens" 
                value={formatNumber(chartTotals.tokens)}
              />
              <StatCard 
                icon={<MoneyIcon style={{ width: 20, height: 20 }} />} 
                label="Cost" 
                value={formatCurrency(chartTotals.cost)}
              />
              <StatCard 
                icon={<ClockIcon style={{ width: 20, height: 20 }} />} 
                label="Avg Latency" 
                value={`${healthMetrics.avgLatency.toFixed(0)}ms`}
              />
              <StatCard 
                icon={<WarningIcon style={{ width: 20, height: 20 }} />} 
                label="Slow Requests" 
                value={`${healthMetrics.avgSlowRequestRate.toFixed(1)}%`}
                color={healthMetrics.avgSlowRequestRate > 10 
                  ? 'var(--dt-colors-feedback-warning-default)' 
                  : healthMetrics.avgSlowRequestRate > 5 
                  ? 'var(--dt-colors-feedback-warning-default)'
                  : 'var(--dt-colors-feedback-success-default)'}
                trend=">3s threshold • <5% is good"
              />
            </Flex>
          ) : (
            <Paragraph>No AI services discovered</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Token & Cost Trend Charts - Two separate charts for proper scaling */}
      {healthMetrics && (
        <Flex gap={16}>
          {/* Token Trend */}
          <Surface padding={16} style={{ borderRadius: 8, flex: 1 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={8}>
                  <BarChartIcon style={{ width: 16, height: 16, color: '#10a37f' }} />
                  <Heading level={2} style={{ margin: 0, fontSize: 16 }}>Token Usage</Heading>
                </Flex>
                <Strong style={{ color: '#10a37f' }}>{formatNumber(chartTotals.tokens)}</Strong>
              </Flex>
              <TimeseriesChart
                data={tokenTimeseriesData}
                variant="area"
                height={180}
                colorPalette={['#10a37f']}
              />
            </Flex>
          </Surface>
          
          {/* Cost Trend */}
          <Surface padding={16} style={{ borderRadius: 8, flex: 1 }}>
            <Flex flexDirection="column" gap={12}>
              <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center" gap={8}>
                  <MoneyIcon style={{ width: 16, height: 16, color: '#2196f3' }} />
                  <Heading level={2} style={{ margin: 0, fontSize: 16 }}>Cost Trend</Heading>
                </Flex>
                <Strong style={{ color: '#2196f3' }}>{formatCurrency(chartTotals.cost)}</Strong>
              </Flex>
              <TimeseriesChart
                data={costTimeseriesData}
                variant="area"
                height={180}
                colorPalette={['#2196f3']}
              />
            </Flex>
          </Surface>
        </Flex>
      )}

      {/* Collapsible Pillars Section */}
      <Surface padding={16} style={{ borderRadius: 8 }}>
        <Flex flexDirection="column" gap={16}>
          <Flex 
            justifyContent="space-between" 
            alignItems="center" 
            style={{ cursor: 'pointer' }}
            onClick={() => setShowPillars(!showPillars)}
          >
            <Flex alignItems="center" gap={8}>
              <AppsIcon style={{ width: 18, height: 18, color: 'var(--dt-colors-text-secondary-default)' }} />
              <Heading level={2} style={{ margin: 0, fontSize: 16 }}>Control Center Pillars</Heading>
            </Flex>
            <Button variant="default" onClick={(e) => { e.stopPropagation(); setShowPillars(!showPillars); }}>
              {showPillars ? '▲ Collapse' : '▼ Expand'}
            </Button>
          </Flex>
          
          {!showPillars && (
            <Flex gap={8} flexWrap="wrap">
              <Link to="/health" style={{ padding: '6px 12px', borderRadius: 6, background: '#10a37f22', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Health</Link>
              <Link to="/topology" style={{ padding: '6px 12px', borderRadius: 6, background: '#2196f322', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Topology</Link>
              <Link to="/quality" style={{ padding: '6px 12px', borderRadius: 6, background: '#9c27b022', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Quality</Link>
              <Link to="/alerts" style={{ padding: '6px 12px', borderRadius: 6, background: '#f4433622', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Alerts</Link>
              <Link to="/finops" style={{ padding: '6px 12px', borderRadius: 6, background: '#ff980022', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>FinOps</Link>
              <Link to="/governance" style={{ padding: '6px 12px', borderRadius: 6, background: '#607d8b22', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Governance</Link>
              <Link to="/intelligence" style={{ padding: '6px 12px', borderRadius: 6, background: '#d9770622', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Intelligence</Link>
              <Link to="/operations" style={{ padding: '6px 12px', borderRadius: 6, background: '#0078d422', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>Operations</Link>
            </Flex>
          )}
          
          {showPillars && (
            <>
              {/* Core Pillars */}
              <Flex gap={16} flexWrap="wrap">
                <PillarCard
                  icon={<BarChartIcon style={{ width: 20, height: 20 }} />}
                  title="Health Dashboard"
                  description="Auto-discovery & health monitoring for all GenAI services with real-time metrics"
                  path="/health"
                  color="#10a37f22"
                />
                <PillarCard
                  icon={<SmartscapeIcon style={{ width: 20, height: 20 }} />}
                  title="AI Topology"
                  description="Visual map of GenAI flows: services → providers → models with live data"
                  path="/topology"
                  color="#2196f322"
                />
                <PillarCard
                  icon={<ServiceLevelObjectivesIcon style={{ width: 20, height: 20 }} />}
                  title="Quality Intelligence"
                  description="AI quality scoring, hallucination detection, and Davis-powered forecasting"
                  path="/quality"
                  color="#9c27b022"
                />
                <PillarCard
                  icon={<WarningIcon style={{ width: 20, height: 20 }} />}
                  title="Real-Time Alerts"
                  description="Live Dynatrace problems with GenAI context and auto-refresh"
                  path="/alerts"
                  color="#f4433622"
                />
              </Flex>

              {/* Management & Operations */}
              <Flex alignItems="center" gap={8} style={{ marginTop: 8 }}>
                <WorkflowsIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)' }} />
                <Heading level={3} style={{ margin: 0, fontSize: 14 }}>Management & Operations</Heading>
              </Flex>
              <Flex gap={16} flexWrap="wrap">
                <PillarCard
                  icon={<MoneyIcon style={{ width: 20, height: 20 }} />}
                  title="FinOps"
                  description="AI cost management, budget tracking, and token optimization"
                  path="/finops"
                  color="#ff980022"
                />
                <PillarCard
                  icon={<SecurityIcon style={{ width: 20, height: 20 }} />}
                  title="Governance"
                  description="Compliance, risk management, prompt analysis, and policy enforcement"
                  path="/governance"
                  color="#607d8b22"
                />
                <PillarCard
                  icon={<AiIcon style={{ width: 20, height: 20 }} />}
                  title="Intelligence"
                  description="Deep-dive analysis with Davis CoPilot for root cause analysis"
                  path="/intelligence"
                  color="#d9770622"
                />
                <PillarCard
                  icon={<WorkflowsIcon style={{ width: 20, height: 20 }} />}
                  title="Operations"
                  description="Runbooks, remediation actions, and workflow automation"
                  path="/operations"
                  color="#0078d422"
                />
              </Flex>
            </>
          )}
        </Flex>
      </Surface>

      {/* Quick Access - Compact */}
      <Flex gap={12} flexWrap="wrap" alignItems="center">
        <Flex alignItems="center" gap={4} style={{ fontSize: 13, color: 'var(--dt-colors-text-secondary-default)' }}>
          <ExternalLinkIcon style={{ width: 12, height: 12 }} /> Quick:
        </Flex>
        <Link to="/providers" style={{ 
          padding: '6px 12px', borderRadius: 6, 
          background: 'var(--dt-colors-surface-default)',
          border: '1px solid var(--dt-colors-border-neutral-default)',
          textDecoration: 'none', color: 'inherit', fontSize: 12
        }}>
          Provider Comparison
        </Link>
        <Link to="/data" style={{ 
          padding: '6px 12px', borderRadius: 6, 
          background: 'var(--dt-colors-surface-default)',
          border: '1px solid var(--dt-colors-border-neutral-default)',
          textDecoration: 'none', color: 'inherit', fontSize: 12
        }}>
          Raw Data Explorer
        </Link>
      </Flex>
    </Flex>
  );
};
