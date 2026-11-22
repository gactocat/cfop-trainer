import type { Metadata } from 'next';
import { GanI4Spike } from './GanI4Spike';

// Served only by `next dev`: next.config.ts adds the `dev.tsx` page extension
// in the development phase, so production and Capacitor builds never see this
// route. A throwaway tool, so its text is not translated.
export const metadata: Metadata = {
  title: 'GAN i4 spike',
  robots: { index: false, follow: false },
};

export default function GanI4SpikePage() {
  return <GanI4Spike />;
}
