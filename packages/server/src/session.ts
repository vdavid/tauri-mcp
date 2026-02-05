/**
 * Session management for Tauri MCP connections.
 * Functional module - no classes.
 */

import {
  connect,
  disconnect,
  isConnected,
  getConnectionInfo,
} from "./client.js";

// ============================================================================
// Types
// ============================================================================

export interface SessionStatus {
  connected: boolean;
  app: string | null;
  host: string | null;
  port: number | null;
}

interface SessionState {
  appName: string | null;
}

// ============================================================================
// Module state
// ============================================================================

let sessionState: SessionState = {
  appName: null,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Start a session by connecting to a Tauri app.
 */
export const startSession = async (
  host?: string,
  port?: number
): Promise<string> => {
  const connectionInfo = getConnectionInfo();

  // Already connected to same endpoint
  if (
    connectionInfo.connected &&
    (!host || host === connectionInfo.host) &&
    (!port || port === connectionInfo.port)
  ) {
    return `Already connected to ${sessionState.appName ?? "Tauri App"} (${connectionInfo.host}:${connectionInfo.port})`;
  }

  const targetHost = host ?? "localhost";
  const targetPort = port ?? 9223;

  try {
    await connect(targetHost, targetPort);
    sessionState.appName = "Tauri App";
    return `Connected to ${sessionState.appName} (${targetHost}:${targetPort})`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to connect to Tauri app at ${targetHost}:${targetPort}: ${message}`
    );
  }
};

/**
 * Stop the current session.
 */
export const stopSession = (): string => {
  if (!isConnected()) {
    return "Not connected";
  }

  disconnect();
  sessionState.appName = null;
  return "Disconnected";
};

/**
 * Get the current session status.
 */
export const getSessionStatus = (): SessionStatus => {
  const connectionInfo = getConnectionInfo();

  return {
    connected: connectionInfo.connected,
    app: connectionInfo.connected ? (sessionState.appName ?? "Tauri App") : null,
    host: connectionInfo.host,
    port: connectionInfo.port,
  };
};

/**
 * Ensure a session is active. Throws if not connected.
 */
export const ensureSession = (): void => {
  if (!isConnected()) {
    throw new Error(
      'No active session. Call tauri_session with action "start" first.'
    );
  }
};
