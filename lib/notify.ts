import 'server-only';
import { q } from './db';

export type NotifyKind = 'reply' | 'comment_reply' | 'mention' | 'chat_mention' | 'chat_reply';

/** What an alert points at: a thread/comment, or a chat message. */
export type NotifyRef = { threadId?: number | null; postId?: number | null; chatId?: number | null };

/**
 * One alert per member. `targets` is in priority order: a member who appears
 * under more than one kind only gets the first one. The actor never alerts themselves.
 */
export async function notify(targets: { kind: NotifyKind; ids: (number | null | undefined)[] }[], actorId: number, ref: NotifyRef) {
  const seen = new Set<number>([actorId]);
  const rows: { member: number; kind: NotifyKind }[] = [];
  for (const t of targets) for (const id of t.ids) if (id && !seen.has(id)) { seen.add(id); rows.push({ member: id, kind: t.kind }); }
  if (!rows.length) return;
  await q(
    `INSERT INTO notifications (member_id, kind, actor_id, thread_id, post_id, chat_id)
     SELECT m, k, $3, $4, $5, $6 FROM unnest($1::int[], $2::text[]) AS t(m, k)
     WHERE EXISTS (SELECT 1 FROM members WHERE id = m AND NOT banned)`,
    [rows.map((r) => r.member), rows.map((r) => r.kind), actorId, ref.threadId ?? null, ref.postId ?? null, ref.chatId ?? null],
  );
}

/** Member ids for a list of lower-cased usernames. */
export async function idsForNames(names: string[]) {
  if (!names.length) return [];
  const rows = await q<{ id: number }>('SELECT id FROM members WHERE username_key = ANY($1::text[]) AND NOT banned', [names]);
  return rows.map((r) => r.id);
}
