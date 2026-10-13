import { NextResponse } from 'next/server';
import { verifyLogin, startSession, usernameKey } from '@/lib/auth';
import { q, one } from '@/lib/db';

// After this many wrong passwords for one username in the window, that username is paused.
// Counted per username only: no IP addresses are stored.
const TRIES = 8;
const WINDOW = '15 minutes';

// Used by the login box on the landing page.
export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown } = {};
  try { body = await req.json(); } catch {}
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const key = usernameKey(username).slice(0, 40);

  if (key) {
    const fails = await one<{ n: number }>(`SELECT count(*)::int AS n FROM login_failures WHERE username_key = $1 AND at > now() - interval '${WINDOW}'`, [key]);
    if ((fails?.n ?? 0) >= TRIES) {
      return NextResponse.json({ ok: false, error: 'Too many tries. Wait 15 minutes.' }, { status: 429 });
    }
  }

  const id = username && password ? await verifyLogin(username, password) : null;
  if (!id) {
    if (key) {
      await q('INSERT INTO login_failures (username_key) VALUES ($1)', [key]);
      q(`DELETE FROM login_failures WHERE at < now() - interval '1 day'`).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await q('DELETE FROM login_failures WHERE username_key = $1', [key]);
  await startSession(id);
  return NextResponse.json({ ok: true, next: '/forum' });
}
