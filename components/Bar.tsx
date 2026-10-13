import Link from 'next/link';
import type { User } from '@/lib/auth';
import QuickNav from './QuickNav';
import Tabs from './Tabs';

export default function Bar({ me, counts }: { me: User; counts: { messages: number; alerts: number; market: number } }) {
  return (
    <header className="bar">
      <div className="wrap top">
        <Link href="/forum" className="wide brand" aria-label="fatcap.club forum">
          Fatcap<span className="dot">.</span>club
        </Link>
        <QuickNav username={me.username} isAdmin={me.is_admin} initial={counts} />
      </div>
      <div className="wrap tabs-wrap">
        <Tabs />
      </div>
    </header>
  );
}
