import type { ReactNode } from 'react';
import { OLLRandomTrainer } from '@/components/OLLRandomTrainer';
import { PracticeShell } from '@/components/ScreenShells';

// Random practice of the OLLs ticked in the list, kept as it is behind its
// session page (see KeptScreen).
export default function OLLRandomLayout({ children }: { children: ReactNode }) {
  return <PracticeShell scope="random" screen={<OLLRandomTrainer />}>{children}</PracticeShell>;
}
