'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '@/hooks/useMounted';
import { HEADER_ACTIONS_ID } from '@/lib/header-slots';
import { iconButtonClass } from './ui';

// A page under this one (a solve's records, a practice's session), kept out
// of the way of what the page is for: an icon at the right of the app
// header, as the list pages keep their controls there, that opens it as a
// page of its own (back in the header returns here, as it was left; see
// KeptScreen). `lead` goes after the page's title (its (i), for example).
// The icon shows only once there is something to see there (`show`); it is
// the last thing on the row, so coming nothing else moves.
export function HeaderPageLink({ label, icon, href, lead, show = true }: {
  label: string;
  icon: ReactNode;
  href: string;
  lead?: ReactNode;
  show?: boolean;
}) {
  const mounted = useMounted();
  // The header's slot exists once the page is in the browser.
  const actions = mounted ? document.getElementById(HEADER_ACTIONS_ID) : null;
  return actions && createPortal(
    <>
      {lead}
      {show && (
        <div className="ml-auto flex shrink-0 items-center">
          <Link href={href} aria-label={label} title={label} className={iconButtonClass('outline')}>
            {icon}
          </Link>
        </div>
      )}
    </>,
    actions,
  );
}
