import { redirect } from 'next/navigation';

// /random was the standalone Random Trainer page; random PLL practice is
// now /pll/random. Keep this route as a permanent redirect for any
// external bookmark.
export default function RandomLegacyPage(): never {
  redirect('/pll/random');
}
