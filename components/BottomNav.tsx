'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { haptic } from '@/lib/haptics';
import { NavForum, NavChat, NavMarket, NavPlus } from './Icons';

type Counts = { messages: number; alerts: number; market: number };

/** Where "+" goes from here: reply on a thread, new thread in this board / sub-forum, a listing in Market. */
function plusFor(path: string): { href: string; focus?: string; label: string } {
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'forum' && p[1] === 't') return { href: '#reply', focus: 'body', label: 'Comment' };
  if (p[0] === 'chat') return { href: '#', focus: 'chat-input', label: 'Message' };
  if (p[0] === 'market' || (p[0] === 'forum' && p[1] === 'market')) return { href: `/forum/market/new${p[2] && p[2] !== 'new' ? `?in=${p[2]}` : ''}`, label: 'New listing' };
  if (p[0] === 'forum' && p[1] && p[1] !== 'new') return { href: `/forum/${p[1]}/new${p[2] && p[2] !== 'new' ? `?in=${p[2]}` : ''}`, label: 'New thread' };
  return { href: '/forum/general/new', label: 'New thread' };
}

/**
 * Phone tab bar: Forum, Chat, +, Market, Me. Slides away while the keyboard is up (`html.typing`,
 * set by PhoneUX), and stays off conversation screens (they own the bottom edge). Counts arrive
 * from the header's poller.
 */
export default function BottomNav({ username, initial }: { username: string; initial: Counts }) {
  const path = usePathname();
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    const onCounts = (e: Event) => setCounts((e as CustomEvent<Counts>).detail);
    window.addEventListener('fc:counts', onCounts);
    return () => window.removeEventListener('fc:counts', onCounts);
  }, []);

  if (/^\/messages\/[^/]+/.test(path)) return null;
  const sec = path.startsWith('/chat') ? 'chat'
    : path.startsWith('/market') || path.startsWith('/forum/market') ? 'market'
    : path.startsWith(`/u/${encodeURIComponent(username)}`) || path.startsWith('/settings') || path.startsWith('/saved') || path.startsWith('/invite') ? 'me'
    : path.startsWith('/forum') || path.startsWith('/search') ? 'forum' : '';
  const plus = plusFor(path);
  // Tapping the tab you're already on takes you back to the top, like a native app.
  const tap = (e: React.MouseEvent<HTMLAnchorElement>) => {
    haptic(6);
    if (e.currentTarget.getAttribute('href') === path && window.scrollY > 0) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className="bnav" aria-label="Main">
      <Link href="/forum" onClick={tap} aria-current={sec === 'forum' ? 'page' : undefined}><NavForum /><span>Forum</span></Link>
      <Link href="/chat" onClick={tap} aria-current={sec === 'chat' ? 'page' : undefined}><NavChat /><span>Chat</span></Link>
      <Link
        href={plus.href} className="bnav-plus" aria-label={plus.label}
        onClick={(e) => {
          haptic(6);
          if (!plus.focus) return;
          const el = document.getElementById(plus.focus) as HTMLTextAreaElement | null;
          if (!el) return;
          e.preventDefault();
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.focus({ preventScroll: true });
        }}
      ><NavPlus /></Link>
      <Link href="/forum/market" onClick={tap} aria-current={sec === 'market' ? 'page' : undefined}>
        <NavMarket /><span>Market</span>{counts.market > 0 && <b className="bnav-dot" aria-label={`${counts.market} waiting`} />}
      </Link>
      <Link href={`/u/${encodeURIComponent(username)}`} onClick={tap} aria-current={sec === 'me' ? 'page' : undefined}>
        <span className="bnav-me"><Avatar name={username} size={24} /></span><span>Me</span>
      </Link>
    </nav>
  );
}
