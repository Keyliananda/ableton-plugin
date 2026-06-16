import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Max node bridge scripts", () => {
  it("notify the JS adapter when the websocket opens", () => {
    for (const path of ["src/maxforlive/node-bridge-safe.js", "src/maxforlive/node-bridge.cjs"]) {
      const source = readFileSync(resolve(path), "utf8");

      expect(source).toContain('maxApi.outlet("bridge_connected")');
    }
  });

  it("send bridge hello directly when the websocket opens", () => {
    for (const path of ["src/maxforlive/node-bridge-safe.js", "src/maxforlive/node-bridge.cjs"]) {
      const source = readFileSync(resolve(path), "utf8");

      expect(source).toContain('type: "bridge.hello"');
      expect(source).toContain("socket.send(JSON.stringify");
    }
  });

  it("retries bridge hello after connect so Max JS can finish loading", () => {
    for (const path of ["src/maxforlive/node-bridge-safe.js", "src/maxforlive/node-bridge.cjs"]) {
      const source = readFileSync(resolve(path), "utf8");

      expect(source).toContain("HELLO_RETRY_DELAYS_MS");
      expect(source).toContain("function sendBridgeHello()");
      expect(source).toContain("setTimeout(sendBridgeHello");
    }
  });

  it("keeps websocket boundary traffic behind the debug logger", () => {
    for (const path of ["src/maxforlive/node-bridge-safe.js", "src/maxforlive/node-bridge.cjs"]) {
      const source = readFileSync(resolve(path), "utf8");

      expect(source).toContain("const DEBUG = false");
      expect(source).toContain("function debugLog(message)");
      expect(source).toContain('debugLog("sent bridge.hello")');
      expect(source).toContain("debugLog(`received from plugin: ${text}`)");
    }
  });
});
