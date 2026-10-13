import 'server-only';
import { q } from './db';
import { PAGE_SIZE } from './config';
import { dropMedia } from './media';
import type { User } from './auth';
import type { ThreadRow } from '@/components/ThreadRows';

/** A thread that's visible: not deleted, and not past its vanish time. */
export const LIVE = `NOT t.deleted AND (t.expires_at IS NULL OR t.expires_at > now())`;

/** Not by someone the viewer ($1) has blocked. */
export const UNBLOCKED = `NOT EXISTS (SELECT 1 FROM blocks bl WHERE bl.blocker_id = $1 AND bl.blocked_id = t.user_id)`;

// $1 = member id, $2 = member joined at (threads older than that never count as unread)
const COLUMNS = `
  t.id, t.title, t.board, t.topic, u.username AS author, t.reply_count, t.last_post_at, t.created_at, t.pinned, t.locked,
  t.expires_at, t.price, t.status, lst.mode, CASE WHEN lst.mode = 'auction' AND NOT lst.settled THEN lst.ends_at END AS auction_ends,
  lst.ships, lst.meetup, lst.meetup_area,
  substring(t.body from '\\[img:([A-Za-z0-9_-]{16})\\]') AS cover,
  left(regexp_replace(regexp_replace(t.body, '\\[img:[A-Za-z0-9_-]{16}\\][^\\n]*', '', 'g'), '\\s+', ' ', 'g'), 260) AS excerpt,
  COALESCE(r.read_at < t.last_post_at, t.last_post_at > $2) AS unread,
  (SELECT count(*)::int FROM props WHERE target = 'thread' AND target_id = t.id) AS props,
  (SELECT m.username FROM posts p JOIN members m ON m.id = p.user_id
    WHERE p.thread_id = t.id AND NOT p.deleted ORDER BY p.created_at DESC LIMIT 1) AS last_author`;

// The card view also wants: the post's text (pictures taken out), its first four pictures with
// their sizes (and how many there are), whether the viewer liked / saved it, and the latest comment
// (not from someone they blocked).
const CARD_COLUMNS = `,
  left(regexp_replace(t.body, '\\[img:[A-Za-z0-9_-]{16}\\][^\\n]*\\n?', '', 'g'), 900) AS text,
  (SELECT json_agg(json_build_object('id', md.id, 'w', md.width, 'h', md.height, 'a', md.animated) ORDER BY x.ord)
     FROM regexp_matches(t.body, '\\[img:([A-Za-z0-9_-]{16})\\]', 'g') WITH ORDINALITY AS x(m, ord)
     JOIN media md ON md.id = x.m[1]
    WHERE x.ord <= 4) AS pics,
  (SELECT count(*)::int FROM regexp_matches(t.body, '\\[img:[A-Za-z0-9_-]{16}\\]', 'g') AS y) AS pic_count,
  EXISTS (SELECT 1 FROM props WHERE target = 'thread' AND target_id = t.id AND member_id = $1) AS mine,
  EXISTS (SELECT 1 FROM thread_saves sv WHERE sv.thread_id = t.id AND sv.member_id = $1) AS saved,
  (SELECT json_build_object('author', cu.username, 'body', left(regexp_replace(cp.body, '\\[img:[A-Za-z0-9_-]{16}\\][^\\n]*', '', 'g'), 200))
     FROM posts cp LEFT JOIN members cu ON cu.id = cp.user_id
    WHERE cp.thread_id = t.id AND NOT cp.deleted
      AND NOT EXISTS (SELECT 1 FROM blocks cb WHERE cb.blocker_id = $1 AND cb.blocked_id = cp.user_id)
    ORDER BY cp.created_at DESC LIMIT 1) AS last_comment`;

const FROM = `
  FROM threads t
  LEFT JOIN members u ON u.id = t.user_id
  LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $1
  LEFT JOIN listings lst ON lst.thread_id = t.id`;

export type Sort = 'recent' | 'new' | 'top';
export const SORTS: { id: Sort; name: string }[] = [
  { id: 'recent', name: 'Recent' },
  { id: 'new', name: 'New' },
  { id: 'top', name: 'Top' },
];
export const sortOf = (v?: string): Sort => (v === 'new' || v === 'top' ? v : 'recent');

// Engagement: comments, likes (double), and how many different people joined in.
const ENGAGEMENT = `(t.reply_count
  + 2 * (SELECT count(*) FROM props WHERE target = 'thread' AND target_id = t.id)
  + 1.5 * (SELECT count(DISTINCT p.user_id) FROM posts p WHERE p.thread_id = t.id AND NOT p.deleted))`;

const ORDER: Record<Sort, string> = {
  recent: 't.last_post_at DESC',
  new: 't.created_at DESC',
  top: `${ENGAGEMENT} DESC, t.last_post_at DESC`,
};

