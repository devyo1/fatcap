import 'server-only';
import { q } from './db';

export type NotifyKind = 'reply' | 'comment_reply' | 'mention' | 'chat_mention' | 'chat_reply' | 'follow' | 'report'
  // market
  | 'offer' | 'offer_accepted' | 'offer_declined' | 'bought' | 'bid' | 'outbid' | 'won' | 'auction_ended' | 'second_chance'
  | 'deal_paid' | 'deal_confirmed' | 'deal_sent' | 'deal_complete' | 'deal_cancelled'
  // review of Market posts: to admins (review), to the seller (approved / rejected)
  | 'review' | 'approved' | 'rejected';

/** What an alert points at: a thread/comment, or a chat message. */
export type NotifyRef = { threadId?: number | null; postId?: number | null; chatId?: number | null; dealId?: number | null };

/**
 * One alert per member. `targets` is in priority order: a member who appears
 * under more than one kind only gets the first one. The actor never alerts themselves.
 */
export async function notify(targets: { kind: NotifyKind; ids: (number | null | undefined)[] }[], actorId: number | null, ref: NotifyRef) {
  const seen = new Set<number>(actorId ? [actorId] : []);
  const rows: { member: number; kind: NotifyKind }[] = [];
  for (const t of targets) for (const id of t.ids) if (id && !seen.has(id)) { seen.add(id); rows.push({ member: id, kind: t.kind }); }
  if (!rows.length) return seen;
  await q(
    `INSERT INTO notifications (member_id, kind, actor_id, thread_id, post_id, chat_id, deal_id)
     SELECT m, k, $3::int, $4, $5, $6, $7 FROM unnest($1::int[], $2::text[]) AS t(m, k)
     WHERE EXISTS (SELECT 1 FROM members WHERE id = m AND NOT banned)
       AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = m AND blocked_id = $3::int)`,
    [rows.map((r) => r.member), rows.map((r) => r.kind), actorId || null, ref.threadId ?? null, ref.postId ?? null, ref.chatId ?? null, ref.dealId ?? null],
  );
  return seen;
}

/**
 * A new comment, for everyone following the thread (minus `skip`: the author and anyone already
 * alerted about it). An unread alert for the same thread is bumped instead of stacking a new one.
 * The thread starter's alert reads "on your thread", everyone else's "in".
 */
export async function notifyFollowers(threadId: number, starterId: number | null, actorId: number, postId: number, skip: Set<number>) {
  await q(
    `WITH f AS (
       SELECT tf.member_id FROM thread_follows tf JOIN members m ON m.id = tf.member_id
        WHERE tf.thread_id = $1 AND tf.following AND NOT m.banned AND NOT (tf.member_id = ANY($2::int[]))
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = tf.member_id AND blocked_id = $3)
     ), bumped AS (
       UPDATE notifications n SET actor_id = $3, post_id = $4, created_at = now(), count = n.count + 1
        WHERE n.thread_id = $1 AND n.kind IN ('follow', 'reply') AND n.read_at IS NULL AND n.member_id IN (SELECT member_id FROM f)
       RETURNING n.member_id
     )
     INSERT INTO notifications (member_id, kind, actor_id, thread_id, post_id)
     SELECT member_id, CASE WHEN member_id = $5 THEN 'reply' ELSE 'follow' END, $3, $1, $4
       FROM f WHERE member_id NOT IN (SELECT member_id FROM bumped)`,
    [threadId, [...skip], actorId, postId, starterId],
  );
}

/** Member ids for a list of lower-cased usernames. */
export async function idsForNames(names: string[]) {
  if (!names.length) return [];
  const rows = await q<{ id: number }>('SELECT id FROM members WHERE username_key = ANY($1::text[]) AND NOT banned', [names]);
  return rows.map((r) => r.id);
}

