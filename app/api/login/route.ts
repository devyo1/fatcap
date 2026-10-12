import { NextResponse } from 'next/server';
import { verifyLogin, startSession } from '@/lib/auth';

// Used by the login box on the landing page.
export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown } = {};
  try { body = await req.json(); } catch {}
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const id = username && password ? await verifyLogin(username, password) : null;
  if (!id) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await startSession(id);
  return NextResponse.json({ ok: true, next: '/forum' });
}
