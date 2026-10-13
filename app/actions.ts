'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { q, one } from '@/lib/db';
import {
  requireUser, requireAdmin, startSession, endSession, hashPassword, checkPassword,
  checkUsername, checkNewPassword, usernameKey,
} from '@/lib/auth';
import { CITY, LIMITS, REPORT_REASONS, parsePlace, vanishDays, isMarket } from '@/lib/config';
import { createStickerBatch, memberInvite } from '@/lib/invites';
import { str } from '@/lib/format';
import { notify, notifyFollowers, idsForNames } from '@/lib/notify';
import { mentionsIn } from '@/components/RichText';
import { dropMedia, pinThreadMedia } from '@/lib/media';
import { LIVE } from '@/lib/threads';

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

/** "", "never" or a number of days from the vanish picker -> the new expiry (undefined = leave as is). */
function vanishFrom(v: string): Date | null | undefined {
  if (v === 'never') return null;
  const days = vanishDays(v);
  return days ? new Date(Date.now() + days * 864e5) : undefined;
}

const follow = (memberId: number, threadId: number) =>
  q('INSERT INTO thread_follows (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [memberId, threadId]);

export async function createThread(form: FormData) {
  const me = await requireUser();
  const raw = str(form.get('place'));
  const place = parsePlace(raw);
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  const price = str(form.get('price')).trim().slice(0, LIMITS.price) || null;
  const path = `/forum/${raw.split('/')[0] || 'general'}/new`;
  if (!place) back(path, 'Select a section.');
  if (!title) back(path, 'Title required.');
  if (!body) back(path, 'Post is empty.');
  if (title.length > LIMITS.title) back(path, `Title too long (max ${LIMITS.title}).`);
  if (body.length > LIMITS.body) back(path, `Post too long (max ${LIMITS.body}).`);
  const expires = vanishFrom(str(form.get('vanish'))) ?? null;
  const market = isMarket(place!.board);

  const t = await one<{ id: number }>(
    `INSERT INTO threads (city, board, topic, user_id, title, body, expires_at, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [CITY, place!.board, place!.topic, me.id, title, body, expires, market ? price : null, market ? 'open' : null],
  );
  await pinThreadMedia(t!.id, body, me.id, expires);
  await follow(me.id, t!.id);
  await notify([{ kind: 'mention', ids: await idsForNames(mentionsIn(body)) }], me.id, { threadId: t!.id });
  redirect(`/forum/t/${t!.id}`);
}

/** Reply to a thread, or to a comment inside it (parent). */
export async function reply(form: FormData) {
  const me = await requireUser();
  const threadId = Number(form.get('thread'));
  const parentId = Number(form.get('parent')) || null;
  const body = str(form.get('body')).trim();
  const path = `/forum/t/${threadId}`;
  const thread = await one<{ id: number; user_id: number | null; locked: boolean }>(
    `SELECT id, user_id, locked FROM threads t WHERE id = $1 AND ${LIVE}`, [threadId],
  );
  if (!thread) redirect('/forum');
  if (thread!.locked && !me.is_admin) back(path, 'Thread is locked.');
  if (!body) back(path, 'Comment is empty.');
  if (body.length > LIMITS.comment) back(path, `Comment too long (max ${LIMITS.comment}).`);

  let parentAuthor: number | null = null;
  if (parentId) {
    const parent = await one<{ user_id: number | null }>('SELECT user_id FROM posts WHERE id = $1 AND thread_id = $2', [parentId, threadId]);
    if (!parent) back(path, 'Comment not found.');
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
  await follow(me.id, threadId);
  // The person being answered and anyone @mentioned hear first; then everyone following the thread.
  const told = await notify(
    [
      { kind: 'comment_reply', ids: [parentAuthor] },
      { kind: 'mention', ids: await idsForNames(mentionsIn(body)) },
    ],
    me.id, { threadId, postId: p!.id },
  );
  await notifyFollowers(threadId, thread!.user_id, me.id, p!.id, told);
  redirect(`${path}#p${p!.id}`);
}

export async function editThread(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const title = str(form.get('title')).trim();
  const body = str(form.get('body')).trim();
  const path = `/forum/t/${id}`;
  const t = await one<{ user_id: number; board: string; expires_at: string | null }>(`SELECT user_id, board, expires_at FROM threads t WHERE id = $1 AND ${LIVE}`, [id]);
  if (!t || t.user_id !== me.id) redirect('/forum');
  if (!title || !body) back(path, 'Title and post are required.');
  if (title.length > LIMITS.title || body.length > LIMITS.body) back(path, 'Too long.');
  const place = parsePlace(str(form.get('place')));
  const vanish = vanishFrom(str(form.get('vanish')));
  const expires = vanish === undefined ? t!.expires_at : vanish;
  const market = isMarket(place?.board ?? t!.board);
  const price = str(form.get('price')).trim().slice(0, LIMITS.price) || null;
  await q(
    `UPDATE threads SET title = $1, body = $2, edited_at = now(),
            board = COALESCE($4, board), topic = CASE WHEN $4::text IS NULL THEN topic ELSE $5 END,
            expires_at = $6, price = CASE WHEN $7 THEN $8 ELSE price END
      WHERE id = $3`,
    [title, body, id, place?.board ?? null, place?.topic ?? null, expires, market, price],
  );
  await pinThreadMedia(id, body, me.id, expires);
  redirect(path);
}

/** Admins can move any thread to another section. */
export async function moveThread(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const place = parsePlace(str(form.get('place')));
  if (place) {
    await q(
      `UPDATE threads SET board = $1, topic = $2, status = CASE WHEN $4 THEN COALESCE(status, 'open') ELSE NULL END WHERE id = $3`,
      [place.board, place.topic, id, isMarket(place.board)],
    );
  }
  redirect(`/forum/t/${id}`);
}

export async function editPost(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const body = str(form.get('body')).trim();
  const p = await one<{ user_id: number; thread_id: number }>('SELECT user_id, thread_id FROM posts WHERE id = $1 AND NOT deleted', [id]);
  if (!p || p.user_id !== me.id) redirect('/forum');
  const path = `/forum/t/${p!.thread_id}`;
  if (!body) back(path, 'Comment is empty. Delete it instead.');
  if (body.length > LIMITS.comment) back(path, 'Too long.');
  await q('UPDATE posts SET body = $1, edited_at = now() WHERE id = $2', [body, id]);
  redirect(`${path}#p${id}`);
}

export async function deleteThread(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const t = await one<{ user_id: number; board: string; body: string }>('SELECT user_id, board, body FROM threads WHERE id = $1', [id]);
  if (!t || (t.user_id !== me.id && !me.is_admin)) redirect('/forum');
  await q('UPDATE threads SET deleted = true WHERE id = $1', [id]);
  // The thread is gone for everyone, so its images (and the ones in its comments) go too.
  await q('DELETE FROM media WHERE thread_id = $1', [id]);
  await dropMedia([t!, ...(await q<{ body: string; user_id: number | null }>('SELECT body, user_id FROM posts WHERE thread_id = $1', [id]))]);
  redirect(`/forum/${t!.board}`);
}

export async function deletePost(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const p = await one<{ user_id: number; thread_id: number; body: string }>('SELECT user_id, thread_id, body FROM posts WHERE id = $1 AND NOT deleted', [id]);
  if (!p || (p.user_id !== me.id && !me.is_admin)) redirect('/forum');
  await q('UPDATE posts SET deleted = true WHERE id = $1', [id]);
  await dropMedia([p!]);
  await q('UPDATE threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1', [p!.thread_id]);
  redirect(`/forum/t/${p!.thread_id}#p${id}`);
}

/** Like or unlike a thread or comment. */
export async function toggleProps(form: FormData) {
  const me = await requireUser();
  const target = str(form.get('target')) === 'thread' ? 'thread' : 'post';
  const id = Number(form.get('id'));
  const removed = await q('DELETE FROM props WHERE member_id = $1 AND target = $2 AND target_id = $3 RETURNING 1', [me.id, target, id]);
  if (!removed.length) await q('INSERT INTO props (member_id, target, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [me.id, target, id]);
  redirect(safeBack(str(form.get('back'))));
}

/** Follow / unfollow a thread (alerts for new comments). Unfollowing sticks, even if you comment again. */
export async function toggleFollow(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  await q(
    `INSERT INTO thread_follows (member_id, thread_id, following) VALUES ($1, $2, true)
     ON CONFLICT (member_id, thread_id) DO UPDATE SET following = NOT thread_follows.following`,
    [me.id, id],
  );
  redirect(`/forum/t/${id}`);
}

export async function toggleSave(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  const removed = await q('DELETE FROM thread_saves WHERE member_id = $1 AND thread_id = $2 RETURNING 1', [me.id, id]);
  if (!removed.length) await q('INSERT INTO thread_saves (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.id, id]);
  redirect(safeBack(str(form.get('back')) || `/forum/t/${id}`));
}

/** Market: the seller (or an admin) marks a listing sold, or puts it back up. */
export async function toggleSold(form: FormData) {
  const me = await requireUser();
  const id = Number(form.get('id'));
  await q(
    `UPDATE threads SET status = CASE WHEN status = 'sold' THEN 'open' ELSE 'sold' END
      WHERE id = $1 AND status IS NOT NULL AND (user_id = $2 OR $3)`,
    [id, me.id, me.is_admin],
  );
  redirect(`/forum/t/${id}`);
}

export async function setThreadFlag(form: FormData) {
  await requireAdmin();
  const id = Number(form.get('id'));
  const flag = str(form.get('flag'));
  if (flag === 'pinned') await q('UPDATE threads SET pinned = NOT pinned WHERE id = $1', [id]);
  if (flag === 'locked') await q('UPDATE threads SET locked = NOT locked WHERE id = $1', [id]);
  redirect(`/forum/t/${id}`);
}

/* ---------- reports ---------- */

/** Flag a thread or comment for the admins. One open report per member per item. */
export async function report(form: FormData) {
  const me = await requireUser();
  const threadId = Number(form.get('thread'));
  const postId = Number(form.get('post')) || null;
  const reason = REPORT_REASONS.find((r) => r === str(form.get('reason'))) ?? 'Other';
  const note = str(form.get('note')).trim().slice(0, 500) || null;
  const path = `/forum/t/${threadId}`;
  const ok = postId
    ? await one('SELECT 1 FROM posts WHERE id = $1 AND thread_id = $2', [postId, threadId])
    : await one('SELECT 1 FROM threads WHERE id = $1', [threadId]);
  if (!ok) redirect('/forum');
  const row = await one<{ id: number }>(
    `INSERT INTO reports (member_id, thread_id, post_id, reason, note) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING RETURNING id`,
    [me.id, threadId, postId, reason, note],
  );
  if (row) {
    const admins = await q<{ id: number }>('SELECT id FROM members WHERE is_admin AND NOT banned');
    await notify([{ kind: 'report', ids: admins.map((a) => a.id) }], me.id, { threadId, postId });
  }
  redirect(`${path}?ok=${encodeURIComponent('Reported. Thanks.')}${postId ? `#p${postId}` : ''}`);
}

/** Admin: close a report (after acting on it, or not). */
export async function resolveReport(form: FormData) {
  const admin = await requireAdmin();
  const r = await one<{ thread_id: number; post_id: number | null }>(
    'UPDATE reports SET resolved_at = now(), resolved_by = $2 WHERE id = $1 AND resolved_at IS NULL RETURNING thread_id, post_id',
    [Number(form.get('id')), admin.id],
  );
  if (r && str(form.get('hide')) === '1') {
    // Hide it (restorable from Moderation), and close any other open reports about the same thing.
    if (r.post_id) {
      await q('UPDATE posts SET deleted = true WHERE id = $1', [r.post_id]);
      await q('UPDATE threads t SET reply_count = (SELECT count(*)::int FROM posts p WHERE p.thread_id = t.id AND NOT p.deleted) WHERE t.id = $1', [r.thread_id]);
    } else {
      await q('UPDATE threads SET deleted = true WHERE id = $1', [r.thread_id]);
    }
    await q(
      'UPDATE reports SET resolved_at = now(), resolved_by = $3 WHERE resolved_at IS NULL AND thread_id = $1 AND post_id IS NOT DISTINCT FROM $2',
      [r.thread_id, r.post_id, admin.id],
    );
  }
  redirect('/admin?tab=reports');
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
  if (await one('SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [me.id, to!.id])) back(path, "You can't message this member.");
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
  const path = '/settings';
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM members WHERE id = $1', [me.id]);
  if (!row || !(await checkPassword(str(form.get('current')), row.password_hash))) back(path, 'Current password is wrong.');
  const next = str(form.get('password'));
  const bad = checkNewPassword(next, str(form.get('confirm')));
  if (bad) back(path, bad);
  await q('UPDATE members SET password_hash = $1 WHERE id = $2', [await hashPassword(next), me.id]);
  redirect(`${path}?saved=password`);
}

export async function saveProfile(form: FormData) {
  const me = await requireUser();
  const bio = str(form.get('bio')).trim().slice(0, 300) || null;
  await q('UPDATE members SET bio = $1 WHERE id = $2', [bio, me.id]);
  redirect('/settings?saved=bio');
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
