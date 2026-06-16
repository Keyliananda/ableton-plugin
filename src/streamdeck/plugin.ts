import {
  PROTOCOL_VERSION,
  type BridgeToPluginMessage,
  type PluginHelloMessage
} from "../protocol/messages.js";
import {
  renderFeedback,
  type StreamDeckFeedbackAdapter
} from "./feedback.js";
import {
  applyBridgeMessage,
  createDisconnectedState,
  rotateDial as buildDialDelta,
  setActiveBank as applyActiveBank,
  toggleDialBank as applyDialBankToggle,
  type StreamDeckState
} from "./state.js";
import {
  StreamDeckBridgeServer,
  type StreamDeckBridgeServerAddress,
  type StreamDeckBridgeServerOptions
} from "./server.js";

export interface StreamDeckPluginControllerOptions {
  server?: StreamDeckBridgeServer | StreamDeckBridgeServerOptions;
  feedback: StreamDeckFeedbackAdapter;
  initialState?: StreamDeckState;
}

export class StreamDeckPluginController {
  private readonly server: StreamDeckBridgeServer;
  private readonly feedback: StreamDeckFeedbackAdapter;
  private readonly contexts: Array<string | null> = [null, null, null, null];
  private state: StreamDeckState;
  private unsubscribeServer: (() => void) | null = null;
  private unsubscribeServerDisconnect: (() => void) | null = null;
  private renderQueue: Promise<void> = Promise.resolve();

  constructor(options: StreamDeckPluginControllerOptions) {
    this.server =
      options.server instanceof StreamDeckBridgeServer
        ? options.server
        : new StreamDeckBridgeServer(options.server ?? { port: 17375 });
    this.feedback = options.feedback;
    this.state = options.initialState ?? createDisconnectedState();
  }

  get address(): StreamDeckBridgeServerAddress {
    return this.server.address;
  }

  getState(): StreamDeckState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.unsubscribeServer === null) {
      this.unsubscribeServer = this.server.onMessage((message) => {
        void this.handleBridgeMessage(message);
      });
    }
    if (this.unsubscribeServerDisconnect === null) {
      this.unsubscribeServerDisconnect = this.server.onDisconnect(() => {
        this.handleBridgeDisconnect();
      });
    }

    await this.server.start();
    this.queueFeedbackRender();
  }

  async stop(): Promise<void> {
    this.unsubscribeServer?.();
    this.unsubscribeServer = null;
    this.unsubscribeServerDisconnect?.();
    this.unsubscribeServerDisconnect = null;
    await this.renderQueue;
    await this.server.close();
  }

  registerDialContext(dialIndex: number, context: string): void {
    if (!isDialIndex(dialIndex)) {
      return;
    }

    this.contexts[dialIndex] = context;
    this.queueFeedbackRender();
  }

  unregisterDialContext(context: string): void {
    const index = this.contexts.indexOf(context);
    if (index === -1) {
      return;
    }

    this.contexts[index] = null;
  }

  async handleBridgeMessage(message: BridgeToPluginMessage): Promise<void> {
    this.state = applyBridgeMessage(this.state, message);
    this.queueFeedbackRender();
    await this.renderQueue;

    if (message.type === "bridge.hello") {
      this.requestDeviceRefresh();
    }
  }

  handleBridgeDisconnect(): void {
    this.state = createDisconnectedState();
    this.queueFeedbackRender();
  }

  setBank(bank: number): void {
    this.state = applyActiveBank(this.state, bank);
    this.server.send({ type: "bank.set", bank: this.state.activeBank });
    this.queueFeedbackRender();
  }

  toggleBank(): 0 | 1 {
    const nextBank = this.state.activeBank === 0 ? 1 : 0;
    this.setBank(nextBank);
    return this.state.activeBank;
  }

  toggleDialBank(dialIndex: number): 0 | 1 {
    this.state = applyDialBankToggle(this.state, dialIndex);
    this.queueFeedbackRender();

    return isDialIndex(dialIndex) ? this.state.dialBanks[dialIndex] : this.state.activeBank;
  }

  rotateDial(dialIndex: number, ticks: number, fine = false): boolean {
    const delta = buildDialDelta(this.state, dialIndex, ticks, fine);
    if (delta === null) {
      return false;
    }

    this.server.send(delta);
    return true;
  }

  requestDeviceRefresh(): void {
    this.server.send({ type: "device.refresh" });
  }

  toggleSelectedDevice(): boolean {
    if (this.state.device === null) {
      return false;
    }

    this.server.send({ type: "device.toggle", deviceId: this.state.device.id });
    return true;
  }

  sendHello(): void {
    this.server.send(createPluginHello());
  }

  async whenIdle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await this.renderQueue;
  }

  private queueFeedbackRender(): void {
    const state = this.state;
    const contexts = [...this.contexts];

    this.renderQueue = this.renderQueue.then(async () => {
      await renderFeedback(this.feedback, state, contexts);
    });
  }
}

function createPluginHello(): PluginHelloMessage {
  return {
    type: "plugin.hello",
    protocolVersion: PROTOCOL_VERSION,
    pluginName: "Ableton Rack Dials"
  };
}

function isDialIndex(value: number): value is 0 | 1 | 2 | 3 {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

