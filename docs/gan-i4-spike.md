# GAN i4 Bluetooth spike

A development-only page for checking a GAN i4 smart cube over Web Bluetooth
before building the real feature. It lives on the local `spike/gan-i4` branch
and must not reach `main`.

## Run it

```sh
npm run dev
```

Open http://localhost:3000/dev/gan-i4 in Chrome or Edge on a desktop. The
route exists only under `next dev`: `next.config.ts` adds the `dev.tsx` page
extension in the development phase, so `npm run build` and the Capacitor
export never include `src/app/dev/gan-i4/page.dev.tsx`.

The cube's data is encrypted with a key derived from its MAC address. Either
type the MAC, or enable `chrome://flags/#enable-experimental-web-platform-features`
so the page can read it from the cube's advertisements. A MAC that worked is
remembered per device name in `localStorage`. On a Mac, the address shown by
`chrome://bluetooth-internals` is not the real one; connect the cube once and
look it up with `system_profiler SPBluetoothDataType`.

## What it shows

Battery, model and firmware, gyro rate and orientation, the cube state
(FACELETS), every move with its serial number and both clocks, serial gaps and
moves recovered from the cube's history, packets that failed validation, and
link drops. Markers label parts of a session. "Save log as JSON" downloads
everything, including the raw encrypted and decrypted packets.

The log is also written to IndexedDB about once a second, so reloading the
page restores it (the Bluetooth link itself ends with the page; choose the cube
again). The browser asks before leaving while a cube is connected or records
are not in a saved JSON. "Clear log" starts a new session. "Forget saved MAC"
removes remembered addresses so the next connection reads the MAC again.

## Files

- `src/lib/smart-cube/aes128.ts`: AES-128 block cipher.
- `src/lib/smart-cube/gan-gen4.ts`: Gen4 protocol, ported from
  [smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth)
  (MIT, see `LICENSE-smartcube-web-bluetooth.txt`). csTimer (GPL) is not used.
- `src/lib/smart-cube/gan-web-bluetooth.ts`: Web Bluetooth transport.
- `src/app/dev/gan-i4/`: the page, its session store and IndexedDB persistence.
- `scripts/verify-gan-gen4.mts`: checks without a cube.

## Verify without a cube

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-gan-gen4.mts [log.json]
```

It checks AES against FIPS-197 and Node's AES, runs the move-gap recovery on
synthetic packets, and, given a log (a smartcube-web-bluetooth capture or a
JSON saved from the page), replays its encrypted packets and compares the
decoded events with the ones recorded in it.
