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

  it("starts the node bridge automatically when the Max device loads", () => {
    const source = readFileSync(resolve("src/maxforlive/build-bridge-patch-v5.js"), "utf8");

    expect(source).toContain('"live.thisdevice"');
    expect(source).toContain('startMsg.message("set", "script start")');
    expect(source).toContain("safeConnect(p, thisDevice, 0, startMsg, 0)");
    expect(source).toContain("safeConnect(p, startMsg, 0, node, 0)");
  });

  it("adds manual recovery controls for node start, node stop, and refresh", () => {
    const source = readFileSync(resolve("src/maxforlive/build-bridge-patch-v5.js"), "utf8");

    expect(source).toContain('startMsg.message("set", "script start")');
    expect(source).toContain('stopMsg.message("set", "script stop")');
    expect(source).toContain('refreshMsg.message("set", "bang")');
    expect(source).toContain("safeConnect(p, stopMsg, 0, node, 0)");
    expect(source).toContain("safeConnect(p, refreshMsg, 0, liveApi, 0)");
  });
});
