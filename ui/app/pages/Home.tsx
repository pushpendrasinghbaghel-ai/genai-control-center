import React from "react";
import { Link } from "react-router-dom";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useAIServicesDiscovery } from "../hooks";
import { calculateOverallHealth, formatNumber, formatCurrency } from "../utils";

// Quick stat card for the executive dashboard
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: string;
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
        <span style={{ fontSize: 20 }}>{icon}</span>
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
  icon: string;
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
            fontSize: 20
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

  return (
    <Flex flexDirection="column" padding={24} gap={24}>
      {/* Header */}
      <Flex flexDirection="column" gap={4}>
        <Heading level={1}>🤖 GenAI Control Center</Heading>
        <Paragraph style={{ color: 'var(--dt-colors-text-secondary-default)', margin: 0 }}>
          Unified observability for your AI/LLM services
        </Paragraph>
      </Flex>

      {/* Executive Summary */}
      <Surface padding={20} style={{ borderRadius: 8, background: 'var(--dt-colors-surface-raised-default)' }}>
        <Flex flexDirection="column" gap={16}>
          <Heading level={2} style={{ margin: 0, fontSize: 16 }}>📊 Executive Summary (Last 24h)</Heading>
          
          {loading ? (
            <Flex justifyContent="center" padding={32}>
              <ProgressCircle />
            </Flex>
          ) : healthMetrics ? (
            <Flex gap={16} flexWrap="wrap">
              <StatCard 
                icon="💚" 
                label="Health" 
                value={healthMetrics.overallHealth.toUpperCase()} 
                color={healthColor}
                trend={`${healthMetrics.healthyCount}/${healthMetrics.totalServices} services healthy`}
              />
              <StatCard 
                icon="🤖" 
                label="AI Services" 
                value={healthMetrics.totalServices}
              />
              <StatCard 
                icon="📊" 
                label="Tokens" 
                value={formatNumber(healthMetrics.totalTokensToday)}
              />
              <StatCard 
                icon="💰" 
                label="Cost" 
                value={formatCurrency(healthMetrics.totalCostToday)}
              />
              <StatCard 
                icon="⚡" 
                label="Avg Latency" 
                value={`${healthMetrics.avgLatency.toFixed(0)}ms`}
              />
              <StatCard 
                icon="🐢" 
                label="Slow Requests" 
                value={`${healthMetrics.avgSlowRequestRate.toFixed(1)}%`}
                color={healthMetrics.avgSlowRequestRate > 10 ? 'var(--dt-colors-feedback-warning-default)' : undefined}
              />
            </Flex>
          ) : (
            <Paragraph>No AI services discovered</Paragraph>
          )}
        </Flex>
      </Surface>

      {/* Four Pillars Navigation */}
      <Flex flexDirection="column" gap={16}>
        <Heading level={2} style={{ margin: 0, fontSize: 16 }}>🎯 Control Center Pillars</Heading>
        
        <Flex gap={16} flexWrap="wrap">
          <PillarCard
            icon="📊"
            title="Health Dashboard"
            description="Auto-discovery & health monitoring for all GenAI services with real-time metrics"
            path="/health"
            color="#10a37f22"
          />
          <PillarCard
            icon="🧠"
            title="AI Architect"
            description="Pattern detection, recommendations, and optimization insights powered by Davis AI"
            path="/ai-architect"
            color="#4285f422"
          />
          <PillarCard
            icon="🔍"
            title="AI Investigation"
            description="Deep-dive analysis with Davis CoPilot for root cause analysis and troubleshooting"
            path="/intelligence"
            color="#d9770622"
          />
          <PillarCard
            icon="⚡"
            title="Automation"
            description="Runbooks, remediation actions, and one-click responses to incidents"
            path="/operations"
            color="#0078d422"
          />
        </Flex>
      </Flex>

      {/* Quick Links */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={2} style={{ margin: 0, fontSize: 16 }}>🔗 Quick Access</Heading>
        <Flex gap={12} flexWrap="wrap">
          <Link to="/governance" style={{ 
            padding: '8px 16px', borderRadius: 6, 
            background: 'var(--dt-colors-surface-default)',
            border: '1px solid var(--dt-colors-border-neutral-default)',
            textDecoration: 'none', color: 'inherit', fontSize: 13
          }}>
            🛡️ Governance & Compliance
          </Link>
          <Link to="/finops" style={{ 
            padding: '8px 16px', borderRadius: 6, 
            background: 'var(--dt-colors-surface-default)',
            border: '1px solid var(--dt-colors-border-neutral-default)',
            textDecoration: 'none', color: 'inherit', fontSize: 13
          }}>
            💵 FinOps & Cost Management
          </Link>
          <Link to="/providers" style={{ 
            padding: '8px 16px', borderRadius: 6, 
            background: 'var(--dt-colors-surface-default)',
            border: '1px solid var(--dt-colors-border-neutral-default)',
            textDecoration: 'none', color: 'inherit', fontSize: 13
          }}>
            🔄 Provider Comparison
          </Link>
        </Flex>
      </Flex>
    </Flex>
  );
};
