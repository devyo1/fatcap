import 'server-only';
import { cookies } from 'next/headers';

/**
 * How the forum shows threads on this device: List (forum rows), Cards (one post at a time, the
 * same square frame for every post) or Grid (square tiles, three across). Set from the switch.
 */
export const VIEW_COOKIE = 'fc_view';
export type Layout = 'list' | 'cards' | 'grid';
export const LAYOUTS: Layout[] = ['list', 'cards', 'grid'];

export async function layoutOf(): Promise<Layout> {
  const v = (await cookies()).get(VIEW_COOKIE)?.value;
  return v === 'cards' || v === 'grid' ? v : 'list';
}
