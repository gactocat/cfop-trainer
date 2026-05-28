import { redirect } from 'next/navigation';

// /random was the standalone Random Trainer page; the trainer now lives on
// the PLL home page behind ?mode=random. Keep this route as a permanent
// redirect for any external bookmark.
export default function RandomLegacyPage(): never {
  redirect('/pll?mode=random');
}
