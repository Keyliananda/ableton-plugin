import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_FOLDER = "de.daniel.ableton-rack-control.sdPlugin";
const MAX_DEVICE_FILE = "Ableton Stream Deck 2.amxd";
const MAX_RUNTIME_FILES = [
  "build-bridge-patch-v5.js",
  "live-api-adapter.js",
  "node-bridge-safe.js",
  "node-smoke.js"
];

export function buildReleasePackage(options = {}) {
  const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot);
  const version = options.version ?? readPackageVersion(repoRoot);
  const outDir = resolve(options.outDir ?? join(repoRoot, "release"));
  const packageDir = join(outDir, `AbletonRackControl-${version}`);

  rmSync(packageDir, { recursive: true, force: true });
  mkdirSync(packageDir, { recursive: true });

  copyPortableStreamDeckPlugin(repoRoot, packageDir);
  copyMaxForLiveRuntime(repoRoot, packageDir);
  writeReleaseDocs(packageDir, version);
  writeInstaller(packageDir);

  return {
    packageDir,
    version
  };
}

function copyPortableStreamDeckPlugin(repoRoot, packageDir) {
  const sourcePluginDir = join(repoRoot, PLUGIN_FOLDER);
  const targetPluginDir = join(packageDir, "StreamDeck", PLUGIN_FOLDER);

  cpSync(sourcePluginDir, targetPluginDir, { recursive: true });
  cpSync(join(repoRoot, "dist"), join(targetPluginDir, "dist"), { recursive: true });
  copyNodeModules(repoRoot, join(targetPluginDir, "node_modules"));
  writeFileSync(join(targetPluginDir, "bin", "plugin.js"), 'import "../dist/src/streamdeck/elgato-entry.js";\n');
}

function copyMaxForLiveRuntime(repoRoot, packageDir) {
  const sourceDir = join(repoRoot, "src", "maxforlive");
  const deviceSource = join(repoRoot, "maxforlive", MAX_DEVICE_FILE);
  const targetDir = join(packageDir, "MaxForLive", "AbletonRackBridge");
  const deviceTarget = join(packageDir, "MaxForLive", MAX_DEVICE_FILE);

  mkdirSync(targetDir, { recursive: true });

  for (const file of MAX_RUNTIME_FILES) {
    copyFileSync(join(sourceDir, file), join(targetDir, file));
  }

  if (existsSync(deviceSource)) {
    copyFileSync(deviceSource, deviceTarget);
  }

  copyNodeModules(repoRoot, join(targetDir, "node_modules"));

}

function copyNodeModules(repoRoot, targetDir) {
  cpSync(join(repoRoot, "node_modules"), targetDir, {
    recursive: true,
    filter: (source) => !source.includes(`${join("node_modules", ".cache")}`)
  });
}

function writeReleaseDocs(packageDir, version) {
  writeFileSync(
    join(packageDir, "README.md"),
    `# Ableton Rack Control ${version}

Stream Deck + Plugin und Max-for-Live-Bridge zum Steuern des aktuell ausgewaehlten Ableton Racks.

Dieses Release ist fuer eine Windows-Neuinstallation gedacht: Stream Deck Software und Ableton Live installieren, dieses Paket entpacken, \`install.ps1\` ausfuehren, Stream Deck neu starten und den Max-for-Live Patch in Ableton laden.

Siehe \`INSTALL.md\` fuer die einzelnen Schritte.
`
  );

  writeFileSync(
    join(packageDir, "INSTALL.md"),
    `# Installation Nach Windows-Neuinstallation

## Voraussetzungen

- Elgato Stream Deck Software ist installiert.
- Ableton Live mit Max for Live ist installiert.
- Dieses Release-Paket wurde entpackt.

## Installation

1. Rechtsklick auf \`install.ps1\`.
2. \`Mit PowerShell ausfuehren\` waehlen.
3. Stream Deck App neu starten.
4. Ableton Live starten.
5. In Ableton unter User Library > Presets > Audio Effects > Max Audio Effect das Device \`Ableton Stream Deck 2\` laden.

Falls das Device dort nicht auftaucht, kann die Bridge weiterhin manuell in einem leeren Max Audio Effect gebaut werden:

\`\`\`text
js %USERPROFILE%/Documents/AbletonRackBridge/build-bridge-patch-v5.js
\`\`\`

## Installierte Pfade

- Stream Deck Plugin: \`%APPDATA%\\Elgato\\StreamDeck\\Plugins\\de.daniel.ableton-rack-control.sdPlugin\`
- Max Bridge: \`%USERPROFILE%\\Documents\\AbletonRackBridge\`
- Max Device: Ableton User Library, \`Presets\\Audio Effects\\Max Audio Effect\\Ableton Stream Deck 2.amxd\`

## Test

In Ableton ein Rack auswaehlen. Die Stream Deck + Dials sollten die Makros anzeigen. Wenn nichts erscheint, Stream Deck und Ableton einmal neu starten.
`
  );
}

