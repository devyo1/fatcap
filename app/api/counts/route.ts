import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { unreadCounts } from '@/lib/counts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await currentUser().catch(() => null);
  if (!me) return NextResponse.json({ messages: 0, alerts: 0, market: 0 }, { status: 401 });
  return NextResponse.json(await unreadCounts(me.id));
}
