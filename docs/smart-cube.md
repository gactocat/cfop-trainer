# Smart cube

The app can connect a GAN smart cube that uses the Gen4 protocol (GAN i4,
GAN12 ui Maglev, GAN14, GAN16): over Web Bluetooth in Chrome and Edge on
desktop and Android, and through the Bluetooth plugin in the iOS app. iOS
browsers, Safari and Firefox have no Web Bluetooth; the settings panel says so
instead of offering a connection.

## Using it

Gear menu, Smart cube: connect, see battery and model, choose how the cube is
held, and enter the MAC address if Chrome cannot read it. The cube's data is
encrypted with its MAC; Chrome reads it from the cube's advertisements only
with `chrome://flags/#enable-experimental-web-platform-features`. A MAC that
works (the cube then reports a readable model name) is saved per device name
in localStorage under `cfop:smart-cube:v1`, together with the holding. It is
never part of the account document.

With a cube connected and the random trainer in inverse-setup mode, F2L, OLL
and PLL:

1. The setup must start from the practice's goal state: F2L solved (F2L),
   F2L solved and the last layer oriented (OLL), solved apart from a last-layer
   turn (PLL). Until then the start screen asks for it.
2. Each turn advances through the setup; turned tokens dim. A half-done step
   shows what is left, and wrong turns show the turns that take them back.
3. When the cube reaches the setup's state the screen turns blue (ready). The
   first turn after that starts the timer; ready to first turn is shown as
   recognition time.
4. The timer stops when the goal state is reached: F2L solved, last layer
   oriented, or solved apart from the final AUF. The time is the cube clock
   between the first and the last turn, so Bluetooth delivery delay does not
   count. Recording or discarding stays manual.

Tap and Space still start and stop the timer. Without a connected cube nothing
changes, and standard mode ignores the cube.

## iOS app

The app's WKWebView has no Web Bluetooth, so it uses
`@capacitor-community/bluetooth-le` (MIT, installed through SPM like the other
plugins). There is no browser dialog either: "Find cubes" scans for 15 seconds
and lists the cubes whose name starts with GAN; picking one connects it. The
MAC is read from the scan's manufacturer data (its last six bytes, reversed),
so it is usually not typed; when a cube does not include it, the panel asks for
it as in the browser. Once a connection works, the cube's CoreBluetooth
identifier and name are kept as `lastCube` in `cfop:smart-cube:v1`, and
"Connect <name>" connects it again without a scan. If iOS no longer knows that
identifier, or no MAC is remembered for it, it falls back to a scan.

The first scan shows iOS's Bluetooth permission prompt
(`NSBluetoothAlwaysUsageDescription`, English in `Info.plist`, both languages in
`en.lproj` / `ja.lproj/InfoPlist.strings`). When it is declined the panel
offers a link to the app's page in Settings; when Bluetooth is off it says so.
The simulator has no Bluetooth, so only builds can be checked there.

## No scramble

A third random-trainer mode, next to standard and inverse setup. The case is
built as a virtual cube (the trainer's setup applied to a solved cube, in the
chosen holding) and drawn with one persistent 3D player; the smart cube's
turns move the virtual cube, while the physical cube's own state (FACELETS)
is ignored. The first turn starts the timer and the same goals as inverse
mode stop it, on the cube clock; recognition is case shown to first turn on
the host clock, since the case appears on screen. "Back to the case" resets
the virtual cube, and abandons the attempt if it was being timed. Like the
case views, the player shows the hidden faces as floating stickers and greys
what the practice ignores (the last layer for F2L, all but its top colour for
OLL, nothing for PLL), using the masks of the F2L and OLL views built for the
holding's last layer.

The practice runs from the cube alone, so its screen is not the standard
mode's full-colour tap target. The virtual cube stays in one place; its frame
shows the state (green waiting, red timing, amber solved), with the timer or
the result beside it and this session's solves (count, mean, ao5, best and the
latest cases) in a panel. A solve is recorded as soon as the goal stops it,
Undo (or Escape) takes it back, and the next case comes once the cube has
been still for 1.5 seconds, so a final AUF or setting the cube down does not
start it; Next (or Space) skips the wait. Turning one face the same way four
times in a row (within 2.5 seconds) starts the case again, as "Back to the
case" does. Stopping by hand records the host-timed attempt the same way, and
leaving the iOS app abandons the attempt. The app keeps the screen on while a
cube is connected in this mode.

The choice is device-local (`noScramble` in `cfop:smart-cube:v1`) and layered
over the synced trainer mode, which keeps only standard and inverse, so older
app versions and other devices are unaffected. It is offered only where a cube can
connect; without a connected cube the trainer asks to connect one.
Recorded solves carry `mode: 'no-scramble'`.

## Recorded solves

The result screen of a cube-timed solve shows the turns in the chosen
holding's notation, the move count (consecutive turns of one face merged,
cancellations dropped), TPS and recognition time. Recording the time also
keeps that solve in IndexedDB (`cfop-smart-cube`, store `solves`) on this
device: turns with cube times, recognition, execution, move count, TPS, the
setup and the holding. Discarded attempts and hand-started timers are not
kept. Each case's page lists its solves, newest first, with delete buttons;
the settings panel shows the total and can delete everything. Beyond 2000
solves the oldest are removed. None of this touches the persistence layer:
the account document, its allow-list and the `RandomSolve` records are
unchanged, so older app versions are unaffected.

## Code

- `src/lib/smart-cube/gan-gen4.ts`, `aes128.ts`: Gen4 protocol, ported from
  smartcube-web-bluetooth (MIT, `LICENSE-smartcube-web-bluetooth.txt`).
- `gan-gen4-session.ts`: one connection's protocol work (encryption, driver,
  one write at a time, traffic log), shared by both transports.
- `gan-web-bluetooth.ts`: Web Bluetooth transport.
- `gan-native-bluetooth.ts`: the iOS app's transport over the Bluetooth plugin:
  scan, reconnect by identifier, connect. The store imports it only in the app,
  so web bundles do not include the plugin.
- `cube-state.ts`: cubie model in the cube's frame (white U, green F) and the
  goal checks.
- `holding.ts`: user frames. Yellow top with blue front (the app's 3D views,
  x2) is the default; yellow top with green front (z2) and white top are options.
- `setup-guide.ts`: plans a scramble as cube-frame face turns. The cube reports
  turns relative to its centres, so r = L x, M = R L' x' and so on, and
  rotations only change the frame.
- `trainer-session.ts`: the need-base, setup, ready, running, done state machine.
- `virtual-session.ts`: the no-scramble attempt (`useNoScrambleTrainer`,
  `NoScrambleStage`, `VirtualCube`).
- `support.ts`: why a cube cannot connect here, from the user agent (the iOS
  app always can).
- `src/lib/smart-cube-store.ts`: the connection. FACELETS events (about once a
  second) resync the tracked state when no turn is in flight; three seconds
  without any notification counts as a lost link.
- `src/hooks/useSmartCubeTrainer.ts`: connects a trainer to the session.
- `src/lib/smart-cube/solve-record.ts`, `src/lib/smart-solve-store.ts`: the
  recorded solve and its IndexedDB store; `SmartSolveHistory.tsx` lists them.

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube.mts
node --import ./scripts/register-src-alias.mjs scripts/verify-gan-gen4.mts [capture.json]
```

The first compares every F2L, OLL and PLL preset in all three holdings with
cubing.js. The second replays a recorded session (from `/dev/gan-i4`, which
remains a development-only page) and checks that the state tracked from the
turns matches every FACELETS event.
