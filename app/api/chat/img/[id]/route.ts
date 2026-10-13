import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Chat pictures, members only. They disappear when the chat wipes. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser({ touch: false }))) return new Response('Log in first.', { status: 401 });
  const id = Number((await params).id);
  const row = id ? await one<{ mime: string; b64: string }>(`SELECT mime, encode(data, 'base64') AS b64 FROM chat_images WHERE id = $1`, [id]) : null;
  if (!row) return new Response('Gone.', { status: 404 });
  return new Response(Buffer.from(row.b64.replace(/\s/g, ''), 'base64'), {
    headers: {
      'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer',
    },
  });
}
