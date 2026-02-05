/**
 * Integration tests for tauri_screenshot tool.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  connect,
  disconnect,
  sendCommand,
  skipIfAppNotAvailable,
} from "./setup.js";

describe("tauri_screenshot", () => {
  beforeAll(async () => {
    if (await skipIfAppNotAvailable()) return;
    await connect();
  });

  afterAll(() => {
    disconnect();
  });

  it("should capture a PNG screenshot", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("screenshot", { format: "png" });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");

    const data = response.data as string;
    // PNG starts with specific base64 pattern or is a data URL
    expect(
      data.startsWith("data:image/png") || data.startsWith("iVBOR")
    ).toBe(true);
  });

  it("should capture a JPEG screenshot with quality", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("screenshot", {
      format: "jpeg",
      quality: 80,
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(typeof response.data).toBe("string");

    const data = response.data as string;
    // JPEG has different base64 signature
    expect(
      data.startsWith("data:image/jpeg") || data.startsWith("/9j/")
    ).toBe(true);
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("screenshot", {
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
