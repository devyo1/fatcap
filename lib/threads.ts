import 'server-only';
import { q } from './db';
import { CITY, PAGE_SIZE } from './config';
import type { User } from './auth';
import type { ThreadRow } from '@/components/ThreadRows';

/** Threads for a board (or all boards), pinned first on a board, with an unread flag for `me`. */
export async function listThreads(me: User, opts: { board?: string; page?: number; limit?: number } = {}) {
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const rows = await q<ThreadRow>(
    `SELECT t.id, t.title, t.board, u.username AS author, t.reply_count, t.last_post_at, t.pinned, t.locked,
            COALESCE(r.read_at < t.last_post_at, t.last_post_at > $2) AS unread
       FROM threads t
       LEFT JOIN members u ON u.id = t.user_id
       LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $1
      WHERE t.city = $3 AND NOT t.deleted AND ($4::text IS NULL OR t.board = $4)
      ORDER BY ${opts.board ? 't.pinned DESC,' : ''} t.last_post_at DESC
      LIMIT $5 OFFSET $6`,
    [me.id, me.created_at, CITY, opts.board ?? null, limit + 1, (page - 1) * limit],
  );
  return { rows: rows.slice(0, limit), more: rows.length > limit, page };
}
