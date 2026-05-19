export interface LiveParameterSnapshot {
  id: number;
  name: string;
  value: number;
  displayValue?: string;
  min?: number;
  max?: number;
  isQuantized?: boolean;
  isEnabled?: boolean;
  valueItems?: string[];
}

export interface LiveDeviceSnapshot {
  id: number;
  name: string;
  className: string;
  isRack: boolean;
  params: LiveParameterSnapshot[];
}

export interface LiveAdapter {
  getSelectedDevice(): LiveDeviceSnapshot | Promise<LiveDeviceSnapshot | null> | null;
  setParameterValue(deviceId: number, paramId: number, value: number): void | Promise<void>;
}
