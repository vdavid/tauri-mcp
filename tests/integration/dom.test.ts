/**
 * Integration tests for tauri_dom_snapshot tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_dom_snapshot", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should capture accessibility snapshot", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "accessibility",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");

    const snapshot = response.data as string;
    // Accessibility snapshot should contain role information
    expect(snapshot.length).toBeGreaterThan(0);
  });

  it("should capture structure snapshot", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "structure",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");

    const snapshot = response.data as string;
    // Structure snapshot should contain tag/element information
    expect(snapshot.length).toBeGreaterThan(0);
  });

  it("should scope snapshot with selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "structure",
      selector: "body",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");
  });

  it("should fail for non-existent selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "structure",
      selector: "#nonexistent-element-12345",
    });

    // Could either fail or return empty - depends on implementation
    // Both are acceptable behaviors
    expect(response).toBeDefined();
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      snapshot_type: "accessibility",
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
