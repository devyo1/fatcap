import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { chatMessages, chatWindow, wipeOld, CHAT_MAX } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'Log in first.' }, { status: 401 });

/** New messages since ?after=<id>, plus when the chat wipes next. */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  const { start, wipeAt } = chatWindow();
  return NextResponse.json({ messages: await chatMessages(after), windowStart: start.toISOString(), wipeAt: wipeAt.toISOString() });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  let body = '';
  try { body = String((await req.json())?.body ?? '').trim(); } catch {}
  if (!body) return NextResponse.json({ error: 'Write something.' }, { status: 400 });
  if (body.length > CHAT_MAX) return NextResponse.json({ error: `Keep it under ${CHAT_MAX} characters.` }, { status: 400 });

  // One message per second per member keeps spam down.
  const recent = await one('SELECT 1 FROM chat_messages WHERE member_id = $1 AND created_at > now() - interval \'1 second\'', [me.id]);
  if (recent) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 });

  await wipeOld();
  const row = await one<{ id: number }>('INSERT INTO chat_messages (member_id, body) VALUES ($1, $2) RETURNING id', [me.id, body]);
  return NextResponse.json({ ok: true, id: row?.id });
}

/** Admins can remove a message: DELETE /api/chat?id=123 */
export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me?.is_admin) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get('id'));
  await q('DELETE FROM chat_messages WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
