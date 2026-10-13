// Fills the forum with clearly-flagged mock members and posts so it doesn't look empty.
// Remove it all later from Admin -> Overview -> "Remove all mock content".
//   node scripts/seed-mock.mjs        (uses DATABASE_URL, or LOCAL_DB)
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import sharp from 'sharp';

const CITY = process.env.NEXT_PUBLIC_CITY || 'Montreal';

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

const [{ n }] = await query('SELECT count(*)::int AS n FROM members WHERE is_mock');
if (n > 0) {
  console.log(`[seed-mock] ${n} mock members already exist. Remove them from the admin panel first.`);
  await close();
  process.exit(0);
}

const MEMBERS = ['nox514', 'kev.plateau', 'mira.sh', 'dumpsterjazz', 'vicverdun', 'lou_mileend'];

// [board/sub, author, hoursAgo, title, body, comments, extra?]
//   extra: { cover: [bg, ink, accent, shape], pages: n sample pages, listing: {...}, bids: [[who, cents, minutesAgo]], offers: [[who, cents, note]], deals: [[buyer, cents, rating, note, daysAgo]] }
// comment: [author, minutesAfterThread, body, replies?]
const THREADS = [
  ['general/discussion', 'nox514', 30, 'Rain all week and I have a full bag of cans',
    "Forecast says rain till Sunday. Anyone know a covered wall that isn't a 40 minute bus ride?\n\nOr we just do a blackbook night somewhere warm. I'll bring markers.",
    [
      ['kev.plateau', 25, "Blackbook night is the move. I've got a basement in the Plateau, fits like 8 people if nobody brings a bike.", [
        ['nox514', 40, 'Say less. Friday?'],
        ['mira.sh', 62, "I'm in if there's tea. **Real** tea, not the dusty bags.", [
          ['kev.plateau', 70, '> Real tea\n\nWe have one (1) box of something orange. That is the offer.'],
        ]],
      ]],
      ['dumpsterjazz', 95, "Bring tracing paper. Last time @kev.plateau ran out halfway and started drawing on the pizza box."],
      ['vicverdun', 180, 'Covered spot by the canal works if you go early. After 10 it gets busy.'],
    ]],
  ['general/discussion', 'kev.plateau', 52, 'What are you listening to while painting?',
    "Need new stuff. I've had the same three albums on loop since August and my neighbours have noticed.",
    [
      ['lou_mileend', 12, 'Old Montreal hip hop mixtapes, the ones people burned onto CDs. Nothing hits the same at 2am.'],
      ['mira.sh', 30, 'Ambient. Hot take but it makes my lines cleaner.', [
        ['nox514', 41, 'Ambient while painting is crazy. I need something that makes me feel like I am being chased.'],
        ['mira.sh', 55, "That's why your fills look like that"],
        ['nox514', 58, 'fair'],
      ]],
      ['vicverdun', 120, "Podcasts. Doesn't matter which, I just need someone talking."],
    ]],
  ['travel/meetups', 'mira.sh', 76, 'Barcelona in November: who should I link with?',
    "Going for 10 days. Mostly want to paint and skate, not do the cathedral thing. Anyone been recently?\n\nWill trade Montreal tips for Barcelona tips.",
    [
      ['lou_mileend', 45, 'The waterfront plazas are worth it for skating even if you just watch. Go early, it gets packed with tourists by noon.'],
      ['dumpsterjazz', 130, "Don't paint anything without asking someone local first. Rules there are not the same as here.", [
        ['mira.sh', 150, "Yeah that's the plan, I'd rather link with people than wing it."],
      ]],
      ['nox514', 300, 'Bring back stickers. Not optional.'],
    ]],
  ['travel/places', 'vicverdun', 98, 'Toronto for a weekend: worth it?',
    'Cheap train tickets this month. Is it worth going just for the skate spots, or is it all just big and grey?',
    [
      ['kev.plateau', 20, "Big and grey but the scene is good. Go to the parks, skip the downtown stuff.", [
        ['vicverdun', 35, 'Any you specifically like?'],
        ['kev.plateau', 48, "I'll DM you, too many to type."],
      ]],
      ['lou_mileend', 200, 'Eat everything. That city is a food court.'],
    ]],
  ['lifestyle/style', 'dumpsterjazz', 20, "Thrift on Saint-Laurent that isn't overpriced yet",
    "Everything got expensive overnight. Where are people still finding decent jackets under 30 bucks?",
    [
      ['lou_mileend', 18, "The church sales in the east end on Saturday mornings. You have to dig but it's worth it."],
      ['mira.sh', 44, 'Don\'t say it out loud, they\'ll raise prices', [
        ['dumpsterjazz', 50, 'This forum is invite only for a reason'],
        ['nox514', 66, 'Nobody tell the vintage resellers'],
      ]],
    ]],
  ['general/discussion', 'lou_mileend', 9, 'Best food after a late session, go',
    'Rules: has to be open after 1am, has to be under 15 dollars, no chains.',
    [
      ['nox514', 6, 'Poutine. Next question.', [
        ['vicverdun', 14, 'Which one though, this is where friendships end'],
        ['nox514', 19, "I'm not saying it in public"],
      ]],
      ['kev.plateau', 22, 'Bagels straight out of the oven. Warm bag in your hands at 3am is a religious experience.'],
      ['dumpsterjazz', 40, 'Depanneur sandwich and a juice. Humble but undefeated.'],
      ['mira.sh', 75, 'All of the above in that order'],
    ]],
  ['travel/meetups', 'vicverdun', 4, 'Peace Park still the move on Sundays?',
    'Haven\'t been since summer. Is it still a whole crowd on Sunday afternoons or did everyone move on?',
    [
      ['lou_mileend', 15, 'Still busy. Bring your own board wax, the ledges are crusty.'],
      ['kev.plateau', 33, "I'll be there around 3 if anyone wants to link."],
    ]],
  ['lifestyle/print', 'mira.sh', 2, 'Sketch dump thread',
    "Post what you've been drawing. Doesn't have to be good. **Especially** if it isn't good.\n\nI'll start: three versions of the same M and I hate all of them.",
    [
      ['dumpsterjazz', 8, 'The M with the arrow coming off the leg is the one. Commit to it.'],
      ['nox514', 25, "Mine are all on the back of receipts so I can't post them, but I'm proud of them."],
    ]],
  ['general/stories', 'lou_mileend', 28, 'First wall',
    "Summer 2009, the legal wall behind the old textile building. I had four cans, two of them almost empty, and a sketch I'd redrawn maybe forty times.\n\nAn older writer I'd never met watched me fight the outline for an hour, then walked over, took my worst can, and showed me how to hold it further back. Didn't say his name. Painted a small character in the corner of my piece and left.\n\nThe wall got buffed the next spring. I still have the photo, and I still hold the can the way he showed me.",
    [
      ['kev.plateau', 40, 'Everyone has that one person who showed them the can thing.'],
      ['nox514', 95, 'Post the photo if you still have it.', [
        ['lou_mileend', 110, "Have to find the hard drive first. It's in a box somewhere."],
      ]],
    ], { cover: ['#1d1c1a', '#e4e1d9', '#3D6BFF', 2] }],
  ['market/zines', 'mira.sh', 14, 'Second Hand Light, issue 3',
    "Risograph, 28 pages, two colours. Edition of 80, numbered.\n\nPhotos from the last two winters, mostly night. Pick up in the Plateau or I can mail it.",
    [
      ['vicverdun', 30, 'Do you still have issue 2?', [
        ['mira.sh', 52, 'Two copies left. Message me.'],
      ]],
    ], {
      cover: ['#e4e1d9', '#0e0e0d', '#FF5A1F', 0], pages: 6,
      listing: { mode: 'fixed', price: 1200, quantity: 80, ships: true, ship: 300, shipNote: 'Canada, US', meetup: true, area: 'Plateau' },
      deals: [['nox514', 1200, 'good', 'Fast, as described.', 9], ['vicverdun', 1200, 'good', null, 6], ['lou_mileend', 1200, 'good', 'Beautiful print.', 3]],
    }],
  ['market/goods', 'dumpsterjazz', 33, 'Screen print, 50 x 70',
    'Three-colour print on heavy paper. 12 left from a run of 30. Signed on the back.',
    [], {
      cover: ['#0e0e0d', '#e4e1d9', '#FF5FA2', 1],
      listing: { mode: 'fixed', price: 4000, quantity: 12, offers: true, ships: true, ship: 800, shipNote: 'Canada', meetup: true, area: 'Verdun', trades: true },
      offers: [['vicverdun', 3200, 'Could pick up this week.']],
    }],
  ['market/goods', 'kev.plateau', 20, 'Blackbook, 2011 to 2014',
    'Full book, 120 pages, about half filled. Some pages signed by people who would rather stay unnamed. Auction, no reserve.',
    [['nox514', 40, 'This book has history.']], {
      cover: ['#1d1c1a', '#e4e1d9', '#CFCFCF', 2],
      listing: { mode: 'auction', price: 3000, days: 2, increment: 500, ships: true, ship: 1200, meetup: true, area: 'Mile End' },
      bids: [['lou_mileend', 3000, 300], ['nox514', 3500, 180], ['lou_mileend', 4000, 70]],
    }],
  ['market/wanted', 'kev.plateau', 60, 'Montreal zines, 2000 to 2010',
    'Looking for anything local from that decade, any condition. Will trade or pay.',
    [['lou_mileend', 70, 'I have a few. Will check the boxes this weekend.']], { listing: { mode: 'wanted', price: 2000 } }],
];

