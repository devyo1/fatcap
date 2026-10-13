'use client';

import { useEffect, useRef } from 'react';

const SHOW_AFTER = 140; // quick taps never show it
const GIVE_UP = 9000;

/**
 * A thin line along the top while a page or an action is on its way, so a tap always shows
 * something happening. The page you're on stays put until the next one is ready (no blank
 * screen). Starts on a tap of an in-site link or on a server action; ends when the address
 * changes or the action comes back.
 */
export default function NavProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const s = { nav: '', actions: 0, shown: false, showT: 0, giveT: 0, hideT: 0, poll: 0 };
    const busy = () => !!s.nav || s.actions > 0;

    const stop = () => {
      if (busy()) return;
      clearTimeout(s.showT); s.showT = 0;
      clearTimeout(s.giveT); clearInterval(s.poll); s.poll = 0;
      if (!s.shown) return;
      s.shown = false;
      el.className = 'navbar done';
      s.hideT = window.setTimeout(() => { el.className = 'navbar'; }, 420);
    };
    const start = () => {
      clearTimeout(s.hideT);
      clearTimeout(s.giveT);
      s.giveT = window.setTimeout(() => { s.nav = ''; s.actions = 0; stop(); }, GIVE_UP);
      if (s.shown || s.showT) return;
      s.showT = window.setTimeout(() => {
        s.showT = 0;
        if (!busy()) return;
        s.shown = true;
        el.className = 'navbar';
        void el.offsetWidth; // restart the animation
        el.className = 'navbar run';
      }, SHOW_AFTER);
    };

    // Links: a tap on an in-site link to a different page. Done once the address changes.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
      if (u.pathname === location.pathname && u.search === location.search) return; // same page: a jump, not a load
      s.nav = location.href;
      start();
      clearInterval(s.poll);
      s.poll = window.setInterval(() => { if (location.href !== s.nav) { s.nav = ''; stop(); } }, 80);
    };
    const onPop = () => { s.nav = ''; stop(); };

    // Server actions (likes, comments, deal steps...): the request carries a Next-Action header.
    const orig = window.fetch;
    const wrapped: typeof window.fetch = (input, init) => {
      let action = false;
      try { action = new Headers(init?.headers).has('next-action'); } catch {}
      if (!action) return orig.call(window, input, init);
      s.actions += 1;
      start();
      return orig.call(window, input, init).finally(() => { s.actions = Math.max(0, s.actions - 1); stop(); });
    };
    window.fetch = wrapped;

    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    return () => {
      if (window.fetch === wrapped) window.fetch = orig;
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
      clearTimeout(s.showT); clearTimeout(s.giveT); clearTimeout(s.hideT); clearInterval(s.poll);
    };
  }, []);

  return <div ref={bar} className="navbar" aria-hidden="true" />;
}
