import { currentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { readImage } from '@/lib/media';

export const dynamic = 'force-dynamic';

// Served as an inert image: no sniffing, no scripts, never stored by shared caches.
const LOCKED = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
};

const GONE = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" viewBox="0 0 480 140"><rect width="480" height="140" fill="#161615"/><rect x=".5" y=".5" width="479" height="139" fill="none" stroke="#3d3c38"/><text x="240" y="76" fill="#8f8c84" font-family="ui-monospace,Menlo,monospace" font-size="13" letter-spacing="1.5" text-anchor="middle">[ IMAGE EXPIRED ]</text></svg>`;

/** Members-only image. Expired or unknown ids get a small placeholder instead of a broken image. */
const SIZES = [240, 480, 960];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser({ touch: false });
  if (!me) return new Response('Not found', { status: 404, headers: LOCKED });
  const img = await readImage((await params).id);
  if (!img) {
    return new Response(GONE, { status: 404, headers: { ...LOCKED, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' } });
  }
  // Smaller copies for lists and grids (first frame only for animations), made on the fly.
  const sp = new URL(req.url).searchParams;
  const w = Number(sp.get('w'));
  let out: Buffer = img;
  if (SIZES.includes(w)) {
    try {
      const { default: sharp } = await import('sharp');
      out = await sharp(img)
        .resize(sp.get('sq') ? { width: w, height: w, fit: 'cover', position: sharp.strategy.attention } : { width: w, height: w, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
    } catch { out = img; }
  }
  return new Response(new Uint8Array(out), {
    headers: {
      ...LOCKED,
      'Content-Type': 'image/webp',
      'Content-Length': String(out.length),
      'Content-Disposition': 'inline; filename="image.webp"',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}

/** Take back your own upload (the x on a composer thumbnail). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser({ touch: false });
  if (!me) return new Response(null, { status: 401 });
  await q('DELETE FROM media WHERE id = $1 AND member_id = $2', [(await params).id, me.id]);
  return new Response(null, { status: 204 });
}
