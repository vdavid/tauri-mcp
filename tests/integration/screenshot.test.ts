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

  it("should capture screenshots in PNG and JPEG formats", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // PNG screenshot
    const pngResponse = await sendCommand("screenshot", { format: "png" });
    expect(pngResponse.success).toBe(true);
    expect(typeof pngResponse.data).toBe("string");
    const pngData = pngResponse.data as string;
    expect(
      pngData.startsWith("data:image/png") || pngData.startsWith("iVBOR")
    ).toBe(true);

    // JPEG screenshot with quality
    const jpegResponse = await sendCommand("screenshot", {
      format: "jpeg",
      quality: 80,
    });
    expect(jpegResponse.success).toBe(true);
    expect(typeof jpegResponse.data).toBe("string");
    const jpegData = jpegResponse.data as string;
    expect(
      jpegData.startsWith("data:image/jpeg") || jpegData.startsWith("/9j/")
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
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
