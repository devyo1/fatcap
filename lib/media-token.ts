// How an uploaded image sits inside a post, comment, DM or chat message: its own line reading [img:<id>].
// Shared by the server (cleanup) and the browser (rendering, the attach button).

export const MEDIA_ID = /^[A-Za-z0-9_-]{16}$/;
// An image on its own line; anything after it on the same line is its caption.
export const MEDIA_LINE = /^\[img:([A-Za-z0-9_-]{16})\](?:\s+(.*))?$/;
const MEDIA_ANY = /\[img:([A-Za-z0-9_-]{16})\]/g;

export const mediaToken = (id: string) => `[img:${id}]`;
export const mediaUrl = (id: string) => `/api/media/${id}`;

/** Image ids referenced in a text. */
export function mediaIn(text: string): string[] {
  return [...new Set([...text.matchAll(MEDIA_ANY)].map((m) => m[1]))];
}

/** Text for one-line previews (search results, inbox, admin): image tokens become "[image]". */
export const plain = (text: string) => text.replace(MEDIA_ANY, '[image]');
