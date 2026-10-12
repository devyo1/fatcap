'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const Count = ({ n, label }: { n: number; label: string }) =>
  n > 0 ? <span className="count" aria-label={`${n} ${label}`}>{n > 99 ? '99+' : n}</span> : null;

/**
 * Messages / Alerts / profile links with unread counts. The server sends a first value;
 * after each navigation (and every 30s) the counts are re-read, so opening a message
 * clears its badge straight away.
 */
export default function QuickNav({ username, initial }: { username: string; initial: { messages: number; alerts: number } }) {
  const path = usePathname();
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/counts', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (alive && c) setCounts(c); }).catch(() => {});
    const first = setTimeout(load, 400); // let the page mark things read first
    const every = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    return () => { alive = false; clearTimeout(first); clearInterval(every); };
  }, [path]);

  return (
    <nav className="quick mono" aria-label="You">
      <Link href="/messages"><span className="hide-sm">Messages</span><span className="show-sm">DMs</span><Count n={counts.messages} label="unread conversations" /></Link>
      <Link href="/alerts">Alerts<Count n={counts.alerts} label="new alerts" /></Link>
      <Link href={`/u/${encodeURIComponent(username)}`} aria-label="Your profile"><span className="hide-sm">{username}</span><span className="show-sm">Me</span></Link>
    </nav>
  );
}
