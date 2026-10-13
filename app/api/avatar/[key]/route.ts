import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** A member's profile picture, members only. URLs carry a version, so they cache for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await currentUser({ touch: false }))) return new Response('Not found', { status: 404 });
  const key = decodeURIComponent((await params).key).toLowerCase();
  const row = await one<{ data: string }>(
    `SELECT encode(a.data, 'base64') AS data FROM avatars a JOIN members m ON m.id = a.member_id WHERE m.username_key = $1 AND NOT m.banned`,
    [key],
  );
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(Buffer.from(row.data, 'base64')), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
