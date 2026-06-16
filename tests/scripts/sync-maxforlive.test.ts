import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("sync-maxforlive", () => {
  it("copies Max runtime files and links node_modules into the target directory", async () => {
    const repoRoot = makeRepoFixture();
    const targetDir = join(repoRoot, "AbletonRackBridge");
    // @ts-expect-error The CLI script is plain ESM JavaScript, imported here for behavior coverage.
    const { syncMaxForLive } = await import("../../scripts/sync-maxforlive.mjs");

    const result = syncMaxForLive({ repoRoot, targetDir });

    expect(result.copied.map((entry: { file: string }) => entry.file)).toEqual([
      "build-bridge-patch-v5.js",
      "live-api-adapter.js",
      "node-bridge-safe.js",
      "node-smoke.js"
    ]);
    expect(readFileSync(join(targetDir, "build-bridge-patch-v5.js"), "utf8")).toBe("builder");
    expect(readFileSync(join(targetDir, "live-api-adapter.js"), "utf8")).toBe("live api");
    expect(readFileSync(join(targetDir, "node-bridge-safe.js"), "utf8")).toBe("node bridge");
    expect(readFileSync(join(targetDir, "node-smoke.js"), "utf8")).toBe("node smoke");
    expect(realpathSync(join(targetDir, "node_modules"))).toBe(realpathSync(join(repoRoot, "node_modules")));
  });
});

function makeRepoFixture(): string {
  const repoRoot = join(tmpdir(), `ableton-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tmpRoots.push(repoRoot);

  mkdirSync(join(repoRoot, "src/maxforlive"), { recursive: true });
  mkdirSync(join(repoRoot, "node_modules/ws"), { recursive: true });
  writeFileSync(join(repoRoot, "src/maxforlive/live-api-adapter.js"), "live api");
  writeFileSync(join(repoRoot, "src/maxforlive/build-bridge-patch-v5.js"), "builder");
  writeFileSync(join(repoRoot, "src/maxforlive/node-bridge-safe.js"), "node bridge");
  writeFileSync(join(repoRoot, "src/maxforlive/node-smoke.js"), "node smoke");

  return repoRoot;
}
