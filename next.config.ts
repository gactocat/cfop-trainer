import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // `page.dev.tsx` routes (development tools such as /dev/gan-i4) exist only
    // under `next dev`; builds use the default extensions and skip them.
    ...(phase === PHASE_DEVELOPMENT_SERVER ? {
      pageExtensions: ['dev.tsx', 'tsx', 'ts', 'jsx', 'js'],
    } : {}),
    ...(process.env.CAPACITOR_BUILD === '1' ? {
      output: 'export',
      trailingSlash: true,
      images: { unoptimized: true },
    } : {}),
  };
}
