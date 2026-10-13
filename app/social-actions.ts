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

// In-place toggles: they set a state (so a repeated request can't flip it back) and say where it
// ended up. No redirect, so nothing reloads and the page stays exactly where you were.

/** Like (or unlike) a thread or a comment. */
export async function setLike(target: 'thread' | 'post', id: number, on: boolean): Promise<{ on: boolean; count: number }> {
  const me = await requireUser();
  const t = target === 'thread' ? 'thread' : 'post';
  const n = Math.floor(Number(id)) || 0;
  if (on) await q('INSERT INTO props (member_id, target, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [me.id, t, n]);
  else await q('DELETE FROM props WHERE member_id = $1 AND target = $2 AND target_id = $3', [me.id, t, n]);
  const c = await one<{ n: number }>('SELECT count(*)::int AS n FROM props WHERE target = $1 AND target_id = $2', [t, n]);
  return { on, count: c?.n ?? 0 };
}

/** Follow a thread (alerts for new comments), or stop. Unfollowing sticks, even if you comment again. */
export async function setFollow(id: number, on: boolean): Promise<{ on: boolean }> {
  const me = await requireUser();
  await q(
    `INSERT INTO thread_follows (member_id, thread_id, following) VALUES ($1, $2, $3)
     ON CONFLICT (member_id, thread_id) DO UPDATE SET following = EXCLUDED.following`,
    [me.id, Math.floor(Number(id)) || 0, !!on],
  );
  return { on: !!on };
}

/** Save a thread (private, under Saved), or take it off. */
export async function setSave(id: number, on: boolean): Promise<{ on: boolean }> {
  const me = await requireUser();
  const n = Math.floor(Number(id)) || 0;
  if (on) await q('INSERT INTO thread_saves (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.id, n]);
  else await q('DELETE FROM thread_saves WHERE member_id = $1 AND thread_id = $2', [me.id, n]);
  return { on: !!on };
}

/** Show (or hide) the zines and books you own on your profile. */
export async function setCollectionShown(on: boolean): Promise<{ on: boolean }> {
  const me = await requireUser();
  await q('UPDATE members SET show_collection = $2 WHERE id = $1', [me.id, !!on]);
  return { on: !!on };
}
