import Link from 'next/link';
import { logout } from '@/app/actions';
import { CITY } from '@/lib/config';
import type { User } from '@/lib/auth';
import QuickNav from './QuickNav';

export default function Bar({ me, counts }: { me: User; counts: { messages: number; alerts: number } }) {
  return (
    <header className="bar">
      <div className="wrap top">
        <Link href="/forum" className="wide brand" aria-label="fatcap.club forum">
          Fatcap<span className="dot">.</span>club
        </Link>
        <QuickNav username={me.username} initial={counts} />
      </div>
      <div className="wrap tabs-wrap">
        <nav className="tabs mono" aria-label="Sections">
          <span className="br mute">{CITY}</span>
          <Link href="/forum">Forum</Link>
          <Link href="/members">Members</Link>
          <Link href="/search">Search</Link>
          {me.is_admin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button className="linkbtn" type="submit">Log out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
