import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const isAuthConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!isAuthConfigured) return null;
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init, cache: 'no-store',
          signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
        }),
      },
    },
  );
  return client;
}
