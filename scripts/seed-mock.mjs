// Fills the forum with clearly-flagged mock members, threads in every sub-forum, Market listings,
// deals and pictures, so it doesn't look empty. Safe to run again: only adds what's missing.
// Remove it all from Admin -> Overview -> "Remove all mock content".
//   node scripts/seed-mock.mjs        (uses DATABASE_URL, or LOCAL_DB)
import { neon } from '@neondatabase/serverless';
import { seedMock } from '../lib/mock-data.mjs';

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
  console.error('Set DATABASE_URL (or LOCAL_DB) first.');
  process.exit(1);
}

const r = await seedMock(query);
await close();
console.log(`[seed-mock] added ${r.members} members, ${r.threads} threads, ${r.comments} comments, ${r.likes} likes, ${r.listings} listings, ${r.deals} deals, ${r.pictures} pictures.`);
if (r.skipped.length) console.log(`[seed-mock] skipped (real members use these names): ${r.skipped.join(', ')}`);
