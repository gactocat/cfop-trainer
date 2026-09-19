import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Never package a previous export if the current build fails.
rmSync('out', { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, CAPACITOR_BUILD: '1', NEXT_PUBLIC_NATIVE_APP: '1' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
// Native assets ship in the app; a service worker must not retain old releases.
rmSync('out/sw.js', { force: true });
