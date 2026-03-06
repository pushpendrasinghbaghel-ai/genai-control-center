/**
 * useMCPGateway Hook
 * 
 * Provides UI integration with the MCP Gateway server.
 * Handles status monitoring, tool discovery, and tool execution.
 */

import { useState, useEffect, useCallback } from 'react';

// Types matching gateway server
export interface MCPServerStatus {
  serverId: string;
  serverName: string;
  connected: boolean;
  availableTools: string[];
  lastHealthCheck?: string;
  error?: string;
}

export interface GatewayStatus {
  healthy: boolean;
  connectedServers: number;
  totalServers: number;
  servers: MCPServerStatus[];
  bizEventsPublished: number;
  bizEventsQueued: number;
}

export interface MCPTool {
  serverId: string;
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: unknown;
}

export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  serverId: string;
  toolName: string;
}

interface MCPGatewayState {
  gatewayUrl: string;
  gatewayStatus: GatewayStatus | null;
  tools: MCPTool[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

const DEFAULT_GATEWAY_URL = 'http://localhost:3100';

export function useMCPGateway(gatewayUrl: string = DEFAULT_GATEWAY_URL) {
  const [state, setState] = useState<MCPGatewayState>({
    gatewayUrl,
    gatewayStatus: null,
    tools: [],
    loading: false,
    error: null,
    lastRefresh: null,
  });

  /**
   * Fetch gateway status
   */
  const fetchStatus = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${gatewayUrl}/mcp/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const status: GatewayStatus = await response.json();
      setState(prev => ({ 
        ...prev, 
        gatewayStatus: status,
        loading: false,
        lastRefresh: new Date(),
      }));
      return status;
    } catch (error) {
      const msg = error instanceof Error 
        ? `Gateway unavailable: ${error.message}` 
        : 'Gateway unavailable';
      setState(prev => ({ ...prev, error: msg, loading: false }));
      return null;
    }
  }, [gatewayUrl]);

  /**
   * Fetch available tools from all connected servers
   */
  const fetchTools = useCallback(async () => {
    try {
      const response = await fetch(`${gatewayUrl}/mcp/tools`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setState(prev => ({ ...prev, tools: data.tools || [] }));
      return data.tools || [];
    } catch {
      return [];
    }
  }, [gatewayUrl]);

  /**
   * Call a tool on an MCP server
   */
  const callTool = useCallback(async (
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {},
    publishToDynatrace: boolean = true
  ): Promise<ToolCallResult> => {
    try {
      const response = await fetch(`${gatewayUrl}/mcp/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          toolName,
          arguments: args,
          publishToDynatrace,
        }),
      });

      const result: ToolCallResult = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Call failed',
        duration: 0,
        serverId,
        toolName,
      };
    }
  }, [gatewayUrl]);

  /**
   * Connect to an MCP server
   */
  const connectServer = useCallback(async (config: {
    id: string;
    name: string;
    transport: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
  }) => {
    try {
      const response = await fetch(`${gatewayUrl}/mcp/servers/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      if (result.success) {
        await fetchStatus(); // Refresh status after connecting
      }
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }, [gatewayUrl, fetchStatus]);

  /**
   * Disconnect from an MCP server
   */
  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`${gatewayUrl}/mcp/servers/${serverId}/disconnect`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        await fetchStatus(); // Refresh status after disconnecting
      }
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Disconnect failed' 
      };
    }
  }, [gatewayUrl, fetchStatus]);

  /**
   * Configure Dynatrace credentials for BizEvents publishing
   */
  const configureDynatrace = useCallback(async (
    environmentUrl: string,
    apiToken: string
  ) => {
    try {
      const response = await fetch(`${gatewayUrl}/config/dynatrace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl, apiToken }),
      });

      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Configuration failed' 
      };
    }
  }, [gatewayUrl]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchTools()]);
  }, [fetchStatus, fetchTools]);

  // Initial fetch on mount
  useEffect(() => {
    refresh();
    
    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [refresh, fetchStatus]);

  return {
    // State
    gatewayUrl: state.gatewayUrl,
    status: state.gatewayStatus,
    tools: state.tools,
    loading: state.loading,
    error: state.error,
    lastRefresh: state.lastRefresh,
    
    // Computed
    isConnected: state.gatewayStatus?.healthy ?? false,
    connectedServers: state.gatewayStatus?.servers.filter(s => s.connected) ?? [],
    
    // Actions
    refresh,
    fetchStatus,
    fetchTools,
    callTool,
    connectServer,
    disconnectServer,
    configureDynatrace,
  };
}
