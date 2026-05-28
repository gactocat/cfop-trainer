import { redirect } from 'next/navigation';

// The root path now always lands the user on the PLL practice surface.
// F2L lives at /f2l. Both share the header tabs.
export default function HomePage(): never {
  redirect('/pll');
}
