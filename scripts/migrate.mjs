// Creates or updates the database tables. Runs before every build.
// Every statement is idempotent, so running it again is safe.
import { neon } from '@neondatabase/serverless';

let exec, close = async () => {};
if (process.env.LOCAL_DB) {
  // Local development database (PGlite), see lib/db.ts.
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(process.env.LOCAL_DB);
  exec = (s) => pg.query(s);
  close = () => pg.close();
} else if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  exec = (s) => sql.query(s);
} else {
  console.log('[migrate] DATABASE_URL not set, skipping.');
  process.exit(0);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS members (
    id            serial PRIMARY KEY,
    username      text NOT NULL,
    username_key  text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_admin      boolean NOT NULL DEFAULT false,
    banned        boolean NOT NULL DEFAULT false,
    invited_via   integer,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    id         serial PRIMARY KEY,
    code       text NOT NULL UNIQUE,
    kind       text NOT NULL CHECK (kind IN ('sticker', 'member', 'setup')),
    batch      text,
    created_by integer REFERENCES members(id) ON DELETE SET NULL,
    used_by    integer REFERENCES members(id) ON DELETE SET NULL,
    used_at    timestamptz,
    revoked    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS invites_batch_idx ON invites (batch)`,
  `CREATE INDEX IF NOT EXISTS invites_created_by_idx ON invites (created_by)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS threads (
    id           serial PRIMARY KEY,
    city         text NOT NULL,
    board        text NOT NULL,
    user_id      integer REFERENCES members(id) ON DELETE SET NULL,
    title        text NOT NULL,
    body         text NOT NULL,
    reply_count  integer NOT NULL DEFAULT 0,
    deleted      boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_post_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS threads_board_idx ON threads (city, board, last_post_at DESC)`,
  `CREATE INDEX IF NOT EXISTS threads_user_idx ON threads (user_id)`,
  `CREATE TABLE IF NOT EXISTS posts (
    id         serial PRIMARY KEY,
    thread_id  integer NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id    integer REFERENCES members(id) ON DELETE SET NULL,
    body       text NOT NULL,
    deleted    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS posts_thread_idx ON posts (thread_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS posts_user_idx ON posts (user_id)`,
];

for (const s of statements) await exec(s);
await close();
console.log(`[migrate] ok (${statements.length} statements)`);
