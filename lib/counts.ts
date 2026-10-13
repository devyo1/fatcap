import 'server-only';
import { one } from './db';
import { marketTodo } from './market';

/** Unread conversations, unread alerts, and market things waiting on a member. */
export async function unreadCounts(memberId: number) {
  const row = await one<{ messages: number; alerts: number }>(
    `SELECT
       (SELECT count(*)::int FROM conversations c
         WHERE (c.member_a = $1 OR c.member_b = $1)
           AND c.last_sender_id IS NOT NULL AND c.last_sender_id <> $1
           AND COALESCE(CASE WHEN c.member_a = $1 THEN c.a_read_at ELSE c.b_read_at END < c.last_message_at, true)) AS messages,
       (SELECT count(*)::int FROM notifications WHERE member_id = $1 AND read_at IS NULL) AS alerts`,
    [memberId],
  );
  return { messages: row?.messages ?? 0, alerts: row?.alerts ?? 0, market: await marketTodo(memberId) };
}
