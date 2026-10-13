import 'server-only';
import { q } from './db';
import { PAGE_SIZE } from './config';
import type { User } from './auth';
import type { ThreadRow } from '@/components/ThreadRows';

// $1 = member id, $2 = member joined at (threads older than that never count as unread)
const COLUMNS = `
  t.id, t.title, t.board, u.username AS author, t.reply_count, t.last_post_at, t.created_at, t.pinned, t.locked,
  COALESCE(r.read_at < t.last_post_at, t.last_post_at > $2) AS unread,
  (SELECT count(*)::int FROM props WHERE target = 'thread' AND target_id = t.id) AS props,
  (SELECT m.username FROM posts p JOIN members m ON m.id = p.user_id
    WHERE p.thread_id = t.id AND NOT p.deleted ORDER BY p.created_at DESC LIMIT 1) AS last_author`;

const FROM = `
  FROM threads t
  LEFT JOIN members u ON u.id = t.user_id
  LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $1`;

/** Threads for a board (or all boards), pinned first on a board, with an unread flag for `me`. */
export async function listThreads(me: User, opts: { board?: string; page?: number; limit?: number } = {}) {
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const rows = await q<ThreadRow>(
    `SELECT ${COLUMNS} ${FROM}
      WHERE NOT t.deleted AND ($3::text IS NULL OR t.board = $3)
      ORDER BY ${opts.board ? 't.pinned DESC,' : ''} t.last_post_at DESC
      LIMIT $4 OFFSET $5`,
    [me.id, me.created_at, opts.board ?? null, limit + 1, (page - 1) * limit],
  );
  return { rows: rows.slice(0, limit), more: rows.length > limit, page };
}

/** Most talked-about threads of the last week: comments + props since then. */
export async function trendingThreads(me: User, limit = 5) {
  return q<ThreadRow & { heat: number }>(
    `SELECT ${COLUMNS},
            (SELECT count(*) FROM posts p WHERE p.thread_id = t.id AND NOT p.deleted AND p.created_at > now() - interval '7 days')
          + (SELECT count(*) FROM props pr WHERE pr.target = 'thread' AND pr.target_id = t.id AND pr.created_at > now() - interval '7 days') AS heat
     ${FROM}
      WHERE NOT t.deleted AND t.last_post_at > now() - interval '7 days'
      ORDER BY heat DESC, t.last_post_at DESC LIMIT $3`,
    [me.id, me.created_at, limit],
  );
}
