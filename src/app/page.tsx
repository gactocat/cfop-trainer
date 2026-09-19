import { redirect } from 'next/navigation';
import { Home } from '@/components/Home';

// The root path now always lands the user on the PLL practice surface.
// F2L lives at /f2l. Both share the header tabs.
export default function HomePage() {
  if (process.env.CAPACITOR_BUILD === '1') return <Home />;
  redirect('/pll');
}
