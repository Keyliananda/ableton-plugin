autowatch = 1;
inlets = 1;
outlets = 0;

function bang() {
  build();
}

function loadbang() {
  build();
}

function build() {
  var p = this.patcher;
  if (!p) {
    post("[ableton-rack-builder-safe] no patcher available yet.\n");
    return;
  }

  clearEverythingExceptAudioAndSelf(p);

  var plugin = findBoxByText(p, "plugin~") || p.newdefault(60, 60, "plugin~");
  var plugout = findBoxByText(p, "plugout~") || p.newdefault(60, 420, "plugout~");

  var title = p.newdefault(170, 60, "comment", "Ableton Rack Bridge SAFE test patch");
  var start = p.newdefault(170, 115, "message");
  start.message("set", "start");
  var stop = p.newdefault(250, 115, "message");
  stop.message("set", "stop");
  var node = p.newdefault(170, 165, "node.script", "node-bridge-safe.js");
  var print = p.newdefault(170, 235, "print", "ableton-rack-node-safe");
  var poll = p.newdefault(430, 115, "button");
  var liveApi = p.newdefault(430, 165, "js", "live-api-adapter.js");
  var note = p.newdefault(430, 75, "comment", "1 start host, 2 click start, 3 click poll once. No metro.");

  ignore(title);
  ignore(note);

  safeConnect(p, plugin, 0, plugout, 0);
  safeConnect(p, plugin, 1, plugout, 1);
  safeConnect(p, start, 0, node, 0);
  safeConnect(p, stop, 0, node, 0);
  safeConnect(p, node, 0, liveApi, 0);
  safeConnect(p, node, 1, print, 0);
  safeConnect(p, poll, 0, liveApi, 0);
  safeConnect(p, liveApi, 0, node, 0);

  post("[ableton-rack-builder-safe] safe patch created. Start host first, then click start, then poll.\n");
}

function clearEverythingExceptAudioAndSelf(patcher) {
  var boxes = [];
  var self = this.box;

  patcher.apply(function(box) {
    var text = box && box.text ? String(box.text) : "";
    if (box === self || text === "plugin~" || text === "plugout~") {
      return;
    }
    boxes.push(box);
  });

  for (var i = 0; i < boxes.length; i += 1) {
    try {
      patcher.remove(boxes[i]);
    } catch (error) {
      post("[ableton-rack-builder-safe] remove failed: " + error + "\n");
    }
  }
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
    post("[ableton-rack-builder-safe] connect failed: " + error + "\n");
  }
}

function ignore(_) {
}

bang.local = 1;
loadbang.local = 1;
build.local = 1;
clearEverythingExceptAudioAndSelf.local = 1;

build();
