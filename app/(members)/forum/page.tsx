import Link from 'next/link';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { feedThreads, listThreads, topicStats, LIVE } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';
import { SortTabs, ForumTree, BoardChips } from '@/components/ForumNav';

export const metadata = { title: 'Forum' };

const VIEWS = [
  { id: 'feed', name: 'Feed', href: '/forum' },
  { id: 'recent', name: 'Recent', href: '/forum?view=recent' },
  { id: 'top', name: 'Top', href: '/forum?view=top' },
];

export default async function Forum({ searchParams }: { searchParams: Promise<{ welcome?: string; view?: string }> }) {
  const me = await requireUser();
  const { welcome, view: rawView } = await searchParams;
  const view = rawView === 'recent' || rawView === 'top' ? rawView : 'feed';

  const [rows, stats, online, totals] = await Promise.all([
    view === 'feed' ? feedThreads(me, 25) : listThreads(me, { sort: view, limit: 25 }).then((r) => r.rows),
    topicStats(me),
    q<{ username: string }>(`SELECT username FROM members WHERE last_seen_at > now() - interval '15 minutes' AND NOT banned ORDER BY last_seen_at DESC LIMIT 24`),
    one<{ members: number; threads: number; comments: number }>(
      `SELECT (SELECT count(*)::int FROM members WHERE NOT banned) AS members,
              (SELECT count(*)::int FROM threads t WHERE ${LIVE}) AS threads,
              (SELECT COALESCE(sum(reply_count), 0)::int FROM threads t WHERE ${LIVE}) AS comments`,
    ),
  ]);

  return (
    <>
      {welcome && <Notice ok="Welcome in. Your invite is under Invite." />}
      <div className="page-head">
        <div>
          <h1 className="title">Forum</h1>
          <p className="mono mute stat-line">
            {totals?.members ?? 0} members / {totals?.threads ?? 0} threads / {totals?.comments ?? 0} comments / {online.length} online
          </p>
        </div>
        <Link className="btn solid" href="/forum/general/new">New thread</Link>
      </div>
      <BoardChips />

      <div className="split">
        <section>
          <SortTabs label="Feed" items={VIEWS} current={view} />
          <ThreadRows rows={rows} showBoard empty={view === 'top' ? 'Nothing this month.' : 'No threads yet.'} />
        </section>

        <aside className="side">
          <section>
            <div className="sec-head mono"><span className="br">Forums</span></div>
            <ForumTree stats={stats} />
          </section>
          <section>
            <div className="sec-head mono"><span className="br">Online</span><span>{online.length}</span></div>
            <div className="online-grid">
              {online.length ? online.map((o) => (
                <Link key={o.username} href={`/u/${encodeURIComponent(o.username)}`} title={o.username}><Avatar name={o.username} size={28} /></Link>
              )) : <span className="mono mute">No one.</span>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
