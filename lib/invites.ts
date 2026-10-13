import 'server-only';
import { randomInt } from 'node:crypto';
import { q, one } from './db';
import { SITE_URL } from './config';

// No 0/O, 1/I/L: these codes get read off stickers.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode(len = 10) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const inviteUrl = (code: string) => `${SITE_URL}/i/${code}`;

export type Invite = {
  id: number;
  code: string;
  kind: 'sticker' | 'member' | 'setup';
  batch: string | null;
  created_by: number | null;
  used_by: number | null;
  used_at: string | null;
  revoked: boolean;
};

export async function findInvite(code: string) {
  return one<Invite>('SELECT * FROM invites WHERE code = $1', [code.toUpperCase()]);
}

/** A member's own invite: created on first look, one per member. */
export async function memberInvite(userId: number) {
  const existing = await one<Invite & { used_by_name: string | null }>(
    `SELECT i.*, u.username AS used_by_name
       FROM invites i LEFT JOIN members u ON u.id = i.used_by
      WHERE i.kind = 'member' AND i.created_by = $1
      ORDER BY i.id LIMIT 1`,
    [userId],
  );
  if (existing) return existing;
  for (let tries = 0; tries < 5; tries++) {
    const row = await one<Invite>(
      `INSERT INTO invites (code, kind, created_by) VALUES ($1, 'member', $2)
       ON CONFLICT (code) DO NOTHING RETURNING *`,
      [newCode(), userId],
    );
    if (row) return { ...row, used_by_name: null };
  }
  throw new Error('Could not create invite');
}

/** Make a batch of one-time sticker codes. */
export async function createStickerBatch(batch: string, count: number, adminId: number) {
  const codes = Array.from({ length: count }, () => newCode());
  await q(
    `INSERT INTO invites (code, kind, batch, created_by)
     SELECT c, 'sticker', $2, $3 FROM unnest($1::text[]) AS c
     ON CONFLICT (code) DO NOTHING`,
    [codes, batch, adminId],
  );
}
