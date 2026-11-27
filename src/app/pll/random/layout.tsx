import type { ReactNode } from 'react';
import { RandomTrainer } from '@/components/RandomTrainer';
import { PracticeShell } from '@/components/ScreenShells';

// Random practice of the PLLs ticked in the list, kept as it is behind its
// session page (see KeptScreen).
export default function PllRandomLayout({ children }: { children: ReactNode }) {
  return <PracticeShell scope="random" screen={<RandomTrainer />}>{children}</PracticeShell>;
}
