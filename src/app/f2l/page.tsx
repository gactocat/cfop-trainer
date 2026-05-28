import { Suspense } from 'react';
import { F2LHome } from '@/components/F2LHome';

export default function F2LHomePage() {
  return (
    <Suspense fallback={null}>
      <F2LHome />
    </Suspense>
  );
}
