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

  // v2: threaded comments, pin/lock, edits, props, unread tracking, DMs, alerts
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS edited_at timestamptz`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES posts(id) ON DELETE SET NULL`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS props (
    member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    target     text NOT NULL CHECK (target IN ('thread', 'post')),
    target_id  integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, target, target_id)
  )`,
  `CREATE INDEX IF NOT EXISTS props_target_idx ON props (target, target_id)`,
  `CREATE TABLE IF NOT EXISTS thread_reads (
    member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    thread_id integer NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    read_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, thread_id)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id              serial PRIMARY KEY,
    member_a        integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    member_b        integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    last_sender_id  integer,
    a_read_at       timestamptz,
    b_read_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (member_a, member_b),
    CHECK (member_a < member_b)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id              serial PRIMARY KEY,
    conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       integer REFERENCES members(id) ON DELETE SET NULL,
    body            text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id         serial PRIMARY KEY,
    member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind       text NOT NULL,
    actor_id   integer REFERENCES members(id) ON DELETE SET NULL,
    thread_id  integer REFERENCES threads(id) ON DELETE CASCADE,
    post_id    integer REFERENCES posts(id) ON DELETE CASCADE,
    read_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_member_idx ON notifications (member_id, created_at DESC)`,

  // v3: moderation + removable mock content
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS ban_reason text`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS banned_at timestamptz`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS is_mock boolean NOT NULL DEFAULT false`,

  // v4: live group chat (wiped on a schedule, see lib/chat.ts)
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id         serial PRIMARY KEY,
    member_id  integer REFERENCES members(id) ON DELETE CASCADE,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at)`,

  // v5: chat replies, pictures, reactions; chat alerts; profile bio
  `CREATE TABLE IF NOT EXISTS chat_images (
    id         serial PRIMARY KEY,
    member_id  integer REFERENCES members(id) ON DELETE CASCADE,
    mime       text NOT NULL,
    data       bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to integer REFERENCES chat_messages(id) ON DELETE SET NULL`,
  `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_id integer REFERENCES chat_images(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS chat_reactions (
    message_id integer NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    emoji      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, member_id, emoji)
  )`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS chat_id integer`,
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS bio text`,

  // v6: images and GIFs. Re-encoded on upload (metadata stripped), members-only, and they expire (see lib/media.ts).
  `CREATE TABLE IF NOT EXISTS media (
    id         text PRIMARY KEY,
    member_id  integer REFERENCES members(id) ON DELETE CASCADE,
    data       bytea NOT NULL,
    bytes      integer NOT NULL,
    width      integer NOT NULL,
    height     integer NOT NULL,
    animated   boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS media_expires_idx ON media (expires_at)`,
  `CREATE INDEX IF NOT EXISTS media_member_idx ON media (member_id, created_at)`,

  // v7: sub-categories inside each board (lib/config.ts). NULL = posted to the board itself.
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS topic text`,
  `CREATE INDEX IF NOT EXISTS threads_topic_idx ON threads (board, topic, last_post_at DESC)`,

  // v7: failed logins per username, to slow down password guessing (no IPs kept)
  `CREATE TABLE IF NOT EXISTS login_failures (
    username_key text NOT NULL,
    at           timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS login_failures_idx ON login_failures (username_key, at)`,

  // v8: vanishing threads, market listings, follow / save, reports
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS expires_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS threads_expires_idx ON threads (expires_at) WHERE expires_at IS NOT NULL`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS price text`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS status text`,
  // Images in a thread's opening post live as long as the thread (see lib/media.ts).
  `ALTER TABLE media ADD COLUMN IF NOT EXISTS thread_id integer REFERENCES threads(id) ON DELETE CASCADE`,
  `CREATE TABLE IF NOT EXISTS thread_follows (
    member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    thread_id  integer NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    following  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, thread_id)
  )`,
  `CREATE INDEX IF NOT EXISTS thread_follows_thread_idx ON thread_follows (thread_id) WHERE following`,
  `CREATE TABLE IF NOT EXISTS thread_saves (
    member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    thread_id  integer NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, thread_id)
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id          serial PRIMARY KEY,
    member_id   integer REFERENCES members(id) ON DELETE SET NULL,
    thread_id   integer REFERENCES threads(id) ON DELETE CASCADE,
    post_id     integer REFERENCES posts(id) ON DELETE CASCADE,
    reason      text NOT NULL,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by integer REFERENCES members(id) ON DELETE SET NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reports_once_idx ON reports (member_id, thread_id, COALESCE(post_id, 0)) WHERE resolved_at IS NULL`,
  // Alerts about the same thread fold into one while unread ("x and 2 more commented in ...").
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS count integer NOT NULL DEFAULT 1`,
  // Thread starters follow their threads (rows that already exist, including unfollows, are left alone).
  `INSERT INTO thread_follows (member_id, thread_id) SELECT user_id, id FROM threads WHERE user_id IS NOT NULL ON CONFLICT DO NOTHING`,

  // v9: market. A listing is a Market thread plus how it sells; offers and bids hang off it;
  // a deal is an agreed sale between two members, walked through by hand (paid, shipped, received).
  `CREATE TABLE IF NOT EXISTS listings (
    thread_id       integer PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
    seller_id       integer REFERENCES members(id) ON DELETE CASCADE,
    mode            text NOT NULL CHECK (mode IN ('fixed', 'offers', 'auction', 'wanted')),
    price_cents     integer,
    currency        text NOT NULL DEFAULT 'CAD',
    accept_offers   boolean NOT NULL DEFAULT false,
    quantity        integer NOT NULL DEFAULT 1,
    sold_count      integer NOT NULL DEFAULT 0,
    ships           boolean NOT NULL DEFAULT false,
    ship_cents      integer,
    ship_note       text,
    meetup          boolean NOT NULL DEFAULT false,
    meetup_area     text,
    trades          boolean NOT NULL DEFAULT false,
    ends_at         timestamptz,
    increment_cents integer,
    min_deals       integer NOT NULL DEFAULT 0,
    settled         boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings (seller_id)`,
  `CREATE INDEX IF NOT EXISTS listings_auction_idx ON listings (ends_at) WHERE mode = 'auction' AND NOT settled`,
  `CREATE TABLE IF NOT EXISTS offers (
    id           serial PRIMARY KEY,
    listing_id   integer NOT NULL REFERENCES listings(thread_id) ON DELETE CASCADE,
    buyer_id     integer REFERENCES members(id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('offer', 'bid')),
    amount_cents integer,
    quantity     integer NOT NULL DEFAULT 1,
    method       text CHECK (method IN ('ship', 'meetup')),
    note         text,
    status       text NOT NULL DEFAULT 'pending',
    created_at   timestamptz NOT NULL DEFAULT now(),
    decided_at   timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS offers_listing_idx ON offers (listing_id, kind, status)`,
  `CREATE INDEX IF NOT EXISTS offers_buyer_idx ON offers (buyer_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS deals (
    id            serial PRIMARY KEY,
    thread_id     integer REFERENCES threads(id) ON DELETE SET NULL,
    title         text NOT NULL,
    seller_id     integer REFERENCES members(id) ON DELETE SET NULL,
    buyer_id      integer REFERENCES members(id) ON DELETE SET NULL,
    offer_id      integer REFERENCES offers(id) ON DELETE SET NULL,
    source        text NOT NULL CHECK (source IN ('buy', 'offer', 'auction')),
    amount_cents  integer,
    ship_cents    integer,
    currency      text NOT NULL DEFAULT 'CAD',
    quantity      integer NOT NULL DEFAULT 1,
    method        text NOT NULL CHECK (method IN ('ship', 'meetup')),
    note          text,
    status        text NOT NULL DEFAULT 'agreed',
    paid_at       timestamptz,
    confirmed_at  timestamptz,
    sent_at       timestamptz,
    completed_at  timestamptz,
    cancelled_at  timestamptz,
    cancelled_by  integer REFERENCES members(id) ON DELETE SET NULL,
    cancel_reason text,
    buyer_rating  text CHECK (buyer_rating IN ('good', 'bad')),
    buyer_note    text,
    seller_rating text CHECK (seller_rating IN ('good', 'bad')),
    seller_note   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS deals_seller_idx ON deals (seller_id, status)`,
  `CREATE INDEX IF NOT EXISTS deals_buyer_idx ON deals (buyer_id, status)`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deal_id integer`,

  // v10: blocking members, profile pictures.
  `CREATE TABLE IF NOT EXISTS blocks (
    blocker_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    blocked_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
  )`,
  `CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked_id)`,
  `CREATE TABLE IF NOT EXISTS avatars (
    member_id  integer PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    data       bytea NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  // v11: Market posts wait for an admin (review: 'pending' or 'rejected'; null = live), digital zines.
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS review text CHECK (review IN ('pending', 'rejected'))`,
  `ALTER TABLE threads ADD COLUMN IF NOT EXISTS review_note text`,
  `CREATE INDEX IF NOT EXISTS threads_review_idx ON threads (created_at) WHERE review IS NOT NULL`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'physical' CHECK (format IN ('physical', 'digital'))`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS shape text NOT NULL DEFAULT 'tall' CHECK (shape IN ('tall', 'square'))`,
  `ALTER TABLE listings ADD COLUMN IF NOT EXISTS preview_pages integer NOT NULL DEFAULT 3`,
  `CREATE TABLE IF NOT EXISTS zine_pages (
    thread_id integer NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    n         integer NOT NULL,
    kind      text NOT NULL CHECK (kind IN ('image', 'text')),
    media_id  text,
    body      text,
    fit       text NOT NULL DEFAULT 'cover' CHECK (fit IN ('cover', 'contain')),
    PRIMARY KEY (thread_id, n)
  )`,
  // A digital zine is a deal like any other, just with nothing to ship.
  `ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_method_check`,
  `ALTER TABLE deals ADD CONSTRAINT deals_method_check CHECK (method IN ('ship', 'meetup', 'digital'))`,
  // Zines and books a member owns show on their profile, unless they'd rather not.
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS show_collection boolean NOT NULL DEFAULT true`,
];

for (const s of statements) await exec(s);
await close();
console.log(`[migrate] ok (${statements.length} statements)`);
