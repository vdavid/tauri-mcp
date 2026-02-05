/**
 * Integration tests for tauri_wait_for tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_wait_for", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should wait for existing elements", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Wait for existing selector
    const selectorResponse = await sendCommand("wait_for", {
      type: "selector",
      value: "body",
      timeout: 5000,
    });
    expect(selectorResponse.success).toBe(true);

    // Wait for visible element
    const visibleResponse = await sendCommand("wait_for", {
      type: "visible",
      value: "body",
      timeout: 5000,
    });
    expect(visibleResponse.success).toBe(true);
  });

  it("should wait for text content", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Inject known text
    await sendCommand("execute_js", {
      script:
        'document.body.innerHTML += \'<div id="test-text">unique-wait-text-12345</div>\'',
    });

    const response = await sendCommand("wait_for", {
      type: "text",
      value: "unique-wait-text-12345",
      timeout: 5000,
    });
    expect(response.success).toBe(true);

    // Clean up
    await sendCommand("execute_js", {
      script: 'document.getElementById("test-text")?.remove()',
    });
  });

  it("should timeout for non-existent conditions", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      type: "selector",
      value: "#nonexistent-element-that-will-never-appear-12345",
      timeout: 1000,
    });

    expect(response.success).toBe(false);
    expect(response.error?.toLowerCase()).toContain("timeout");
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      type: "selector",
      value: "body",
      timeout: 1000,
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
