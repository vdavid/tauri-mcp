/**
 * WebSocket client for communicating with the Tauri MCP plugin.
 * Functional module - no classes.
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

interface ClientState {
  ws: WebSocket | null;
  host: string;
  port: number;
  pendingRequests: Map<string, PendingRequest>;
  reconnectAttempts: number;
  shouldReconnect: boolean;
  pingInterval: ReturnType<typeof setInterval> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
}

// ============================================================================
// Configuration
// ============================================================================

const defaultHost = process.env.TAURI_MCP_HOST ?? "localhost";
const defaultPort = parseInt(process.env.TAURI_MCP_PORT ?? "9223", 10);
const defaultTimeout = parseInt(process.env.TAURI_MCP_TIMEOUT ?? "10000", 10);
const pingIntervalMs = 30000; // 30 seconds keep-alive
const maxReconnectAttempts = 3;
const reconnectDelayMs = 1000;

// ============================================================================
// Module state
// ============================================================================

let clientState: ClientState | null = null;

// ============================================================================
// Internal helpers
// ============================================================================

const buildWebSocketUrl = (host: string, port: number): string =>
  `ws://${host}:${port}`;

const generateRequestId = (): string =>
  `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const handleMessage = (data: WebSocket.Data): void => {
  if (!clientState) return;

  try {
    const message = JSON.parse(data.toString()) as PluginResponse;

    if (message.id && clientState.pendingRequests.has(message.id)) {
      const pending = clientState.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        clientState.pendingRequests.delete(message.id);
        pending.resolve(message);
      }
    }
  } catch {
    // Failed to parse message - ignore
  }
};

const handleClose = (): void => {
  if (!clientState) return;

  // Clear ping interval
  if (clientState.pingInterval) {
    clearInterval(clientState.pingInterval);
    clientState.pingInterval = null;
  }

  // Reject all pending requests
  for (const [id, pending] of clientState.pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Connection closed"));
    clientState.pendingRequests.delete(id);
  }

  clientState.ws = null;

  // Auto-reconnect if enabled
  if (
    clientState.shouldReconnect &&
    clientState.reconnectAttempts < maxReconnectAttempts
  ) {
    clientState.reconnectAttempts++;
    const delay = reconnectDelayMs * clientState.reconnectAttempts;

    // Store host/port locally to avoid non-null assertion in callback
    const { host, port } = clientState;
    clientState.reconnectTimeout = setTimeout(() => {
      // Check if disconnect was called while waiting
      if (!clientState) return;

      clientState.reconnectTimeout = null;
      connect(host, port).catch(() => {
        // Reconnection failed silently
      });
    }, delay);
  }
};

const startPingInterval = (): void => {
  if (!clientState || clientState.pingInterval) return;

  clientState.pingInterval = setInterval(() => {
    if (clientState?.ws?.readyState === WebSocket.OPEN) {
      clientState.ws.ping();
    }
  }, pingIntervalMs);
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Connect to the Tauri MCP plugin WebSocket server.
 */
export const connect = async (
  host: string = defaultHost,
  port: number = defaultPort
): Promise<void> => {
  // If already connected to same host/port, reuse
  if (
    clientState?.ws?.readyState === WebSocket.OPEN &&
    clientState.host === host &&
    clientState.port === port
  ) {
    return;
  }

  // Disconnect existing connection if host/port changed
  if (clientState?.ws) {
    disconnect();
  }

  return new Promise((resolve, reject) => {
    const url = buildWebSocketUrl(host, port);
    const ws = new WebSocket(url);

    clientState = {
      ws,
      host,
      port,
      pendingRequests: new Map(),
      reconnectAttempts: 0,
      shouldReconnect: true,
      pingInterval: null,
      reconnectTimeout: null,
    };

    ws.on("open", () => {
      if (clientState) {
        clientState.reconnectAttempts = 0;
      }
      startPingInterval();
      resolve();
    });

    ws.on("message", handleMessage);
    ws.on("close", handleClose);

    ws.on("error", (error) => {
      reject(error);
    });
  });
};

/**
 * Disconnect from the Tauri MCP plugin.
 */
export const disconnect = (): void => {
  if (!clientState) return;

  clientState.shouldReconnect = false;

  // Cancel any pending reconnection timeout
  if (clientState.reconnectTimeout) {
    clearTimeout(clientState.reconnectTimeout);
    clientState.reconnectTimeout = null;
  }

  if (clientState.pingInterval) {
    clearInterval(clientState.pingInterval);
    clientState.pingInterval = null;
  }

  if (clientState.ws) {
    clientState.ws.close();
    clientState.ws = null;
  }

  // Reject all pending requests
  for (const [id, pending] of clientState.pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Disconnected"));
    clientState.pendingRequests.delete(id);
  }

  clientState = null;
};

/**
 * Check if currently connected.
 */
export const isConnected = (): boolean =>
  clientState?.ws?.readyState === WebSocket.OPEN;

/**
 * Get current connection info.
 */
export const getConnectionInfo = (): {
  connected: boolean;
  host: string | null;
  port: number | null;
} => ({
  connected: isConnected(),
  host: clientState?.host ?? null,
  port: clientState?.port ?? null,
});

/**
 * Send a command to the plugin and wait for response.
 */
export const sendCommand = async (
  command: string,
  args?: Record<string, unknown>,
  timeoutMs: number = defaultTimeout
): Promise<PluginResponse> => {
  if (!clientState || clientState.ws?.readyState !== WebSocket.OPEN) {
    throw new Error(
      "Not connected. Call tauri_session with action 'start' first."
    );
  }

  const id = generateRequestId();
  const request: PluginRequest = { id, command, args };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clientState?.pendingRequests.delete(id);
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    clientState!.pendingRequests.set(id, { resolve, reject, timeout });

    clientState!.ws!.send(JSON.stringify(request), (error) => {
      if (error) {
        clearTimeout(timeout);
        clientState?.pendingRequests.delete(id);
        reject(error);
      }
    });
  });
};
