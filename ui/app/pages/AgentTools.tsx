// GenAI Control Center - Agent Tools Dashboard
// Monitor AI agent tool usage, detect infinite loops, and analyze agent workflows

import React, { useEffect, useMemo, useState } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components-preview/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Tooltip, Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { TextInput } from '@dynatrace/strato-components-preview/forms';
import { TimeframeSelector } from '@dynatrace/strato-components-preview/filters';
import { 
  RefreshIcon, WarningIcon, CheckmarkIcon, CriticalIcon, 
  HelpIcon, SettingIcon, WorkflowsIcon, BarChartIcon,
  ExternalLinkIcon, SmartscapeIcon
} from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import { useAgentTools } from '../hooks/useAgentTools';
import { SampleDataBadge } from '../components';
import { useGlobalFilters } from '../context';
import { formatNumber } from '../utils';
import type { ToolUsage, AgentFlow, SuspiciousLoop, AgentInfo, AgentTokenCost, AgentHandoff, AgentLatencyBreakdown, AgentToolReliability, ToolCoOccurrence } from '../hooks/useAgentTools';
import type { QueryFilters } from '../hooks/useDQLQueries';

// ============================================
// Status Colors (consistent with other pages)
// ============================================
const STATUS_COLORS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
};

// Tool Flow Node Colors - Explicit hex values for SVG compatibility
// Starting with purple to differentiate from Agent (blue)
const FLOW_COLORS = [
  '#6f2da8', // Purple (Tool default)
  '#00b4a0', // Teal
  '#73be28', // Green
  '#ef8b2f', // Orange
  '#e6457a', // Pink
  '#f5d30f', // Yellow
  '#2ab6f4', // Light blue
  '#9b59b6', // Violet
];

// SVG Topology Node Types - Dynatrace standard colors
const NODE_CONFIGS = {
  agent: { label: 'Agent', color: '#14a8f5', bgColor: '#14a8f5' },  // Dynatrace blue
  tool: { label: 'Tool', color: '#6f2da8', bgColor: '#6f2da8' },    // Purple
};

/**
 * Format duration intelligently: show seconds for >= 1000ms, otherwise ms
 */
const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
};

/**
 * Navigate directly to Distributed Traces app for a specific trace
 * Uses Governance-style pattern with view-trace intent
 */
