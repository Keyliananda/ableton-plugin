import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";
import type { FeedbackPayload, StreamDeckFeedbackAdapter } from "../streamdeck/feedback.js";
import { StreamDeckPluginController } from "../streamdeck/plugin.js";

const DEFAULT_PORT = 17375;
const DIAL_CONTEXTS = ["dial-0", "dial-1", "dial-2", "dial-3"] as const;

interface DevLiveHostOptions {
  port?: number;
}

export async function runDevLiveHost(options: DevLiveHostOptions = {}): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;
  const controller = new StreamDeckPluginController({
    server: { port },
    feedback: new ConsoleFeedbackAdapter()
  });

  await controller.start();
  DIAL_CONTEXTS.forEach((context, dialIndex) => {
    controller.registerDialContext(dialIndex, context);
  });
  controller.sendHello();

  console.log(`[dev-live-host] listening on ws://127.0.0.1:${controller.address.port}`);
  console.log("[dev-live-host] commands: b0, b1, refresh, r <dial 0-3> <ticks> [fine], state, help, q");

  const close = async (): Promise<void> => {
    console.log("[dev-live-host] stopping");
    await controller.stop();
  };

  process.once("SIGINT", () => {
    void close().then(() => process.exit(0));
  });

  const rl = createInterface({ input, output });

  try {
    for (;;) {
      const line = (await rl.question("> ")).trim();
      if (line === "q" || line === "quit" || line === "exit") {
        break;
      }

      handleCommand(controller, line);
      await controller.whenIdle();
    }
  } finally {
    rl.close();
    await close();
  }
}

function handleCommand(controller: StreamDeckPluginController, line: string): void {
  const [command, ...args] = line.split(/\s+/).filter(Boolean);

  switch (command) {
    case undefined:
      return;
    case "b0":
    case "bank0":
      controller.setBank(0);
      console.log("[dev-live-host] bank set to 0");
      return;
    case "b1":
    case "bank1":
      controller.setBank(1);
      console.log("[dev-live-host] bank set to 1");
      return;
    case "r":
    case "rotate":
      rotateFromArgs(controller, args);
      return;
    case "f":
    case "refresh":
      controller.requestDeviceRefresh();
      console.log("[dev-live-host] requested selected-device refresh");
      return;
    case "state":
      console.log(JSON.stringify(controller.getState(), null, 2));
      return;
    case "help":
      console.log("b0 | b1 | refresh | r <dial 0-3> <ticks> [fine] | state | q");
      return;
    default:
      console.log(`[dev-live-host] unknown command: ${command}`);
  }
}

function rotateFromArgs(controller: StreamDeckPluginController, args: string[]): void {
  const dialIndex = Number(args[0]);
  const ticks = Number(args[1]);
  const fine = args[2] === "fine" || args[2] === "true";

  if (!Number.isInteger(dialIndex) || dialIndex < 0 || dialIndex > 3 || !Number.isFinite(ticks)) {
    console.log("[dev-live-host] usage: r <dial 0-3> <ticks> [fine]");
    return;
  }

  if (controller.rotateDial(dialIndex, ticks, fine)) {
    console.log(`[dev-live-host] rotated dial ${dialIndex} by ${ticks}${fine ? " fine" : ""}`);
    return;
  }

  console.log(`[dev-live-host] dial ${dialIndex} has no mapped parameter; use state to inspect current mapping`);
}

class ConsoleFeedbackAdapter implements StreamDeckFeedbackAdapter {
  setFeedback(context: string, payload: FeedbackPayload): void {
    const status = payload.isEnabled ? "on" : "off";
    console.log(
      `[feedback:${context}] ${status} title="${payload.title}" value="${payload.value}" indicator=${payload.indicator.value}`
    );
  }
}

function parseCliArgs(argv: readonly string[]): DevLiveHostOptions {
  const port = readNumberArg(argv, "--port");

  return {
    ...(port === undefined ? {} : { port })
  };
}

function readNumberArg(argv: readonly string[], name: string): number | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const parsed = Number(argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDevLiveHost(parseCliArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
