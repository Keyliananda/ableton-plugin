autowatch = 1;
inlets = 1;
outlets = 2;

var PROTOCOL_VERSION = 1;
var activeBank = 0;
var lastSnapshotJson = "";
var selectedDeviceId = 0;
var selectedParams = [];
var selectedDeviceOnParam = null;
var selectedParamObservers = [];
var selectedParamObserverSignature = "";
var selectedParamObserverGeneration = 0;
var COARSE_CONTINUOUS_DIVISOR = 128;
var FINE_CONTINUOUS_DIVISOR = 1024;
var DEBUG = false;
var STARTUP_POLL_INTERVAL_MS = 500;
var STARTUP_POLL_TICKS = 20;
var SELECTION_OBSERVER_DEBOUNCE_MS = 50;
var SELECTION_WATCH_INTERVAL_MS = 2000;
var startupPollTask = null;
var startupPollTicksRemaining = 0;
var selectionWatchTask = null;
var selectedTrackObserver = null;
var selectedDeviceObserver = null;
var selectionPollTask = null;

function loadbang() {
}

function debugLog(message) {
  if (DEBUG) {
    post(message);
  }
}

function bridge_hello() {
  debugLog("[ableton-rack-liveapi] sending bridge.hello\n");
  sendBridgeMessage({
    type: "bridge.hello",
    protocolVersion: PROTOCOL_VERSION,
    bridgeName: "Ableton Rack Bridge"
  });
}

function bridge_connected() {
  debugLog("[ableton-rack-liveapi] node bridge connected\n");
  bridge_hello();
  startSelectionObservers();
  startStartupPoll();
  startSelectionWatch();
}

function bang() {
  bridge_hello();
  poll(true);
}

function startStartupPoll() {
  startupPollTicksRemaining = STARTUP_POLL_TICKS;

  if (startupPollTask) {
    startupPollTask.cancel();
  }

  startupPollTask = new Task(runStartupPoll, this);
  startupPollTask.interval = STARTUP_POLL_INTERVAL_MS;
  startupPollTask.repeat();
}

function runStartupPoll() {
  if (startupPollTicksRemaining <= 0) {
    if (startupPollTask) {
      startupPollTask.cancel();
    }
    startupPollTask = null;
    return;
  }

  startupPollTicksRemaining -= 1;
  poll(false);
}

function startSelectionWatch() {
  if (selectionWatchTask) {
    selectionWatchTask.cancel();
  }

  selectionWatchTask = new Task(runSelectionWatch, this);
  selectionWatchTask.interval = SELECTION_WATCH_INTERVAL_MS;
  selectionWatchTask.repeat();
}

function runSelectionWatch() {
  var deviceId = readSelectedDeviceId();

  if (deviceId !== selectedDeviceId) {
    poll(true);
  }
}

function startSelectionObservers() {
  clearSelectionObservers();
  observeSelectedTrack();
  observeSelectedDevice();
}

function observeSelectedTrack() {
  try {
    selectedTrackObserver = new LiveAPI(selectedTrackChanged, "live_set view");
    selectedTrackObserver.property = "selected_track";
  } catch (error) {
    post("[ableton-rack-liveapi] selected track observer failed: " + error + "\n");
    selectedTrackObserver = null;
  }
}

function observeSelectedDevice() {
  clearSelectionObserver(selectedDeviceObserver);
  selectedDeviceObserver = null;

  try {
    selectedDeviceObserver = new LiveAPI(selectedDeviceChanged, "live_set view selected_track view");
    selectedDeviceObserver.property = "selected_device";
  } catch (error) {
    post("[ableton-rack-liveapi] selected device observer failed: " + error + "\n");
    selectedDeviceObserver = null;
  }
}

function clearSelectionObservers() {
  clearSelectionObserver(selectedTrackObserver);
  clearSelectionObserver(selectedDeviceObserver);
  selectedTrackObserver = null;
  selectedDeviceObserver = null;
}

function clearSelectionObserver(observer) {
  if (!observer) {
    return;
  }

  try {
    observer.property = "";
  } catch (_) {
  }
}

function selectedTrackChanged() {
  debugLog("[ableton-rack-liveapi] selected_track changed\n");
  observeSelectedDevice();
  scheduleSelectionPoll();
}

function selectedDeviceChanged() {
  debugLog("[ableton-rack-liveapi] selected_device changed\n");
  scheduleSelectionPoll();
}

function scheduleSelectionPoll() {
  if (selectionPollTask) {
    selectionPollTask.cancel();
  }

  selectionPollTask = new Task(runSelectionObserverPoll, this);
  selectionPollTask.schedule(SELECTION_OBSERVER_DEBOUNCE_MS);
}

function runSelectionObserverPoll() {
  selectionPollTask = null;
  poll(true);
}

function readSelectedDeviceId() {
  try {
    var device = new LiveAPI(null, "live_set view selected_track view selected_device");
    return Number(device.id || 0);
  } catch (error) {
    post("[ableton-rack-liveapi] selected device watch failed: " + error + "\n");
    return selectedDeviceId;
  }
}

