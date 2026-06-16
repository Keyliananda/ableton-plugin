import { describe, expect, it } from "vitest";
import { describeStartupError } from "../../src/streamdeck/startup-errors.js";

describe("describeStartupError", () => {
  it("explains when the Rack bridge port is already in use", () => {
    const error = Object.assign(new Error("listen EADDRINUSE: address already in use 127.0.0.1:17375"), {
      code: "EADDRINUSE",
      port: 17375
    });

    expect(describeStartupError(error)).toContain("Port 17375 is already in use");
    expect(describeStartupError(error)).toContain("Dev Host");
    expect(describeStartupError(error)).toContain("q");
  });

  it("falls back to a generic message for other startup errors", () => {
    expect(describeStartupError(new Error("boom"))).toBe("Ableton Rack Control failed to start.");
  });
});
