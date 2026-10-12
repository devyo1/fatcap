import Link from 'next/link';
import { logout } from '@/app/actions';
import { CITY } from '@/lib/config';
import type { User } from '@/lib/auth';

export default function Bar({ me }: { me: User }) {
  return (
    <header className="bar">
      <div className="wrap">
        <Link href="/forum" className="wide brand" aria-label="fatcap.club forum">
          Fatcap<span className="dot">.</span>club
        </Link>
        <nav className="mono" aria-label="Members">
          <span className="br mute hide-sm">{CITY}</span>
          <Link href="/forum">Forum</Link>
          <Link href={`/u/${encodeURIComponent(me.username)}`}><span className="hide-sm">{me.username}</span><span className="show-sm">Me</span></Link>
          {me.is_admin && <Link href="/admin">Admin</Link>}
          <form action={logout}>
            <button className="linkbtn" type="submit">Log out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
