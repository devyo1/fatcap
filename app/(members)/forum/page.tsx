import Link from 'next/link';
import { q } from '@/lib/db';
import { BOARDS, CITY } from '@/lib/config';
import { ago } from '@/lib/format';
import ThreadRows, { type ThreadRow } from '@/components/ThreadRows';
import Notice from '@/components/Notice';

export const metadata = { title: 'Forum' };

export default async function Forum({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const [counts, latest] = await Promise.all([
    q<{ board: string; threads: number; last: string | null }>(
      `SELECT board, count(*)::int AS threads, max(last_post_at) AS last
         FROM threads WHERE city = $1 AND NOT deleted GROUP BY board`,
      [CITY],
    ),
    q<ThreadRow>(
      `SELECT t.id, t.title, t.board, u.username AS author, t.reply_count, t.last_post_at
         FROM threads t LEFT JOIN users u ON u.id = t.user_id
        WHERE t.city = $1 AND NOT t.deleted
        ORDER BY t.last_post_at DESC LIMIT 15`,
      [CITY],
    ),
  ]);
  const byBoard = new Map(counts.map((c) => [c.board, c]));

  return (
    <>
      {welcome && <Notice ok="You're in. Your own one-time invite is on your profile." />}
      <div className="head">
        <div>
          <h1 className="wide h1">{CITY}</h1>
        </div>
        <span className="mono mute">Members only</span>
      </div>

      <div className="boards">
        {BOARDS.map((b) => {
          const c = byBoard.get(b.slug);
          return (
            <Link key={b.slug} href={`/forum/${b.slug}`} className="board">
              <span className="wide">{b.name}</span>
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
        <ThreadRows rows={latest} showBoard empty="Nothing yet. Start the first thread." />
      </section>
    </>
  );
}
