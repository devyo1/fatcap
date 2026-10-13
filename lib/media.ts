import 'server-only';
import { q, one } from './db';
import { MEDIA_ID, mediaIn } from './media-token';

// Images and GIFs members attach. Every upload is decoded and re-encoded to WebP, which drops
// EXIF/GPS, camera and editing metadata, and anything else hiding in the file. Nothing about the
// original is kept (name, type, size, uploader IP). They live in Postgres, are only served to
// signed-in members, and never pile up:
//   - images in a thread's opening post live as long as the thread (stories and listings keep
//     their pictures; a vanishing thread takes them with it)
//   - comment and DM images expire after MEDIA_DAYS; chat pictures go with the chat wipe
//   - when the total passes MEDIA_MAX_MB, the oldest go first (comment/DM images before thread ones,
//     digital zine pages last of all)
//   - deleting a post or message deletes its images
export const MEDIA_DAYS = Math.max(1, Number(process.env.MEDIA_DAYS) || 30);
const MAX_TOTAL = Math.max(20, Number(process.env.MEDIA_MAX_MB) || 200) * 1024 * 1024;
export const UPLOAD_MAX = 4 * 1024 * 1024; // Vercel turns away request bodies over 4.5 MB

/** The image bytes, or null if it never existed or has expired. */
export async function readImage(id: string) {
  if (!MEDIA_ID.test(id)) return null;
  const row = await one<{ data: string }>(`SELECT encode(data, 'base64') AS data FROM media WHERE id = $1 AND expires_at > now()`, [id]);
  return row ? Buffer.from(row.data, 'base64') : null;
}

/** Drop expired images, then the oldest ones while the total is over the cap. Cheap; runs on every upload. */
export async function pruneMedia() {
  await q('DELETE FROM media WHERE expires_at <= now()');
  await q(
    `DELETE FROM media WHERE id IN (
       SELECT id FROM (SELECT id, sum(bytes) OVER (
         ORDER BY (id IN (SELECT media_id FROM zine_pages WHERE media_id IS NOT NULL)) DESC, (thread_id IS NOT NULL) DESC, created_at DESC, id
       ) AS running FROM media) x
        WHERE running > $1)`,
    [MAX_TOTAL],
  );
}

/** Delete the images a removed post or message carried. Only the author's own uploads, so quoting someone's image can't delete it. */
export async function dropMedia(items: { body: string; user_id: number | null }[]) {
  for (const { body, user_id } of items) {
    const ids = mediaIn(body);
    if (ids.length && user_id) await q('DELETE FROM media WHERE id = ANY($1::text[]) AND member_id = $2', [ids, user_id]);
  }
}

/**
 * Tie the images in a thread's opening post to the thread: they last as long as it does (or until
 * it vanishes). Images that were taken out of the post in an edit are deleted.
 */
export async function pinThreadMedia(threadId: number, body: string, authorId: number, expiresAt: Date | string | null) {
  const ids = mediaIn(body);
  await q('DELETE FROM media WHERE thread_id = $1 AND NOT (id = ANY($2::text[]))', [threadId, ids]);
  if (ids.length) {
    await q(
      `UPDATE media SET thread_id = $1, expires_at = COALESCE($4::timestamptz, 'infinity') WHERE id = ANY($2::text[]) AND member_id = $3`,
      [threadId, ids, authorId, expiresAt],
    );
  }
}