function writeInstaller(packageDir) {
  writeFileSync(
    join(packageDir, "install.ps1"),
    `$ErrorActionPreference = "Stop"

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginSource = Join-Path $PackageRoot "StreamDeck\\${PLUGIN_FOLDER}"
$PluginTarget = Join-Path $env:APPDATA "Elgato\\StreamDeck\\Plugins\\${PLUGIN_FOLDER}"
$BridgeSource = Join-Path $PackageRoot "MaxForLive\\AbletonRackBridge"
$BridgeTarget = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "AbletonRackBridge"
$DeviceSource = Join-Path $PackageRoot "MaxForLive\\${MAX_DEVICE_FILE}"
$DefaultUserLibrary = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Ableton\\User Library"
$CloudUserLibrary = "N:\\Ableton Wolke\\Ableton\\User Library"
$UserLibrary = $DefaultUserLibrary

if ($env:ABLETON_USER_LIBRARY) {
  $UserLibrary = $env:ABLETON_USER_LIBRARY
} elseif (Test-Path $CloudUserLibrary) {
  $UserLibrary = $CloudUserLibrary
}

$DeviceTargetDir = Join-Path $UserLibrary "Presets\\Audio Effects\\Max Audio Effect"
$DeviceTarget = Join-Path $DeviceTargetDir "${MAX_DEVICE_FILE}"

Write-Host "Installing Ableton Rack Control..."

if (!(Test-Path $PluginSource)) {
  throw "Stream Deck plugin source not found: $PluginSource"
}

if (!(Test-Path $BridgeSource)) {
  throw "Max for Live bridge source not found: $BridgeSource"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginTarget) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BridgeTarget) | Out-Null

if (Test-Path $PluginTarget) {
  Remove-Item -LiteralPath $PluginTarget -Recurse -Force
}

if (Test-Path $BridgeTarget) {
  Remove-Item -LiteralPath $BridgeTarget -Recurse -Force
}

Copy-Item -LiteralPath $PluginSource -Destination $PluginTarget -Recurse
Copy-Item -LiteralPath $BridgeSource -Destination $BridgeTarget -Recurse

if (Test-Path $DeviceSource) {
  New-Item -ItemType Directory -Force -Path $DeviceTargetDir | Out-Null
  Copy-Item -LiteralPath $DeviceSource -Destination $DeviceTarget -Force
}

$BuilderPath = Join-Path $BridgeTarget "build-bridge-patch-v5.js"
$BridgeRootForMax = $BridgeTarget.Replace('\\', '/')
$BuilderSource = Get-Content -LiteralPath $BuilderPath -Raw
$BuilderSource = $BuilderSource -replace 'var ROOT = ".*?";', ('var ROOT = "' + $BridgeRootForMax + '";')
Set-Content -LiteralPath $BuilderPath -Value $BuilderSource -NoNewline

Write-Host ""
Write-Host "Installed Stream Deck plugin to:"
Write-Host "  $PluginTarget"
Write-Host "Installed Max for Live bridge to:"
Write-Host "  $BridgeTarget"
if (Test-Path $DeviceTarget) {
  Write-Host "Installed Max for Live device to:"
  Write-Host "  $DeviceTarget"
}
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Restart the Stream Deck app."
Write-Host "  2. Open Ableton Live."
Write-Host "  3. Load Ableton Stream Deck 2 from User Library > Presets > Audio Effects > Max Audio Effect."
Write-Host "     Fallback builder object: js $($BridgeTarget.Replace('\\', '/'))/build-bridge-patch-v5.js"
`
  );
}

function readPackageVersion(repoRoot) {
  const raw = readFileSync(join(repoRoot, "package.json"), "utf8");
  const parsed = JSON.parse(raw);
  return parsed.version ?? "0.0.0";
}

if (import.meta.url === pathToMainUrl(process.argv[1])) {
  const result = buildReleasePackage({
    outDir: process.argv[2]
  });

  console.log(`Release package created: ${result.packageDir}`);
}

function pathToMainUrl(path) {
  return path ? pathToFileURL(resolve(path)).href : "";
}
