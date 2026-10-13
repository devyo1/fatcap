'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NavBack } from './Icons';

// The tab bar's own screens are the top level: no back arrow there.
const ROOTS = ['/forum', '/chat', '/forum/market', '/messages', '/alerts'];

// Pages seen in this tab, as a rough copy of the history stack (a return to the page before pops).
const trail: string[] = [];
function note(path: string) {
  if (trail[trail.length - 1] === path) return;
  if (trail[trail.length - 2] === path) trail.pop();
  else trail.push(path);
}

/** Phone header: a back arrow below the top level. With nothing in this tab to go back to, it goes up a level (the last breadcrumb). */
export default function BackLink({ me }: { me: string }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => note(path), [path]);
  if (ROOTS.includes(path) || path === `/u/${encodeURIComponent(me)}`) return null;
  return (
    <button
      type="button" className="back-btn show-sm-flex" aria-label="Back"
      onClick={() => {
        if (trail.length > 1) { router.back(); return; }
        router.push(document.querySelector('main .crumbs a:last-of-type')?.getAttribute('href') || '/forum');
      }}
    ><NavBack /></button>
  );
}
