// AI Topology Visualization Page
// Clean Smartscape-style card-based visualization of GenAI service flows

import React, { useState, useEffect, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { TitleBar } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { ExternalLinkIcon, SmartscapeIcon, ServicesIcon, AppsIcon } from '@dynatrace/strato-icons';
import { Modal } from '@dynatrace/strato-components/overlays';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { useDistinctServices, useDistinctProviders, useDistinctModels } from '../hooks';
import { getTimeframeDqlClause } from '../context/FilterContext';
import { getProviderIcon, getModelIcon } from '../utils/providerIcons';
import { formatNumber } from '../utils/formatting';

// ============================================
// Types
// ============================================

interface TopologyNode {
  id: string;
  type: 'service' | 'provider' | 'model' | 'user';
  name: string;
  entityId?: string;
  metrics: {
    requests: number;
    tokens: number;
    latency: number;
    errorRate: number;
    cost: number;
  };
  position: { x: number; y: number };
  health: 'healthy' | 'warning' | 'critical';
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  metrics: {
    requests: number;
    tokens: number;
    avgLatency: number;
  };
}

interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  svgHeight: number;
  summary: {
    totalServices: number;
    totalProviders: number;
    totalModels: number;
    totalRequests: number;
    totalTokens: number;
  };
}

// ============================================
// Smartscape Link Helper
// ============================================

const getSmartscapeUrl = (entityId: string): string => {
  return `/ui/apps/dynatrace.classic.technologies/ui/entity/${entityId}`;
};

// ============================================
// Smartscape Card Node Component
// ============================================

