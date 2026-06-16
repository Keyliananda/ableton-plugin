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

  it("observes selected parameter values so mouse-driven macro changes update feedback", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var selectedParamObservers = []");
    expect(source).toContain("observeSelectedParams(params)");
    expect(source).toContain("function observeSelectedParams(params)");
    expect(source).toContain('observer.property = "value"');
    expect(source).toContain("function selectedParamValueChanged(paramId, observerGeneration)");
    expect(source).toContain('type: "param.changed"');
  });

  it("guards parameter observer callbacks after observer cleanup", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var selectedParamObserverGeneration = 0");
    expect(source).toContain("selectedParamObserverGeneration += 1");
    expect(source).toContain("observeSelectedParam(params[i].id, selectedParamObserverGeneration)");
    expect(source).toContain("selectedParamValueChanged(paramId, observerGeneration)");
    expect(source).toContain("if (observerGeneration !== selectedParamObserverGeneration)");
  });

  it("observes selected track and selected device changes for faster rack switching", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var selectedTrackObserver = null");
    expect(source).toContain("var selectedDeviceObserver = null");
    expect(source).toContain("function startSelectionObservers()");
    expect(source).toContain("startSelectionObservers();");
    expect(source).toContain('new LiveAPI(selectedTrackChanged, "live_set view")');
    expect(source).toContain('selectedTrackObserver.property = "selected_track"');
    expect(source).toContain('new LiveAPI(selectedDeviceChanged, "live_set view selected_track view")');
    expect(source).toContain('selectedDeviceObserver.property = "selected_device"');
    expect(source).toContain("function scheduleSelectionPoll()");
    expect(source).toContain("selectionPollTask.schedule(SELECTION_OBSERVER_DEBOUNCE_MS)");
  });

  it("clears selection observers before registering replacements", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("function clearSelectionObservers()");
    expect(source).toContain("clearSelectionObserver(selectedTrackObserver)");
    expect(source).toContain("clearSelectionObserver(selectedDeviceObserver)");
    expect(source).toContain("selectedTrackObserver = null");
    expect(source).toContain("selectedDeviceObserver = null");
    expect(source).toContain("clearSelectionObservers();\n  observeSelectedTrack();");
  });

  it("handles device.toggle through the cached Device On parameter", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain('message.type === "device.toggle"');
    expect(source).toContain("function applyDeviceToggle(message)");
    expect(source).toContain("var param = selectedDeviceOnParam");
    expect(source).toContain("writeParamValue(param, nextValue)");
  });

  it("filters Device On from dial params while keeping it available for device.toggle", () => {
    const source = readFileSync(resolve("src/maxforlive/live-api-adapter.js"), "utf8");

    expect(source).toContain("var selectedDeviceOnParam = null");
    expect(source).toContain("selectedDeviceOnParam = findDeviceOnParam(allParams)");
    expect(source).toContain("filterDialParams(allParams).slice(0, 8)");
    expect(source).toContain("function filterDialParams(params)");
  });
});
