import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { UPLOAD_MAX } from '@/lib/media';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Set your profile picture: cropped square, re-encoded (no metadata), 256px. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail('Bad origin.', 403);
  let file: FormDataEntryValue | null = null;
  try { file = (await req.formData()).get('file'); } catch {}
  if (!(file instanceof Blob) || !file.size) return fail('Pick an image.');
  if (file.size > UPLOAD_MAX) return fail('Too big. Keep it under 4 MB.', 413);
  const { default: sharp } = await import('sharp');
  let data: Buffer;
  try {
    data = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000, failOn: 'error' })
      .rotate()
      .resize(256, 256, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return fail("That file isn't an image we can read.");
  }
  await q(
    `INSERT INTO avatars (member_id, data, updated_at) VALUES ($1, decode($2, 'base64'), now())
     ON CONFLICT (member_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [me.id, data.toString('base64')],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  await q('DELETE FROM avatars WHERE member_id = $1', [me.id]);
  return NextResponse.json({ ok: true });
}
