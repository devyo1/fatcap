'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const EVERY = 20_000;

/**
 * "3 new posts" / "2 new comments" pill. Checks every 20s while the page is visible; a tap pulls
 * in the new stuff (and on a thread, scrolls to the first new comment). `since` is when the
 * server rendered the page, so it resets on every refresh.
 */
export default function Pulse({ thread, since }: { thread?: number; since: string }) {
  const router = useRouter();
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(0);
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/api/pulse?${thread ? `thread=${thread}` : 'feed=1'}&since=${encodeURIComponent(since)}`, { cache: 'no-store' });
        const d = await r.json();
        if (alive) setN(d.n ?? 0);
      } catch {}
    };
    const t = setInterval(check, EVERY);
    document.addEventListener('visibilitychange', check);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [thread, since]);

  if (!n) return null;
  return (
    <button
      type="button" className="pulse mono"
      onClick={() => {
        setN(0);
        router.refresh();
        if (thread) setTimeout(() => document.querySelector('.comment.fresh')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 700);
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      {thread ? <>&darr; {n} new {n === 1 ? 'comment' : 'comments'}</> : <>&uarr; {n} new {n === 1 ? 'post' : 'posts'}</>}
    </button>
  );
}
