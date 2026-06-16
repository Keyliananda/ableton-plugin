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

  it("logs websocket boundary traffic for startup diagnostics", () => {
    for (const path of ["src/maxforlive/node-bridge-safe.js", "src/maxforlive/node-bridge.cjs"]) {
      const source = readFileSync(resolve(path), "utf8");

      expect(source).toContain("sent bridge.hello");
      expect(source).toContain("received from plugin");
    }
  });
});
