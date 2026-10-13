import Link from 'next/link';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { BOARDS } from '@/lib/config';
import { ago } from '@/lib/format';
import { listThreads, trendingThreads } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';

export const metadata = { title: 'Forum' };

type BoardStat = { board: string; threads: number; comments: number; last: string | null; unread: number; latest_id: number | null; latest_title: string | null; latest_author: string | null };

export default async function Forum({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const me = await requireUser();
  const { welcome } = await searchParams;
  const [boards, latest, trending, online, fresh, totals] = await Promise.all([
    q<BoardStat>(
      `SELECT t.board, count(*)::int AS threads, sum(t.reply_count)::int AS comments, max(t.last_post_at) AS last,
              count(*) FILTER (WHERE COALESCE(r.read_at < t.last_post_at, t.last_post_at > $2))::int AS unread,
              (array_agg(t.id ORDER BY t.last_post_at DESC))[1] AS latest_id,
              (array_agg(t.title ORDER BY t.last_post_at DESC))[1] AS latest_title,
              (array_agg(u.username ORDER BY t.last_post_at DESC))[1] AS latest_author
         FROM threads t
         LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $1
         LEFT JOIN members u ON u.id = t.user_id
        WHERE NOT t.deleted GROUP BY t.board`,
      [me.id, me.created_at],
    ),
    listThreads(me, { limit: 15 }),
    trendingThreads(me, 5),
    q<{ username: string }>(`SELECT username FROM members WHERE last_seen_at > now() - interval '15 minutes' AND NOT banned ORDER BY last_seen_at DESC LIMIT 24`),
    q<{ username: string; created_at: string }>(`SELECT username, created_at FROM members WHERE NOT banned ORDER BY created_at DESC LIMIT 6`),
    one<{ members: number; threads: number; comments: number }>(
      `SELECT (SELECT count(*)::int FROM members WHERE NOT banned) AS members,
              (SELECT count(*)::int FROM threads WHERE NOT deleted) AS threads,
              (SELECT count(*)::int FROM posts WHERE NOT deleted) AS comments`,
    ),
  ]);
  const byBoard = new Map(boards.map((b) => [b.board, b]));

  return (
    <>
      {welcome && <Notice ok="You're in. Your own one-time invite is on your profile." />}
      <div className="page-head">
        <div>
          <h1 className="title">Forum</h1>
          <p className="mono mute stat-line">
            {totals?.members ?? 0} members / {totals?.threads ?? 0} threads / {totals?.comments ?? 0} comments / {online.length} around now
          </p>
        </div>
        <Link className="btn solid" href="/forum/general/new">New thread</Link>
      </div>

      <ul className="cats">
        {BOARDS.map((b) => {
          const c = byBoard.get(b.slug);
          return (
            <li key={b.slug}>
              <Link href={`/forum/${b.slug}`} className="cat">
                <span className="cat-main">
                  <span className="cat-name">{b.name}{c?.unread ? <span className="new" aria-label={`${c.unread} with new activity`} /> : null}</span>
                  <span className="mute">{b.blurb}</span>
                </span>
                <span className="cat-nums mono mute">
                  <span><b>{c?.threads ?? 0}</b> threads</span>
                  <span><b>{c?.comments ?? 0}</b> comments</span>
                </span>
                <span className="cat-last">
                  {c?.latest_title ? (
                    <>
                      <Avatar name={c.latest_author} size={24} />
                      <span>
                        <span className="cat-last-t">{c.latest_title}</span>
                        <span className="mono mute">{c.latest_author ?? 'gone'} / {c.last ? ago(c.last) : ''}</span>
                      </span>
                    </>
                  ) : <span className="mono mute">Nothing yet</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="split">
        <section>
          <div className="sec-head mono"><span className="br">Latest</span><Link className="mute" href="/search">Search &rarr;</Link></div>
          <ThreadRows rows={latest.rows} showBoard empty="Nothing yet. Start the first thread." />
        </section>

        <aside className="side">
          <section>
            <div className="sec-head mono"><span className="br">Trending this week</span></div>
            <ThreadRows rows={trending} numbered empty="Quiet week." />
          </section>
          <section>
            <div className="sec-head mono"><span className="br">New faces</span><Link className="mute" href="/members">All &rarr;</Link></div>
            <ul className="faces">
              {fresh.map((m) => (
                <li key={m.username}>
                  <Link href={`/u/${encodeURIComponent(m.username)}`}><Avatar name={m.username} size={26} /><span>{m.username}</span><span className="mono mute">{ago(m.created_at)}</span></Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="sec-head mono"><span className="br">Around now</span></div>
            <div className="online-grid">
              {online.length ? online.map((o) => (
                <Link key={o.username} href={`/u/${encodeURIComponent(o.username)}`} title={o.username}><Avatar name={o.username} size={28} /></Link>
              )) : <span className="mono mute">Nobody right now.</span>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
