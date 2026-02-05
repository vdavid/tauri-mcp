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

  it("should capture snapshots in different formats", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    // Accessibility snapshot
    const a11yResponse = await sendCommand("dom_snapshot", {
      type: "accessibility",
    });
    expect(a11yResponse.success).toBe(true);
    expect(typeof a11yResponse.data).toBe("string");
    expect((a11yResponse.data as string).length).toBeGreaterThan(0);

    // Structure snapshot
    const structureResponse = await sendCommand("dom_snapshot", {
      type: "structure",
    });
    expect(structureResponse.success).toBe(true);
    expect(typeof structureResponse.data).toBe("string");
    expect((structureResponse.data as string).length).toBeGreaterThan(0);

    // Structure snapshot scoped to body
    const scopedResponse = await sendCommand("dom_snapshot", {
      type: "structure",
      selector: "body",
    });
    expect(scopedResponse.success).toBe(true);
    expect(typeof scopedResponse.data).toBe("string");
  });

  it("should fail for non-existent window", async (ctx) => {
    if (await skipIfAppNotAvailable()) {
      ctx.skip();
      return;
    }

    const response = await sendCommand("dom_snapshot", {
      type: "accessibility",
      window_id: "nonexistent-window-12345",
    });

    expect(response.success).toBe(false);
    expect(response.error?.toLowerCase()).toContain("not found");
  });
});
