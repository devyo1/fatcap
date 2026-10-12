import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { BOARDS, CITY } from '@/lib/config';
import { ago } from '@/lib/format';
import { listThreads } from '@/lib/threads';
import ThreadRows from '@/components/ThreadRows';
import Notice from '@/components/Notice';

export const metadata = { title: 'Forum' };

export default async function Forum({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const me = await requireUser();
  const { welcome } = await searchParams;
  const [counts, latest, online] = await Promise.all([
    q<{ board: string; threads: number; last: string | null; unread: number }>(
      `SELECT t.board, count(*)::int AS threads, max(t.last_post_at) AS last,
              count(*) FILTER (WHERE COALESCE(r.read_at < t.last_post_at, t.last_post_at > $3))::int AS unread
         FROM threads t LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $2
        WHERE t.city = $1 AND NOT t.deleted GROUP BY t.board`,
      [CITY, me.id, me.created_at],
    ),
    listThreads(me, { limit: 15 }),
    q<{ username: string }>(`SELECT username FROM members WHERE last_seen_at > now() - interval '15 minutes' AND NOT banned ORDER BY last_seen_at DESC LIMIT 30`),
  ]);
  const byBoard = new Map(counts.map((c) => [c.board, c]));

  return (
    <>
      {welcome && <Notice ok="You're in. Your own one-time invite is on your profile." />}
      <div className="head">
        <h1 className="wide h1">{CITY}</h1>
        <Link className="btn" href="/forum/general/new">New thread</Link>
      </div>

      <div className="boards">
        {BOARDS.map((b) => {
          const c = byBoard.get(b.slug);
          return (
            <Link key={b.slug} href={`/forum/${b.slug}`} className="board">
              <span className="wide">{b.name}{c?.unread ? <span className="new" aria-label={`${c.unread} with new activity`} /> : null}</span>
              <span className="mute">{b.blurb}</span>
              <span className="mono mute">
                {c?.threads ?? 0} {(c?.threads ?? 0) === 1 ? 'thread' : 'threads'}{c?.last ? ` / ${ago(c.last)}` : ''}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="section">
        <span className="mono mute br">Latest</span>
        <ThreadRows rows={latest.rows} showBoard empty="Nothing yet. Start the first thread." />
      </section>

      <section className="section online mono">
        <span className="mute br">Around now</span>
        <span>
          {online.map((o, i) => (
            <span key={o.username}>{i ? ', ' : ''}<Link href={`/u/${encodeURIComponent(o.username)}`}>{o.username}</Link></span>
          ))}
        </span>
      </section>
    </>
  );
}
