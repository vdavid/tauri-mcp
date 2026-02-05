/**
 * Integration tests for multi-window scenarios.
 * Tests operations across multiple windows when available.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("multi-window scenarios", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should list multiple windows when available", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_list", {});
    expect(response.success).toBe(true);

    const windows = response.data as Array<{
      label: string;
      title: string;
      focused: boolean;
    }>;

    // Log window count for informational purposes
    console.log(`Found ${windows.length} window(s)`);

    // At minimum, there should be one window
    expect(windows.length).toBeGreaterThan(0);

    // Each window should have required properties
    for (const win of windows) {
      expect(win.label).toBeDefined();
      expect(typeof win.label).toBe("string");
    }
  });

  it("should get info for each available window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const listResponse = await sendCommand("window_list", {});
    expect(listResponse.success).toBe(true);

    const windows = listResponse.data as Array<{ label: string }>;

    for (const win of windows) {
      const infoResponse = await sendCommand("window_info", {
        window_id: win.label,
      });

      expect(infoResponse.success).toBe(true);
      expect(infoResponse.data).toBeDefined();

      const info = infoResponse.data as {
        label: string;
        width: number;
        height: number;
      };
      expect(info.label).toBe(win.label);
      expect(info.width).toBeGreaterThan(0);
      expect(info.height).toBeGreaterThan(0);
    }
  });

  it("should execute JS in specific window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const listResponse = await sendCommand("window_list", {});
    expect(listResponse.success).toBe(true);

    const windows = listResponse.data as Array<{ label: string }>;
    if (windows.length === 0) {
      ctx.skip();
      return;
    }

    // Execute in first available window
    const windowLabel = windows[0].label;
    const response = await sendCommand("execute_js", {
      script: "document.title",
      window_id: windowLabel,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("should take screenshot of specific window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const listResponse = await sendCommand("window_list", {});
    expect(listResponse.success).toBe(true);

    const windows = listResponse.data as Array<{ label: string }>;
    if (windows.length === 0) {
      ctx.skip();
      return;
    }

    // Screenshot first available window
    const windowLabel = windows[0].label;
    const response = await sendCommand("screenshot", {
      format: "png",
      window_id: windowLabel,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("should get DOM snapshot of specific window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const listResponse = await sendCommand("window_list", {});
    expect(listResponse.success).toBe(true);

    const windows = listResponse.data as Array<{ label: string }>;
    if (windows.length === 0) {
      ctx.skip();
      return;
    }

    // Get DOM snapshot of first window
    const windowLabel = windows[0].label;
    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "structure",
      window_id: windowLabel,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("should report window context in responses", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "1 + 1",
    });

    expect(response.success).toBe(true);

    // Window context should be included in response
    if (response.windowContext) {
      expect(response.windowContext.windowLabel).toBeDefined();
      expect(typeof response.windowContext.totalWindows).toBe("number");
    }
  });
});
