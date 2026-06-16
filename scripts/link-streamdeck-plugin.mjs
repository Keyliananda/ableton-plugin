import { existsSync, mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLUGIN_FOLDER = "de.daniel.ableton-rack-control.sdPlugin";

export function linkStreamDeckPlugin(options = {}) {
  const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot);
  const pluginDir = join(repoRoot, PLUGIN_FOLDER);
  const pluginsDir = resolve(
    options.pluginsDir ??
      process.env.STREAMDECK_PLUGINS_DIR ??
      join(process.env.APPDATA ?? "", "Elgato", "StreamDeck", "Plugins")
  );
  const linkPath = join(pluginsDir, PLUGIN_FOLDER);

  mkdirSync(pluginsDir, { recursive: true });

  if (existsSync(linkPath)) {
    if (realpathSync(linkPath) !== realpathSync(pluginDir)) {
      throw new Error(`${linkPath} already exists and does not point to ${pluginDir}`);
    }

    return { pluginDir, pluginsDir, linkPath, created: false };
  }

  symlinkSync(pluginDir, linkPath, process.platform === "win32" ? "junction" : "dir");
  return { pluginDir, pluginsDir, linkPath, created: true };
}

if (import.meta.url === pathToMainUrl(process.argv[1])) {
  const result = linkStreamDeckPlugin({ pluginsDir: process.argv[2] });
  console.log(
    `${result.created ? "Linked" : "Stream Deck plugin link already exists"}: ${result.linkPath} -> ${result.pluginDir}`
  );
  console.log("Restart the Stream Deck app after build changes.");
}

function pathToMainUrl(path) {
  return path ? pathToFileURL(resolve(path)).href : "";
}
