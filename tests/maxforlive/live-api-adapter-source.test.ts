import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("live-api-adapter.js", () => {
  it("handles device.refresh by forcing a poll", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain('message.type === "device.refresh"');
    expect(source).toContain("poll(true);");
  });

  it("resends bridge hello when the node bridge connects", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("function bridge_connected()");
    expect(source).toContain("bridge_hello();");
  });

  it("does not send bridge hello during loadbang before node.script is ready", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("function loadbang()");
    expect(source).not.toContain("function loadbang() {\n  bridge_hello();\n}");
  });

  it("keeps routine startup and refresh logs behind the debug logger", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var DEBUG = false");
    expect(source).toContain("function debugLog(message)");
    expect(source).toContain('debugLog("[ableton-rack-liveapi] sending bridge.hello\\n")');
    expect(source).toContain('debugLog("[ableton-rack-liveapi] received device.refresh\\n")');
  });

  it("polls briefly after bridge connect to catch Ableton selecting the Rack after device load", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var STARTUP_POLL_INTERVAL_MS");
    expect(source).toContain("var STARTUP_POLL_TICKS");
    expect(source).toContain("function startStartupPoll()");
    expect(source).toContain("startStartupPoll();");
    expect(source).toContain("new Task(runStartupPoll");
  });

  it("watches selected device id gently without repeatedly reading parameters", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var SELECTION_WATCH_INTERVAL_MS = 2000");
    expect(source).toContain("function startSelectionWatch()");
    expect(source).toContain("function runSelectionWatch()");
    expect(source).toContain("function readSelectedDeviceId()");
    expect(source).toContain("poll(true);");
    expect(source).toContain("new Task(runSelectionWatch");
  });

  it("handles device.toggle through the cached Device On parameter", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain('message.type === "device.toggle"');
    expect(source).toContain("function applyDeviceToggle(message)");
    expect(source).toContain("findDeviceOnParam()");
    expect(source).toContain("writeParamValue(param, nextValue)");
  });
});
