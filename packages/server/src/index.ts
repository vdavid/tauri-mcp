#!/usr/bin/env node
/**
 * MCP server entry point for Tauri app automation.
 * Connects AI assistants to Tauri apps via WebSocket.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools, toolMap, ToolResult, ToolContent } from "./tools.js";

// ============================================================================
// Server setup
// ============================================================================

const version = "0.1.0";

const server = new Server(
  {
    name: "tauri-mcp",
    version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Error handling
// ============================================================================

server.onerror = (error) => {
  const message = error instanceof Error ? error.message : String(error);

  // Ignore broken pipe errors - client disconnected
  if (message.includes("broken pipe") || message.includes("EPIPE")) {
    process.exit(0);
  }

  // Log other errors to stderr (captured by MCP client)
  console.error(`[tauri-mcp] Error: ${message}`);
};

server.onclose = () => {
  process.exit(0);
};

// ============================================================================
// Content conversion
// ============================================================================

interface McpContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

const contentToMcp = (content: ToolContent): McpContent => {
  if (content.type === "text") {
    return { type: "text", text: content.text };
  }
  return { type: "image", data: content.data, mimeType: content.mimeType };
};

const toolResultToContent = (result: ToolResult): McpContent[] => {
  // String result - convert to text content
  if (typeof result === "string") {
    return [{ type: "text", text: result }];
  }

  // Array of content items
  if (Array.isArray(result)) {
    return result.map(contentToMcp);
  }

  // Single content item
  return [contentToMcp(result)];
};

// ============================================================================
// Request handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const tool = toolMap.get(request.params.name);

    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const result = await tool.handler(request.params.arguments);

    return { content: toolResultToContent(result) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ============================================================================
// Main
// ============================================================================

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch(() => {
  process.exit(1);
});
