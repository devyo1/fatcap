'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/forum', label: 'Forum' },
  { href: '/chat', label: 'Chat', live: true },
  { href: '/search', label: 'Search' },
  { href: '/invite', label: 'Invite' },
];

/** Section tabs; the one you're in is marked. Threads and profiles count as Forum. Admin lives in the avatar menu. */
export default function Tabs() {
  const path = usePathname();
  const section = path.startsWith('/u/') || path.startsWith('/forum') ? '/forum' : `/${path.split('/')[1]}`;
  return (
    <nav className="tabs mono" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.live ? 'chat-tab' : undefined} aria-current={section === t.href ? 'page' : undefined}>
          {t.live && <span className="live-dot" aria-hidden="true" />}{t.label}
        </Link>
      ))}
    </nav>
  );
}
