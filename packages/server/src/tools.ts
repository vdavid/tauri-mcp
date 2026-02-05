/**
 * MCP tool definitions for Tauri automation.
 * Functional module - no classes.
 */

import { z } from "zod";
import { sendCommand } from "./client.js";
import {
  startSession,
  stopSession,
  getSessionStatus,
  ensureSession,
} from "./session.js";

// ============================================================================
// Types
// ============================================================================

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type ToolContent = TextContent | ImageContent;
export type ToolResult = string | ToolContent | ToolContent[];
export type ToolHandler = (args: unknown) => Promise<ToolResult>;

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodSchema;
  handler: ToolHandler;
}

// ============================================================================
// Schemas
// ============================================================================

const sessionSchema = z.object({
  action: z
    .enum(["start", "stop", "status"])
    .describe("Action: start, stop, or status"),
  host: z.string().optional().describe("Host address (default: localhost)"),
  port: z.number().optional().describe("Port number (default: 9223)"),
});

const screenshotSchema = z.object({
  format: z
    .enum(["png", "jpeg"])
    .optional()
    .describe("Image format (default: png)"),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("JPEG quality 0-100 (only for jpeg format)"),
  windowId: z.string().optional().describe("Target window label"),
});

const domSnapshotSchema = z.object({
  type: z
    .enum(["accessibility", "structure"])
    .describe(
      "Snapshot type: accessibility (roles, names, states) or structure (tags, IDs, classes)"
    ),
  selector: z.string().optional().describe("CSS selector to scope the snapshot"),
  windowId: z.string().optional().describe("Target window label"),
});

const executeJsSchema = z.object({
  script: z.string().describe("JavaScript code to execute"),
  windowId: z.string().optional().describe("Target window label"),
});

const consoleLogsSchema = z.object({
  filter: z.string().optional().describe("Regex to filter messages"),
  since: z.string().optional().describe("ISO timestamp to filter by time"),
  clear: z
    .boolean()
    .optional()
    .describe("Clear logs after reading (default: false)"),
  windowId: z.string().optional().describe("Target window label"),
});

const windowListSchema = z.object({});

const windowInfoSchema = z.object({
  windowId: z.string().optional().describe("Window label (default: focused)"),
});

const windowResizeSchema = z.object({
  width: z.number().describe("New width in pixels"),
  height: z.number().describe("New height in pixels"),
  windowId: z.string().optional().describe("Target window label"),
});

const interactSchema = z.object({
  action: z
    .enum(["click", "double_click", "type", "scroll"])
    .describe("Interaction type"),
  selector: z.string().optional().describe("CSS selector for target element"),
  x: z.number().optional().describe("X coordinate (alternative to selector)"),
  y: z.number().optional().describe("Y coordinate (alternative to selector)"),
  text: z.string().optional().describe("Text to type (for type action)"),
  scrollX: z.number().optional().describe("Horizontal scroll amount"),
  scrollY: z.number().optional().describe("Vertical scroll amount"),
  windowId: z.string().optional().describe("Target window label"),
});

