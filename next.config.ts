import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

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
    ...(nativeApp ? {
      output: 'export',
      trailingSlash: true,
      images: { unoptimized: true },
    } : {}),
  };
}
