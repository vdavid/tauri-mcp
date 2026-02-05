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

  it("should perform click actions", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Click by selector
    const selectorClick = await sendCommand("interact", {
      action: "click",
      selector: "body",
    });
    expect(selectorClick.success).toBe(true);

    // Click by coordinates
    const coordClick = await sendCommand("interact", {
      action: "click",
      x: 100,
      y: 100,
    });
    expect(coordClick.success).toBe(true);

    // Double click
    const doubleClick = await sendCommand("interact", {
      action: "double_click",
      selector: "body",
    });
    expect(doubleClick.success).toBe(true);
  });

  it("should type text into inputs when available", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Check if there's an input element
    const checkResponse = await sendCommand("execute_js", {
      script: 'document.querySelector("input") !== null',
    });

    if (!checkResponse.success || checkResponse.data !== true) {
      ctx.skip();
      return;
    }

    const typeResponse = await sendCommand("interact", {
      action: "type",
      selector: "input",
      text: "test input text",
    });
    expect(typeResponse.success).toBe(true);

    // Verify the text was typed
    const verifyResponse = await sendCommand("execute_js", {
      script: 'document.querySelector("input").value',
    });
    expect(verifyResponse.success).toBe(true);
    expect((verifyResponse.data as string)).toContain("test input text");
  });

  it("should scroll the page", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("interact", {
      action: "scroll",
      scrollY: 100,
    });
    expect(response.success).toBe(true);
  });

  it("should fail for non-existent elements or windows", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Non-existent selector
    const selectorResponse = await sendCommand("interact", {
      action: "click",
      selector: "#nonexistent-element-12345",
    });
    expect(selectorResponse.success).toBe(false);
    expect(selectorResponse.error?.toLowerCase()).toContain("not found");

    // Non-existent window
    const windowResponse = await sendCommand("interact", {
      action: "click",
      selector: "body",
      window_id: "nonexistent-window-12345",
    });
    expect(windowResponse.success).toBe(false);
    expect(windowResponse.error?.toLowerCase()).toContain("not found");
  });
});
