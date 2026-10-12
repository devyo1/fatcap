'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { q, one } from '@/lib/db';
import {
  requireUser, requireAdmin, startSession, endSession, hashPassword, checkPassword,
  checkUsername, checkNewPassword, usernameKey,
} from '@/lib/auth';
import { CITY, LIMITS, boardBySlug } from '@/lib/config';
import { createStickerBatch, memberInvite } from '@/lib/invites';
import { str } from '@/lib/format';
import { notify, idsForNames } from '@/lib/notify';
import { mentionsIn } from '@/components/RichText';

/** Only allow redirects back to our own pages. */
const safeBack = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? p : '/forum');

const back = (path: string, err: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(err)}`);

/* ---------- session ---------- */

export async function logout() {
  await endSession();
  redirect('/');
}

/* ---------- joining ---------- */

async function createMember(username: string, password: string, inviteId: number, isAdmin = false) {
  const hash = await hashPassword(password);
  const user = await one<{ id: number }>(
    `INSERT INTO members (username, username_key, password_hash, invited_via, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username_key) DO NOTHING RETURNING id`,
    [username.trim(), usernameKey(username), hash, inviteId, isAdmin],
  );
  return user?.id ?? null;
}

export async function redeemInvite(form: FormData) {
  const code = str(form.get('code')).toUpperCase();
  const username = str(form.get('username'));
  const password = str(form.get('password'));
  const path = `/i/${code}`;

  const bad = checkUsername(username) ?? checkNewPassword(password, str(form.get('confirm')));
  if (bad) back(path, bad);
  if (await one('SELECT 1 FROM members WHERE username_key = $1', [usernameKey(username)])) back(path, 'That username is taken.');

  // Claim the invite first. Only one person can win this update.
  const claim = await one<{ id: number }>(
    'UPDATE invites SET used_at = now() WHERE code = $1 AND used_at IS NULL AND NOT revoked RETURNING id',
    [code],
  );
  if (!claim) back(path, 'This invite has already been used.');

  const userId = await createMember(username, password, claim!.id);
  if (!userId) {
    await q('UPDATE invites SET used_at = NULL WHERE id = $1', [claim!.id]);
    back(path, 'That username is taken.');
  }
  await q('UPDATE invites SET used_by = $1 WHERE id = $2', [userId, claim!.id]);
  await memberInvite(userId!);
  await startSession(userId!);
  redirect('/forum?welcome=1');
}

export async function setupAdmin(form: FormData) {
  const token = str(form.get('token'));
  const expected = process.env.SETUP_TOKEN;
  const path = `/setup?token=${encodeURIComponent(token)}`;
  if (!expected || token !== expected) redirect('/');
  if (await one('SELECT 1 FROM members LIMIT 1')) redirect('/');

  const username = str(form.get('username'));
  const password = str(form.get('password'));
  const bad = checkUsername(username) ?? checkNewPassword(password, str(form.get('confirm')));
  if (bad) back(path, bad);

  const inv = await one<{ id: number }>(
    `INSERT INTO invites (code, kind, used_at) VALUES ($1, 'setup', now()) RETURNING id`,
    ['SETUP-' + randomBytes(4).toString('hex').toUpperCase()],
  );
  const userId = await createMember(username, password, inv!.id, true);
  if (!userId) back(path, 'Could not create the account.');
  await q('UPDATE invites SET used_by = $1 WHERE id = $2', [userId, inv!.id]);
  await memberInvite(userId!);
  await startSession(userId!);
  redirect('/admin');
}

/* ---------- forum ---------- */

export async function createThread(form: FormData) {
  const me = await requireUser();
  const board = boardBySlug(str(form.get('board')));
  if (!board) redirect('/forum');
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  const path = `/forum/${board!.slug}/new`;
  if (!title) back(path, 'Give it a title.');
  if (!body) back(path, 'Write something.');
  if (title.length > LIMITS.title) back(path, `Title is too long (max ${LIMITS.title}).`);
  if (body.length > LIMITS.body) back(path, `Post is too long (max ${LIMITS.body}).`);

  const t = await one<{ id: number }>(
    'INSERT INTO threads (city, board, user_id, title, body) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [CITY, board!.slug, me.id, title, body],
  );
  await notify([{ kind: 'mention', ids: await idsForNames(mentionsIn(body)) }], me.id, t!.id, null);
  redirect(`/forum/t/${t!.id}`);
}

/** Reply to a thread, or to a comment inside it (parent). */
export async function reply(form: FormData) {
  const me = await requireUser();
  const threadId = Number(form.get('thread'));
  const parentId = Number(form.get('parent')) || null;
  const body = str(form.get('body')).trim();
  const path = `/forum/t/${threadId}`;
  const thread = await one<{ id: number; user_id: number | null; locked: boolean }>('SELECT id, user_id, locked FROM threads WHERE id = $1 AND NOT deleted', [threadId]);
  if (!thread) redirect('/forum');
  if (thread!.locked && !me.is_admin) back(path, 'This thread is locked.');
  if (!body) back(path, 'Write something.');
  if (body.length > LIMITS.body) back(path, `Reply is too long (max ${LIMITS.body}).`);

  let parentAuthor: number | null = null;
  if (parentId) {
    const parent = await one<{ user_id: number | null }>('SELECT user_id FROM posts WHERE id = $1 AND thread_id = $2', [parentId, threadId]);
    if (!parent) back(path, 'That comment is gone.');
    parentAuthor = parent!.user_id;
  }

  const p = await one<{ id: number }>(
    'INSERT INTO posts (thread_id, user_id, body, parent_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [threadId, me.id, body, parentId],
  );
  await q('UPDATE threads SET reply_count = reply_count + 1, last_post_at = now() WHERE id = $1', [threadId]);
  await q(
    `INSERT INTO thread_reads (member_id, thread_id, read_at) VALUES ($1, $2, now())
     ON CONFLICT (member_id, thread_id) DO UPDATE SET read_at = now()`,
    [me.id, threadId],
  );
  // Whoever wrote the comment being answered hears about it first, then the thread starter, then anyone @mentioned.
  await notify(
    [
      { kind: 'comment_reply', ids: [parentAuthor] },
      { kind: 'reply', ids: [thread!.user_id] },
      { kind: 'mention', ids: await idsForNames(mentionsIn(body)) },
    ],
    me.id, threadId, p!.id,
  );
  redirect(`${path}#p${p!.id}`);
}