const openTraceInDistributedTraces = (traceId: string, timestamp?: string): void => {
  // Calculate the window around the timestamp if provided
  const timeDate = timestamp ? new Date(timestamp) : new Date();
  const startTime = new Date(timeDate.getTime() - 10 * 60 * 1000).toISOString();
  const endTime = new Date(timeDate.getTime() + 10 * 60 * 1000).toISOString();

  const intentUrl = getIntentLink(
    { 
      'trace_id': traceId,
      'dt.timeframe': {
        from: startTime,
        to: endTime
      }
    },
    'dynatrace.distributedtracing',
    'view-trace'
  );
  
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

// ============================================
// Metric Card Component (consistent styling)
// ============================================
const MetricCard: React.FC<{ 
  value: string | number; 
  label: string; 
  icon: React.ReactNode; 
  color?: string;
  tooltip?: string;
}> = ({ value, label, icon, color, tooltip }) => (
  <Flex 
    alignItems="center" 
    gap={8} 
    padding={12}
    style={{ 
      background: 'var(--dt-colors-surface-default)',
      borderRadius: 6,
      border: '1px solid var(--dt-colors-border-neutral-default)',
      flex: '1 1 160px'
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || 'inherit', lineHeight: 1.2 }}>{value}</div>
      <Flex alignItems="center" gap={4}>
        <div style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>{label}</div>
        {tooltip && (
          <Tooltip text={tooltip}>
            <HelpIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
          </Tooltip>
        )}
      </Flex>
    </div>
  </Flex>
);

// ============================================
// Health Cell Component for DataTable
// ============================================
const HealthCell: React.FC<{ health: 'healthy' | 'warning' | 'critical' }> = ({ health }) => {
  const configs = {
    healthy: { icon: CheckmarkIcon, color: STATUS_COLORS.ideal, label: 'Healthy' },
    warning: { icon: WarningIcon, color: STATUS_COLORS.warning, label: 'Warning' },
    critical: { icon: CriticalIcon, color: STATUS_COLORS.critical, label: 'Critical' }
  };
  const config = configs[health];
  const Icon = config.icon;
  
  return (
    <Flex alignItems="center" gap={4}>
      <Icon style={{ color: config.color, width: 14, height: 14 }} />
      <Text style={{ fontSize: 12, color: config.color }}>{config.label}</Text>
    </Flex>
  );
};

// ============================================
// Flow Detail Modal - SVG Topology (AITopology style)
// ============================================
interface FlowDetailModalProps {
  flow: AgentFlow;
  onClose: () => void;
}

const FlowDetailModal: React.FC<FlowDetailModalProps> = ({ flow, onClose }) => {
  // Calculate SVG dimensions based on number of tools
  const cardWidth = 120;
  const cardHeight = 70;
  const horizontalGap = 60;
  const nodeCount = flow.toolSequence.length + 1; // +1 for agent node
  const svgWidth = Math.max(600, nodeCount * (cardWidth + horizontalGap) + 40);
  const svgHeight = 180;
  
  // Calculate node positions
  const getNodeX = (index: number) => {
    const totalWidth = nodeCount * cardWidth + (nodeCount - 1) * horizontalGap;
    const startX = (svgWidth - totalWidth) / 2 + cardWidth / 2;
    return startX + index * (cardWidth + horizontalGap);
  };
  const nodeY = svgHeight / 2;

  return (
    <Modal 
      title={`Agent Tool Flow: ${flow.agentName}`} 
      show={true} 
      onDismiss={onClose}
      size="large"
    >
      <Flex flexDirection="column" gap={20} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        {/* Header Stats */}
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: 12, flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Occurrences</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{flow.occurrences} traces</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Avg Duration</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{flow.avgDuration.toFixed(0)}ms</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Tool Count</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{flow.toolCount}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 120px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Tools Used</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{flow.toolSequence.length}</Text>
            </Flex>
          </Surface>
        </Flex>

        {/* SVG Topology (AITopology style) */}
        <Surface style={{ padding: 0, overflow: 'auto' }}>
          <Flex flexDirection="column" gap={0}>
            <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
              <SmartscapeIcon style={{ color: Colors.Charts.Categorical.Color01.Default }} />
              <Heading level={6}>Tool Flow Topology</Heading>
              <Flex gap={12} style={{ marginLeft: 'auto' }}>
                <Flex alignItems="center" gap={4}>
                  <div style={{ width: 12, height: 12, background: NODE_CONFIGS.agent.color, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                  <Text style={{ fontSize: 11 }}>Agent</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <div style={{ width: 12, height: 12, background: NODE_CONFIGS.tool.color, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                  <Text style={{ fontSize: 11 }}>Tool</Text>
                </Flex>
              </Flex>
            </Flex>
            
            <div style={{ 
              background: '#f9fafb',
              overflow: 'auto',
              padding: '8px 0'
            }}>
              <svg 
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ display: 'block', minWidth: svgWidth }}
              >
                {/* Defs */}
                <defs>
                  <marker
                    id="arrowhead-flow"
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" fill="#9ca3af" />
                  </marker>
                  <pattern id="dotPatternFlow" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.04)" />
                  </pattern>
                </defs>

                {/* Background */}
                <rect width="100%" height="100%" fill="#f9fafb" />
                <rect width="100%" height="100%" fill="url(#dotPatternFlow)" />

                {/* Edges (lines between nodes) */}
                {flow.toolSequence.map((_, idx) => {
                  const sourceX = getNodeX(idx) + cardWidth / 2;
                  const targetX = getNodeX(idx + 1) - cardWidth / 2;
                  return (
                    <g key={`edge-${idx}`}>
                      <line
                        x1={sourceX + 6}
                        y1={nodeY}
                        x2={targetX - 6}
                        y2={nodeY}
                        stroke="#9ca3af"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead-flow)"
                      />
                      {/* Step number badge */}
                      <rect
                        x={(sourceX + targetX) / 2 - 12}
                        y={nodeY - 8}
                        width={24}
                        height={16}
                        rx={3}
                        fill="#ffffff"
                        stroke="#e5e7eb"
                        strokeWidth={1}
                      />
                      <text
                        x={(sourceX + targetX) / 2}
                        y={nodeY + 4}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={500}
                        fill="#6b7280"
                      >
                        #{idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Agent Node (first) */}
                <g transform={`translate(${getNodeX(0) - cardWidth/2}, ${nodeY - cardHeight/2})`}>
                  {/* Card background */}
                  <rect
                    width={cardWidth}
                    height={cardHeight}
                    rx={5}
                    fill="#ffffff"
                    stroke={NODE_CONFIGS.agent.color}
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }}
                  />
                  {/* Type label header - solid color */}
                  <rect
                    width={cardWidth}
                    height={20}
                    rx={5}
                    fill={NODE_CONFIGS.agent.bgColor}
                  />
                  <rect y={12} width={cardWidth} height={8} fill={NODE_CONFIGS.agent.bgColor} />
                  <text x={8} y={14} fontSize={9} fontWeight={600} fill="#ffffff" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Agent
                  </text>
                  {/* Hexagon icon */}
                  <g transform={`translate(${cardWidth/2}, 38)`}>
                    <polygon
                      points="0,-12 10,-6 10,6 0,12 -10,6 -10,-6"
                      fill="#ffffff"
                      stroke={NODE_CONFIGS.agent.color}
                      strokeWidth={1.5}
                    />
                    <g transform="translate(-8, -8)">
                      <WorkflowsIcon style={{ width: 16, height: 16, color: NODE_CONFIGS.agent.color }} />
                    </g>
                  </g>
                  {/* Entity name */}
                  <text
                    x={cardWidth / 2}
                    y={62}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="#1f2937"
                  >
                    {flow.agentName.length > 14 ? flow.agentName.substring(0, 12) + '...' : flow.agentName}
                  </text>
                </g>

                {/* Tool Nodes */}
                {flow.toolSequence.map((tool, idx) => {
                  const toolColor = FLOW_COLORS[idx % FLOW_COLORS.length];
                  const nodeX = getNodeX(idx + 1);
                  return (
                    <g key={`tool-${idx}`} transform={`translate(${nodeX - cardWidth/2}, ${nodeY - cardHeight/2})`}>
                      {/* Card background */}
                      <rect
                        width={cardWidth}
                        height={cardHeight}
                        rx={5}
                        fill="#ffffff"
                        stroke={toolColor}
                        strokeWidth={1.5}
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
                      />
                      {/* Type label header - solid color */}
                      <rect
                        width={cardWidth}
                        height={20}
                        rx={5}
                        fill={toolColor}
                      />
                      <rect y={12} width={cardWidth} height={8} fill={toolColor} />
                      <text x={8} y={14} fontSize={9} fontWeight={600} fill="#ffffff" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Tool
                      </text>
                      <text x={cardWidth - 8} y={14} fontSize={9} fontWeight={600} fill="#ffffff" textAnchor="end">
                        #{idx + 1}
                      </text>
                      {/* Hexagon icon */}
                      <g transform={`translate(${cardWidth/2}, 38)`}>
                        <polygon
                          points="0,-12 10,-6 10,6 0,12 -10,6 -10,-6"
                          fill="#ffffff"
                          stroke={toolColor}
                          strokeWidth={1.5}
                        />
                        <g transform="translate(-8, -8)">
                          <SettingIcon style={{ width: 16, height: 16, color: toolColor }} />
                        </g>
                      </g>
                      {/* Tool name */}
                      <text
                        x={cardWidth / 2}
                        y={62}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="#1f2937"
                      >
                        {tool.length > 14 ? tool.substring(0, 12) + '...' : tool}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Flex>
        </Surface>

        {/* Tool Sequence Detail List */}
        <Surface style={{ padding: 16 }}>
          <Flex flexDirection="column" gap={12}>
            <Heading level={6}>Tool Sequence Detail</Heading>
            <Flex flexDirection="column" gap={8}>
              {flow.toolSequence.map((tool, idx) => (
                <Flex 
                  key={`detail-${tool}-${idx}`}
                  alignItems="center" 
                  gap={12}
                  padding={8}
                  style={{ 
                    background: 'var(--dt-colors-background-container-neutral-subdued)',
                    borderRadius: 4,
                    borderLeft: `3px solid ${FLOW_COLORS[idx % FLOW_COLORS.length]}`
                  }}
                >
                  <Flex 
                    alignItems="center" 
                    justifyContent="center"
                    style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: 4,
                      background: FLOW_COLORS[idx % FLOW_COLORS.length],
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {idx + 1}
                  </Flex>
                  <Text style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-word' }}>
                    {tool}
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Surface>

        {/* Actions */}
        <Flex gap={12} justifyContent="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          {flow.traceId && (
            <Button 
              variant="emphasized" 
              onClick={() => openTraceInDistributedTraces(flow.traceId!, flow.timestamp)}
            >
              <Button.Prefix><ExternalLinkIcon /></Button.Prefix>
              View Sample Trace
            </Button>
          )}
        </Flex>
      </Flex>
    </Modal>
  );
};

// ============================================
// Loop Alert Banner
// ============================================
const LoopAlertBanner: React.FC<{ loops: SuspiciousLoop[] }> = ({ loops }) => {
  if (loops.length === 0) return null;

  const topLoop = loops[0];
  const additionalCount = loops.length - 1;

  return (
    <Flex
      padding={16}
      gap={12}
      alignItems="center"
      style={{
        background: 'var(--dt-colors-background-critical-accent)',
        borderRadius: 8,
        border: `1px solid ${STATUS_COLORS.critical}`
      }}
    >
      <CriticalIcon style={{ color: STATUS_COLORS.critical, width: 24, height: 24 }} />
      <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
        <Text style={{ fontWeight: 600, color: STATUS_COLORS.critical }}>
          ⚠️ Potential Infinite Loop Detected
        </Text>
        <Text style={{ fontSize: 13 }}>
          Tool "{topLoop.toolName}" was called {topLoop.callCount} times in a single trace by {topLoop.agentName}.
          {additionalCount > 0 && ` (+${additionalCount} more suspicious patterns)`}
        </Text>
      </Flex>
      <Tooltip text="Traces with >10 calls to the same tool may indicate runaway agent behavior">
        <HelpIcon style={{ color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
      </Tooltip>
    </Flex>
  );
};

// ============================================
// Tool Flow Visualization
// ============================================
const ToolFlowCard: React.FC<{ 
  flow: AgentFlow;
  onViewDetails: () => void;
}> = ({ flow, onViewDetails }) => (
  <Flex
    padding={12}
    gap={16}
    alignItems="center"
    style={{
      background: 'var(--dt-colors-surface-default)',
      borderRadius: 6,
      border: '1px solid var(--dt-colors-border-neutral-default)'
    }}
  >
    <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
      <Text style={{ fontWeight: 600, fontSize: 13 }}>{flow.agentName}</Text>
      <Text style={{ 
        fontFamily: 'monospace', 
        fontSize: 11, 
        color: 'var(--dt-colors-text-secondary-default)',
        wordBreak: 'break-word'
      }}>
        {flow.toolSequence.join(' → ')}
      </Text>
    </Flex>
    <Flex alignItems="center" gap={12}>
      <Flex flexDirection="column" alignItems="flex-end" gap={2}>
        <Text style={{ fontWeight: 600 }}>{flow.occurrences} traces</Text>
        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
          {flow.avgDuration.toFixed(0)}ms avg
        </Text>
      </Flex>
      <Tooltip text="View flow topology and open in Distributed Traces">
        <Button variant="default" onClick={onViewDetails}>
          <SmartscapeIcon />
        </Button>
      </Tooltip>
    </Flex>
  </Flex>
);

// ============================================
// Tool Topology SVG Visualization
// ============================================
interface ToolTopologySVGProps {
  toolCoOccurrence: ToolCoOccurrence[];
  toolUsage: ToolUsage[];
}

const ToolTopologySVG: React.FC<ToolTopologySVGProps> = ({ toolCoOccurrence, toolUsage }) => {
  // Create a list of unique tools from co-occurrence data
  const uniqueTools = useMemo(() => {
    const toolSet = new Set<string>();
    toolCoOccurrence.forEach(co => {
      toolSet.add(co.tool1);
      toolSet.add(co.tool2);
    });
    return Array.from(toolSet);
  }, [toolCoOccurrence]);

  // Create a map of tool usage data for sizing and coloring nodes
  const toolUsageMap = useMemo(() => {
    return new Map(toolUsage.map(t => [t.toolName, t]));
  }, [toolUsage]);

  // Calculate max co-occurrence for edge thickness scaling
  const maxCoOccurrence = useMemo(() => {
    return Math.max(...toolCoOccurrence.map(co => co.coOccurrenceCount), 1);
  }, [toolCoOccurrence]);

  // Layout: Arrange tools in a circular layout
  const nodeCount = uniqueTools.length;
  const svgWidth = 800;
  const svgHeight = 300;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = Math.min(svgWidth, svgHeight) * 0.35;

  // Calculate node positions in a circle
  const nodePositions = useMemo(() => {
    const positions: { [key: string]: { x: number; y: number } } = {};
    
    if (nodeCount <= 1) {
      uniqueTools.forEach((tool) => {
        positions[tool] = { x: centerX, y: centerY };
      });
      return positions;
    }
    
    uniqueTools.forEach((tool, index) => {
      const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
      positions[tool] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
    return positions;
  }, [uniqueTools, nodeCount, centerX, centerY, radius]);

  // Calculate node sizes based on call count (min 20, max 35)
  const getNodeSize = (toolName: string): number => {
    const usage = toolUsageMap.get(toolName);
    if (!usage || toolUsage.length === 0) return 25;
    const maxCalls = Math.max(...toolUsage.map(t => t.callCount));
    const ratio = usage.callCount / maxCalls;
    return 20 + ratio * 15;
  };

  // Get node color based on error rate
  const getNodeColor = (toolName: string): string => {
    const usage = toolUsageMap.get(toolName);
    if (!usage) return NODE_CONFIGS.tool.color;
    if (usage.errorRate > 5) return STATUS_COLORS.critical;
    if (usage.errorRate > 2) return STATUS_COLORS.warning;
    return NODE_CONFIGS.tool.color;
  };

  // Render edges (connections between tools)
  const edges = toolCoOccurrence.map((co, index) => {
    const pos1 = nodePositions[co.tool1];
    const pos2 = nodePositions[co.tool2];
    if (!pos1 || !pos2) return null;

    // Calculate edge thickness based on co-occurrence count
    const thickness = 1 + (co.coOccurrenceCount / maxCoOccurrence) * 5;
    const opacity = 0.2 + (co.coOccurrenceCount / maxCoOccurrence) * 0.4;

    return (
      <g key={`edge-${index}`}>
        <line
          x1={pos1.x}
          y1={pos1.y}
          x2={pos2.x}
          y2={pos2.y}
          stroke={NODE_CONFIGS.tool.color}
          strokeWidth={thickness}
          strokeOpacity={opacity}
        />
        {/* Show co-occurrence count on hover */}
        <title>{`${co.tool1} ↔ ${co.tool2}: ${co.coOccurrenceCount} traces`}</title>
      </g>
    );
  });

  // Render nodes
  const nodes = uniqueTools.map((toolName) => {
    const pos = nodePositions[toolName];
    if (!pos) return null;

    const size = getNodeSize(toolName);
    const color = getNodeColor(toolName);
    const usage = toolUsageMap.get(toolName);
    const hasHighError = usage && usage.errorRate > 5;

    // Truncate long tool names for display
    const displayName = toolName.length > 15 ? toolName.substring(0, 12) + '...' : toolName;

    return (
      <g key={`node-${toolName}`} style={{ cursor: 'pointer' }}>
        {/* Node circle */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={size}
          fill={color}
          stroke={hasHighError ? STATUS_COLORS.critical : 'rgba(255,255,255,0.3)'}
          strokeWidth={hasHighError ? 3 : 1}
        />
        
        {/* Error indicator */}
        {hasHighError && (
          <text
            x={pos.x}
            y={pos.y + 4}
            textAnchor="middle"
            fill="white"
            fontSize={12}
            fontWeight="bold"
          >
            !
          </text>
        )}
        
        {/* Tool name label */}
        <text
          x={pos.x}
          y={pos.y + size + 14}
          textAnchor="middle"
          fill="var(--dt-colors-text-primary-default)"
          fontSize={10}
          fontFamily="monospace"
        >
          {displayName}
        </text>
        
        {/* Tooltip with full info */}
        <title>
          {`${toolName}\nCalls: ${usage?.callCount ?? 'N/A'}\nError Rate: ${usage?.errorRate?.toFixed(1) ?? 'N/A'}%`}
        </title>
      </g>
    );
  });

  if (uniqueTools.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          fill="var(--dt-colors-text-secondary-default)"
          fontSize={14}
        >
          No tool co-occurrence data available
        </text>
      </svg>
    );
  }

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ minHeight: 280 }}
    >
      {/* Edges first so nodes appear on top */}
      <g className="edges">{edges}</g>
      
      {/* Nodes */}
      <g className="nodes">{nodes}</g>
      
      {/* Center label */}
      <text
        x={centerX}
        y={20}
        textAnchor="middle"
        fill="var(--dt-colors-text-secondary-default)"
        fontSize={11}
      >
        {uniqueTools.length} tools • {toolCoOccurrence.length} connections
      </text>
    </svg>
  );
};

// ============================================
// Main Component
// ============================================
export const AgentTools: React.FC = () => {
  // Use global filters from context
  const { filters, setFilters, updateFilter } = useGlobalFilters();
  
  // Local filter state for tool/agent name filtering
  const [toolFilter, setToolFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  
  // Modal state for flow details
  const [selectedFlow, setSelectedFlow] = useState<AgentFlow | null>(null);
  
  // Convert to QueryFilters for the hook
  const queryFilters = useMemo(() => ({
    timeframe: filters.timeframe
  }), [filters.timeframe]);

  const { 
    toolUsage, 
    agentList,
    suspiciousLoops, 
    agentFlows, 
    summary,
    agentTokenCosts,
    agentHandoffs,
    agentLatency,
    agentToolReliability,
    toolCoOccurrence,
    loading, 
    error, 
    fetchAgentToolsData,
    getToolHealth
  } = useAgentTools(queryFilters);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchAgentToolsData();
  }, [fetchAgentToolsData, filters.timeframe]);

  // Filter data based on local filters
  const filteredToolUsage = useMemo(() => {
    let data = toolUsage;
    if (toolFilter) {
      data = data.filter(t => t.toolName.toLowerCase().includes(toolFilter.toLowerCase()));
    }
    return data;
  }, [toolUsage, toolFilter]);

  const filteredAgentFlows = useMemo(() => {
    let data = agentFlows;
    if (agentFilter) {
      data = data.filter(f => f.agentName.toLowerCase().includes(agentFilter.toLowerCase()));
    }
    if (toolFilter) {
      data = data.filter(f => f.toolSequence.some(t => t.toLowerCase().includes(toolFilter.toLowerCase())));
    }
    return data;
  }, [agentFlows, agentFilter, toolFilter]);

  // Filter agent list and merge with latency data
  const filteredAgentList = useMemo(() => {
    // Create lookup maps for latency and token cost data
    const latencyMap = new Map(agentLatency.map(l => [l.agentName, l]));
    const tokenCostMap = new Map(agentTokenCosts.map(t => [t.agentName, t]));
    
    // Merge agent list with latency and token cost data
    let data = agentList.map(agent => {
      const latency = latencyMap.get(agent.agentName);
      const tokenCost = tokenCostMap.get(agent.agentName);
      return {
        ...agent,
        llmPct: latency?.llmPct ?? 0,
        toolPct: latency?.toolPct ?? 0,
        inputTokens: tokenCost?.totalInputTokens ?? 0,
        outputTokens: tokenCost?.totalOutputTokens ?? 0,
        totalTokens: tokenCost?.totalTokens ?? 0,
        estimatedCostUsd: tokenCost?.estimatedCostUsd ?? 0
      };
    });
    
    if (agentFilter) {
      data = data.filter(a => a.agentName.toLowerCase().includes(agentFilter.toLowerCase()));
    }
    return data;
  }, [agentList, agentLatency, agentTokenCosts, agentFilter]);

  // Prepare table columns for tool usage - using proper cell renderers
  const toolColumns: any[] = useMemo(() => [
    {
      header: 'Tool Name',
      accessor: 'toolName',
      id: 'toolName',
      cell: ({ value }: { value: string }) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {value}
        </Text>
      ),
      minWidth: 200
    },
    {
      header: 'Calls',
      accessor: 'callCount',
      id: 'callCount',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatNumber(value)}</Text>
      ),
      minWidth: 80,
      alignment: 'right'
    },
    {
      header: 'Avg Duration',
      accessor: 'avgDuration',
      id: 'avgDuration',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{Math.round(value)}ms</Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'Error Rate',
      accessor: 'errorRate',
      id: 'errorRate',
      cell: ({ value }: { value: number }) => {
        const rate = Number(value);
        const color = rate > 5 ? STATUS_COLORS.critical : rate > 2 ? STATUS_COLORS.warning : 'inherit';
        return <Text style={{ color, textAlign: 'right', display: 'block' }}>{rate.toFixed(2)}%</Text>;
      },
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Health',
      accessor: (row: ToolUsage) => getToolHealth(row),
      id: 'health',
      cell: ({ value }: { value: string }) => <HealthCell health={value as 'healthy' | 'warning' | 'critical'} />,
      minWidth: 90
    }
  ], [getToolHealth]);

  // Prepare table columns for agents
  const agentColumns: any[] = useMemo(() => [
    {
      header: 'Agent Name',
      accessor: 'agentName',
      id: 'agentName',
      cell: ({ value }: { value: string }) => (
        <Text style={{ fontWeight: 600 }}>
          {value}
        </Text>
      ),
      minWidth: 180
    },
    {
      header: 'Tool Calls',
      accessor: 'toolCallCount',
      id: 'toolCallCount',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatNumber(value)}</Text>
      ),
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Avg Tools/Trace',
      accessor: 'avgToolsPerTrace',
      id: 'avgToolsPerTrace',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{Number(value).toFixed(1)}</Text>
      ),
      minWidth: 110,
      alignment: 'right'
    },
    {
      header: 'Avg Duration',
      accessor: 'avgDuration',
      id: 'avgDuration',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDuration(value)}</Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'Input Tokens',
      accessor: 'inputTokens',
      id: 'inputTokens',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>
          {value > 0 ? formatNumber(value) : '-'}
        </Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'Output Tokens',
      accessor: 'outputTokens',
      id: 'outputTokens',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>
          {value > 0 ? formatNumber(value) : '-'}
        </Text>
      ),
      minWidth: 110,
      alignment: 'right'
    },
    {
      header: 'Total Tokens',
      accessor: 'totalTokens',
      id: 'totalTokens',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
          {value > 0 ? formatNumber(value) : '-'}
        </Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'LLM Cost',
      accessor: 'estimatedCostUsd',
      id: 'estimatedCostUsd',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block', color: value > 0 ? Colors.Charts.Categorical.Color01.Default : 'inherit', fontWeight: value > 0 ? 600 : 400 }}>
          {value > 0 ? `$${Number(value).toFixed(2)}` : '-'}
        </Text>
      ),
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'LLM / Tool',
      accessor: 'llmPct',
      id: 'llmToolSplit',
      cell: ({ rowData }: { rowData: AgentInfo & { llmPct?: number; toolPct?: number } }) => {
        const llmPct = Math.round(Number(rowData.llmPct) || 0);
        const toolPct = Math.round(Number(rowData.toolPct) || 0);
        if (llmPct === 0 && toolPct === 0) {
          return <Text style={{ color: 'var(--dt-colors-text-secondary-default)', textAlign: 'center', display: 'block' }}>-</Text>;
        }
        return (
          <Flex alignItems="center" justifyContent="center" gap={6} style={{ width: '100%' }}>
            <div style={{ 
              width: 80,
              height: 14, 
              background: 'var(--dt-colors-background-container-neutral-subdued)',
              borderRadius: 3,
              overflow: 'hidden',
              display: 'flex'
            }}>
              <div style={{ 
                width: `${llmPct}%`, 
                height: '100%', 
                background: Colors.Charts.Categorical.Color01.Default
              }} />
              <div style={{ 
                width: `${toolPct}%`, 
                height: '100%', 
                background: Colors.Charts.Categorical.Color02.Default
              }} />
            </div>
            <Text style={{ fontSize: 10, minWidth: 55 }}>
              {llmPct}% / {toolPct}%
            </Text>
          </Flex>
        );
      },
      minWidth: 180,
      alignment: 'center'
    },
    {
      header: 'Actions',
      accessor: 'sampleTraceId',
      id: 'actions',
      cell: ({ rowData }: { rowData: AgentInfo }) => (
        <Flex justifyContent="center" style={{ width: '100%' }}>
          {rowData.sampleTraceId ? (
            <Tooltip text="View sample trace for this agent">
              <Button 
                variant="default" 
                onClick={() => openTraceInDistributedTraces(rowData.sampleTraceId!, rowData.lastSeen)}
              >
                <ExternalLinkIcon style={{ width: 14, height: 14 }} />
              </Button>
            </Tooltip>
          ) : <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>-</Text>}
        </Flex>
      ),
      autoWidth: true,
      alignment: 'center'
    }
  ], []);

  // Prepare table columns for agent flows
  const flowColumns: any[] = useMemo(() => [
    {
      header: 'Agent',
      accessor: 'agentName',
      id: 'agentName',
      cell: ({ value }: { value: string }) => (
        <Text style={{ fontWeight: 600 }}>{value}</Text>
      ),
      minWidth: 150
    },
    {
      header: 'Tool Sequence',
      accessor: 'toolSequence',
      id: 'toolSequence',
      cell: ({ value }: { value: string[] }) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {Array.isArray(value) ? value.join(' → ') : String(value)}
        </Text>
      ),
      minWidth: 250
    },
    {
      header: 'Occurrences',
      accessor: 'occurrences',
      id: 'occurrences',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{Math.round(value)} traces</Text>
      ),
      minWidth: 120,
      alignment: 'right'
    },
    {
      header: 'Avg Duration',
      accessor: 'avgDuration',
      id: 'avgDuration',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{Math.round(value)}ms</Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'Tool Count',
      accessor: 'toolCount',
      id: 'toolCount',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{value}</Text>
      ),
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Actions',
      accessor: 'traceId',
      id: 'actions',
      cell: ({ rowData }: { rowData: AgentFlow }) => (
        <Flex gap={4}>
          <Tooltip text="View flow topology">
            <Button variant="default" onClick={() => setSelectedFlow(rowData)}>
              <SmartscapeIcon style={{ width: 14, height: 14 }} />
            </Button>
          </Tooltip>
          {rowData.traceId && (
            <Tooltip text="View sample trace">
              <Button 
                variant="default" 
                onClick={() => openTraceInDistributedTraces(rowData.traceId!, rowData.timestamp)}
              >
                <ExternalLinkIcon style={{ width: 14, height: 14 }} />
              </Button>
            </Tooltip>
          )}
        </Flex>
      ),
      autoWidth: true
    }
  ], []);

  // Prepare table columns for agent handoffs
  const handoffColumns: any[] = useMemo(() => [
    {
      header: 'Source Agent',
      accessor: 'sourceAgent',
      id: 'sourceAgent',
      cell: ({ rowData }: { rowData: AgentHandoff }) => {
        const isSelfTransfer = rowData.sourceAgent === rowData.targetAgent;
        return (
          <Flex alignItems="center" gap={6}>
            <span style={{ 
              width: 10, height: 10, borderRadius: '50%', 
              backgroundColor: NODE_CONFIGS.agent.color 
            }} />
            <Text style={{ fontWeight: 600, opacity: isSelfTransfer ? 0.7 : 1 }}>{rowData.sourceAgent}</Text>
          </Flex>
        );
      },
      minWidth: 150
    },
    {
      header: '',
      accessor: 'handoffCount',
      id: 'arrow',
      cell: ({ rowData }: { rowData: AgentHandoff }) => {
        const isSelfTransfer = rowData.sourceAgent === rowData.targetAgent;
        return (
          <Flex alignItems="center" gap={4}>
            <Text style={{ color: isSelfTransfer ? STATUS_COLORS.warning : 'var(--dt-colors-text-secondary-default)' }}>
              {isSelfTransfer ? '↻' : '→'}
            </Text>
            {isSelfTransfer && (
              <Tooltip text="Self-transfer: Agent restarting its own flow">
                <Text style={{ fontSize: 9, color: STATUS_COLORS.warning, fontWeight: 600 }}>SELF</Text>
              </Tooltip>
            )}
          </Flex>
        );
      },
      autoWidth: true
    },
    {
      header: 'Target Agent',
      accessor: 'targetAgent',
      id: 'targetAgent',
      cell: ({ rowData }: { rowData: AgentHandoff }) => {
        const isSelfTransfer = rowData.sourceAgent === rowData.targetAgent;
        return (
          <Flex alignItems="center" gap={6}>
            <span style={{ 
              width: 10, height: 10, borderRadius: '50%', 
              backgroundColor: isSelfTransfer ? STATUS_COLORS.warning : Colors.Charts.Categorical.Color03.Default 
            }} />
            <Text style={{ fontWeight: 600, opacity: isSelfTransfer ? 0.7 : 1 }}>{rowData.targetAgent}</Text>
          </Flex>
        );
      },
      minWidth: 150
    },
    {
      header: 'Handoffs',
      accessor: 'handoffCount',
      id: 'handoffCount',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>{formatNumber(value)}</Text>
      ),
      minWidth: 100,
      alignment: 'right'
    },
    {
      header: 'Avg Duration',
      accessor: 'avgDurationMs',
      id: 'avgDurationMs',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDuration(value)}</Text>
      ),
      minWidth: 100,
      alignment: 'right'
    }
  ], []);

  // Prepare table columns for tool reliability (agent-tool usage patterns)
  const reliabilityColumns: any[] = useMemo(() => [
    {
      header: 'Agent',
      accessor: 'agentName',
      id: 'agentName',
      cell: ({ value }: { value: string }) => (
        <Flex alignItems="center" gap={6}>
          <span style={{ 
            width: 10, height: 10, borderRadius: '50%', 
            backgroundColor: NODE_CONFIGS.agent.color 
          }} />
          <Text style={{ fontWeight: 600 }}>{value}</Text>
        </Flex>
      ),
      minWidth: 130
    },
    {
      header: 'Tool',
      accessor: 'toolName',
      id: 'toolName',
      cell: ({ value }: { value: string }) => (
        <Flex alignItems="center" gap={6}>
          <span style={{ 
            width: 10, height: 10, borderRadius: '50%', 
            backgroundColor: NODE_CONFIGS.tool.color 
          }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{value}</Text>
        </Flex>
      ),
      minWidth: 180
    },
    {
      header: 'Calls',
      accessor: 'totalCalls',
      id: 'totalCalls',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>{formatNumber(value)}</Text>
      ),
      minWidth: 70,
      alignment: 'right'
    },
    {
      header: 'Traces',
      accessor: 'tracesCount',
      id: 'tracesCount',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatNumber(value)}</Text>
      ),
      minWidth: 70,
      alignment: 'right'
    },
    {
      header: 'Calls/Trace',
      accessor: 'callsPerTrace',
      id: 'callsPerTrace',
      cell: ({ value }: { value: number }) => {
        // Highlight if > 1 (indicates retries or repeated calls)
        const isRetry = value > 1.05;
        return (
          <Text style={{ 
            textAlign: 'right', 
            display: 'block',
            color: isRetry ? STATUS_COLORS.warning : 'inherit',
            fontWeight: isRetry ? 600 : 400
          }}>
            {value.toFixed(2)}
            {isRetry && ' ⟳'}
          </Text>
        );
      },
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Avg Duration',
      accessor: 'avgDurationMs',
      id: 'avgDurationMs',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDuration(value)}</Text>
      ),
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'P95 Duration',
      accessor: 'p95DurationMs',
      id: 'p95DurationMs',
      cell: ({ value }: { value: number }) => (
        <Text style={{ textAlign: 'right', display: 'block' }}>{formatDuration(value)}</Text>
      ),
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Error Rate',
      accessor: 'errorRate',
      id: 'errorRate',
      cell: ({ value }: { value: number }) => {
        const color = value > 5 ? STATUS_COLORS.critical : value > 2 ? STATUS_COLORS.warning : STATUS_COLORS.ideal;
        return (
          <Flex alignItems="center" gap={6} style={{ justifyContent: 'flex-end' }}>
            <Text style={{ color, fontWeight: value > 0 ? 600 : 400 }}>{value.toFixed(1)}%</Text>
            {value === 0 && <CheckmarkIcon style={{ color: STATUS_COLORS.ideal, width: 12, height: 12 }} />}
          </Flex>
        );
      },
      minWidth: 90,
      alignment: 'right'
    },
    {
      header: 'Health',
      accessor: 'errorRate',
      id: 'health',
      cell: ({ rowData }: { rowData: AgentToolReliability }) => {
        // Calculate health based on error rate and calls per trace
        const hasErrors = rowData.errorRate > 5;
        const hasRetries = rowData.callsPerTrace > 1.1;
        const health = hasErrors ? 'critical' : hasRetries ? 'warning' : 'healthy';
        return <HealthCell health={health} />;
      },
      minWidth: 90
    }
  ], []);

  // Check if we have data
  const hasData = toolUsage.length > 0 || agentFlows.length > 0;
  const isSampleData = !hasData; // Would show sample data if no real data

  return (
    <Flex flexDirection="column" gap={0} style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <TitleBar>
        <TitleBar.Title>
          <Flex alignItems="center" gap={8}>
            <SettingIcon />
            Agent Tools
            {isSampleData && <SampleDataBadge type="sample" />}
          </Flex>
        </TitleBar.Title>
        <TitleBar.Subtitle>
          Monitor AI agent tool usage, detect anomalies, and analyze workflow patterns
        </TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Button 
            variant="accent" 
            onClick={() => fetchAgentToolsData()} 
            disabled={loading}
          >
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Main Content */}
      <Flex 
        flexDirection="column" 
        gap={16} 
        padding={16}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {/* Filter Bar - TimeframeSelector with local text filters */}
        <Flex gap={12} alignItems="center" flexWrap="wrap">
          <TimeframeSelector
            value={filters.timeframe}
            onChange={(tf) => updateFilter('timeframe', tf)}
          />
          <TextInput
            value={toolFilter}
            onChange={(value) => setToolFilter(value)}
            placeholder="Filter by tool name..."
            style={{ minWidth: 180 }}
          />
          <TextInput
            value={agentFilter}
            onChange={(value) => setAgentFilter(value)}
            placeholder="Filter by agent name..."
            style={{ minWidth: 180 }}
          />
          <Button 
            variant="default" 
            onClick={() => fetchAgentToolsData()}
            disabled={loading}
          >
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </Flex>
        {/* Loading State */}
        {loading && (
          <Flex justifyContent="center" alignItems="center" padding={40}>
            <ProgressCircle aria-label="Loading agent tools data" />
            <Text style={{ marginLeft: 12 }}>Loading agent tools data...</Text>
          </Flex>
        )}

        {/* Error State */}
        {error && !loading && (
          <Surface padding={20}>
            <Flex alignItems="center" gap={8}>
              <CriticalIcon style={{ color: STATUS_COLORS.critical }} />
              <Text>Error loading data: {error.message}</Text>
              <Button variant="default" onClick={() => fetchAgentToolsData()}>
                Retry
              </Button>
            </Flex>
          </Surface>
        )}

        {/* Main Content when loaded */}
        {!loading && !error && (
          <>
            {/* Loop Detection Alert */}
            <LoopAlertBanner loops={suspiciousLoops} />

            {/* Summary Metrics */}
            {summary && (
              <Flex gap={12} flexWrap="wrap">
                <MetricCard
                  value={formatNumber(summary.totalToolCalls)}
                  label="Total Tool Calls"
                  icon={<WorkflowsIcon style={{ color: Colors.Charts.Categorical.Color01.Default }} />}
                  tooltip="Total number of tool invocations across all agents"
                />
                <MetricCard
                  value={summary.uniqueTools}
                  label="Unique Tools"
                  icon={<SettingIcon style={{ color: Colors.Charts.Categorical.Color02.Default }} />}
                  tooltip="Number of distinct tools being used"
                />
                <MetricCard
                  value={summary.avgCallsPerTrace.toFixed(1)}
                  label="Avg Calls/Trace"
                  icon={<BarChartIcon style={{ color: Colors.Charts.Categorical.Color03.Default }} />}
                  tooltip="Average number of tool calls per agent trace"
                />
                <MetricCard
                  value={summary.totalAgents}
                  label="Active Agents"
                  icon={<WorkflowsIcon style={{ color: Colors.Charts.Categorical.Color04.Default }} />}
                  tooltip="Number of distinct agents making tool calls"
                />
                <MetricCard
                  value={summary.suspiciousLoopCount}
                  label="Loop Warnings"
                  icon={<WarningIcon style={{ color: summary.suspiciousLoopCount > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal }} />}
                  color={summary.suspiciousLoopCount > 0 ? STATUS_COLORS.critical : STATUS_COLORS.ideal}
                  tooltip="Traces with >10 calls to the same tool (potential infinite loops)"
                />
              </Flex>
            )}

            {/* Agents Table */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8} flexWrap="wrap">
                  <Heading level={5}>Active Agents</Heading>
                  <Tooltip text="AI agents detected from gen_ai.agent.name or traceloop.span.kind=agent spans">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  {agentFilter && (
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      (Filtered by: {agentFilter})
                    </Text>
                  )}
                  <Flex gap={12} style={{ marginLeft: 'auto' }}>
                    <Flex alignItems="center" gap={4}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: Colors.Charts.Categorical.Color01.Default }} />
                      <Text style={{ fontSize: 11 }}>LLM</Text>
                    </Flex>
                    <Flex alignItems="center" gap={4}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: Colors.Charts.Categorical.Color02.Default }} />
                      <Text style={{ fontSize: 11 }}>Tool</Text>
                    </Flex>
                  </Flex>
                </Flex>
                
                {filteredAgentList.length > 0 ? (
                  <DataTable 
                    data={filteredAgentList} 
                    columns={agentColumns}
                    sortable
                    resizable
                  >
                    <DataTable.Pagination defaultPageSize={10} />
                  </DataTable>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No agent data found. Ensure your agents are instrumented with gen_ai.agent.name or traceloop.span.kind="agent" spans.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Tool Usage Table (Primary View - Scalable) */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <Heading level={5}>Tool Call Frequency</Heading>
                  <Tooltip text="Overview of tool usage with call counts, duration, and error rates. Sorted by call count.">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  {toolFilter && (
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      (Filtered by: {toolFilter})
                    </Text>
                  )}
                </Flex>
                
                {filteredToolUsage.length > 0 ? (
                  <DataTable 
                    data={filteredToolUsage} 
                    columns={toolColumns as any}
                    sortable
                    resizable
                  >
                    <DataTable.Pagination defaultPageSize={10} />
                  </DataTable>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No tool call data found. Ensure your agents are instrumented with gen_ai.tool.name or traceloop.span.kind="tool" spans.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Agent Tool Flows */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <Heading level={5}>Common Agent Tool Flows</Heading>
                  <Tooltip text="Most frequent tool calling sequences observed in agent traces. Shows all unique agent + tool sequence combinations.">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    ({filteredAgentFlows.length} flows)
                  </Text>
                  {agentFilter && (
                    <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                      • Filtered by: {agentFilter}
                    </Text>
                  )}
                </Flex>
                
                {filteredAgentFlows.length > 0 ? (
                  <DataTable 
                    data={filteredAgentFlows} 
                    columns={flowColumns}
                    sortable
                    resizable
                  >
                    <DataTable.Pagination defaultPageSize={10} />
                  </DataTable>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No agent flow data available. Agent flows require gen_ai.agent.name attribute in spans.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Agent Handoffs */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <Heading level={5}>Agent Handoffs</Heading>
                  <Tooltip text="Communication patterns between agents. Shows how often one agent calls or delegates to another.">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    ({agentHandoffs.length} handoff patterns)
                  </Text>
                </Flex>
                
                {agentHandoffs.length > 0 ? (
                  <DataTable 
                    data={agentHandoffs} 
                    columns={handoffColumns}
                    sortable
                    resizable
                  >
                    <DataTable.Pagination defaultPageSize={5} />
                  </DataTable>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No agent handoff data available. Handoffs are detected via parent/child agent spans within traces.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Tool Reliability - Agent-Tool Usage Patterns */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <BarChartIcon style={{ color: Colors.Charts.Categorical.Color05.Default }} />
                  <Heading level={5}>Tool Reliability</Heading>
                  <Tooltip text="Per-agent tool usage patterns including call counts, duration metrics, and error rates. Calls/Trace > 1 may indicate retry behavior.">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    ({agentToolReliability.length} agent-tool combinations)
                  </Text>
                </Flex>
                
                {agentToolReliability.length > 0 ? (
                  <DataTable 
                    data={agentToolReliability} 
                    columns={reliabilityColumns}
                    sortable
                    resizable
                  >
                    <DataTable.Pagination defaultPageSize={10} />
                  </DataTable>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No tool reliability data available. Ensure tools are instrumented with gen_ai.tool.name attribute.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Tool Topology / Co-occurrence */}
            <Surface padding={16}>
              <Flex flexDirection="column" gap={12}>
                <Flex alignItems="center" gap={8}>
                  <SmartscapeIcon style={{ color: Colors.Charts.Categorical.Color04.Default }} />
                  <Heading level={5}>Tool Topology</Heading>
                  <Tooltip text="Tools that frequently appear together in the same traces. Thicker lines indicate stronger co-occurrence.">
                    <HelpIcon style={{ width: 14, height: 14, color: 'var(--dt-colors-text-secondary-default)', cursor: 'help' }} />
                  </Tooltip>
                  <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                    ({toolCoOccurrence.length} tool relationships)
                  </Text>
                </Flex>
                
                {toolCoOccurrence.length > 0 ? (
                  <Flex flexDirection="column" gap={16}>
                    {/* SVG Topology Visualization */}
                    <div style={{ 
                      width: '100%', 
                      minHeight: 300, 
                      backgroundColor: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6,
                      overflow: 'hidden'
                    }}>
                      <ToolTopologySVG toolCoOccurrence={toolCoOccurrence} toolUsage={filteredToolUsage} />
                    </div>
                    
                    {/* Legend */}
                    <Flex gap={16} flexWrap="wrap" justifyContent="center">
                      <Flex alignItems="center" gap={6}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: NODE_CONFIGS.tool.color }} />
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Tool Node</Text>
                      </Flex>
                      <Flex alignItems="center" gap={6}>
                        <span style={{ width: 20, height: 3, backgroundColor: 'rgba(111, 45, 168, 0.4)', borderRadius: 2 }} />
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Co-occurrence (thicker = more frequent)</Text>
                      </Flex>
                      <Flex alignItems="center" gap={6}>
                        <span style={{ 
                          width: 16, height: 16, borderRadius: '50%', 
                          backgroundColor: STATUS_COLORS.critical, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: 'white', fontWeight: 600
                        }}>!</span>
                        <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>High Error Rate (&gt;5%)</Text>
                      </Flex>
                    </Flex>
                  </Flex>
                ) : (
                  <Flex 
                    padding={32} 
                    justifyContent="center"
                    style={{ 
                      background: 'var(--dt-colors-background-container-neutral-subdued)',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
                      No tool co-occurrence data available. Tools appearing together in traces will be visualized here.
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Surface>

            {/* Suspicious Loops Details (if any) */}
            {suspiciousLoops.length > 0 && (
              <Surface padding={16}>
                <Flex flexDirection="column" gap={12}>
                  <Flex alignItems="center" gap={8}>
                    <CriticalIcon style={{ color: STATUS_COLORS.critical }} />
                    <Heading level={5}>Suspicious Loop Details</Heading>
                  </Flex>
                  
                  <Flex flexDirection="column" gap={8}>
                    {suspiciousLoops.slice(0, 10).map((loop) => (
                      <Flex
                        key={`${loop.traceId}-${loop.toolName}`}
                        padding={12}
                        alignItems="center"
                        justifyContent="space-between"
                        style={{
                          background: 'var(--dt-colors-background-critical-subdued)',
                          borderRadius: 6,
                          border: `1px solid ${STATUS_COLORS.critical}`
                        }}
                      >
                        <Flex flexDirection="column" gap={2}>
                          <Text style={{ fontWeight: 600 }}>{loop.toolName}</Text>
                          <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                            Agent: {loop.agentName}
                          </Text>
                        </Flex>
                        <Flex flexDirection="column" alignItems="flex-end" gap={2}>
                          <Text style={{ fontWeight: 600, color: STATUS_COLORS.critical }}>
                            {loop.callCount} calls
                          </Text>
                          <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>
                            {loop.totalDuration.toFixed(0)}ms total
                          </Text>
                        </Flex>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              </Surface>
            )}
          </>
        )}
      </Flex>

      {/* Flow Detail Modal */}
      {selectedFlow && (
        <FlowDetailModal 
          flow={selectedFlow} 
          onClose={() => setSelectedFlow(null)} 
        />
      )}
    </Flex>
  );
};