/** Threads for a board / sub-forum (or everything), with an unread flag for `me`. Pinned first on Recent. */
export async function listThreads(me: User, opts: { board?: string; topic?: string; sort?: Sort; page?: number; limit?: number; offset?: number; cards?: boolean } = {}) {
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const offset = Math.max(0, opts.offset ?? (page - 1) * limit);
  const sort = opts.sort ?? 'recent';
  const rows = await q<ThreadRow>(
    `SELECT ${COLUMNS}${opts.cards ? CARD_COLUMNS : ''} ${FROM}
      WHERE ${LIVE} AND ${UNBLOCKED} AND ($3::text IS NULL OR t.board = $3) AND ($6::text IS NULL OR t.topic = $6)
        ${sort === 'top' ? `AND t.created_at > now() - interval '30 days'` : ''}
      ORDER BY ${opts.board && sort === 'recent' ? 't.pinned DESC,' : ''} ${ORDER[sort]}, t.id DESC
      LIMIT $4 OFFSET $5`,
    [me.id, me.created_at, opts.board ?? null, limit + 1, offset, opts.topic ?? null],
  );
  return { rows: rows.slice(0, limit), more: rows.length > limit, page };
}

/**
 * The home feed: recent activity, with good threads held up longer. Score = engagement (plus a
 * nudge for threads with pictures) divided by age since the last comment, so fresh things rise
 * and busy threads stay up a while. Threads you haven't opened get a lift; ones you've fully
 * read sink a little, so the feed keeps moving.
 */
export async function feedThreads(me: User, limit = 25, offset = 0, cards = false) {
  return q<ThreadRow>(
    `SELECT ${COLUMNS}${cards ? CARD_COLUMNS : ''} ${FROM}
      WHERE ${LIVE} AND ${UNBLOCKED} AND t.last_post_at > now() - interval '120 days'
      ORDER BY
        (1 + ${ENGAGEMENT} + CASE WHEN t.body ~ '\\[img:' THEN 2 ELSE 0 END)
        * CASE WHEN r.read_at IS NULL THEN 1.25 WHEN r.read_at < t.last_post_at THEN 1.1 ELSE 0.55 END
        / power(extract(epoch FROM now() - t.last_post_at) / 3600.0 + 2, 1.35) DESC, t.id DESC
      LIMIT $3 OFFSET $4`,
    [me.id, me.created_at, limit, offset],
  );
}

export type TopicStat = {
  board: string; topic: string | null; threads: number; comments: number; unread: number;
  last: string | null; latest_id: number | null; latest_title: string | null; latest_author: string | null;
};

/** Per sub-forum: counts, new activity for `me`, and the latest thread. Keyed "board/topic". */
export async function topicStats(me: User, board?: string) {
  const rows = await q<TopicStat>(
    `SELECT t.board, t.topic, count(*)::int AS threads, COALESCE(sum(t.reply_count), 0)::int AS comments,
            count(*) FILTER (WHERE COALESCE(r.read_at < t.last_post_at, t.last_post_at > $2))::int AS unread,
            max(t.last_post_at) AS last,
            (array_agg(t.id ORDER BY t.last_post_at DESC))[1] AS latest_id,
            (array_agg(t.title ORDER BY t.last_post_at DESC))[1] AS latest_title,
            (array_agg(u.username ORDER BY t.last_post_at DESC))[1] AS latest_author
       FROM threads t
       LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.member_id = $1
       LEFT JOIN members u ON u.id = t.user_id
      WHERE ${LIVE} AND ${UNBLOCKED} AND ($3::text IS NULL OR t.board = $3)
      GROUP BY t.board, t.topic`,
    [me.id, me.created_at, board ?? null],
  );
  return new Map(rows.map((r) => [`${r.board}/${r.topic ?? ''}`, r]));
}

/** Most used #tags in the last two months of threads. */
export async function popularTags(limit = 12) {
  return q<{ tag: string; n: number }>(
    `SELECT lower(m[2]) AS tag, count(DISTINCT t.id)::int AS n
       FROM threads t, regexp_matches(t.body, '(^|[^A-Za-z0-9_&#/])#([A-Za-z][A-Za-z0-9_]{1,29})', 'g') AS m
      WHERE ${LIVE} AND t.created_at > now() - interval '60 days'
      GROUP BY 1 ORDER BY n DESC, tag LIMIT $1`,
    [limit],
  );
}

/** Threads `me` saved, newest save first. */
export async function savedThreads(me: User) {
  return q<ThreadRow>(
    `SELECT ${COLUMNS} ${FROM}
       JOIN thread_saves s ON s.thread_id = t.id AND s.member_id = $1
      WHERE ${LIVE} AND ${UNBLOCKED}
      ORDER BY s.created_at DESC LIMIT 200`,
    [me.id, me.created_at],
  );
}

// Vanished threads are deleted for real: comments, likes, alerts, images, everything.
// Runs at most once a minute per server, from any members page.
let lastPurge = 0;
export async function purgeExpired() {
  if (Date.now() - lastPurge < 60_000) return;
  lastPurge = Date.now();
  const gone = await q<{ id: number; body: string; user_id: number | null }>(
    'SELECT id, body, user_id FROM threads WHERE expires_at IS NOT NULL AND expires_at <= now()',
  );
  if (!gone.length) return;
  const ids = gone.map((t) => t.id);
  const posts = await q<{ id: number; body: string; user_id: number | null }>('SELECT id, body, user_id FROM posts WHERE thread_id = ANY($1::int[])', [ids]);
  await dropMedia([...gone, ...posts]);
  await q(
    `DELETE FROM props WHERE (target = 'thread' AND target_id = ANY($1::int[])) OR (target = 'post' AND target_id = ANY($2::int[]))`,
    [ids, posts.map((p) => p.id)],
  );
  await q('DELETE FROM threads WHERE id = ANY($1::int[])', [ids]);
}
