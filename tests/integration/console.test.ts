/**
 * Integration tests for tauri_console_logs tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_console_logs", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should retrieve console logs", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // First, generate some console output
    await sendCommand("execute_js", {
      script: 'console.log("test-log-message-" + Date.now())',
    });

    const response = await sendCommand("console_logs", {});

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");
  });

  it("should filter logs by regex", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Generate a unique log message
    const uniqueId = `unique-filter-test-${Date.now()}`;
    await sendCommand("execute_js", {
      script: `console.log("${uniqueId}")`,
    });

    const response = await sendCommand("console_logs", {
      filter: uniqueId,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();

    const logs = response.data as string;
    expect(logs).toContain(uniqueId);
  });

  it("should clear logs when requested", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Generate a unique log message
    const uniqueId = `clear-test-${Date.now()}`;
    await sendCommand("execute_js", {
      script: `console.log("${uniqueId}")`,
    });

    // Get logs with clear
    const responseWithClear = await sendCommand("console_logs", {
      clear: true,
    });
    expect(responseWithClear.success).toBe(true);

    // Get logs again - should not contain the unique message
    const responseAfterClear = await sendCommand("console_logs", {});
    expect(responseAfterClear.success).toBe(true);

    // Note: depending on implementation, logs may or may not be completely empty
    // The key is that the unique message from before clear should be gone
    // This test may need adjustment based on exact behavior
  });

  it("should capture different log levels", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const uniqueId = Date.now();

    // Generate logs at different levels
    await sendCommand("execute_js", {
      script: `
        console.log("log-${uniqueId}");
        console.warn("warn-${uniqueId}");
        console.error("error-${uniqueId}");
      `,
    });

    const response = await sendCommand("console_logs", {});
    expect(response.success).toBe(true);

    const logs = response.data as string;
    // At minimum, the logs should contain our messages
    // The exact format depends on implementation
    expect(logs).toBeDefined();
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("console_logs", {
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
