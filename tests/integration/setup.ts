/**
 * Test harness for connecting to a running Tauri test-app.
 * Start the test-app before running tests: cd packages/test-app && pnpm tauri dev
 */

import WebSocket from "ws";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Configuration
// ============================================================================

const host = process.env.TAURI_MCP_HOST ?? "localhost";
const port = parseInt(process.env.TAURI_MCP_PORT ?? "9223", 10);
const defaultTimeout = 10000;
const connectionTimeout = 5000;

// ============================================================================
// Module state
// ============================================================================

let ws: WebSocket | null = null;
let pendingRequests = new Map<
  string,
  {
    resolve: (response: PluginResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();
let requestCounter = 0;
let appAvailable: boolean | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if the test-app is running. Caches result.
 */
export const isAppAvailable = async (): Promise<boolean> => {
  if (appAvailable !== null) return appAvailable;

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
export const connect = async (): Promise<void> => {
  if (ws?.readyState === WebSocket.OPEN) return;

  return new Promise((resolve, reject) => {
    ws = new WebSocket(`ws://${host}:${port}`);
    pendingRequests = new Map();

    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error(`Connection timed out after ${connectionTimeout}ms`));
    }, connectionTimeout);

    ws.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as PluginResponse;
        const pending = pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequests.delete(message.id);
          pending.resolve(message);
        }
      } catch {
        // Ignore parse errors
      }
    });

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
  ws?.close();
  ws = null;
  pendingRequests.clear();
};

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

  const id = `test_${Date.now()}_${++requestCounter}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

    ws!.send(JSON.stringify({ id, command, args }), (error) => {
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
      "\n  [SKIP] Test-app not running. Start with: cd packages/test-app && pnpm tauri dev\n"
    );
  }
  return !available;
};