const SmartscapeCardNode: React.FC<{
  node: TopologyNode;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (node: TopologyNode) => void;
  onHover: (node: TopologyNode | null) => void;
}> = ({ node, isSelected, isHovered, onSelect, onHover }) => {
  
  const getTypeConfig = (type: string, nodeName?: string) => {
    switch (type) {
      case 'service':
        return { 
          label: 'Service', 
          color: 'var(--dt-colors-charts-categorical-color-01-default)', 
          bgColor: 'rgba(20, 168, 245, 0.08)',
          icon: <ServicesIcon style={{ width: 20, height: 20 }} />
        };
      case 'provider':
        return { 
          label: 'AI Provider', 
          color: 'var(--dt-colors-charts-categorical-color-02-default)', 
          bgColor: 'rgba(111, 45, 168, 0.08)',
          icon: getProviderIcon(nodeName || '', 20)
        };
      case 'model':
        return { 
          label: 'Model', 
          color: 'var(--dt-colors-charts-categorical-color-03-default)',  // Dynatrace teal - distinct from service blue
          bgColor: 'rgba(0, 180, 160, 0.08)',
          icon: getModelIcon(nodeName || '', 18)
        };
      default:
        return { 
          label: 'Entity', 
          color: 'var(--dt-colors-charts-status-good-default)', 
          bgColor: 'rgba(115, 190, 40, 0.08)',
          icon: <AppsIcon style={{ width: 18, height: 18 }} />
        };
    }
  };

  const config = getTypeConfig(node.type, node.name);
  const cardWidth = 130;
  const cardHeight = 80;

  return (
    <g
      transform={`translate(${node.position.x - cardWidth/2}, ${node.position.y - cardHeight/2})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(node)}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Card background */}
      <rect
        width={cardWidth}
        height={cardHeight}
        rx={5}
        ry={5}
        fill='var(--dt-colors-background-surface-default)'
        stroke={isSelected ? config.color : isHovered ? config.color : 'var(--dt-colors-border-neutral-default)'}
        strokeWidth={isSelected ? 2 : 1}
        style={{
          filter: isHovered ? 'drop-shadow(0 2px 8px var(--dt-colors-shadow-default, rgba(0,0,0,0.16)))' : 'drop-shadow(0 1px 3px var(--dt-colors-shadow-default, rgba(0,0,0,0.1)))',
          transition: 'all 0.15s ease'
        }}
      />
      
      {/* Compact type label header */}
      <g transform="translate(0, 0)">
        <rect
          width={cardWidth}
          height={22}
          rx={5}
          ry={5}
          fill={config.color}
        />
        <rect
          y={14}
          width={cardWidth}
          height={8}
          fill={config.color}
        />
        <text
          x={8}
          y={14}
          fontSize={9}
          fontWeight={600}
          fill='var(--dt-colors-text-primary-inverse)'
          style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          {config.label}
        </text>
        {/* Count badge */}
        <text
          x={cardWidth - 8}
          y={14}
          fontSize={9}
          fontWeight={600}
          fill='var(--dt-colors-text-primary-inverse)'
          textAnchor="end"
        >
          {node.metrics.requests > 1000 ? `${(node.metrics.requests/1000).toFixed(1)}K` : node.metrics.requests}
        </text>
        {/* External link icon for services */}
        {node.type === 'service' && node.entityId && (
          <a href={getSmartscapeUrl(node.entityId)} target="_blank" rel="noopener noreferrer">
            <g transform={`translate(${cardWidth - 22}, 6)`} style={{ cursor: 'pointer' }}>
              <ExternalLinkIcon style={{ width: 10, height: 10, color: 'var(--dt-colors-text-primary-inverse)' }} />
            </g>
          </a>
        )}
      </g>
      
      {/* Compact hexagon icon */}
      <g transform={`translate(${cardWidth/2}, 42)`}>
        <polygon
          points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7"
          fill='var(--dt-colors-background-surface-default)'
          stroke={config.color}
          strokeWidth={1.5}
        />
        <g transform="translate(-9, -9)" style={{ color: config.color }}>
          {config.icon}
        </g>
      </g>
      
      {/* Entity name */}
      <text
        x={cardWidth / 2}
        y={68}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill='var(--dt-colors-text-primary-default)'
      >
        {node.name.length > 16 ? node.name.substring(0, 14) + '...' : node.name}
      </text>
      
      {/* Click to explore hint for services */}
      {node.type === 'service' && isHovered && (
        <text
          x={cardWidth / 2}
          y={cardHeight - 4}
          textAnchor="middle"
          fontSize={8}
          fill={config.color}
          fontWeight={500}
        >
          Click to explore →
        </text>
      )}
      
      {/* Health indicator */}
      <circle
        cx={cardWidth - 8}
        cy={cardHeight - 8}
        r={3}
        fill={node.health === 'healthy' ? 'var(--dt-colors-charts-status-good-default)' : node.health === 'warning' ? 'var(--dt-colors-charts-status-warning-default)' : 'var(--dt-colors-charts-status-critical-default)'}
      />
    </g>
  );
};

// ============================================
// Edge Component with Label (Clean, Simple)
// ============================================

const SmartscapeEdge: React.FC<{
  edge: TopologyEdge;
  sourceNode: TopologyNode;
  targetNode: TopologyNode;
}> = ({ edge, sourceNode, targetNode }) => {
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return null;
  
  // Card dimensions for offset calculation (compact cards)
  const cardWidth = 130;
  const cardHeight = 80;
  
  // Calculate edge points from card boundaries
  const startX = sourceNode.position.x + (dx / length) * (cardWidth / 2 + 6);
  const startY = sourceNode.position.y + (dy / length) * (cardHeight / 2);
  const endX = targetNode.position.x - (dx / length) * (cardWidth / 2 + 12);
  const endY = targetNode.position.y - (dy / length) * (cardHeight / 2);
  
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  // Format label - compact format
  const edgeLabel = edge.metrics.tokens > 0
    ? (edge.metrics.tokens > 1000000 
        ? `${(edge.metrics.tokens / 1000000).toFixed(1)}M`
        : edge.metrics.tokens > 1000 
        ? `${(edge.metrics.tokens / 1000).toFixed(0)}K`
        : `${edge.metrics.tokens}`)
    : (edge.metrics.requests > 1000
        ? `${(edge.metrics.requests / 1000).toFixed(1)}K`
        : `${edge.metrics.requests}`);
  
  const edgeUnit = edge.metrics.tokens > 0 ? 'tok' : 'req';

  return (
    <g>
      {/* Simple straight line connection */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke='var(--dt-colors-text-neutral-subdued)'
        strokeWidth={1.5}
        strokeDasharray="4 2"
        markerEnd="url(#arrowhead-smartscape)"
      />
      
      {/* Compact edge label */}
      <rect
        x={midX - 24}
        y={midY - 9}
        width={48}
        height={18}
        rx={3}
        fill='var(--dt-colors-background-surface-default)'
        stroke='var(--dt-colors-border-neutral-default)'
        strokeWidth={1}
      />
      
      {/* Edge label text */}
      <text
        x={midX}
        y={midY + 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={500}
        fill='var(--dt-colors-text-neutral-default)'
      >
        {edgeLabel} {edgeUnit}
      </text>
    </g>
  );
};

// ============================================
// Service Detail Modal - Full View of Service Connections
// ============================================

interface ServiceDetailModalProps {
  service: TopologyNode;
  allNodes: TopologyNode[];
  allEdges: TopologyEdge[];
  onClose: () => void;
}

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({ service, allNodes, allEdges, onClose }) => {
  // Find all connected providers and models for this service
  const connectedProviderIds = allEdges
    .filter(e => e.source === service.id)
    .map(e => e.target);
  
  const connectedProviders = allNodes.filter(n => connectedProviderIds.includes(n.id));
  
  // For each provider, find connected models
  const providerToModels: Record<string, TopologyNode[]> = {};
  const providerEdges: Record<string, TopologyEdge> = {};
  
  connectedProviders.forEach(provider => {
    // Edge from service to provider
    const edgeToProvider = allEdges.find(e => e.source === service.id && e.target === provider.id);
    if (edgeToProvider) {
      providerEdges[provider.id] = edgeToProvider;
    }
    
    // Find models connected to this provider
    const modelIds = allEdges
      .filter(e => e.source === provider.id)
      .map(e => e.target);
    providerToModels[provider.id] = allNodes.filter(n => modelIds.includes(n.id));
  });

  // Calculate SVG dimensions
  const cardWidth = 130;
  const cardHeight = 80;
  const horizontalGap = 80;
  const verticalGap = 100;
  
  // Find max models per provider for height calculation
  const maxModels = Math.max(...connectedProviders.map(p => providerToModels[p.id]?.length || 0), 1);
  const svgWidth = Math.max(700, connectedProviders.length * (cardWidth + horizontalGap) + 200);
  const svgHeight = Math.max(350, 120 + maxModels * (cardHeight + 20) + verticalGap);
  
  // Node positions
  const serviceX = 80;
  const serviceY = svgHeight / 2;
  
  const getProviderX = (idx: number) => 240 + idx * (cardWidth + horizontalGap);
  const providerY = 100;
  
  const getModelY = (modelIdx: number) => providerY + verticalGap + modelIdx * (cardHeight + 20);

  // Format number helper
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Modal 
      title={`Service Details: ${service.name}`}
      show={true}
      onDismiss={onClose}
      size="large"
    >
      <Flex flexDirection="column" gap={20} style={{ padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        {/* Service Summary Stats */}
        <Flex gap={16} flexWrap="wrap">
          <Surface style={{ padding: 12, flex: '1 1 140px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Total Requests</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{formatNumber(service.metrics.requests)}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 140px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Total Tokens</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{formatNumber(service.metrics.tokens)}</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 140px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Avg Latency</Text>
              <Text style={{ fontSize: 20, fontWeight: 600 }}>{service.metrics.latency.toFixed(0)}ms</Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 140px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Error Rate</Text>
              <Text style={{ fontSize: 20, fontWeight: 600, color: service.metrics.errorRate > 5 ? 'var(--dt-colors-charts-status-critical-default)' : undefined }}>
                {service.metrics.errorRate.toFixed(1)}%
              </Text>
            </Flex>
          </Surface>
          <Surface style={{ padding: 12, flex: '1 1 140px' }}>
            <Flex flexDirection="column" gap={4}>
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-secondary-default)' }}>Providers</Text>
              <Text style={{ fontSize: 20, fontWeight: 600, color: 'var(--dt-colors-charts-categorical-color-02-default)' }}>{connectedProviders.length}</Text>
            </Flex>
          </Surface>
        </Flex>

        {/* SVG Topology - Service -> Providers -> Models */}
        <Surface style={{ padding: 0, overflow: 'auto' }}>
          <Flex flexDirection="column" gap={0}>
            <Flex alignItems="center" gap={8} style={{ padding: '12px 16px', borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
              <SmartscapeIcon style={{ color: Colors.Charts.Categorical.Color01.Default }} />
              <Heading level={6}>Service → Provider → Model Flow</Heading>
              <Flex gap={12} style={{ marginLeft: 'auto' }}>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--dt-colors-charts-categorical-color-01-default)' }} />
                  <Text style={{ fontSize: 11 }}>Service</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--dt-colors-charts-categorical-color-02-default)' }} />
                  <Text style={{ fontSize: 11 }}>Provider</Text>
                </Flex>
                <Flex alignItems="center" gap={4}>
                  <Flex style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--dt-colors-charts-status-good-default)' }} />
                  <Text style={{ fontSize: 11 }}>Model</Text>
                </Flex>
              </Flex>
            </Flex>
            
            <Flex style={{ background: 'var(--dt-colors-background-surface-default)', overflow: 'auto', padding: '8px 0' }}>
              <svg 
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ display: 'block', minWidth: svgWidth }}
              >
                <defs>
                  <marker id="arrowhead-modal" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                    <polygon points="0 0, 6 2.5, 0 5" fill='var(--dt-colors-text-neutral-subdued)' />
                  </marker>
                  <pattern id="dotPatternModal" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill='var(--dt-colors-border-neutral-default)' opacity="0.3" />
                  </pattern>
                </defs>

                <rect width="100%" height="100%" fill='var(--dt-colors-surface-neutral-default)' />
                <rect width="100%" height="100%" fill="url(#dotPatternModal)" />

                {/* Edges: Service → Providers */}
                {connectedProviders.map((provider, idx) => {
                  const edge = providerEdges[provider.id];
                  const startX = serviceX + cardWidth / 2 + 6;
                  const endX = getProviderX(idx) - cardWidth / 2 - 6;
                  const midX = (startX + endX) / 2;
                  
                  return (
                    <g key={`s2p-${provider.id}`}>
                      <line
                        x1={startX}
                        y1={serviceY}
                        x2={endX}
                        y2={providerY}
                        stroke='var(--dt-colors-text-neutral-subdued)'
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead-modal)"
                      />
                      {edge && (
                        <>
                          <rect x={midX - 22} y={(serviceY + providerY) / 2 - 9} width={44} height={18} rx={3} fill='var(--dt-colors-background-surface-default)' stroke='var(--dt-colors-border-neutral-default)' />
                          <text x={midX} y={(serviceY + providerY) / 2 + 4} textAnchor="middle" fontSize={9} fill='var(--dt-colors-text-neutral-default)'>
                            {formatNumber(edge.metrics.tokens)} tok
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Edges: Providers → Models */}
                {connectedProviders.map((provider, pIdx) => {
                  const models = providerToModels[provider.id] || [];
                  return models.map((model, mIdx) => {
                    const edge = allEdges.find(e => e.source === provider.id && e.target === model.id);
                    const startX = getProviderX(pIdx);
                    const startY = providerY + cardHeight / 2 + 6;
                    const endY = getModelY(mIdx) - cardHeight / 2 - 6;
                    
                    return (
                      <g key={`p2m-${provider.id}-${model.id}`}>
                        <line
                          x1={startX}
                          y1={startY}
                          x2={startX}
                          y2={endY}
                          stroke='var(--dt-colors-text-neutral-subdued)'
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          markerEnd="url(#arrowhead-modal)"
                        />
                        {edge && (
                          <>
                            <rect x={startX - 22} y={(startY + endY) / 2 - 9} width={44} height={18} rx={3} fill='var(--dt-colors-background-surface-default)' stroke='var(--dt-colors-border-neutral-default)' />
                            <text x={startX} y={(startY + endY) / 2 + 4} textAnchor="middle" fontSize={9} fill='var(--dt-colors-text-neutral-default)'>
                              {formatNumber(edge.metrics.requests)} req
                            </text>
                          </>
                        )}
                      </g>
                    );
                  });
                })}

                {/* Service Node */}
                <g transform={`translate(${serviceX - cardWidth / 2}, ${serviceY - cardHeight / 2})`}>
                  <rect width={cardWidth} height={cardHeight} rx={8} fill='var(--dt-colors-background-surface-default)' stroke='var(--dt-colors-charts-categorical-color-01-default)' strokeWidth={2} />
                  <rect y={0} width={cardWidth} height={24} rx={8} fill='var(--dt-colors-charts-categorical-color-01-default)' opacity="0.12" />
                  <rect y={16} width={cardWidth} height={8} fill='var(--dt-colors-charts-categorical-color-01-default)' opacity="0.12" />
                  <text x={cardWidth / 2} y={16} textAnchor="middle" fontSize={9} fontWeight={600} fill='var(--dt-colors-charts-categorical-color-01-default)'>SERVICE</text>
                  <ServicesIcon style={{ position: 'absolute' }} />
                  <text x={cardWidth / 2} y={50} textAnchor="middle" fontSize={11} fontWeight={600} fill='var(--dt-colors-text-primary-default)'>
                    {service.name.length > 14 ? service.name.substring(0, 12) + '...' : service.name}
                  </text>
                  <text x={cardWidth / 2} y={68} textAnchor="middle" fontSize={9} fill='var(--dt-colors-text-neutral-default)'>
                    {formatNumber(service.metrics.requests)} req
                  </text>
                </g>

                {/* Provider Nodes */}
                {connectedProviders.map((provider, idx) => (
                  <g key={provider.id} transform={`translate(${getProviderX(idx) - cardWidth / 2}, ${providerY - cardHeight / 2})`}>
                    <rect width={cardWidth} height={cardHeight} rx={8} fill='var(--dt-colors-background-surface-default)' stroke='var(--dt-colors-charts-categorical-color-02-default)' strokeWidth={2} />
                    <rect y={0} width={cardWidth} height={24} rx={8} fill='var(--dt-colors-charts-categorical-color-02-default)' opacity="0.12" />
                    <rect y={16} width={cardWidth} height={8} fill='var(--dt-colors-charts-categorical-color-02-default)' opacity="0.12" />
                    <text x={cardWidth / 2} y={16} textAnchor="middle" fontSize={9} fontWeight={600} fill='var(--dt-colors-charts-categorical-color-02-default)'>PROVIDER</text>
                    <text x={cardWidth / 2} y={50} textAnchor="middle" fontSize={11} fontWeight={600} fill='var(--dt-colors-text-primary-default)'>
                      {provider.name.length > 14 ? provider.name.substring(0, 12) + '...' : provider.name}
                    </text>
                    <text x={cardWidth / 2} y={68} textAnchor="middle" fontSize={9} fill='var(--dt-colors-text-neutral-default)'>
                      {formatNumber(provider.metrics.tokens)} tok
                    </text>
                  </g>
                ))}

                {/* Model Nodes */}
                {connectedProviders.map((provider, pIdx) => {
                  const models = providerToModels[provider.id] || [];
                  return models.map((model, mIdx) => (
                    <g key={model.id} transform={`translate(${getProviderX(pIdx) - cardWidth / 2}, ${getModelY(mIdx) - cardHeight / 2})`}>
                      <rect width={cardWidth} height={cardHeight} rx={8} fill='var(--dt-colors-background-surface-default)' stroke='var(--dt-colors-charts-status-good-default)' strokeWidth={2} />
                      <rect y={0} width={cardWidth} height={24} rx={8} fill='var(--dt-colors-charts-status-good-default)' opacity="0.12" />
                      <rect y={16} width={cardWidth} height={8} fill='var(--dt-colors-charts-status-good-default)' opacity="0.12" />
                      <text x={cardWidth / 2} y={16} textAnchor="middle" fontSize={9} fontWeight={600} fill='var(--dt-colors-charts-status-good-default)'>MODEL</text>
                      <text x={cardWidth / 2} y={50} textAnchor="middle" fontSize={11} fontWeight={600} fill='var(--dt-colors-text-primary-default)'>
                        {model.name.length > 14 ? model.name.substring(0, 12) + '...' : model.name}
                      </text>
                      <text x={cardWidth / 2} y={68} textAnchor="middle" fontSize={9} fill='var(--dt-colors-text-neutral-default)'>
                        {model.metrics.latency.toFixed(0)}ms
                      </text>
                    </g>
                  ));
                })}
              </svg>
            </Flex>
          </Flex>
        </Surface>

        {/* Connected Providers List */}
        <Surface style={{ padding: 16 }}>
          <Heading level={6} style={{ marginBottom: 12 }}>Connected Providers & Models</Heading>
          <Flex flexDirection="column" gap={12}>
            {connectedProviders.map(provider => {
              const models = providerToModels[provider.id] || [];
              const edge = providerEdges[provider.id];
              return (
                <Surface key={provider.id} style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-default)' }}>
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Flex flexDirection="column" gap={4}>
                      <Flex alignItems="center" gap={8}>
                        {getProviderIcon(provider.name, 16)}
                        <Text style={{ fontWeight: 600 }}>{provider.name}</Text>
                      </Flex>
                      <Flex gap={16} style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatNumber(edge?.metrics.tokens || 0)} tokens
                        </Text>
                        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {formatNumber(edge?.metrics.requests || 0)} requests
                        </Text>
                        <Text style={{ fontSize: 12, color: 'var(--dt-colors-text-secondary-default)' }}>
                          {(edge?.metrics.avgLatency || 0).toFixed(0)}ms avg
                        </Text>
                      </Flex>
                    </Flex>
                    <Flex gap={8} flexWrap="wrap" style={{ maxWidth: '50%' }}>
                      {models.map(model => (
                        <Flex key={model.id} 
                          style={{ 
                            padding: '4px 8px', 
                            background: 'var(--dt-colors-surface-neutral-default)',
                            borderRadius: 4, 
                            fontSize: 11,
                            border: '1px solid var(--dt-colors-charts-status-good-default)'
                          }}
                        >
                          {getModelIcon(model.name, 12)} {model.name}
                        </Flex>
                      ))}
                    </Flex>
                  </Flex>
                </Surface>
              );
            })}
          </Flex>
        </Surface>

        {/* Action Buttons */}
        <Flex gap={12} justifyContent="flex-end">
          {service.entityId && (
            <Button 
              as="a" 
              href={getSmartscapeUrl(service.entityId)} 
              target="_blank"
              variant="accent"
            >
              <Button.Prefix><ExternalLinkIcon /></Button.Prefix>
              View in Smartscape
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

// ============================================
// Main Topology Component
// ============================================

export const AITopology: React.FC = () => {
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [serviceDetailModal, setServiceDetailModal] = useState<TopologyNode | null>(null);

  // Handle node click - show modal for services
  const handleNodeClick = useCallback((node: TopologyNode) => {
    if (node.type === 'service') {
      setServiceDetailModal(node);
    } else {
      setSelectedNode(node);
    }
  }, []);

  // Track mouse position globally for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Global filters
  const { filters, setFilters } = useGlobalFilters();
  
  // Get available filter options
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();

  // Fetch topology data from Grail with filters
  const fetchTopology = useCallback(async () => {
    console.log('[GCC Topology] Fetching with filters:', {
      timeframe: filters.timeframe,
      serviceFilter: filters.serviceFilter,
      providerFilter: filters.providerFilter,
      modelFilter: filters.modelFilter
    });
    
    setLoading(true);
    try {
      // Build time range clause from filters
      const timeClause = getTimeframeDqlClause(filters.timeframe);
      
      // Build service filter
      let serviceFilterClause = '';
      if (filters.serviceFilter) {
        serviceFilterClause = `| filter dt.entity.service == "${filters.serviceFilter}"`;
      }
      
      // Build provider filter
      const providerFilterClause = filters.providerFilter 
        ? `| filter gen_ai.provider.name == "${filters.providerFilter}"`
        : '';
      
      // Build model filter
      const modelFilterClause = filters.modelFilter 
        ? `| filter gen_ai.request.model == "${filters.modelFilter}"`
        : '';

      const query = `
        fetch spans, ${timeClause}
        | filter isNotNull(gen_ai.request.model) AND gen_ai.request.model != "" AND gen_ai.request.model != "null"
        ${serviceFilterClause}
        ${providerFilterClause}
        ${modelFilterClause}
        | summarize {
            requests = count(),
            tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
            avg_latency = avg(duration) / 1000000,
            error_rate = countIf(span.status_code == "error" OR isNotNull(error.type)) / count() * 100
          }, by: { dt.entity.service, gen_ai.provider.name, gen_ai.request.model }
        | sort requests desc
        | limit 100
      `;
      
      console.log('[GCC Topology] Executing DQL:', query);

      const response = await queryExecutionClient.queryExecute({
        body: {
          query,
          requestTimeoutMilliseconds: 60000,
          fetchTimeoutSeconds: 60
        }
      });

      const records = response.result?.records || [];
      console.log('[GCC Topology] Query returned', records.length, 'records');
      
      // Get unique service entity IDs and fetch their names
      const serviceEntityIds = [...new Set(records.map((r: any) => r['dt.entity.service']).filter(Boolean))];
      
      // Fetch service entity names
      const serviceNamesMap = new Map<string, string>();
      if (serviceEntityIds.length > 0) {
        try {
          // Build filter conditions for each service ID
          const filterConditions = serviceEntityIds.map(id => `id == "${id}"`).join(' OR ');
          const entityQuery = await queryExecutionClient.queryExecute({
            body: {
              query: `
                fetch dt.entity.service
                | filter ${filterConditions}
                | fields id, entity.name
              `,
              requestTimeoutMilliseconds: 30000,
              fetchTimeoutSeconds: 30
            }
          });
          (entityQuery.result?.records || []).forEach((rec: any) => {
            if (rec.id && rec['entity.name']) {
              serviceNamesMap.set(rec.id, rec['entity.name']);
            }
          });
        } catch (e) {
          console.warn('[GCC] Could not fetch service names:', e);
        }
      }
      
      // Build topology - only include nodes that have actual connections
      const nodesMap = new Map<string, TopologyNode>();
      const edges: TopologyEdge[] = [];
      
      // Track connections: which providers connect to which models (via data)
      const providerToModels = new Map<string, Set<string>>();
      const serviceToProviders = new Map<string, Set<string>>();
      
      // First pass: build connection maps from actual data
      records.forEach((record: any) => {
        const providerName = record['gen_ai.provider.name'];
        const serviceEntityId = record['dt.entity.service'];
        const modelName = record['gen_ai.request.model'];
        
        // Skip records with missing provider or model
        if (!providerName || !modelName || modelName === 'null' || modelName === '') {
          return;
        }
        
        // Track provider → model connections
        if (!providerToModels.has(providerName)) {
          providerToModels.set(providerName, new Set());
        }
        providerToModels.get(providerName)!.add(modelName);
        
        // Track service → provider connections
        const serviceKey = serviceEntityId || 'application';
        if (!serviceToProviders.has(serviceKey)) {
          serviceToProviders.set(serviceKey, new Set());
        }
        serviceToProviders.get(serviceKey)!.add(providerName);
      });

      // Determine which entities to show (only connected ones)
      const connectedProviders = new Set<string>();
      const connectedModels = new Set<string>();
      const connectedServices = new Set<string>();
      
      // Start from services and walk the graph
      serviceToProviders.forEach((providers, serviceId) => {
        connectedServices.add(serviceId);
        providers.forEach(provider => {
          connectedProviders.add(provider);
          const models = providerToModels.get(provider);
          if (models) {
            models.forEach(model => connectedModels.add(model));
          }
        });
      });

      // Calculate positions - compact layout with smaller cards
      const cardWidth = 130;
      const cardHeight = 80;
      const verticalGap = 16;
      
      const svgWidth = 800;
      const serviceCount = connectedServices.size || 1;
      const providerCount = connectedProviders.size;
      const modelCount = connectedModels.size;
      const maxNodes = Math.max(serviceCount, providerCount, modelCount);
      const svgHeight = Math.max(200, maxNodes * (cardHeight + verticalGap) + 20);
      
      const leftX = cardWidth / 2 + 15;
      const middleX = svgWidth / 2;
      const rightX = svgWidth - cardWidth / 2 - 15;
      const topMargin = 10; // Start nodes at top

      // Create service nodes (left) - only connected services
      let serviceIdx = 0;
      const serviceArray = Array.from(connectedServices);
      
      if (serviceArray.length === 0 || (serviceArray.length === 1 && serviceArray[0] === 'application')) {
        // No service entities found - create a generic "Application" node
        const ySpacing = (svgHeight - 20) / 2;
        nodesMap.set('service-application', {
          id: 'service-application',
          type: 'service',
          name: 'GenAI Application',
          metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
          position: { x: leftX, y: topMargin + ySpacing },
          health: 'healthy'
        });
      } else {
        serviceArray.filter(s => s !== 'application').forEach((serviceId) => {
          const serviceName = serviceNamesMap.get(serviceId) || serviceId;
          const ySpacing = (svgHeight - 20) / (serviceArray.length + 1);
          nodesMap.set(`service-${serviceId}`, {
            id: `service-${serviceId}`,
            type: 'service',
            name: serviceName,
            entityId: serviceId,
            metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
            position: { x: leftX, y: topMargin + ySpacing * (serviceIdx + 1) },
            health: 'healthy'
          });
          serviceIdx++;
        });
      }

      // Create provider nodes (middle) - only connected providers
      let providerIdx = 0;
      const providerArray = Array.from(connectedProviders);
      providerArray.forEach((providerName) => {
        const ySpacing = (svgHeight - 20) / (providerArray.length + 1);
        nodesMap.set(`provider-${providerName}`, {
          id: `provider-${providerName}`,
          type: 'provider',
          name: providerName,
          metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
          position: { x: middleX, y: topMargin + ySpacing * (providerIdx + 1) },
          health: 'healthy'
        });
        providerIdx++;
      });

      // Create model nodes (right) - only connected models, show all
      let modelIdx = 0;
      const modelArray = Array.from(connectedModels);
      modelArray.forEach((modelName) => {
        const ySpacing = (svgHeight - 20) / (modelArray.length + 1);
        nodesMap.set(`model-${modelName}`, {
          id: `model-${modelName}`,
          type: 'model',
          name: modelName,
          metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
          position: { x: rightX, y: topMargin + ySpacing * (modelIdx + 1) },
          health: 'healthy'
        });
        modelIdx++;
      });

      // Track errors for weighted average calculation
      const serviceErrors = new Map<string, { totalErrors: number; totalRequests: number; latencySum: number; latencyCount: number }>();
      
      // Process records to update metrics and create edges
      records.forEach((record: any) => {
        const serviceEntityId = record['dt.entity.service'];
        const providerName = record['gen_ai.provider.name'];
        const modelName = record['gen_ai.request.model'];
        
        // Skip records with missing provider or model
        if (!providerName || !modelName || modelName === 'null' || modelName === '') {
          return;
        }
        
        const requests = Number(record.requests) || 0;
        const tokens = Number(record.tokens) || 0;
        const latency = Number(record.avg_latency) || 0;
        const errorRate = Number(record.error_rate) || 0;
        
        // Calculate estimated errors from error_rate percentage
        const estimatedErrors = (errorRate / 100) * requests;

        // Update node metrics using entity ID
        const serviceNode = nodesMap.get(`service-${serviceEntityId}`);
        if (serviceNode) {
          serviceNode.metrics.requests += requests;
          serviceNode.metrics.tokens += tokens;
          
          // Track for weighted average calculations
          const serviceKey = `service-${serviceEntityId}`;
          if (!serviceErrors.has(serviceKey)) {
            serviceErrors.set(serviceKey, { totalErrors: 0, totalRequests: 0, latencySum: 0, latencyCount: 0 });
          }
          const stats = serviceErrors.get(serviceKey)!;
          stats.totalErrors += estimatedErrors;
          stats.totalRequests += requests;
          stats.latencySum += latency * requests; // Weight latency by request count
          stats.latencyCount += requests;
        }

        const providerNode = nodesMap.get(`provider-${providerName}`);
        if (providerNode) {
          providerNode.metrics.requests += requests;
          providerNode.metrics.tokens += tokens;
        }

        const modelNode = nodesMap.get(`model-${modelName}`);
        if (modelNode) {
          modelNode.metrics.requests += requests;
          modelNode.metrics.tokens += tokens;
        }

        // Create edges: Service → Provider (only if both nodes exist)
        const sourceServiceId = serviceEntityId || 'application';
        const serviceNodeId = `service-${sourceServiceId}`;
        const providerNodeId = `provider-${providerName}`;
        
        if (nodesMap.has(serviceNodeId) && nodesMap.has(providerNodeId)) {
          const edgeId1 = `${sourceServiceId}-${providerName}`;
          const existingEdge1 = edges.find(e => e.id === edgeId1);
          if (existingEdge1) {
            existingEdge1.metrics.requests += requests;
            existingEdge1.metrics.tokens += tokens;
          } else {
            edges.push({
              id: edgeId1,
              source: serviceNodeId,
              target: providerNodeId,
              label: 'calls',
              metrics: { requests, tokens, avgLatency: latency }
            });
          }
        }

        // Update placeholder service metrics if used
        if (!serviceEntityId) {
          const placeholderNode = nodesMap.get('service-application');
          if (placeholderNode) {
            placeholderNode.metrics.requests += requests;
            placeholderNode.metrics.tokens += tokens;
            
            // Track for weighted average calculations
            const placeholderKey = 'service-application';
            if (!serviceErrors.has(placeholderKey)) {
              serviceErrors.set(placeholderKey, { totalErrors: 0, totalRequests: 0, latencySum: 0, latencyCount: 0 });
            }
            const stats = serviceErrors.get(placeholderKey)!;
            stats.totalErrors += estimatedErrors;
            stats.totalRequests += requests;
            stats.latencySum += latency * requests;
            stats.latencyCount += requests;
          }
        }

        // Create edges: Provider → Model (only if both nodes exist)
        if (nodesMap.has(`provider-${providerName}`) && nodesMap.has(`model-${modelName}`)) {
          const edgeId2 = `${providerName}-${modelName}`;
          const existingEdge2 = edges.find(e => e.id === edgeId2);
          if (existingEdge2) {
            existingEdge2.metrics.requests += requests;
            existingEdge2.metrics.tokens += tokens;
          } else {
            edges.push({
              id: edgeId2,
              source: `provider-${providerName}`,
              target: `model-${modelName}`,
              label: 'uses',
              metrics: { requests, tokens, avgLatency: latency }
            });
          }
        }
      });

      // Calculate weighted average error rates and latencies for service nodes
      serviceErrors.forEach((stats, serviceKey) => {
        const node = nodesMap.get(serviceKey);
        if (node && stats.totalRequests > 0) {
          // Weighted average error rate
          node.metrics.errorRate = (stats.totalErrors / stats.totalRequests) * 100;
          // Weighted average latency
          node.metrics.latency = stats.latencySum / stats.latencyCount;
          // Set health based on weighted error rate
          node.health = node.metrics.errorRate > 10 ? 'critical' : node.metrics.errorRate > 5 ? 'warning' : 'healthy';
        }
      });

      const nodes = Array.from(nodesMap.values());
      const serviceNodes = nodes.filter(n => n.type === 'service');
      const providerNodes = nodes.filter(n => n.type === 'provider');
      const modelNodes = nodes.filter(n => n.type === 'model');
      const totalRequests = serviceNodes.reduce((sum, n) => sum + n.metrics.requests, 0);
      const totalTokens = serviceNodes.reduce((sum, n) => sum + n.metrics.tokens, 0);

      console.log('[GCC Topology] Built topology:', {
        services: serviceNodes.map(n => n.id),
        providers: providerNodes.map(n => n.id),
        models: modelNodes.length,
        edges: edges.map(e => `${e.source} → ${e.target}`)
      });

      setTopologyData({
        nodes,
        edges,
        svgHeight,
        summary: {
          totalServices: serviceNodes.length,
          totalProviders: providerNodes.length,
          totalModels: modelNodes.length,
          totalRequests,
          totalTokens
        }
      });
      setError(null);
    } catch (err) {
      console.error('[GCC] Failed to fetch topology:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch topology'));
    } finally {
      setLoading(false);
    }
  }, [filters.timeframe, filters.serviceFilter, filters.providerFilter, filters.modelFilter]);

  // Re-fetch when filters change
  useEffect(() => {
    console.log('[GCC Topology] Filters changed, refetching...', {
      serviceFilter: filters.serviceFilter,
      providerFilter: filters.providerFilter,
      modelFilter: filters.modelFilter
    });
    fetchTopology();
  }, [filters.serviceFilter, filters.providerFilter, filters.modelFilter, filters.timeframe, fetchTopology]);

  // Auto-refresh interval (separate from filter changes)
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTopology, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchTopology]);

  if (loading && !topologyData) {
    return (
      <Flex flexDirection="column" gap={12} padding={16} style={{ minHeight: '100vh', background: 'var(--dt-colors-background-base-default)' }}>
        <Flex alignItems="center" gap={12} style={{ 
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(20,168,245,0.08) 0%, rgba(111,45,168,0.08) 100%)',
          borderRadius: 8
        }}>
          <SmartscapeIcon style={{ width: 28, height: 28, color: 'var(--dt-colors-text-accent-default)' }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={4} style={{ margin: 0 }}>GenAI Topology</Heading>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Loading real-time visualization...
            </Text>
          </Flex>
        </Flex>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={fetchTopology}
          isLoading={loading}
          availableServices={availableServiceOptions || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />
        <Flex justifyContent="center" alignItems="center" padding={64} style={{ 
          background: 'var(--dt-colors-surface-neutral-default)',
          borderRadius: 8,
          minHeight: 400
        }}>
          <ProgressCircle size="large" />
          <Text style={{ marginLeft: 16 }}>Discovering GenAI services...</Text>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex flexDirection="column" gap={12} padding={16} style={{ minHeight: '100vh', background: 'var(--dt-colors-background-base-default)' }}>
        <Flex alignItems="center" gap={12} style={{ 
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(20,168,245,0.08) 0%, rgba(111,45,168,0.08) 100%)',
          borderRadius: 8
        }}>
          <SmartscapeIcon style={{ width: 28, height: 28, color: 'var(--dt-colors-text-accent-default)' }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={4} style={{ margin: 0 }}>GenAI Topology</Heading>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              Error loading topology
            </Text>
          </Flex>
        </Flex>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={fetchTopology}
          isLoading={loading}
          availableServices={availableServiceOptions || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />
        <Surface padding={32} style={{ 
          textAlign: 'center',
          background: 'var(--dt-colors-surface-neutral-default)',
          borderRadius: 8,
          border: '1px solid var(--dt-colors-border-critical-default)'
        }}>
          <Text style={{ color: Colors.Text.Critical.Default, marginBottom: 12 }}>{error.message}</Text>
          <Button variant="emphasized" onClick={fetchTopology} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </Surface>
      </Flex>
    );
  }

  if (!topologyData || topologyData.nodes.length === 0) {
    return (
      <Flex flexDirection="column" gap={12} padding={16} style={{ minHeight: '100vh', background: 'var(--dt-colors-background-base-default)' }}>
        <Flex alignItems="center" gap={12} style={{ 
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(20,168,245,0.08) 0%, rgba(111,45,168,0.08) 100%)',
          borderRadius: 8
        }}>
          <SmartscapeIcon style={{ width: 28, height: 28, color: 'var(--dt-colors-text-accent-default)' }} />
          <Flex flexDirection="column" gap={2}>
            <Heading level={4} style={{ margin: 0 }}>GenAI Topology</Heading>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
              No services discovered
            </Text>
          </Flex>
        </Flex>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={fetchTopology}
          isLoading={loading}
          availableServices={availableServiceOptions || []}
          availableProviders={availableProviders || []}
          availableModels={availableModels || []}
        />
        <Surface padding={32} style={{ 
          textAlign: 'center',
          background: 'var(--dt-colors-surface-neutral-default)',
          borderRadius: 8,
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <SmartscapeIcon style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 16 }} />
          <Text style={{ marginBottom: 8 }}>No GenAI services discovered</Text>
          <Text textStyle="small" style={{ color: 'var(--dt-colors-text-secondary-default)', marginBottom: 16 }}>
            Adjust filters or ensure your services emit gen_ai.* spans
          </Text>
          <Button variant="emphasized" onClick={fetchTopology}>
            Refresh Topology
          </Button>
        </Surface>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} padding={16} style={{ minHeight: '100vh', background: 'var(--dt-colors-background-base-default)' }}>
      {/* Page TitleBar */}
      <TitleBar>
        <TitleBar.Prefix aria-hidden="true">
          <SmartscapeIcon />
        </TitleBar.Prefix>
        <TitleBar.Title>AI Topology</TitleBar.Title>
        <TitleBar.Subtitle>Service → Provider → Model flows</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="center">
            <Button 
              variant={autoRefresh ? 'emphasized' : 'default'} 
              onClick={() => setAutoRefresh(!autoRefresh)}
              aria-label={autoRefresh ? 'Disable live refresh' : 'Enable live refresh'}
            >
              {autoRefresh ? '● Live' : '○ Paused'}
            </Button>
            <Button
              variant="default"
              onClick={fetchTopology}
              disabled={loading}
              aria-label="Refresh topology"
            >
              {loading ? '...' : 'Refresh'}
            </Button>
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      {/* Compact Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={fetchTopology}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Ultra-compact legend + stats row */}
      <Flex gap={12} padding={6} alignItems="center" style={{ 
        background: 'var(--dt-colors-surface-neutral-default)', 
        borderRadius: 4,
        border: '1px solid var(--dt-colors-border-neutral-default)',
        fontSize: 11
      }}>
        <Flex alignItems="center" gap={4}>
          <Flex style={{ width: 12, height: 12, background: 'var(--dt-colors-charts-categorical-color-01-default)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <Text><strong>{topologyData.summary.totalServices}</strong> Svc</Text>
        </Flex>
        <Flex alignItems="center" gap={4}>
          <Flex style={{ width: 12, height: 12, background: 'var(--dt-colors-charts-categorical-color-02-default)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <Text><strong>{topologyData.summary.totalProviders}</strong> Prov</Text>
        </Flex>
        <Flex alignItems="center" gap={4}>
          <Flex style={{ width: 12, height: 12, background: 'var(--dt-colors-charts-categorical-color-03-default)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <Text><strong>{topologyData.summary.totalModels}</strong> Mod</Text>
        </Flex>
        <Flex style={{ height: 12, borderLeft: '1px solid var(--dt-colors-border-neutral-default)' }} />
        <Text style={{ color: 'var(--dt-colors-text-secondary-default)' }}>
          {topologyData.summary.totalRequests > 1000 
            ? `${(topologyData.summary.totalRequests/1000).toFixed(1)}K` 
            : topologyData.summary.totalRequests} req • {
            topologyData.summary.totalTokens > 1000000 
              ? `${(topologyData.summary.totalTokens / 1000000).toFixed(1)}M`
              : topologyData.summary.totalTokens > 1000
              ? `${(topologyData.summary.totalTokens / 1000).toFixed(0)}K`
              : topologyData.summary.totalTokens
          } tok
        </Text>
      </Flex>

      {/* Topology SVG - Scrollable Container */}
      <Surface style={{ 
        padding: 0, 
        flex: 1,
        minHeight: 200,
        maxHeight: '100%',
        overflow: 'auto',
        background: 'var(--dt-colors-surface-neutral-default)',
        borderRadius: 8,
        border: '1px solid var(--dt-colors-border-neutral-default)',
        position: 'relative'
      }}
      onMouseMove={handleMouseMove}
      >
        <svg 
          width="100%"
          height={topologyData.svgHeight}
          viewBox={`0 0 800 ${topologyData.svgHeight}`}
          preserveAspectRatio="xMidYMin meet"
          style={{ display: 'block' }}
        >
          {/* Gradient definitions */}
          <defs>
            <marker
              id="arrowhead-smartscape"
              markerWidth="6"
              markerHeight="5"
              refX="5"
              refY="2.5"
              orient="auto"
            >
              <polygon 
                points="0 0, 6 2.5, 0 5" 
                fill='var(--dt-colors-text-neutral-subdued)'
              />
            </marker>
            {/* Glow filter for nodes */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Light dotted pattern for background */}
            <pattern id="dotPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill='var(--dt-colors-border-neutral-default)' opacity="0.3" />
            </pattern>
          </defs>

          {/* Background - subtle canvas distinct from card fills */}
          <rect width="100%" height="100%" fill='var(--dt-colors-surface-neutral-default)' />
          <rect width="100%" height="100%" fill="url(#dotPattern)" />

          {/* Edges (render first so they're behind nodes) */}
          {topologyData.edges
            .filter(edge => edge.metrics.tokens > 0 || edge.metrics.requests > 0)
            .map((edge) => {
              const sourceNode = topologyData.nodes.find(n => n.id === edge.source);
              const targetNode = topologyData.nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) {
                console.warn('[GCC Topology] Edge missing nodes:', edge.id, 'source:', edge.source, 'target:', edge.target);
                return null;
              }
              
              return (
                <SmartscapeEdge
                  key={edge.id}
                  edge={edge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                />
              );
            })}

          {/* Nodes with hover handlers */}
          {topologyData.nodes.map((node) => (
            <SmartscapeCardNode
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              isHovered={hoveredNode?.id === node.id}
              onSelect={handleNodeClick}
              onHover={setHoveredNode}
            />
          ))}
        </svg>
      </Surface>

      {/* Tooltip Portal - Fixed position following cursor */}
      {hoveredNode && (
        <Flex style={{
          position: 'fixed',
          left: tooltipPos.x + 20,
          top: tooltipPos.y - 10,
          zIndex: 9999,
          background: 'var(--dt-colors-background-surface-default)',
          borderRadius: 8,
          boxShadow: '0 8px 32px var(--dt-colors-shadow-default, rgba(0,0,0,0.2))',
          border: '1px solid var(--dt-colors-border-neutral-default)',
          padding: 12,
          minWidth: 200,
          maxWidth: 240,
          pointerEvents: 'none'
        }}>
          <Flex flexDirection="column" gap={4}>
            <Flex justifyContent="space-between" alignItems="center">
              <Text style={{ fontWeight: 600, fontSize: 13 }}>{hoveredNode.name}</Text>
              <Text style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hoveredNode.health === 'healthy' ? 'var(--dt-colors-charts-status-good-default)' : 
                           hoveredNode.health === 'warning' ? 'var(--dt-colors-charts-status-warning-default)' : 'var(--dt-colors-charts-status-critical-default)'
              }} />
            </Flex>
            <Text textStyle="small" style={{ color: 'var(--dt-colors-text-neutral-default)', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>
              {hoveredNode.type}
            </Text>
            <Flex style={{ borderTop: '1px solid var(--dt-colors-border-neutral-default)', margin: '4px 0' }} />
            <Flex justifyContent="space-between">
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-neutral-default)' }}>Requests</Text>
              <Text style={{ fontWeight: 600, fontSize: 11 }}>{formatNumber(hoveredNode.metrics.requests)}</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-neutral-default)' }}>Tokens</Text>
              <Text style={{ fontWeight: 600, fontSize: 11 }}>{formatNumber(hoveredNode.metrics.tokens)}</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-neutral-default)' }}>Latency</Text>
              <Text style={{ fontWeight: 600, fontSize: 11 }}>{hoveredNode.metrics.latency.toFixed(0)}ms</Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text style={{ fontSize: 11, color: 'var(--dt-colors-text-neutral-default)' }}>Error Rate</Text>
              <Text style={{ fontWeight: 600, fontSize: 11 }}>{hoveredNode.metrics.errorRate.toFixed(1)}%</Text>
            </Flex>
          </Flex>
        </Flex>
      )}

      {/* Service Detail Modal */}
      {serviceDetailModal && topologyData && (
        <ServiceDetailModal
          service={serviceDetailModal}
          allNodes={topologyData.nodes}
          allEdges={topologyData.edges}
          onClose={() => setServiceDetailModal(null)}
        />
      )}
    </Flex>
  );
};

export default AITopology;
