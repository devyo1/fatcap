import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { UPLOAD_MAX } from '@/lib/media';
import { storeImage } from '@/lib/media-store';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Upload one image (multipart field "file"). Returns { id } to drop into a post as [img:<id>]. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  // Only our own pages may upload (the session cookie is SameSite=Lax already; this is belt and braces).
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail('Bad origin.', 403);
  if (Number(req.headers.get('content-length')) > UPLOAD_MAX + 64 * 1024) return fail('Too big. Keep files under 4 MB.', 413);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get('file');
  } catch {
    return fail('Upload failed.');
  }
  if (!(file instanceof Blob) || !file.size) return fail('Pick an image.');
  if (file.size > UPLOAD_MAX) return fail('Too big. Keep files under 4 MB.', 413);

  const res = await storeImage(me.id, Buffer.from(await file.arrayBuffer()));
  return 'error' in res ? fail(res.error) : NextResponse.json(res);
}
