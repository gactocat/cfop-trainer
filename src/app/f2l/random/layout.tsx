import type { ReactNode } from 'react';
import { F2LRandomTrainer } from '@/components/F2LRandomTrainer';
import { PracticeShell } from '@/components/ScreenShells';

// Random practice of the F2L cases ticked in the list, kept as it is behind its
// session page (see KeptScreen).
export default function F2LRandomLayout({ children }: { children: ReactNode }) {
  return <PracticeShell scope="random" screen={<F2LRandomTrainer />}>{children}</PracticeShell>;
}
