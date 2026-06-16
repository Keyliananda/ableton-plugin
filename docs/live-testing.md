# Live Testing With Ableton

This is the first real Ableton smoke test. It uses:

- `node .\dist\src\harness\dev-live-host.js` as the Stream Deck plugin stand-in.
- a Max for Live Audio Effect with one `js` object and one `node.script` object.

## 1. Sync The Max Runtime Files

Max loads the JavaScript files from a stable folder without spaces in the path:

```text
S:/AbletonRackBridge
```

After changing any file in `src/maxforlive`, sync the runtime copies before
reloading the Max device:

```powershell
npm run maxforlive:sync
```

The sync copies the Max patch builder, `live-api-adapter.js`,
`node-bridge-safe.js`, and `node-smoke.js`, then makes `node_modules` available
in the Max runtime folder.

## 2. Start The Local Host

Open PowerShell in the repo and run:

```powershell
node .\dist\src\harness\dev-live-host.js
```

If your PowerShell execution policy allows `npm.ps1`, this equivalent command
also works:

```powershell
npm run harness:dev-live-host
```

Leave it running.

## 3. Create The Max For Live Device

In Ableton Live:

1. Create or open a set.
2. Add an Audio Track.
3. Drop **Max Audio Effect** on the track.
4. Click the device edit button to open Max.
5. Add one object:

```text
js S:/AbletonRackBridge/build-bridge-patch-v5.js
```

The builder creates the rest of the patch automatically. It uses a manual
`bang` refresh instead of a continuous metro, which keeps Ableton responsive.

If you prefer to patch manually, add these objects:

```text
[loadbang]
[message script start]
[message bang]
[js S:/AbletonRackBridge/live-api-adapter.js]
[node.script S:/AbletonRackBridge/node-bridge-safe.js]
```

Wire them like this:

```text
[loadbang] -> [message script start] -> [node.script ...]
[message bang] -> [js ...]
[js ...] left outlet -> [node.script ...]
[node.script ...] left outlet -> [js ...]
```

Click `script start`, select the Rack in Ableton, then click `bang` once to
send the current mapping to the host. The bridge polls again after each
successful dial write.

After the bridge is connected, the dev host can also request that same selected
Rack refresh from the console with:

```text
refresh
```

The real Stream Deck plugin also provides a **Refresh Rack** keypad action.
Place it on a key and press it to request the selected Rack mapping from Max for
Live without clicking the Max `bang` button.

The plugin also requests a refresh automatically when the Max bridge connects,
so the button is mainly a manual fallback after changing the selected Rack.

## 4. Select A Rack

In Ableton:

1. Put an Audio Effect Rack or Instrument Rack on any track.
2. Map one to eight Macros.
3. Click/select that Rack in Ableton's device area.

The PowerShell host should print feedback lines such as:

```text
[feedback:dial-0] on title="Macro 1" value="..."
```

## 5. Simulate Stream Deck Dial Input

In the PowerShell host, type:

```text
state
refresh
r 0 1
r 1 -2
b1
r 0 3
```

Expected result:

- `refresh` asks Max for Live to resend the currently selected Rack mapping.
- `r 0 1` changes the first visible Macro.
- `b1` switches to Macros 5-8.
- `r 0 3` changes Macro 5.

## Notes

This proves Ableton Live API read/write plus protocol behavior. It is not yet the
final Stream Deck hardware plugin. The Stream Deck SDK wrapper is the next layer.
