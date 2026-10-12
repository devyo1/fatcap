import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Lets the landing page swap "Log in" for "Enter" when you're already signed in.
export async function GET() {
  const user = await currentUser().catch(() => null);
  return NextResponse.json({ user: user ? { username: user.username } : null });
}