// Abstract zine-style covers for the mock threads: halftone ground, one shape, three bars. No text.
async function mockCover(memberId, [bg, ink, accent, shape]) {
  const form = shape === 0 ? `<circle cx="400" cy="430" r="250" fill="${accent}"/>`
    : shape === 1 ? `<rect x="90" y="140" width="620" height="560" fill="${accent}"/>`
    : `<path d="M0 760 L800 300 L800 1000 L0 1000Z" fill="${accent}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <defs><pattern id="d" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3.2" fill="${ink}" fill-opacity=".28"/></pattern></defs>
    <rect width="800" height="1000" fill="${bg}"/><rect width="800" height="1000" fill="url(#d)"/>${form}
    <rect x="60" y="820" width="680" height="16" fill="${ink}"/><rect x="60" y="860" width="420" height="16" fill="${ink}"/>
    <rect x="60" y="900" width="260" height="16" fill="${ink}" fill-opacity=".6"/></svg>`;
  const data = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
  const id = randomBytes(12).toString('base64url');
  await query(
    `INSERT INTO media (id, member_id, data, bytes, width, height, animated, expires_at) VALUES ($1, $2, decode($3, 'base64'), $4, 800, 1000, false, 'infinity')`,
    [id, memberId, data.toString('base64'), data.length],
  );
  return id;
}

