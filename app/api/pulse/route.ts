import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

const LIVE = `NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())`;
const UNBLOCKED = (col: string) => `NOT EXISTS (SELECT 1 FROM blocks bl WHERE bl.blocker_id = $1 AND bl.blocked_id = ${col})`;

/**
 * What's new since a page loaded, from other people:
 *   ?thread=ID&since=ISO -> new comments in that thread
 *   ?feed=1&since=ISO    -> threads started or commented on
 */
export async function GET(req: Request) {
  const me = await currentUser({ touch: false });
  if (!me) return NextResponse.json({ n: 0 }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const since = new Date(p.get('since') ?? '');
  if (Number.isNaN(since.getTime())) return NextResponse.json({ n: 0 });
  const thread = Number(p.get('thread'));
  const row = thread
    ? await one<{ n: number }>(
        `SELECT count(*)::int AS n FROM posts p JOIN threads t ON t.id = p.thread_id
          WHERE p.thread_id = $3 AND p.created_at > $2 AND p.user_id <> $1 AND NOT p.deleted AND ${LIVE} AND ${UNBLOCKED('p.user_id')}`,
        [me.id, since, thread],
      )
    : await one<{ n: number }>(
        `SELECT count(*)::int AS n FROM threads t
          WHERE ${LIVE} AND ${UNBLOCKED('t.user_id')} AND t.last_post_at > $2
            AND ((t.created_at > $2 AND t.user_id <> $1)
                 OR EXISTS (SELECT 1 FROM posts p WHERE p.thread_id = t.id AND p.created_at > $2 AND p.user_id <> $1 AND NOT p.deleted))`,
        [me.id, since],
      );
  return NextResponse.json({ n: row?.n ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
}
