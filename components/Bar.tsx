import Link from 'next/link';
import type { User } from '@/lib/auth';
import QuickNav from './QuickNav';
import Tabs from './Tabs';
import BackLink from './BackLink';

export default function Bar({ me, counts }: { me: User; counts: { messages: number; alerts: number; market: number } }) {
  return (
    <header className="bar">
      <div className="wrap top">
        <span className="brand-wrap">
          <BackLink me={me.username} />
          <Link href="/forum" className="wide brand" aria-label="fatcap.club forum">
            Fatcap<span className="dot">.</span>club
          </Link>
        </span>
        <QuickNav username={me.username} isAdmin={me.is_admin} initial={counts} />
      </div>
      <div className="wrap tabs-wrap">
        <Tabs />
      </div>
    </header>
  );
}