// Sample pages for the mock zine: photo blocks, captions and a page number, all shapes, no text.
async function mockPage(memberId, n) {
  const ink = '#0e0e0d', paper = n % 3 === 0 ? '#e4e1d9' : '#ece9e1';
  const photo = n % 2
    ? `<rect x="70" y="90" width="460" height="560" fill="${ink}"/><rect x="70" y="90" width="460" height="560" fill="url(#h)"/>`
    : `<rect x="70" y="90" width="460" height="300" fill="${ink}"/><rect x="70" y="420" width="220" height="230" fill="${ink}" fill-opacity=".85"/><rect x="310" y="420" width="220" height="230" fill="#FF5A1F"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
    <defs><pattern id="h" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="${paper}" fill-opacity=".35"/></pattern></defs>
    <rect width="600" height="800" fill="${paper}"/>${photo}
    <rect x="70" y="680" width="380" height="9" fill="${ink}"/><rect x="70" y="700" width="300" height="9" fill="${ink}" fill-opacity=".7"/>
    ${Array.from({ length: n + 1 }, (_, i) => `<circle cx="${520 - i * 14}" cy="745" r="4" fill="${ink}"/>`).join('')}</svg>`;
  const data = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  const id = randomBytes(12).toString('base64url');
  await query(
    `INSERT INTO media (id, member_id, data, bytes, width, height, animated, expires_at) VALUES ($1, $2, decode($3, 'base64'), $4, 600, 800, false, 'infinity')`,
    [id, memberId, data.toString('base64'), data.length],
  );
  return id;
}

const fmt = (c) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

const hash = await bcrypt.hash(randomBytes(24).toString('hex'), 10); // nobody can log in as a mock member
const ids = {};
for (const [i, name] of MEMBERS.entries()) {
  const [row] = await query(
    `INSERT INTO members (username, username_key, password_hash, is_mock, created_at, last_seen_at)
     VALUES ($1, $2, $3, true, now() - ($4 || ' days')::interval, now() - ($5 || ' minutes')::interval)
     ON CONFLICT (username_key) DO NOTHING RETURNING id`,
    [name, name.toLowerCase(), hash, String(9 + i * 2), String(i < 3 ? 3 + i * 4 : 90 + i * 60)],
  );
  if (!row) { console.error(`[seed-mock] username ${name} is taken by a real member, stopping.`); await close(); process.exit(1); }
  ids[name] = row.id;
}

let threads = 0, comments = 0, props = 0;
const pick = (n) => [...MEMBERS].sort(() => Math.random() - 0.5).slice(0, n);