export async function editThread(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  const path = `/forum/t/${id}`;
  const t = await one<{ user_id: number }>('SELECT user_id FROM threads WHERE id = $1 AND NOT deleted', [id]);
  if (!t || (t.user_id !== me.id && !me.is_admin)) redirect('/forum');
  if (!title || !body) back(path, "Title and post can't be empty.");
  if (title.length > LIMITS.title || body.length > LIMITS.body) back(path, 'Too long.');
  await q('UPDATE threads SET title = $1, body = $2, edited_at = now() WHERE id = $3', [title, body, id]);
  redirect(path);
}

export async function editPost(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const body = str(form.get('body')).trim();
  const p = await one<{ user_id: number; thread_id: number }>('SELECT user_id, thread_id FROM posts WHERE id = $1 AND NOT deleted', [id]);
  if (!p || (p.user_id !== me.id && !me.is_admin)) redirect('/forum');
  const path = `/forum/t/${p!.thread_id}`;
  if (!body) back(path, "A comment can't be empty. Delete it instead.");
  if (body.length > LIMITS.body) back(path, 'Too long.');
  await q('UPDATE posts SET body = $1, edited_at = now() WHERE id = $2', [body, id]);
  redirect(`${path}#p${id}`);
}

export async function deleteThread(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const t = await one<{ user_id: number; board: string }>('SELECT user_id, board FROM threads WHERE id = $1', [id]);
  if (!t || (t.user_id !== me.id && !me.is_admin)) redirect('/forum');
  await q('UPDATE threads SET deleted = true WHERE id = $1', [id]);
  redirect(`/forum/${t!.board}`);
}

export async function deletePost(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const p = await one<{ user_id: number; thread_id: number }>('SELECT user_id, thread_id FROM posts WHERE id = $1 AND NOT deleted', [id]);
  if (!p || (p.user_id !== me.id && !me.is_admin)) redirect('/forum');
  await q('UPDATE posts SET deleted = true WHERE id = $1', [id]);
  await q('UPDATE threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1', [p!.thread_id]);
  redirect(`/forum/t/${p!.thread_id}#p${id}`);
}

