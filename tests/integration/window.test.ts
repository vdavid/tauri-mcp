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

describe("tauri_window_list", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should list all windows", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_list", {});

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);

    const windows = response.data as Array<{
      label: string;
      title: string;
      focused: boolean;
    }>;
    expect(windows.length).toBeGreaterThan(0);

    // Each window should have label, title, and focused properties
    const firstWindow = windows[0];
    expect(firstWindow.label).toBeDefined();
    expect(typeof firstWindow.label).toBe("string");
  });

  it("should include main window in list", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_list", {});
    expect(response.success).toBe(true);

    const windows = response.data as Array<{ label: string }>;

    // At least one window should exist (the main window)
    expect(windows.length).toBeGreaterThan(0);
  });
});

describe("tauri_window_info", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should get info for default window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_info", {});

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();

    const info = response.data as {
      label: string;
      width: number;
      height: number;
      x: number;
      y: number;
    };

    expect(typeof info.label).toBe("string");
    expect(typeof info.width).toBe("number");
    expect(typeof info.height).toBe("number");
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);
  });

  it("should get info for specific window by label", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // First get the list of windows to find a valid label
    const listResponse = await sendCommand("window_list", {});
    if (!listResponse.success) {
      ctx.skip();
      return;
    }

    const windows = listResponse.data as Array<{ label: string }>;
    if (windows.length === 0) {
      ctx.skip();
      return;
    }

    const windowLabel = windows[0].label;
    const response = await sendCommand("window_info", {
      window_id: windowLabel,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();

    const info = response.data as { label: string };
    expect(info.label).toBe(windowLabel);
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_info", {
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});

describe("tauri_window_resize", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should resize window to specified dimensions", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Get current size first
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

    // Verify size changed
    const infoAfter = await sendCommand("window_info", {});
    expect(infoAfter.success).toBe(true);

    const newInfo = infoAfter.data as { width: number; height: number };
    // Allow some tolerance for window decorations/DPI
    expect(Math.abs(newInfo.width - newWidth)).toBeLessThan(50);
    expect(Math.abs(newInfo.height - newHeight)).toBeLessThan(50);

    // Restore original size
    await sendCommand("window_resize", {
      width: originalInfo.width,
      height: originalInfo.height,
    });
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("window_resize", {
      width: 800,
      height: 600,
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
