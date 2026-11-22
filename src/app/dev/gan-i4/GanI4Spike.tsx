'use client';

// Development-only page for checking a GAN i4 over Web Bluetooth. It is not
// part of the product, so its text is not translated (see page.dev.tsx).

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { SOLVED_FACELETS } from '@/lib/smart-cube/gan-gen4';
import { webBluetoothSupport } from '@/lib/smart-cube/gan-web-bluetooth';
import * as session from './spike-session';

// Covers all six faces, with quarter and half turns.
const SETUP = "D2 F' L U2 B R' D L2 F U' R2 B'";
const PRESET_MARKERS = ['T-perm normal', 'T-perm fast', 'Setup', 'Idle 5 min'];
const MOVE_ROWS = 200;

// The cube names faces by their centre in its own frame (white U, green F).
// Holding yellow on top with green in front is a z2 rotation of that frame.
const YELLOW_TOP: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' };
const toYellowTop = (move: string) => YELLOW_TOP[move[0]] + move.slice(1);

const FACE_COLOURS: Record<string, string> = {
  U: 'bg-white', R: 'bg-red-600', F: 'bg-green-600', D: 'bg-yellow-300', L: 'bg-orange-500', B: 'bg-blue-600',
};

const button =
  'rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none';
const primaryButton =
  'rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-right break-all">{children}</span>
    </div>
  );
}

const seconds = (ms: number | null) => (ms === null ? '-' : (ms / 1000).toFixed(3));
const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function FaceletNet({ facelets }: { facelets: string }) {
  const face = (index: number) => (
    <div className="grid grid-cols-3 gap-px">
      {Array.from(facelets.slice(index * 9, index * 9 + 9), (f, i) => (
        <div key={i} className={`h-4 w-4 rounded-sm border border-zinc-400 dark:border-zinc-600 ${FACE_COLOURS[f] ?? 'bg-zinc-500'}`} />
      ))}
    </div>
  );
  // Kociemba order URFDLB laid out as a cross: U above F, D below, L F R B in a row.
  return (
    <div className="grid w-max grid-cols-4 gap-1">
      <div />{face(0)}<div /><div />
      {face(4)}{face(2)}{face(1)}{face(5)}
      <div />{face(3)}<div /><div />
    </div>
  );
}

type SetupProgress = { matched: number; state: 'waiting' | 'in-progress' | 'done' | 'extra' | 'mismatch' };

// Compare received quarter turns with the setup; a half turn matches X X or X' X'.
function setupProgress(expected: string[], received: string[]): SetupProgress {
  let j = 0;
  for (let i = 0; i < expected.length; i++) {
    const token = expected[i];
    const face = token[0];
    if (token.endsWith('2')) {
      const [a, b] = [received[j], received[j + 1]];
      if (a === undefined) return { matched: i, state: i === 0 ? 'waiting' : 'in-progress' };
      if (a !== face && a !== `${face}'`) return { matched: i, state: 'mismatch' };
      if (b === undefined) return { matched: i, state: 'in-progress' };
      if (b !== a) return { matched: i, state: 'mismatch' };
      j += 2;
    } else {
      if (received[j] === undefined) return { matched: i, state: i === 0 ? 'waiting' : 'in-progress' };
      if (received[j] !== token) return { matched: i, state: 'mismatch' };
      j += 1;
    }
  }
  return { matched: expected.length, state: j < received.length ? 'extra' : 'done' };
}

