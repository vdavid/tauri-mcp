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

  it("should wait for existing selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      wait_type: "selector",
      value: "body",
      timeout: 5000,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("should wait for text content", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // First inject some known text
    await sendCommand("execute_js", {
      script:
        'document.body.innerHTML += \'<div id="test-text">unique-wait-text-12345</div>\'',
    });

    const response = await sendCommand("wait_for", {
      wait_type: "text",
      value: "unique-wait-text-12345",
      timeout: 5000,
    });

    expect(response.success).toBe(true);

    // Clean up
    await sendCommand("execute_js", {
      script: 'document.getElementById("test-text")?.remove()',
    });
  });

  it("should wait for visible element", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      wait_type: "visible",
      value: "body",
      timeout: 5000,
    });

    expect(response.success).toBe(true);
  });

  it("should wait for hidden element", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Create a hidden element
    await sendCommand("execute_js", {
      script:
        'document.body.innerHTML += \'<div id="hidden-test" style="display: none;">hidden</div>\'',
    });

    const response = await sendCommand("wait_for", {
      wait_type: "hidden",
      value: "#hidden-test",
      timeout: 5000,
    });

    expect(response.success).toBe(true);

    // Clean up
    await sendCommand("execute_js", {
      script: 'document.getElementById("hidden-test")?.remove()',
    });
  });

  it("should timeout for non-existent selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      wait_type: "selector",
      value: "#nonexistent-element-that-will-never-appear-12345",
      timeout: 1000, // Short timeout for faster test
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("timeout");
  });

  it("should timeout for text that never appears", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      wait_type: "text",
      value: "this-text-will-absolutely-never-appear-on-the-page-xyz789",
      timeout: 1000,
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("timeout");
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("wait_for", {
      wait_type: "selector",
      value: "body",
      timeout: 1000,
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
