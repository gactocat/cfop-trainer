'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '@/hooks/useMounted';
import { HEADER_ACTIONS_ID } from '@/lib/header-slots';
import { FullScreenModal } from './FullScreenModal';
import { iconButtonClass } from './ui';

// A page's panel kept out of the way of what it is for (a solve page's
// records, a practice's session): an icon at the right of the app header,
// as the list pages keep their controls there, that opens the panel over
// the page. The panel holds the page's timers and keys back while open.
// `lead` goes after the page's title (its (i), for example).
export function HeaderPanelButton({ label, icon, lead, children }: {
  label: string;
  icon: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  // The header's slot exists once the page is in the browser.
  const actions = mounted ? document.getElementById(HEADER_ACTIONS_ID) : null;
  return (
    <>
      {actions && createPortal(
        <>
          {lead}
          <div className="ml-auto flex shrink-0 items-center">
            <button type="button" onClick={() => setOpen(true)} aria-label={label} title={label} aria-haspopup="dialog"
              className={iconButtonClass('outline')}>
              {icon}
            </button>
          </div>
        </>,
        actions,
      )}
      <FullScreenModal open={open} onClose={() => setOpen(false)} title={label} overlay>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </FullScreenModal>
    </>
  );
}
