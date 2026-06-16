import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Max bridge patch builder", () => {
  it("creates patches against the synced Max runtime folder", () => {
    const source = readFileSync(resolve("src/maxforlive/build-bridge-patch-v5.js"), "utf8");

    expect(source).toContain('var ROOT = "S:/AbletonRackBridge"');
    expect(source).toContain('ROOT + "/live-api-adapter.js"');
    expect(source).toContain('ROOT + "/node-bridge-safe.js"');
    expect(source).not.toContain('ROOT + "/node-bridge.cjs"');
  });
});
