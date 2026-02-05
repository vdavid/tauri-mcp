/**
 * Test harness for connecting to a running Tauri test-app.
 * The test-app must be running before executing these tests.
 *
 * To run integration tests:
 * 1. Start the test-app: cd packages/test-app && pnpm tauri dev
 * 2. Run tests: cd tests && pnpm test
 */

import WebSocket from "ws";

// ============================================================================
// Types
// ============================================================================

export interface PluginRequest {
  id: string;
  command: string;
  args?: Record<string, unknown>;
}

export interface PluginResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  windowContext?: {
    windowLabel: string;
    totalWindows: number;
    warning?: string;
  };
}

interface PendingRequest {
  resolve: (response: PluginResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Configuration
// ============================================================================

const defaultHost = process.env.TAURI_MCP_HOST ?? "localhost";
const defaultPort = parseInt(process.env.TAURI_MCP_PORT ?? "9223", 10);
const defaultTimeout = 10000;
const connectionTimeout = 5000;

// ============================================================================
// Module state
// ============================================================================

let ws: WebSocket | null = null;
let pendingRequests = new Map<string, PendingRequest>();
let requestCounter = 0;
let appAvailable: boolean | null = null;

// ============================================================================
// Internal helpers
// ============================================================================

const generateRequestId = (): string => {
  requestCounter++;
  return `test_${Date.now()}_${requestCounter}`;
};

const handleMessage = (data: WebSocket.Data): void => {
  try {
    const message = JSON.parse(data.toString()) as PluginResponse;

    if (message.id && pendingRequests.has(message.id)) {
      const pending = pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.delete(message.id);
        pending.resolve(message);
      }
    }
  } catch {
    // Ignore parse errors
  }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if the test-app is running and available.
 * Caches the result to avoid repeated connection attempts.
 */
export const isAppAvailable = async (
  host: string = defaultHost,
  port: number = defaultPort
): Promise<boolean> => {
  if (appAvailable !== null) {
    return appAvailable;
  }

  return new Promise((resolve) => {
    const testWs = new WebSocket(`ws://${host}:${port}`);
    const timeout = setTimeout(() => {
      testWs.close();
      appAvailable = false;
      resolve(false);
    }, connectionTimeout);

    testWs.on("open", () => {
      clearTimeout(timeout);
      testWs.close();
      appAvailable = true;
      resolve(true);
    });

    testWs.on("error", () => {
      clearTimeout(timeout);
      appAvailable = false;
      resolve(false);
    });
  });
};

/**
 * Connect to the test-app. Must be called before sending commands.
 */
export const connect = async (
  host: string = defaultHost,
  port: number = defaultPort
): Promise<void> => {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  return new Promise((resolve, reject) => {
    const url = `ws://${host}:${port}`;
    ws = new WebSocket(url);
    pendingRequests = new Map();

    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error(`Connection timed out after ${connectionTimeout}ms`));
    }, connectionTimeout);

    ws.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on("message", handleMessage);

    ws.on("close", () => {
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Connection closed"));
        pendingRequests.delete(id);
      }
      ws = null;
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

/**
 * Disconnect from the test-app.
 */
export const disconnect = (): void => {
  if (ws) {
    ws.close();
    ws = null;
  }
  pendingRequests.clear();
};

/**
 * Check if currently connected.
 */
export const isConnected = (): boolean => ws?.readyState === WebSocket.OPEN;

/**
 * Send a command to the plugin and wait for response.
 */
export const sendCommand = async (
  command: string,
  args?: Record<string, unknown>,
  timeoutMs: number = defaultTimeout
): Promise<PluginResponse> => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to test-app");
  }

  const id = generateRequestId();
  const request: PluginRequest = { id, command, args };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

    ws!.send(JSON.stringify(request), (error) => {
      if (error) {
        clearTimeout(timeout);
        pendingRequests.delete(id);
        reject(error);
      }
    });
  });
};

/**
 * Helper to skip a test if the app isn't available.
 */
export const skipIfAppNotAvailable = async (): Promise<boolean> => {
  const available = await isAppAvailable();
  if (!available) {
    console.log(
      "\n  [SKIP] Test-app not running. Start it with: cd packages/test-app && pnpm tauri dev\n"
    );
  }
  return !available;
};

/**
 * Reset app availability cache. Useful between test runs.
 */
export const resetAppAvailabilityCache = (): void => {
  appAvailable = null;
};
