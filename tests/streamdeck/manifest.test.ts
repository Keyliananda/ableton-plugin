import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PLUGIN_UUID = "de.daniel.ableton-rack-control";
const MANIFEST_PATH = join(process.cwd(), `${PLUGIN_UUID}.sdPlugin`, "manifest.json");

describe("Stream Deck manifest", () => {
  it("declares the Ableton Rack Control plugin and encoder action", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      $schema: string;
      Actions: Array<{
        Controllers?: string[];
        Encoder?: {
          layout?: string;
          TriggerDescription?: {
            Push?: string;
            Rotate?: string;
            Touch?: string;
          };
        };
        Icon: string;
        Name: string;
        States: Array<{ Image: string }>;
        UUID: string;
      }>;
      CodePath: string;
      Name: string;
      Nodejs?: { Version: string };
      SDKVersion: number;
      Software?: { MinimumVersion: string };
      UUID: string;
    };

    expect(manifest.$schema).toBe("https://schemas.elgato.com/streamdeck/plugins/manifest.json");
    expect(manifest.UUID).toBe(PLUGIN_UUID);
    expect(manifest.Name).toBe("Ableton Rack Control");
    expect(manifest.CodePath).toBe("bin/plugin.js");
    expect(manifest.SDKVersion).toBe(2);
    expect(manifest.Nodejs?.Version).toBe("24");
    expect(manifest.Software?.MinimumVersion).toBe("7.1");

    expect(manifest.Actions).toHaveLength(1);
    expect(manifest.Actions[0]).toMatchObject({
      UUID: `${PLUGIN_UUID}.dial`,
      Name: "Rack Dial",
      Controllers: ["Encoder"],
      Icon: "imgs/action",
      States: [{ Image: "imgs/action" }],
      Encoder: {
        layout: "$B1",
        TriggerDescription: {
          Rotate: "Adjust selected Rack parameter",
          Push: "Fine adjustment while rotating",
          Touch: "Refresh selected Rack"
        }
      }
    });

    const codePath = join(process.cwd(), PLUGIN_UUID + ".sdPlugin", manifest.CodePath);
    expect(existsSync(codePath)).toBe(true);
    expect(readFileSync(codePath, "utf8")).toContain("elgato-entry");
    expect(readFileSync(codePath, "utf8")).not.toContain("Placeholder");
  });
});
