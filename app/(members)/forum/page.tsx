import Link from 'next/link';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { BOARDS, CITY } from '@/lib/config';
import { ago } from '@/lib/format';
import { listThreads, trendingThreads } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';
import Avatar from '@/components/Avatar';
import Notice from '@/components/Notice';

export const metadata = { title: 'Forum' };

type BoardStat = { board: string; threads: number; last: string | null; unread: number; latest_id: number | null; latest_title: string | null };

export default async function Forum({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const me = await requireUser();
  const { welcome } = await searchParams;
  const [boards, latest, trending, online, fresh, totals] = await Promise.all([
    q<BoardStat>(
      `SELECT t.board, count(*)::int AS threads, max(t.last_post_at) AS last,
              count(*) FILTER (WHERE COALESCE(r.read_at < t.last_post_at, t.last_post_at > $3))::int AS unread,
              (array_agg(t.id ORDER BY t.last_post_at DESC))[1] AS latest_id,
              (array_agg(t.title ORDER BY t.last_post_at DESC))[1] AS latest_title
         FROM threads t LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $2
        WHERE t.city = $1 AND NOT t.deleted GROUP BY t.board`,
      [CITY, me.id, me.created_at],
    ),
    listThreads(me, { limit: 12 }),
    trendingThreads(me, 5),
    q<{ username: string }>(`SELECT username FROM members WHERE last_seen_at > now() - interval '15 minutes' AND NOT banned ORDER BY last_seen_at DESC LIMIT 24`),
    q<{ username: string; created_at: string }>(`SELECT username, created_at FROM members WHERE NOT banned ORDER BY created_at DESC LIMIT 6`),
    one<{ members: number; week_threads: number; week_comments: number }>(
      `SELECT (SELECT count(*)::int FROM members WHERE NOT banned) AS members,
              (SELECT count(*)::int FROM threads WHERE city = $1 AND NOT deleted AND created_at > now() - interval '7 days') AS week_threads,
              (SELECT count(*)::int FROM posts p JOIN threads t ON t.id = p.thread_id WHERE t.city = $1 AND NOT p.deleted AND p.created_at > now() - interval '7 days') AS week_comments`,
      [CITY],
    ),
  ]);
  const byBoard = new Map(boards.map((b) => [b.board, b]));

  return (
    <>
      {welcome && <Notice ok="You're in. Your own one-time invite is on your profile." />}
      <section className="masthead">
        <div>
          <span className="mono mute br">fatcap.club / members</span>
          <h1 className="wide city">{CITY}</h1>
        </div>
        <div className="mast-side">
          <dl className="tally mono">
            <div><dt>Members</dt><dd>{totals?.members ?? 0}</dd></div>
            <div><dt>Threads / 7d</dt><dd>{totals?.week_threads ?? 0}</dd></div>
            <div><dt>Comments / 7d</dt><dd>{totals?.week_comments ?? 0}</dd></div>
            <div><dt>Around now</dt><dd>{online.length}</dd></div>
          </dl>
          <Link className="btn solid" href="/forum/general/new">New thread</Link>
        </div>
      </section>

      <div className="boards">
        {BOARDS.map((b, i) => {
          const c = byBoard.get(b.slug);
          return (
            <Link key={b.slug} href={`/forum/${b.slug}`} className="board">
              <span className="mono mute">{String(i + 1).padStart(2, '0')}</span>
              <span className="wide">{b.name}{c?.unread ? <span className="new" aria-label={`${c.unread} with new activity`} /> : null}</span>
              <span className="mute">{b.blurb}</span>
              <span className="latest">{c?.latest_title ? <>&rarr; {c.latest_title}</> : <span className="mute">Nothing yet</span>}</span>
              <span className="mono mute">
                {c?.threads ?? 0} {(c?.threads ?? 0) === 1 ? 'thread' : 'threads'}{c?.last ? ` / ${ago(c.last)}` : ''}
              </span>
            </Link>
          );
        })}
      </div>

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
                  <Link href={`/u/${encodeURIComponent(m.username)}`}><Avatar name={m.username} size={30} /><span>{m.username}</span><span className="mono mute">{ago(m.created_at)}</span></Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="sec-head mono"><span className="br">Around now</span></div>
            <div className="online-grid">
              {online.length ? online.map((o) => (
                <Link key={o.username} href={`/u/${encodeURIComponent(o.username)}`} title={o.username}><Avatar name={o.username} size={30} /></Link>
              )) : <span className="mono mute">Nobody right now.</span>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
