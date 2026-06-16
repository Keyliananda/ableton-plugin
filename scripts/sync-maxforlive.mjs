import { copyFileSync, existsSync, mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_TARGET_DIR = "S:/AbletonRackBridge";
export const MAX_RUNTIME_FILES = [
  "build-bridge-patch-v5.js",
  "live-api-adapter.js",
  "node-bridge-safe.js",
  "node-smoke.js"
];

export function syncMaxForLive(options = {}) {
  const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot);
  const targetDir = resolve(options.targetDir ?? process.env.ABLETON_RACK_BRIDGE_DIR ?? DEFAULT_TARGET_DIR);
  const sourceDir = join(repoRoot, "src", "maxforlive");
  const copied = [];

  mkdirSync(targetDir, { recursive: true });

  for (const file of MAX_RUNTIME_FILES) {
    const source = join(sourceDir, file);
    const target = join(targetDir, file);
    copyFileSync(source, target);
    copied.push({ file, source, target });
  }

  ensureNodeModulesLink(repoRoot, targetDir);

  return {
    targetDir,
    copied,
    nodeModules: join(targetDir, "node_modules")
  };
}

function ensureNodeModulesLink(repoRoot, targetDir) {
  const sourceNodeModules = join(repoRoot, "node_modules");
  const targetNodeModules = join(targetDir, "node_modules");

  if (existsSync(targetNodeModules)) {
    if (realpathSync(targetNodeModules) !== realpathSync(sourceNodeModules)) {
      throw new Error(`${targetNodeModules} already exists and does not point to ${sourceNodeModules}`);
    }
    return;
  }

  symlinkSync(sourceNodeModules, targetNodeModules, process.platform === "win32" ? "junction" : "dir");
}

if (import.meta.url === pathToMainUrl(process.argv[1])) {
  const result = syncMaxForLive({ targetDir: process.argv[2] });
  console.log(`Synced Max for Live bridge files to ${result.targetDir}`);
  for (const entry of result.copied) {
    console.log(`- ${entry.file}`);
  }
  console.log("- node_modules");
}

function pathToMainUrl(path) {
  return path ? pathToFileURL(resolve(path)).href : "";
}
