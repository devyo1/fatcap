'use client';

import { useEffect } from 'react';

/** "⋯" menus (details.menu) close on a click elsewhere, on Escape, and when another one opens. */
export default function Popovers() {
  useEffect(() => {
    const closeAll = (except?: Element | null) => {
      for (const d of document.querySelectorAll('details.menu[open]')) if (d !== except) d.removeAttribute('open');
    };
    const onClick = (e: MouseEvent) => closeAll((e.target as Element).closest?.('details.menu'));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);
  return null;
}
