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

  it("should execute scripts and return various types", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // String result (document title)
    const titleResponse = await sendCommand("execute_js", {
      script: "document.title",
    });
    expect(titleResponse.success).toBe(true);
    expect(typeof titleResponse.data).toBe("string");

    // Number result
    const mathResponse = await sendCommand("execute_js", { script: "2 + 2" });
    expect(mathResponse.success).toBe(true);
    expect(mathResponse.data).toBe(4);

    // Object result
    const objResponse = await sendCommand("execute_js", {
      script: '({ foo: "bar", count: 42 })',
    });
    expect(objResponse.success).toBe(true);
    expect(objResponse.data).toEqual({ foo: "bar", count: 42 });

    // Array result
    const arrayResponse = await sendCommand("execute_js", {
      script: "[1, 2, 3].map(x => x * 2)",
    });
    expect(arrayResponse.success).toBe(true);
    expect(arrayResponse.data).toEqual([2, 4, 6]);

    // DOM query result
    const domResponse = await sendCommand("execute_js", {
      script: "document.querySelectorAll('*').length > 0",
    });
    expect(domResponse.success).toBe(true);
    expect(domResponse.data).toBe(true);
  });

  it("should handle errors appropriately", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Syntax error
    const syntaxResponse = await sendCommand("execute_js", {
      script: "function { invalid syntax",
    });
    expect(syntaxResponse.success).toBe(false);
    expect(syntaxResponse.error).toBeDefined();

    // Runtime error
    const runtimeResponse = await sendCommand("execute_js", {
      script: "nonExistentVariable.property",
    });
    expect(runtimeResponse.success).toBe(false);
    expect(runtimeResponse.error).toBeDefined();

    // Non-existent window
    const windowResponse = await sendCommand("execute_js", {
      script: "1",
      window_id: "nonexistent-window-12345",
    });
    expect(windowResponse.success).toBe(false);
    expect(windowResponse.error?.toLowerCase()).toContain("not found");
  });
});
