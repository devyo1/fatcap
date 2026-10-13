import 'server-only';
import { cookies } from 'next/headers';

/** How the forum lists threads on this device: classic rows, or cards (set from the List / Cards switch). */
export const VIEW_COOKIE = 'fc_view';
export type Layout = 'list' | 'cards';

export async function layoutOf(): Promise<Layout> {
  return (await cookies()).get(VIEW_COOKIE)?.value === 'cards' ? 'cards' : 'list';
}