/** Give or take back props on a thread or comment. */
export async function toggleProps(form: FormData) {
  const me = await requireUser();
  const target = str(form.get('target')) === 'thread' ? 'thread' : 'post';
  const id = Number(form.get('id'));
  const removed = await q('DELETE FROM props WHERE member_id = $1 AND target = $2 AND target_id = $3 RETURNING 1', [me.id, target, id]);
  if (!removed.length) await q('INSERT INTO props (member_id, target, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [me.id, target, id]);
  redirect(safeBack(str(form.get('back'))));
}

export async function setThreadFlag(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const flag = str(form.get('flag'));
  if (flag === 'pinned') await q('UPDATE threads SET pinned = NOT pinned WHERE id = $1', [id]);
  if (flag === 'locked') await q('UPDATE threads SET locked = NOT locked WHERE id = $1', [id]);
  redirect(`/forum/t/${id}`);
}

/* ---------- alerts ---------- */

export async function markAlertsRead() {
  const me = await requireUser();
  await q('UPDATE notifications SET read_at = now() WHERE member_id = $1 AND read_at IS NULL', [me.id]);
  redirect('/alerts');
}

/* ---------- private messages ---------- */

export async function sendMessage(form: FormData) {
  const me = await requireUser();
  const toName = str(form.get('to'));
  const body = str(form.get('body')).trim();
  const path = `/messages/${encodeURIComponent(toName)}`;
  const to = await one<{ id: number }>('SELECT id FROM members WHERE username_key = $1 AND NOT banned', [usernameKey(toName)]);
  if (!to || to.id === me.id) redirect('/messages');
  if (!body) back(path, 'Write something.');
  if (body.length > LIMITS.message) back(path, `Too long (max ${LIMITS.message}).`);

  const [a, b] = me.id < to!.id ? [me.id, to!.id] : [to!.id, me.id];
  const conv = await one<{ id: number }>(
    `INSERT INTO conversations (member_a, member_b) VALUES ($1, $2)
     ON CONFLICT (member_a, member_b) DO UPDATE SET member_a = EXCLUDED.member_a RETURNING id`,
    [a, b],
  );
  await q('INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)', [conv!.id, me.id, body]);
  await q(
    `UPDATE conversations SET last_message_at = now(), last_sender_id = $2,
            a_read_at = CASE WHEN member_a = $2 THEN now() ELSE a_read_at END,
            b_read_at = CASE WHEN member_b = $2 THEN now() ELSE b_read_at END
      WHERE id = $1`,
    [conv!.id, me.id],
  );
  redirect(`${path}#end`);
}

/* ---------- account ---------- */

export async function changePassword(form: FormData) {
  const me = await requireUser();
  const path = `/u/${encodeURIComponent(me.username)}`;
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM members WHERE id = $1', [me.id]);
  if (!row || !(await checkPassword(str(form.get('current')), row.password_hash))) back(path, 'Current password is wrong.');
  const next = str(form.get('password'));
  const bad = checkNewPassword(next, str(form.get('confirm')));
  if (bad) back(path, bad);
  await q('UPDATE members SET password_hash = $1 WHERE id = $2', [await hashPassword(next), me.id]);
  redirect(`${path}?saved=1`);
}

/* ---------- admin ---------- */

export async function makeStickers(form: FormData) {
  const admin = await requireAdmin();
  const count = Math.floor(Number(form.get('count')));
  const batch = str(form.get('batch')).trim().slice(0, 40) || new Date().toISOString().slice(0, 10);
  if (!(count >= 1 && count <= 200)) back('/admin?tab=stickers', 'Make between 1 and 200 at a time.');
  await createStickerBatch(batch, count, admin.id);
  redirect(`/admin/sheet/${encodeURIComponent(batch)}`);
}

export async function revokeInvite(form: FormData) {
  await requireAdmin();
  await q('UPDATE invites SET revoked = true WHERE id = $1 AND used_at IS NULL', [Number(form.get('id'))]);
  redirect(safeBack(str(form.get('back'))));
}

export async function toggleBan(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get('id'));
  if (id === admin.id) back('/admin?tab=members', "You can't ban yourself.");
  await q('UPDATE members SET banned = NOT banned WHERE id = $1 AND NOT is_admin', [id]);
  await q('DELETE FROM sessions WHERE user_id = $1 AND (SELECT banned FROM members WHERE id = $1)', [id]);
  redirect('/admin?tab=members');
}

export async function resetPassword(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const temp = randomBytes(6).toString('base64url');
  const user = await one<{ username: string }>('UPDATE members SET password_hash = $1 WHERE id = $2 RETURNING username', [await hashPassword(temp), id]);
  await q('DELETE FROM sessions WHERE user_id = $1', [id]);
  // Shown once on the admin page, never put in a URL.
  (await cookies()).set('fc_flash', JSON.stringify({ user: user?.username, temp }), { httpOnly: true, sameSite: 'lax', path: '/admin', maxAge: 60 });
  redirect('/admin?tab=members');
}