const waitForSchema = z.object({
  type: z
    .enum(["selector", "text", "visible", "hidden"])
    .describe("Condition type to wait for"),
  value: z.string().describe("Selector or text to wait for"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout in milliseconds (default: 5000)"),
  windowId: z.string().optional().describe("Target window label"),
});

// ============================================================================
// Tool handlers
// ============================================================================

const handleSession: ToolHandler = async (args) => {
  const { action, host, port } = sessionSchema.parse(args);

  switch (action) {
    case "start":
      return await startSession(host, port);
    case "stop":
      return stopSession();
    case "status":
      return JSON.stringify(getSessionStatus(), null, 2);
  }
};

const handleScreenshot: ToolHandler = async (args) => {
  ensureSession();
  const { format, quality, windowId } = screenshotSchema.parse(args);

  const response = await sendCommand("screenshot", {
    format: format ?? "png",
    quality,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Screenshot failed");
  }

  const data = response.data as string;

  // Return as image content
  return {
    type: "image",
    data: data.replace(/^data:image\/\w+;base64,/, ""),
    mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
  };
};

const handleDomSnapshot: ToolHandler = async (args) => {
  ensureSession();
  const { type, selector, windowId } = domSnapshotSchema.parse(args);

  const response = await sendCommand("dom_snapshot", {
    snapshot_type: type,
    selector,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "DOM snapshot failed");
  }

  return response.data as string;
};

const handleExecuteJs: ToolHandler = async (args) => {
  ensureSession();
  const { script, windowId } = executeJsSchema.parse(args);

  const response = await sendCommand("execute_js", {
    script,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "JavaScript execution failed");
  }

  const result = response.data;
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
};

const handleConsoleLogs: ToolHandler = async (args) => {
  ensureSession();
  const { filter, since, clear, windowId } = consoleLogsSchema.parse(args);

  const response = await sendCommand("console_logs", {
    filter,
    since,
    clear,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Failed to get console logs");
  }

  return response.data as string;
};

const handleWindowList: ToolHandler = async (args) => {
  ensureSession();
  windowListSchema.parse(args);

  const response = await sendCommand("window_list", {});

  if (!response.success) {
    throw new Error(response.error ?? "Failed to list windows");
  }

  return JSON.stringify(response.data, null, 2);
};

const handleWindowInfo: ToolHandler = async (args) => {
  ensureSession();
  const { windowId } = windowInfoSchema.parse(args);

  const response = await sendCommand("window_info", {
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Failed to get window info");
  }

  return JSON.stringify(response.data, null, 2);
};

const handleWindowResize: ToolHandler = async (args) => {
  ensureSession();
  const { width, height, windowId } = windowResizeSchema.parse(args);

  const response = await sendCommand("window_resize", {
    width,
    height,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Failed to resize window");
  }

  return `Resized to ${width}x${height}`;
};

const handleInteract: ToolHandler = async (args) => {
  ensureSession();
  const { action, selector, x, y, text, scrollX, scrollY, windowId } =
    interactSchema.parse(args);

  const response = await sendCommand("interact", {
    action,
    selector,
    x,
    y,
    text,
    scroll_x: scrollX,
    scroll_y: scrollY,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Interaction failed");
  }

  return response.data as string;
};

const handleWaitFor: ToolHandler = async (args) => {
  ensureSession();
  const { type, value, timeout, windowId } = waitForSchema.parse(args);

  const response = await sendCommand("wait_for", {
    wait_type: type,
    value,
    timeout: timeout ?? 5000,
    window_id: windowId,
  });

  if (!response.success) {
    throw new Error(response.error ?? "Wait condition not met");
  }

  return response.data as string;
};

// ============================================================================
// Tool definitions
// ============================================================================

export const tools: ToolDefinition[] = [
  {
    name: "tauri_session",
    description:
      "Start, stop, or check status of the connection to a Tauri app. " +
      "Use action 'start' to connect (optionally specify host and port). " +
      "Use action 'status' to check connection state. " +
      "Use action 'stop' to disconnect. " +
      "Required before using other tauri_* tools.",
    schema: sessionSchema,
    handler: handleSession,
  },
  {
    name: "tauri_screenshot",
    description:
      "Capture a screenshot of the Tauri app's webview. " +
      "Returns the image as base64. " +
      "Supports PNG (default) or JPEG format with quality setting.",
    schema: screenshotSchema,
    handler: handleScreenshot,
  },
  {
    name: "tauri_dom_snapshot",
    description:
      "Get a structured snapshot of the DOM for AI consumption. " +
      "Type 'accessibility': roles, names, states, aria attributes. Good for understanding UI semantics. " +
      "Type 'structure': tag names, IDs, classes, data-testid. Good for writing selectors.",
    schema: domSnapshotSchema,
    handler: handleDomSnapshot,
  },
  {
    name: "tauri_execute_js",
    description:
      "Execute JavaScript in the webview context. " +
      "Return value must be JSON-serializable. " +
      "5 second timeout by default.",
    schema: executeJsSchema,
    handler: handleExecuteJs,
  },
  {
    name: "tauri_console_logs",
    description:
      "Get captured console logs from the webview. " +
      "Includes timestamp, level, and message. " +
      "Supports filtering by regex and timestamp.",
    schema: consoleLogsSchema,
    handler: handleConsoleLogs,
  },
  {
    name: "tauri_window_list",
    description:
      "List all windows in the Tauri application. " +
      "Returns window labels, titles, and focused state.",
    schema: windowListSchema,
    handler: handleWindowList,
  },
  {
    name: "tauri_window_info",
    description:
      "Get detailed information about a window. " +
      "Includes size, position, title, focused state, visibility.",
    schema: windowInfoSchema,
    handler: handleWindowInfo,
  },
  {
    name: "tauri_window_resize",
    description: "Resize a window to the specified dimensions.",
    schema: windowResizeSchema,
    handler: handleWindowResize,
  },
  {
    name: "tauri_interact",
    description:
      "Perform UI interactions: click, double_click, type, or scroll. " +
      "Target by CSS selector or coordinates. " +
      "For 'type' action, provide the text to type. " +
      "For 'scroll' action, provide scrollX and/or scrollY amounts.",
    schema: interactSchema,
    handler: handleInteract,
  },
  {
    name: "tauri_wait_for",
    description:
      "Wait for a condition to be true. " +
      "Types: selector (element exists), text (text appears), visible (element visible), hidden (element hidden). " +
      "Default timeout: 5000ms.",
    schema: waitForSchema,
    handler: handleWaitFor,
  },
];

/**
 * Map for fast tool lookup by name.
 */
export const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
