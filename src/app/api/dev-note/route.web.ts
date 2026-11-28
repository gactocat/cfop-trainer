// Passes a saved developer note on to the developers' webhook; see
// lib/dev-mode/dev-note-webhook.ts. The `.web.ts` extension keeps it out of
// the iOS static export (see next.config.ts): the app calls the website's.

import { createDevNoteHandler } from '@/lib/dev-mode/dev-note-webhook';

export const dynamic = 'force-dynamic';

const handler = () => createDevNoteHandler({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  webhookUrl: process.env.DEV_NOTE_WEBHOOK_URL,
  webhookSecret: process.env.DEV_NOTE_WEBHOOK_SECRET,
});

export function POST(request: Request) { return handler()(request); }
export function OPTIONS(request: Request) { return handler()(request); }
