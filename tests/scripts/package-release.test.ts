import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("package-release", () => {
  it("creates a portable Windows release folder with installer, docs, plugin, and Max bridge runtime", async () => {
    const repoRoot = makeRepoFixture();
    const outDir = join(repoRoot, "release");
    // @ts-expect-error The CLI script is plain ESM JavaScript, imported here for behavior coverage.
    const { buildReleasePackage } = await import("../../scripts/package-release.mjs");

    const result = buildReleasePackage({ repoRoot, outDir, version: "9.8.7", zip: false });
    const root = result.packageDir;

    expect(root).toBe(join(outDir, "AbletonRackControl-9.8.7"));
    expect(existsSync(join(root, "install.ps1"))).toBe(true);
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("Ableton Rack Control");
    expect(readFileSync(join(root, "INSTALL.md"), "utf8")).toContain("Windows-Neuinstallation");

    const pluginDir = join(root, "StreamDeck", "de.daniel.ableton-rack-control.sdPlugin");
    expect(readFileSync(join(pluginDir, "manifest.json"), "utf8")).toContain("Ableton Rack Control");
    expect(readFileSync(join(pluginDir, "bin", "plugin.js"), "utf8")).toBe('import "../dist/src/streamdeck/elgato-entry.js";\n');
    expect(readFileSync(join(pluginDir, "dist", "src", "streamdeck", "elgato-entry.js"), "utf8")).toBe("streamdeck entry");
    expect(readFileSync(join(pluginDir, "node_modules", "ws", "index.js"), "utf8")).toBe("module");

    const bridgeDir = join(root, "MaxForLive", "AbletonRackBridge");
    expect(readFileSync(join(bridgeDir, "live-api-adapter.js"), "utf8")).toBe("live api");
    expect(readFileSync(join(bridgeDir, "node-bridge-safe.js"), "utf8")).toBe("node bridge");
    expect(readFileSync(join(bridgeDir, "node_modules", "ws", "index.js"), "utf8")).toBe("module");
    expect(readFileSync(join(root, "MaxForLive", "Ableton Stream Deck 2.amxd"), "utf8")).toBe("amxd device");
    expect(existsSync(join(root, "MaxForLive", "Ableton Rack Bridge.maxpat"))).toBe(false);

    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("$env:APPDATA");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("Documents");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("Ableton Stream Deck 2.amxd");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("ABLETON_USER_LIBRARY");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("N:\\Ableton Wolke\\Ableton\\User Library");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("build-bridge-patch-v5.js");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).toContain("var ROOT =");
    expect(readFileSync(join(root, "install.ps1"), "utf8")).not.toContain("PatchSource");
    expect(readFileSync(join(root, "INSTALL.md"), "utf8")).not.toContain("Ableton Rack Bridge.maxpat");
    expect(readFileSync(join(root, "INSTALL.md"), "utf8")).toContain("Ableton Stream Deck 2");
  });
});

function makeRepoFixture(): string {
  const repoRoot = join(tmpdir(), `ableton-release-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tmpRoots.push(repoRoot);

  mkdirSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "bin"), { recursive: true });
  mkdirSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "layouts"), { recursive: true });
  mkdirSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "imgs"), { recursive: true });
  mkdirSync(join(repoRoot, "dist", "src", "streamdeck"), { recursive: true });
  mkdirSync(join(repoRoot, "src", "maxforlive"), { recursive: true });
  mkdirSync(join(repoRoot, "maxforlive"), { recursive: true });
  mkdirSync(join(repoRoot, "node_modules", "ws"), { recursive: true });

  writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ version: "9.8.7" }));
  writeFileSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "manifest.json"), '{"Name":"Ableton Rack Control"}');
  writeFileSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "bin", "plugin.js"), 'import "../../dist/src/streamdeck/elgato-entry.js";\n');
  writeFileSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "layouts", "rack-dial.json"), "{}");
  writeFileSync(join(repoRoot, "de.daniel.ableton-rack-control.sdPlugin", "imgs", "plugin.svg"), "<svg />");
  writeFileSync(join(repoRoot, "dist", "src", "streamdeck", "elgato-entry.js"), "streamdeck entry");
  writeFileSync(join(repoRoot, "src", "maxforlive", "build-bridge-patch-v5.js"), "builder");
  writeFileSync(join(repoRoot, "src", "maxforlive", "live-api-adapter.js"), "live api");
  writeFileSync(join(repoRoot, "src", "maxforlive", "node-bridge-safe.js"), "node bridge");
  writeFileSync(join(repoRoot, "src", "maxforlive", "node-smoke.js"), "node smoke");
  writeFileSync(join(repoRoot, "maxforlive", "Ableton Stream Deck 2.amxd"), "amxd device");
  writeFileSync(join(repoRoot, "maxforlive", "Ableton Rack Bridge.maxpat"), "max patch");
  writeFileSync(join(repoRoot, "node_modules", "ws", "index.js"), "module");

  return repoRoot;
}
