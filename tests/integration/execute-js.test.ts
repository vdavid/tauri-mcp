/**
 * Integration tests for tauri_execute_js tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_execute_js", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should execute simple expression and return result", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "document.title",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");
  });

  it("should execute arithmetic expression", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", { script: "2 + 2" });

    expect(response.success).toBe(true);
    expect(response.data).toBe(4);
  });

  it("should return JSON-serializable objects", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: '({ foo: "bar", count: 42 })',
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ foo: "bar", count: 42 });
  });

  it("should return arrays", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "[1, 2, 3].map(x => x * 2)",
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual([2, 4, 6]);
  });

  it("should handle DOM queries", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "document.querySelectorAll('*').length > 0",
    });

    expect(response.success).toBe(true);
    expect(response.data).toBe(true);
  });

  it("should fail on syntax errors", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "function { invalid syntax",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it("should fail on runtime errors", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "nonExistentVariable.property",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("execute_js", {
      script: "1",
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
