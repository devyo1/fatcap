'use server';

import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser, usernameKey } from '@/lib/auth';
import { str } from '@/lib/format';

/** Block / unblock a member: hides their posts from you and stops DMs and alerts both ways. */
export async function toggleBlock(form: FormData) {
  const me = await requireUser();
  const m = await one<{ id: number; username: string }>('SELECT id, username FROM members WHERE username_key = $1', [usernameKey(str(form.get('name')))]);
  if (!m || m.id === me.id) redirect('/forum');
  const removed = await q('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING 1', [me.id, m!.id]);
  if (!removed.length) await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.id, m!.id]);
  const b = str(form.get('back'));
  redirect(b.startsWith('/') && !b.startsWith('//') ? b : `/u/${encodeURIComponent(m!.username)}`);
}