function poll(force) {
  try {
    var device = new LiveAPI(null, "live_set view selected_track view selected_device");
    var deviceId = Number(device.id || 0);

    if (!deviceId) {
      selectedDeviceId = 0;
      selectedParams = [];
      selectedDeviceOnParam = null;
      clearSelectedParamObservers();
      post("[ableton-rack-liveapi] no selected device\n");
      sendBridgeMessage({ type: "device.cleared", reason: "no-selected-device" });
      lastSnapshotJson = "";
      return;
    }

    var allParams = readParams(device);
    selectedDeviceOnParam = findDeviceOnParam(allParams);
    var params = filterDialParams(allParams).slice(0, 8);
    var snapshot = {
      type: "device.changed",
      device: {
        id: deviceId,
        name: readString(device, "name", "Selected Device"),
        className: readString(device, "class_name", "Device"),
        isRack: isRackDevice(device)
      },
      bankCount: 2,
      activeBank: activeBank,
      params: params
    };
    var snapshotJson = JSON.stringify(snapshot);

    selectedDeviceId = deviceId;
    selectedParams = params;
    observeSelectedParams(params);

    if (force || snapshotJson !== lastSnapshotJson) {
      debugLog("[ableton-rack-liveapi] sending device.changed id=" + deviceId + " params=" + params.length + "\n");
      sendBridgeMessage(snapshot);
      lastSnapshotJson = snapshotJson;
    }
  } catch (error) {
    post("[ableton-rack-liveapi] poll failed: " + error + "\n");
  }
}

function observeSelectedParams(params) {
  var signature = params.map(function(param) {
    return String(param.id);
  }).join(",");

  if (signature === selectedParamObserverSignature) {
    return;
  }

  clearSelectedParamObservers();
  selectedParamObserverSignature = signature;

  for (var i = 0; i < params.length; i += 1) {
    observeSelectedParam(params[i].id, selectedParamObserverGeneration);
  }
}

function observeSelectedParam(paramId, observerGeneration) {
  try {
    var observer = new LiveAPI(function() {
      selectedParamValueChanged(paramId, observerGeneration);
    }, "id " + paramId);
    observer.property = "value";
    selectedParamObservers.push(observer);
  } catch (error) {
    post("[ableton-rack-liveapi] parameter observer failed: " + error + "\n");
  }
}

function clearSelectedParamObservers() {
  selectedParamObserverGeneration += 1;

  for (var i = 0; i < selectedParamObservers.length; i += 1) {
    try {
      selectedParamObservers[i].property = "";
    } catch (_) {
    }
  }

  selectedParamObservers = [];
  selectedParamObserverSignature = "";
}

function selectedParamValueChanged(paramId, observerGeneration) {
  if (observerGeneration !== selectedParamObserverGeneration) {
    return;
  }

  var param = findSelectedParamById(paramId);

  if (!param || !param.isEnabled || !selectedDeviceId) {
    return;
  }

  try {
    var liveParam = new LiveAPI(null, "id " + param.id);
    var value = readNumber(liveParam, "value", param.value);
    var displayValue = readDisplayValue(liveParam, value);
    var normalized = param.max === param.min ? 0 : clamp((value - param.min) / (param.max - param.min), 0, 1);

    if (value === param.value && displayValue === param.displayValue && normalized === param.normalized) {
      return;
    }

    param.value = value;
    param.displayValue = displayValue;
    param.normalized = normalized;
    sendBridgeMessage({
      type: "param.changed",
      deviceId: selectedDeviceId,
      paramId: param.id,
      slot: param.slot,
      value: param.value,
      displayValue: param.displayValue,
      normalized: param.normalized
    });
  } catch (error) {
    post("[ableton-rack-liveapi] parameter observer update failed: " + error + "\n");
  }
}

function findSelectedParamById(paramId) {
  for (var i = 0; i < selectedParams.length; i += 1) {
    if (selectedParams[i].id === paramId) {
      return selectedParams[i];
    }
  }

  return null;
}

function plugin_message_uri(encoded) {
  try {
    var message = JSON.parse(decodeURIComponent(String(encoded)));
    handlePluginMessage(message);
  } catch (error) {
    post("[ableton-rack-liveapi] bad plugin message: " + error + "\n");
  }
}

function handlePluginMessage(message) {
  if (message.type === "device.refresh") {
    debugLog("[ableton-rack-liveapi] received device.refresh\n");
    poll(true);
    return;
  }

  if (message.type === "bank.set") {
    activeBank = message.bank === 1 ? 1 : 0;
    poll();
    return;
  }

  if (message.type === "device.toggle") {
    applyDeviceToggle(message);
    return;
  }

  if (message.type === "param.delta") {
    applyParamDelta(message);
  }
}

