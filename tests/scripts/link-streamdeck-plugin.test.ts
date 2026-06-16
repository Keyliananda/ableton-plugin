import { mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("link-streamdeck-plugin", () => {
  it("links the plugin folder into the Stream Deck plugins directory", async () => {
    const repoRoot = makeRepoFixture();
    const pluginsDir = join(repoRoot, "StreamDeckPlugins");
    // @ts-expect-error The CLI script is plain ESM JavaScript, imported here for behavior coverage.
    const { linkStreamDeckPlugin } = await import("../../scripts/link-streamdeck-plugin.mjs");

    const result = linkStreamDeckPlugin({ repoRoot, pluginsDir });

    expect(result.pluginDir).toBe(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin"));
    expect(result.linkPath).toBe(join(pluginsDir, "de.daniel.ableton-rack-control.sdPlugin"));
    expect(realpathSync(result.linkPath)).toBe(realpathSync(result.pluginDir));
  });
});

function makeRepoFixture(): string {
  const repoRoot = join(tmpdir(), `ableton-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tmpRoots.push(repoRoot);

  mkdirSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin"), { recursive: true });
  return repoRoot;
}
