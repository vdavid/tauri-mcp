/**
 * Integration tests for tauri_interact tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_interact", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should click element by selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Click on body - should always exist
    const response = await sendCommand("interact", {
      action: "click",
      selector: "body",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("should click by coordinates", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "click",
      x: 100,
      y: 100,
    });

    expect(response.success).toBe(true);
  });

  it("should double click element", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "double_click",
      selector: "body",
    });

    expect(response.success).toBe(true);
  });

  it("should type text into input", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // First check if there's an input element
    const checkResponse = await sendCommand("execute_js", {
      script: 'document.querySelector("input") !== null',
    });

    if (!checkResponse.success || checkResponse.data !== true) {
      // No input element, skip this test
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "type",
      selector: "input",
      text: "test input text",
    });

    expect(response.success).toBe(true);

    // Verify the text was typed
    const verifyResponse = await sendCommand("execute_js", {
      script: 'document.querySelector("input").value',
    });

    expect(verifyResponse.success).toBe(true);
    expect((verifyResponse.data as string).includes("test input text")).toBe(
      true
    );
  });

  it("should scroll the page", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "scroll",
      scroll_y: 100,
    });

    expect(response.success).toBe(true);
  });

  it("should fail for non-existent selector", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "click",
      selector: "#nonexistent-element-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "click",
      selector: "body",
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
