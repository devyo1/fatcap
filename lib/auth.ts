import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q, one } from './db';
import { LIMITS } from './config';

const COOKIE = 'fc_session';
const SESSION_DAYS = 30;

export type User = { id: number; username: string; is_admin: boolean; created_at: string };

let dummyHash: string | null = null;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function usernameKey(name: string) {
  return name.trim().toLowerCase();
}

/** Returns an error message, or null if the username is fine. */
export function checkUsername(name: string): string | null {
  const n = name.trim();
  const [min, max] = LIMITS.username;
  if (n.length < min || n.length > max) return `Username must be ${min}-${max} characters.`;
  if (!/^[A-Za-z0-9_.-]+$/.test(n)) return 'Letters, numbers, dots, dashes and underscores only.';
  return null;
}

export function checkNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < LIMITS.password) return `Password must be at least ${LIMITS.password} characters.`;
  if (pw !== confirm) return 'Passwords do not match.';
  return null;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha(token), userId, expires]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
  jar.delete(COOKIE);
}

/** The signed-in member, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const user = await one<User>(
    `SELECT u.id, u.username, u.is_admin, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.banned`,
    [sha(token)],
  );
  if (user) q('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]).catch(() => {});
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await currentUser();
  if (!user?.is_admin) notFound();
  return user;
}

/** Username + password check. Returns the user id, or null. */
export async function verifyLogin(username: string, password: string): Promise<number | null> {
  const row = await one<{ id: number; password_hash: string; banned: boolean }>(
    'SELECT id, password_hash, banned FROM users WHERE username_key = $1',
    [usernameKey(username)],
  );
  // Compare against a dummy hash when the user doesn't exist so timing doesn't leak it.
  dummyHash ??= await hashPassword('not-a-real-password');
  const ok = await checkPassword(password, row?.password_hash ?? dummyHash);
  if (!row || !ok || row.banned) return null;
  return row.id;
}
