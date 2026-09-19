import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { openAccountDialog } from '@/lib/app-dialog';
import { reportAccountLinkError } from '@/lib/account-session';
import { flushAccount, setStorageOnline } from '@/lib/persistence';
import { getSupabase } from '@/lib/supabase';
import { NATIVE_AUTH_REDIRECT } from '@/lib/native';

let started = false;
let lastCode: string | null = null;
let pendingCode: string | null = null;

async function receiveUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { return; }
  if (url.username || url.password) return;
  if (`${url.protocol}//${url.host}${url.pathname}` !== NATIVE_AUTH_REDIRECT) return;
  openAccountDialog();
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096 || url.searchParams.has('error')) {
    reportAccountLinkError();
    return;
  }
  if (code === lastCode || code === pendingCode) return;
  pendingCode = code;
  try {
    const client = getSupabase();
    if (!client) throw new Error('Authentication is not configured');
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    lastCode = code;
  } catch {
    // Never log the callback URL or authorization code.
    reportAccountLinkError();
  } finally { pendingCode = null; }
}

export async function startNativeRuntime() {
  if (started) return;
  started = true;
  await Network.addListener('networkStatusChange', ({ connected }) => setStorageOnline(connected));
  setStorageOnline((await Network.getStatus()).connected);
  await App.addListener('appStateChange', ({ isActive }) => {
    const client = getSupabase();
    if (isActive) {
      client?.auth.startAutoRefresh();
      void Network.getStatus().then(({ connected }) => setStorageOnline(connected));
    } else {
      client?.auth.stopAutoRefresh();
      window.dispatchEvent(new Event('cfop:pause'));
      void flushAccount();
    }
  });
  await App.addListener('appUrlOpen', ({ url }) => { void receiveUrl(url); });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await receiveUrl(launch.url);
}
