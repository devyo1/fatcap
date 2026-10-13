import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { chatMessages, chatReactions, chatWindow, wipeOld, CHAT_MAX, CHAT_IMAGE_MAX } from '@/lib/chat';
import { notify, idsForNames } from '@/lib/notify';
import { mentionsIn } from '@/components/RichText';
import { encodeImage } from '@/lib/media-store';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** New messages since ?after=<id>, every reaction in the window, and when the chat wipes next. */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  const { wipeAt } = chatWindow();
  const [messages, reactions] = await Promise.all([chatMessages(after), chatReactions()]);
  return NextResponse.json({ messages, reactions, wipeAt: wipeAt.toISOString() });
}

/** Send a message: multipart form with body, optional image, optional reply_to. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  let form: FormData;
  try { form = await req.formData(); } catch { return fail('Could not read that message.'); }
  const body = String(form.get('body') ?? '').trim();
  const file = form.get('image');
  const replyTo = Number(form.get('reply_to')) || null;
  const image = file instanceof File && file.size > 0 ? file : null;

  if (!body && !image) return fail('Write something.');
  if (body.length > CHAT_MAX) return fail(`Keep it under ${CHAT_MAX} characters.`);
  if (image && !IMAGE_TYPES.includes(image.type)) return fail('Pictures only: JPG, PNG, WebP or GIF.');
  if (image && image.size > CHAT_IMAGE_MAX) return fail('That picture is too big (3 MB max).');

  // One message per second per member keeps spam down.
  if (await one(`SELECT 1 FROM chat_messages WHERE member_id = $1 AND created_at > now() - interval '1 second'`, [me.id])) {
    return fail('Slow down a little.', 429);
  }

  await wipeOld();
  let imageId: number | null = null;
  if (image) {
    // Re-encoded like every other upload, so no EXIF/GPS or other metadata survives.
    const img = await encodeImage(Buffer.from(await image.arrayBuffer()));
    if ('error' in img) return fail(img.error);
    const row = await one<{ id: number }>(`INSERT INTO chat_images (member_id, mime, data) VALUES ($1, 'image/webp', decode($2, 'base64')) RETURNING id`, [me.id, img.data.toString('base64')]);
    imageId = row?.id ?? null;
  }
  const parent = replyTo
    ? await one<{ id: number; member_id: number | null }>('SELECT id, member_id FROM chat_messages WHERE id = $1 AND created_at >= $2', [replyTo, chatWindow().start])
    : null;

  const row = await one<{ id: number }>(
    'INSERT INTO chat_messages (member_id, body, image_id, reply_to) VALUES ($1, $2, $3, $4) RETURNING id',
    [me.id, body, imageId, parent?.id ?? null],
  );
  await notify(
    [
      { kind: 'chat_reply', ids: [parent?.member_id] },
      { kind: 'chat_mention', ids: await idsForNames(mentionsIn(body)) },
    ],
    me.id, { chatId: row?.id },
  );
  return NextResponse.json({ ok: true, id: row?.id });
}

/** Admins can remove a message: DELETE /api/chat?id=123 */
export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me?.is_admin) return fail('Not allowed.', 403);
  const id = Number(new URL(req.url).searchParams.get('id'));
  const row = await one<{ image_id: number | null }>('DELETE FROM chat_messages WHERE id = $1 RETURNING image_id', [id]);
  if (row?.image_id) await q('DELETE FROM chat_images WHERE id = $1', [row.image_id]);
  return NextResponse.json({ ok: true });
}
