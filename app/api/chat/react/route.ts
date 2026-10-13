import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { REACTIONS, chatWindow } from '@/lib/chat';

export const dynamic = 'force-dynamic';

/** Toggle a reaction: { id, emoji } */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'Log in first.' }, { status: 401 });
  let id = 0, emoji = '';
  try { const b = await req.json(); id = Number(b?.id); emoji = String(b?.emoji ?? ''); } catch {}
  if (!id || !REACTIONS.includes(emoji)) return NextResponse.json({ error: 'Unknown reaction.' }, { status: 400 });

  const removed = await q('DELETE FROM chat_reactions WHERE message_id = $1 AND member_id = $2 AND emoji = $3 RETURNING 1', [id, me.id, emoji]);
  if (!removed.length) {
    await q(
      `INSERT INTO chat_reactions (message_id, member_id, emoji)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM chat_messages WHERE id = $1 AND created_at >= $4)
       ON CONFLICT DO NOTHING`,
      [id, me.id, emoji, chatWindow().start],
    );
  }
  return NextResponse.json({ ok: true });
}
