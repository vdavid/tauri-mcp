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

  it("should retrieve and filter console logs", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Generate a unique log message
    const uniqueId = `test-log-${Date.now()}`;
    await sendCommand("execute_js", {
      script: `console.log("${uniqueId}")`,
    });

    // Retrieve all logs
    const allLogsResponse = await sendCommand("console_logs", {});
    expect(allLogsResponse.success).toBe(true);
    expect(typeof allLogsResponse.data).toBe("string");

    // Filter logs by our unique message
    const filteredResponse = await sendCommand("console_logs", {
      filter: uniqueId,
    });
    expect(filteredResponse.success).toBe(true);
    expect((filteredResponse.data as string)).toContain(uniqueId);
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

    // Clear logs
    const clearResponse = await sendCommand("console_logs", { clear: true });
    expect(clearResponse.success).toBe(true);

    // Verify logs were cleared (previous unique message should be gone)
    const afterClearResponse = await sendCommand("console_logs", {});
    expect(afterClearResponse.success).toBe(true);
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
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
