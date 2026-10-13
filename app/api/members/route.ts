import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Username suggestions for @mentions: prefix match, most recently active first. */
export async function GET(req: Request) {
  const me = await currentUser({ touch: false });
  if (!me) return NextResponse.json({ names: [] }, { status: 401 });
  const term = (new URL(req.url).searchParams.get('q') ?? '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);
  if (!term) return NextResponse.json({ names: [] });
  const rows = await q<{ username: string }>(
    `SELECT username FROM members WHERE username_key LIKE $1 AND NOT banned AND id <> $2
      ORDER BY last_seen_at DESC NULLS LAST, username_key LIMIT 6`,
    [`${term.replace(/_/g, "\\_")}%`, me.id],
  );
  return NextResponse.json({ names: rows.map((r) => r.username) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
