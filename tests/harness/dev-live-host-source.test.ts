import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dev-live-host.ts", () => {
  it("exposes a toggle command for the selected Rack device", () => {
    const source = readFileSync(resolve("src/harness/dev-live-host.ts"), "utf8");

    expect(source).toContain("toggle");
    expect(source).toContain("controller.toggleSelectedDevice()");
    expect(source).toContain("t | toggle");
  });
});
