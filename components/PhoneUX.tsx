'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const STRIPS = '.subcats, .seg-tabs, .board-chips, .subtabs';
const FIELD = 'textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), select, [contenteditable]';

// Which item each strip was last scrolled to. Kept out of the DOM: these elements belong to React.
const settled = new WeakMap<HTMLElement, string>();

/** Bring a strip's current item into view, once per current item. (Edge fades are CSS.) */
function settle(s: HTMLElement) {
  const cur = s.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"]');
  const at = cur?.getAttribute('href') ?? '';
  if (settled.get(s) === at) return;
  if (cur && s.scrollWidth <= s.clientWidth) return; // not laid out yet (or fits): try again later
  settled.set(s, at);
  if (cur) s.scrollLeft += cur.getBoundingClientRect().left - s.getBoundingClientRect().left - (s.clientWidth - cur.offsetWidth) / 2;
}

/**
 * Phone behaviour that isn't any one page's business:
 * - the header tucks away while you scroll down and comes back as soon as you scroll up;
 * - sideways chip strips start scrolled to the current item;
 * - `html.typing` while the keyboard is (probably) up, so the tab bar can get out of the way.
 */
export default function PhoneUX() {
  const path = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    const phone = matchMedia('(max-width: 760px)');
    const coarse = matchMedia('(pointer: coarse)');
    let last = window.scrollY, run = 0, raf = 0, sraf = 0;

    const hide = (on: boolean) => html.classList.toggle('bar-hidden', on);
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY, dy = y - last;
        last = y;
        if (!phone.matches || y < 80 || document.querySelector('details.menu[open], .bar .dropdown, .chat, .dm-page')) { run = 0; hide(false); return; }
        run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;
        if (run > 28) hide(true);
        else if (run < -18) hide(false);
      });
    };

    // Strips arrive with each page (and pages stream in after the loading state), so watch for them.
    const sync = () => { sraf = 0; document.querySelectorAll<HTMLElement>(STRIPS).forEach(settle); };
    const later = () => { if (!sraf) sraf = requestAnimationFrame(sync); };
    const mo = new MutationObserver(later);
    const main = document.querySelector('main');
    if (main) mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    sync();
    document.fonts?.ready.then(later);
    window.addEventListener('load', later);

    const onIn = (e: FocusEvent) => { if (coarse.matches && e.target instanceof Element && e.target.matches(FIELD)) html.classList.add('typing'); };
    const onOut = () => setTimeout(() => { if (!(document.activeElement instanceof Element && document.activeElement.matches(FIELD))) html.classList.remove('typing'); }, 80);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', later);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sraf);
      mo.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', later);
      window.removeEventListener('load', later);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // A new page starts with the header showing.
  useEffect(() => { document.documentElement.classList.remove('bar-hidden'); }, [path]);

  return null;
}
