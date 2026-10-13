import Link from 'next/link';
import type { User } from '@/lib/auth';
import QuickNav from './QuickNav';

export default function Bar({ me, counts }: { me: User; counts: { messages: number; alerts: number } }) {
  return (
    <header className="bar">
      <div className="wrap top">
        <Link href="/forum" className="wide brand" aria-label="fatcap.club forum">
          Fatcap<span className="dot">.</span>club
        </Link>
        <QuickNav username={me.username} isAdmin={me.is_admin} initial={counts} />
      </div>
      <div className="wrap tabs-wrap">
        <nav className="tabs mono" aria-label="Sections">
          <Link href="/forum">Forum</Link>
          <Link href="/chat" className="chat-tab"><span className="live-dot" aria-hidden="true" />Chat</Link>
          <Link href="/members">Members</Link>
          <Link href="/search">Search</Link>
        </nav>
      </div>
    </header>
  );
}
