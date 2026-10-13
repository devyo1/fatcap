'use server';

import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { VIEW_COOKIE, type Layout } from '@/lib/view';
import { boardBySlug, subBySlug } from '@/lib/config';
import { feedThreads, listThreads, sortOf } from '@/lib/threads';
import type { ThreadRow } from '@/components/ThreadRows';

export type MoreQuery = { view?: 'feed' | 'recent' | 'top'; board?: string; topic?: string; sort?: string; cards?: boolean };

/** List or cards, for this device. The page you're on re-renders in place. */
export async function setLayout(layout: Layout) {
  await requireUser();
  (await cookies()).set(VIEW_COOKIE, layout === 'cards' ? 'cards' : 'list', {
    path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production',
  });
}

/** The next stretch of a list (the home feed, a board, a sub-forum), for scrolling on without a page load. */
export async function moreThreads(query: MoreQuery, offset: number, limit: number): Promise<{ rows: ThreadRow[]; more: boolean }> {
  const me = await requireUser();
  const at = Math.max(0, Math.min(Math.floor(Number(offset) || 0), 1000));
  const size = Math.max(1, Math.min(Math.floor(Number(limit) || 25), 50));
  if (query.view === 'feed') {
    const rows = await feedThreads(me, size + 1, at, !!query.cards);
    return { rows: rows.slice(0, size), more: rows.length > size };
  }
  const board = query.board ? boardBySlug(query.board) : null;
  if (query.board && !board) return { rows: [], more: false };
  const topic = board && query.topic && subBySlug(board.slug, query.topic) ? query.topic : undefined;
  const sort = query.view === 'top' || query.view === 'recent' ? query.view : sortOf(query.sort);
  const { rows, more } = await listThreads(me, { board: board?.slug, topic, sort, offset: at, limit: size, cards: !!query.cards });
  return { rows, more };
}