for (const [place, author, hoursAgo, title, text, tree, extra = {}] of THREADS) {
  const [board, topic] = place.split('/');
  const at = `${hoursAgo * 60} minutes`;
  const cover = extra.cover ? await mockCover(ids[author], extra.cover) : null;
  const pages = [];
  for (let n = 1; n <= (extra.pages ?? 0); n++) pages.push(await mockPage(ids[author], n));
  const images = [cover, ...pages].filter(Boolean);
  const body = images.length ? `${images.map((i) => `[img:${i}]`).join('\n')}\n\n${text}` : text;
  const L = extra.listing;
  const [t] = await query(
    `INSERT INTO threads (city, board, topic, user_id, title, body, created_at, last_post_at, status)
     VALUES ($1, $2, $7, $3, $4, $5, now() - $6::interval, now() - $6::interval, $8) RETURNING id`,
    [CITY, board, ids[author], title, body, at, topic ?? null, L ? 'open' : null],
  );
  if (images.length) await query('UPDATE media SET thread_id = $1 WHERE id = ANY($2::text[])', [t.id, images]);
  if (L) {
    const deals = extra.deals ?? [];
    await query(
      `INSERT INTO listings (thread_id, seller_id, mode, price_cents, quantity, sold_count, accept_offers, ships, ship_cents, ship_note, meetup, meetup_area, trades, ends_at, increment_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [t.id, ids[author], L.mode, L.price ?? null, L.quantity ?? 1, deals.length, !!L.offers, !!L.ships, L.ship ?? null, L.shipNote ?? null,
        !!L.meetup, L.area ?? null, !!L.trades, L.mode === 'auction' ? new Date(Date.now() + (L.days ?? 2) * 864e5) : null, L.increment ?? null],
    );
    for (const [who, cents, minutes] of extra.bids ?? []) {
      await query(`INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, method, status, created_at) VALUES ($1, $2, 'bid', $3, 'meetup', 'active', now() - ($4 || ' minutes')::interval)`, [t.id, ids[who], cents, String(minutes)]);
    }
    for (const [who, cents, note] of extra.offers ?? []) {
      await query(`INSERT INTO offers (listing_id, buyer_id, kind, amount_cents, method, note) VALUES ($1, $2, 'offer', $3, 'meetup', $4)`, [t.id, ids[who], cents, note]);
    }
    for (const [who, cents, rating, note, days] of deals) {
      await query(
        `INSERT INTO deals (thread_id, title, seller_id, buyer_id, source, amount_cents, currency, method, status, paid_at, completed_at, buyer_rating, buyer_note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'buy', $5, 'CAD', 'meetup', 'complete', now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval, $7, $8, now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval)`,
        [t.id, title, ids[author], ids[who], cents, String(days), rating, note],
      );
    }
    const top = Math.max(0, ...(extra.bids ?? []).map((b) => b[1]));
    const price = L.mode === 'auction' ? fmt(top || L.price) : L.mode === 'wanted' ? (L.price ? `Budget ${fmt(L.price)}` : 'Wanted') : fmt(L.price);
    await query('UPDATE threads SET price = $2 WHERE id = $1', [t.id, price]);
  }
  await query('INSERT INTO thread_follows (member_id, thread_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids[author], t.id]);
  threads++;
  let last = hoursAgo * 60;
  const add = async (list, parent) => {
    for (const [who, after, text, replies] of list) {
      const ago = Math.max(1, hoursAgo * 60 - after);
      const [p] = await query(
        `INSERT INTO posts (thread_id, user_id, body, parent_id, created_at) VALUES ($1, $2, $3, $4, now() - ($5 || ' minutes')::interval) RETURNING id`,
        [t.id, ids[who], text, parent, String(ago)],
      );
      comments++; last = Math.min(last, ago);
      for (const giver of pick(Math.floor(Math.random() * 4))) {
        if (giver === who) continue;
        await query(`INSERT INTO props (member_id, target, target_id) VALUES ($1, 'post', $2) ON CONFLICT DO NOTHING`, [ids[giver], p.id]); props++;
      }
      if (replies) await add(replies, p.id);
    }
  };
  await add(tree, null);
  for (const giver of pick(2 + Math.floor(Math.random() * 4))) {
    if (giver === author) continue;
    await query(`INSERT INTO props (member_id, target, target_id) VALUES ($1, 'thread', $2) ON CONFLICT DO NOTHING`, [ids[giver], t.id]); props++;
  }
  await query(
    `UPDATE threads SET reply_count = (SELECT count(*) FROM posts WHERE thread_id = $1), last_post_at = now() - ($2 || ' minutes')::interval WHERE id = $1`,
    [t.id, String(last)],
  );
}

await close();
console.log(`[seed-mock] ${MEMBERS.length} mock members, ${threads} threads, ${comments} comments, ${props} props.`);
