// Stored on each thread so city categories can be added later; the forum itself is global.
export const CITY = process.env.NEXT_PUBLIC_CITY || 'global';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fatcap.club').replace(/\/$/, '');

export const BOARDS = [
  { slug: 'general', name: 'General', blurb: 'Anything and everything.' },
  { slug: 'travel', name: 'Travel', blurb: 'Trips, cities, who to link up with.' },
  { slug: 'lifestyle', name: 'Lifestyle', blurb: 'Clothes, music, food, the rest of it.' },
] as const;

export type BoardSlug = (typeof BOARDS)[number]['slug'];

export function boardBySlug(slug: string) {
  return BOARDS.find((b) => b.slug === slug) ?? null;
}

export const LIMITS = { title: 120, body: 5000, message: 2000, username: [3, 20] as const, password: 8 };

export const PAGE_SIZE = 30;
