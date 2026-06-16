autowatch = 1;
inlets = 1;
outlets = 1;

var ROOT = "S:/AbletonRackBridge";
var GENERATED_PREFIX = "ableton_rack_bridge_";

function bang() {
  build();
}

function loadbang() {
  build();
}

function build() {
  var p = this.patcher;
  if (!p) {
    post("[ableton-rack-builder-v5] no patcher available yet.\n");
    return;
  }

  cleanupOldBridgeBoxes(p);
  removeDuplicateAudioIoBoxes(p);

  var plugin = markGenerated(findBoxByText(p, "plugin~") || p.newdefault(60, 60, "plugin~"), "plugin");
  var plugout = markGenerated(findBoxByText(p, "plugout~") || p.newdefault(60, 420, "plugout~"), "plugout");

  var title = markGenerated(p.newdefault(170, 60, "comment", "Ableton Rack Bridge live-test patch"), "title");
  var startMsg = markGenerated(p.newdefault(170, 150, "message"), "start");
  startMsg.message("set", "start");
  var stopMsg = markGenerated(p.newdefault(260, 150, "message"), "stop");
  stopMsg.message("set", "stop");
  var refreshMsg = markGenerated(p.newdefault(350, 150, "message"), "refresh");
  refreshMsg.message("set", "bang");
  var note = markGenerated(p.newdefault(350, 115, "comment", "Recovery controls: start, stop, refresh. Normal mode starts automatically."), "note");
  var liveApi = markGenerated(p.newdefault(330, 210, "js", ROOT + "/live-api-adapter.js"), "live_api");
  var node = markGenerated(p.newdefault(170, 270, "node.script", ROOT + "/node-bridge-safe.js", "@autostart", 1), "node");
  var print = markGenerated(p.newdefault(575, 330, "print", "ableton-rack-node-safe"), "print");

  ignore(title);
  ignore(note);

  safeConnect(p, plugin, 0, plugout, 0);
  safeConnect(p, plugin, 1, plugout, 1);
  safeConnect(p, startMsg, 0, node, 0);
  safeConnect(p, stopMsg, 0, node, 0);
  safeConnect(p, refreshMsg, 0, liveApi, 0);
  safeConnect(p, liveApi, 0, node, 0);
  safeConnect(p, node, 0, liveApi, 0);
  safeConnect(p, node, 1, print, 0);

  outlet(0, "done");
  post("[ableton-rack-builder-v5] old bridge boxes cleaned; bridge patch created with " + ROOT + " paths.\n");
}

function cleanupOldBridgeBoxes(patcher) {
  var boxes = [];
  patcher.apply(function(box) {
    var text = box && box.text ? String(box.text) : "";
    var maxclass = box && box.maxclass ? String(box.maxclass) : "";

    if (isGeneratedBridgeBox(box)) {
      boxes.push(box);
      return;
    }

    if (text === "plugin~" || text === "plugout~") {
      return;
    }

    if (text.indexOf("build-bridge-patch-v5.js") !== -1) {
      return;
    }

    if (
      text.indexOf("ableton-plugin/src/maxforlive") !== -1 ||
      text.indexOf("AbletonRackBridge") !== -1 ||
      text === "live.thisdevice" ||
      (text === "metro 250" || text === "metro 1000") ||
      text === "script start" ||
      text === "script stop" ||
      text === "start" ||
      text === "stop" ||
      text === "bang" ||
      text === "route plugin_message_uri" ||
      text === "print ableton-rack-node" ||
      text === "print ableton-rack-node-safe" ||
      text === "Ableton Rack Bridge live-test patch" ||
      text.indexOf("Recovery controls: start, stop, refresh") !== -1 ||
      text.indexOf("Turn on to poll Ableton") !== -1 ||
      text.indexOf("wait for connected") !== -1 ||
      maxclass === "toggle"
    ) {
      boxes.push(box);
    }
  });

  for (var i = 0; i < boxes.length; i += 1) {
    try {
      patcher.remove(boxes[i]);
    } catch (error) {
      post("[ableton-rack-builder-v5] remove failed: " + error + "\n");
    }
  }
}

function removeDuplicateAudioIoBoxes(patcher) {
  removeDuplicateBoxesByText(patcher, "plugin~");
  removeDuplicateBoxesByText(patcher, "plugout~");
}

function removeDuplicateBoxesByText(patcher, text) {
  var first = null;
  var extras = [];

  patcher.apply(function(box) {
    if (!box || String(box.text) !== text) {
      return;
    }

    if (!first) {
      first = box;
      return;
    }

    extras.push(box);
  });

  for (var i = 0; i < extras.length; i += 1) {
    try {
      patcher.remove(extras[i]);
    } catch (error) {
      post("[ableton-rack-builder-v5] duplicate " + text + " remove failed: " + error + "\n");
    }
  }
}

function markGenerated(box, name) {
  if (!box) {
    return box;
  }

  try {
    box.varname = GENERATED_PREFIX + name;
  } catch (error) {
    post("[ableton-rack-builder-v5] varname failed: " + error + "\n");
  }

  return box;
}

function isGeneratedBridgeBox(box) {
  var varname = box && box.varname ? String(box.varname) : "";
  return varname.indexOf(GENERATED_PREFIX) === 0;
}

function findBoxByText(patcher, text) {
  var found = null;
  patcher.apply(function(box) {
    if (found) {
      return;
    }

    if (box && box.maxclass === "newobj" && String(box.text) === text) {
      found = box;
    }
  });
  return found;
}

function safeConnect(patcher, source, sourceOutlet, destination, destinationInlet) {
  try {
    patcher.connect(source, sourceOutlet, destination, destinationInlet);
  } catch (error) {
    post("[ableton-rack-builder-v5] connect failed: " + error + "\n");
  }
}

function ignore(_) {
}

bang.local = 1;
loadbang.local = 1;
build.local = 1;
cleanupOldBridgeBoxes.local = 1;
removeDuplicateAudioIoBoxes.local = 1;
removeDuplicateBoxesByText.local = 1;
markGenerated.local = 1;
isGeneratedBridgeBox.local = 1;

build();