function download() {
  const s = session.getSnapshot();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const blob = new Blob([session.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gan-i4-${(s.deviceName ?? 'cube').replace(/[^\w-]/g, '_')}-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GanI4Spike() {
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const mounted = useMounted();
  const support = mounted ? webBluetoothSupport() : null;
  const [macInput, setMacInput] = useState('');
  const [markerInput, setMarkerInput] = useState('');

  const connected = s.status === 'connected';
  const busy = !s.ready || s.status === 'choosing' || s.status === 'reading-mac' || s.status === 'connecting';
  const canContinue = (s.status === 'needs-mac' || s.status === 'disconnected' || s.status === 'error') && session.hasChosenDevice();

  const setupMarker = [...s.markers].reverse().find((m) => m.label === 'Setup');
  const setupReceived = setupMarker ? s.moves.slice(setupMarker.moveIndex).map((m) => m.move) : [];
  const setupTokens = SETUP.split(' ');
  const progress = setupMarker ? setupProgress(setupTokens, setupReceived) : null;

  const markerAt = new Map(s.markers.map((m) => [m.moveIndex, m.label]));
  const rows = s.moves.slice(-MOVE_ROWS).reverse();
  const failedEntries = Object.entries(s.failedTypes).sort(([, a], [, b]) => b - a);
  const failedTypes = failedEntries.slice(0, 5).map(([k, v]) => `${k}×${v}`).join(', ') + (failedEntries.length > 5 ? ', …' : '');
  const validRatio = s.notifications > 0 ? (s.notifications - s.failedValidation) / s.notifications : 1;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold">GAN i4 Bluetooth spike</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Development only (next dev). Not part of production builds. Use Chrome or Edge on desktop.
        </p>
      </div>

      <Card title="Browser">
        <Row label="Secure context (https or localhost)">{support ? (support.secureContext ? 'yes' : 'no') : '…'}</Row>
        <Row label="Web Bluetooth">{support ? (support.bluetooth ? 'yes' : 'no') : '…'}</Row>
        <Row label="Read MAC from advertisements (Chrome flag)">{support ? (support.watchAdvertisements ? 'yes' : 'no, type the MAC') : '…'}</Row>
      </Card>

      <Card title="Connection">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">MAC address (optional if read automatically or saved)</span>
            <input
              value={macInput}
              onChange={(e) => setMacInput(e.target.value)}
              placeholder="AB:12:CD:34:EF:56"
              spellCheck={false}
              className="w-56 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 font-mono text-sm"
            />
          </label>
          <button type="button" className={primaryButton} disabled={busy || connected} onClick={() => void session.connect(macInput)}>
            Choose cube and connect
          </button>
          <button type="button" className={button} disabled={busy || !canContinue} onClick={() => void session.continueWithMac(macInput)}>
            {s.status === 'needs-mac' ? 'Continue with this MAC' : 'Reconnect same cube'}
          </button>
          <button type="button" className={button} disabled={!connected} onClick={session.disconnect}>Disconnect</button>
          <button type="button" className={button} disabled={busy} onClick={session.forgetSavedMacs}>Forget saved MAC</button>
        </div>
        <div className="mt-3">
          <Row label="Status">{s.status}</Row>
          {s.message && <p className="my-1 rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-sm text-amber-800 dark:text-amber-200">{s.message}</p>}
          <Row label="Device">{s.deviceName ?? '-'}</Row>
          <Row label="MAC">{s.mac ? `${s.mac} (${s.macSource})` : '-'}</Row>
          <Row label="Connected for">{s.connectedAt !== null ? clock(s.now - s.connectedAt) : '-'}</Row>
          <Row label="Last notification">{s.lastNotificationAt !== null ? `${seconds(s.now - s.lastNotificationAt)} s ago` : '-'}</Row>
          <Row label="Connections / drops">{`${s.connections} / ${s.disconnects.length}`}</Row>
          {s.disconnects.map((d, i) => (
            <Row key={i} label={`Drop ${i + 1}`}>{`${d.connectedMs === null ? '-' : clock(d.connectedMs)} after connecting: ${d.reason}`}</Row>
          ))}
          {s.notifications >= 10 && validRatio < 0.5 && (
            <p className="my-1 rounded bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-sm text-rose-800 dark:text-rose-200">
              Most packets fail validation: the MAC is probably wrong.
            </p>
          )}
        </div>
      </Card>

      <Card title="Commands">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!connected} onClick={() => void session.command('REQUEST_FACELETS')}>Request facelets</button>
          <button type="button" className={button} disabled={!connected} onClick={() => void session.command('REQUEST_BATTERY')}>Request battery</button>
          <button type="button" className={button} disabled={!connected} onClick={() => void session.command('REQUEST_HARDWARE')}>Request hardware</button>
          <button type="button" className={button} disabled={!connected} onClick={() => void session.command('REQUEST_RESET')}>Mark cube as solved</button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Mark cube as solved resets the cube&apos;s own state; use it only while the physical cube is solved.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Battery and hardware">
          <Row label="Battery">{s.battery ? `${s.battery.level}%` : '-'}</Row>
          <Row label="Model">{s.hardware?.hardwareName ?? '-'}</Row>
          <Row label="Firmware">{s.hardware?.softwareVersion ?? '-'}</Row>
          <Row label="Hardware">{s.hardware?.hardwareVersion ?? '-'}</Row>
          <Row label="Product date">{s.hardware?.productDate ?? '-'}</Row>
          <Row label="Gyro reported">{s.hardware ? String(s.hardware.gyroSupported) : '-'}</Row>
        </Card>
        <Card title="Gyro">
          <Row label="Events">{s.gyroCount}</Row>
          <Row label="Rate">{`${s.gyroHz.toFixed(1)} Hz`}</Row>
          <Row label="Quaternion w x y z">
            {s.gyro ? [s.gyro.quaternion.w, s.gyro.quaternion.x, s.gyro.quaternion.y, s.gyro.quaternion.z].map((v) => v.toFixed(3)).join(' ') : '-'}
          </Row>
          <Row label="Velocity x y z">{s.gyro ? `${s.gyro.velocity.x} ${s.gyro.velocity.y} ${s.gyro.velocity.z}` : '-'}</Row>
        </Card>
        <Card title="Counters">
          <Row label="Moves delivered">{s.moves.length}</Row>
          <Row label="Serial gaps in delivered moves">{s.serialGaps}</Row>
          <Row label="Recovered from history">{s.recoveredMoves}</Row>
          <Row label="Gaps detected on arrival">{s.driverStats?.gapsDetected ?? 0}</Row>
          <Row label="History requests">{s.driverStats?.historyRequests ?? 0}</Row>
          <Row label="Duplicates dropped">{s.driverStats?.duplicateMoves ?? 0}</Row>
          <Row label="Gaps given up">{s.driverStats?.overflowFlushes ?? 0}</Row>
          <Row label="Notifications">{s.notifications}</Row>
          <Row label="Failed validation">
            {`${s.failedValidation}${failedTypes ? ` (${failedTypes})` : ''}`}
          </Row>
          <Row label="Writes / errors">{`${s.writes} / ${s.writeErrors}`}</Row>
        </Card>
      </div>

      <Card title="Cube state (FACELETS)">
        {s.facelets ? (
          <div className="flex flex-wrap items-start gap-6">
            <FaceletNet facelets={s.facelets.facelets} />
            <div className="min-w-0 flex-1">
              <Row label="Solved">{s.facelets.facelets === SOLVED_FACELETS ? 'yes' : 'no'}</Row>
              <Row label="Serial">{s.facelets.serial}</Row>
              <Row label="Received">{`${s.faceletsCount} times, last ${seconds(s.now - s.facelets.t)} s ago`}</Row>
              <p className="mt-1 font-mono text-xs break-all text-zinc-500 dark:text-zinc-400">{s.facelets.facelets}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No FACELETS event yet. Moves are ignored until the first one arrives.</p>
        )}
      </Card>

      <Card title="Markers">
        <div className="flex flex-wrap gap-2">
          {PRESET_MARKERS.map((label) => (
            <button key={label} type="button" className={button} onClick={() => session.addMarker(label)}>{label}</button>
          ))}
          <input
            value={markerInput}
            onChange={(e) => setMarkerInput(e.target.value)}
            placeholder="Custom marker"
            className="w-44 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button type="button" className={button} onClick={() => { session.addMarker(markerInput); setMarkerInput(''); }}>Add marker</button>
        </div>
        {s.markers.length > 0 && (
          <ul className="mt-2 text-sm">
            {s.markers.map((m, i) => (
              <li key={i} className="font-mono">{`${seconds(m.t)} s  #${m.moveIndex}  ${m.label}`}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Setup check">
        <p className="text-sm">
          Hold the cube with white on top and green in front, press the Setup marker, then turn:
        </p>
        <p className="my-2 font-mono text-lg">
          {setupTokens.map((token, i) => (
            <span
              key={i}
              className={`mr-2 ${progress && i < progress.matched ? 'text-emerald-600 dark:text-emerald-400' : ''} ${progress?.state === 'mismatch' && i === progress.matched ? 'text-rose-600 dark:text-rose-400 underline' : ''}`}
            >
              {token}
            </span>
          ))}
        </p>
        <Row label="Status">{progress ? `${progress.state} (${progress.matched}/${setupTokens.length})` : 'press the Setup marker to start'}</Row>
        <Row label="Received since marker">{setupReceived.join(' ') || '-'}</Row>
      </Card>

      <Card title={`Moves (latest ${MOVE_ROWS}, newest first)`}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 pr-3">#</th>
                <th className="pr-3">Move</th>
                <th className="pr-3">Yellow top</th>
                <th className="pr-3">Serial</th>
                <th className="pr-3">Cube ms</th>
                <th className="pr-3">Δ cube</th>
                <th className="pr-3">Host s</th>
                <th className="pr-3">Δ host</th>
                <th className="pr-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const prev = s.moves[m.index - 1];
                const dCube = prev && m.cubeTimestamp !== null && prev.cubeTimestamp !== null ? m.cubeTimestamp - prev.cubeTimestamp : null;
                const dHost = prev && m.localTimestamp !== null && prev.localTimestamp !== null ? m.localTimestamp - prev.localTimestamp : null;
                const notes = [
                  m.localTimestamp === null ? 'recovered' : '',
                  m.serialGap ? 'serial gap' : '',
                  markerAt.has(m.index) ? `after "${markerAt.get(m.index)}"` : '',
                ].filter(Boolean).join(', ');
                return (
                  <tr key={m.index} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-0.5 pr-3">{m.index}</td>
                    <td className="pr-3 font-semibold">{m.move}</td>
                    <td className="pr-3">{toYellowTop(m.move)}</td>
                    <td className="pr-3">{m.serial}</td>
                    <td className="pr-3">{m.cubeTimestamp ?? '-'}</td>
                    <td className="pr-3">{dCube ?? '-'}</td>
                    <td className="pr-3">{seconds(m.localTimestamp)}</td>
                    <td className="pr-3">{dHost === null ? '-' : Math.round(dHost)}</td>
                    <td className="pr-3 text-amber-700 dark:text-amber-300">{notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">No moves yet.</p>}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={!s.ready} onClick={download}>Save log as JSON</button>
        <button type="button" className={button} disabled={!s.ready} onClick={() => { if (window.confirm('Clear the recorded log?')) session.clearLog(); }}>Clear log</button>
        <span className="self-center text-sm text-zinc-500 dark:text-zinc-400">
          {`${s.recordCount} records kept across reloads, ${s.unsavedRecords} not in a saved JSON${s.exportedAt ? ` (last saved ${new Date(s.exportedAt).toLocaleTimeString()})` : ''}`}
        </span>
        {s.persistError && (
          <p className="w-full rounded bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-sm text-rose-800 dark:text-rose-200">{`Not kept across reloads: ${s.persistError}`}</p>
        )}
      </div>
    </div>
  );
}
