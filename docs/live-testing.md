# Live Testing With Ableton

This is the first real Ableton smoke test. It uses:

- `npm run harness:dev-live-host` as the Stream Deck plugin stand-in.
- a Max for Live Audio Effect with one `js` object and one `node.script` object.

## 1. Start The Local Host

Open PowerShell in the repo and run:

```powershell
npm run harness:dev-live-host
```

Leave it running.

## 2. Create The Max For Live Device

In Ableton Live:

1. Create or open a set.
2. Add an Audio Track.
3. Drop **Max Audio Effect** on the track.
4. Click the device edit button to open Max.
5. Add one object:

```text
js "S:/Coding Stuff/ableton-plugin/src/maxforlive/build-bridge-patch.js"
```

The builder creates the rest of the patch automatically. Turn on the created
toggle so the `metro 250` polls Ableton.

If you prefer to patch manually, add these objects:

```text
[loadbang]
[message script start]
[metro 250]
[toggle]
[js "S:/Coding Stuff/ableton-plugin/src/maxforlive/live-api-adapter.js"]
[node.script "S:/Coding Stuff/ableton-plugin/src/maxforlive/node-bridge.cjs"]
[route plugin_message_uri]
```

Wire them like this:

```text
[loadbang] -> [message script start] -> [node.script ...]
[toggle] -> [metro 250] -> [js ...]
[js ...] left outlet -> [node.script ...]
[node.script ...] left outlet -> [route plugin_message_uri]
[route plugin_message_uri] left outlet -> [js ...]
```

Turn on the toggle so the `metro 250` polls Ableton.

## 3. Select A Rack

In Ableton:

1. Put an Audio Effect Rack or Instrument Rack on any track.
2. Map one to eight Macros.
3. Click/select that Rack in Ableton's device area.

The PowerShell host should print feedback lines such as:

```text
[feedback:dial-0] on title="Macro 1" value="..."
```

## 4. Simulate Stream Deck Dial Input

In the PowerShell host, type:

```text
r 0 1
r 1 -2
b1
r 0 3
```

Expected result:

- `r 0 1` changes the first visible Macro.
- `b1` switches to Macros 5-8.
- `r 0 3` changes Macro 5.

## Notes

This proves Ableton Live API read/write plus protocol behavior. It is not yet the
final Stream Deck hardware plugin. The Stream Deck SDK wrapper is the next layer.
