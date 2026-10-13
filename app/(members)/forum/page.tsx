import Link from 'next/link';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { feedThreads, listThreads, topicStats, popularTags, LIVE } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';
import { SortTabs, ForumTree, BoardChips } from '@/components/ForumNav';
import Pulse from '@/components/Pulse';
import MoreRows from '@/components/MoreRows';
import ThreadCards from '@/components/ThreadCards';
import ThreadGrid from '@/components/ThreadGrid';
import ViewToggle from '@/components/ViewToggle';
import { layoutOf } from '@/lib/view';

const BATCH = 24; // divides into rows of 2, 3 and 4 tiles

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
  const layout = await layoutOf();
  const rich = layout !== 'list';

  const [feed, stats, online, totals, tags] = await Promise.all([
    view === 'feed' ? feedThreads(me, BATCH + 1, 0, rich) : listThreads(me, { sort: view, limit: BATCH + 1, cards: rich }).then((r) => r.rows),
    topicStats(me),
    q<{ username: string }>(`SELECT username FROM members WHERE last_seen_at > now() - interval '15 minutes' AND NOT banned ORDER BY last_seen_at DESC LIMIT 24`),
    one<{ members: number; threads: number; comments: number }>(
      `SELECT (SELECT count(*)::int FROM members WHERE NOT banned) AS members,
              (SELECT count(*)::int FROM threads t WHERE ${LIVE}) AS threads,
              (SELECT COALESCE(sum(reply_count), 0)::int FROM threads t WHERE ${LIVE}) AS comments`,
    ),
    popularTags(12),
  ]);
  const rows = feed.slice(0, BATCH);
  const empty = view === 'top' ? 'Nothing this month.' : 'No threads yet.';

  return (
    <>
      {welcome && <Notice ok="Welcome in. Your invite is under Invite." />}
      <div className="page-head">
        <div>
          <h1 className="title">Forum</h1>
          <p className="mono mute stat-line">
            {totals?.members ?? 0} members / {totals?.threads ?? 0} threads<span className="hide-phone"> / {totals?.comments ?? 0} comments</span> / {online.length} online
          </p>
        </div>
        <div className="actions">
          <ViewToggle layout={layout} />
          <Link className="btn solid hide-phone" href="/forum/general/new">New thread</Link>
        </div>
      </div>
      <BoardChips />
      <Pulse since={new Date().toISOString()} />

      <div className="split">
        <section>
          <SortTabs label="Feed" items={VIEWS} current={view} />
          {layout === 'cards' ? <ThreadCards rows={rows} empty={empty} />
            : layout === 'grid' ? <ThreadGrid rows={rows} empty={empty} />
            : <ThreadRows rows={rows} showBoard empty={empty} />}
          {feed.length > BATCH && <MoreRows key={`${view}-${layout}`} query={{ view, rich }} start={BATCH} have={rows.map((r) => r.id)} size={BATCH} as={layout === 'list' ? 'rows' : layout} showBoard />}
        </section>

        <aside className="side">
          <section>
            <div className="sec-head mono"><span className="br">Forums</span></div>
            <ForumTree stats={stats} />
          </section>
          {tags.length > 0 && (
            <section>
              <div className="sec-head mono"><span className="br">Tags</span></div>
              <div className="tag-cloud mono">
                {tags.map((t) => <Link key={t.tag} href={`/search?q=${encodeURIComponent(`#${t.tag}`)}`}>#{t.tag}<span className="n">{t.n}</span></Link>)}
              </div>
            </section>
          )}
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
