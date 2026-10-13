import 'server-only';
import { q, one } from './db';
import { MEDIA_ID } from './media-token';
import type { User } from './auth';
import type { Listing } from './market';

// Digital zines: a Market listing whose pages are made here (pictures and text) and read in the
// page-turner. Free ones open for everyone; paid ones show the first few pages until the seller
// confirms the buyer's payment. Pages live in their own table, never in the post, so a paid zine's
// pages don't leak into search, feeds or excerpts. Only the cover rides along in the post.
export const ZINE = { maxPages: 120, maxText: 1400, maxCaption: 160, maxPreview: 20 } as const;

export type PageIn =
  | { kind: 'image'; media: string; caption?: string; fit?: 'cover' | 'contain' }
  | { kind: 'text'; body: string };

export type PageRow = {
  n: number; kind: 'image' | 'text'; media_id: string | null; body: string | null; fit: 'cover' | 'contain';
  w: number | null; h: number | null; anim: boolean | null;
};

/** The builder's pages, from its hidden field, checked and cleaned. */
export function readPages(raw: string): PageIn[] | { error: string } {
  let list: unknown;
  try { list = JSON.parse(raw || '[]'); } catch { return { error: 'The pages got garbled. Try again.' }; }
  if (!Array.isArray(list) || !list.length) return { error: 'Add at least one page.' };
  if (list.length > ZINE.maxPages) return { error: `Up to ${ZINE.maxPages} pages.` };
  const out: PageIn[] = [];
  for (const p of list as Record<string, unknown>[]) {
    if (p?.kind === 'image' && typeof p.media === 'string' && MEDIA_ID.test(p.media)) {
      const caption = typeof p.caption === 'string' ? p.caption.trim().slice(0, ZINE.maxCaption) : '';
      out.push({ kind: 'image', media: p.media, caption: caption || undefined, fit: p.fit === 'contain' ? 'contain' : 'cover' });
    } else if (p?.kind === 'text' && typeof p.body === 'string') {
      const body = p.body.trim();
      if (!body) continue;
      if (body.length > ZINE.maxText) return { error: `A text page holds up to ${ZINE.maxText} characters. Split it over two.` };
      out.push({ kind: 'text', body });
    }
  }
  if (!out.length) return { error: 'Add at least one page.' };
  return out;
}

/** True if every picture on the pages is one of the author's own uploads, still there. */
export async function ownsPictures(authorId: number, pages: PageIn[]) {
  const ids = [...new Set(pages.flatMap((p) => (p.kind === 'image' ? [p.media] : [])))];
  if (!ids.length) return true;
  const n = await one<{ n: number }>('SELECT count(*)::int AS n FROM media WHERE id = ANY($1::text[]) AND member_id = $2 AND expires_at > now()', [ids, authorId]);
  return (n?.n ?? 0) === ids.length;
}

/** Replace a zine's pages, and keep their pictures (and the post's) for as long as the zine lives. */
export async function savePages(threadId: number, authorId: number, pages: PageIn[], postIds: string[]) {
  await q('DELETE FROM zine_pages WHERE thread_id = $1', [threadId]);
  await q(
    `INSERT INTO zine_pages (thread_id, n, kind, media_id, body, fit)
     SELECT $1, n - 1, k, NULLIF(m, ''), NULLIF(b, ''), f
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) WITH ORDINALITY AS p(k, m, b, f, n)`,
    [
      threadId,
      pages.map((p) => p.kind),
      pages.map((p) => (p.kind === 'image' ? p.media : '')),
      pages.map((p) => (p.kind === 'image' ? p.caption ?? '' : p.body)),
      pages.map((p) => (p.kind === 'image' ? p.fit ?? 'cover' : 'cover')),
    ],
  );
  const ids = [...new Set([...pages.flatMap((p) => (p.kind === 'image' ? [p.media] : [])), ...postIds])];
  await q('DELETE FROM media WHERE thread_id = $1 AND NOT (id = ANY($2::text[]))', [threadId, ids]);
  if (ids.length) {
    await q(`UPDATE media SET thread_id = $1, expires_at = 'infinity' WHERE id = ANY($2::text[]) AND member_id = $3`, [threadId, ids, authorId]);
  }
}

/** The pages in order, with picture sizes (a picture that's gone comes back without them). */
export function zinePages(threadId: number) {
  return q<PageRow>(
    `SELECT z.n, z.kind, z.media_id, z.body, z.fit, m.width AS w, m.height AS h, m.animated AS anim
       FROM zine_pages z LEFT JOIN media m ON m.id = z.media_id AND m.expires_at > now()
      WHERE z.thread_id = $1 ORDER BY z.n`,
    [threadId],
  );
}

/**
 * Why `me` can read all of it, or null if they can't (yet): it's free, it's theirs, they're an admin,
 * or the seller confirmed their payment. (`reviewing`: an admin looking at a zine that's waiting
 * for review sees it all.)
 */
export async function readsAll(me: User, l: Listing, reviewing = false): Promise<'free' | 'own' | 'admin' | 'bought' | null> {
  if (!l.price_cents) return 'free';
  if (l.seller_id === me.id) return 'own';
  if (await one(`SELECT 1 FROM deals WHERE thread_id = $1 AND buyer_id = $2 AND status = 'complete'`, [l.thread_id, me.id])) return 'bought';
  return me.is_admin || (reviewing && me.can_admin) ? 'admin' : null;
}
