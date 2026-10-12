// Create (or reset the password of) a member without an invite.
//   node scripts/create-user.mjs <username> <password> [--admin]
// Uses LOCAL_DB (local PGlite) if set, otherwise DATABASE_URL (Neon).
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

const [username, password] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const admin = process.argv.includes('--admin');
if (!username || !password) {
  console.error('Usage: node scripts/create-user.mjs <username> <password> [--admin]');
  process.exit(1);
}
if (password.length < 8) console.warn('[create-user] warning: password is under 8 characters. Fine for testing, not for a real account.');

let query, close = async () => {};
if (process.env.LOCAL_DB) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(process.env.LOCAL_DB);
  query = async (t, p) => (await pg.query(t, p)).rows;
  close = () => pg.close();
} else if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  query = (t, p) => sql.query(t, p);
} else {
  console.error('Set LOCAL_DB or DATABASE_URL first.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const [row] = await query(
  `INSERT INTO members (username, username_key, password_hash, is_admin)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (username_key) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = members.is_admin OR EXCLUDED.is_admin, banned = false
   RETURNING id, username, is_admin`,
  [username.trim(), username.trim().toLowerCase(), hash, admin],
);
await close();
console.log(`[create-user] ${row.username} (id ${row.id})${row.is_admin ? ' admin' : ''} ready.`);
