autowatch = 1;
inlets = 1;
outlets = 2;

var PROTOCOL_VERSION = 1;
var activeBank = 0;
var lastSnapshotJson = "";
var selectedDeviceId = 0;
var selectedParams = [];
var COARSE_CONTINUOUS_DIVISOR = 128;
var FINE_CONTINUOUS_DIVISOR = 1024;

function loadbang() {
  bridge_hello();
}

function bridge_hello() {
  sendBridgeMessage({
    type: "bridge.hello",
    protocolVersion: PROTOCOL_VERSION,
    bridgeName: "Ableton Rack Bridge"
  });
}

function bang() {
  bridge_hello();
  poll(true);
}

function poll(force) {
  try {
    var device = new LiveAPI(null, "live_set view selected_track view selected_device");
    var deviceId = Number(device.id || 0);

    if (!deviceId) {
      selectedDeviceId = 0;
      selectedParams = [];
      sendBridgeMessage({ type: "device.cleared", reason: "no-selected-device" });
      lastSnapshotJson = "";
      return;
    }

    var params = readParams(device).slice(0, 8);
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

    if (force || snapshotJson !== lastSnapshotJson) {
      sendBridgeMessage(snapshot);
      lastSnapshotJson = snapshotJson;
    }
  } catch (error) {
    post("[ableton-rack-liveapi] poll failed: " + error + "\n");
  }
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
  if (message.type === "bank.set") {
    activeBank = message.bank === 1 ? 1 : 0;
    poll();
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
