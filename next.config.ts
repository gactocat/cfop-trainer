import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The commit the app is built from, for developer mode's notes: Vercel's,
// else the checkout's (iOS builds), marked under `next dev`, whose code may
// differ from it.
function appVersion(phase: string): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { sha = 'unknown'; }
  }
  return phase === PHASE_DEVELOPMENT_SERVER ? `${sha}-dev` : sha;
}

export default function nextConfig(phase: string): NextConfig {
  const nativeApp = process.env.CAPACITOR_BUILD === '1';
  return {
    // Files with an extra extension exist only in some builds; the others
    // ignore them. `page.dev.tsx` (development tools such as /dev/gan-i4) is
    // only under `next dev`. `route.web.ts` (server routes such as
    // /api/supabase-keepalive) is left out of the iOS static export, which
    // cannot run a server.
    pageExtensions: [
      ...(phase === PHASE_DEVELOPMENT_SERVER ? ['dev.tsx'] : []),
      ...(nativeApp ? [] : ['web.ts']),
      'tsx', 'ts', 'jsx', 'js',
    ],
    env: { NEXT_PUBLIC_APP_VERSION: appVersion(phase) },
    ...(nativeApp ? {
      output: 'export',
      trailingSlash: true,
      images: { unoptimized: true },
    } : {}),
  };
}
