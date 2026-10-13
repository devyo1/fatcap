import 'server-only';
import { q } from './db';

// The chat wipes itself on a fixed schedule. Windows are CHAT_WIPE_HOURS long and
// start at 05:00 UTC (about 1am in Montreal), so a 24h chat resets every night.
const HOURS = Math.max(1, Number(process.env.CHAT_WIPE_HOURS) || 24);
const PERIOD = HOURS * 3600_000;
const OFFSET = 5 * 3600_000;

export const CHAT_MAX = 500;
export const CHAT_IMAGE_MAX = 3 * 1024 * 1024; // after the browser shrinks photos; GIFs are sent as-is
export const REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

/** Start of the current chat window and when it wipes next. */
export function chatWindow(now = Date.now()) {
  const start = Math.floor((now - OFFSET) / PERIOD) * PERIOD + OFFSET;
  return { start: new Date(start), wipeAt: new Date(start + PERIOD), hours: HOURS };
}

export type ChatMessage = {
  id: number; username: string | null; body: string; created_at: string;
  image_id: number | null; reply_to: number | null; reply_user: string | null; reply_body: string | null; reply_image: boolean;
};
export type ChatReactions = Record<number, { emoji: string; users: string[] }[]>;

/** Messages in the current window, newest 200, or only those after `afterId`. */
export async function chatMessages(afterId = 0) {
  const { start } = chatWindow();
  const rows = await q<ChatMessage>(
    `SELECT * FROM (
       SELECT c.id, m.username, c.body, c.created_at, c.image_id, c.reply_to,
              rm.username AS reply_user, left(r.body, 140) AS reply_body, (r.image_id IS NOT NULL) AS reply_image
         FROM chat_messages c
         LEFT JOIN members m ON m.id = c.member_id
         LEFT JOIN chat_messages r ON r.id = c.reply_to
         LEFT JOIN members rm ON rm.id = r.member_id
        WHERE c.created_at >= $1 AND c.id > $2
        ORDER BY c.id DESC LIMIT 200
     ) x ORDER BY id`,
    [start, afterId],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}

/** Every reaction in the current window, grouped per message and emoji. */
export async function chatReactions(): Promise<ChatReactions> {
  const rows = await q<{ message_id: number; emoji: string; users: string[] }>(
    `SELECT cr.message_id, cr.emoji, array_agg(m.username ORDER BY cr.created_at) AS users
       FROM chat_reactions cr
       JOIN chat_messages c ON c.id = cr.message_id
       JOIN members m ON m.id = cr.member_id
      WHERE c.created_at >= $1
      GROUP BY cr.message_id, cr.emoji
      ORDER BY min(cr.created_at)`,
    [chatWindow().start],
  );
  const out: ChatReactions = {};
  for (const r of rows) (out[r.message_id] ??= []).push({ emoji: r.emoji, users: r.users });
  return out;
}

/** Drop messages and pictures from earlier windows. Cheap, runs whenever someone posts. */
export async function wipeOld() {
  const { start } = chatWindow();
  await q('DELETE FROM chat_messages WHERE created_at < $1', [start]);
  await q('DELETE FROM chat_images WHERE created_at < $1', [start]);
}
