import 'server-only';
import { q } from './db';

// The chat wipes itself on a fixed schedule. Windows are CHAT_WIPE_HOURS long and
// start at 05:00 UTC (about 1am in Montreal), so a 24h chat resets every night.
const HOURS = Math.max(1, Number(process.env.CHAT_WIPE_HOURS) || 24);
const PERIOD = HOURS * 3600_000;
const OFFSET = 5 * 3600_000;

export const CHAT_MAX = 500;

/** Start of the current chat window and when it wipes next. */
export function chatWindow(now = Date.now()) {
  const start = Math.floor((now - OFFSET) / PERIOD) * PERIOD + OFFSET;
  return { start: new Date(start), wipeAt: new Date(start + PERIOD), hours: HOURS };
}

export type ChatMessage = { id: number; username: string | null; body: string; created_at: string };

/** Messages in the current window, newest 200, or only those after `afterId`. */
export async function chatMessages(afterId = 0) {
  const { start } = chatWindow();
  const rows = await q<ChatMessage>(
    `SELECT * FROM (
       SELECT c.id, m.username, c.body, c.created_at
         FROM chat_messages c LEFT JOIN members m ON m.id = c.member_id
        WHERE c.created_at >= $1 AND c.id > $2
        ORDER BY c.id DESC LIMIT 200
     ) x ORDER BY id`,
    [start, afterId],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}

/** Drop anything from earlier windows. Cheap, runs whenever someone posts. */
export async function wipeOld() {
  await q('DELETE FROM chat_messages WHERE created_at < $1', [chatWindow().start]);
}
