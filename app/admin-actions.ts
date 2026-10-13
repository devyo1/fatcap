'use server';

import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { str } from '@/lib/format';

const go = (tab: string, extra = '') => redirect(`/admin?tab=${tab}${extra}`);

/** Recount comments for the given threads after posts are hidden, restored or removed. */
async function recount(threadIds: number[]) {
  if (!threadIds.length) return;
  await q(
    `UPDATE threads t SET reply_count = (SELECT count(*)::int FROM posts p WHERE p.thread_id = t.id AND NOT p.deleted)
      WHERE t.id = ANY($1::int[])`,
    [threadIds],
  );
}

/** Admins can't act on themselves or on other admins (remove their admin first). */
async function target(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get('id'));
  const m = await one<{ id: number; is_admin: boolean; username: string }>('SELECT id, is_admin, username FROM members WHERE id = $1', [id]);
  if (!m || m.id === admin.id) go('members', '&error=' + encodeURIComponent("You can't do that to yourself."));
  return { admin, m: m! };
}

export async function banMember(form: FormData) {
  const { m } = await target(form);
  if (m.is_admin) go('members', '&error=' + encodeURIComponent('Remove their admin first.'));
  const reason = str(form.get('reason')).trim().slice(0, 200) || null;
  await q('UPDATE members SET banned = true, ban_reason = $2, banned_at = now() WHERE id = $1', [m.id, reason]);
  await q('DELETE FROM sessions WHERE user_id = $1', [m.id]);
  go('members', `&ok=${encodeURIComponent(`${m.username} is banned.`)}`);
}

export async function unbanMember(form: FormData) {
  const { m } = await target(form);
  await q('UPDATE members SET banned = false, ban_reason = NULL, banned_at = NULL WHERE id = $1', [m.id]);
  go('members', `&ok=${encodeURIComponent(`${m.username} is back in.`)}`);
}

export async function toggleAdmin(form: FormData) {
  const { m } = await target(form);
  await q('UPDATE members SET is_admin = NOT is_admin WHERE id = $1 AND NOT banned', [m.id]);
  go('members', `&ok=${encodeURIComponent(m.is_admin ? `${m.username} is no longer an admin.` : `${m.username} is now an admin.`)}`);
}

/** Hide every thread and comment a member has written. Reversible from Moderation. */
export async function wipeMemberPosts(form: FormData) {
  const { m } = await target(form);
  await q('UPDATE threads SET deleted = true WHERE user_id = $1', [m.id]);
  const touched = await q<{ thread_id: number }>('UPDATE posts SET deleted = true WHERE user_id = $1 AND NOT deleted RETURNING thread_id', [m.id]);
  await recount([...new Set(touched.map((t) => t.thread_id))]);
  go('members', `&ok=${encodeURIComponent(`Hid everything ${m.username} posted.`)}`);
}

/** Hide or restore one thread or comment. */
export async function moderate(form: FormData) {
  await requireAdmin();
  const kind = str(form.get('kind')) === 'thread' ? 'threads' : 'posts';
  const id = Number(form.get('id'));
  const hide = str(form.get('do')) === 'hide';
  const row = await one<{ thread_id: number }>(
    `UPDATE ${kind} SET deleted = $2 WHERE id = $1 RETURNING ${kind === 'threads' ? 'id' : 'thread_id'} AS thread_id`,
    [id, hide],
  );
  if (row && kind === 'posts') await recount([row.thread_id]);
  go('moderation');
}

/** Delete every mock member and everything they posted. */
export async function removeMock() {
  await requireAdmin();
  const mock = (await q<{ id: number }>('SELECT id FROM members WHERE is_mock')).map((r) => r.id);
  if (mock.length) {
    await q('DELETE FROM deals WHERE seller_id = ANY($1::int[]) OR buyer_id = ANY($1::int[])', [mock]);
    const touched = await q<{ thread_id: number }>('DELETE FROM posts WHERE user_id = ANY($1::int[]) RETURNING thread_id', [mock]);
    await q('DELETE FROM threads WHERE user_id = ANY($1::int[])', [mock]);
    await q(`DELETE FROM props WHERE (target = 'post' AND target_id NOT IN (SELECT id FROM posts)) OR (target = 'thread' AND target_id NOT IN (SELECT id FROM threads))`);
    await q('DELETE FROM members WHERE id = ANY($1::int[])', [mock]);
    const live = await q<{ id: number }>('SELECT id FROM threads WHERE id = ANY($1::int[])', [[...new Set(touched.map((t) => t.thread_id))]]);
    await recount(live.map((t) => t.id));
  }
  go('overview', `&ok=${encodeURIComponent(mock.length ? `Removed ${mock.length} mock members and everything they posted.` : 'No mock content left.')}`);
}
