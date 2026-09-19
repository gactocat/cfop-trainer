import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNativeApp, nativeSessionStorage } from '@/lib/native';

export const isAuthConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!isAuthConfigured) return null;
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: isNativeApp() ? 'pkce' : 'implicit',
        detectSessionInUrl: !isNativeApp(), persistSession: true, autoRefreshToken: true,
        ...(isNativeApp() ? { storage: nativeSessionStorage } : {}),
      },
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
