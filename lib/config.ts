// Stored on each thread so city categories can be added later; the forum itself is global.
export const CITY = process.env.NEXT_PUBLIC_CITY || 'global';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fatcap.club').replace(/\/$/, '');

// The forum tree: boards, each with three sub-forums. Market lists things members sell or trade
// (shown as a grid, with a price on each thread). Rename or reorder freely; slugs are stored on threads.
export const BOARDS = [
  {
    slug: 'general', name: 'General', blurb: 'The main room.', market: false,
    subs: [
      { slug: 'introductions', name: 'Introductions', blurb: 'New members.' },
      { slug: 'discussion', name: 'Discussion', blurb: 'Open topics.' },
      { slug: 'stories', name: 'Stories', blurb: 'Long form, first hand.' },
    ],
  },
  {
    slug: 'travel', name: 'Travel', blurb: 'Elsewhere.', market: false,
    subs: [
      { slug: 'meetups', name: 'Meetups', blurb: 'Plans, dates, people.' },
      { slug: 'places', name: 'Places', blurb: 'Notes on cities.' },
      { slug: 'trips', name: 'Trips', blurb: 'Write-ups.' },
    ],
  },
  {
    slug: 'lifestyle', name: 'Lifestyle', blurb: 'Everything around it.', market: false,
    subs: [
      { slug: 'style', name: 'Style', blurb: 'Clothing.' },
      { slug: 'music', name: 'Music', blurb: 'Sound.' },
      { slug: 'print', name: 'Print', blurb: 'Zines, books, photo.' },
    ],
  },
  {
    slug: 'market', name: 'Market', blurb: 'Members only. Deals happen in messages.', market: true,
    subs: [
      { slug: 'zines', name: 'Zines', blurb: 'Issues, sale or trade.' },
      { slug: 'goods', name: 'Goods', blurb: 'Prints, clothing, other.' },
      { slug: 'wanted', name: 'Wanted', blurb: 'Looking for.' },
    ],
  },
] as const;

export type BoardSlug = (typeof BOARDS)[number]['slug'];
export type Board = (typeof BOARDS)[number];
export type Sub = Board['subs'][number];

export function boardBySlug(slug: string) {
  return BOARDS.find((b) => b.slug === slug) ?? null;
}

/** A sub-category of a board, or null. */
export function subBySlug(board: string, sub: string | null | undefined): Sub | null {
  if (!sub) return null;
  return (boardBySlug(board)?.subs as readonly Sub[] | undefined)?.find((s) => s.slug === sub) ?? null;
}

/** "Travel / Link-ups", or just "Travel". */
export function placeName(board: string, sub?: string | null) {
  const b = boardBySlug(board);
  const s = subBySlug(board, sub);
  return s ? `${b?.name ?? board} / ${s.name}` : b?.name ?? board;
}

// body: a thread's opening post (long reads welcome); comment: a comment or reply; message: a DM.
export const LIMITS = { title: 120, body: 40000, comment: 10000, message: 4000, username: [3, 20] as const, password: 8, price: 40 };

/** How long a thread can be set to last before it deletes itself, in days. */
export const VANISH = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const;
export const vanishDays = (v: string) => VANISH.find((o) => String(o.days) === v)?.days ?? null;

export const isMarket = (board: string) => !!boardBySlug(board)?.market;

export const REPORT_REASONS = ['Spam', 'Harassment', 'Personal info', 'Other'] as const;

export const PAGE_SIZE = 30;

/** "travel/link-ups" from a form -> the board and sub-category, or null if either is unknown. */
export function parsePlace(value: string) {
  const [b, s] = value.split('/');
  const board = boardBySlug(b ?? '');
  const sub = board ? subBySlug(board.slug, s) : null;
  return board && sub ? { board: board.slug, topic: sub.slug } : null;
}
