# Smart cube

The app can connect a GAN smart cube that uses the Gen4 protocol (GAN i4,
GAN12 ui Maglev, GAN14, GAN16): over Web Bluetooth in Chrome and Edge on
desktop and Android, and through the Bluetooth plugin in the iOS app. iOS
browsers, Safari and Firefox have no Web Bluetooth; the settings panel says so
instead of offering a connection.

## Using it

Settings, Smart cube: connect, see battery and model, choose how the cube is
held, and enter the MAC address if Chrome cannot read it. The practice pages
(random practice and an algorithm's practice under its case) also offer
"Connect smart cube" on the case screen and in the practice's settings, and
show the connected cube with its battery; they open the dialog for the MAC
address and, in the iOS app, for the list of cubes.
The battery is drawn as a battery icon that fills by fifths (red at 20% or
less) with its level beside it (`BatteryLevel`), wherever it is shown. The cube's data is
encrypted with its MAC; Chrome reads it from the cube's advertisements only
with `chrome://flags/#enable-experimental-web-platform-features`. A MAC that
works (the cube then reports a readable model name) is saved per device name
in localStorage under `cfop:smart-cube:v1`, together with the holding. It is
never part of the account document.

Practice has two modes, no setup and with setup. A connected cube changes how
each runs: no setup becomes no scramble (below), and with setup, for F2L, OLL
and PLL:

1. The setup must start from the practice's goal state: F2L solved (F2L),
   F2L solved and the last layer oriented (OLL), solved apart from a last-layer
   turn (PLL). Until then the case screen asks for it.
2. Each turn advances through the setup; turned tokens dim. The rest of a
   half-done step shows on the 3D cube, which turns it part of the way; turns
   that take wrong ones back take the next token's place, in red, so no line
   comes and goes. What the cube needs first (step 1) and why it is not
   connected go in one line under the setup whose height is always kept.
3. When the cube reaches the setup's state the case is ready. The first
   turn after that starts the timer. When recognition is timed (see below),
   it counts under the cube from ready and ready to first turn is kept as
   recognition time.
4. The timer stops when the goal state is reached: F2L solved, last layer
   oriented, or solved apart from the final AUF. The time is the cube clock
   between the first and the last turn, so Bluetooth delivery delay does not
   count.

With setup and a cube connected (`smart-setup` in `lib/practice-mode.ts`),
the practice runs on the three screens every practice has
(`PracticeScreens`, built from the solve's parts): the case screen with the
guide over a 3D cube and the recognition under it once the case is ready,
the timer screen from the first turn with the cube small, and the result,
recorded as the goal stops it, with Undo, the same case again, Next and the
automatic next case as below (`useSmartSetupPractice`). Space still starts
and stops the timer by hand. Without a connected cube, with setup shows the
setup to apply by hand over the case it makes, and no setup is the hold
timer, the case appearing as it starts.

The 3D cube beside a setup (and on a CFOP solve's scramble and timer
screens) is the cube as it is: the smart cube's tracked state, held as the
guide has it at that point, so a wrong turn shows as made. On it, the next
move turns part of the way over and over (a rest, the move to about 45° for
a quarter turn or 135° for a half turn, eased in and out, a rest, back): far
enough to show the layer and the way, without looking like a cube already
turned. A turn made on the cube is played to its end on the 3D cube, from
the angle its hint had reached when it was that move (a quarter after a
half-turn hint past 90° is there at once), then the next hint starts; a turn
that comes while one plays cuts it short, so fast turning never falls
behind. The turn is found from the states before and after (`turnBetween`);
a resync or turns that came together jump to the new state. The move shown:
the next step as the
setup writes it ("R2", "l'", "M", a group's next move), with any rotation
before it shortened to the one it adds up to ("y2 y2 z" shows as "z"), and
for the last step the rotations after it; the second half of a half turn,
slice or wide turn begun; or, after wrong turns, taking back the last one.
Once the setup is done the cube shows the case and the solving turns, as
before. `guide-cube.ts` hands the state to cubing.js (its piece order differs;
twists count the same way), picks the move and works out the angles
(cubing.js eases a move with smootherstep, so `moveTimeAt` turns an angle
into a time in the move); `VirtualCube` sets the state as the player's
starting state and drives its timeline.

Both cube-driven practices keep this session's solves in one log
(`lib/practice-log.ts`) and show them per case, most recently solved first:
recognition and solving, each as a mean and a best (`lib/session-stats.ts`).
Undone solves do not count. The recognition column is there only when some
solve of the session has a recognition time; a solve without one (started
by hand) shows "-" in it.

Recognition is timed apart from the solve only on a smart cube, and only
when "Measure recognition time" is on (`measureRecognition` in the synced
practice settings, off by default and written only when on, so older
versions drop it and see it off; `timesRecognition` in
`lib/practice-mode.ts`). It is ready to first turn, as above. The switch is
in the practice's settings while a cube is connected, as "Next case by
itself" is; without one it is not shown and the choice is kept for when a
cube connects, and practice without a cube times the case as a whole, as
before. A cube lost mid-attempt keeps that attempt on the cube, recognition
included; the next case is timed without it. Off, nothing shows or keeps a
recognition time, a cube's record of the solve included.

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

## Disconnecting

A GAN cube does not advertise while it is linked, so no other app can find it
until the link itself is gone. Disconnect (in the smart cube dialog and the
practice settings) and every other end of a connection (a lost or silent link,
a wrong MAC, the test cube taking over) stop notifications first, waiting a
second at most as other GAN clients do, and then disconnect: `gatt.disconnect()`
in the browser, the plugin's disconnect (CoreBluetooth's
`cancelPeripheralConnection`) in the app. Connecting again waits for that, so
it cannot end the new link. Nothing reconnects by itself.

In the browser, closing or reloading the page ends the link too: Chrome ties
it to the page and keeps pages that use Bluetooth out of the back/forward
cache. In the iOS app the Bluetooth plugin outlives the page. When iOS ends
the web view's process (in the background, for one) Capacitor loads the page
again with the link still up, which the new page knows nothing of. So the app
disconnects cubes the plugin still holds for an earlier page when it starts
(`releaseLeftoverCubes`); on a fresh launch Bluetooth is not set up yet, so
this shows no permission prompt. A cube stays connected while the app is in
the background.

## No scramble

No setup with a cube connected. The case is
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

The practice runs from the cube alone on the same three screens: the virtual
cube large on the case screen, with the recognition counting under it (the
case is only on the screen, so it stays large until the first turn); small
under the timer once it runs, with "Back to the case"; kept mounted (one
WebGL context) on the result. This session's figures are a page under the
practice (/pll/random/session, /pll/T/practice/session?alg=<id>), from an
icon in the header; the practice is the route's layout (`KeptScreen`), which
also keeps the session's log, so going there and back keeps the case and the
session. The log is in memory only: leaving the practice ends it. A solve is recorded as soon as the goal stops it
and Undo (or Escape) takes it back. Next (or Space) brings the next case
(versions before could also bring it by itself once the cube had rested,
`autoAdvance`; that is gone, and a stored value is ignored). Turning one face the same way four
times in a row (within 2.5 seconds) starts the case again, as "Back to the
case" does. Stopping by hand records the host-timed attempt the same way, and
leaving the iOS app abandons the attempt. The app keeps the screen on while a
cube is connected in this mode.

A practice's settings, behind the gear on its case screen, are the smart
cube, its mode (setup on or off), the AUF (pre-applied: turned by the
algorithm's AUF so it can start at once; in algorithm: not turned, so the AUF
is part of the solve; or random), with a cube whether recognition is timed,
and for random practice each selected case once. The page starts on a case at
once; a change takes effect with the next case (at once while a case waits). The AUF choice does not depend on the list's AUF display, which only
changes how the solution is written (see `lib/auf-start.ts`). It is stored as
`randomAuf` and `alignAuf`; neither flag, once "as set", reads as in
algorithm.
The mode is stored in the synced trainer mode with the values older app
versions know: no setup as `standard`, with setup as `inverse`. The three-mode
version kept no scramble as a device-local `noScramble` flag in
`cfop:smart-cube:v1`; it reads as no setup and is cleared once a mode is
chosen (`src/lib/practice-mode.ts`). How the
practice runs follows the settings and the cube while a case waits, and is
kept from the start of an attempt to the next case (`usePracticeFlavor`), so
a cube lost mid-attempt leaves it on the cube, where a press still stops it,
rather than switching to the tap timer.
Recorded solves carry `mode: 'no-scramble'`.

## Mark as solved

The cube keeps its own state and reports it on request and about once a
second; the app resyncs to that report whenever no turn is in flight. When the
screen no longer matches the cube in hand (a turn the cube missed, or one made
while it slept), the smart cube dialog's "Mark as solved" is pressed with
the cube solved. It sends the protocol's reset (`REQUEST_RESET`, as
smartcube-web-bluetooth does) so the cube's own state is solved too, sets the
tracked state to solved at once, and asks for a report.
For two seconds only a solved report counts, so one sent before the reset
cannot bring the old state back (`lib/smart-cube/state-sync.ts`). A guided
setup starts again from solved; the solve page's scramble guide routes again
from it. Practice without a setup does not use the cube's state.

The dialog is the button's only place for a real cube; the screens that show
a connected cube (the practice's battery, the solve page's battery) open the
dialog rather than repeating it. The test cube's panel keeps one, for trying
the reset without a cube.

## Test cube

For trying the smart cube screens without a cube (on cfop.app and in the iOS
app too), the smart cube dialog ends with a "Test cube" row and its Connect button. The
test cube (`lib/smart-cube/test-cube.ts`) stands where the Bluetooth stack
would: it answers the session's encrypted commands and sends encrypted
notifications (turns with its own clock, state reports, battery, a hardware
report that is not GAN's, so no MAC is remembered), so everything from the
protocol driver on runs as with a real cube, the reset of "Mark as solved"
included. Connecting a real cube drops it, and the other way round.

While it is connected, a panel over every page (`components/TestCubePanel.tsx`,
`lib/test-cube-store.ts`) turns it: buttons for the outer faces, M and the
rotations; keys in the layout common to virtual cubes (I/K R, J/F U, H/G F,
D/E L, S/L D, W/O B, U/M r, V/R l, 5,6/X,. M, T,Y/B,N x, ;/A y, P/Q z) except
while typing; a box that runs moves one at a time at a chosen interval; and
the moves the screen offers in one tap (`lib/test-cube-hints.ts`): the rest
of a guided setup or scramble, taken from the guide's own plan so rotations
and groups are followed exactly, the case's solution, the scramble backwards.
It makes a slice the way a cube reports one (`stepTurns`): both faces of
each quarter, the second 12 ms after the first, M2 as L R' then R' L from
yellow on top; a key or button sends both at once.
Moves are read like a setup (`planSetup`), from the holding and any rotation
made since. Pages and the practice screen leave room at the bottom for the
panel; it folds to a small tab.

## Recorded solves

The result screen of a cube-timed solve shows the move count, TPS and (when
timed) recognition time; the case page's list shows the turns too, in the
chosen holding's notation.

Turns are read as moves (`lib/smart-cube/slice-moves.ts`). The cube reports
outer faces only, relative to its centres, so a slice arrives as its two
outer faces turning the same way about their axis: M as R and L', M' as R'
and L, E as U and D', S as F' and B, in either order. Both faces turn
against the centres in one motion, so they should come within a few
milliseconds (no recording of a slice on an i4 was at hand; in one of T perms,
turns made one after the other came 37 ms apart at the closest). An M2 comes
as two such quarters and was seen recorded as "L R2 L" (L R' then R' L from
yellow on top). Two quarter turns of opposite faces like that within 60 ms
(`SLICE_WINDOW_MS`, cube clock) with no turn on another axis between them
are one slice quarter; the closest pairs are taken first. Consecutive turns
of one face merge (R R is R2, R R' nothing), and so do slices on one axis. A slice moves the
centres, so the turns after it are read in the frame it leaves: after M, the
face the cube reports where U was is still U. Rotations are never reported and
change nothing. What cannot be told apart: R and L' really turned at once
read as M (and the turns after it as held after M); a wide turn reports only
its opposite face (r as L) and leaves the frame as it was, so in algorithms
that mix wide turns and slices (r U R' U' M ...) the turns after the wide one
read turned.

The move count is the moves as read: a face, slice or wide turn is one,
rotations none, as `countMoves` counts an algorithm (`lib/move-count.ts`), so
the TPS of a tap-timed solve and a cube-timed one use the same count. Records
keep their turns; the screens read them again, so solves recorded before
slices were read (their stored `moveCount` counts a slice as two) show
slices too. The live 3D cube shows each quarter as it comes and turns a
quarter into its slice once the other face arrives. In an algorithm's practice
on its case page, recording the time also keeps that solve in IndexedDB
(`cfop-smart-cube`, store `solves`) on this device (random practice keeps its
solves for the session only and saves none): turns with cube times, recognition, execution, move count, TPS, the
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
- `holding.ts`: user frames. A practice's holding is a top colour, the last
  layer (yellow or white), and any side colour in front, chosen in the smart
  cube dialog with the same colour squares as the solve's scramble
  orientation. Yellow top with blue front (the app's 3D views, x2) is the
  default. Versions before kept three holdings (yellow-blue, yellow-green,
  white-green) and read the others as the default.
- `setup-guide.ts`: plans a scramble as cube-frame face turns. The cube reports
  turns relative to its centres, so r = L x, M = R L' x' and so on, and
  rotations only change the frame.
- `trainer-session.ts`: the need-base, setup, ready, running, done state machine.
- `guide-cube.ts`: the 3D guide cube: the state for cubing.js and the next move.
- `virtual-session.ts`: the no-scramble attempt (`useNoScrambleTrainer`,
  `PracticeScreens`, `VirtualCube`).
- `support.ts`: why a cube cannot connect here, from the user agent (the iOS
  app always can).
- `src/lib/smart-cube-store.ts`: the connection. FACELETS events (about once a
  second) resync the tracked state when no turn is in flight; three seconds
  without any notification counts as a lost link.
- `src/hooks/useSmartCubeTrainer.ts`: connects a trainer to the session.
- `src/lib/smart-cube/slice-moves.ts`: reported turns read as moves, slices
  and the frame they leave included (see Recorded solves).
- `src/lib/smart-cube/solve-record.ts`, `src/lib/smart-solve-store.ts`: the
  recorded solve and its IndexedDB store; `SmartSolveHistory.tsx` lists them.

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube.mts
node --import ./scripts/register-src-alias.mjs scripts/verify-gan-gen4.mts [capture.json]
node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube-link.mts
```

The first compares every F2L, OLL and PLL preset in every holding with
cubing.js, and checks the 3D guide against it: every next move it shows,
through every preset and trainer setup, turns the cube shown into the cube
shown after it. The second replays a recorded session (from `/dev/gan-i4`, which
remains a development-only page) and checks that the state tracked from the
turns matches every FACELETS event. The third connects and disconnects
through the real store and both transports over stand-in Bluetooth stacks
(`scripts/fakes/`, a test cube behind Web Bluetooth and behind the plugin's
calls) and checks that each end of a connection ends the link, in order, and
that nothing reconnects or keeps running afterwards.
