import { currentUser } from '@/lib/auth';
import { giphyMediaUrl } from '@/lib/gifs';

export const dynamic = 'force-dynamic';

/** Preview images for the GIF picker, streamed through us (GIPHY's media hosts only, members only). */
export async function GET(req: Request) {
  if (!(await currentUser({ touch: false }))) return new Response('Not found', { status: 404 });
  const url = giphyMediaUrl(new URL(req.url).searchParams.get('u'));
  if (!url) return new Response('Not found', { status: 404 });
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  const type = r?.headers.get('content-type') ?? '';
  if (!r?.ok || !r.body || !/^image\/(gif|webp)$/.test(type)) return new Response('Not found', { status: 404 });
  return new Response(r.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
