import 'server-only';
import { randomBytes } from 'node:crypto';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import { q, one } from './db';
import { MEDIA_DAYS, pruneMedia } from './media';

// Decoding and re-encoding uploads (see lib/media.ts for the rules). Kept apart so sharp only
// loads in the upload routes, not in every page that can delete a post.
const DAY = 864e5;
const PER_DAY = 60; // forum/DM uploads per member per 24h
const EDGE = 1600; // longest side for photos
const GIF_EDGE = 480; // and for animations
const MAX_FRAMES = 300;
const MAX_OUT = 3 * 1024 * 1024;
const FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

export type Encoded = { data: Buffer; width: number; height: number; animated: boolean };

/**
 * Decode any common image and write a fresh WebP: resized, camera orientation baked in, and
 * every scrap of metadata (EXIF, GPS, XMP, ICC, comments) left behind. Animated GIFs stay animated.
 * Used for forum/DM images and chat pictures alike.
 */
export async function encodeImage(input: Buffer): Promise<Encoded | { error: string }> {
  const opts = { limitInputPixels: 60_000_000, failOn: 'error' as const };
  let meta: Metadata;
  try { meta = await sharp(input, { ...opts, animated: true }).metadata(); } catch { return { error: "That file isn't an image we can read." }; }
  if (!meta.format || !FORMATS.has(meta.format)) return { error: 'Use a JPG, PNG, GIF, WebP or AVIF.' };
  const frames = meta.pages ?? 1;
  const animated = frames > 1;
  if (frames > MAX_FRAMES) return { error: 'That GIF is too long. Try a shorter one.' };

  let out: { data: Buffer; info: OutputInfo };
  try {
    let img = sharp(input, { ...opts, animated });
    if (!animated) img = img.rotate(); // bake in the camera's orientation, since the EXIF that carried it is dropped
    const edge = animated ? GIF_EDGE : EDGE;
    out = await img
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: animated ? 70 : 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { error: "Couldn't process that image." };
  }
  if (out.data.length > MAX_OUT) return { error: 'Still too heavy after shrinking. Try a shorter GIF or a smaller image.' };
  return { data: out.data, width: out.info.width, height: Math.round(out.info.height / (animated ? frames : 1)), animated };
}

/** Forum / DM image: encode, store with an expiry, prune. */
export async function storeImage(memberId: number, input: Buffer): Promise<{ id: string } | { error: string }> {
  const recent = await one<{ n: number }>(`SELECT count(*)::int AS n FROM media WHERE member_id = $1 AND created_at > now() - interval '1 day'`, [memberId]);
  if ((recent?.n ?? 0) >= PER_DAY) return { error: 'That is a lot of images for one day. Try again tomorrow.' };

  const img = await encodeImage(input);
  if ('error' in img) return img;
  const id = randomBytes(12).toString('base64url');
  await q(
    `INSERT INTO media (id, member_id, data, bytes, width, height, animated, expires_at)
     VALUES ($1, $2, decode($3, 'base64'), $4, $5, $6, $7, $8)`,
    [id, memberId, img.data.toString('base64'), img.data.length, img.width, img.height, img.animated, new Date(Date.now() + MEDIA_DAYS * DAY)],
  );
  await pruneMedia();
  return { id };
}
