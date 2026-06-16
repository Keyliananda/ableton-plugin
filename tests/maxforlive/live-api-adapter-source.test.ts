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
});
