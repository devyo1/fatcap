'use client';

import { useEffect } from 'react';

/**
 * "⋯" menus (details.menu) close on a click elsewhere, on Escape, and when another one opens.
 * On phones they open as a sheet over a dimmed page; the dim layer belongs to the <details>
 * itself, so a tap that lands on the <details> (not its summary or panel) means "close".
 */
export default function Popovers() {
  useEffect(() => {
    const closeAll = (except?: Element | null) => {
      for (const d of document.querySelectorAll('details.menu[open]')) if (d !== except) d.removeAttribute('open');
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.matches?.('details.menu[open]')) { closeAll(); return; }
      closeAll(t.closest?.('details.menu'));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);
  return null;
}
