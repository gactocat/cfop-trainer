'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

// Page views only, reported as origin and path. The query and hash are
// dropped: the account page receives sign-in tokens in its hash, and the
// script otherwise sends location.href as it is.
function pageViewWithoutQuery(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== 'pageview') return null;
  const url = new URL(event.url);
  url.search = '';
  url.hash = '';
  return { ...event, url: url.href };
}

// Vercel Web Analytics for the website: cookie-less page views. The iOS
// export leaves it out, so the app's privacy declaration stays as it is.
// In development the library logs page views to the console instead of
// sending them.
export function WebAnalytics() {
  if (process.env.NEXT_PUBLIC_NATIVE_APP === '1') return null;
  return <Analytics beforeSend={pageViewWithoutQuery} />;
}
