export interface StreamDeckSdkController {
  registerDialContext(dialIndex: number, context: string): void;
  unregisterDialContext(context: string): void;
  rotateDial(dialIndex: number, ticks: number, fine: boolean): boolean;
  toggleDialBank(dialIndex: number): 0 | 1;
}

export type StreamDeckSdkEvent =
  | {
      event: "willAppear";
      context: string;
      payload: EncoderPayload | KeypadPayload;
    }
  | {
      event: "willDisappear";
      context: string;
    }
  | {
      event: "dialRotate";
      context: string;
      payload: EncoderPayload & {
        ticks: number;
        pressed: boolean;
      };
    }
  | {
      event: "dialDown";
      context: string;
      payload: EncoderPayload;
    };

interface Coordinates {
  column: number;
  row: number;
}

interface EncoderPayload {
  controller: "Encoder";
  coordinates: Coordinates;
}

interface KeypadPayload {
  controller: "Keypad";
  coordinates: Coordinates;
}

export class StreamDeckSdkEventAdapter {
  constructor(private readonly controller: StreamDeckSdkController) {}

  handleEvent(event: StreamDeckSdkEvent): boolean {
    switch (event.event) {
      case "willAppear":
        return this.handleWillAppear(event);
      case "willDisappear":
        this.controller.unregisterDialContext(event.context);
        return true;
      case "dialRotate":
        return this.handleDialRotate(event);
      case "dialDown":
        return this.handleDialDown(event);
    }
  }

  private handleWillAppear(event: Extract<StreamDeckSdkEvent, { event: "willAppear" }>): boolean {
    if (event.payload.controller !== "Encoder") {
      return false;
    }

    const dialIndex = dialIndexFromColumn(event.payload.coordinates.column);
    if (dialIndex === null) {
      return false;
    }

    this.controller.registerDialContext(dialIndex, event.context);
    return true;
  }

  private handleDialRotate(event: Extract<StreamDeckSdkEvent, { event: "dialRotate" }>): boolean {
    const dialIndex = dialIndexFromColumn(event.payload.coordinates.column);
    if (dialIndex === null) {
      return false;
    }

    return this.controller.rotateDial(dialIndex, event.payload.ticks, false);
  }

  private handleDialDown(event: Extract<StreamDeckSdkEvent, { event: "dialDown" }>): boolean {
    const dialIndex = dialIndexFromColumn(event.payload.coordinates.column);
    if (dialIndex === null) {
      return false;
    }

    this.controller.toggleDialBank(dialIndex);
    return true;
  }
}

function dialIndexFromColumn(column: number): 0 | 1 | 2 | 3 | null {
  return Number.isInteger(column) && column >= 0 && column <= 3 ? (column as 0 | 1 | 2 | 3) : null;
}
