import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { gifsOn, searchGifs, fetchGif } from '@/lib/gifs';
import { storeImage, encodeImage } from '@/lib/media-store';

export const dynamic = 'force-dynamic';

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** GET ?q=&offset= : search (or trending). GET ?probe=1 : is GIF search set up? */
export async function GET(req: Request) {
  const me = await currentUser({ touch: false });
  if (!me) return fail('Log in first.', 401);
  const p = new URL(req.url).searchParams;
  if (p.get('probe')) return NextResponse.json({ on: gifsOn() });
  if (!gifsOn()) return fail('GIF search is not set up.', 501);
  try {
    return NextResponse.json(await searchGifs((p.get('q') ?? '').trim(), Math.max(0, Number(p.get('offset')) || 0)), {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch {
    return fail('GIF search is not responding. Try again.', 502);
  }
}

/**
 * POST { id } : fetch that GIF, re-encode it (no metadata, our own copy) and store it like an
 * upload -> { id } to drop into a post as [img:<id>]. With { raw: true } the re-encoded bytes
 * come straight back instead (the chat attaches them to its own upload).
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return fail('Log in first.', 401);
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail('Bad origin.', 403);
  if (!gifsOn()) return fail('GIF search is not set up.', 501);
  let body: { id?: unknown; raw?: unknown } = {};
  try { body = await req.json(); } catch {}
  const id = typeof body.id === 'string' ? body.id : '';
  let gif: Buffer | null = null;
  try { gif = await fetchGif(id); } catch {}
  if (!gif) return fail("Couldn't get that GIF. Try another.");
  if (body.raw) {
    const img = await encodeImage(gif);
    if ('error' in img) return fail(img.error);
    return new Response(new Uint8Array(img.data), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store' } });
  }
  const res = await storeImage(me.id, gif);
  return 'error' in res ? fail(res.error) : NextResponse.json(res);
}
