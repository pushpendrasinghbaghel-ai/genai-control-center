// AI Topology Visualization Page
// Unique visual representation of GenAI service flows and dependencies

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Colors } from '@dynatrace/strato-design-tokens';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { FilterBar } from '../components/FilterBar';
import { useGlobalFilters } from '../context';
import { useDistinctServices, useDistinctProviders, useDistinctModels } from '../hooks';
import { getTimeframeDqlClause } from '../context/FilterContext';

// ============================================
// Types
// ============================================

interface TopologyNode {
  id: string;
  type: 'service' | 'provider' | 'model' | 'user';
  name: string;
  provider?: string;
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
  metrics: {
    requests: number;
    tokens: number;
    avgLatency: number;
  };
  thickness: number;
}

interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  svgDimensions: { width: number; height: number };
  summary: {
    totalServices: number;
    totalProviders: number;
    totalModels: number;
    totalRequests: number;
    totalTokens: number;
  };
}

// ============================================
// Node Component
// ============================================

const TopologyNodeComponent: React.FC<{
  node: TopologyNode;
  selected: boolean;
  onSelect: (node: TopologyNode) => void;
}> = ({ node, selected, onSelect }) => {
  const getNodeColor = (type: string, health: string) => {
    const baseColors: Record<string, string> = {
      service: '#4CAF50',
      provider: '#2196F3',
      model: '#9C27B0',
      user: '#FF9800'
    };
    
    if (health === 'critical') return '#f44336';
    if (health === 'warning') return '#ff9800';
    return baseColors[type] || '#757575';
  };

  const getNodeIcon = (type: string) => {
    const icons: Record<string, string> = {
      service: '🤖',
      provider: '☁️',
      model: '🧠',
      user: '👤'
    };
    return icons[type] || '📦';
  };

  const nodeSize = node.type === 'provider' ? 80 : node.type === 'service' ? 70 : 60;
  const color = getNodeColor(node.type, node.health);

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(node)}
    >
      {/* Node circle */}
      <circle
        r={nodeSize / 2}
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
      />
      <circle
        r={nodeSize / 2 - 8}
        fill={color}
        opacity={0.6}
      />
      
      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={nodeSize / 3}
        style={{ userSelect: 'none' }}
      >
        {getNodeIcon(node.type)}
      </text>
      
      {/* Label */}
      <text
        y={nodeSize / 2 + 16}
        textAnchor="middle"
        fill="var(--dt-colors-text-primary-default)"
        fontSize={11}
        fontWeight={500}
        style={{ userSelect: 'none' }}
      >
        {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
      </text>
      
      {/* Metrics badge */}
      <g transform={`translate(${nodeSize / 2 - 5}, ${-nodeSize / 2 + 5})`}>
        <circle r={10} fill={node.health === 'healthy' ? '#4CAF50' : node.health === 'warning' ? '#ff9800' : '#f44336'} />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={8}
          fontWeight={600}
        >
          {node.metrics.requests > 1000 ? `${(node.metrics.requests / 1000).toFixed(0)}K` : node.metrics.requests}
        </text>
      </g>
    </g>
  );
};

// ============================================
// Edge Component
// ============================================