function applyParamDelta(message) {
  if (selectedDeviceId !== message.deviceId) {
    return;
  }

  var param = null;
  for (var i = 0; i < selectedParams.length; i += 1) {
    if (selectedParams[i].slot === message.slot && selectedParams[i].id === message.paramId) {
      param = selectedParams[i];
      break;
    }
  }

  if (!param || !param.isEnabled) {
    return;
  }

  var nextValue = param.isQuantized
    ? clamp(Math.round(param.value) + message.ticks, param.min, param.max)
    : clamp(param.value + message.ticks * ((param.max - param.min) / (message.fine ? FINE_CONTINUOUS_DIVISOR : COARSE_CONTINUOUS_DIVISOR)), param.min, param.max);

  writeParamValue(param, nextValue);
}

function applyDeviceToggle(message) {
  if (selectedDeviceId !== message.deviceId) {
    return;
  }

  var param = selectedDeviceOnParam;
  if (!param || !param.isEnabled) {
    return;
  }

  var midpoint = param.min + (param.max - param.min) / 2;
  var nextValue = param.value > midpoint ? param.min : param.max;
  writeParamValue(param, nextValue);
}

function findDeviceOnParam(params) {
  for (var i = 0; i < params.length; i += 1) {
    if (params[i].name === "Device On") {
      return params[i];
    }
  }

  return null;
}

function filterDialParams(params) {
  var result = [];

  for (var i = 0; i < params.length; i += 1) {
    if (params[i].name !== "Device On") {
      params[i].slot = result.length;
      result.push(params[i]);
    }
  }

  return result;
}

function writeParamValue(param, nextValue) {
  try {
    var liveParam = new LiveAPI(null, "id " + param.id);
    liveParam.set("value", nextValue);
    param.value = nextValue;
    param.displayValue = readDisplayValue(liveParam, nextValue);
    param.normalized = param.max === param.min ? 0 : clamp((nextValue - param.min) / (param.max - param.min), 0, 1);
    sendBridgeMessage({
      type: "param.changed",
      deviceId: selectedDeviceId,
      paramId: param.id,
      slot: param.slot,
      value: param.value,
      displayValue: param.displayValue,
      normalized: param.normalized
    });
  } catch (error) {
    post("[ableton-rack-liveapi] set value failed: " + error + "\n");
  }
}

function readParams(device) {
  var ids = readIdList(device.get("parameters"));
  var params = [];

  for (var i = 0; i < ids.length; i += 1) {
    var paramApi = new LiveAPI(null, "id " + ids[i]);
    var min = readNumber(paramApi, "min", 0);
    var max = readNumber(paramApi, "max", 1);
    var value = readNumber(paramApi, "value", min);
    var normalized = max === min ? 0 : (value - min) / (max - min);

    params.push({
      slot: i,
      id: ids[i],
      name: readString(paramApi, "name", "Param " + (i + 1)),
      value: value,
      displayValue: readDisplayValue(paramApi, value),
      min: min,
      max: max,
      normalized: clamp(normalized, 0, 1),
      isQuantized: readBoolean(paramApi, "is_quantized", false),
      isEnabled: readBoolean(paramApi, "is_enabled", true),
      valueItems: readBoolean(paramApi, "is_quantized", false) ? readStringList(paramApi, "value_items") : []
    });
  }

  return params;
}

function sendBridgeMessage(message) {
  outlet(0, "bridge_message_uri", encodeURIComponent(JSON.stringify(message)));
}

function readIdList(value) {
  var result = [];
  var values = value instanceof Array ? value : String(value).split(/\s+/);

  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i]) === "id" && i + 1 < values.length) {
      var id = Number(values[i + 1]);
      if (id) {
        result.push(id);
      }
    }
  }

  return result;
}

function readString(api, property, fallback) {
  try {
    var value = api.get(property);
    if (value instanceof Array) {
      return value.join(" ");
    }
    if (value !== null && value !== undefined && String(value).length > 0) {
      return String(value);
    }
  } catch (_) {
  }

  return fallback;
}

function readDisplayValue(api, value) {
  try {
    var display = api.call("str_for_value", value);
    if (display instanceof Array) {
      return display.join(" ");
    }
    if (display !== null && display !== undefined && String(display).length > 0) {
      return String(display);
    }
  } catch (_) {
  }

  return String(value);
}

function readNumber(api, property, fallback) {
  try {
    var value = api.get(property);
    var first = value instanceof Array ? value[0] : value;
    var number = Number(first);
    return isFinite(number) ? number : fallback;
  } catch (_) {
    return fallback;
  }
}

function readBoolean(api, property, fallback) {
  try {
    var value = api.get(property);
    var first = value instanceof Array ? value[0] : value;
    if (first === "true" || first === true || first === 1 || first === "1") {
      return true;
    }
    if (first === "false" || first === false || first === 0 || first === "0") {
      return false;
    }
  } catch (_) {
  }

  return fallback;
}

function readStringList(api, property) {
  try {
    var value = api.get(property);
    if (value instanceof Array) {
      var items = [];
      for (var i = 0; i < value.length; i += 1) {
        items.push(String(value[i]));
      }
      return items;
    }
  } catch (_) {
  }

  return [];
}

function isRackDevice(device) {
  var className = readString(device, "class_name", "");
  return className.indexOf("GroupDevice") !== -1 || className.indexOf("Rack") !== -1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
