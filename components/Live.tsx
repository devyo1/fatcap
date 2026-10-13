'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Re-fetches the page's server data every few seconds while the tab is visible. */
export function RefreshEvery({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** Brings one element into view (centred) if it isn't already, and marks it for a moment. */
export function Reveal({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: 'center' });
    el.classList.add('reveal');
  }, [id]);
  return null;
}

/** Keeps a message list scrolled to the newest message when it first renders or grows. */
export function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'end' }); }, [count]);
  return <div ref={ref} id="end" />;
}