const TopologyEdgeComponent: React.FC<{
  edge: TopologyEdge;
  sourceNode: TopologyNode;
  targetNode: TopologyNode;
}> = ({ edge, sourceNode, targetNode }) => {
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize and offset to account for node size
  const offsetSource = 35;
  const offsetTarget = 35;
  
  const startX = sourceNode.position.x + (dx / length) * offsetSource;
  const startY = sourceNode.position.y + (dy / length) * offsetSource;
  const endX = targetNode.position.x - (dx / length) * offsetTarget;
  const endY = targetNode.position.y - (dy / length) * offsetTarget;
  
  // Curved path for better visualization
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const curvature = 20;
  const perpX = -dy / length * curvature;
  const perpY = dx / length * curvature;

  return (
    <g>
      <path
        d={`M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
        fill="none"
        stroke="var(--dt-colors-border-neutral-default)"
        strokeWidth={Math.max(1, Math.min(edge.thickness, 5))}
        opacity={0.6}
        markerEnd="url(#arrowhead)"
      />
      {/* Token flow label */}
      <text
        x={midX + perpX}
        y={midY + perpY - 8}
        textAnchor="middle"
        fill="var(--dt-colors-text-secondary-default)"
        fontSize={9}
      >
        {edge.metrics.tokens > 1000000 
          ? `${(edge.metrics.tokens / 1000000).toFixed(1)}M` 
          : edge.metrics.tokens > 1000 
          ? `${(edge.metrics.tokens / 1000).toFixed(0)}K` 
          : edge.metrics.tokens} tokens
      </text>
    </g>
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
  const [viewMode, setViewMode] = useState<'provider' | 'model' | 'service'>('provider');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Global filters
  const { filters, setFilters } = useGlobalFilters();
  
  // Get available filter options
  const { data: availableServiceOptions } = useDistinctServices();
  const { data: availableProviders } = useDistinctProviders();
  const { data: availableModels } = useDistinctModels();

  // Service options for FilterBar (includes entityId and entityName)
  // FilterBar handles mapping from display name to entity ID internally

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
      
      // Build service filter - filters.serviceFilter is already the entity ID (mapped by FilterBar)
      let serviceFilterClause = '';
      if (filters.serviceFilter) {
        // FilterBar already converts service name to entity ID
        const entityId = filters.serviceFilter;
        console.log('[GCC Topology] Service filter entityId:', entityId);
        if (entityId.startsWith('SERVICE-')) {
          serviceFilterClause = `| filter dt.entity.service == "${entityId}"`;
        } else {
          // If not an entity ID, try as-is (might be entity name)
          serviceFilterClause = '';
        }
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
        | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
        ${serviceFilterClause}
        ${providerFilterClause}
        ${modelFilterClause}
        | summarize {
            requests = count(),
            tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
            avg_latency = avg(duration) / 1000000,
            error_rate = countIf(status.code == "ERROR") / count() * 100
          }, by: { dt.entity.service, gen_ai.provider.name, gen_ai.request.model }
        | sort requests desc
        | limit 100
      `;
      
      console.log('[GCC Topology] Executing DQL:', query);

      // Query for Dynatrace service entities → provider → model relationships
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
      
      // Build topology
      const nodesMap = new Map<string, TopologyNode>();
      const edges: TopologyEdge[] = [];
      
      // Track unique providers, services, and models
      const providers = new Set<string>();
      const serviceIds = new Set<string>();
      const models = new Set<string>();
      
      // Process records to identify unique entities
      records.forEach((record: any) => {
        const providerName = record['gen_ai.provider.name'] || 'Unknown Provider';
        const serviceEntityId = record['dt.entity.service'];
        const modelName = record['gen_ai.request.model'] || 'Unknown Model';
        
        providers.add(providerName);
        models.add(modelName);
        
        // Track service entity IDs
        if (serviceEntityId) {
          serviceIds.add(serviceEntityId);
        }
      });

      // Calculate positions in a hierarchical layout
      // Services on left, Providers in middle, Models on right
      const svgWidth = 1000;
      // Dynamic height based on node count - ensure enough space for all nodes
      const maxNodes = Math.max(serviceIds.size, providers.size, models.size);
      const svgHeight = Math.max(600, maxNodes * 80);
      const leftX = 120;
      const middleX = 500;
      const rightX = 880;

      // Create service nodes (left) using Dynatrace entity names
      let serviceIdx = 0;
      const serviceArray = Array.from(serviceIds);
      serviceArray.forEach((serviceId) => {
        const serviceName = serviceNamesMap.get(serviceId) || serviceId;
        const ySpacing = svgHeight / (serviceArray.length + 1);
        nodesMap.set(`service-${serviceId}`, {
          id: `service-${serviceId}`,
          type: 'service',
          name: serviceName,
          provider: serviceId, // Store entity ID for deep linking
          metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
          position: { x: leftX, y: ySpacing * (serviceIdx + 1) },
          health: 'healthy'
        });
        serviceIdx++;
      });

      // Create provider nodes (middle)
      let providerIdx = 0;
      const providerArray = Array.from(providers);
      providerArray.forEach((providerName) => {
        const ySpacing = svgHeight / (providerArray.length + 1);
        nodesMap.set(`provider-${providerName}`, {
          id: `provider-${providerName}`,
          type: 'provider',
          name: providerName,
          metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
          position: { x: middleX, y: ySpacing * (providerIdx + 1) },
          health: 'healthy'
        });
        providerIdx++;
      });

      // Create model nodes (right) - limit to 20 for readability
      const maxModels = 20;
      let modelIdx = 0;
      const modelArray = Array.from(models);
      modelArray.forEach((modelName) => {
        const displayModels = Math.min(modelArray.length, maxModels);
        const ySpacing = svgHeight / (displayModels + 1);
        if (modelIdx < maxModels) {
          nodesMap.set(`model-${modelName}`, {
            id: `model-${modelName}`,
            type: 'model',
            name: modelName,
            metrics: { requests: 0, tokens: 0, latency: 0, errorRate: 0, cost: 0 },
            position: { x: rightX, y: ySpacing * (modelIdx + 1) },
            health: 'healthy'
          });
        }
        modelIdx++;
      });

      // Process records to update metrics and create edges
      records.forEach((record: any) => {
        const serviceEntityId = record['dt.entity.service'];
        const providerName = record['gen_ai.provider.name'] || 'Unknown Provider';
        const modelName = record['gen_ai.request.model'] || 'Unknown Model';
        const requests = Number(record.requests) || 0;
        const tokens = Number(record.tokens) || 0;
        const latency = Number(record.avg_latency) || 0;
        const errorRate = Number(record.error_rate) || 0;

        // Update node metrics using entity ID
        const serviceNode = nodesMap.get(`service-${serviceEntityId}`);
        if (serviceNode) {
          serviceNode.metrics.requests += requests;
          serviceNode.metrics.tokens += tokens;
          serviceNode.metrics.latency = (serviceNode.metrics.latency + latency) / 2;
          serviceNode.metrics.errorRate = Math.max(serviceNode.metrics.errorRate, errorRate);
          serviceNode.health = errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy';
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

        // Create edges: Service → Provider (using entity ID)
        const edgeId1 = `${serviceEntityId}-${providerName}`;
        const existingEdge1 = edges.find(e => e.id === edgeId1);
        if (existingEdge1) {
          existingEdge1.metrics.requests += requests;
          existingEdge1.metrics.tokens += tokens;
          existingEdge1.thickness = Math.min(5, Math.log10(existingEdge1.metrics.requests + 1));
        } else if (serviceEntityId) {
          edges.push({
            id: edgeId1,
            source: `service-${serviceEntityId}`,
            target: `provider-${providerName}`,
            metrics: { requests, tokens, avgLatency: latency },
            thickness: Math.min(5, Math.log10(requests + 1))
          });
        }

        // Create edges: Provider → Model
        if (nodesMap.has(`model-${modelName}`)) {
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
              metrics: { requests, tokens, avgLatency: latency },
              thickness: Math.min(5, Math.log10(requests + 1))
            });
          }
        }
      });

      const nodes = Array.from(nodesMap.values());
      const totalRequests = nodes.filter(n => n.type === 'service').reduce((sum, n) => sum + n.metrics.requests, 0);
      const totalTokens = nodes.filter(n => n.type === 'service').reduce((sum, n) => sum + n.metrics.tokens, 0);

      setTopologyData({
        nodes,
        edges,
        svgDimensions: { width: svgWidth, height: svgHeight },
        summary: {
          totalServices: serviceArray.length,
          totalProviders: providerArray.length,
          totalModels: modelArray.length,
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
      <Flex flexDirection="column" gap={16} padding={16}>
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={4}>🗺️ AI Topology Map</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              Visual representation of GenAI service flows
            </Text>
          </div>
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
        <Flex justifyContent="center" alignItems="center" padding={48}>
          <ProgressCircle size="large" />
          <Text style={{ marginLeft: 16 }}>Loading AI Topology...</Text>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex flexDirection="column" gap={16} padding={16}>
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={4}>🗺️ AI Topology Map</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              Visual representation of GenAI service flows
            </Text>
          </div>
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
        <Surface padding={24} style={{ textAlign: 'center' }}>
          <Text style={{ color: Colors.Text.Critical.Default }}>❌ {error.message}</Text>
          <Button variant="default" onClick={fetchTopology} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </Surface>
      </Flex>
    );
  }

  if (!topologyData || topologyData.nodes.length === 0) {
    return (
      <Flex flexDirection="column" gap={16} padding={16}>
        <Flex justifyContent="space-between" alignItems="center">
          <div>
            <Heading level={4}>🗺️ AI Topology Map</Heading>
            <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 13 }}>
              Visual representation of GenAI service flows
            </Text>
          </div>
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
        <Surface padding={24} style={{ textAlign: 'center' }}>
          <Text>No GenAI services discovered. Adjust filters or ensure your services emit gen_ai.* spans.</Text>
          <Button variant="accent" onClick={fetchTopology} style={{ marginTop: 16 }}>
            Refresh
          </Button>
        </Surface>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={4}>🗺️ AI Topology Map</Heading>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Visual representation of GenAI service flows • Real-time data from Grail
          </Text>
        </Flex>
        <Flex gap={8}>
          <Button 
            variant={autoRefresh ? 'emphasized' : 'default'} 
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Auto-Refresh ON' : '⏸️ Auto-Refresh OFF'}
          </Button>
        </Flex>
      </Flex>

      {/* Filter Bar - Standard Dynatrace filter pattern */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={fetchTopology}
        isLoading={loading}
        availableServices={availableServiceOptions || []}
        availableProviders={availableProviders || []}
        availableModels={availableModels || []}
      />

      {/* Summary Cards */}
      <Flex gap={12}>
        <Surface style={{ flex: 1, padding: 12 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Services</Text>
            <Heading level={3}>{topologyData.summary.totalServices}</Heading>
          </Flex>
        </Surface>
        <Surface style={{ flex: 1, padding: 12 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Providers</Text>
            <Heading level={3}>{topologyData.summary.totalProviders}</Heading>
          </Flex>
        </Surface>
        <Surface style={{ flex: 1, padding: 12 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Models</Text>
            <Heading level={3}>{topologyData.summary.totalModels}</Heading>
          </Flex>
        </Surface>
        <Surface style={{ flex: 1, padding: 12 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Total Requests</Text>
            <Heading level={3}>{topologyData.summary.totalRequests.toLocaleString()}</Heading>
          </Flex>
        </Surface>
        <Surface style={{ flex: 1, padding: 12 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Total Tokens</Text>
            <Heading level={3}>
              {topologyData.summary.totalTokens > 1000000 
                ? `${(topologyData.summary.totalTokens / 1000000).toFixed(1)}M`
                : topologyData.summary.totalTokens.toLocaleString()}
            </Heading>
          </Flex>
        </Surface>
      </Flex>

      {/* Legend */}
      <Flex gap={16} padding={8} style={{ background: 'var(--dt-colors-surface-default)', borderRadius: 6 }}>
        <Flex alignItems="center" gap={4}>
          <span>🤖</span>
          <Text textStyle="small">Services</Text>
        </Flex>
        <Flex alignItems="center" gap={4}>
          <span>☁️</span>
          <Text textStyle="small">Providers</Text>
        </Flex>
        <Flex alignItems="center" gap={4}>
          <span>🧠</span>
          <Text textStyle="small">Models</Text>
        </Flex>
        <Text textStyle="small" style={{ marginLeft: 'auto', color: Colors.Text.Neutral.Subdued }}>
          Edge thickness = request volume | Node size = type hierarchy
        </Text>
      </Flex>

      {/* Topology SVG */}
      <Surface style={{ padding: 16, minHeight: (topologyData?.svgDimensions.height || 600) + 20, overflow: 'auto' }}>
        <svg 
          width="100%" 
          height={topologyData?.svgDimensions.height || 600} 
          viewBox={`0 0 ${topologyData?.svgDimensions.width || 1000} ${topologyData?.svgDimensions.height || 600}`} 
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon 
                points="0 0, 10 3.5, 0 7" 
                fill="var(--dt-colors-border-neutral-default)"
                opacity={0.6}
              />
            </marker>
          </defs>

          {/* Column labels */}
          <text x="100" y="30" textAnchor="middle" fill="var(--dt-colors-text-secondary-default)" fontSize={12} fontWeight={600}>
            SERVICES
          </text>
          <text x="450" y="30" textAnchor="middle" fill="var(--dt-colors-text-secondary-default)" fontSize={12} fontWeight={600}>
            PROVIDERS
          </text>
          <text x="800" y="30" textAnchor="middle" fill="var(--dt-colors-text-secondary-default)" fontSize={12} fontWeight={600}>
            MODELS
          </text>

          {/* Edges (render first so they're behind nodes) */}
          {topologyData.edges.map((edge) => {
            const sourceNode = topologyData.nodes.find(n => n.id === edge.source);
            const targetNode = topologyData.nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            
            return (
              <TopologyEdgeComponent
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
              />
            );
          })}

          {/* Nodes */}
          {topologyData.nodes.map((node) => (
            <TopologyNodeComponent
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              onSelect={setSelectedNode}
            />
          ))}
        </svg>
      </Surface>

      {/* Selected Node Details */}
      {selectedNode && (
        <Surface style={{ padding: 16 }}>
          <Flex justifyContent="space-between" alignItems="flex-start">
            <Flex flexDirection="column" gap={8}>
              <Flex alignItems="center" gap={8}>
                <span style={{ fontSize: 24 }}>
                  {selectedNode.type === 'service' ? '🤖' : selectedNode.type === 'provider' ? '☁️' : '🧠'}
                </span>
                <Heading level={5}>{selectedNode.name}</Heading>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: selectedNode.health === 'healthy' ? 'rgba(76, 175, 80, 0.2)' :
                              selectedNode.health === 'warning' ? 'rgba(255, 152, 0, 0.2)' :
                              'rgba(244, 67, 54, 0.2)',
                  color: selectedNode.health === 'healthy' ? '#4CAF50' :
                         selectedNode.health === 'warning' ? '#ff9800' : '#f44336'
                }}>
                  {selectedNode.health.toUpperCase()}
                </span>
              </Flex>
              <Flex gap={24}>
                <div>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Requests</Text>
                  <Text style={{ fontWeight: 600 }}>{selectedNode.metrics.requests.toLocaleString()}</Text>
                </div>
                <div>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Tokens</Text>
                  <Text style={{ fontWeight: 600 }}>{selectedNode.metrics.tokens.toLocaleString()}</Text>
                </div>
                <div>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Avg Latency</Text>
                  <Text style={{ fontWeight: 600 }}>{selectedNode.metrics.latency.toFixed(0)}ms</Text>
                </div>
                <div>
                  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>Error Rate</Text>
                  <Text style={{ fontWeight: 600, color: selectedNode.metrics.errorRate > 5 ? Colors.Text.Critical.Default : 'inherit' }}>
                    {selectedNode.metrics.errorRate.toFixed(1)}%
                  </Text>
                </div>
              </Flex>
            </Flex>
            <Button variant="default" onClick={() => setSelectedNode(null)}>
              ✕ Close
            </Button>
          </Flex>
        </Surface>
      )}
    </Flex>
  );
};

export default AITopology;
