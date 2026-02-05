/**
 * Integration tests for window management tools:
 * - tauri_window_list
 * - tauri_window_info
 * - tauri_window_resize
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("window management", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should list windows with required properties", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_list", {});
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);

    const windows = response.data as Array<{
      label: string;
      title: string;
      focused: boolean;
    }>;
    expect(windows.length).toBeGreaterThan(0);

    // Each window should have required properties
    for (const win of windows) {
      expect(typeof win.label).toBe("string");
      expect(win.label.length).toBeGreaterThan(0);
    }
  });

  it("should get window info for default and specific windows", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Get info for default window
    const defaultResponse = await sendCommand("window_info", {});
    expect(defaultResponse.success).toBe(true);

    const defaultInfo = defaultResponse.data as {
      label: string;
      width: number;
      height: number;
      x: number;
      y: number;
    };
    expect(typeof defaultInfo.label).toBe("string");
    expect(defaultInfo.width).toBeGreaterThan(0);
    expect(defaultInfo.height).toBeGreaterThan(0);

    // Get list and verify we can get info for each window
    const listResponse = await sendCommand("window_list", {});
    const windows = listResponse.data as Array<{ label: string }>;

    for (const win of windows) {
      const infoResponse = await sendCommand("window_info", {
        window_id: win.label,
      });
      expect(infoResponse.success).toBe(true);

      const info = infoResponse.data as { label: string };
      expect(info.label).toBe(win.label);
    }
  });

  it("should resize window and verify dimensions changed", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Get current size
    const infoBefore = await sendCommand("window_info", {});
    expect(infoBefore.success).toBe(true);

    const originalInfo = infoBefore.data as { width: number; height: number };
    const newWidth = 800;
    const newHeight = 600;

    // Resize
    const resizeResponse = await sendCommand("window_resize", {
      width: newWidth,
      height: newHeight,
    });
    expect(resizeResponse.success).toBe(true);

    // Verify size changed (allow tolerance for window decorations/DPI)
    const infoAfter = await sendCommand("window_info", {});
    expect(infoAfter.success).toBe(true);

    const newInfo = infoAfter.data as { width: number; height: number };
    expect(Math.abs(newInfo.width - newWidth)).toBeLessThan(50);
    expect(Math.abs(newInfo.height - newHeight)).toBeLessThan(50);

    // Restore original size
    await sendCommand("window_resize", {
      width: originalInfo.width,
      height: originalInfo.height,
    });
  });

  it("should execute operations in specific windows", async (ctx) => {
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

    const windowLabel = windows[0].label;

    // Execute JS in specific window
    const jsResponse = await sendCommand("execute_js", {
      script: "document.title",
      window_id: windowLabel,
    });
    expect(jsResponse.success).toBe(true);

    // Screenshot specific window
    const screenshotResponse = await sendCommand("screenshot", {
      format: "png",
      window_id: windowLabel,
    });
    expect(screenshotResponse.success).toBe(true);
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const infoResponse = await sendCommand("window_info", {
      window_id: "nonexistent-window-12345",
    });
    expect(infoResponse.success).toBe(false);
    expect(infoResponse.error?.toLowerCase()).toContain("not found");

    const resizeResponse = await sendCommand("window_resize", {
      width: 800,
      height: 600,
      window_id: "nonexistent-window-12345",
    });
    expect(resizeResponse.success).toBe(false);
    expect(resizeResponse.error?.toLowerCase()).toContain("not found");
  });
});
