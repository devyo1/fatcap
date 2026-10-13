'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/actions';
import Avatar from './Avatar';

const Count = ({ n }: { n: number }) => (n > 0 ? <span className="count" aria-hidden="true">{n > 99 ? '99+' : n}</span> : null);

const MsgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);

// The site's fat cap, as a line icon: alerts come out of the nozzle.
const CapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.2 4h9.6l1.4 11H5.8z" />
    <circle cx="12" cy="8.4" r="2.1" />
    <path d="M10.6 15v5h2.8v-5" />
  </svg>
);

/**
 * Messages, alerts and the profile menu. The server sends first counts; after each
 * navigation (and every 30s) they're re-read, so opening a message clears its badge.
 */
export default function QuickNav({ username, isAdmin, initial }: { username: string; isAdmin: boolean; initial: { messages: number; alerts: number } }) {
  const path = usePathname();
  const [counts, setCounts] = useState(initial);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/counts', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (alive && c) setCounts(c); }).catch(() => {});
    const first = setTimeout(load, 400); // let the page mark things read first
    const every = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    setOpen(false);
    return () => { alive = false; clearTimeout(first); clearInterval(every); };
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const profile = `/u/${encodeURIComponent(username)}`;
  return (
    <nav className="quick" aria-label="You">
      <Link href="/messages" className="icon-btn" aria-label={`Messages${counts.messages ? `, ${counts.messages} unread` : ''}`} title="Messages">
        <MsgIcon /><Count n={counts.messages} />
      </Link>
      <Link href="/alerts" className="icon-btn" aria-label={`Alerts${counts.alerts ? `, ${counts.alerts} new` : ''}`} title="Alerts">
        <CapIcon /><Count n={counts.alerts} />
      </Link>
      <div className="me-menu" ref={menuRef}>
        <button type="button" className="me-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Your account">
          <Avatar name={username} size={30} />
        </button>
        {open && (
          <div className="dropdown mono" role="menu">
            <div className="dd-head"><Avatar name={username} size={36} /><span>{username}</span></div>
            <Link role="menuitem" href={profile}>View profile</Link>
            <Link role="menuitem" href="/settings">Edit profile</Link>
            <Link role="menuitem" href="/messages">Messages</Link>
            <Link role="menuitem" href="/alerts">Alerts</Link>
            {isAdmin && <Link role="menuitem" href="/admin">Admin</Link>}
            <form action={logout}><button role="menuitem" type="submit">Log out</button></form>
          </div>
        )}
      </div>
    </nav>
  );
}
