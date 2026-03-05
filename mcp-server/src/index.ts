#!/usr/bin/env node
/**
 * GenAI Control Center — MCP Server
 *
 * Exposes all 30 GCC tools as Model Context Protocol tools.
 * Runs as a stdio-based MCP server for use with Claude Desktop,
 * VS Code Copilot, or any MCP-compatible client.
 *
 * Environment variables:
 *   DT_ENVIRONMENT_URL — Dynatrace environment URL (e.g. https://{id}.apps.dynatrace.com)
 *   DT_API_TOKEN       — Dynatrace API token with read scopes
 *
 * Usage:
 *   DT_ENVIRONMENT_URL=https://xxx.apps.dynatrace.com DT_API_TOKEN=dt0c01.xxx node dist/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TOOL_REGISTRY } from "./tools.js";

// ── Create MCP Server ──────────────────────────────────────

const server = new McpServer({
  name: "gcc-genai-control-center",
  version: "1.0.0",
});

// ── Register all tools ─────────────────────────────────────

for (const tool of TOOL_REGISTRY) {
  server.tool(
    tool.name,
    tool.description,
    {
      timeframe: z
        .string()
        .default("24h")
        .describe(
          "Time window for the query (e.g. 1h, 6h, 24h, 7d, 30d). Defaults to 24h."
        ),
    },
    async ({ timeframe }) => {
      try {
        const result = await tool.execute(timeframe);

        // Format data as readable text + JSON
        const lines: string[] = [];
        lines.push(`## ${tool.name}`);
        lines.push("");
        lines.push(`**Summary:** ${result.summary}`);
        lines.push(`**Execution Time:** ${result.executionTimeMs}ms`);
        if (result.dql) {
          lines.push("");
          lines.push("**DQL Query:**");
          lines.push("```dql");
          lines.push(result.dql);
          lines.push("```");
        }
        lines.push("");
        lines.push("**Data:**");
        lines.push("```json");
        lines.push(JSON.stringify(result.data, null, 2));
        lines.push("```");

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing ${tool.name}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// ── Also expose a "list_tools" resource for discovery ──────

server.resource("tool-catalog", "gcc://tools/catalog", async (uri) => {
  const catalog = TOOL_REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
  }));
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(catalog, null, 2),
      },
    ],
  };
});

// ── Start the server ───────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[GCC MCP Server] Started with ${TOOL_REGISTRY.length} tools. Waiting for connections...`
  );
}

main().catch((err) => {
  console.error("[GCC MCP Server] Fatal error:", err);
  process.exit(1);
});
